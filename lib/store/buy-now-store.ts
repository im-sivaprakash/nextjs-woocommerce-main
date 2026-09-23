import { create } from "zustand";
import type { WooCart } from "@/lib/woocommerce/types";
import {
  getCart as getCartAction,
  addToCart as addToCartAction,
  applyCoupon as applyCouponAction,
  removeCoupon as removeCouponAction,
} from "@/lib/actions/cart";
import { useCartStore } from "@/lib/store/cart-store";

const BUY_NOW_TOKEN_KEY = "buy-now-token-store";
const BUY_NOW_NONCE_KEY = "buy-now-nonce-store";
const BUY_NOW_CART_KEY = "buy-now-cart-store";

const getStoredToken = (): string | undefined =>
  typeof window !== "undefined"
    ? localStorage.getItem(BUY_NOW_TOKEN_KEY) || undefined
    : undefined;

const saveToken = (token: string | null | undefined): void => {
  if (typeof window !== "undefined") {
    if (token) {
      localStorage.setItem(BUY_NOW_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(BUY_NOW_TOKEN_KEY);
    }
  }
};

const getStoredNonce = (): string | undefined =>
  typeof window !== "undefined"
    ? localStorage.getItem(BUY_NOW_NONCE_KEY) || undefined
    : undefined;

const saveNonce = (nonce: string | null | undefined): void => {
  if (typeof window !== "undefined") {
    if (nonce) {
      localStorage.setItem(BUY_NOW_NONCE_KEY, nonce);
    } else {
      localStorage.removeItem(BUY_NOW_NONCE_KEY);
    }
  }
};

const getStoredCart = (): WooCart | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BUY_NOW_CART_KEY);
    return raw ? (JSON.parse(raw) as WooCart) : null;
  } catch {
    return null;
  }
};

const saveCart = (cart: WooCart | null): void => {
  if (typeof window !== "undefined") {
    if (cart) {
      localStorage.setItem(BUY_NOW_CART_KEY, JSON.stringify(cart));
    } else {
      localStorage.removeItem(BUY_NOW_CART_KEY);
    }
  }
};

export interface BuyNowState {
  buyNowCart: WooCart | null;
  buyNowToken: string | undefined;
  buyNowNonce: string | undefined;
  isLoading: boolean;
  isPending: boolean;

  startBuyNow: (
    productId: number,
    quantity?: number,
    variation?: { attribute: string; value: string }[]
  ) => Promise<{ cart: WooCart | null; error?: string }>;
  initBuyNow: () => Promise<void>;
  applyCoupon: (code: string) => Promise<{ error?: string }>;
  removeCoupon: (code: string) => Promise<{ error?: string }>;
  clearBuyNow: () => void;
}

export const useBuyNowStore = create<BuyNowState>((set, get) => ({
  buyNowCart: null,
  buyNowToken: undefined,
  buyNowNonce: undefined,
  isLoading: false,
  isPending: false,

  startBuyNow: async (productId, quantity = 1, variation) => {
    set({ isPending: true });
    try {
      // Intentionally pass undefined token & nonce to generate an isolated checkout session,
      // and simultaneously sync with regular cart (adds item or increments if already present).
      const [result] = await Promise.all([
        addToCartAction(productId, quantity, undefined, variation, undefined),
        useCartStore.getState().addItem(productId, quantity, variation).catch((err) => {
          console.warn("[startBuyNow] Failed to sync item into regular cart:", err);
          return {};
        }),
      ]);

      if (result.error || !result.cart) {
        return { cart: null, error: result.error || "Failed to initiate Buy Now" };
      }

      saveToken(result.cartToken);
      saveNonce(result.nonce);
      saveCart(result.cart);

      set({
        buyNowCart: result.cart,
        buyNowToken: result.cartToken ?? undefined,
        buyNowNonce: result.nonce ?? undefined,
        isLoading: false,
      });

      return { cart: result.cart };
    } catch (err) {
      return { cart: null, error: (err as Error).message };
    } finally {
      set({ isPending: false });
    }
  },

  initBuyNow: async () => {
    const storedToken = getStoredToken();
    const storedNonce = getStoredNonce();
    const storedCart = getStoredCart();

    if (!storedToken && !storedCart) {
      return;
    }

    set({
      buyNowToken: storedToken,
      buyNowNonce: storedNonce,
      buyNowCart: storedCart,
    });

    if (storedToken) {
      set({ isLoading: !storedCart });
      try {
        const result = await getCartAction(storedToken);
        if (result.cart) {
          saveToken(result.cartToken ?? storedToken);
          if (result.nonce) saveNonce(result.nonce);
          saveCart(result.cart);
          set({
            buyNowCart: result.cart,
            buyNowToken: result.cartToken ?? storedToken,
            buyNowNonce: result.nonce ?? storedNonce,
          });
        }
      } catch (err) {
        console.error("Failed to refresh Buy Now cart session:", err);
      } finally {
        set({ isLoading: false });
      }
    }
  },

  applyCoupon: async (code) => {
    const token = get().buyNowToken ?? getStoredToken();
    const nonce = get().buyNowNonce ?? getStoredNonce();
    set({ isPending: true });
    try {
      const result = await applyCouponAction(code, token, nonce);
      if (result.error) {
        return { error: result.error };
      }
      if (result.cart) {
        saveToken(result.cartToken ?? token);
        if (result.nonce) saveNonce(result.nonce);
        saveCart(result.cart);
        set({
          buyNowCart: result.cart,
          buyNowToken: result.cartToken ?? token,
          buyNowNonce: result.nonce ?? nonce,
        });
      }
      return {};
    } finally {
      set({ isPending: false });
    }
  },

  removeCoupon: async (code) => {
    const token = get().buyNowToken ?? getStoredToken();
    const nonce = get().buyNowNonce ?? getStoredNonce();
    set({ isPending: true });
    try {
      const result = await removeCouponAction(code, token, nonce);
      if (result.error) {
        return { error: result.error };
      }
      if (result.cart) {
        saveToken(result.cartToken ?? token);
        if (result.nonce) saveNonce(result.nonce);
        saveCart(result.cart);
        set({
          buyNowCart: result.cart,
          buyNowToken: result.cartToken ?? token,
          buyNowNonce: result.nonce ?? nonce,
        });
      }
      return {};
    } finally {
      set({ isPending: false });
    }
  },

  clearBuyNow: () => {
    saveToken(null);
    saveNonce(null);
    saveCart(null);
    set({
      buyNowCart: null,
      buyNowToken: undefined,
      buyNowNonce: undefined,
      isLoading: false,
      isPending: false,
    });
  },
}));
