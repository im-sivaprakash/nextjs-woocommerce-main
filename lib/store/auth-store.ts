import { create } from "zustand";
import type { AuthUser, AuthActionResult } from "@/lib/auth/types";
import type { LoginInput, RegisterInput } from "@/lib/validation/auth-schemas";
import {
  loginAction,
  googleLoginAction,
  registerAction,
  logoutAction,
  getAuthSessionAction,
} from "@/lib/actions/auth";
import { useCartStore } from "@/lib/store/cart-store";

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  /** Hydrate the session from server-side HttpOnly cookies on initial load */
  initAuth: () => Promise<void>;
  /** Login with email/username and password */
  login: (input: LoginInput) => Promise<AuthActionResult<AuthUser>>;
  /** Login with Google ID token */
  googleLogin: (idToken: string) => Promise<AuthActionResult<AuthUser>>;
  /** Register a new customer account */
  register: (input: RegisterInput) => Promise<AuthActionResult<AuthUser>>;
  /** Logout and clear session */
  logout: () => Promise<AuthActionResult>;
  /** Manually set or clear the authenticated user in store */
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  initAuth: async () => {
    // Avoid re-running if already initializing/initialized unless force refreshed
    try {
      const session = await getAuthSessionAction();
      set({
        user: session.user,
        isAuthenticated: session.isAuthenticated,
        isInitialized: true,
        isLoading: false,
      });
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isInitialized: true,
        isLoading: false,
      });
    }
  },

  login: async (input: LoginInput) => {
    set({ isLoading: true });
    try {
      const currentCartToken =
        useCartStore.getState().cartToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem("cart-store") || undefined
          : undefined);
      const result = await loginAction(input, currentCartToken);
      if (result.success && result.user) {
        set({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
        });
        const tokenToUse = result.cartToken || currentCartToken;
        if (tokenToUse) {
          if (typeof window !== "undefined") {
            localStorage.setItem("cart-store", tokenToUse);
          }
          useCartStore.setState({ cartToken: tokenToUse });
        }
        if (result.nonce) {
          if (typeof window !== "undefined") {
            localStorage.setItem("cart-nonce-store", result.nonce);
          }
          useCartStore.setState({ nonce: result.nonce });
        }
        await useCartStore.getState().refreshCart();
      } else {
        set({ isLoading: false });
      }
      return result;
    } catch (err: unknown) {
      set({ isLoading: false });
      return {
        success: false,
        error: err instanceof Error ? err.message : "Login failed",
      };
    }
  },

  googleLogin: async (idToken: string) => {
    set({ isLoading: true });
    try {
      const currentCartToken =
        useCartStore.getState().cartToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem("cart-store") || undefined
          : undefined);
      const result = await googleLoginAction(idToken, currentCartToken);
      if (result.success && result.user) {
        set({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
        });
        const tokenToUse = result.cartToken || currentCartToken;
        if (tokenToUse) {
          if (typeof window !== "undefined") {
            localStorage.setItem("cart-store", tokenToUse);
          }
          useCartStore.setState({ cartToken: tokenToUse });
        }
        if (result.nonce) {
          if (typeof window !== "undefined") {
            localStorage.setItem("cart-nonce-store", result.nonce);
          }
          useCartStore.setState({ nonce: result.nonce });
        }
        await useCartStore.getState().refreshCart();
      } else {
        set({ isLoading: false });
      }
      return result;
    } catch (err: unknown) {
      set({ isLoading: false });
      return {
        success: false,
        error: err instanceof Error ? err.message : "Google login failed",
      };
    }
  },

  register: async (input: RegisterInput) => {
    set({ isLoading: true });
    try {
      const result = await registerAction(input);
      if (result.success && result.user) {
        set({
          user: result.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
      return result;
    } catch (err: unknown) {
      set({ isLoading: false });
      return {
        success: false,
        error: err instanceof Error ? err.message : "Registration failed",
      };
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      const currentCartToken =
        useCartStore.getState().cartToken ||
        (typeof window !== "undefined"
          ? localStorage.getItem("cart-store") || undefined
          : undefined);
      const result = await logoutAction(currentCartToken);
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      useCartStore.getState().clearCart();
      if (typeof window !== "undefined") {
        localStorage.removeItem("cart-store");
        localStorage.removeItem("cart-nonce-store");
      }
      return result;
    } catch {
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
      useCartStore.getState().clearCart();
      if (typeof window !== "undefined") {
        localStorage.removeItem("cart-store");
        localStorage.removeItem("cart-nonce-store");
      }
      return {
        success: true,
        message: "Logged out locally",
      };
    }
  },

  setUser: (user: AuthUser | null) => {
    set({
      user,
      isAuthenticated: !!user,
    });
  },
}));
