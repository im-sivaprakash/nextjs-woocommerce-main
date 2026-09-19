import type {
  WooProduct,
  WooStoreOrder,
  WooV3Product,
  WooV3Variation,
  CurrencySettings,
  WooCountry,
} from "./types";
import { decodeHtml } from "@/lib/utils/format";
import { FALLBACK_COUNTRIES } from "./countries-fallback";
import { filterCountries } from "@/lib/config/countries";

const WP_URL = `${process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL}://${process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST}`;
const STORE_API_URL = `${WP_URL}/wp-json/wc/store/v1`;
const REST_API_URL = `${WP_URL}/wp-json/wc/v3`;

// ─── Store API helpers (cart / checkout / orders) ────────────────────────────

/** Helper to extract Nonce from Response headers */
export function extractNonce(res: Response): string | null {
  return (
    res.headers.get("Nonce") ||
    res.headers.get("nonce") ||
    res.headers.get("X-WC-Store-API-Nonce") ||
    res.headers.get("x-wc-store-api-nonce") ||
    null
  );
}

/** Helper to extract Cart-Token from Response headers */
export function extractCartToken(res: Response): string | null {
  return (
    res.headers.get("Cart-Token") ||
    res.headers.get("cart-token") ||
    null
  );
}

/** Build headers for cart-mutating requests. */
function cartHeaders(cartToken?: string, nonce?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cartToken) headers["Cart-Token"] = cartToken;
  if (nonce) {
    headers["Nonce"] = nonce;
    headers["X-WC-Store-API-Nonce"] = nonce;
  }
  return headers;
}

async function cartFetch(
  url: string,
  body: unknown,
  cartToken?: string,
  nonce?: string,
): Promise<Response> {
  let activeToken = cartToken;
  let activeNonce = nonce;

  // If nonce is missing, fetch the cart first to acquire session nonce and cart token
  if (!activeNonce) {
    try {
      const initRes = await getCartFromServer(activeToken);
      const initNonce = extractNonce(initRes);
      const initToken = extractCartToken(initRes);
      if (initNonce) activeNonce = initNonce;
      if (initToken) activeToken = initToken;
    } catch (err) {
      console.warn("[cartFetch] Failed to pre-fetch cart nonce:", err);
    }
  }

  let res = await fetch(url, {
    method: "POST",
    headers: cartHeaders(activeToken, activeNonce),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  // If request failed with 401 missing or invalid nonce, fetch a fresh nonce and retry once
  if (res.status === 401) {
    try {
      const cloned = res.clone();
      const errJson = (await cloned.json().catch(() => null)) as {
        code?: string;
      } | null;
      if (
        errJson?.code === "woocommerce_rest_missing_nonce" ||
        errJson?.code === "woocommerce_rest_invalid_nonce" ||
        errJson?.code === "rest_cookie_invalid_nonce"
      ) {
        console.info(
          "[cartFetch] Nonce missing/invalid. Refreshing nonce and retrying...",
        );
        const refreshRes = await getCartFromServer(activeToken);
        const refreshedNonce = extractNonce(refreshRes);
        const refreshedToken = extractCartToken(refreshRes);
        if (refreshedNonce) activeNonce = refreshedNonce;
        if (refreshedToken) activeToken = refreshedToken;

        res = await fetch(url, {
          method: "POST",
          headers: cartHeaders(activeToken, activeNonce),
          body: JSON.stringify(body),
          cache: "no-store",
        });
      }
    } catch (retryErr) {
      console.warn("[cartFetch] Retry on nonce failure failed:", retryErr);
    }
  }

  return res;
}

// ─── REST API v3 helpers (products) ──────────────────────────────────────────

/**
 * Authenticated fetch for WooCommerce REST API v3.
 * Uses query-string auth (consumer_key / consumer_secret).
 */
async function restApiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
  params?: Record<string, string>,
): Promise<Response> {
  const ck = process.env.WC_CONSUMER_KEY;
  const cs = process.env.WC_CONSUMER_SECRET;
  if (!ck || !cs) {
    throw new Error("WC_CONSUMER_KEY / WC_CONSUMER_SECRET not set");
  }

  const url = new URL(`${REST_API_URL}${endpoint}`);
  url.searchParams.set("consumer_key", ck);
  url.searchParams.set("consumer_secret", cs);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  const res = await fetch(url.toString(), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  return res;
}

async function restApiFetchJson<T>(
  endpoint: string,
  options: RequestInit = {},
  params?: Record<string, string>,
): Promise<T> {
  const res = await restApiFetch<T>(endpoint, options, params);

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`WooCommerce REST API error ${res.status}: ${errorBody}`);
  }

  return res.json() as Promise<T>;
}

// ─── Currency settings (fetched from WC REST API and cached) ─────────────────

let currencyCache: CurrencySettings | null = null;

/**
 * Fetch the store's currency configuration from `/wc/v3/settings/general`.
 * Cached in-memory after first call (per server process).
 */
async function getCurrencySettings(): Promise<CurrencySettings> {
  if (currencyCache) return currencyCache;

  try {
    const settings = await restApiFetchJson<
      { id: string; value: string }[]
    >("/settings/general");

    const get = (id: string) =>
      settings.find((s) => s.id === id)?.value ?? "";

    const code = get("woocommerce_currency");
    const position = get("woocommerce_currency_pos"); // "left" | "right" | "left_space" | "right_space"
    const thousandSep = get("woocommerce_price_thousand_sep");
    const decimalSep = get("woocommerce_price_decimal_sep");
    const numDecimals = parseInt(get("woocommerce_price_num_decimals") || "2", 10);

    // Derive currency symbol from code using a lookup
    const symbol = getCurrencySymbol(code);

    // Derive prefix/suffix from currency position
    let prefix = "";
    let suffix = "";
    if (position === "left") {
      prefix = symbol;
    } else if (position === "left_space") {
      prefix = symbol + " ";
    } else if (position === "right") {
      suffix = symbol;
    } else if (position === "right_space") {
      suffix = " " + symbol;
    } else {
      prefix = symbol; // fallback
    }

    currencyCache = {
      code,
      symbol,
      minor_unit: numDecimals,
      decimal_separator: decimalSep || ".",
      thousand_separator: thousandSep || ",",
      prefix,
      suffix,
    };
  } catch (err) {
    console.error("[getCurrencySettings] Failed to fetch, using defaults:", err);
    currencyCache = {
      code: "USD",
      symbol: "$",
      minor_unit: 2,
      decimal_separator: ".",
      thousand_separator: ",",
      prefix: "$",
      suffix: "",
    };
  }

  return currencyCache;
}

/** Common currency code → symbol lookup. */
function getCurrencySymbol(code: string): string {
  const symbols: Record<string, string> = {
    USD: "$", EUR: "€", GBP: "£", JPY: "¥", AUD: "A$", CAD: "C$",
    CHF: "CHF", CNY: "¥", SEK: "kr", NZD: "NZ$", MXN: "$", SGD: "S$",
    HKD: "HK$", NOK: "kr", KRW: "₩", TRY: "₺", RUB: "₽", INR: "₹",
    BRL: "R$", ZAR: "R", THB: "฿", MYR: "RM", PHP: "₱", IDR: "Rp",
    PLN: "zł", CZK: "Kč", ILS: "₪", AED: "د.إ", SAR: "﷼", TWD: "NT$",
    DKK: "kr", HUF: "Ft", RON: "lei", BGN: "лв", HRK: "kn", ISK: "kr",
    CLP: "$", COP: "$", PEN: "S/.", ARS: "$", VND: "₫", UAH: "₴",
    PKR: "₨", BDT: "৳", NGN: "₦", EGP: "E£", KES: "KSh", GHS: "GH₵",
    LKR: "Rs", MMK: "K",
  };
  return symbols[code] || code;
}

// ─── v3 → Store API normalizer ──────────────────────────────────────────────

/**
 * Convert a REST API v3 product into the Store-API-compatible WooProduct shape
 * that all UI components expect. Prices are converted to minor units.
 */
function normalizeV3Product(raw: WooV3Product, currency: CurrencySettings): WooProduct {
  const toMinorUnits = (price: string): string => {
    if (!price && price !== "0") return "0";
    const num = parseFloat(price);
    if (isNaN(num)) return "0";
    return String(Math.round(num * Math.pow(10, currency.minor_unit)));
  };

  const prices: WooProduct["prices"] = {
    price: toMinorUnits(raw.price),
    regular_price: toMinorUnits(raw.regular_price),
    sale_price: toMinorUnits(raw.sale_price),
    currency_code: currency.code,
    currency_symbol: currency.symbol,
    currency_minor_unit: currency.minor_unit,
    currency_decimal_separator: currency.decimal_separator,
    currency_thousand_separator: currency.thousand_separator,
    currency_prefix: currency.prefix,
    currency_suffix: currency.suffix,
    price_range: null, // computed below for variable products
  };

  // For variable products, compute price_range from the price string
  // (WC v3 sets `price` to the min variation price for variable products)
  // We'd need to look at variations for actual range — but the Store API
  // also gets this from the parent product, so we check variations array
  // length to decide if we need a range.

  // Build images with the extra fields the Store API provides
  const images = raw.images.map((img) => ({
    id: img.id,
    src: img.src,
    thumbnail: img.src, // v3 doesn't provide separate thumbnail
    srcset: "",
    sizes: "",
    name: img.name,
    alt: img.alt,
  }));

  // Build attributes — v3 uses `options: string[]` instead of `terms: []`
  const attributes = raw.attributes.map((attr) => ({
    id: attr.id,
    name: attr.name,
    taxonomy: attr.slug ? `pa_${attr.slug}` : "",
    has_variations: attr.variation,
    terms: attr.options.map((opt, idx) => ({
      id: idx, // v3 doesn't give term IDs in product attributes
      name: opt,
      slug: opt.toLowerCase().replace(/\s+/g, "-"),
      default: false,
    })),
  }));

  // Build variations — v3 only gives IDs, so we create stubs.
  // Full variation data is fetched separately via getVariationData().
  const variations = raw.variations.map((varId) => ({
    id: varId,
    attributes: [],
  }));

  // Compute low_stock_remaining
  const lowStockRemaining =
    raw.manage_stock && raw.stock_quantity !== null && raw.low_stock_amount !== null
      ? raw.stock_quantity <= raw.low_stock_amount
        ? raw.stock_quantity
        : null
      : null;

  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    type: raw.type,
    description: raw.description,
    short_description: raw.short_description,
    sku: raw.sku,
    permalink: raw.permalink,
    prices,
    images,
    categories: raw.categories,
    tags: raw.tags,
    attributes,
    variations,
    has_options: raw.type === "variable" && raw.attributes.some((a) => a.variation),
    is_purchasable: raw.purchasable,
    is_in_stock: raw.stock_status === "instock",
    on_sale: raw.on_sale,
    average_rating: raw.average_rating,
    review_count: raw.rating_count,
    low_stock_remaining: lowStockRemaining,
    add_to_cart: {
      text: raw.type === "variable" ? "Select options" : "Add to cart",
      description: "",
      url: "",
      minimum: 1,
      maximum: raw.manage_stock && raw.stock_quantity !== null ? raw.stock_quantity : 9999,
      multiple_of: 1,
    },
    external_url: raw.external_url,
    button_text: raw.button_text,
  };
}

/**
 * Convert a REST API v3 variation into the prices/stock shape
 * that getVariationData() returns.
 */
function normalizeV3Variation(
  raw: WooV3Variation,
  currency: CurrencySettings,
): { prices: WooProduct["prices"]; is_in_stock: boolean } {
  const toMinorUnits = (price: string): string => {
    if (!price && price !== "0") return "0";
    const num = parseFloat(price);
    if (isNaN(num)) return "0";
    return String(Math.round(num * Math.pow(10, currency.minor_unit)));
  };

  return {
    prices: {
      price: toMinorUnits(raw.price),
      regular_price: toMinorUnits(raw.regular_price),
      sale_price: toMinorUnits(raw.sale_price),
      currency_code: currency.code,
      currency_symbol: currency.symbol,
      currency_minor_unit: currency.minor_unit,
      currency_decimal_separator: currency.decimal_separator,
      currency_thousand_separator: currency.thousand_separator,
      currency_prefix: currency.prefix,
      currency_suffix: currency.suffix,
      price_range: null,
    },
    is_in_stock: raw.stock_status === "instock",
  };
}

// ─── Products (REST API v3) ─────────────────────────────────────────────────

export async function getProducts(params?: {
  per_page?: number;
  page?: number;
  search?: string;
  category?: string;
  orderby?: string;
  order?: string;
  on_sale?: boolean;
  featured?: boolean;
  include?: number[];
}): Promise<WooProduct[]> {
  const currency = await getCurrencySettings();

  const searchParams: Record<string, string> = {};
  if (params?.per_page) searchParams.per_page = String(params.per_page);
  if (params?.page) searchParams.page = String(params.page);
  if (params?.search) searchParams.search = params.search;
  if (params?.category) searchParams.category = params.category;
  if (params?.orderby) searchParams.orderby = params.orderby;
  if (params?.order) searchParams.order = params.order;
  if (params?.on_sale) searchParams.on_sale = "true";
  if (params?.featured) searchParams.featured = "true";
  if (params?.include?.length) searchParams.include = params.include.join(",");

  const raw = await restApiFetchJson<WooV3Product[]>(
    "/products",
    { next: { revalidate: 3600 } },
    searchParams,
  );

  return raw.map((p) => normalizeV3Product(p, currency));
}

/** Same as getProducts but also returns X-WP-TotalPages from response headers. */
export async function getProductsMeta(
  params?: Parameters<typeof getProducts>[0],
): Promise<{
  products: WooProduct[];
  totalPages: number;
}> {
  const currency = await getCurrencySettings();

  const searchParams: Record<string, string> = {};
  if (params?.per_page) searchParams.per_page = String(params.per_page);
  if (params?.page) searchParams.page = String(params.page);
  if (params?.search) searchParams.search = params.search;
  if (params?.category) searchParams.category = params.category;
  if (params?.orderby) searchParams.orderby = params.orderby;
  if (params?.order) searchParams.order = params.order;
  if (params?.on_sale) searchParams.on_sale = "true";
  if (params?.featured) searchParams.featured = "true";

  const res = await restApiFetch<WooV3Product[]>(
    "/products",
    { next: { revalidate: 3600 } },
    searchParams,
  );

  if (!res.ok) return { products: [], totalPages: 1 };

  const raw = (await res.json()) as WooV3Product[];
  const products = raw.map((p) => normalizeV3Product(p, currency));
  const totalPages = parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10);
  return { products, totalPages: isNaN(totalPages) ? 1 : totalPages };
}

export async function getProduct(idOrSlug: string): Promise<WooProduct> {
  const currency = await getCurrencySettings();

  // Try to find by slug first
  const raw = await restApiFetchJson<WooV3Product[]>(
    "/products",
    { next: { revalidate: 3600 } },
    { slug: idOrSlug },
  );
  if (raw.length > 0) return normalizeV3Product(raw[0], currency);

  // Fallback: try as numeric ID
  const product = await restApiFetchJson<WooV3Product>(
    `/products/${idOrSlug}`,
    { next: { revalidate: 3600 } },
  );
  return normalizeV3Product(product, currency);
}

/**
 * Fetch prices and stock status for a specific variation.
 * REST API v3 requires the parent product ID:
 *   /products/{parentId}/variations/{variationId}
 */
export async function getVariationData(
  parentProductId: number,
  variationId: number,
): Promise<{
  prices: WooProduct["prices"] | null;
  is_in_stock: boolean;
} | null> {
  try {
    const currency = await getCurrencySettings();
    const raw = await restApiFetchJson<WooV3Variation>(
      `/products/${parentProductId}/variations/${variationId}`,
      { cache: "no-store" },
    );
    const normalized = normalizeV3Variation(raw, currency);
    return {
      prices: normalized.prices,
      is_in_stock: normalized.is_in_stock,
    };
  } catch {
    return null;
  }
}

export async function searchProducts(query: string): Promise<WooProduct[]> {
  return getProducts({ search: query, per_page: 20 });
}

// ─── Cart (Store API) ───────────────────────────────────────────

export async function getCartFromServer(cartToken?: string): Promise<Response> {
  return fetch(`${STORE_API_URL}/cart`, {
    headers: cartHeaders(cartToken),
    cache: "no-store",
  });
}

export async function addToCartOnServer(
  productId: number,
  quantity: number,
  variation?: { attribute: string; value: string }[],
  cartToken?: string,
  nonce?: string,
) {
  const body: Record<string, unknown> = { id: productId, quantity };
  if (variation) body.variation = variation;
  return cartFetch(`${STORE_API_URL}/cart/add-item`, body, cartToken, nonce);
}

export async function updateCartItemOnServer(
  key: string,
  quantity: number,
  cartToken?: string,
  nonce?: string,
) {
  return cartFetch(
    `${STORE_API_URL}/cart/update-item`,
    { key, quantity },
    cartToken,
    nonce,
  );
}

export async function removeCartItemOnServer(
  key: string,
  cartToken?: string,
  nonce?: string,
) {
  return cartFetch(
    `${STORE_API_URL}/cart/remove-item`,
    { key },
    cartToken,
    nonce,
  );
}

export async function updateCustomerOnServer(
  billingAddress: Record<string, string>,
  shippingAddress: Record<string, string>,
  cartToken?: string,
  nonce?: string,
) {
  return cartFetch(
    `${STORE_API_URL}/cart/update-customer`,
    { billing_address: billingAddress, shipping_address: shippingAddress },
    cartToken,
    nonce,
  );
}

export async function selectShippingRateOnServer(
  packageId: number,
  rateId: string,
  cartToken?: string,
  nonce?: string,
) {
  return cartFetch(
    `${STORE_API_URL}/cart/select-shipping-rate`,
    { package_id: packageId, rate_id: rateId },
    cartToken,
    nonce,
  );
}

// ─── Coupons (Store API) ────────────────────────────────────────────────────

export async function applyCouponOnServer(
  code: string,
  cartToken?: string,
  nonce?: string,
) {
  return cartFetch(
    `${STORE_API_URL}/cart/apply-coupon`,
    { code },
    cartToken,
    nonce,
  );
}

export async function removeCouponOnServer(
  code: string,
  cartToken?: string,
  nonce?: string,
) {
  return cartFetch(
    `${STORE_API_URL}/cart/remove-coupon`,
    { code },
    cartToken,
    nonce,
  );
}

// ─── Orders (Store API — unchanged) ─────────────────────────────────────────

export async function getStoreOrder(
  orderId: string | number,
  orderKey: string,
  billingEmail?: string,
): Promise<WooStoreOrder | null> {
  const params = new URLSearchParams({ key: orderKey });
  if (billingEmail) params.set("billing_email", billingEmail);
  const res = await fetch(`${STORE_API_URL}/order/${orderId}?${params}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json() as Promise<WooStoreOrder>;
}

export async function checkoutOnServer(
  data: {
    billing_address: Record<string, string>;
    shipping_address: Record<string, string>;
    payment_method: string;
    payment_data?: { key: string; value: string }[];
  },
  cartToken?: string,
  nonce?: string,
) {
  console.log(
    "[checkoutOnServer] Request body:",
    JSON.stringify(data, null, 2),
  );
  const res = await cartFetch(
    `${STORE_API_URL}/checkout`,
    data,
    cartToken,
    nonce,
  );
  if (!res.ok) {
    const body = await res.clone().text();
    console.error("[checkoutOnServer] WooCommerce response", res.status, body);
  }
  return res;
}

export async function createWooOrderOnServer(orderData: {
  payment_method?: string;
  payment_method_title?: string;
  set_paid?: boolean;
  status?: string;
  billing?: Record<string, string>;
  shipping?: Record<string, string>;
  line_items?: Array<{
    product_id?: number;
    variation_id?: number;
    quantity: number;
    name?: string;
  }>;
  shipping_lines?: Array<{
    method_id: string;
    method_title: string;
    total: string;
  }>;
  coupon_lines?: Array<{
    code: string;
  }>;
}) {
  console.log(
    "[createWooOrderOnServer] Creating WC order via REST API v3:",
    JSON.stringify(orderData, null, 2),
  );
  const res = await restApiFetch("/orders", {
    method: "POST",
    body: JSON.stringify(orderData),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.clone().text();
    console.error("[createWooOrderOnServer] WooCommerce REST API response:", res.status, body);
  }
  return res;
}

// ─── Countries & States (REST API v3) ───────────────────────────────────────

/**
 * Fetches all countries and states from WooCommerce REST API v3 (/data/countries).
 * Cached via Next.js Data Cache (revalidate: 86400 / 24 hours).
 * Falls back gracefully to FALLBACK_COUNTRIES if the backend is unreachable.
 * Applies application-level filterCountries() configuration.
 */
export async function getCountries(): Promise<WooCountry[]> {
  try {
    const raw = await restApiFetchJson<WooCountry[]>(
      "/data/countries",
      { next: { revalidate: 86400 } }
    );

    const decoded = raw.map((c) => ({
      code: c.code,
      name: decodeHtml(c.name),
      states: (c.states || []).map((s) => ({
        code: s.code,
        name: decodeHtml(s.name),
      })),
    }));

    return filterCountries(decoded);
  } catch (err) {
    console.error("[getCountries] Failed to fetch countries from WooCommerce:", err);
    return filterCountries(FALLBACK_COUNTRIES);
  }
}
