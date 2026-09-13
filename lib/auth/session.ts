import { cookies } from "next/headers";
import type { AuthUser, AuthTokens } from "./types";
import {
  isJwtExpired,
  validateTokenOnServer,
  refreshTokenOnServer,
  normalizeAuthUser,
  decodeJwtPayload,
} from "./jwt-auth";

export const AUTH_COOKIE_NAME = "auth_token";
export const REFRESH_COOKIE_NAME = "refresh_token";
export const USER_COOKIE_NAME = "auth_user_session";

const ACCESS_TOKEN_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const REFRESH_TOKEN_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Set secure HttpOnly authentication cookies.
 */
export async function setAuthCookies(
  tokens: AuthTokens,
  user?: AuthUser
): Promise<void> {
  const cookieStore = await cookies();
  const isProduction = process.env.NODE_ENV === "production";

  if (tokens.jwt) {
    cookieStore.set(AUTH_COOKIE_NAME, tokens.jwt, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
  }

  if (tokens.refreshToken) {
    cookieStore.set(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TOKEN_MAX_AGE,
    });
  }

  if (user) {
    cookieStore.set(USER_COOKIE_NAME, JSON.stringify(user), {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
  }
}

/**
 * Remove all authentication cookies.
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(AUTH_COOKIE_NAME);
  cookieStore.delete(REFRESH_COOKIE_NAME);
  cookieStore.delete(USER_COOKIE_NAME);
}

/**
 * Read current tokens and cached user from cookies.
 */
export async function getAuthCookies(): Promise<{
  jwt?: string;
  refreshToken?: string;
  user?: AuthUser;
}> {
  const cookieStore = await cookies();
  const jwt = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;
  const rawUser = cookieStore.get(USER_COOKIE_NAME)?.value;

  let user: AuthUser | undefined;
  if (rawUser) {
    try {
      user = JSON.parse(rawUser);
    } catch {
      // Ignore parse failure
    }
  }

  return {
    jwt,
    refreshToken,
    user,
  };
}

/**
 * Retrieve the currently authenticated user.
 * Automatically refreshes expired JWT tokens in the background if a refresh token is available.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  try {
    const { jwt, refreshToken, user: cachedUser } = await getAuthCookies();

    if (!jwt && !refreshToken) {
      return null;
    }

    // If JWT exists and is still valid
    if (jwt && !isJwtExpired(jwt)) {
      if (cachedUser) {
        return cachedUser;
      }
      // Try to validate or decode
      const validation = await validateTokenOnServer(jwt);
      if (validation.success && validation.user) {
        await setAuthCookies({ jwt, refreshToken }, validation.user);
        return validation.user;
      }

      const payload = decodeJwtPayload(jwt);
      if (payload) {
        const decodedUser = normalizeAuthUser({
          id: payload.id || payload.sub || payload.user_id || "",
          email: payload.email || "",
          user_login: payload.user_login || payload.username || "",
          display_name: payload.name || payload.display_name || "",
          roles: payload.roles,
        });
        await setAuthCookies({ jwt, refreshToken }, decodedUser);
        return decodedUser;
      }
    }

    // If JWT is expired or missing, attempt refresh
    if (refreshToken || jwt) {
      const refreshResult = await refreshTokenOnServer({
        refreshToken,
        jwtToken: jwt,
      });

      if (refreshResult.success && refreshResult.tokens?.jwt) {
        const newJwt = refreshResult.tokens.jwt;
        const newRefreshToken = refreshResult.tokens.refreshToken || refreshToken;

        // Validate new JWT
        const validation = await validateTokenOnServer(newJwt);
        const newUser = validation.user || cachedUser || normalizeAuthUser(decodeJwtPayload(newJwt) || {});

        await setAuthCookies(
          { jwt: newJwt, refreshToken: newRefreshToken },
          newUser
        );

        return newUser;
      }
    }

    // Refresh failed or token completely invalid - clear corrupted cookies
    await clearAuthCookies();
    return null;
  } catch (err) {
    console.error("[getSessionUser] Error resolving session:", err);
    return null;
  }
}
