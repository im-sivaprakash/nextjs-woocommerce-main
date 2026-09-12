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
import type { AuthActionResult, AuthUser } from "@/lib/auth/types";

/**
 * Server Action: Login user, set HttpOnly cookies, and return user profile.
 */
export async function loginAction(
  input: LoginInput
): Promise<AuthActionResult<AuthUser>> {
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

    return {
      success: true,
      message: "Logged in successfully",
      user: res.user,
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
 * Server Action: Logout user, revoke JWT in WordPress, and clear HttpOnly cookies.
 */
export async function logoutAction(): Promise<AuthActionResult> {
  try {
    const { jwt } = await getAuthCookies();
    if (jwt) {
      await revokeTokenOnServer(jwt);
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
