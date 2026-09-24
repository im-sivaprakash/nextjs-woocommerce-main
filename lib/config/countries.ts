import type { WooCountry } from "@/lib/woocommerce/types";

/**
 * Single Source of Truth for allowed countries at checkout.
 *
 * Semantics:
 * - `[]`: No country restriction (all countries from WooCommerce data are available).
 * - `["IN"]`: India only (preselected, fixed, non-editable, only Indian states).
 * - `["IN", "GB", "AE"]`: Multiple countries (searchable dropdown, only these countries visible).
 */
export const ALLOWED_COUNTRIES: readonly string[] = ["IN", "GB", "AE", "US"];

/**
 * Checks whether a given country code is allowed according to the configuration.
 */
export function isCountryAllowed(
  countryCode: string,
  allowedList: readonly string[] = ALLOWED_COUNTRIES
): boolean {
  if (!countryCode || typeof countryCode !== "string") return false;
  if (!allowedList || allowedList.length === 0) return true;
  return allowedList.some((c) => c.toUpperCase() === countryCode.trim().toUpperCase());
}

/**
 * Filters a list of WooCommerce countries against the configured allowed countries.
 * If allowedList is empty, returns all countries.
 */
export function getAllowedCountries(
  allCountries: WooCountry[],
  allowedList: readonly string[] = ALLOWED_COUNTRIES
): WooCountry[] {
  if (!allowedList || allowedList.length === 0) return allCountries;
  const allowedSet = new Set(allowedList.map((c) => c.toUpperCase()));
  return allCountries.filter((c) => allowedSet.has(c.code.toUpperCase()));
}

/**
 * Determines whether the configuration represents a fixed single-country mode (specifically India-only).
 */
export function isSingleCountryFixed(
  allowedList: readonly string[] = ALLOWED_COUNTRIES
): boolean {
  return allowedList.length === 1 && allowedList[0].toUpperCase() === "IN";
}

/**
 * Determines the default country code to preselect in store/forms.
 */
export function getDefaultCountry(
  allowedList: readonly string[] = ALLOWED_COUNTRIES
): string {
  if (allowedList.length === 1) return allowedList[0].toUpperCase();
  if (allowedList.length > 1) {
    return allowedList.includes("IN") ? "IN" : allowedList[0].toUpperCase();
  }
  return "IN";
}
