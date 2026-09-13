import type { PersistentCartItem } from "@/lib/woocommerce/persistent-cart";

/**
 * Normalizes variation array for deterministic composite key generation.
 */
function normalizeVariation(variation?: { attribute: string; value: string }[]): string {
  if (!variation || variation.length === 0) {
    return "[]";
  }
  const sorted = [...variation].sort((x, y) => x.attribute.localeCompare(y.attribute));
  return JSON.stringify(sorted);
}

/**
 * Pure function to merge two lists of PersistentCartItem.
 * Matches items on composite key (id + variation), summing their quantities.
 * Keeps non-overlapping items as-is.
 *
 * @param a First list of cart items (e.g. guest cart)
 * @param b Second list of cart items (e.g. saved account cart)
 * @returns Combined array of PersistentCartItem with consolidated quantities
 */
export function mergeCartItems(
  a: PersistentCartItem[],
  b: PersistentCartItem[]
): PersistentCartItem[] {
  const map = new Map<string, PersistentCartItem>();

  const listA = Array.isArray(a) ? a : [];
  const listB = Array.isArray(b) ? b : [];

  for (const item of [...listA, ...listB]) {
    if (!item || typeof item.id !== "number" || item.quantity <= 0) {
      continue;
    }

    const key = `${item.id}:${normalizeVariation(item.variation)}`;
    const existing = map.get(key);

    if (existing) {
      existing.quantity += item.quantity;
    } else {
      map.set(key, {
        id: item.id,
        quantity: item.quantity,
        ...(item.variation && item.variation.length > 0 ? { variation: item.variation } : {}),
      });
    }
  }

  return Array.from(map.values());
}
