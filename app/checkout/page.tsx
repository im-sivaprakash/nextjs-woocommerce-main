"use client";

import { useState, useTransition, useEffect, useRef, useCallback, useActionState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCartStore } from "@/lib/store/cart-store";
import { useCheckoutStore } from "@/lib/store/checkout-store";
import { selectShippingRate } from "@/lib/actions/cart";
import { checkoutAction } from "@/lib/actions/checkout-submit";
import { buttonVariants } from "@/components/ui/defaultbutton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { BillingAddressForm } from "@/components/checkout/billing-address-form";
import { ShippingAddressForm } from "@/components/checkout/shipping-address-form";
import { ShippingMethodSelector } from "@/components/checkout/shipping-method-selector";
import { PaymentMethodSelector } from "@/components/checkout/payment-method-selector";
import { CheckoutOrderSummary } from "@/components/checkout/checkout-order-summary";
import { CouponInput } from "@/components/checkout/coupon-input";
import { useAddressUpdate } from "@/lib/hooks/use-address-update";
import { trackBeginCheckout, trackAddShippingInfo, trackAddPaymentInfo } from "@/lib/utils/gtm-events";
import { cartItemsToEcommerceItems } from "@/lib/utils/gtm-items";
import { t } from "@/lib/i18n";

// Global type declaration for Razorpay checkout.js
declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: () => void) => void;
    };
  }
}

export default function CheckoutPage() {
  const { cart, isLoading, cartToken } = useCartStore();
  const { sameAsShipping, selectedPaymentMethod, setSelectedPaymentMethod } = useCheckoutStore();
  const router = useRouter();
  const [checkoutState, formAction, isPending] = useActionState(checkoutAction, null);
  const [isSelectingShipping, startShippingTransition] = useTransition();
  const { isUpdatingAddress } = useAddressUpdate(cartToken ?? null);

  const isStripeMethod = selectedPaymentMethod === "stripe_cc" || selectedPaymentMethod === "stripe";
  const isRazorpayMethod = selectedPaymentMethod === "razorpay";

  // Razorpay verification state
  const [isVerifyingRazorpay, setIsVerifyingRazorpay] = useState(false);

  // Razorpay modal handler — opens the checkout modal and verifies payment on success
  const handleRazorpayModal = useCallback(
    (data: {
      razorpayOrderId: string;
      wcOrderId: number;
      wcOrderKey: string;
      amount: number;
      currency: string;
      keyId: string;
      customerName: string;
      customerEmail: string;
      customerPhone: string;
    }) => {
      if (typeof window === "undefined" || !window.Razorpay) {
        toast.error("Razorpay script not loaded. Please refresh the page.");
        return;
      }

      const options: Record<string, unknown> = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: process.env.NEXT_PUBLIC_SITE_URL ?? "Store",
        order_id: data.razorpayOrderId,
        prefill: {
          name: data.customerName,
          email: data.customerEmail,
          contact: data.customerPhone,
        },
        theme: { color: "#3399cc" },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          // Verify payment signature on the server
          setIsVerifyingRazorpay(true);
          try {
            const verifyRes = await fetch("/api/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                wc_order_id: data.wcOrderId,
                wc_order_key: data.wcOrderKey,
                billing_email: data.customerEmail,
              }),
            });

            if (!verifyRes.ok) {
              const errBody = await verifyRes.json().catch(() => ({}));
              toast.error(
                (errBody as { error?: string }).error ?? t("checkout.razorpayFailed")
              );
              return;
            }

            const result = (await verifyRes.json()) as {
              verified: boolean;
              orderId: number;
              orderKey: string;
              billingEmail?: string;
            };

            // Redirect to order confirmation
            const params = new URLSearchParams({
              order_id: String(result.orderId),
              order_key: result.orderKey,
              ...(result.billingEmail && { billing_email: result.billingEmail }),
            });
            router.push(`/order-confirmation?${params.toString()}`);
          } catch {
            toast.error(t("checkout.razorpayFailed"));
          } finally {
            setIsVerifyingRazorpay(false);
          }
        },
        modal: {
          ondismiss: () => {
            // User closed the modal without completing payment
            toast.error("Payment was cancelled.");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    },
    [router]
  );

  // Handle server action result
  useEffect(() => {
    if (!checkoutState) return;
    if (checkoutState.type === "error") {
      toast.error(checkoutState.message);
    } else if (checkoutState.type === "stripe_redirect") {
      window.location.href = checkoutState.url;
    } else if (checkoutState.type === "razorpay_create") {
      // Open Razorpay Checkout modal with the order data
      handleRazorpayModal({
        razorpayOrderId: checkoutState.razorpayOrderId,
        wcOrderId: checkoutState.wcOrderId,
        wcOrderKey: checkoutState.wcOrderKey,
        amount: checkoutState.amount,
        currency: checkoutState.currency,
        keyId: checkoutState.keyId,
        customerName: checkoutState.customerName,
        customerEmail: checkoutState.customerEmail,
        customerPhone: checkoutState.customerPhone,
      });
    } else if (checkoutState.type === "success") {
      const params = new URLSearchParams({
        order_id: String(checkoutState.orderId),
        order_key: checkoutState.orderKey,
        billing_email: checkoutState.email,
      });
      router.push(`/order-confirmation?${params.toString()}`);
    }
  }, [checkoutState, router, handleRazorpayModal]);

  // Fire begin_checkout once when cart is ready
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!cart || cart.items.length === 0 || checkoutTracked.current) return;
    checkoutTracked.current = true;
    const currency = cart.totals.currency_code;
    const value = parseInt(cart.totals.total_price) / Math.pow(10, cart.totals.currency_minor_unit);
    trackBeginCheckout(cartItemsToEcommerceItems(cart.items), currency, value);
  }, [cart]);

  // Auto-select first payment method when cart loads
  const paymentInitialized = useRef(false);
  useEffect(() => {
    if (cart?.payment_methods?.length && !paymentInitialized.current) {
      paymentInitialized.current = true;
      if (!selectedPaymentMethod) setSelectedPaymentMethod(cart.payment_methods[0]);
    }
  }, [cart?.payment_methods, selectedPaymentMethod, setSelectedPaymentMethod]);

  const handleShippingRateChange = (packageId: number, rateId: string) => {
    startShippingTransition(async () => {
      const result = await selectShippingRate(packageId, rateId, useCartStore.getState().cartToken);
      if (result.error) {
        toast.error(t("checkout.failedShipping"));
        return;
      }
      if (result.cart) {
        useCartStore.setState({ cart: result.cart, itemCount: result.cart.items_count });
        if (result.cartToken) useCartStore.setState({ cartToken: result.cartToken });
        const c = result.cart;
        const currency = c.totals.currency_code;
        const value = parseInt(c.totals.total_price) / Math.pow(10, c.totals.currency_minor_unit);
        const selectedRate = c.shipping_rates.flatMap((pkg) => pkg.shipping_rates).find((r) => r.selected);
        trackAddShippingInfo(cartItemsToEcommerceItems(c.items), currency, value, selectedRate?.name ?? rateId);
      }
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-heading font-bold mb-8">{t("checkout.pageTitle")}</h1>
        <p className="text-muted-foreground">{t("checkout.loadingCart")}</p>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingCart className="mx-auto h-16 w-16 text-muted-foreground" />
        <h1 className="text-3xl font-heading font-bold mt-4">{t("checkout.emptyTitle")}</h1>
        <p className="text-muted-foreground mt-2">{t("checkout.emptyHint")}</p>
        <Link href="/shop" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
          {t("checkout.continueShopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Load Razorpay checkout.js — only when Razorpay is a viable method */}
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />

      <h1 className="text-3xl font-heading font-bold mb-8">{t("checkout.pageTitle")}</h1>

      <form action={formAction}>
        {/* Side-channel data not rendered as address fields */}
        <input type="hidden" name="cartToken" value={cartToken ?? ""} />
        <input type="hidden" name="cart" value={JSON.stringify(cart)} />
        <input type="hidden" name="paymentMethod" value={selectedPaymentMethod} />
        <input type="hidden" name="sameAsShipping" value={sameAsShipping ? "1" : "0"} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <BillingAddressForm />
            <ShippingAddressForm />

            {cart.needs_shipping && cart.shipping_rates?.length > 0 && (
              <ShippingMethodSelector
                shippingRates={cart.shipping_rates}
                isDisabled={isSelectingShipping || isUpdatingAddress}
                onSelect={handleShippingRateChange}
              />
            )}

            {cart.needs_payment && parseInt(cart.totals?.total_price || "0") > 0 && cart.payment_methods?.length > 0 && (
              <PaymentMethodSelector
                paymentMethods={cart.payment_methods}
                isDisabled={isUpdatingAddress}
                onPaymentSelect={(method) => {
                  const currency = cart.totals.currency_code;
                  const value = parseInt(cart.totals.total_price) / Math.pow(10, cart.totals.currency_minor_unit);
                  trackAddPaymentInfo(cartItemsToEcommerceItems(cart.items), currency, value, method);
                }}
              />
            )}
            <CouponInput />
          </div>

          <div className="lg:col-span-1">
            <CheckoutOrderSummary
              cart={cart}
              isPending={isPending || isVerifyingRazorpay}
              isUpdatingAddress={isUpdatingAddress}
              isSelectingShipping={isSelectingShipping}
              isStripeMethod={isStripeMethod}
              isRazorpayMethod={isRazorpayMethod}
            />
          </div>
        </div>
      </form>
    </div>
  );
}
