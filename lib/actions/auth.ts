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

    let finalCartToken: string | undefined = guestCartToken;
    let finalNonce: string | undefined;

    // Merge guest cart + saved account cart (non-fatal)
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
          console.warn("[loginAction] Failed to retrieve guest cart:", guestErr);
        }
      }

      let persistentItems: PersistentCartItem[] = [];
      const userId = Number(res.user?.id);
      if (!isNaN(userId) && userId > 0) {
        try {
          const userCartRes = await getUserCart(userId);
          if (userCartRes.success && Array.isArray(userCartRes.items)) {
            persistentItems = userCartRes.items;
          }
        } catch (userCartErr) {
          console.warn("[loginAction] Failed to retrieve saved persistent cart:", userCartErr);
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
            console.warn("[loginAction] Failed to initialize cart session for merge:", initErr);
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

            // If Store API rejects variation array (common when item.id is a variation ID), retry without variation
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
                `[loginAction] Failed to add persistent item ${item.id} to cart:`,
                errBody
              );
            }
          } catch (addErr) {
            console.warn(
              `[loginAction] Error adding persistent item ${item.id} to cart:`,
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
      console.error("[loginAction] Persistent cart merge error:", mergeErr);
    }

    return {
      success: true,
      message: "Logged in successfully",
      user: res.user,
      ...(finalCartToken ? { cartToken: finalCartToken } : {}),
      ...(finalNonce ? { nonce: finalNonce } : {}),
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected login error occurred",
    };
  }
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
