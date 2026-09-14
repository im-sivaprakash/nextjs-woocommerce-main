"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/lib/store/cart-store";
import { useBuyNowStore } from "@/lib/store/buy-now-store";
import type { WooCart } from "@/lib/woocommerce/types";

interface CartClearerProps {
  isBuyNow?: boolean;
}

function areVariationsEqual(
  a?: { attribute: string; value: string }[],
  b?: { attribute: string; value: string }[]
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((attrA) =>
    b.some(
      (attrB) =>
        attrB.attribute === attrA.attribute && attrB.value === attrA.value
    )
  );
}

/**
 * Handles cart state cleanup once the order-confirmation page has mounted.
 * - If this was a Buy Now checkout:
 *   Decrements or removes only the purchased Buy Now item(s) from the user's regular cart,
 *   preserving all other cart items, then clears the Buy Now session.
 * - If this was a regular checkout:
 *   Clears the entire main cart.
 */
export function CartClearer({ isBuyNow = false }: CartClearerProps) {
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    async function cleanup() {
      if (isBuyNow) {
        let buyNowCart: WooCart | null = useBuyNowStore.getState().buyNowCart;
        if (!buyNowCart && typeof window !== "undefined") {
          try {
            const raw = localStorage.getItem("buy-now-cart-store");
            buyNowCart = raw ? (JSON.parse(raw) as WooCart) : null;
          } catch {
            buyNowCart = null;
          }
        }

        if (buyNowCart?.items && buyNowCart.items.length > 0) {
          await useCartStore.getState().initCart();
          const regularCart = useCartStore.getState().cart;

          if (regularCart?.items && regularCart.items.length > 0) {
            for (const buyNowItem of buyNowCart.items) {
              const match = regularCart.items.find(
                (item) =>
                  item.id === buyNowItem.id &&
                  areVariationsEqual(item.variation, buyNowItem.variation)
              );

              if (match) {
                if (match.quantity > buyNowItem.quantity) {
                  await useCartStore
                    .getState()
                    .updateItem(match.key, match.quantity - buyNowItem.quantity);
                } else {
                  await useCartStore.getState().removeItem(match.key);
                }
              }
            }
          }
        }

        useBuyNowStore.getState().clearBuyNow();
      } else {
        useCartStore.getState().clearCart();
      }
    }

    void cleanup();
  }, [isBuyNow]);

  return null;
}


