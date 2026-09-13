export interface AuthUser {
  id: string | number;
  email: string;
  username: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
  registeredDate?: string;
}

export interface AuthTokens {
  jwt: string;
  refreshToken?: string;
}

export interface SimpleJwtLoginResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  id?: string | number;
  user?: Record<string, unknown>;
  jwt?: string;
  code?: string;
  error_code?: number | string;
}

export interface AuthActionResult<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  user?: AuthUser;
}
