"use server";

import {
  LoginSchema,
  RegisterSchema,
  ForgotPasswordSchema,
  type LoginInput,
  type RegisterInput,
} from "@/lib/validation/auth-schemas";
import {
  loginUserOnServer,
  loginWithGoogleOnServer,
  registerUserOnServer,
  revokeTokenOnServer,
  resetPasswordOnServer,
} from "@/lib/auth/jwt-auth";
import {
  setAuthCookies,
  clearAuthCookies,
  getAuthCookies,
  getSessionUser,
} from "@/lib/auth/session";
import {
  getCartFromServer,
  addToCartOnServer,
  extractCartToken,
  extractNonce,
} from "@/lib/woocommerce/api";
import {
  saveUserCart,
  getUserCart,
  type PersistentCartItem,
} from "@/lib/woocommerce/persistent-cart";
import { mergeCartItems } from "@/lib/cart/merge";
import type { WooCart } from "@/lib/woocommerce/types";
import type { AuthActionResult, AuthUser } from "@/lib/auth/types";

/**
 * Helper: Merge guest cart items with user's saved account cart and persist the merged result.
 * Preserves Store API cartToken and activeNonce throughout.
 */
export async function mergeAndApplyCartOnLogin(
  userId: number,
  guestCartToken?: string
): Promise<{ cartToken?: string; nonce?: string }> {
  let finalCartToken: string | undefined = guestCartToken;
  let finalNonce: string | undefined;

  try {
    let guestItems: PersistentCartItem[] = [];
    let activeCartToken: string | undefined = guestCartToken;
    let activeNonce: string | undefined;

    if (guestCartToken) {
      try {
        const guestRes = await getCartFromServer(guestCartToken);
        if (guestRes.ok) {
          const headerToken = extractCartToken(guestRes);
          const headerNonce = extractNonce(guestRes);
          if (headerToken) activeCartToken = headerToken;
          if (headerNonce) activeNonce = headerNonce;

          const guestCart = (await guestRes.json()) as WooCart;
          if (Array.isArray(guestCart.items) && guestCart.items.length > 0) {
            guestItems = guestCart.items.map((item) => ({
              id: item.id,
              quantity: item.quantity,
              variation:
                item.variation && item.variation.length > 0
                  ? item.variation
                  : undefined,
            }));
          }
        }
      } catch (guestErr) {
        console.warn("[mergeAndApplyCartOnLogin] Failed to retrieve guest cart:", guestErr);
      }
    }

    let persistentItems: PersistentCartItem[] = [];
    if (!isNaN(userId) && userId > 0) {
      try {
        const userCartRes = await getUserCart(userId);
        if (userCartRes.success && Array.isArray(userCartRes.items)) {
          persistentItems = userCartRes.items;
        }
      } catch (userCartErr) {
        console.warn("[mergeAndApplyCartOnLogin] Failed to retrieve saved persistent cart:", userCartErr);
      }
    }

    const merged = mergeCartItems(guestItems, persistentItems);

    // Only items from the user's saved account cart need to be added to the current session,
    // because guestItems are already present in activeCartToken.
    if (persistentItems.length > 0) {
      // If we don't have activeNonce yet, initialize the cart session first
      if (!activeNonce) {
        try {
          const initRes = await getCartFromServer(activeCartToken);
          const initToken = extractCartToken(initRes);
          const initNonce = extractNonce(initRes);
          if (initToken) activeCartToken = initToken;
          if (initNonce) activeNonce = initNonce;
        } catch (initErr) {
          console.warn("[mergeAndApplyCartOnLogin] Failed to initialize cart session for merge:", initErr);
        }
      }

      for (const item of persistentItems) {
        try {
          // First attempt: with variation array if present
          let addRes = await addToCartOnServer(
            item.id,
            item.quantity,
            item.variation,
            activeCartToken,
            activeNonce
          );

          // If Store API rejects variation array, retry without variation
          if (!addRes.ok && item.variation && item.variation.length > 0) {
            addRes = await addToCartOnServer(
              item.id,
              item.quantity,
              undefined,
              activeCartToken,
              activeNonce
            );
          }

          const headerToken = extractCartToken(addRes);
          const headerNonce = extractNonce(addRes);
          if (headerToken) activeCartToken = headerToken;
          if (headerNonce) activeNonce = headerNonce;

          if (!addRes.ok) {
            const errBody = await addRes.text();
            console.warn(
              `[mergeAndApplyCartOnLogin] Failed to add persistent item ${item.id} to cart:`,
              errBody
            );
          }
        } catch (addErr) {
          console.warn(
            `[mergeAndApplyCartOnLogin] Error adding persistent item ${item.id} to cart:`,
            addErr
          );
        }
      }
    }

    if (activeCartToken) {
      finalCartToken = activeCartToken;
    }
    if (activeNonce) {
      finalNonce = activeNonce;
    }

    if (merged.length > 0 && !isNaN(userId) && userId > 0) {
      await saveUserCart(userId, merged);
    }
  } catch (mergeErr) {
    console.error("[mergeAndApplyCartOnLogin] Persistent cart merge error:", mergeErr);
  }

  return {
    ...(finalCartToken ? { cartToken: finalCartToken } : {}),
    ...(finalNonce ? { nonce: finalNonce } : {}),
  };
}

/**
 * Server Action: Login user, set HttpOnly cookies, merge guest & saved carts, and return user profile.
 */
export async function loginAction(
  input: LoginInput,
  guestCartToken?: string
): Promise<AuthActionResult<AuthUser> & { cartToken?: string; nonce?: string }> {
  const parsed = LoginSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid credentials",
    };
  }

  try {
    const { emailOrUsername, password } = parsed.data;
    const res = await loginUserOnServer({ emailOrUsername, password });

    if (!res.success || !res.tokens?.jwt) {
      return {
        success: false,
        error: res.message || "Invalid email or password",
      };
    }

    // Set secure HttpOnly cookies on the response
    await setAuthCookies(res.tokens, res.user);

    const userId = Number(res.user?.id);
    const cartResult = await mergeAndApplyCartOnLogin(userId, guestCartToken);

    return {
      success: true,
      message: "Logged in successfully",
      user: res.user,
      ...(cartResult.cartToken ? { cartToken: cartResult.cartToken } : {}),
      ...(cartResult.nonce ? { nonce: cartResult.nonce } : {}),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected login error occurred",
    };
  }
}

/**
 * Helper: Record provider authentication on WordPress user meta and sync profile details.
 */
export async function recordUserAuthMethod(
  userId: number | string,
  provider: string = "google",
  profile?: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
  }
): Promise<void> {
  const numId = Number(userId);
  if (isNaN(numId) || numId <= 0) return;

  try {
    const authKey = process.env.MYAPP_CART_AUTH_KEY || "";
    const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
    const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
    const baseUrl = `${protocol}://${host}`.replace(/\/+$/, "");

    await fetch(`${baseUrl}/wp-json/myapp/v1/user/mark-provider`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: numId,
        provider,
        AUTH_KEY: authKey,
        first_name: profile?.firstName,
        last_name: profile?.lastName,
        display_name: profile?.displayName,
        avatar_url: profile?.avatarUrl,
      }),
      cache: "no-store",
    });
  } catch (err) {
    console.warn("[recordUserAuthMethod] Failed to record auth method:", err);
  }
}

/**
 * Server Action: Authenticate with Google ID token, set HttpOnly cookies, merge carts, and return user profile.
 */
export async function googleLoginAction(
  idToken: string,
  guestCartToken?: string
): Promise<AuthActionResult<AuthUser> & { cartToken?: string; nonce?: string }> {
  if (!idToken || typeof idToken !== "string") {
    return {
      success: false,
      error: "Google ID token is required",
    };
  }

  try {
    const res = await loginWithGoogleOnServer(idToken);

    if (!res.success || !res.tokens?.jwt) {
      return {
        success: false,
        error: res.message || "Google authentication failed",
      };
    }

    // Set secure HttpOnly cookies on the response
    await setAuthCookies(res.tokens, res.user);

    const userId = Number(res.user?.id);
    if (!isNaN(userId) && userId > 0) {
      // Record provider auth and sync profile details on WordPress in background
      recordUserAuthMethod(userId, "google", {
        firstName: res.user?.firstName,
        lastName: res.user?.lastName,
        displayName: res.user?.displayName,
        avatarUrl: res.user?.avatarUrl,
      }).catch(() => {});
    }

    const cartResult = await mergeAndApplyCartOnLogin(userId, guestCartToken);

    return {
      success: true,
      message: "Signed in with Google successfully",
      user: res.user,
      ...(cartResult.cartToken ? { cartToken: cartResult.cartToken } : {}),
      ...(cartResult.nonce ? { nonce: cartResult.nonce } : {}),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "An unexpected Google login error occurred",
    };
  }
}

/**
 * Server Action: Query active authentication methods for a given user.
 */
export async function getUserAuthMethodsAction(
  userId?: number | string
): Promise<{
  success: boolean;
  hasPassword: boolean;
  hasGoogle: boolean;
  authMethods: string[];
}> {
  try {
    let targetUserId = userId;
    if (!targetUserId) {
      const session = await getSessionUser();
      if (!session?.id) {
        return {
          success: false,
          hasPassword: true,
          hasGoogle: false,
          authMethods: ["password"],
        };
      }
      targetUserId = session.id;
    }

    const numId = Number(targetUserId);
    if (isNaN(numId) || numId <= 0) {
      return {
        success: false,
        hasPassword: true,
        hasGoogle: false,
        authMethods: ["password"],
      };
    }

    const authKey = process.env.MYAPP_CART_AUTH_KEY || "";
    const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
    const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
    const baseUrl = `${protocol}://${host}`.replace(/\/+$/, "");

    const queryParams = new URLSearchParams({
      user_id: String(numId),
      ...(authKey ? { AUTH_KEY: authKey } : {}),
    });

    const res = await fetch(
      `${baseUrl}/wp-json/myapp/v1/user/auth-methods?${queryParams.toString()}`,
      {
        cache: "no-store",
      }
    );

    if (res.ok) {
      const data = (await res.json().catch(() => null)) as {
        success?: boolean;
        has_password?: boolean;
        has_google?: boolean;
        auth_methods?: string[];
      } | null;

      if (data && data.success) {
        return {
          success: true,
          hasPassword: data.has_password ?? true,
          hasGoogle: data.has_google ?? false,
          authMethods: data.auth_methods ?? (data.has_google ? ["google"] : ["password"]),
        };
      }
    }
  } catch (err) {
    console.warn("[getUserAuthMethodsAction] Failed to retrieve auth methods:", err);
  }

  // Safe fallback
  return {
    success: true,
    hasPassword: true,
    hasGoogle: false,
    authMethods: ["password"],
  };
}

/**
 * Server Action: Register new customer in WordPress/WooCommerce.
 */
export async function registerAction(
  input: RegisterInput
): Promise<AuthActionResult<AuthUser>> {
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid registration details",
    };
  }

  try {
    const { email, password, firstName, lastName, username } = parsed.data;
    const res = await registerUserOnServer({
      email,
      password,
      firstName,
      lastName,
      username: username || email.split("@")[0],
    });

    if (!res.success) {
      return {
        success: false,
        error: res.message || "Registration failed",
      };
    }

    if (res.jwt) {
      await setAuthCookies({ jwt: res.jwt }, res.user);
    }

    return {
      success: true,
      message: res.message || "Account created successfully! Please sign in with your credentials.",
      user: res.user,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected registration error occurred",
    };
  }
}

/**
 * Server Action: Logout user, save persistent cart, revoke JWT in WordPress, and clear HttpOnly cookies.
 */
export async function logoutAction(cartToken?: string): Promise<AuthActionResult> {
  let jwtToken: string | undefined;

  try {
    const { jwt, user } = await getAuthCookies();
    jwtToken = jwt;

    if (user && cartToken) {
      const userId = Number(user.id);
      if (!isNaN(userId) && userId > 0) {
        try {
          const cartRes = await getCartFromServer(cartToken);
          if (cartRes.ok) {
            const cart = (await cartRes.json()) as WooCart;
            if (Array.isArray(cart.items)) {
              const items: PersistentCartItem[] = cart.items.map((item) => ({
                id: item.id,
                quantity: item.quantity,
                variation:
                  item.variation && item.variation.length > 0
                    ? item.variation
                    : undefined,
              }));
              await saveUserCart(userId, items);
            }
          }
        } catch (saveErr) {
          console.error("[logoutAction] Failed to save cart to user account:", saveErr);
        }
      }
    }
  } catch (err) {
    console.error("[logoutAction] Error persisting cart before logout:", err);
  }

  try {
    if (jwtToken) {
      await revokeTokenOnServer(jwtToken);
    }
  } catch {
    // Continue clearing cookies regardless
  } finally {
    await clearAuthCookies();
  }

  return {
    success: true,
    message: "Logged out successfully",
  };
}

/**
 * Server Action: Retrieve active user session from HttpOnly cookies.
 */
export async function getAuthSessionAction(): Promise<{
  user: AuthUser | null;
  isAuthenticated: boolean;
}> {
  try {
    const user = await getSessionUser();
    return {
      user,
      isAuthenticated: !!user,
    };
  } catch {
    return {
      user: null,
      isAuthenticated: false,
    };
  }
}

/**
 * Server Action: Request password reset email.
 */
export async function forgotPasswordAction(
  email: string
): Promise<AuthActionResult> {
  const parsed = ForgotPasswordSchema.safeParse({ email });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Please enter a valid email address",
    };
  }

  try {
    const res = await resetPasswordOnServer(parsed.data.email);
    if (!res.success) {
      return {
        success: false,
        error: res.message || "Failed to send reset instructions",
      };
    }

    return {
      success: true,
      message: res.message || "Password reset instructions have been sent to your email.",
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process forgot password request",
    };
  }
}
