import "server-only";

import type { OrderScan, OrderTrackingInfo } from "./shipping-types";

export type { OrderScan, OrderTrackingInfo };

interface RawTrackingResponse {
  success?: boolean;
  has_tracking?: boolean;
  order_id?: number;
  order_number?: string;
  awb?: string | null;
  status?: string | null;
  status_id?: number | null;
  courier?: string | null;
  etd?: string | null;
  scans?: OrderScan[];
  updated_at?: string | null;
  error?: string;
  message?: string;
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
 * Retrieves the secret internal API AUTH_KEY for shipping endpoints.
 */
function getInternalAuthKey(): string {
  const cartKey = process.env.MYAPP_CART_AUTH_KEY;
  if (cartKey && cartKey.trim() !== "") {
    return cartKey.trim();
  }

  const authKey = process.env.AUTH_KEY;
  if (authKey && authKey.trim() !== "") {
    return authKey.trim();
  }

  return "";
}

/**
 * Fetch shipment tracking details for a specific order from WordPress/WooCommerce.
 */
export async function fetchOrderTracking(
  orderId: number,
  userId?: number | string | null,
  email?: string | null
): Promise<{
  success: boolean;
  tracking?: OrderTrackingInfo;
  error?: string;
}> {
  try {
    if (!orderId || orderId <= 0) {
      return {
        success: false,
        error: "Invalid order ID.",
      };
    }

    const authKey = getInternalAuthKey();
    if (!authKey) {
      console.warn("[fetchOrderTracking] Missing MYAPP_CART_AUTH_KEY or AUTH_KEY");
      return {
        success: false,
        error: "Shipping API credentials not configured.",
      };
    }

    const queryParams = new URLSearchParams();
    queryParams.set("AUTH_KEY", authKey);

    if (userId && Number(userId) > 0) {
      queryParams.set("user_id", String(userId));
    }

    if (email && email.trim() !== "") {
      queryParams.set("email", email.trim());
    }

    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/wp-json/myapp/v1/shipping/track/${orderId}?${queryParams.toString()}`;

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status === 403) {
        return {
          success: false,
          error: "You do not have permission to view tracking for this order.",
        };
      }
      if (res.status === 404) {
        return {
          success: false,
          error: "Tracking details not found for this order.",
        };
      }
      const errorText = await res.text();
      console.error(`[fetchOrderTracking] WordPress endpoint returned status ${res.status}:`, errorText);
      return {
        success: false,
        error: "Failed to retrieve shipment tracking.",
      };
    }

    const json = (await res.json().catch(() => null)) as RawTrackingResponse | null;
    if (!json || json.success === false) {
      return {
        success: false,
        error: json?.message || "Failed to parse tracking response.",
      };
    }

    const scans: OrderScan[] = Array.isArray(json.scans)
      ? json.scans.map((s) => ({
          date: String(s.date || ""),
          activity: String(s.activity || ""),
          location: s.location ? String(s.location) : undefined,
          sr_status_label: s.sr_status_label ? String(s.sr_status_label) : undefined,
        }))
      : [];

    const tracking: OrderTrackingInfo = {
      orderId: Number(json.order_id || orderId),
      orderNumber: json.order_number ? String(json.order_number) : undefined,
      awb: json.awb || null,
      status: json.status || null,
      statusId: typeof json.status_id === "number" ? json.status_id : null,
      courier: json.courier || null,
      etd: json.etd || null,
      scans,
      updatedAt: json.updated_at || null,
      hasTracking: Boolean(json.has_tracking ?? (json.awb || json.status || json.courier || scans.length > 0)),
    };

    return {
      success: true,
      tracking,
    };
  } catch (err: unknown) {
    console.error("[fetchOrderTracking] Unexpected error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "An unexpected error occurred while fetching tracking.",
    };
  }
}
