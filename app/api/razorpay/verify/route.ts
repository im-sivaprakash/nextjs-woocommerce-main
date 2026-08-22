import { NextRequest, NextResponse } from "next/server";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay-server";
import { updateWooOrderStatus } from "@/lib/stripe-server";
import { RazorpayVerifySchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

/**
 * POST /api/razorpay/verify
 *
 * Called by the client after the Razorpay Checkout modal returns a
 * successful payment. Verifies the payment signature and updates the
 * WooCommerce order status to "processing".
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate input shape with Zod
  const parsed = RazorpayVerifySchema.safeParse(body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? "Invalid request body" },
      { status: 400 }
    );
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    wc_order_id,
    wc_order_key,
    billing_email,
  } = parsed.data;

  // Verify HMAC SHA256 signature
  const isValid = verifyRazorpayPaymentSignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature
  );

  if (!isValid) {
    console.error(
      "[razorpay/verify] Signature verification failed for order:",
      wc_order_id
    );
    return NextResponse.json(
      { error: "Payment verification failed. Invalid signature." },
      { status: 400 }
    );
  }

  // Update WooCommerce order status
  try {
    await updateWooOrderStatus(wc_order_id, "processing");
    console.log(
      `[razorpay/verify] WC order ${wc_order_id} → processing (payment: ${razorpay_payment_id})`
    );
  } catch (err) {
    console.error(
      `[razorpay/verify] Failed to update WC order ${wc_order_id}:`,
      err
    );
    return NextResponse.json(
      { error: "Payment verified but failed to update order. Please contact support." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    verified: true,
    orderId: wc_order_id,
    orderKey: wc_order_key,
    billingEmail: billing_email,
  });
}
