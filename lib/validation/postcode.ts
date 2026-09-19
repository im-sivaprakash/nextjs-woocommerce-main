/**
 * Country-specific postcode format patterns registry.
 * Current client business requirement: 6-digit numeric postal/PIN input.
 *
 * This table preserves the extension path for future internationalization
 * without breaking current client enforcement.
 */
export const COUNTRY_POSTCODE_PATTERNS: Record<string, RegExp> = {
  IN: /^\d{6}$/, // India PIN code: exactly 6 digits
  // Future extension points:
  // US: /^\d{5}(-\d{4})?$/, // US ZIP
  // GB: /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i, // UK postcode
  // CA: /^[A-Z]\d[A-Z]\s*\d[A-Z]\d$/i, // Canada
};

/**
 * Validates whether a postcode conforms to the required format.
 * Under current client requirement, enforces exactly 6 digits numeric.
 *
 * @param postcode - The postcode input string
 * @param countryCode - Optional ISO country code (defaults to 'IN')
 */
export function isValidPostcode(postcode: string, countryCode: string = "IN"): boolean {
  if (!postcode) return false;
  const trimmed = postcode.trim();

  // Current client requirement enforces 6-digit PIN, with country-aware pattern lookup extension point
  const pattern = COUNTRY_POSTCODE_PATTERNS[countryCode.toUpperCase()] || /^\d{6}$/;
  return pattern.test(trimmed);
}

/**
 * Sanitizes postcode input for UI field change handler.
 * Strips non-digit characters and limits length to 6 digits under current requirement.
 */
export function sanitizePostcodeInput(input: string): string {
  return input.replace(/\D/g, "").slice(0, 6);
}
