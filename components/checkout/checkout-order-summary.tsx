"use client";

import { formatPrice, decodeHtml } from "@/lib/utils/format";
import { Button } from "@/components/ui/defaultbutton";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/defaultcard";
import { Lock, Tag } from "lucide-react";
import { CartTotals } from "@/components/cart/cart-totals";
import type { WooCart } from "@/lib/woocommerce/types";
import { t } from "@/lib/i18n";

interface CheckoutOrderSummaryProps {
  cart: WooCart;
  isPending: boolean;
  isUpdatingAddress: boolean;
  isSelectingShipping: boolean;
  isStripeMethod: boolean;
  isRazorpayMethod: boolean;
}

export function CheckoutOrderSummary({
  cart,
  isPending,
  isUpdatingAddress,
  isSelectingShipping,
  isStripeMethod,
  isRazorpayMethod,
}: CheckoutOrderSummaryProps) {
  return (
    <Card className="sticky top-24">
      <CardHeader>
        <CardTitle>{t('checkout.orderSummaryTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items */}
        <div className="space-y-2">
          {cart.items.map((item) => (
            <div key={item.key} className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {decodeHtml(item.name)} &times; {item.quantity}
              </span>
              <span>
                {formatPrice(
                  item.totals.line_subtotal,
                  item.totals.currency_minor_unit,
                  item.totals.currency_prefix,
                  item.totals.currency_suffix
                )}
              </span>
            </div>
          ))}
        </div>

        {/* Applied coupons */}
        {cart.coupons?.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1.5">
              {cart.coupons.map((coupon) => (
                <div
                  key={coupon.code}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                    <Tag className="h-3 w-3" />
                    <span className="uppercase font-medium">{coupon.code}</span>
                  </span>
                  {coupon.totals?.total_discount && parseInt(coupon.totals.total_discount) > 0 && (
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {formatPrice(
                        coupon.totals.total_discount,
                        cart.totals.currency_minor_unit,
                        cart.totals.currency_prefix,
                        cart.totals.currency_suffix
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <Separator />

        <CartTotals totals={cart.totals} />

        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0" />
            <span className="font-medium text-foreground">{t('checkout.secureCheckout')}</span>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isPending || isUpdatingAddress || isSelectingShipping}
        >
          {isPending
            ? t('checkout.processing')
            : isUpdatingAddress
            ? t('checkout.recalculating')
            : !cart.needs_payment || parseInt(cart.totals?.total_price || "0") <= 0
            ? t('checkout.freeOrder')
            : isStripeMethod
            ? t('checkout.payWithStripe')
            : isRazorpayMethod
            ? t('checkout.payWithRazorpay')
            : t('checkout.placeOrder')}
        </Button>
      </CardContent>
    </Card>
  );
}

