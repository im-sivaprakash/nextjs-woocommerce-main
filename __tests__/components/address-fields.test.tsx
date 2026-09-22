import { render, screen, fireEvent } from "@testing-library/react";
import { AddressFields } from "@/components/checkout/address-fields";
import { useCheckoutStore } from "@/lib/store/checkout-store";
import { BillingSchema, ShippingSchema } from "@/lib/validation/schemas";
import type { WooCountry } from "@/lib/woocommerce/types";

const mockCountries: WooCountry[] = [
  {
    code: "IN",
    name: "India",
    states: [
      { code: "TN", name: "Tamil Nadu" },
      { code: "KA", name: "Karnataka" },
      { code: "MH", name: "Maharashtra" },
    ],
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    states: [],
  },
  {
    code: "US",
    name: "United States (US)",
    states: [
      { code: "CA", name: "California" },
      { code: "NY", name: "New York" },
    ],
  },
];

describe("AddressFields Component — Searchable Country Combobox", () => {
  beforeEach(() => {
    useCheckoutStore.getState().reset();
  });

  it("renders with India (IN) as default selected country with flag emoji", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    expect(countryControl).toBeInTheDocument();
    expect(countryControl).toHaveTextContent("🇮🇳");
    expect(countryControl).toHaveTextContent("India");
    expect(useCheckoutStore.getState().billing.country).toBe("IN");
  });

  it("renders country options with flag emojis when opened", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(countryControl);

    expect(screen.getByRole("option", { name: /india/i })).toHaveTextContent("🇮🇳");
    expect(screen.getByRole("option", { name: /united arab emirates/i })).toHaveTextContent("🇦🇪");
    expect(screen.getByRole("option", { name: /united states/i })).toHaveTextContent("🇺🇸");
  });

  it("filters countries by partial name (case-insensitive)", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(countryControl);

    const searchInput = screen.getByPlaceholderText(/search country/i);
    fireEvent.change(searchInput, { target: { value: "arab" } });

    expect(screen.getByRole("option", { name: /united arab emirates/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /india/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /united states/i })).not.toBeInTheDocument();
  });

  it("filters countries by ISO country code (case-insensitive)", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(countryControl);

    const searchInput = screen.getByPlaceholderText(/search country/i);
    // Search "ae" (lowercase) -> matches United Arab Emirates (AE)
    fireEvent.change(searchInput, { target: { value: "ae" } });

    expect(screen.getByRole("option", { name: /united arab emirates/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /india/i })).not.toBeInTheDocument();
  });

  it("shows no-result empty state when query does not match any country", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(countryControl);

    const searchInput = screen.getByPlaceholderText(/search country/i);
    fireEvent.change(searchInput, { target: { value: "xyznotacountry" } });

    expect(screen.getByText(/no countries found/i)).toBeInTheDocument();
  });

  it("does not mutate selected country while typing in search box", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(countryControl);

    const searchInput = screen.getByPlaceholderText(/search country/i);
    fireEvent.change(searchInput, { target: { value: "united" } });

    // Store value MUST remain "IN"
    expect(useCheckoutStore.getState().billing.country).toBe("IN");
    expect(countryControl).toHaveTextContent("India");
  });

  it("preserves current selection when closing popup with Escape", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(countryControl);

    const searchInput = screen.getByPlaceholderText(/search country/i);
    fireEvent.change(searchInput, { target: { value: "united" } });

    // Press Escape
    fireEvent.keyDown(searchInput, { key: "Escape" });

    // Popup closed, selected country remains India
    expect(screen.queryByPlaceholderText(/search country/i)).not.toBeInTheDocument();
    expect(useCheckoutStore.getState().billing.country).toBe("IN");
    expect(countryControl).toHaveTextContent("India");
  });

  it("renders state dropdown when selected country has states", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    // Since default country is IN, state dropdown should be present
    const stateSelect = screen.getByRole("combobox", { name: /state/i }) as HTMLSelectElement;
    expect(stateSelect).toBeInTheDocument();
    expect(stateSelect.tagName).toBe("SELECT");
    expect(stateSelect).toHaveTextContent("Tamil Nadu");
    expect(stateSelect).toHaveTextContent("Karnataka");
    expect(stateSelect).toHaveTextContent("Maharashtra");
  });

  it("resets state and falls back to text input when switching to a country with zero states (UAE)", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);

    // 1. Select Tamil Nadu (TN)
    const stateSelect = screen.getByRole("combobox", { name: /state/i }) as HTMLSelectElement;
    fireEvent.change(stateSelect, { target: { value: "TN" } });
    expect(useCheckoutStore.getState().billing.state).toBe("TN");

    // 2. Open country combobox and select United Arab Emirates (AE)
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(countryControl);
    const uaeOption = screen.getByRole("option", { name: /united arab emirates/i });
    fireEvent.click(uaeOption);

    // 3. Country in store should be updated to "AE"
    expect(useCheckoutStore.getState().billing.country).toBe("AE");

    // 4. Stale state should be reset to "" in store
    expect(useCheckoutStore.getState().billing.state).toBe("");

    // 5. State control should now be a plain text Input, NOT a select combobox
    const stateInput = screen.getByLabelText(/state/i) as HTMLInputElement;
    expect(stateInput.tagName).toBe("INPUT");
    expect(stateInput.type).toBe("text");
    expect(stateInput.value).toBe("");

    // 6. User can type free-text (e.g. Dubai) into fallback input
    fireEvent.change(stateInput, { target: { value: "Dubai" } });
    expect(useCheckoutStore.getState().billing.state).toBe("Dubai");
  });

  it("enforces 6-digit numeric input on postcode field", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const postcodeInput = screen.getByLabelText(/postcode/i) as HTMLInputElement;

    // Type letters: should be stripped
    fireEvent.change(postcodeInput, { target: { value: "ABC" } });
    expect(useCheckoutStore.getState().billing.postcode).toBe("");

    // Type 6 digits: should be accepted
    fireEvent.change(postcodeInput, { target: { value: "600001" } });
    expect(useCheckoutStore.getState().billing.postcode).toBe("600001");

    // Type more than 6 digits: should be truncated to 6 digits
    fireEvent.change(postcodeInput, { target: { value: "600001999" } });
    expect(useCheckoutStore.getState().billing.postcode).toBe("600001");
  });

  it("works identically and independently for shipping address prefix", () => {
    render(<AddressFields namePrefix="shipping" countries={mockCountries} />);
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    expect(countryControl).toBeInTheDocument();
    expect(countryControl.id).toBe("shipping_country");

    // Change shipping country to US
    fireEvent.click(countryControl);
    const usOption = screen.getByRole("option", { name: /united states/i });
    fireEvent.click(usOption);

    expect(useCheckoutStore.getState().shipping.country).toBe("US");
    // Billing country remains unaffected
    expect(useCheckoutStore.getState().billing.country).toBe("IN");

    const postcodeInput = screen.getByLabelText(/postcode/i) as HTMLInputElement;
    expect(postcodeInput.id).toBe("shipping_postcode");

    fireEvent.change(postcodeInput, { target: { value: "560001" } });
    expect(useCheckoutStore.getState().shipping.postcode).toBe("560001");
  });

  it("does NOT reset state when re-selecting or confirming the same country", () => {
    render(<AddressFields namePrefix="shipping" countries={mockCountries} />);

    // 1. Select Tamil Nadu (TN)
    const stateSelect = screen.getByRole("combobox", { name: /state/i }) as HTMLSelectElement;
    fireEvent.change(stateSelect, { target: { value: "TN" } });
    expect(useCheckoutStore.getState().shipping.state).toBe("TN");

    // 2. Open country combobox and click India again (same country)
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    fireEvent.click(countryControl);
    const indiaOption = screen.getByRole("option", { name: /india/i });
    fireEvent.click(indiaOption);

    // 3. State should STILL be Tamil Nadu (TN), NOT reset to ""
    expect(useCheckoutStore.getState().shipping.state).toBe("TN");
    expect(stateSelect.value).toBe("TN");
  });

  it("serializes selected country and state into FormData for form submission", () => {
    const { container } = render(
      <form data-testid="checkout-form">
        <AddressFields namePrefix="billing" countries={mockCountries} />
        <AddressFields namePrefix="shipping" countries={mockCountries} />
      </form>
    );

    // Set billing state to Maharashtra (MH)
    const billingState = container.querySelector("#billing_state") as HTMLSelectElement;
    fireEvent.change(billingState, { target: { value: "MH" } });

    // Set shipping state to Tamil Nadu (TN)
    const shippingState = container.querySelector("#shipping_state") as HTMLSelectElement;
    fireEvent.change(shippingState, { target: { value: "TN" } });

    const form = container.querySelector("form")!;
    const formData = new FormData(form);

    // Both country fields MUST be present in FormData as "IN"
    expect(formData.get("billing_country")).toBe("IN");
    expect(formData.get("shipping_country")).toBe("IN");

    // Both state fields MUST be present in FormData
    expect(formData.get("billing_state")).toBe("MH");
    expect(formData.get("shipping_state")).toBe("TN");
  });

  it("ensures FormData passes BillingSchema and ShippingSchema without 'Country is required' error", () => {
    const { container } = render(
      <form data-testid="checkout-form">
        <AddressFields namePrefix="billing" showContactFields countries={mockCountries} />
        <AddressFields namePrefix="shipping" countries={mockCountries} />
      </form>
    );

    // Fill billing required fields
    fireEvent.change(container.querySelector("#billing_first_name")!, { target: { value: "Jane" } });
    fireEvent.change(container.querySelector("#billing_last_name")!, { target: { value: "Doe" } });
    fireEvent.change(container.querySelector("#billing_address_1")!, { target: { value: "123 Anna Salai" } });
    fireEvent.change(container.querySelector("#billing_city")!, { target: { value: "Chennai" } });
    fireEvent.change(container.querySelector("#billing_state")!, { target: { value: "TN" } });
    fireEvent.change(container.querySelector("#billing_postcode")!, { target: { value: "600001" } });
    fireEvent.change(container.querySelector("#billing_email")!, { target: { value: "jane@example.com" } });
    fireEvent.change(container.querySelector("#billing_phone")!, { target: { value: "+91 98765 43210" } });

    // Fill shipping required fields
    fireEvent.change(container.querySelector("#shipping_first_name")!, { target: { value: "Jane" } });
    fireEvent.change(container.querySelector("#shipping_last_name")!, { target: { value: "Doe" } });
    fireEvent.change(container.querySelector("#shipping_address_1")!, { target: { value: "oddanchatram main road" } });
    fireEvent.change(container.querySelector("#shipping_city")!, { target: { value: "oddanchatram" } });
    fireEvent.change(container.querySelector("#shipping_state")!, { target: { value: "TN" } });
    fireEvent.change(container.querySelector("#shipping_postcode")!, { target: { value: "624622" } });

    const form = container.querySelector("form")!;
    const formData = new FormData(form);
    const g = (key: string) => String(formData.get(key) ?? "");

    const rawBilling = {
      first_name: g("billing_first_name"),
      last_name: g("billing_last_name"),
      company: g("billing_company"),
      address_1: g("billing_address_1"),
      address_2: g("billing_address_2"),
      city: g("billing_city"),
      state: g("billing_state"),
      postcode: g("billing_postcode"),
      country: g("billing_country"),
      email: g("billing_email"),
      phone: g("billing_phone"),
    };

    const rawShipping = {
      first_name: g("shipping_first_name"),
      last_name: g("shipping_last_name"),
      company: g("shipping_company"),
      address_1: g("shipping_address_1"),
      address_2: g("shipping_address_2"),
      city: g("shipping_city"),
      state: g("shipping_state"),
      postcode: g("shipping_postcode"),
      country: g("shipping_country"),
    };

    const billingResult = BillingSchema.safeParse(rawBilling);
    expect(billingResult.success).toBe(true);
    if (billingResult.success) {
      expect(billingResult.data.country).toBe("IN");
      expect(billingResult.data.state).toBe("TN");
    }

    const shippingResult = ShippingSchema.safeParse(rawShipping);
    expect(shippingResult.success).toBe(true);
    if (shippingResult.success) {
      expect(shippingResult.data.country).toBe("IN");
      expect(shippingResult.data.state).toBe("TN");
      expect(shippingResult.data.postcode).toBe("624622");
    }
  });

  it("applies theme-safe and cross-browser attributes to state selector and options", () => {
    const { container } = render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const select = container.querySelector("#billing_state");
    expect(select).toBeInTheDocument();
    expect(select).toHaveClass("[color-scheme:light]");
    expect(select).toHaveClass("dark:[color-scheme:dark]");

    const options = select?.querySelectorAll("option");
    expect(options && options.length).toBeGreaterThan(1);
    options?.forEach((opt) => {
      expect(opt).toHaveClass("dark:bg-zinc-900");
      expect(opt).toHaveClass("dark:text-zinc-100");
    });
  });

  it("applies Twemoji font class to country flag emoji for cross-browser visual rendering", () => {
    render(<AddressFields namePrefix="billing" countries={mockCountries} />);
    const countryControl = screen.getByRole("combobox", { name: /country/i });
    const flagSpan = countryControl.querySelector("span[aria-hidden='true']");
    expect(flagSpan).toBeInTheDocument();
    expect(flagSpan?.className).toContain("Twemoji_Country_Flags");
  });
});
