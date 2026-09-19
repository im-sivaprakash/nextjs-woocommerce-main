"use client";

import * as React from "react";
import { useCheckoutStore } from "@/lib/store/checkout-store";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CountryCombobox } from "@/components/ui/combobox";
import { t } from "@/lib/i18n";
import { sanitizePostcodeInput } from "@/lib/validation/postcode";
import { FALLBACK_COUNTRIES } from "@/lib/woocommerce/countries-fallback";
import type { BillingAddress, ShippingAddress, WooCountry } from "@/lib/woocommerce/types";

interface AddressFieldsProps {
  namePrefix: "billing" | "shipping";
  /** When true, also renders company, email, and phone fields (billing only). */
  showContactFields?: boolean;
  /** WooCommerce countries list. Falls back to default list if not provided. */
  countries?: WooCountry[];
}

export function AddressFields({
  namePrefix,
  showContactFields = false,
  countries = FALLBACK_COUNTRIES,
}: AddressFieldsProps) {
  const { updateBilling, updateShipping } = useCheckoutStore();
  const address = useCheckoutStore((s) => (namePrefix === "billing" ? s.billing : s.shipping));
  const update =
    namePrefix === "billing"
      ? (f: string, v: string) => updateBilling(f as keyof BillingAddress, v)
      : (f: string, v: string) => updateShipping(f as keyof ShippingAddress, v);

  const htmlId = (f: string) => `${namePrefix}_${f}`;

  const countriesList = countries && countries.length > 0 ? countries : FALLBACK_COUNTRIES;
  const currentCountryCode = (address.country || "IN").toUpperCase();

  // Find country in list; if not found, match case-insensitively or default to India
  const selectedCountry =
    countriesList.find((c) => c.code.toUpperCase() === currentCountryCode) ||
    countriesList.find((c) => c.code.toUpperCase() === "IN") ||
    countriesList[0];

  const hasStates = Boolean(
    selectedCountry && Array.isArray(selectedCountry.states) && selectedCountry.states.length > 0
  );

  const handleCountryChange = (newCountryCode: string) => {
    const newCountry = newCountryCode.toUpperCase();
    if (newCountry !== currentCountryCode) {
      update("country", newCountry);
      // Crucial: Reset state when country changes to prevent invalid country/state combinations
      update("state", "");
    }
  };

  const handlePostcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Current client requirement: enforce 6-digit numeric PIN code
    const sanitized = sanitizePostcodeInput(e.target.value);
    update("postcode", sanitized);
  };

  function field(fieldName: string) {
    return {
      id: htmlId(fieldName),
      name: htmlId(fieldName),
      value: (address as unknown as Record<string, string>)[fieldName] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => update(fieldName, e.target.value),
    };
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor={htmlId("first_name")} className="text-sm font-medium mb-1 block">
            {t("checkout.fields.firstName")}
          </label>
          <Input {...field("first_name")} placeholder={t("checkout.fields.firstNamePlaceholder")} />
        </div>
        <div>
          <label htmlFor={htmlId("last_name")} className="text-sm font-medium mb-1 block">
            {t("checkout.fields.lastName")}
          </label>
          <Input {...field("last_name")} placeholder={t("checkout.fields.lastNamePlaceholder")} />
        </div>
      </div>

      {showContactFields && (
        <>
          <div>
            <label htmlFor={htmlId("company")} className="text-sm font-medium mb-1 block">
              {t("checkout.fields.company")}
            </label>
            <Input {...field("company")} placeholder={t("checkout.fields.companyPlaceholder")} />
          </div>
          <div>
            <label htmlFor={htmlId("email")} className="text-sm font-medium mb-1 block">
              {t("checkout.fields.email")}
            </label>
            <Input {...field("email")} type="email" placeholder={t("checkout.fields.emailPlaceholder")} />
          </div>
          <div>
            <label htmlFor={htmlId("phone")} className="text-sm font-medium mb-1 block">
              {t("checkout.fields.phone")}
            </label>
            <Input {...field("phone")} type="tel" placeholder={t("checkout.fields.phonePlaceholder")} />
          </div>
        </>
      )}

      <div>
        <label htmlFor={htmlId("address_1")} className="text-sm font-medium mb-1 block">
          {t("checkout.fields.address1")}
        </label>
        <Input {...field("address_1")} placeholder={t("checkout.fields.streetPlaceholder")} />
      </div>

      <div>
        <label htmlFor={htmlId("address_2")} className="text-sm font-medium mb-1 block">
          {t("checkout.fields.address2")}
        </label>
        <Input {...field("address_2")} placeholder={t("checkout.fields.aptPlaceholder")} />
      </div>

      {/* Searchable Country Combobox (placed before State/City for intuitive geographic cascade) */}
      <div>
        <label htmlFor={htmlId("country")} className="text-sm font-medium mb-1 block">
          {t("checkout.fields.country")}
        </label>
        <CountryCombobox
          id={htmlId("country")}
          name={htmlId("country")}
          value={selectedCountry?.code || currentCountryCode}
          onValueChange={handleCountryChange}
          countries={countriesList}
          aria-label={t("checkout.fields.country")}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Dynamic State / Province field */}
        <div>
          <label htmlFor={htmlId("state")} className="text-sm font-medium mb-1 block">
            {t("checkout.fields.state")}
          </label>
          {hasStates && selectedCountry ? (
            <Select
              id={htmlId("state")}
              name={htmlId("state")}
              value={address.state ?? ""}
              onChange={(e) => update("state", e.target.value)}
              aria-label={t("checkout.fields.state")}
            >
              <option value="">{t("checkout.fields.selectState")}</option>
              {selectedCountry.states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={htmlId("state")}
              name={htmlId("state")}
              value={address.state ?? ""}
              onChange={(e) => update("state", e.target.value)}
              placeholder={t("checkout.fields.stateFallbackPlaceholder")}
            />
          )}
        </div>

        <div>
          <label htmlFor={htmlId("city")} className="text-sm font-medium mb-1 block">
            {t("checkout.fields.city")}
          </label>
          <Input {...field("city")} placeholder={t("checkout.fields.cityPlaceholder")} />
        </div>

        <div>
          <label htmlFor={htmlId("postcode")} className="text-sm font-medium mb-1 block">
            {t("checkout.fields.postcode")}
          </label>
          <Input
            id={htmlId("postcode")}
            name={htmlId("postcode")}
            value={address.postcode ?? ""}
            onChange={handlePostcodeChange}
            placeholder={t("checkout.fields.postcodePlaceholder")}
            inputMode="numeric"
            maxLength={6}
            pattern="[0-9]{6}"
            autoComplete="postal-code"
          />
        </div>
      </div>
    </div>
  );
}
