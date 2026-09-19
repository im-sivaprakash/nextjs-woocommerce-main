import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BillingAddress, ShippingAddress } from "@/lib/woocommerce/types";

const emptyBilling: BillingAddress = {
  first_name: "",
  last_name: "",
  company: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  postcode: "",
  country: "IN",
  email: "",
  phone: "",
};

const emptyShipping: ShippingAddress = {
  first_name: "",
  last_name: "",
  company: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  postcode: "",
  country: "IN",
};

interface CheckoutState {
  billing: BillingAddress;
  shipping: ShippingAddress;
  sameAsShipping: boolean;
  selectedPaymentMethod: string;
  updateBilling: (field: keyof BillingAddress, value: string) => void;
  updateShipping: (field: keyof ShippingAddress, value: string) => void;
  setSameAsShipping: (value: boolean) => void;
  setSelectedPaymentMethod: (method: string) => void;
  reset: () => void;
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set) => ({
      billing: { ...emptyBilling },
      shipping: { ...emptyShipping },
      sameAsShipping: true,
      selectedPaymentMethod: "",

      updateBilling: (field, value) =>
        set((state) => ({ billing: { ...state.billing, [field]: value } })),

      updateShipping: (field, value) =>
        set((state) => ({ shipping: { ...state.shipping, [field]: value } })),

      setSameAsShipping: (value) => set({ sameAsShipping: value }),

      setSelectedPaymentMethod: (method) => set({ selectedPaymentMethod: method }),

      reset: () =>
        set({
          billing: { ...emptyBilling },
          shipping: { ...emptyShipping },
          sameAsShipping: true,
          selectedPaymentMethod: "",
        }),
    }),
    {
      name: "checkout-store",
      version: 2,
      // Only persist data fields, not the action functions
      partialize: (state) => ({
        billing: state.billing,
        shipping: state.shipping,
        sameAsShipping: state.sameAsShipping,
        selectedPaymentMethod: state.selectedPaymentMethod,
      }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as CheckoutState;
        if (version < 2) {
          // If legacy state had "US" as default without a filled street address, migrate to "IN"
          if (state.billing?.country === "US" && !state.billing?.address_1) {
            state.billing.country = "IN";
            state.billing.state = "";
          }
          if (state.shipping?.country === "US" && !state.shipping?.address_1) {
            state.shipping.country = "IN";
            state.shipping.state = "";
          }
        }
        return state;
      },
    }
  )
);
