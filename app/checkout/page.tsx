import { Suspense } from "react";
import { getCountries } from "@/lib/woocommerce/api";
import { CheckoutClient } from "@/components/checkout/checkout-client";
import { t } from "@/lib/i18n";

export default async function CheckoutPage() {
  const countries = await getCountries();

  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-heading font-bold mb-8">{t("checkout.pageTitle")}</h1>
          <p className="text-muted-foreground">{t("checkout.loadingCart")}</p>
        </div>
      }
    >
      <CheckoutClient countries={countries} />
    </Suspense>
  );
}
