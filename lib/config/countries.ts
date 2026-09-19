import type { WooCountry } from "@/lib/woocommerce/types";

/**
 * Country filtering configuration.
 *
 * Current business requirement: Show ALL countries from WooCommerce.
 * Therefore ENABLED_COUNTRIES is null by default.
 *
 * Extension Point:
 * If a future client or deployment requires restricting to specific countries,
 * specify their ISO 3166-1 alpha-2 codes here, e.g.:
 *   export const ENABLED_COUNTRIES: string[] | null = ["IN", "AE", "US"];
 */
export const ENABLED_COUNTRIES: string[] | null = null;

/**
 * Filters WooCommerce country list based on ENABLED_COUNTRIES configuration.
 * If ENABLED_COUNTRIES is null or empty, all countries are returned.
 */
export function filterCountries(countries: WooCountry[]): WooCountry[] {
  if (!ENABLED_COUNTRIES || ENABLED_COUNTRIES.length === 0) {
    return countries;
  }
  const allowed = new Set(ENABLED_COUNTRIES.map((c) => c.toUpperCase()));
  return countries.filter((c) => allowed.has(c.code.toUpperCase()));
}
