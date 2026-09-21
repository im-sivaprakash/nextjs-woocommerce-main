"use server";

import { getSessionUser } from "@/lib/auth/session";

export interface CustomerOrderSummary {
  id: number;
  number: string;
  status: string;
  dateCreated: string;
  total: string;
  currency: string;
  itemCount: number;
  paymentMethodTitle: string;
  lineItems: {
    id: number;
    name: string;
    quantity: number;
    total: string;
    price: number;
  }[];
}

interface RawLineItem {
  id?: number;
  name?: string;
  quantity?: number;
  total?: string;
  price?: number;
}

interface RawOrder {
  id: number;
  number?: string;
  status?: string;
  date_created?: string;
  date_created_gmt?: string;
  total?: string;
  currency?: string;
  payment_method_title?: string;
  payment_method?: string;
  billing?: {
    email?: string;
  };
  line_items?: RawLineItem[];
}

/**
 * Fetch orders for the currently authenticated customer.
 */
export async function getCustomerOrdersAction(): Promise<{
  success: boolean;
  orders: CustomerOrderSummary[];
  error?: string;
}> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return {
        success: false,
        orders: [],
        error: "You must be signed in to view your orders.",
      };
    }

    const ck = process.env.WC_CONSUMER_KEY;
    const cs = process.env.WC_CONSUMER_SECRET;
    if (!ck || !cs) {
      return {
        success: false,
        orders: [],
        error: "WooCommerce API credentials not configured",
      };
    }

    const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
    const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
    const baseUrl = `${protocol}://${host}/wp-json/wc/v3/orders`;

    const orderMap = new Map<number, RawOrder>();

    // 1. Fetch orders by customer ID if logged in
    if (user.id && Number(user.id) > 0) {
      try {
        const idUrl = new URL(baseUrl);
        idUrl.searchParams.set("consumer_key", ck);
        idUrl.searchParams.set("consumer_secret", cs);
        idUrl.searchParams.set("customer", String(user.id));
        idUrl.searchParams.set("per_page", "50");

        const idRes = await fetch(idUrl.toString(), { cache: "no-store" });
        if (idRes.ok) {
          const idData = (await idRes.json().catch(() => [])) as RawOrder[];
          if (Array.isArray(idData)) {
            for (const o of idData) {
              if (o?.id) orderMap.set(o.id, o);
            }
          }
        }
      } catch (idErr) {
        console.warn("[getCustomerOrdersAction] Customer ID search error:", idErr);
      }
    }

    // 2. Fetch orders by user email (finds all guest orders placed with this email)
    if (user.email) {
      try {
        const emailUrl = new URL(baseUrl);
        emailUrl.searchParams.set("consumer_key", ck);
        emailUrl.searchParams.set("consumer_secret", cs);
        emailUrl.searchParams.set("search", user.email.trim());
        emailUrl.searchParams.set("per_page", "50");

        const emailRes = await fetch(emailUrl.toString(), { cache: "no-store" });
        if (emailRes.ok) {
          const emailData = (await emailRes.json().catch(() => [])) as RawOrder[];
          if (Array.isArray(emailData)) {
            for (const o of emailData) {
              if (o?.id) {
                const billingEmail = o.billing?.email?.toLowerCase().trim();
                if (!billingEmail || billingEmail === user.email.toLowerCase().trim()) {
                  orderMap.set(o.id, o);
                }
              }
            }
          }
        }
      } catch (emailErr) {
        console.warn("[getCustomerOrdersAction] Email search error:", emailErr);
      }
    }

    // 3. Sort merged orders newest to oldest
    const combinedRawOrders = Array.from(orderMap.values()).sort((a, b) => {
      const dateA = new Date(a.date_created || a.date_created_gmt || 0).getTime();
      const dateB = new Date(b.date_created || b.date_created_gmt || 0).getTime();
      if (!isNaN(dateA) && !isNaN(dateB) && dateA !== dateB) {
        return dateB - dateA;
      }
      return b.id - a.id;
    });

    const orders = formatOrders(combinedRawOrders, user.email);
    return {
      success: true,
      orders,
    };
  } catch (error: unknown) {
    return {
      success: false,
      orders: [],
      error: error instanceof Error ? error.message : "Failed to retrieve orders",
    };
  }
}

function formatOrders(rawOrders: RawOrder[], userEmail?: string): CustomerOrderSummary[] {
  return rawOrders
    .filter((order) => {
      // Additional safety filter by email if present
      if (!userEmail) return true;
      const billingEmail = order.billing?.email?.toLowerCase();
      return !billingEmail || billingEmail === userEmail.toLowerCase();
    })
    .map((order) => {
      const lineItems = Array.isArray(order.line_items)
        ? order.line_items.map((item) => ({
            id: item.id || 0,
            name: item.name || "Item",
            quantity: item.quantity || 1,
            total: item.total || "0",
            price: item.price || 0,
          }))
        : [];

      const itemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);

      return {
        id: order.id,
        number: String(order.number || order.id),
        status: order.status || "pending",
        dateCreated: order.date_created || order.date_created_gmt || "",
        total: order.total || "0",
        currency: order.currency || "USD",
        itemCount,
        paymentMethodTitle: order.payment_method_title || order.payment_method || "Online",
        lineItems,
      };
    });
}
