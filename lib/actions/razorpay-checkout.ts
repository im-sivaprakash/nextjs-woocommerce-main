"use server";

import { createWooOrderOnServer, checkoutOnServer } from "@/lib/woocommerce/api";
import { createRazorpayOrder } from "@/lib/razorpay-server";
import type { BillingAddress, ShippingAddress, WooCart } from "@/lib/woocommerce/types";

export interface RazorpayLineItem {
  name: string;
  unitAmount: number; // in minor units (e.g. paise)
  quantity: number;
  currency: string; // e.g. "INR"
}

export interface CreateRazorpayOrderResult {
  razorpayOrderId: string;
  wcOrderId: number;
  wcOrderKey: string;
  amount: number;
  currency: string;
  keyId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

/**
 * Creates a WooCommerce order (status: pending) via REST API v3 then a Razorpay order.
 * Returns the data needed by the client to open the Razorpay Checkout modal.
 */
export async function createRazorpayCheckoutOrder(
  billing: BillingAddress,
  shipping: ShippingAddress,
  paymentMethod: string,
  lineItems: RazorpayLineItem[],
  cartToken?: string,
  totalAmountOverride?: number,
  nonce?: string,
  cart?: WooCart
): Promise<CreateRazorpayOrderResult | { error: string }> {
  let orderId: number | undefined;
  let orderKey: string | undefined;

  // 1. First attempt: Create WC order via REST API v3 (status: pending)
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
      payment_method: paymentMethod || "razorpay",
      payment_method_title: "Razorpay",
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
      console.warn("[createRazorpayCheckoutOrder] REST API returned non-ok, falling back to Store API:", restRes.status, errText);
    }
  } catch (err) {
    console.warn("[createRazorpayCheckoutOrder] REST API exception, falling back to Store API:", err);
  }

  // Fallback: If REST API was not successful, attempt Store API checkout
  if (!orderId || !orderKey) {
    const wcRes = await checkoutOnServer(
      {
        billing_address: billing as unknown as Record<string, string>,
        shipping_address: shipping as unknown as Record<string, string>,
        payment_method: paymentMethod,
      },
      cartToken,
      nonce
    );

    if (!wcRes.ok) {
      const body = await wcRes.text();
      console.error("[createRazorpayCheckoutOrder] WooCommerce checkout API error:", wcRes.status, body);
      return { error: body };
    }

    const wcOrder = (await wcRes.json()) as { order_id: number; order_key: string };
    orderId = wcOrder.order_id;
    orderKey = wcOrder.order_key;
  }

  // 2. Calculate total amount (prefer explicit final total from cart if provided)
  const totalAmount =
    totalAmountOverride !== undefined && totalAmountOverride > 0
      ? totalAmountOverride
      : lineItems.reduce(
          (sum, item) => sum + item.unitAmount * item.quantity,
          0
        );
  const currency = lineItems[0]?.currency?.toUpperCase() ?? "INR";

  // 3. Create Razorpay Order
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  if (!keyId) {
    return { error: "Razorpay key_id is not configured." };
  }

  try {
    const rzpOrder = await createRazorpayOrder({
      amount: totalAmount,
      currency,
      receipt: `wc_order_${orderId}`,
      notes: {
        wc_order_id: String(orderId),
        wc_order_key: orderKey,
      },
    });

    return {
      razorpayOrderId: rzpOrder.id,
      wcOrderId: orderId,
      wcOrderKey: orderKey,
      amount: totalAmount,
      currency,
      keyId,
      customerName: `${billing.first_name} ${billing.last_name}`.trim(),
      customerEmail: billing.email,
      customerPhone: billing.phone,
    };
  } catch (err) {
    console.error("[createRazorpayCheckoutOrder] Razorpay order creation failed:", err);
    return { error: (err as Error).message };
  }
}
