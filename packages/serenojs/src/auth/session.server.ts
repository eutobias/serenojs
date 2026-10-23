import { unstable_getHeaders as getHeaders } from "waku/router/server";

import { getUserByAccessToken } from "./auth.server.js";
import { ACCESS_COOKIE } from "./config.js";
import type { AuthUser } from "./config.js";
import { parseCookies } from "./cookies.server.js";

export function getCurrentUser(): AuthUser | null {
  try {
    const headers = getHeaders();
    const token = parseCookies(headers["cookie"] ?? "")[ACCESS_COOKIE];
    return token ? getUserByAccessToken(token) : null;
  } catch {
    return null;
  }
}
