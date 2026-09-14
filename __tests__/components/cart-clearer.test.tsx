import { render, waitFor } from "@testing-library/react";
import { CartClearer } from "@/components/order-confirmation/cart-clearer";
import { useCartStore } from "@/lib/store/cart-store";
import { useBuyNowStore } from "@/lib/store/buy-now-store";
import { makeCartItem } from "@/__tests__/fixtures";
import {
  removeFromCart as mockRemoveFromCart,
  updateCartItem as mockUpdateCartItem,
  getCart as mockGetCart,
} from "@/lib/actions/cart";

jest.mock("@/lib/actions/cart", () => ({
  getCart: jest.fn(),
  addToCart: jest.fn(),
  updateCartItem: jest.fn(),
  removeFromCart: jest.fn(),
  applyCoupon: jest.fn(),
  removeCoupon: jest.fn(),
}));

describe("CartClearer component", () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    (mockGetCart as jest.Mock).mockResolvedValue({
      cart: null,
      cartToken: "main-cart-token",
    });
    (mockUpdateCartItem as jest.Mock).mockResolvedValue({
      cart: null,
      cartToken: "main-cart-token",
    });
    (mockRemoveFromCart as jest.Mock).mockResolvedValue({
      cart: null,
      cartToken: "main-cart-token",
    });

    useCartStore.setState({
      cart: {
        items: [
          makeCartItem({
            key: "item-101",
            id: 101,
            name: "Main Cart Product A",
            quantity: 3,
          }),
          makeCartItem({
            key: "item-102",
            id: 102,
            name: "Main Cart Product B",
            quantity: 1,
          }),
        ],
        items_count: 4,
        items_weight: 0,
        coupons: [],
        totals: {
          total_items: "5000",
          total_items_tax: "0",
          total_shipping: "0",
          total_shipping_tax: "0",
          total_discount: "0",
          total_discount_tax: "0",
          total_tax: "0",
          total_price: "5000",
          currency_code: "USD",
          currency_symbol: "$",
          currency_minor_unit: 2,
          currency_prefix: "$",
          currency_suffix: "",
        },
        shipping_rates: [],
        needs_payment: true,
        needs_shipping: false,
        payment_methods: ["cod"],
      },
      cartToken: "main-cart-token",
      itemCount: 4,
      _initialized: true,
    });
  });

  it("clears entire main cart when isBuyNow is false / omitted", async () => {
    render(<CartClearer />);

    await waitFor(() => {
      expect(useCartStore.getState().cart).toBeNull();
      expect(useCartStore.getState().itemCount).toBe(0);
    });
  });

  it("decrements cart item quantity when regular cart quantity > purchased quantity", async () => {
    // Buy Now order was placed for Product 101 with quantity: 1
    useBuyNowStore.setState({
      buyNowCart: {
        items: [
          makeCartItem({
            key: "buynow-1",
            id: 101,
            name: "Main Cart Product A",
            quantity: 1,
          }),
        ],
        items_count: 1,
        items_weight: 0,
        coupons: [],
        totals: {
          total_items: "1500",
          total_items_tax: "0",
          total_shipping: "0",
          total_shipping_tax: "0",
          total_discount: "0",
          total_discount_tax: "0",
          total_tax: "0",
          total_price: "1500",
          currency_code: "USD",
          currency_symbol: "$",
          currency_minor_unit: 2,
          currency_prefix: "$",
          currency_suffix: "",
        },
        shipping_rates: [],
        needs_payment: true,
        needs_shipping: false,
        payment_methods: ["cod"],
      },
      buyNowToken: "buynow-token",
    });

    render(<CartClearer isBuyNow={true} />);

    await waitFor(() => {
      // Product 101 had quantity 3 in regular cart, purchased quantity was 1 -> updateItem with quantity 2
      expect(mockUpdateCartItem).toHaveBeenCalledWith("item-101", 2, expect.anything(), undefined);
      // Buy now store should be cleared
      expect(useBuyNowStore.getState().buyNowCart).toBeNull();
    });
  });

  it("removes item from regular cart when regular cart quantity equals purchased quantity", async () => {
    // Buy Now order was placed for Product 102 with quantity: 1 (regular cart also has qty: 1)
    useBuyNowStore.setState({
      buyNowCart: {
        items: [
          makeCartItem({
            key: "buynow-2",
            id: 102,
            name: "Main Cart Product B",
            quantity: 1,
          }),
        ],
        items_count: 1,
        items_weight: 0,
        coupons: [],
        totals: {
          total_items: "1500",
          total_items_tax: "0",
          total_shipping: "0",
          total_shipping_tax: "0",
          total_discount: "0",
          total_discount_tax: "0",
          total_tax: "0",
          total_price: "1500",
          currency_code: "USD",
          currency_symbol: "$",
          currency_minor_unit: 2,
          currency_prefix: "$",
          currency_suffix: "",
        },
        shipping_rates: [],
        needs_payment: true,
        needs_shipping: false,
        payment_methods: ["cod"],
      },
      buyNowToken: "buynow-token",
    });

    render(<CartClearer isBuyNow={true} />);

    await waitFor(() => {
      // Product 102 had quantity 1 -> removeItem
      expect(mockRemoveFromCart).toHaveBeenCalledWith("item-102", expect.anything(), undefined);
      // Buy now store should be cleared
      expect(useBuyNowStore.getState().buyNowCart).toBeNull();
    });
  });
});
