/**
 * ProductCard component tests.
 *
 * Heavy dependencies (next/image, next/link, GTM events, wishlist store) are
 * mocked so the test suite stays fast and deterministic.
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProductCard } from "@/components/product-card";
import { useCartStore } from "@/lib/store/cart-store";
import { makeProduct } from "../fixtures";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAddItem = jest.fn();
const mockOpenCart = jest.fn();
jest.mock("@/lib/store/cart-store", () => ({
  useCartStore: jest.fn(() => ({
    addItem: mockAddItem,
    openCart: mockOpenCart,
  })),
}));

const mockStartBuyNow = jest.fn();
jest.mock("@/lib/store/buy-now-store", () => ({
  useBuyNowStore: {
    getState: () => ({
      startBuyNow: mockStartBuyNow,
    }),
  },
}));

jest.mock("next/image", () => ({
  __esModule: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: (props: any) => {
    const { fill, ...rest } = props; // biome-ignore lint: test mock
    void fill;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={rest.alt ?? ""} {...rest} />;
  },
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: React.PropsWithChildren<{ href: string; [key: string]: unknown }>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/lib/utils/gtm-events", () => ({
  trackSelectItem: jest.fn(),
  trackAddToCart: jest.fn(),
}));

jest.mock("@/lib/store/wishlist-store", () => ({
  useWishlistStore: jest.fn((selector: (state: { _hasHydrated: boolean; items: unknown[]; toggle: jest.Mock }) => unknown) =>
    selector({ _hasHydrated: false, items: [], toggle: jest.fn() })
  ),
}));

jest.mock("sonner", () => ({ toast: Object.assign(jest.fn(), { error: jest.fn() }) }));

beforeEach(() => {
  jest.clearAllMocks();
  mockAddItem.mockResolvedValue({ error: undefined });
  (useCartStore as unknown as jest.Mock).mockReturnValue({
    addItem: mockAddItem,
    openCart: mockOpenCart,
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ProductCard", () => {
  it("renders the product name", () => {
    render(<ProductCard product={makeProduct({ name: "Amber Musk" })} />);
    expect(screen.getByText("Amber Musk")).toBeInTheDocument();
  });

  it("renders the product category", () => {
    render(
      <ProductCard
        product={makeProduct({
          categories: [{ id: 1, name: "Fragrance", slug: "fragrance" }],
        })}
      />
    );
    expect(screen.getByText("Fragrance")).toBeInTheDocument();
  });

  it("renders the current price", () => {
    render(<ProductCard product={makeProduct()} />);
    // price = 2999 minor units → $29.99
    expect(screen.getByText("$29.99")).toBeInTheDocument();
  });

  it("renders both sale and regular price when on sale", () => {
    render(<ProductCard product={makeProduct({ on_sale: true })} />);
    expect(screen.getByText("$29.99")).toBeInTheDocument(); // current
    expect(screen.getByText("$39.99")).toBeInTheDocument(); // regular (strikethrough)
  });

  it("renders a Sale badge when on sale", () => {
    render(<ProductCard product={makeProduct({ on_sale: true })} />);
    expect(screen.getByText("Sale")).toBeInTheDocument();
  });

  it("does NOT render a Sale badge when not on sale", () => {
    render(
      <ProductCard
        product={makeProduct({
          on_sale: false,
          prices: {
            price: "3999",
            regular_price: "3999",
            sale_price: "",
            currency_code: "USD",
            currency_symbol: "$",
            currency_minor_unit: 2,
            currency_decimal_separator: ".",
            currency_thousand_separator: ",",
            currency_prefix: "$",
            currency_suffix: "",
            price_range: null,
          },
        })}
      />
    );
    expect(screen.queryByText("Sale")).not.toBeInTheDocument();
  });

  it("renders a Sold Out badge and disabled buttons when out of stock", () => {
    render(<ProductCard product={makeProduct({ is_in_stock: false })} />);
    expect(screen.getAllByText("Sold Out").length).toBeGreaterThan(0);
    const buttons = screen.getAllByRole("button");
    expect(buttons.some((b) => b.hasAttribute("disabled"))).toBe(true);
  });

  it("renders the product image with correct alt text", () => {
    render(
      <ProductCard
        product={makeProduct({
          images: [
            {
              id: 1,
              src: "https://example.com/img.jpg",
              thumbnail: "",
              srcset: "",
              sizes: "",
              name: "test",
              alt: "Beautiful perfume bottle",
            },
          ],
        })}
      />
    );
    expect(screen.getByAltText("Beautiful perfume bottle")).toBeInTheDocument();
  });

  it("renders a placeholder when there are no images", () => {
    render(<ProductCard product={makeProduct({ images: [] })} />);
    expect(screen.getByText("No image")).toBeInTheDocument();
  });

  it("links to the correct product URL", () => {
    render(<ProductCard product={makeProduct({ slug: "rose-oud" })} />);
    const links = screen.getAllByRole("link");
    expect(links.some((l) => l.getAttribute("href") === "/product/rose-oud")).toBe(true);
  });

  it("calls addItem and openCart when Add to Cart button is clicked", async () => {
    render(<ProductCard product={makeProduct({ id: 15 })} />);
    const addBtn = screen.getByRole("button", { name: /Add to Cart/i });
    fireEvent.click(addBtn);
    await waitFor(() => expect(mockAddItem).toHaveBeenCalledWith(15, 1));
    expect(mockOpenCart).toHaveBeenCalled();
  });

  it("calls startBuyNow and navigates to /checkout?buy_now=1 when Buy Now button is clicked", async () => {
    mockStartBuyNow.mockResolvedValue({ cart: {} });
    render(<ProductCard product={makeProduct({ id: 15 })} />);
    const buyNowBtn = screen.getByRole("button", { name: /Buy Now/i });
    fireEvent.click(buyNowBtn);
    await waitFor(() => expect(mockStartBuyNow).toHaveBeenCalledWith(15, 1));
    expect(mockPush).toHaveBeenCalledWith("/checkout?buy_now=1");
  });
});
