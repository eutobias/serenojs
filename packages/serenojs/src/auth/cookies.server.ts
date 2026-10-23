/**
 * Cookie helpers for the plain `Request`/`Response` world of API routes.
 *
 * Middleware runs on Hono and uses `hono/cookie`'s context helpers instead;
 * both sides share the names/TTLs in `./config`.
 */
import { generateCookie } from "hono/cookie";

import {
  ACCESS_COOKIE,
  ACCESS_TTL_SECONDS,
  COOKIE_SECURE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
} from "./config.js";
import type { SessionTokens } from "./auth.server.js";

export function parseCookies(header: string | null | undefined): Record<string, string> {
  const jar: Record<string, string> = {};
  if (!header) return jar;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    const value = part.slice(index + 1).trim();
    try {
      jar[name] = decodeURIComponent(value);
    } catch {
      jar[name] = value;
    }
  }
  return jar;
}

export function readCookie(request: Request, name: string): string | undefined {
  return parseCookies(request.headers.get("cookie"))[name];
}

export function readAccessToken(request: Request): string | undefined {
  return readCookie(request, ACCESS_COOKIE);
}

export function readRefreshToken(request: Request): string | undefined {
  return readCookie(request, REFRESH_COOKIE);
}

export function appendAuthCookies(headers: Headers, tokens: SessionTokens): void {
  headers.append(
    "Set-Cookie",
    generateCookie(ACCESS_COOKIE, tokens.accessToken, {
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: COOKIE_SECURE,
      maxAge: ACCESS_TTL_SECONDS,
    }),
  );
  headers.append(
    "Set-Cookie",
    generateCookie(REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: COOKIE_SECURE,
      maxAge: REFRESH_TTL_SECONDS,
    }),
  );
}

export function appendClearedAuthCookies(headers: Headers): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    headers.append(
      "Set-Cookie",
      generateCookie(name, "", {
        httpOnly: true,
        path: "/",
        sameSite: "Lax",
        secure: COOKIE_SECURE,
        maxAge: 0,
      }),
    );
  }
}
