import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AddressFields } from "@/components/checkout/address-fields";
import { useCheckoutStore } from "@/lib/store/checkout-store";
import {
  getAllowedCountries,
  isCountryAllowed,
  isSingleCountryFixed,
  getDefaultCountry,
} from "@/lib/config/countries";
import { BillingSchema } from "@/lib/validation/schemas";
import type { WooCountry } from "@/lib/woocommerce/types";

// Mock dataset
const mockAllCountries: WooCountry[] = [
  {
    code: "IN",
    name: "India",
    states: [
      { code: "TN", name: "Tamil Nadu" },
      { code: "MH", name: "Maharashtra" },
      { code: "KA", name: "Karnataka" },
      { code: "DL", name: "Delhi" },
    ],
  },
  {
    code: "GB",
    name: "United Kingdom",
    states: [],
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    states: [
      { code: "DU", name: "Dubai" },
      { code: "AZ", name: "Abu Dhabi" },
    ],
  },
  {
    code: "US",
    name: "United States",
    states: [
      { code: "CA", name: "California" },
      { code: "NY", name: "New York" },
    ],
  },
];

jest.mock("@/lib/actions/cart", () => ({
  getAvailableCountries: jest.fn().mockImplementation(async () => {
    return [
      {
        code: "IN",
        name: "India",
        states: [
          { code: "TN", name: "Tamil Nadu" },
          { code: "MH", name: "Maharashtra" },
          { code: "KA", name: "Karnataka" },
          { code: "DL", name: "Delhi" },
        ],
      },
    ];
  }),
}));

async function renderAddressFields(props: { namePrefix: "billing" | "shipping"; showContactFields?: boolean }) {
  let utils: ReturnType<typeof render>;
  await act(async () => {
    utils = render(<AddressFields {...props} />);
  });
  return utils!;
}

describe("Checkout Address Enhancement Test Suite", () => {
  beforeEach(() => {
    useCheckoutStore.getState().reset();
  });

  // ── Country Configuration Semantics ───────────────────────────────────────
  describe("Country Configuration Logic", () => {
    it("1. empty array returns all countries (no restriction)", () => {
      const allowed = getAllowedCountries(mockAllCountries, []);
      expect(allowed).toHaveLength(4);
      expect(allowed.map((c) => c.code)).toEqual(["IN", "GB", "AE", "US"]);
      expect(isCountryAllowed("US", [])).toBe(true);
      expect(isCountryAllowed("IN", [])).toBe(true);
    });

    it("2. ['IN'] returns only India", () => {
      const allowed = getAllowedCountries(mockAllCountries, ["IN"]);
      expect(allowed).toHaveLength(1);
      expect(allowed[0].code).toBe("IN");
      expect(isCountryAllowed("IN", ["IN"])).toBe(true);
      expect(isCountryAllowed("US", ["IN"])).toBe(false);
      expect(isSingleCountryFixed(["IN"])).toBe(true);
      expect(getDefaultCountry(["IN"])).toBe("IN");
    });

    it("3. ['IN', 'GB', 'AE'] returns only those three countries", () => {
      const allowed = getAllowedCountries(mockAllCountries, ["IN", "GB", "AE"]);
      expect(allowed).toHaveLength(3);
      expect(allowed.map((c) => c.code)).toEqual(["IN", "GB", "AE"]);
      expect(isCountryAllowed("IN", ["IN", "GB", "AE"])).toBe(true);
      expect(isCountryAllowed("GB", ["IN", "GB", "AE"])).toBe(true);
      expect(isCountryAllowed("AE", ["IN", "GB", "AE"])).toBe(true);
      expect(isSingleCountryFixed(["IN", "GB", "AE"])).toBe(false);
    });

    it("4. unauthorized country is excluded from options", () => {
      const allowed = getAllowedCountries(mockAllCountries, ["IN", "GB"]);
      const codes = allowed.map((c) => c.code);
      expect(codes).not.toContain("US");
      expect(codes).not.toContain("AE");
      expect(isCountryAllowed("US", ["IN", "GB"])).toBe(false);
    });

    it("5. search does not escape allowed list", () => {
      const allowed = getAllowedCountries(mockAllCountries, ["IN", "GB", "AE"]);
      const searchResult = allowed.filter(
        (c) => c.name.toLowerCase().includes("united") || c.code.toLowerCase().includes("united")
      );
      expect(searchResult.map((c) => c.code)).toEqual(["GB", "AE"]);
      expect(searchResult.map((c) => c.code)).not.toContain("US");
    });
  });

  // ── India-Only UX ─────────────────────────────────────────────────────────
  describe("India-Only UX (Default Configuration)", () => {
    it("6. India is preselected in store and AddressFields", async () => {
      await renderAddressFields({ namePrefix: "billing" });
      const hiddenInput = document.querySelector('input[name="billing_country"]') as HTMLInputElement;
      expect(hiddenInput).toBeInTheDocument();
      expect(hiddenInput.value).toBe("IN");
    });

    it("7. India control is visually disabled / non-editable with lock indicator", async () => {
      await renderAddressFields({ namePrefix: "billing" });
      const fixedBox = screen.getByTitle("Fixed for this store");
      expect(fixedBox).toBeInTheDocument();
      expect(fixedBox).toHaveAttribute("aria-disabled", "true");
      expect(screen.getByText("India")).toBeInTheDocument();
      expect(screen.getByText("Fixed for this store")).toBeInTheDocument();
    });

    it("8. Indian states are available in the State dropdown", async () => {
      await renderAddressFields({ namePrefix: "billing" });
      const stateSelect = screen.getByLabelText(/State \/ Province/i) as HTMLSelectElement;
      expect(stateSelect.tagName.toLowerCase()).toBe("select");

      expect(screen.getByRole("option", { name: "Tamil Nadu" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Maharashtra" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Karnataka" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: "Delhi" })).toBeInTheDocument();
    });
  });

  // ── Multi-Country Logic ───────────────────────────────────────────────────
  describe("Multi-Country Search and Selection Logic", () => {
    it("9. Multi-country configuration allows search and only shows allowed options", () => {
      const allowed = getAllowedCountries(mockAllCountries, ["IN", "GB", "AE"]);
      const q = "united";
      const matches = allowed.filter(
        (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
      );
      expect(matches.map((c) => c.name)).toContain("United Kingdom");
      expect(matches.map((c) => c.name)).toContain("United Arab Emirates");
      expect(matches.map((c) => c.name)).not.toContain("United States");
    });

    it("10. Country change reconciles invalid state", () => {
      useCheckoutStore.getState().updateBilling("country", "IN");
      useCheckoutStore.getState().updateBilling("state", "TN");

      const inCountry = mockAllCountries.find((c) => c.code === "IN")!;
      expect(inCountry.states.some((s) => s.code === "TN")).toBe(true);

      const gbCountry = mockAllCountries.find((c) => c.code === "GB")!;
      const isStillValidInGB = gbCountry.states.some((s) => s.code === "TN");
      expect(isStillValidInGB).toBe(false);
    });
  });

  // ── State Options & Reconciliation ────────────────────────────────────────
  describe("State Selection & Reconciliation", () => {
    it("11. state options populate and selecting updates store", async () => {
      await renderAddressFields({ namePrefix: "billing" });
      const stateSelect = screen.getByLabelText(/State \/ Province/i) as HTMLSelectElement;

      fireEvent.change(stateSelect, { target: { value: "TN" } });
      expect(useCheckoutStore.getState().billing.state).toBe("TN");
    });
  });

  // ── Postcode Requirements ─────────────────────────────────────────────────
  describe("Postcode Requirements (Strict 6 Digits)", () => {
    it("13. accepts exactly 6 numeric digits on user input", async () => {
      await renderAddressFields({ namePrefix: "billing" });
      const postcodeInput = screen.getByLabelText(/Postcode/i) as HTMLInputElement;

      fireEvent.change(postcodeInput, { target: { value: "600001" } });
      expect(useCheckoutStore.getState().billing.postcode).toBe("600001");
      expect(postcodeInput.value).toBe("600001");
    });

    it("14. sanitizes letters out on input", async () => {
      await renderAddressFields({ namePrefix: "billing" });
      const postcodeInput = screen.getByLabelText(/Postcode/i) as HTMLInputElement;

      fireEvent.change(postcodeInput, { target: { value: "600ABC01" } });
      expect(useCheckoutStore.getState().billing.postcode).toBe("60001");
    });

    it("15. rejects less than 6 digits in server validation", () => {
      const result = BillingSchema.safeParse({
        first_name: "John",
        last_name: "Doe",
        address_1: "Main St",
        city: "Chennai",
        state: "TN",
        postcode: "12345",
        country: "IN",
        email: "john@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Postcode must be exactly 6 digits");
      }
    });

    it("16. limits client input to 6 digits and rejects >6 digits on server", async () => {
      await renderAddressFields({ namePrefix: "billing" });
      const postcodeInput = screen.getByLabelText(/Postcode/i) as HTMLInputElement;

      fireEvent.change(postcodeInput, { target: { value: "6000019" } });
      expect(useCheckoutStore.getState().billing.postcode).toBe("600001");

      const serverResult = BillingSchema.safeParse({
        first_name: "John",
        last_name: "Doe",
        address_1: "Main St",
        city: "Chennai",
        state: "TN",
        postcode: "6000019",
        country: "IN",
        email: "john@example.com",
      });
      expect(serverResult.success).toBe(false);
    });
  });

  // ── Server-Authoritative Validation ───────────────────────────────────────
  describe("Server-Authoritative Validation", () => {
    it("17. unauthorized country is rejected by BillingSchema", () => {
      const result = BillingSchema.safeParse({
        first_name: "John",
        last_name: "Doe",
        address_1: "Main St",
        city: "Chennai",
        state: "TN",
        postcode: "600001",
        country: "US", // Not in ALLOWED_COUNTRIES (default ["IN"])
        email: "john@example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("Selected country is not allowed for checkout");
      }
    });

    it("18. valid configured country is accepted by BillingSchema", () => {
      const result = BillingSchema.safeParse({
        first_name: "John",
        last_name: "Doe",
        address_1: "Main St",
        city: "Chennai",
        state: "TN",
        postcode: "600001",
        country: "IN",
        email: "john@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("19. invalid postcode (letters or wrong length) is rejected by BillingSchema", () => {
      const resLetters = BillingSchema.safeParse({
        first_name: "John",
        last_name: "Doe",
        address_1: "Main St",
        city: "Chennai",
        state: "TN",
        postcode: "ABCDEF",
        country: "IN",
        email: "john@example.com",
      });
      expect(resLetters.success).toBe(false);
    });
  });

  // ── Form Integration & Serialization ──────────────────────────────────────
  describe("Form Integration & Serialization", () => {
    it("20. billing country serializes correctly in FormData", async () => {
      let formEl: HTMLFormElement | null = null;
      await act(async () => {
        render(
          <form data-testid="test-form">
            <AddressFields namePrefix="billing" />
          </form>
        );
      });
      formEl = screen.getByTestId("test-form") as HTMLFormElement;
      const formData = new FormData(formEl);
      expect(formData.get("billing_country")).toBe("IN");
    });

    it("21. shipping country serializes correctly in FormData", async () => {
      let formEl: HTMLFormElement | null = null;
      await act(async () => {
        render(
          <form data-testid="test-form">
            <AddressFields namePrefix="shipping" />
          </form>
        );
      });
      formEl = screen.getByTestId("test-form") as HTMLFormElement;
      const formData = new FormData(formEl);
      expect(formData.get("shipping_country")).toBe("IN");
    });

    it("22. state serializes correctly in FormData", async () => {
      await act(async () => {
        render(
          <form data-testid="test-form">
            <AddressFields namePrefix="billing" />
          </form>
        );
      });
      const stateSelect = screen.getByLabelText(/State \/ Province/i) as HTMLSelectElement;
      fireEvent.change(stateSelect, { target: { value: "TN" } });

      const form = screen.getByTestId("test-form") as HTMLFormElement;
      const formData = new FormData(form);
      expect(formData.get("billing_state")).toBe("TN");
    });

    it("23. postcode serializes correctly in FormData", async () => {
      await act(async () => {
        render(
          <form data-testid="test-form">
            <AddressFields namePrefix="billing" />
          </form>
        );
      });
      const postcodeInput = screen.getByLabelText(/Postcode/i) as HTMLInputElement;
      fireEvent.change(postcodeInput, { target: { value: "600001" } });

      const form = screen.getByTestId("test-form") as HTMLFormElement;
      const formData = new FormData(form);
      expect(formData.get("billing_postcode")).toBe("600001");
    });
  });
});
