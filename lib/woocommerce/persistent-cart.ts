import "server-only";

export interface PersistentCartItem {
  id: number;
  quantity: number;
  variation?: {
    attribute: string;
    value: string;
  }[];
}

/**
 * Derives WordPress/WooCommerce root URL using environment variables.
 */
function getBaseUrl(): string {
  const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
  const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
  return `${protocol}://${host}`.replace(/\/+$/, "");
}

/**
 * Retrieves the secret AUTH_KEY for internal persistent cart endpoints.
 * Throws a clear error if the server environment variable is missing.
 */
function getCartAuthKey(): string {
  const key = process.env.MYAPP_CART_AUTH_KEY;
  if (!key) {
    throw new Error("MYAPP_CART_AUTH_KEY environment variable is not configured");
  }
  return key;
}

/**
 * Saves a customer's persistent cart items to WordPress user meta.
 */
export async function saveUserCart(
  userId: number,
  items: PersistentCartItem[]
): Promise<{ success: boolean }> {
  try {
    const authKey = getCartAuthKey();
    const url = `${getBaseUrl()}/wp-json/myapp/v1/cart/save`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
        items,
        AUTH_KEY: authKey,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[saveUserCart] WordPress endpoint failed with status ${res.status}:`, errorText);
      return { success: false };
    }

    const json = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null;
    if (json?.success) {
      return { success: true };
    }

    console.error("[saveUserCart] WordPress endpoint reported error:", json?.message ?? "Unknown error");
    return { success: false };
  } catch (error: unknown) {
    console.error("[saveUserCart] Unexpected error saving user cart:", error);
    return { success: false };
  }
}

/**
 * Fetches a customer's persistent cart items from WordPress user meta.
 */
export async function getUserCart(
  userId: number
): Promise<{ success: boolean; items: PersistentCartItem[] }> {
  try {
    const authKey = getCartAuthKey();
    const queryParams = new URLSearchParams({
      user_id: String(userId),
      AUTH_KEY: authKey,
    });
    const url = `${getBaseUrl()}/wp-json/myapp/v1/cart/get?${queryParams.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[getUserCart] WordPress endpoint failed with status ${res.status}:`, errorText);
      return { success: false, items: [] };
    }

    const json = (await res.json().catch(() => null)) as {
      success?: boolean;
      items?: PersistentCartItem[];
      message?: string;
    } | null;

    if (json?.success && Array.isArray(json.items)) {
      return { success: true, items: json.items };
    }

    console.error("[getUserCart] WordPress endpoint reported error:", json?.message ?? "Invalid response format");
    return { success: false, items: [] };
  } catch (error: unknown) {
    console.error("[getUserCart] Unexpected error fetching user cart:", error);
    return { success: false, items: [] };
  }
}
