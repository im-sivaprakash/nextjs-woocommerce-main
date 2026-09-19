import type { WooCountry } from "./types";

/**
 * Resilient fallback country dataset.
 * Used if the WooCommerce REST API /data/countries call experiences a network timeout or error.
 * Ensures that the checkout form never crashes and default India (IN) is always available.
 */
export const FALLBACK_COUNTRIES: WooCountry[] = [
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
      { code: "TS", name: "Telangana" },
      { code: "TR", name: "Tripura" },
      { code: "UP", name: "Uttar Pradesh" },
      { code: "UK", name: "Uttarakhand" },
      { code: "WB", name: "West Bengal" },
      { code: "AN", name: "Andaman and Nicobar Islands" },
      { code: "CH", name: "Chandigarh" },
      { code: "DH", name: "Dadra and Nagar Haveli and Daman and Diu" },
      { code: "DL", name: "Delhi" },
      { code: "JK", name: "Jammu and Kashmir" },
      { code: "LA", name: "Ladakh" },
      { code: "LD", name: "Lakshadweep" },
      { code: "PY", name: "Puducherry" },
    ],
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    states: [],
  },
  {
    code: "US",
    name: "United States (US)",
    states: [
    ],
  },
  {
    code: "GB",
    name: "United Kingdom (UK)",
    states: [],
  },
];
