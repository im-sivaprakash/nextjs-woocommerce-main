"use client";

import { useState, useCallback } from "react";
import { useCartStore } from "@/lib/store/cart-store";
import { formatPrice, decodeHtml } from "@/lib/utils/format";
import { Button } from "@/components/ui/defaultbutton";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/defaultcard";
import { Tag, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

import type { WooCart } from "@/lib/woocommerce/types";

interface CouponInputProps {
  cart?: WooCart | null;
  isPending?: boolean;
  applyCoupon?: (code: string) => Promise<{ error?: string }>;
  removeCoupon?: (code: string) => Promise<{ error?: string }>;
}

/**
 * Coupon input component for the checkout page.
 * Allows users to apply and remove coupon codes. Reads applied coupons from the
 * cart store so they are automatically restored on page refresh.
 */
export function CouponInput({
  cart: propCart,
  isPending: propIsPending,
  applyCoupon: propApplyCoupon,
  removeCoupon: propRemoveCoupon,
}: CouponInputProps = {}) {
  const store = useCartStore();
  const cart = propCart !== undefined ? propCart : store.cart;
  const isPending = propIsPending !== undefined ? propIsPending : store.isPending;
  const applyCoupon = propApplyCoupon ?? store.applyCoupon;
  const removeCoupon = propRemoveCoupon ?? store.removeCoupon;
  const [code, setCode] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);

  const appliedCoupons = cart?.coupons ?? [];

  const handleApply = useCallback(async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      toast.error(t("coupon.invalid"));
      return;
    }

    setIsApplying(true);
    try {
      const result = await applyCoupon(trimmedCode);
      if (result.error) {
        toast.error(decodeHtml(result.error));
      } else {
        toast.success(t("coupon.applied"));
        setCode("");
      }
    } catch {
      toast.error("Failed to apply coupon. Please try again.");
    } finally {
      setIsApplying(false);
    }
  }, [code, applyCoupon]);

  const handleRemove = useCallback(
    async (couponCode: string) => {
      setIsRemoving(couponCode);
      try {
        const result = await removeCoupon(couponCode);
        if (result.error) {
          toast.error(decodeHtml(result.error));
        } else {
          toast.success(t("coupon.removed"));
        }
      } catch {
        toast.error("Failed to remove coupon. Please try again.");
      } finally {
        setIsRemoving(null);
      }
    },
    [removeCoupon]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleApply();
      }
    },
    [handleApply]
  );

  const isDisabled = isPending || isApplying;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          {t("coupon.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input row */}
        <div className="flex gap-2">
          <Input
            id="coupon-code-input"
            type="text"
            placeholder={t("coupon.placeholder")}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            maxLength={50}
            autoComplete="off"
            aria-label={t("coupon.placeholder")}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleApply}
            disabled={isDisabled || !code.trim()}
            className="shrink-0"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("coupon.applying")}
              </>
            ) : (
              t("coupon.apply")
            )}
          </Button>
        </div>

        {/* Applied coupons */}
        {appliedCoupons.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("coupon.appliedCoupons")}
            </p>
            <div className="space-y-1.5">
              {appliedCoupons.map((coupon) => {
                const isRemovingThis = isRemoving === coupon.code;
                return (
                  <div
                    key={coupon.code}
                    className="flex items-center justify-between gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800/50 dark:bg-green-900/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-300 uppercase">
                        {coupon.code}
                      </span>
                      {coupon.totals?.total_discount && parseInt(coupon.totals.total_discount) > 0 && (
                        <span className="text-xs text-green-600 dark:text-green-400">
                          (-{formatPrice(
                            coupon.totals.total_discount,
                            cart?.totals?.currency_minor_unit ?? 2,
                            cart?.totals?.currency_prefix ?? "$",
                            cart?.totals?.currency_suffix ?? ""
                          )})
                        </span>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRemove(coupon.code)}
                      disabled={isPending || isRemovingThis}
                      aria-label={`${t("coupon.remove")} ${coupon.code}`}
                      className="shrink-0 text-green-600 hover:text-red-600 hover:bg-red-50 dark:text-green-400 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                    >
                      {isRemovingThis ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <X className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
