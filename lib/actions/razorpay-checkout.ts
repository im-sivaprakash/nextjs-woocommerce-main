"use server";

import { checkoutOnServer } from "@/lib/woocommerce/api";
import { createRazorpayOrder } from "@/lib/razorpay-server";
import type { BillingAddress, ShippingAddress, WooCheckoutOrder } from "@/lib/woocommerce/types";

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
 * Creates a WooCommerce order (status: pending) then a Razorpay order.
 * Returns the data needed by the client to open the Razorpay Checkout modal.
 */
export async function createRazorpayCheckoutOrder(
  billing: BillingAddress,
  shipping: ShippingAddress,
  paymentMethod: string,
  lineItems: RazorpayLineItem[],
  cartToken?: string
): Promise<CreateRazorpayOrderResult | { error: string }> {
  // 1. Create the WC order so we get an order_id and billing/shipping is stored
  const wcRes = await checkoutOnServer(
    {
      billing_address: billing as unknown as Record<string, string>,
      shipping_address: shipping as unknown as Record<string, string>,
      payment_method: paymentMethod,
    },
    cartToken
  );

  if (!wcRes.ok) {
    const body = await wcRes.text();
    console.error("[createRazorpayCheckoutOrder] WooCommerce checkout API error:", wcRes.status, body);
    return { error: body };
  }

  const wcOrder = (await wcRes.json()) as WooCheckoutOrder;
  const orderId = wcOrder.order_id;
  const orderKey = wcOrder.order_key;

  // 2. Calculate total amount from line items
  const totalAmount = lineItems.reduce(
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
