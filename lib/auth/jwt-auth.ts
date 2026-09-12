import crypto from "crypto";
import type { AuthUser, AuthTokens } from "./types";

function getBaseUrl(): string {
  const protocol = process.env.NEXT_PUBLIC_WOOCOMMERCE_PROTCOL || "https";
  const host = process.env.NEXT_PUBLIC_WOOCOMMERCE_HOST || "trjshop.com";
  return `${protocol}://${host}`.replace(/\/+$/, "");
}

function getJwtApiUrl(path: string): string {
  const base = getBaseUrl();
  const endpoint = (process.env.JWT_ENDPOINT || "simple-jwt-login/v1/").replace(/^\/+|\/+$/g, "");
  const cleanPath = path.replace(/^\/+/, "");
  return `${base}/wp-json/${endpoint}/${cleanPath}`;
}

function getAuthKey(): string {
  return process.env.AUTH_KEY || "";
}

function getJwtSecret(): string {
  return (
    getAuthKey() ||
    process.env.WC_CONSUMER_SECRET ||
    "nextjs_woocommerce_jwt_fallback_secret"
  );
}

function getWcBasicAuth(): string | null {
  const key = process.env.WC_CONSUMER_KEY;
  const secret = process.env.WC_CONSUMER_SECRET;
  if (!key || !secret) return null;
  return Buffer.from(`${key}:${secret}`).toString("base64");
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Creates a cryptographically signed HMAC-SHA256 JWT.
 */
export function createSignedJwt(
  payload: Record<string, unknown>,
  expiresInSeconds = 60 * 60 * 24 * 7 // 7 days default
): string {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: Record<string, unknown> = {
    iat: now,
    exp: now + expiresInSeconds,
    iss: getBaseUrl(),
    ...payload,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac("sha256", getJwtSecret())
    .update(signatureInput)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${signatureInput}.${signature}`;
}

/**
 * Verifies the signature and expiration of an HMAC-SHA256 JWT.
 */
export function verifySignedJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, signature] = parts;

    const expectedSignature = crypto
      .createHmac("sha256", getJwtSecret())
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest("base64")
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    if (signature !== expectedSignature) {
      return null;
    }

    const payloadJson = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(payloadJson) as Record<string, unknown>;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Standardize error message extraction from WordPress / Simple JWT Login responses.
 */
function extractErrorMessage(json: unknown, status: number): string {
  if (typeof json === "string") return json;
  if (!json || typeof json !== "object") return `Request failed with status ${status}`;

  const record = json as Record<string, unknown>;
  const data = record.data as Record<string, unknown> | undefined;

  if (data && typeof data.message === "string") return data.message;
  if (typeof record.message === "string") return record.message;
  if (data && typeof data.error === "string") return data.error;
  if (typeof record.error === "string") return record.error;
  if (typeof record.code === "string") return record.code;

  return `Authentication error (${status})`;
}

/**
 * Normalizes raw WordPress / WooCommerce user objects into a consistent AuthUser interface.
 */
export function normalizeAuthUser(raw: Record<string, unknown>): AuthUser {
  const id = (raw.id ?? raw.ID ?? raw.user_id ?? "") as string | number;
  const email = String(raw.email ?? raw.user_email ?? "");
  const username = String(raw.login ?? raw.user_login ?? raw.username ?? email);
  const firstName = String(raw.first_name ?? raw.firstName ?? "");
  const lastName = String(raw.last_name ?? raw.lastName ?? "");
  const displayName = (raw.display_name ??
    raw.displayName ??
    raw.nicename ??
    (firstName ? `${firstName} ${lastName}`.trim() : username || email)) as string;

  let roles: string[] = [];
  if (Array.isArray(raw.roles)) {
    roles = raw.roles.map(String);
  } else if (raw.roles && typeof raw.roles === "object") {
    roles = Object.keys(raw.roles as Record<string, unknown>);
  } else if (raw.role) {
    roles = [String(raw.role)];
  } else {
    roles = ["customer"];
  }

  return {
    id,
    email,
    username,
    displayName: displayName || email,
    firstName,
    lastName,
    roles,
    registeredDate: (raw.registered ?? raw.user_registered ?? raw.date_created) as string | undefined,
  };
}

/**
 * Decode payload from JWT (safe client or server side without secret verification)
 * to inspect expiration and standard claims.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const jsonPayload = base64UrlDecode(parts[1]);
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Check if JWT is expired or within buffer seconds of expiring.
 */
export function isJwtExpired(token: string, bufferSeconds = 60): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return false;
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds + bufferSeconds;
}

/**
 * Authenticates user directly against WordPress core authentication mechanism.
 */
export async function verifyCredentialsWithWordPress(
  identifier: string,
  password: string
): Promise<boolean> {
  try {
    const baseUrl = getBaseUrl();
    const formParams = new URLSearchParams();
    formParams.append("log", identifier.trim());
    formParams.append("pwd", password);
    formParams.append("wp-submit", "Log In");
    formParams.append("testcookie", "1");

    const res = await fetch(`${baseUrl}/wp-login.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": "wordpress_test_cookie=WP%20Cookie%20check",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NextJS-WooCommerce-Auth",
        "Origin": baseUrl,
        "Referer": `${baseUrl}/wp-login.php`,
      },
      body: formParams.toString(),
      redirect: "manual",
      cache: "no-store",
    });

    const location = res.headers.get("location") || "";
    const setCookie = res.headers.get("set-cookie") || "";

    const isSuccess =
      (res.status === 302 || res.status === 200) &&
      !location.includes("wp-login.php") &&
      (setCookie.includes("wordpress_logged_in_") ||
        setCookie.includes("wordpress_sec_") ||
        location.includes("wp-admin") ||
        location.includes("profile.php"));

    return isSuccess;
  } catch (err) {
    console.error("[verifyCredentialsWithWordPress] Error:", err);
    return false;
  }
}

/**
 * Looks up customer details by email or username using WooCommerce REST API.
 */
export async function lookupCustomerProfile(identifier: string): Promise<AuthUser | null> {
  const basicAuth = getWcBasicAuth();
  if (!basicAuth) return null;

  try {
    const isEmail = identifier.includes("@");
    const queryParam = isEmail
      ? `email=${encodeURIComponent(identifier.trim().toLowerCase())}`
      : `search=${encodeURIComponent(identifier.trim())}`;

    const res = await fetch(`${getBaseUrl()}/wp-json/wc/v3/customers?${queryParam}`, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
      cache: "no-store",
    });

    if (!res.ok) return null;
    const customers = (await res.json().catch(() => [])) as Record<string, unknown>[];
    if (Array.isArray(customers) && customers.length > 0) {
      return normalizeAuthUser(customers[0]);
    }
    return null;
  } catch (err) {
    console.error("[lookupCustomerProfile] Error:", err);
    return null;
  }
}

// ─── API Methods ─────────────────────────────────────────────────────────────

/**
 * Register a new user with WooCommerce REST API and Simple JWT Login.
 */
export async function registerUserOnServer(params: {
  email: string;
  password: string;
  username?: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ success: boolean; message: string; user?: AuthUser; jwt?: string }> {
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanUsername = (params.username || cleanEmail.split("@")[0]).trim();

  // 1. Create customer in WooCommerce REST API (guarantees DB persistence)
  const basicAuth = getWcBasicAuth();
  if (basicAuth) {
    try {
      const wcCreateRes = await fetch(`${getBaseUrl()}/wp-json/wc/v3/customers`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          username: cleanUsername,
          password: params.password,
          first_name: params.firstName || "",
          last_name: params.lastName || "",
        }),
      });

      const wcJson = (await wcCreateRes.json().catch(() => null)) as Record<string, unknown> | null;

      if (wcCreateRes.ok && wcJson && (wcJson.id || wcJson.email)) {
        const user = normalizeAuthUser(wcJson);
        const jwt = createSignedJwt({
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          roles: user.roles,
        });

        return {
          success: true,
          message: "Account created successfully!",
          user,
          jwt,
        };
      }

      if (wcJson && typeof wcJson.message === "string") {
        return {
          success: false,
          message: wcJson.message,
        };
      }
    } catch (err) {
      console.warn("[registerUserOnServer] WooCommerce API register failed, falling back to JWT endpoint:", err);
    }
  }

  // 2. Fallback: Simple JWT Login register endpoint
  const url = getJwtApiUrl("users");
  const authKey = getAuthKey();

  const body: Record<string, unknown> = {
    email: cleanEmail,
    password: params.password,
    user_login: cleanUsername,
  };

  if (params.firstName) body.first_name = params.firstName.trim();
  if (params.lastName) body.last_name = params.lastName.trim();
  if (authKey) body.AUTH_KEY = authKey;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (res.ok && json?.success !== false) {
      const rawUser = (json?.data ?? json?.user ?? {
        id: json?.id,
        email: cleanEmail,
        user_login: cleanUsername,
        first_name: params.firstName,
        last_name: params.lastName,
      }) as Record<string, unknown>;

      const user = normalizeAuthUser(rawUser);
      const jwt = (json?.jwt || (json?.data as Record<string, unknown> | undefined)?.jwt) as string | undefined ||
        createSignedJwt({
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          roles: user.roles,
        });

      return {
        success: true,
        message: (json?.message as string) || "Account created successfully!",
        user,
        jwt,
      };
    }

    const errorMsg = extractErrorMessage(json, res.status);
    return {
      success: false,
      message: errorMsg,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to communicate with registration service",
    };
  }
}

/**
 * Authenticate with Simple JWT Login, with robust WordPress Core + WooCommerce fallback.
 */
export async function loginUserOnServer(params: {
  emailOrUsername: string;
  password: string;
}): Promise<{
  success: boolean;
  message?: string;
  tokens?: AuthTokens;
  user?: AuthUser;
}> {
  const identifier = params.emailOrUsername.trim();
  const isEmail = identifier.includes("@");
  const authKey = getAuthKey();

  // 1. Try Simple JWT Login endpoint
  try {
    const url = getJwtApiUrl("auth");
    const body: Record<string, unknown> = {
      password: params.password,
      login: identifier,
      ...(isEmail ? { email: identifier.toLowerCase() } : { username: identifier }),
    };

    if (authKey) {
      body.AUTH_KEY = authKey;
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (res.ok && json?.success !== false) {
      const dataObj = json?.data as Record<string, unknown> | undefined;
      const jwt = (dataObj?.jwt || json?.jwt) as string | undefined;
      const refreshToken = (dataObj?.refresh_token || json?.refresh_token) as string | undefined;

      if (jwt) {
        let user: AuthUser | undefined;
        const rawUserData = (dataObj?.user || json?.user) as Record<string, unknown> | undefined;
        if (rawUserData) {
          user = normalizeAuthUser(rawUserData);
        } else {
          const payload = decodeJwtPayload(jwt);
          if (payload) {
            const payloadData = payload.data as Record<string, unknown> | undefined;
            const payloadUser = payloadData?.user as Record<string, unknown> | undefined;

            user = normalizeAuthUser({
              id: payload.id || payload.sub || payloadUser?.id || payload.user_id,
              email: payload.email || payloadUser?.email || (isEmail ? identifier : ""),
              user_login: payload.user_login || payload.username || identifier,
              display_name: payload.name || payload.display_name || identifier,
              roles: payload.roles,
            });
          }
        }

        return {
          success: true,
          tokens: { jwt, refreshToken },
          user,
        };
      }
    }
  } catch (jwtErr) {
    console.warn("[loginUserOnServer] Simple JWT Login call error, checking WP core:", jwtErr);
  }

  // 2. Resilient WordPress Core Authentication Fallback
  try {
    const isWpValid = await verifyCredentialsWithWordPress(identifier, params.password);
    if (!isWpValid) {
      return {
        success: false,
        message: "Wrong user credentials. Please check your username/email and password.",
      };
    }

    // Credentials are 100% verified by WordPress core! Fetch customer record
    const customer = await lookupCustomerProfile(identifier);
    const user: AuthUser = customer || {
      id: identifier,
      email: isEmail ? identifier.toLowerCase() : "",
      username: identifier,
      displayName: identifier,
      roles: ["customer"],
    };

    const jwt = createSignedJwt({
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      roles: user.roles,
    });

    const refreshToken = createSignedJwt(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        type: "refresh",
      },
      60 * 60 * 24 * 30 // 30 days
    );

    return {
      success: true,
      tokens: {
        jwt,
        refreshToken,
      },
      user,
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to authenticate with WordPress",
    };
  }
}

/**
 * Validate JWT and retrieve user profile.
 * Supports HMAC-SHA256 tokens and Simple JWT Login tokens.
 */
export async function validateTokenOnServer(jwtToken: string): Promise<{
  success: boolean;
  user?: AuthUser;
  message?: string;
}> {
  if (!jwtToken) {
    return { success: false, message: "No token provided" };
  }

  // 1. Check if token was signed by server HMAC
  const signedPayload = verifySignedJwt(jwtToken);
  if (signedPayload) {
    return {
      success: true,
      user: normalizeAuthUser(signedPayload),
    };
  }

  // 2. Try Simple JWT Login validate endpoint
  const url = getJwtApiUrl("auth/validate");
  const authKey = getAuthKey();
  const queryParams = new URLSearchParams({
    JWT: jwtToken,
  });
  if (authKey) queryParams.set("AUTH_KEY", authKey);

  try {
    const res = await fetch(`${url}?${queryParams.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (res.ok && json?.success !== false) {
      const dataObj = json?.data as Record<string, unknown> | undefined;
      const rawUser = (dataObj?.user ?? json?.user ?? json?.data) as Record<string, unknown> | undefined;
      if (rawUser) {
        return {
          success: true,
          user: normalizeAuthUser(rawUser),
        };
      }
    }
  } catch (err) {
    console.warn("[validateTokenOnServer] Simple JWT Login validate failed:", err);
  }

  // 3. Fallback: inspect unexpired decoded payload
  if (!isJwtExpired(jwtToken)) {
    const payload = decodeJwtPayload(jwtToken);
    if (payload) {
      return {
        success: true,
        user: normalizeAuthUser({
          id: payload.id || payload.sub || payload.user_id || "",
          email: payload.email || "",
          user_login: payload.user_login || payload.username || "",
          display_name: payload.name || payload.display_name || "",
          roles: payload.roles,
        }),
      };
    }
  }

  return {
    success: false,
    message: "Token has expired or is invalid",
  };
}

/**
 * Refresh JWT token using refresh_token or current JWT.
 */
export async function refreshTokenOnServer(params: {
  refreshToken?: string;
  jwtToken?: string;
}): Promise<{
  success: boolean;
  tokens?: AuthTokens;
  message?: string;
}> {
  const tokenToRefresh = params.refreshToken || params.jwtToken;
  if (!tokenToRefresh) {
    return { success: false, message: "No token provided to refresh" };
  }

  // 1. Check if token was signed by server HMAC
  const signedPayload = verifySignedJwt(tokenToRefresh);
  if (signedPayload) {
    const newJwt = createSignedJwt({
      id: signedPayload.id,
      email: signedPayload.email,
      username: signedPayload.username,
      displayName: signedPayload.displayName,
      roles: signedPayload.roles,
    });
    const newRefreshToken = createSignedJwt(
      {
        id: signedPayload.id,
        email: signedPayload.email,
        username: signedPayload.username,
        type: "refresh",
      },
      60 * 60 * 24 * 30
    );

    return {
      success: true,
      tokens: {
        jwt: newJwt,
        refreshToken: newRefreshToken,
      },
    };
  }

  // 2. Try Simple JWT Login refresh endpoint
  const url = getJwtApiUrl("auth/refresh");
  const authKey = getAuthKey();

  const body: Record<string, unknown> = {};
  if (params.refreshToken) body.refresh_token = params.refreshToken;
  if (params.jwtToken) body.JWT = params.jwtToken;
  if (authKey) body.AUTH_KEY = authKey;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (res.ok && json?.success !== false) {
      const dataObj = json?.data as Record<string, unknown> | undefined;
      const jwt = (dataObj?.jwt || json?.jwt) as string | undefined;
      const refreshToken = (dataObj?.refresh_token || json?.refresh_token || params.refreshToken) as string | undefined;

      if (jwt) {
        return {
          success: true,
          tokens: {
            jwt,
            refreshToken,
          },
        };
      }
    }
  } catch (err) {
    console.warn("[refreshTokenOnServer] Simple JWT Login refresh failed:", err);
  }

  return {
    success: false,
    message: "Failed to refresh token",
  };
}

/**
 * Revoke JWT token on logout.
 */
export async function revokeTokenOnServer(jwtToken: string): Promise<{
  success: boolean;
  message?: string;
}> {
  if (!jwtToken) return { success: true };

  const url = getJwtApiUrl("auth/revoke");
  const authKey = getAuthKey();

  const body: Record<string, unknown> = {
    JWT: jwtToken,
  };
  if (authKey) body.AUTH_KEY = authKey;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return {
      success: res.ok && json?.success !== false,
      message: json?.message as string | undefined,
    };
  } catch {
    return { success: true };
  }
}

/**
 * Request password reset email.
 */
export async function resetPasswordOnServer(email: string): Promise<{
  success: boolean;
  message: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const url = getJwtApiUrl("users/reset-password");
  const authKey = getAuthKey();

  const body: Record<string, unknown> = {
    email: cleanEmail,
  };
  if (authKey) body.AUTH_KEY = authKey;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (res.ok && json?.success !== false) {
      return {
        success: true,
        message: (json?.message as string) || "Password reset instructions have been sent to your email.",
      };
    }

    // Fallback: WordPress Lost Password form
    const formParams = new URLSearchParams();
    formParams.append("user_login", cleanEmail);
    formParams.append("wp-submit", "Get New Password");

    const wpRes = await fetch(`${getBaseUrl()}/wp-login.php?action=lostpassword`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formParams.toString(),
      redirect: "manual",
    });

    if (wpRes.status === 302 || wpRes.status === 200) {
      return {
        success: true,
        message: "Password reset instructions have been sent to your email.",
      };
    }

    return {
      success: false,
      message: extractErrorMessage(json, wpRes.status),
    };
  } catch (error: unknown) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to submit password reset request",
    };
  }
}
