/**
 * Server-only Razorpay + WooCommerce REST API utilities.
 * Never import this file from client components.
 *
 * Mirrors the architecture of lib/stripe-server.ts.
 */
import Razorpay from "razorpay";
import crypto from "crypto";

// ─── Singleton ────────────────────────────────────────────────────────────────

let razorpayInstance: InstanceType<typeof Razorpay> | null = null;

function getRazorpayServer(): InstanceType<typeof Razorpay> {
  if (razorpayInstance) return razorpayInstance;

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("NEXT_PUBLIC_RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET is not set");
  }

  razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return razorpayInstance;
}

// ─── Order Creation ───────────────────────────────────────────────────────────

export interface CreateRazorpayOrderParams {
  /** Amount in smallest currency unit (e.g. paise for INR) */
  amount: number;
  currency: string;
  /** Internal receipt identifier — typically WC order ID */
  receipt: string;
  /** Metadata notes attached to the Razorpay order */
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  notes: Record<string, string>;
}

export async function createRazorpayOrder(
  params: CreateRazorpayOrderParams
): Promise<RazorpayOrderResponse> {
  const rzp = getRazorpayServer();
  const order = await rzp.orders.create({
    amount: params.amount,
    currency: params.currency,
    receipt: params.receipt,
    notes: params.notes ?? {},
  });
  return order as unknown as RazorpayOrderResponse;
}

// ─── Payment Signature Verification ──────────────────────────────────────────

/**
 * Verify the payment signature returned by the Razorpay Checkout modal.
 *
 * The signature is an HMAC SHA256 of `razorpay_order_id|razorpay_payment_id`
 * using the Razorpay key_secret.
 *
 * Uses crypto.timingSafeEqual() to prevent timing attacks.
 */
export function verifyRazorpayPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) throw new Error("RAZORPAY_KEY_SECRET is not set");

  const text = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(text)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(razorpaySignature, "hex")
    );
  } catch {
    // If the buffers have different lengths, timingSafeEqual throws
    return false;
  }
}

// ─── Webhook Signature Verification ──────────────────────────────────────────

/**
 * Verify Razorpay webhook payload signature.
 *
 * The signature is an HMAC SHA256 of the raw request body
 * using the webhook_secret (configured in Razorpay Dashboard).
 *
 * IMPORTANT: Must be called with the raw request body string
 * (not parsed JSON) to ensure signature integrity.
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string
): boolean {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not set");

  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    return false;
  }
}
