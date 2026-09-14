"use server";

import { BillingSchema, ShippingSchema } from "@/lib/validation/schemas";
import { checkout } from "./cart";
import { createStripeOrder } from "./stripe-checkout";
import { createRazorpayCheckoutOrder } from "./razorpay-checkout";
import type { WooCart } from "@/lib/woocommerce/types";

export type CheckoutActionState =
  | null
  | { type: "error"; message: string }
  | { type: "stripe_redirect"; url: string }
  | { type: "razorpay_create"; razorpayOrderId: string; wcOrderId: number; wcOrderKey: string; amount: number; currency: string; keyId: string; customerName: string; customerEmail: string; customerPhone: string }
  | { type: "success"; orderId: number; orderKey: string; email: string };

/**
 * Server action for the checkout form.
 * Billing/shipping/cart state is passed as JSON in hidden form inputs.
 */
export async function checkoutAction(
  _prevState: CheckoutActionState,
  formData: FormData
): Promise<CheckoutActionState> {
  // ── Parse raw form data ───────────────────────────────────────────────────
  let cart: WooCart;
  let paymentMethod: string;
  let cartToken: string | undefined;
  const sameAsShipping = formData.get("sameAsShipping") === "1";
  const isBuyNow = formData.get("isBuyNow") === "1" || formData.get("isBuyNow") === "true";

  const g = (key: string) => String(formData.get(key) ?? "");

  const rawBilling = {
    first_name: g("billing_first_name"),
    last_name: g("billing_last_name"),
    company: g("billing_company"),
    address_1: g("billing_address_1"),
    address_2: g("billing_address_2"),
    city: g("billing_city"),
    state: g("billing_state"),
    postcode: g("billing_postcode"),
    country: g("billing_country"),
    email: g("billing_email"),
    phone: g("billing_phone"),
  };

  const rawShipping = sameAsShipping
    ? {
        first_name: rawBilling.first_name,
        last_name: rawBilling.last_name,
        company: rawBilling.company,
        address_1: rawBilling.address_1,
        address_2: rawBilling.address_2,
        city: rawBilling.city,
        state: rawBilling.state,
        postcode: rawBilling.postcode,
        country: rawBilling.country,
      }
    : {
        first_name: g("shipping_first_name"),
        last_name: g("shipping_last_name"),
        company: g("shipping_company"),
        address_1: g("shipping_address_1"),
        address_2: g("shipping_address_2"),
        city: g("shipping_city"),
        state: g("shipping_state"),
        postcode: g("shipping_postcode"),
        country: g("shipping_country"),
      };

  try {
    cart = JSON.parse(formData.get("cart") as string) as WooCart;
    paymentMethod = formData.get("paymentMethod") as string;
    cartToken = (formData.get("cartToken") as string) || undefined;
  } catch {
    return { type: "error", message: "Invalid form data. Please try again." };
  }

  const nonce = (formData.get("nonce") as string) || undefined;

  // ── Validate with Zod ────────────────────────────────────────────────────
  const billingResult = BillingSchema.safeParse(rawBilling);
  if (!billingResult.success) {
    const first = billingResult.error.issues[0];
    return { type: "error", message: first?.message ?? "Invalid billing details." };
  }

  const shippingResult = ShippingSchema.safeParse(rawShipping);
  if (!shippingResult.success) {
    const first = shippingResult.error.issues[0];
    return { type: "error", message: first?.message ?? "Invalid shipping details." };
  }

  const billing = billingResult.data;
  const shipping = shippingResult.data;

  const isFreeOrder =
    parseInt(cart.totals?.total_price || "0") <= 0 || !cart.needs_payment;

  if (!isFreeOrder && !paymentMethod) {
    return { type: "error", message: "Please select a payment method." };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  /** Extract a human-readable message from a raw WooCommerce REST error string. */
  function extractWooMessage(raw?: string): string {
    if (!raw) return "Checkout failed. Please try again.";
    try {
      const parsed = JSON.parse(raw) as {
        message?: string;
        data?: { params?: Record<string, string> };
      };
      const params = parsed.data?.params;
      if (params) {
        const details = Object.entries(params)
          .map(([field, reason]) => `${field}: ${reason}`)
          .join("; ");
        console.error("[checkoutAction] Validation details:", details);
        return details || parsed.message || "Checkout failed. Please try again.";
      }
      if (parsed.message) return parsed.message;
    } catch { /* not JSON, fall through */ }
    return "Checkout failed. Please try again.";
  }

  // ── Free Order / 100% Discounted (Total is 0) ────────────────────────────
  if (isFreeOrder) {
    const result = await checkout(
      billing,
      shipping,
      paymentMethod || "other",
      cartToken,
      undefined,
      nonce
    );

    if (result.error || !result.order) {
      console.error("[checkoutAction] Free order checkout failed:", result.error);
      return { type: "error", message: extractWooMessage(result.error) };
    }

    return {
      type: "success",
      orderId: result.order.order_id,
      orderKey: result.order.order_key,
      email: billing.email,
    };
  }

  // ── Route to payment provider ────────────────────────────────────────────
  const isStripeMethod = paymentMethod === "stripe_cc" || paymentMethod === "stripe";

  if (isStripeMethod) {
    const lineItems = cart.items.map((item) => {
      const lineTotal = item.totals?.line_total
        ? parseInt(item.totals.line_total)
        : parseInt(item.prices.price) * item.quantity;
      const unitAmount =
        item.quantity > 0 ? Math.round(lineTotal / item.quantity) : parseInt(item.prices.price);
      return {
        name: item.name,
        unitAmount,
        quantity: item.quantity,
        currency: item.prices?.currency_code ?? cart.totals.currency_code,
      };
    });

    const shippingTotal = parseInt(cart.totals?.total_shipping || "0");
    if (shippingTotal > 0) {
      lineItems.push({
        name: "Shipping",
        unitAmount: shippingTotal,
        quantity: 1,
        currency: cart.totals.currency_code,
      });
    }

    const result = await createStripeOrder(
      billing,
      shipping,
      paymentMethod,
      lineItems,
      cartToken,
      nonce,
      isBuyNow
    );

    if ("error" in result) {
      console.error("[checkoutAction] Stripe order creation failed:", result.error);
      return { type: "error", message: extractWooMessage(result.error) };
    }

    return { type: "stripe_redirect", url: result.sessionUrl };
  }

  // ── Razorpay ──────────────────────────────────────────────────────────────
  const isRazorpayMethod = paymentMethod === "razorpay";

  if (isRazorpayMethod) {
    const lineItems = cart.items.map((item) => {
      const lineTotal = item.totals?.line_total
        ? parseInt(item.totals.line_total)
        : parseInt(item.prices.price) * item.quantity;
      const unitAmount =
        item.quantity > 0 ? Math.round(lineTotal / item.quantity) : parseInt(item.prices.price);
      return {
        name: item.name,
        unitAmount,
        quantity: item.quantity,
        currency: item.prices?.currency_code ?? cart.totals.currency_code,
      };
    });

    const shippingTotal = parseInt(cart.totals?.total_shipping || "0");
    if (shippingTotal > 0) {
      lineItems.push({
        name: "Shipping",
        unitAmount: shippingTotal,
        quantity: 1,
        currency: cart.totals.currency_code,
      });
    }

    const totalAmount = parseInt(cart.totals?.total_price || "0");

    const result = await createRazorpayCheckoutOrder(
      billing,
      shipping,
      paymentMethod,
      lineItems,
      cartToken,
      totalAmount > 0 ? totalAmount : undefined,
      nonce
    );

    if ("error" in result) {
      console.error("[checkoutAction] Razorpay order creation failed:", result.error);
      return { type: "error", message: extractWooMessage(result.error) };
    }

    return {
      type: "razorpay_create",
      razorpayOrderId: result.razorpayOrderId,
      wcOrderId: result.wcOrderId,
      wcOrderKey: result.wcOrderKey,
      amount: result.amount,
      currency: result.currency,
      keyId: result.keyId,
      customerName: result.customerName,
      customerEmail: result.customerEmail,
      customerPhone: result.customerPhone,
    };
  }

  // ── Non-Stripe (bacs, cod, cheque, etc.) ─────────────────────────────────
  const result = await checkout(
    billing,
    shipping,
    paymentMethod || "cod",
    cartToken,
    undefined,
    nonce
  );

  if (result.error || !result.order) {
    console.error("[checkoutAction] WooCommerce checkout failed:", result.error);
    return { type: "error", message: extractWooMessage(result.error) };
  }

  return {
    type: "success",
    orderId: result.order.order_id,
    orderKey: result.order.order_key,
    email: billing.email,
  };
}
