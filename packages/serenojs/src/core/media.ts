/**
 * Isomorphic media helpers (no filesystem): type allowlisting and URL checks.
 * Server disk I/O lives in `media.server.ts`.
 */
import type { FieldDef } from "./types.js";

export const UPLOAD_URL_PREFIX = "/files/";
export const DEFAULT_MAX_SIZE = 10 * 1024 * 1024;

/** Default accepted types when a media field omits `accept`. */
export const DEFAULT_ACCEPT = ["image/*", "application/pdf"];

/** Extensions that are never accepted, even if listed in `accept`. */
export const BLOCKED_EXTENSIONS = new Set([
  "html",
  "htm",
  "xhtml",
  "js",
  "mjs",
  "cjs",
  "php",
  "phtml",
  "exe",
  "sh",
  "bat",
  "cmd",
  "com",
  "jsx",
  "ts",
  "tsx",
]);

const IMAGE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "avif",
  "svg",
  "ico",
]);

export function extensionOf(filename: string): string {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return match ? match[1]!.toLowerCase() : "";
}

/**
 * Accepts a stored media URL: uploaded files (`/files/...`) or committed
 * portfolio assets (`/images/...`). Rejects traversal and external values.
 */
export function isMediaUrl(value: string): boolean {
  if (!value || value.includes("..")) return false;
  return value.startsWith(UPLOAD_URL_PREFIX) || value.startsWith("/images/");
}

export function isImageUrl(url: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(url));
}

export function acceptList(field: FieldDef): string[] {
  return field.accept && field.accept.length > 0 ? field.accept : DEFAULT_ACCEPT;
}

function matches(pattern: string, ext: string, mime: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  if (p.startsWith(".")) return ext === p.slice(1);
  if (p.includes("/")) {
    if (p.endsWith("/*")) return mime.startsWith(p.slice(0, -1));
    return mime === p;
  }
  return ext === p;
}

export function isAllowedType(
  field: FieldDef,
  filename: string,
  mime: string,
): boolean {
  const ext = extensionOf(filename);
  if (!ext || BLOCKED_EXTENSIONS.has(ext)) return false;
  const type = mime.toLowerCase();
  return acceptList(field).some((pattern) => matches(pattern, ext, type));
}

/** `accept` attribute string for the file input (best-effort). */
export function acceptAttribute(field: FieldDef): string {
  return acceptList(field).join(",");
}
