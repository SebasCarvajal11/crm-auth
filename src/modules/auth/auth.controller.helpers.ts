import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";
import { env } from "../../config/env";

export const REFRESH_COOKIE_PATH = env.REFRESH_COOKIE_PATH;
export const REFRESH_COOKIE_MAX_AGE = Math.floor(env.REFRESH_TOKEN_TTL_MS / 1000);

export const isSecureCookie = (_c?: Context): boolean => {
  if (env.REFRESH_COOKIE_SECURE !== undefined) {
    return env.REFRESH_COOKIE_SECURE;
  }
  if (env.APP_ENV === "staging" && env.APP_PUBLIC_URL.startsWith("http://")) {
    return false;
  }
  return process.env.NODE_ENV === "production";
};

export interface SetRefreshCookieOptions {
  isPersistent?: boolean;
}

export const setRefreshCookie = (
  c: Context,
  token: string,
  options?: SetRefreshCookieOptions
) => {
  const isPersistent = options?.isPersistent ?? false;
  setCookie(c, "refresh_token", token, {
    httpOnly: true,
    secure: isSecureCookie(c),
    sameSite: "Lax",
    path: REFRESH_COOKIE_PATH,
    ...(isPersistent ? { maxAge: REFRESH_COOKIE_MAX_AGE } : {}),
  });
};

export const deleteRefreshCookie = (c: Context) => {
  deleteCookie(c, "refresh_token", { path: REFRESH_COOKIE_PATH });
};

export const getRefreshCookie = (c: Context) => getCookie(c, "refresh_token");

const normalizeIpCandidate = (value: string | undefined): string | null => {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  if (!first) return null;
  if (first.toLowerCase() === "unknown") return null;
  return first;
};

export const getIp = (c: Context) =>
  normalizeIpCandidate(c.req.header("x-forwarded-for")) ??
  normalizeIpCandidate(c.req.header("x-real-ip")) ??
  normalizeIpCandidate(c.req.header("cf-connecting-ip")) ??
  normalizeIpCandidate(c.req.header("x-client-ip")) ??
  "unknown";

export const getUa = (c: Context) => c.req.header("user-agent") ?? "unknown";
