/**
 * Base API client for ALTER EGO backend.
 *
 * All API calls go through this client so that:
 * - Auth headers are attached automatically
 * - Errors are handled consistently
 * - Retry logic is centralised
 * - The base URL is configured in one place
 *
 * Usage:
 *   import { apiClient } from '@/services/api'
 *   const data = await apiClient.get('/missions/today')
 *   const result = await apiClient.post('/missions/complete', { mission_id: '...' })
 */

/** Single Supabase client — session must match this instance everywhere. */
import { supabase } from '@/utils/supabase';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

// How many times to retry a failed request
const MAX_RETRIES = 3;
// Delay between retries in ms (doubles each retry)
const RETRY_BASE_DELAY = 500;

// Error types the app can handle specifically
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(message = 'No internet connection') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class AuthError extends Error {
  constructor(message = 'Session expired. Please sign in again.') {
    super(message);
    this.name = 'AuthError';
  }
}

// ── Core fetch wrapper ───────────────────────────────────────────────────

async function getAuthHeader(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    return `Bearer ${session.access_token}`;
  }
  return null;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES
): Promise<Response> {
  try {
    const response = await fetch(url, options);
    return response;
  } catch {
    // Network failure (no connection, timeout, etc.)
    if (retries <= 0) throw new NetworkError();

    // Exponential backoff
    const delay = RETRY_BASE_DELAY * (MAX_RETRIES - retries + 1);
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithRetry(url, options, retries - 1);
  }
}

async function request<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  options: { skipAuth?: boolean; skipRetry?: boolean } = {}
): Promise<T> {
  const authHeader = options.skipAuth ? null : await getAuthHeader();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (authHeader) headers['Authorization'] = authHeader;

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const url = `${BASE_URL}${path}`;

  const response = options.skipRetry
    ? await fetch(url, fetchOptions)
    : await fetchWithRetry(url, fetchOptions);

  // Handle auth expiry
  if (response.status === 401) {
    // Try refreshing the session once
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) {
        // Common when local storage has stale tokens after auth/backend changes
        const msg = String((error as { message?: string }).message || error);
        if (
          msg.toLowerCase().includes('invalid refresh token') ||
          msg.toLowerCase().includes('refresh token not found')
        ) {
          await supabase.auth.signOut({ scope: 'local' });
        }
        throw new AuthError();
      }
      const session = data?.session ?? null;
      if (session?.access_token) {
        // Retry with fresh token
        (headers as Record<string, string>)['Authorization'] =
          `Bearer ${session.access_token}`;
        const retryResponse = await fetch(url, { ...fetchOptions, headers });
        if (retryResponse.status === 401) throw new AuthError();
        return parseResponse<T>(retryResponse);
      }
      throw new AuthError();
    } catch (e) {
      // Some Supabase errors can throw (AuthApiError)
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.toLowerCase().includes('invalid refresh token') ||
        msg.toLowerCase().includes('refresh token not found')
      ) {
        await supabase.auth.signOut({ scope: 'local' });
      }
      throw new AuthError();
    }
  }

  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  // No content
  if (response.status === 204) return undefined as T;

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      'PARSE_ERROR',
      'Invalid response from server'
    );
  }

  if (!response.ok) {
    const errorData = data as {
      detail?: string | { error?: string; message?: string };
    };
    let message = 'Something went wrong';
    let code = 'UNKNOWN_ERROR';

    if (typeof errorData.detail === 'string') {
      message = errorData.detail;
    } else if (typeof errorData.detail === 'object' && errorData.detail) {
      message = errorData.detail.message ?? message;
      code = errorData.detail.error ?? code;
    }

    throw new ApiError(response.status, code, message, data);
  }

  return data as T;
}

// ── Public API client ─────────────────────────────────────────────────────

export const apiClient = {
  get: <T = unknown>(path: string) => request<T>('GET', path),

  post: <T = unknown>(path: string, body?: unknown) =>
    request<T>('POST', path, body),

  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>('PUT', path, body),

  patch: <T = unknown>(path: string, body?: unknown) =>
    request<T>('PATCH', path, body),

  delete: <T = unknown>(path: string) => request<T>('DELETE', path),
};

// ── Error helpers ─────────────────────────────────────────────────────────

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isAuthError(error: unknown): error is AuthError {
  return error instanceof AuthError;
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof NetworkError)
    return 'No internet connection. Check your network and try again.';
  if (error instanceof AuthError)
    return 'Your session expired. Please sign in again.';
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
