import { act } from "react";

// Mock server actions
jest.mock("@/lib/actions/auth", () => ({
  loginAction: jest.fn(),
  googleLoginAction: jest.fn(),
  registerAction: jest.fn(),
  logoutAction: jest.fn(),
  getAuthSessionAction: jest.fn(),
}));

import {
  loginAction as mockLoginAction,
  googleLoginAction as mockGoogleLoginAction,
  logoutAction as mockLogoutAction,
} from "@/lib/actions/auth";
import { useAuthStore } from "@/lib/store/auth-store";
import { useCartStore } from "@/lib/store/cart-store";
import type { AuthUser } from "@/lib/auth/types";

const mockUser: AuthUser = {
  id: "123",
  email: "test@example.com",
  username: "testuser",
  displayName: "Test User",
  roles: ["customer"],
};

describe("useAuthStore", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => {
      useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitialized: false,
      });
      useCartStore.setState({
        cart: null,
        cartToken: undefined,
        nonce: undefined,
      });
    });
    jest.clearAllMocks();
  });

  it("successfully performs googleLogin and sets user, tokens, and nonces", async () => {
    (mockGoogleLoginAction as jest.Mock).mockResolvedValueOnce({
      success: true,
      user: mockUser,
      cartToken: "new-cart-token-123",
      nonce: "new-cart-nonce-456",
    });

    let result;
    await act(async () => {
      result = await useAuthStore.getState().googleLogin("google_raw_id_token");
    });

    expect(result).toEqual({
      success: true,
      user: mockUser,
      cartToken: "new-cart-token-123",
      nonce: "new-cart-nonce-456",
    });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);

    expect(localStorage.getItem("cart-store")).toBe("new-cart-token-123");
    expect(localStorage.getItem("cart-nonce-store")).toBe("new-cart-nonce-456");
    expect(useCartStore.getState().cartToken).toBe("new-cart-token-123");
    expect(useCartStore.getState().nonce).toBe("new-cart-nonce-456");
  });

  it("handles googleLogin failure gracefully", async () => {
    (mockGoogleLoginAction as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: "Invalid Google token",
    });

    let result;
    await act(async () => {
      result = await useAuthStore.getState().googleLogin("bad_token");
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid Google token",
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  it("clears user and cart state on logout", async () => {
    act(() => {
      useAuthStore.setState({
        user: mockUser,
        isAuthenticated: true,
      });
      localStorage.setItem("cart-store", "token-xyz");
      localStorage.setItem("cart-nonce-store", "nonce-xyz");
    });

    (mockLogoutAction as jest.Mock).mockResolvedValueOnce({
      success: true,
      message: "Logged out successfully",
    });

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem("cart-store")).toBeNull();
    expect(localStorage.getItem("cart-nonce-store")).toBeNull();
  });
});
