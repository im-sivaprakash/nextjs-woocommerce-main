import { act } from "react";

// Mock server actions before importing store
jest.mock("@/lib/actions/cart", () => ({
  getCart: jest.fn().mockResolvedValue({ cart: null, cartToken: null, nonce: null }),
  addToCart: jest.fn(),
  applyCoupon: jest.fn(),
  removeCoupon: jest.fn(),
}));

import {
  addToCart as mockAddToCart,
  applyCoupon as mockApplyCoupon,
  removeCoupon as mockRemoveCoupon,
} from "@/lib/actions/cart";
import { useBuyNowStore } from "@/lib/store/buy-now-store";
import type { WooCart } from "@/lib/woocommerce/types";

const makeCart = (overrides: Partial<WooCart> = {}): WooCart => ({
  items: [
    {
      key: "item_1",
      id: 10,
      quantity: 1,
      quantity_limits: {
        minimum: 1,
        maximum: 10,
        multiple_of: 1,
        editable: true,
      },
      name: "Perfume X",
      short_description: "",
      description: "",
      sku: "PERF-X",
      images: [],
      variation: [],
      prices: {
        price: "1000",
        regular_price: "1000",
        sale_price: "1000",
        currency_code: "USD",
        currency_symbol: "$",
        currency_minor_unit: 2,
        currency_prefix: "$",
        currency_suffix: "",
      },
      totals: {
        line_subtotal: "1000",
        line_subtotal_tax: "0",
        line_total: "1000",
        line_total_tax: "0",
        currency_code: "USD",
        currency_symbol: "$",
        currency_minor_unit: 2,
        currency_prefix: "$",
        currency_suffix: "",
      },
    },
  ],
  items_count: 1,
  items_weight: 0,
  coupons: [],
  totals: {
    total_items: "1000",
    total_items_tax: "0",
    total_shipping: "0",
    total_shipping_tax: "0",
    total_discount: "0",
    total_discount_tax: "0",
    total_tax: "0",
    total_price: "1000",
    currency_code: "USD",
    currency_symbol: "$",
    currency_minor_unit: 2,
    currency_prefix: "$",
    currency_suffix: "",
  },
  shipping_rates: [],
  needs_payment: true,
  needs_shipping: true,
  payment_methods: ["cod"],
  ...overrides,
});

describe("useBuyNowStore", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    act(() => {
      useBuyNowStore.getState().clearBuyNow();
    });
  });

  it("startBuyNow calls addToCart with undefined token to isolate cart session and syncs to regular cart", async () => {
    const singleItemCart = makeCart();
    (mockAddToCart as jest.Mock).mockResolvedValue({
      cart: singleItemCart,
      cartToken: "buy-now-token-123",
      nonce: "nonce-456",
    });

    let res: { cart: WooCart | null; error?: string };
    await act(async () => {
      res = await useBuyNowStore.getState().startBuyNow(10, 1);
    });

    expect(mockAddToCart).toHaveBeenCalledWith(10, 1, undefined, undefined, undefined);
    expect(res!.cart).toEqual(singleItemCart);
    expect(useBuyNowStore.getState().buyNowCart).toEqual(singleItemCart);
    expect(useBuyNowStore.getState().buyNowToken).toBe("buy-now-token-123");
    expect(useBuyNowStore.getState().buyNowNonce).toBe("nonce-456");
    expect(localStorage.getItem("buy-now-token-store")).toBe("buy-now-token-123");
    expect(localStorage.getItem("buy-now-nonce-store")).toBe("nonce-456");
  });

  it("applies and removes coupons in Buy Now session", async () => {
    const cartWithCoupon = makeCart({
      coupons: [
        {
          code: "SAVE10",
          discount_type: "percent",
          totals: {
            total_discount: "100",
            total_discount_tax: "0",
            currency_code: "USD",
          },
        },
      ],
    });

    (mockApplyCoupon as jest.Mock).mockResolvedValue({
      cart: cartWithCoupon,
      cartToken: "buy-now-token-123",
      nonce: "nonce-456",
    });

    useBuyNowStore.setState({
      buyNowToken: "buy-now-token-123",
      buyNowNonce: "nonce-456",
    });

    await act(async () => {
      const res = await useBuyNowStore.getState().applyCoupon("SAVE10");
      expect(res.error).toBeUndefined();
    });

    expect(mockApplyCoupon).toHaveBeenCalledWith("SAVE10", "buy-now-token-123", "nonce-456");
    expect(useBuyNowStore.getState().buyNowCart).toEqual(cartWithCoupon);

    (mockRemoveCoupon as jest.Mock).mockResolvedValue({
      cart: makeCart(),
      cartToken: "buy-now-token-123",
      nonce: "nonce-456",
    });

    await act(async () => {
      const res = await useBuyNowStore.getState().removeCoupon("SAVE10");
      expect(res.error).toBeUndefined();
    });

    expect(mockRemoveCoupon).toHaveBeenCalledWith("SAVE10", "buy-now-token-123", "nonce-456");
  });

  it("clearBuyNow wipes store and localStorage", () => {
    useBuyNowStore.setState({
      buyNowCart: makeCart(),
      buyNowToken: "buy-now-token-123",
      buyNowNonce: "nonce-456",
    });
    localStorage.setItem("buy-now-token-store", "buy-now-token-123");
    localStorage.setItem("buy-now-nonce-store", "nonce-456");
    localStorage.setItem("buy-now-cart-store", JSON.stringify(makeCart()));

    act(() => {
      useBuyNowStore.getState().clearBuyNow();
    });

    expect(useBuyNowStore.getState().buyNowCart).toBeNull();
    expect(useBuyNowStore.getState().buyNowToken).toBeUndefined();
    expect(useBuyNowStore.getState().buyNowNonce).toBeUndefined();
    expect(localStorage.getItem("buy-now-token-store")).toBeNull();
    expect(localStorage.getItem("buy-now-nonce-store")).toBeNull();
    expect(localStorage.getItem("buy-now-cart-store")).toBeNull();
  });
});
