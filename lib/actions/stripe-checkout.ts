"use server";

import { createWooOrderOnServer, checkoutOnServer } from "@/lib/woocommerce/api";
import { createStripeCheckoutSession } from "@/lib/stripe-server";
import type { BillingAddress, ShippingAddress, WooCart } from "@/lib/woocommerce/types";

export interface StripeLineItem {
  name: string;
  unitAmount: number; // in minor units (e.g. cents)
  quantity: number;
  currency: string; // e.g. "usd"
}

export interface CreateStripeOrderResult {
  sessionUrl: string;
  orderId: number;
}

/**
 * Creates a WooCommerce order (status: pending) via REST API v3 then a Stripe Checkout Session.
 * Returns the Stripe-hosted payment page URL.
 */
export async function createStripeOrder(
  billing: BillingAddress,
  shipping: ShippingAddress,
  stripePaymentMethod: string, // e.g. "stripe_cc"
  lineItems: StripeLineItem[],
  cartToken?: string,
  nonce?: string,
  isBuyNow?: boolean,
  cart?: WooCart
): Promise<CreateStripeOrderResult | { error: string }> {
  let orderId: number | undefined;
  let orderKey: string | undefined;

  // 1. First attempt: Create WC order via REST API v3 (status: pending)
  // This bypasses Store API inline payment gateway errors ("payment details not submitted")
  try {
    const selectedShipping = cart?.shipping_rates
      ?.flatMap((pkg) => pkg.shipping_rates)
      ?.find((rate) => rate.selected);

    const shippingLines = selectedShipping
      ? [
          {
            method_id: selectedShipping.method_id || selectedShipping.rate_id,
            method_title: selectedShipping.name,
            total: (
              parseInt(selectedShipping.price || "0") /
              Math.pow(10, selectedShipping.currency_minor_unit || 2)
            ).toFixed(2),
          },
        ]
      : [];

    const couponLines = cart?.coupons?.map((c) => ({ code: c.code })) ?? [];

    const orderLineItems =
      cart?.items && cart.items.length > 0
        ? cart.items.map((item) => ({
            product_id: item.id,
            quantity: item.quantity,
          }))
        : lineItems.map((item) => ({
            name: item.name,
            quantity: item.quantity,
          }));

    const restRes = await createWooOrderOnServer({
      payment_method: stripePaymentMethod || "stripe",
      payment_method_title: "Credit Card (Stripe)",
      status: "pending",
      set_paid: false,
      billing: billing as unknown as Record<string, string>,
      shipping: shipping as unknown as Record<string, string>,
      line_items: orderLineItems,
      shipping_lines: shippingLines.length > 0 ? shippingLines : undefined,
      coupon_lines: couponLines.length > 0 ? couponLines : undefined,
    });

    if (restRes.ok) {
      const wcOrder = (await restRes.json()) as { id: number; order_key: string };
      orderId = wcOrder.id;
      orderKey = wcOrder.order_key;
    } else {
      const errText = await restRes.text();
      console.warn("[createStripeOrder] REST API order creation returned non-ok, falling back to Store API:", restRes.status, errText);
    }
  } catch (err) {
    console.warn("[createStripeOrder] REST API order creation exception, falling back to Store API:", err);
  }

  // Fallback: If REST API was not successful, attempt Store API checkout
  if (!orderId || !orderKey) {
    const wcRes = await checkoutOnServer(
      {
        billing_address: billing as unknown as Record<string, string>,
        shipping_address: shipping as unknown as Record<string, string>,
        payment_method: stripePaymentMethod,
      },
      cartToken,
      nonce
    );

    if (!wcRes.ok) {
      const body = await wcRes.text();
      console.error("[createStripeOrder] WooCommerce checkout API error:", wcRes.status, body);
      return { error: body };
    }

    const wcOrder = (await wcRes.json()) as { order_id: number; order_key: string };
    orderId = wcOrder.order_id;
    orderKey = wcOrder.order_key;
  }

  // 2. Create Stripe Checkout Session
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `http://localhost:${process.env.PORT ?? 3000}`;

  const buyNowParam = isBuyNow ? "&buy_now=1" : "";

  let session;
  try {
    session = await createStripeCheckoutSession({
      orderId,
      lineItems: lineItems.map((item) => ({
        price_data: {
          currency: item.currency.toLowerCase(),
          product_data: { name: item.name },
          unit_amount: item.unitAmount,
        },
        quantity: item.quantity,
      })),
      customerEmail: billing.email,
      successUrl: `${appUrl}/order-confirmation?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}&order_key=${encodeURIComponent(orderKey)}&billing_email=${encodeURIComponent(billing.email)}${buyNowParam}`,
      cancelUrl: `${appUrl}/checkout${isBuyNow ? "?buy_now=1" : ""}`,
    });
  } catch (err) {
    return { error: (err as Error).message };
  }

  if (!session.url) return { error: "Stripe did not return a session URL." };

  return { sessionUrl: session.url, orderId };
}

