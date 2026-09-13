"use server";

import {
  addToCartOnServer,
  updateCartItemOnServer,
  removeCartItemOnServer,
  getCartFromServer,
  checkoutOnServer,
  selectShippingRateOnServer,
  updateCustomerOnServer,
  applyCouponOnServer,
  removeCouponOnServer,
  extractCartToken,
  extractNonce,
} from "@/lib/woocommerce/api";
import {
  AddToCartSchema,
  UpdateCartItemSchema,
  RemoveCartItemSchema,
  SelectShippingRateSchema,
  PartialAddressSchema,
  ApplyCouponSchema,
  RemoveCouponSchema,
} from "@/lib/validation/schemas";
import type { WooCart, WooCheckoutOrder, BillingAddress, ShippingAddress } from "@/lib/woocommerce/types";
import { decodeHtml } from "@/lib/utils/format";

export async function getCart(cartToken?: string): Promise<{
  cart: WooCart | null;
  cartToken: string | null;
  nonce: string | null;
  error?: string;
}> {
  try {
    const res = await getCartFromServer(cartToken);
    const token = extractCartToken(res);
    const nonce = extractNonce(res);
    if (!res.ok) {
      return { cart: null, cartToken: token, nonce, error: `Failed to get cart: ${res.status}` };
    }
    const cart = (await res.json()) as WooCart;
    return { cart, cartToken: token, nonce };
  } catch (e) {
    return { cart: null, cartToken: null, nonce: null, error: (e as Error).message };
  }
}

export async function addToCart(
  productId: number,
  quantity: number,
  cartToken?: string,
  variation?: { attribute: string; value: string }[],
  nonce?: string
): Promise<{ cart: WooCart | null; cartToken: string | null; nonce: string | null; error?: string }> {
  const parsed = AddToCartSchema.safeParse({ productId, quantity, cartToken, nonce, variation });
  if (!parsed.success) {
    return { cart: null, cartToken: null, nonce: null, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const { productId: pid, quantity: qty, variation: vars, cartToken: token, nonce: n } = parsed.data;
    const res = await addToCartOnServer(pid, qty, vars, token, n);
    const resToken = extractCartToken(res);
    const resNonce = extractNonce(res);
    if (!res.ok) {
      const body = await res.text();
      return { cart: null, cartToken: resToken, nonce: resNonce, error: body };
    }
    const cart = (await res.json()) as WooCart;
    return { cart, cartToken: resToken, nonce: resNonce };
  } catch (e) {
    return { cart: null, cartToken: null, nonce: null, error: (e as Error).message };
  }
}

export async function updateCartItem(
  key: string,
  quantity: number,
  cartToken?: string,
  nonce?: string
): Promise<{ cart: WooCart | null; cartToken: string | null; nonce: string | null; error?: string }> {
  const parsed = UpdateCartItemSchema.safeParse({ key, quantity, cartToken, nonce });
  if (!parsed.success) {
    return { cart: null, cartToken: null, nonce: null, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const res = await updateCartItemOnServer(parsed.data.key, parsed.data.quantity, parsed.data.cartToken, parsed.data.nonce);
    const token = extractCartToken(res);
    const resNonce = extractNonce(res);
    if (!res.ok) {
      const body = await res.text();
      return { cart: null, cartToken: token, nonce: resNonce, error: body };
    }
    const cart = (await res.json()) as WooCart;
    return { cart, cartToken: token, nonce: resNonce };
  } catch (e) {
    return { cart: null, cartToken: null, nonce: null, error: (e as Error).message };
  }
}

export async function removeFromCart(
  key: string,
  cartToken?: string,
  nonce?: string
): Promise<{ cart: WooCart | null; cartToken: string | null; nonce: string | null; error?: string }> {
  const parsed = RemoveCartItemSchema.safeParse({ key, cartToken, nonce });
  if (!parsed.success) {
    return { cart: null, cartToken: null, nonce: null, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const res = await removeCartItemOnServer(parsed.data.key, parsed.data.cartToken, parsed.data.nonce);
    const token = extractCartToken(res);
    const resNonce = extractNonce(res);
    if (!res.ok) {
      const body = await res.text();
      return { cart: null, cartToken: token, nonce: resNonce, error: body };
    }
    const cart = (await res.json()) as WooCart;
    return { cart, cartToken: token, nonce: resNonce };
  } catch (e) {
    return { cart: null, cartToken: null, nonce: null, error: (e as Error).message };
  }
}

export async function checkout(
  billingAddress: BillingAddress,
  shippingAddress: ShippingAddress,
  paymentMethod: string,
  cartToken?: string,
  paymentData?: { key: string; value: string }[],
  nonce?: string
): Promise<{ order: WooCheckoutOrder | null; cartToken: string | null; nonce: string | null; error?: string }> {
  try {
    const res = await checkoutOnServer(
      {
        billing_address: billingAddress as unknown as Record<string, string>,
        shipping_address: shippingAddress as unknown as Record<string, string>,
        payment_method: paymentMethod,
        payment_data: paymentData,
      },
      cartToken,
      nonce
    );
    const resToken = extractCartToken(res);
    const resNonce = extractNonce(res);
    if (!res.ok) {
      const body = await res.text();
      console.error("[checkout] WooCommerce checkout API error:", res.status, body);
      return { order: null, cartToken: resToken, nonce: resNonce, error: body };
    }
    const order = (await res.json()) as WooCheckoutOrder;
    return { order, cartToken: resToken, nonce: resNonce };
  } catch (e) {
    console.error("[checkout] Unexpected error:", (e as Error).message);
    return { order: null, cartToken: null, nonce: null, error: (e as Error).message };
  }
}

export async function updateCustomer(
  billingAddress: Record<string, string>,
  shippingAddress: Record<string, string>,
  cartToken?: string,
  nonce?: string
): Promise<{ cart: WooCart | null; cartToken: string | null; nonce: string | null; error?: string }> {
  const billingParsed = PartialAddressSchema.safeParse(billingAddress);
  const shippingParsed = PartialAddressSchema.safeParse(shippingAddress);
  if (!billingParsed.success || !shippingParsed.success) {
    return { cart: null, cartToken: null, nonce: null, error: "Invalid address data" };
  }
  try {
    const res = await updateCustomerOnServer(billingParsed.data, shippingParsed.data, cartToken, nonce);
    const token = extractCartToken(res);
    const resNonce = extractNonce(res);
    if (!res.ok) {
      const body = await res.text();
      return { cart: null, cartToken: token, nonce: resNonce, error: body };
    }
    const cart = (await res.json()) as WooCart;
    return { cart, cartToken: token, nonce: resNonce };
  } catch (e) {
    return { cart: null, cartToken: null, nonce: null, error: (e as Error).message };
  }
}

export async function selectShippingRate(
  packageId: number,
  rateId: string,
  cartToken?: string,
  nonce?: string
): Promise<{ cart: WooCart | null; cartToken: string | null; nonce: string | null; error?: string }> {
  const parsed = SelectShippingRateSchema.safeParse({ packageId, rateId, cartToken, nonce });
  if (!parsed.success) {
    return { cart: null, cartToken: null, nonce: null, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const res = await selectShippingRateOnServer(parsed.data.packageId, parsed.data.rateId, parsed.data.cartToken, parsed.data.nonce);
    const token = extractCartToken(res);
    const resNonce = extractNonce(res);
    if (!res.ok) {
      const body = await res.text();
      return { cart: null, cartToken: token, nonce: resNonce, error: body };
    }
    const cart = (await res.json()) as WooCart;
    return { cart, cartToken: token, nonce: resNonce };
  } catch (e) {
    return { cart: null, cartToken: null, nonce: null, error: (e as Error).message };
  }
}

// ── Coupon actions ──────────────────────────────────────────────────────────

/** Extract a human-readable error message from a WooCommerce REST/Store API error body. */
function extractCouponErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { message?: string; code?: string };
    if (parsed.message) return decodeHtml(parsed.message);
  } catch { /* not JSON */ }
  return "Failed to process coupon. Please try again.";
}

export async function applyCoupon(
  code: string,
  cartToken?: string,
  nonce?: string
): Promise<{ cart: WooCart | null; cartToken: string | null; nonce: string | null; error?: string }> {
  const parsed = ApplyCouponSchema.safeParse({ code, cartToken, nonce });
  if (!parsed.success) {
    return { cart: null, cartToken: null, nonce: null, error: parsed.error.issues[0]?.message ?? "Invalid coupon code" };
  }
  try {
    const res = await applyCouponOnServer(parsed.data.code, parsed.data.cartToken, parsed.data.nonce);
    const token = extractCartToken(res);
    const resNonce = extractNonce(res);
    if (!res.ok) {
      const body = await res.text();
      return { cart: null, cartToken: token, nonce: resNonce, error: extractCouponErrorMessage(body) };
    }
    const cart = (await res.json()) as WooCart;
    return { cart, cartToken: token, nonce: resNonce };
  } catch (e) {
    return { cart: null, cartToken: null, nonce: null, error: (e as Error).message };
  }
}

export async function removeCoupon(
  code: string,
  cartToken?: string,
  nonce?: string
): Promise<{ cart: WooCart | null; cartToken: string | null; nonce: string | null; error?: string }> {
  const parsed = RemoveCouponSchema.safeParse({ code, cartToken, nonce });
  if (!parsed.success) {
    return { cart: null, cartToken: null, nonce: null, error: parsed.error.issues[0]?.message ?? "Invalid coupon code" };
  }
  try {
    const res = await removeCouponOnServer(parsed.data.code, parsed.data.cartToken, parsed.data.nonce);
    const token = extractCartToken(res);
    const resNonce = extractNonce(res);
    if (!res.ok) {
      const body = await res.text();
      return { cart: null, cartToken: token, nonce: resNonce, error: extractCouponErrorMessage(body) };
    }
    const cart = (await res.json()) as WooCart;
    return { cart, cartToken: token, nonce: resNonce };
  } catch (e) {
    return { cart: null, cartToken: null, nonce: null, error: (e as Error).message };
  }
}
