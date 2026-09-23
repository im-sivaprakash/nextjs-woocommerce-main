/**
 * Auth server actions and cart merge tests.
 */

// Mock external modules before imports
jest.mock("@/lib/auth/jwt-auth", () => ({
  loginUserOnServer: jest.fn(),
  loginWithGoogleOnServer: jest.fn(),
  registerUserOnServer: jest.fn(),
  revokeTokenOnServer: jest.fn(),
  resetPasswordOnServer: jest.fn(),
}));

jest.mock("@/lib/auth/session", () => ({
  setAuthCookies: jest.fn(),
  clearAuthCookies: jest.fn(),
  getAuthCookies: jest.fn(),
  getSessionUser: jest.fn(),
}));

jest.mock("@/lib/woocommerce/api", () => ({
  getCartFromServer: jest.fn(),
  addToCartOnServer: jest.fn(),
  extractCartToken: jest.fn(),
  extractNonce: jest.fn(),
}));

jest.mock("@/lib/woocommerce/persistent-cart", () => ({
  saveUserCart: jest.fn(),
  getUserCart: jest.fn(),
}));

import {
  loginWithGoogleOnServer as mockLoginWithGoogleOnServer,
} from "@/lib/auth/jwt-auth";
import { setAuthCookies as mockSetAuthCookies } from "@/lib/auth/session";
import {
  getCartFromServer as mockGetCartFromServer,
  addToCartOnServer as mockAddToCartOnServer,
  extractCartToken as mockExtractCartToken,
  extractNonce as mockExtractNonce,
} from "@/lib/woocommerce/api";
import {
  getUserCart as mockGetUserCart,
  saveUserCart as mockSaveUserCart,
} from "@/lib/woocommerce/persistent-cart";
import {
  googleLoginAction,
  mergeAndApplyCartOnLogin,
} from "@/lib/actions/auth";

describe("Google Auth Actions & Cart Merge", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (mockAddToCartOnServer as jest.Mock).mockResolvedValue({ ok: true });
  });

  describe("mergeAndApplyCartOnLogin", () => {
    it("merges guest cart with user persistent cart successfully", async () => {
      // Mock guest cart response
      const mockGuestCart = {
        items: [{ id: 10, quantity: 2 }],
      };
      (mockGetCartFromServer as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockGuestCart,
      });
      (mockExtractCartToken as jest.Mock).mockReturnValue("guest-cart-token-abc");
      (mockExtractNonce as jest.Mock).mockReturnValue("nonce-abc");

      // Mock user persistent cart
      (mockGetUserCart as jest.Mock).mockResolvedValueOnce({
        success: true,
        items: [{ id: 20, quantity: 1 }],
      });

      const result = await mergeAndApplyCartOnLogin(42, "initial-token");

      expect(mockSaveUserCart).toHaveBeenCalledWith(42, expect.arrayContaining([
        expect.objectContaining({ id: 10, quantity: 2 }),
        expect.objectContaining({ id: 20, quantity: 1 }),
      ]));
      expect(result.cartToken).toBe("guest-cart-token-abc");
    });
  });

  describe("googleLoginAction", () => {
    it("fails when idToken is missing or empty", async () => {
      const result = await googleLoginAction("");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Google ID token is required");
    });

    it("successfully exchanges idToken and sets auth cookies", async () => {
      const mockUser = {
        id: 42,
        email: "googleuser@example.com",
        username: "googleuser",
        displayName: "Google User",
        roles: ["customer"],
      };

      (mockLoginWithGoogleOnServer as jest.Mock).mockResolvedValueOnce({
        success: true,
        tokens: { jwt: "plugin-jwt-token", refreshToken: "refresh-xyz" },
        user: mockUser,
      });

      (mockGetUserCart as jest.Mock).mockResolvedValueOnce({
        success: true,
        items: [],
      });

      const result = await googleLoginAction("valid_google_id_token");

      expect(mockLoginWithGoogleOnServer).toHaveBeenCalledWith("valid_google_id_token");
      expect(mockSetAuthCookies).toHaveBeenCalledWith(
        { jwt: "plugin-jwt-token", refreshToken: "refresh-xyz" },
        mockUser
      );
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it("handles plugin OAuth rejection gracefully", async () => {
      (mockLoginWithGoogleOnServer as jest.Mock).mockResolvedValueOnce({
        success: false,
        message: "Google token verification failed",
      });

      const result = await googleLoginAction("invalid_token");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Google token verification failed");
    });
  });
});
