"use client";

import { useCheckoutStore } from "@/lib/store/checkout-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/defaultcard";
import { AddressFields } from "@/components/checkout/address-fields";
import { t } from "@/lib/i18n";
import type { WooCountry } from "@/lib/woocommerce/types";

interface ShippingAddressFormProps {
  countries?: WooCountry[];
}

export function ShippingAddressForm({ countries }: ShippingAddressFormProps) {
  const { sameAsShipping, setSameAsShipping } = useCheckoutStore();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('checkout.shippingTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <label className="flex items-center gap-2 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={sameAsShipping}
            onChange={(e) => setSameAsShipping(e.target.checked)}
            className="h-4 w-4 rounded border-input"
          />
          <span className="text-sm">{t('checkout.sameAsBilling')}</span>
        </label>

        {!sameAsShipping && <AddressFields namePrefix="shipping" countries={countries} />}
      </CardContent>
    </Card>
  );
}
