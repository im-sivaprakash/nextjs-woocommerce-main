"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useCheckoutStore } from "@/lib/store/checkout-store";
import { Input } from "@/components/ui/input";
import { CountryFlag } from "@/components/ui/country-flag";
import { getAvailableCountries } from "@/lib/actions/cart";
import {
  isSingleCountryFixed,
  getDefaultCountry,
} from "@/lib/config/countries";
import { t } from "@/lib/i18n";
import { ChevronDown, Search, Lock } from "lucide-react";
import type { BillingAddress, ShippingAddress, WooCountry } from "@/lib/woocommerce/types";

interface AddressFieldsProps {
  namePrefix: "billing" | "shipping";
  /** When true, also renders company, email, and phone fields (billing only). */
  showContactFields?: boolean;
}

interface CountryDropdownPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
  placement: "down" | "up";
}

// Resilient initial country state before server action completes
const DEFAULT_INITIAL_COUNTRIES: WooCountry[] = [
  {
    code: "IN",
    name: "India",
    states: [
      { code: "AP", name: "Andhra Pradesh" },
      { code: "AR", name: "Arunachal Pradesh" },
      { code: "AS", name: "Assam" },
      { code: "BR", name: "Bihar" },
      { code: "CT", name: "Chhattisgarh" },
      { code: "GA", name: "Goa" },
      { code: "GJ", name: "Gujarat" },
      { code: "HR", name: "Haryana" },
      { code: "HP", name: "Himachal Pradesh" },
      { code: "JH", name: "Jharkhand" },
      { code: "KA", name: "Karnataka" },
      { code: "KL", name: "Kerala" },
      { code: "MP", name: "Madhya Pradesh" },
      { code: "MH", name: "Maharashtra" },
      { code: "MN", name: "Manipur" },
      { code: "ML", name: "Meghalaya" },
      { code: "MZ", name: "Mizoram" },
      { code: "NL", name: "Nagaland" },
      { code: "OR", name: "Odisha" },
      { code: "PB", name: "Punjab" },
      { code: "RJ", name: "Rajasthan" },
      { code: "SK", name: "Sikkim" },
      { code: "TN", name: "Tamil Nadu" },
      { code: "TG", name: "Telangana" },
      { code: "TR", name: "Tripura" },
      { code: "UP", name: "Uttar Pradesh" },
      { code: "UT", name: "Uttarakhand" },
      { code: "WB", name: "West Bengal" },
      { code: "AN", name: "Andaman and Nicobar Islands" },
      { code: "CH", name: "Chandigarh" },
      { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu" },
      { code: "DL", name: "Delhi" },
      { code: "JK", name: "Jammu and Kashmir" },
      { code: "LA", name: "Ladakh" },
      { code: "LD", name: "Lakshadweep" },
      { code: "PY", name: "Puducherry" },
    ],
  },
];

export function AddressFields({ namePrefix, showContactFields = false }: AddressFieldsProps) {
  const updateBilling = useCheckoutStore((s) => s.updateBilling);
  const updateShipping = useCheckoutStore((s) => s.updateShipping);
  const address = useCheckoutStore((s) => (namePrefix === "billing" ? s.billing : s.shipping));

  const update = useCallback(
    (f: string, v: string) => {
      if (namePrefix === "billing") {
        updateBilling(f as keyof BillingAddress, v);
      } else {
        updateShipping(f as keyof ShippingAddress, v);
      }
    },
    [namePrefix, updateBilling, updateShipping]
  );

  const htmlId = (f: string) => `${namePrefix}_${f}`;

  const isIndiaFixed = isSingleCountryFixed();
  const defaultCountry = getDefaultCountry();

  // Country options loaded server-authoritatively
  const [countries, setCountries] = useState<WooCountry[]>(DEFAULT_INITIAL_COUNTRIES);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownPosition, setDropdownPosition] = useState<CountryDropdownPosition | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement>(null);
  const dropdownPanelRef = useRef<HTMLDivElement>(null);

  // Fetch available countries from server action
  useEffect(() => {
    let mounted = true;
    getAvailableCountries()
      .then((data) => {
        if (mounted && Array.isArray(data) && data.length > 0) {
          setCountries(data);
        }
      })
      .catch((err) => {
        console.warn("[AddressFields] Failed to load countries from server:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updateDropdownPosition = useCallback(() => {
    const trigger = dropdownTriggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 8;
    const maxPanelHeight = Math.min(window.innerHeight * 0.7, 448);
    const availableWidth = Math.max(0, window.innerWidth - viewportPadding * 2);
    const width = Math.min(rect.width, availableWidth);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding)
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;

    // Keep compact lists below when they fit; otherwise use the side with
    // more room and let the options area scroll within the viewport.
    const placement =
      spaceBelow < Math.min(maxPanelHeight, 180) && spaceAbove > spaceBelow ? "up" : "down";
    const availableSpace = placement === "up" ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(120, Math.min(maxPanelHeight, availableSpace));

    setDropdownPosition({
      left,
      width,
      ...(placement === "up"
        ? { bottom: Math.max(viewportPadding, window.innerHeight - rect.top + viewportPadding) }
        : { top: Math.max(viewportPadding, rect.bottom + viewportPadding) }),
      maxHeight,
      placement,
    });
  }, []);

  const closeCountryDropdown = useCallback(() => {
    setIsDropdownOpen(false);
    setSearchQuery("");
    setDropdownPosition(null);
  }, []);

  // Ensure current country is set to a valid allowed default
  const selectedCountryCode = address.country || defaultCountry;
  useEffect(() => {
    if (isIndiaFixed && address.country !== "IN") {
      update("country", "IN");
    } else if (!address.country) {
      update("country", defaultCountry);
    }
  }, [isIndiaFixed, address.country, defaultCountry, update]);

  // Handle outside click to close country dropdown
  useEffect(() => {
    if (!isDropdownOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        !dropdownPanelRef.current?.contains(target)
      ) {
        closeCountryDropdown();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen, closeCountryDropdown]);

  // Dismiss on page or checkout-container scroll, but retain internal option-list scrolling.
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && dropdownPanelRef.current?.contains(target)) {
        return;
      }

      closeCountryDropdown();
    };

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", closeCountryDropdown);
    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", closeCountryDropdown);
    };
  }, [isDropdownOpen, closeCountryDropdown]);

  // Find currently selected country metadata
  const currentCountryObj = useMemo(() => {
    return (
      countries.find((c) => c.code.toUpperCase() === selectedCountryCode.toUpperCase()) || {
        code: selectedCountryCode,
        name: selectedCountryCode === "IN" ? "India" : selectedCountryCode,
        states: [],
      }
    );
  }, [countries, selectedCountryCode]);

  // Client-side instant filter of allowed countries by name or code
  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return countries;
    return countries.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countries, searchQuery]);

  function handleSelectCountry(country: WooCountry) {
    update("country", country.code);
    // If selected state does not belong to new country's states, reset state
    if (address.state) {
      const validState = country.states?.some(
        (s) => s.code.toUpperCase() === address.state.toUpperCase()
      );
      if (!validState) {
        update("state", "");
      }
    }
    closeCountryDropdown();
  }

  function handlePostcodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Strictly numeric, maximum 6 digits
    const sanitized = e.target.value.replace(/\D/g, "").slice(0, 6);
    update("postcode", sanitized);
  }

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
      {/* Name fields */}
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

      {/* Contact fields (billing only) */}
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

      {/* Address line fields */}
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

      {/* Country selection field */}
      <div>
        <label htmlFor={htmlId("country")} className="text-sm font-medium mb-1 block">
          {t("checkout.fields.country")}
        </label>

        {/* Hidden form input ensures value is always submitted in FormData */}
        <input type="hidden" id={htmlId("country")} name={htmlId("country")} value={selectedCountryCode} />

        {isIndiaFixed ? (
          // Case B: India Only (Fixed & Non-Editable)
          <div
            className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-muted/40 px-3 py-1 text-sm text-foreground select-none cursor-not-allowed opacity-90 dark:bg-muted/20"
            aria-disabled="true"
            title={t("checkout.fields.fixedCountryHint")}
          >
            <div className="flex items-center gap-2.5">
              <CountryFlag countryCode="IN" />
              <span className="font-medium text-foreground">India</span>
            </div>
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-background/80 dark:bg-card px-2 py-0.5 rounded border border-border/50">
              <Lock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
              {t("checkout.fields.fixedCountryHint")}
            </span>
          </div>
        ) : (
          // Case A & C: Multi-Country or Unrestricted (Selectable & Searchable)
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              ref={dropdownTriggerRef}
              onClick={() => {
                if (isDropdownOpen) {
                  closeCountryDropdown();
                } else {
                  updateDropdownPosition();
                  setIsDropdownOpen(true);
                }
              }}
              aria-haspopup="listbox"
              aria-expanded={isDropdownOpen}
              className="flex h-9 w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-1 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <div className="flex items-center gap-2.5 truncate">
                <CountryFlag countryCode={currentCountryObj.code} />
                <span className="truncate">{currentCountryObj.name || selectedCountryCode}</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  isDropdownOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {isDropdownOpen && dropdownPosition &&
              createPortal(
                <div
                  ref={dropdownPanelRef}
                  className="fixed z-[100] flex min-w-0 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md transition-all animate-in fade-in-0 zoom-in-95"
                  style={{
                    left: `${dropdownPosition.left}px`,
                    width: `${dropdownPosition.width}px`,
                    ...(dropdownPosition.placement === "up"
                      ? { bottom: `${dropdownPosition.bottom}px` }
                      : { top: `${dropdownPosition.top}px` }),
                    maxHeight: `${dropdownPosition.maxHeight}px`,
                  }}
                  role="listbox"
                >
                {/* Search input for filtering */}
                <div className="flex shrink-0 items-center border-b border-border bg-muted/20 px-2.5 py-1.5">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground mr-2" aria-hidden="true" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("checkout.fields.searchCountry")}
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        closeCountryDropdown();
                      }
                    }}
                  />
                </div>

                {/* Country Options list */}
                <div className="min-h-0 flex-1 overflow-y-auto p-1">
                  {filteredCountries.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                      {t("checkout.fields.noCountriesFound")}
                    </div>
                  ) : (
                    filteredCountries.map((c) => {
                      const isSelected = c.code.toUpperCase() === selectedCountryCode.toUpperCase();
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => handleSelectCountry(c)}
                          role="option"
                          aria-selected={isSelected}
                          className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-left transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground font-medium"
                              : "hover:bg-accent hover:text-accent-foreground"
                          }`}
                        >
                          <CountryFlag countryCode={c.code} />
                          <span className="truncate">{c.name}</span>
                          <span
                            className={`ml-auto text-xs ${
                              isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                            }`}
                          >
                            {c.code}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                </div>,
                document.body
              )}
          </div>
        )}
      </div>

      {/* City, State/Province, and Postcode fields */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* City field */}
        <div>
          <label htmlFor={htmlId("city")} className="text-sm font-medium mb-1 block">
            {t("checkout.fields.city")}
          </label>
          <Input {...field("city")} placeholder={t("checkout.fields.cityPlaceholder")} />
        </div>

        {/* Dependent State / Province field */}
        <div>
          <label htmlFor={htmlId("state")} className="text-sm font-medium mb-1 block">
            {t("checkout.fields.state")}
          </label>

          {currentCountryObj.states && currentCountryObj.states.length > 0 ? (
            <select
              id={htmlId("state")}
              name={htmlId("state")}
              value={address.state ?? ""}
              onChange={(e) => update("state", e.target.value)}
              className="flex h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2.5 py-1 text-sm text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark] dark:bg-input/30"
            >
              <option value="" className="bg-background text-foreground dark:bg-popover dark:text-popover-foreground">
                {t("checkout.fields.selectState")}
              </option>
              {currentCountryObj.states.map((s) => (
                <option
                  key={s.code}
                  value={s.code}
                  className="bg-background text-foreground dark:bg-popover dark:text-popover-foreground"
                >
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <Input {...field("state")} placeholder={t("checkout.fields.statePlaceholder")} />
          )}
        </div>

        {/* Postcode field (strict 6 digits, numeric only) */}
        <div>
          <label htmlFor={htmlId("postcode")} className="text-sm font-medium mb-1 block">
            {t("checkout.fields.postcode")}
          </label>
          <Input
            id={htmlId("postcode")}
            name={htmlId("postcode")}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={address.postcode ?? ""}
            onChange={handlePostcodeChange}
            placeholder={t("checkout.fields.postcodePlaceholder")}
          />
        </div>
      </div>
    </div>
  );
}
