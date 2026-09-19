"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/defaultcard";
import { AddressFields } from "@/components/checkout/address-fields";
import { t } from "@/lib/i18n";
import type { WooCountry } from "@/lib/woocommerce/types";

interface BillingAddressFormProps {
  countries?: WooCountry[];
}

export function BillingAddressForm({ countries }: BillingAddressFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('checkout.billingTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        <AddressFields namePrefix="billing" showContactFields countries={countries} />
      </CardContent>
    </Card>
  );
}
