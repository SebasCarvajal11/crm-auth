import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { Context } from "hono";

export const REFRESH_COOKIE_PATH = "/auth/refresh";
export const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export const setRefreshCookie = (c: Context, token: string) => {
  setCookie(c, "refresh_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE,
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
