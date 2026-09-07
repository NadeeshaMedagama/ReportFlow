/**
 * Minimal typed fetch wrapper for the NestJS API.
 * - attaches the JWT from localStorage
 * - normalises NestJS error payloads into ApiError
 * - broadcasts an event on 401 so the auth provider can log the user out
 */
const DEFAULT_API_URL = 'http://localhost:4000';
const ABSOLUTE_URL = /^https?:\/\//i;

/**
 * Base for every API request, with any trailing slash removed. Two shapes are
 * supported:
 *
 * - an absolute origin ("http://localhost:4000") - used in local development,
 *   where the browser talks to the NestJS server directly and CORS applies;
 * - a same-origin path ("/api") - used on Vercel, where the rewrite in
 *   next.config.ts proxies the request on to the API deployment. Requests then
 *   never leave the page's own origin, so there is no CORS preflight and
 *   preview deployments work without registering their generated hostnames.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, '');
const TOKEN_KEY = 'reportflow.token';
export const UNAUTHORIZED_EVENT = 'reportflow:unauthorized';

export const tokenStore = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage unavailable (private mode) - session will not persist */
    }
  },
  clear() {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

/**
 * Joins the API base with a request path and appends the query string.
 *
 * `new URL(path, base)` cannot be used directly: an absolute path resolves
 * against the base's *origin*, so a base carrying a path ("/api", or
 * "https://host/api") would have that path silently dropped. Paths are
 * concatenated first, and URL is used only to serialise the query.
 *
 * A relative base yields a relative URL, which `fetch` resolves against the
 * current page - browser only, which is all this module ever runs in.
 */
export function buildUrl(path: string, query: Query = {}): string {
  const relative = !ABSOLUTE_URL.test(API_URL);
  // The placeholder base only exists so URL can parse a relative input; it is
  // stripped again below and never reaches the network.
  const url = new URL(`${API_URL}${path}`, relative ? 'http://relative.invalid' : undefined);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return relative ? `${url.pathname}${url.search}` : url.toString();
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Query;
  /** Skip the Authorization header (login / register). */
  anonymous?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query ?? {});

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = options.anonymous ? null : tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError('Cannot reach the API. Is the backend running?', 0);
  }

  const data = response.status === 204 ? null : await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && token) {
      tokenStore.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    const rawMessage = (data as { message?: string | string[] } | null)?.message;
    const details = Array.isArray(rawMessage) ? rawMessage : [];
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('. ')
      : rawMessage || `Request failed (${response.status})`;
    throw new ApiError(message, response.status, details);
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong';
}
