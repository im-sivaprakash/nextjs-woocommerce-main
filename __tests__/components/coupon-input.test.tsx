import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CouponInput } from "@/components/checkout/coupon-input";
import { useCartStore } from "@/lib/store/cart-store";
import { toast } from "sonner";
import { t } from "@/lib/i18n";

jest.mock("@/lib/store/cart-store", () => ({
  useCartStore: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const mockApplyCoupon = jest.fn();
const mockRemoveCoupon = jest.fn();

function setupCartStore(overrides = {}) {
  const defaultState = {
    cart: {
      items: [],
      items_count: 1,
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
    },
    isPending: false,
    applyCoupon: mockApplyCoupon,
    removeCoupon: mockRemoveCoupon,
    ...overrides,
  };

  (useCartStore as unknown as jest.Mock).mockReturnValue(defaultState);
}

describe("CouponInput Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupCartStore();
  });

  it("renders coupon input and apply button", () => {
    render(<CouponInput />);
    expect(screen.getByPlaceholderText(t("coupon.placeholder"))).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t("coupon.apply") })).toBeInTheDocument();
  });

  it("disables apply button when input is empty", () => {
    render(<CouponInput />);
    const applyBtn = screen.getByRole("button", { name: t("coupon.apply") });
    expect(applyBtn).toBeDisabled();
  });

  it("applies coupon successfully on button click", async () => {
    mockApplyCoupon.mockResolvedValueOnce({ error: undefined });
    render(<CouponInput />);

    const input = screen.getByPlaceholderText(t("coupon.placeholder"));
    fireEvent.change(input, { target: { value: "DISCOUNT10" } });

    const applyBtn = screen.getByRole("button", { name: t("coupon.apply") });
    expect(applyBtn).not.toBeDisabled();
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockApplyCoupon).toHaveBeenCalledWith("DISCOUNT10");
      expect(toast.success).toHaveBeenCalledWith(t("coupon.applied"));
    });
  });

  it("shows error toast when applyCoupon returns an error", async () => {
    mockApplyCoupon.mockResolvedValueOnce({ error: "Coupon 'INVALID' does not exist!" });
    render(<CouponInput />);

    const input = screen.getByPlaceholderText(t("coupon.placeholder"));
    fireEvent.change(input, { target: { value: "INVALID" } });

    const applyBtn = screen.getByRole("button", { name: t("coupon.apply") });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(mockApplyCoupon).toHaveBeenCalledWith("INVALID");
      expect(toast.error).toHaveBeenCalledWith("Coupon 'INVALID' does not exist!");
    });
  });

  it("renders applied coupons list and handles removal", async () => {
    mockRemoveCoupon.mockResolvedValueOnce({ error: undefined });
    setupCartStore({
      cart: {
        coupons: [
          {
            code: "save20",
            discount_type: "percent",
            totals: {
              total_discount: "2000",
              total_discount_tax: "0",
              currency_code: "USD",
              currency_symbol: "$",
              currency_minor_unit: 2,
              currency_prefix: "$",
              currency_suffix: "",
            },
          },
        ],
        totals: {
          currency_minor_unit: 2,
          currency_prefix: "$",
          currency_suffix: "",
        },
      },
    });

    render(<CouponInput />);

    expect(screen.getByText("save20")).toBeInTheDocument();
    expect(screen.getByText(/20\.00/)).toBeInTheDocument();

    const removeBtn = screen.getByRole("button", { name: `${t("coupon.remove")} save20` });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockRemoveCoupon).toHaveBeenCalledWith("save20");
      expect(toast.success).toHaveBeenCalledWith(t("coupon.removed"));
    });
  });
});
