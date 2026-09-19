/**
 * Converts a 2-letter ISO 3166-1 alpha-2 country code into its Unicode flag emoji.
 *
 * How it works:
 * Regional indicator symbols for 'A'-'Z' start at Unicode code point 0x1F1E6 (127397 in decimal).
 * E.g., 'IN' -> 0x1F1EE ('I') + 0x1F1F3 ('N') -> 🇮🇳
 *
 * Characteristics:
 * - 0 bytes client bundle size
 * - Zero network requests
 * - 100% SSR-safe & deterministic
 * - Natively renderable inside HTML <option> tags
 *
 * @param countryCode - 2-letter country code, e.g. "IN", "US", "AE"
 */
export function getCountryFlagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "";
  const upper = countryCode.toUpperCase();
  const codePoints = [
    127397 + upper.charCodeAt(0),
    127397 + upper.charCodeAt(1),
  ];
  return String.fromCodePoint(...codePoints);
}
