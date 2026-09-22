"use client";

import * as React from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCountryFlagEmoji } from "@/lib/utils/country-flags";
import { t } from "@/lib/i18n";
import type { WooCountry } from "@/lib/woocommerce/types";

export interface CountryComboboxProps {
  id?: string;
  name?: string;
  value: string;
  onValueChange: (code: string) => void;
  countries: WooCountry[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  noResultsText?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
}

export function CountryCombobox({
  id,
  name,
  value,
  onValueChange,
  countries,
  disabled = false,
  className,
  placeholder,
  searchPlaceholder,
  noResultsText,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
}: CountryComboboxProps) {
  const currentCode = (value || "").toUpperCase();
  const selectedCountry =
    countries.find((c) => c.code.toUpperCase() === currentCode) || null;

  const resolvedPlaceholder =
    placeholder || t("checkout.fields.selectCountry") || "Select country...";
  const resolvedSearchPlaceholder =
    searchPlaceholder ||
    t("checkout.fields.countrySearchPlaceholder") ||
    "Search country...";
  const resolvedNoResults =
    noResultsText ||
    t("checkout.fields.noCountriesFound") ||
    "No countries found";

  const submittedValue = selectedCountry?.code || currentCode || "";

  return (
    <Combobox.Root<WooCountry>
      name={name}
      items={countries}
      value={selectedCountry}
      disabled={disabled}
      itemToStringLabel={(c) => (c ? `${c.name} ${c.code}` : "")}
      itemToStringValue={(c) => (c ? c.code : "")}
      isItemEqualToValue={(a, b) =>
        Boolean(a && b && a.code.toUpperCase() === b.code.toUpperCase())
      }
      onValueChange={(item) => {
        if (item && item.code) {
          onValueChange(item.code.toUpperCase());
        }
      }}
    >
      <div className="relative w-full">
        {name && <input type="hidden" name={name} value={submittedValue} />}
        <Combobox.Trigger
          id={id}
          disabled={disabled}
          aria-label={ariaLabel || t("checkout.fields.country")}
          aria-invalid={ariaInvalid}
          className={cn(
            "flex h-8 w-full items-center justify-between rounded-lg border border-input bg-background px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            className
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedCountry ? (
              <>
                <span aria-hidden="true" className="font-['Twemoji_Country_Flags',sans-serif] text-base leading-none">
                  {getCountryFlagEmoji(selectedCountry.code)}
                </span>
                <span className="truncate">{selectedCountry.name}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{resolvedPlaceholder}</span>
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform" />
        </Combobox.Trigger>

        <Combobox.Portal>
          <Combobox.Positioner
            sideOffset={4}
            align="start"
            className="z-50 min-w-[var(--anchor-width)] max-w-[calc(100vw-2rem)]"
          >
            <Combobox.Popup className="flex max-h-[min(var(--available-height,20rem),20rem)] w-[var(--anchor-width)] max-w-sm flex-col rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
              <div className="flex shrink-0 items-center border-b border-border px-2 pb-1.5 pt-1">
                <Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                <Combobox.Input
                  placeholder={resolvedSearchPlaceholder}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <Combobox.List className="flex-1 overflow-y-auto overflow-x-hidden p-1 overscroll-contain">
                {(country: WooCountry) => {
                  const flag = getCountryFlagEmoji(country.code);
                  return (
                    <Combobox.Item
                      key={country.code}
                      value={country}
                      className="relative flex cursor-pointer select-none items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                    >
                      <span className="flex items-center gap-2 truncate">
                        {flag && (
                          <span aria-hidden="true" className="font-['Twemoji_Country_Flags',sans-serif] text-base leading-none">
                            {flag}
                          </span>
                        )}
                        <span className="truncate">{country.name}</span>
                      </span>
                      <Combobox.ItemIndicator className="ml-2 flex h-4 w-4 shrink-0 items-center justify-center text-primary">
                        <Check className="h-4 w-4" />
                      </Combobox.ItemIndicator>
                    </Combobox.Item>
                  );
                }}
              </Combobox.List>

              <Combobox.Empty className="empty:hidden py-6 text-center text-sm text-muted-foreground">
                {resolvedNoResults}
              </Combobox.Empty>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </div>
    </Combobox.Root>
  );
}
