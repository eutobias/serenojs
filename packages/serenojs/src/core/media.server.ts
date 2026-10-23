/**
 * Media uploads stored on disk under `public/files`.
 *
 * Values persisted in the DB are served URLs (`/files/<name>`). Uploads are
 * validated against the field's `accept` / `maxSize` config in the collection
 * descriptor, and always blocked for executable/HTML-ish extensions.
 *
 * In production Waku serves `dist/public` statically, so runtime uploads are
 * streamed by the `GET /files/[...path]` route reading this directory.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { randomBytes } from "node:crypto";

import {
  BLOCKED_EXTENSIONS,
  DEFAULT_MAX_SIZE,
  UPLOAD_URL_PREFIX,
  acceptList,
  extensionOf,
  isAllowedType,
} from "./media.js";
import type { FieldDef } from "./types.js";

export const UPLOADS_DIR = resolve(process.cwd(), "public/files");

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json; charset=utf-8",
  zip: "application/zip",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export class MediaError extends Error {
  status: number;
  constructor(message: string, status = 422) {
    super(message);
    this.status = status;
  }
}

export function contentTypeFor(name: string): string {
  return CONTENT_TYPES[extensionOf(name)] ?? "application/octet-stream";
}

export type StoredUpload = {
  url: string;
  name: string;
  size: number;
  type: string;
};

export async function saveUpload(
  file: File,
  field: FieldDef,
): Promise<StoredUpload> {
  const ext = extensionOf(file.name);
  if (!ext) {
    throw new MediaError("Arquivo sem extensão não é permitido.");
  }
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new MediaError("Tipo de arquivo não permitido.");
  }
  if (!isAllowedType(field, file.name, file.type || contentTypeFor(file.name))) {
    throw new MediaError(
      `Tipo de arquivo não permitido. Aceitos: ${acceptList(field).join(", ")}.`,
    );
  }

  const maxSize = field.maxSize ?? DEFAULT_MAX_SIZE;
  if (file.size > maxSize) {
    const mb = (maxSize / 1024 / 1024).toFixed(1);
    throw new MediaError(`Arquivo maior que o limite de ${mb} MB.`, 413);
  }

  const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
  mkdirSync(UPLOADS_DIR, { recursive: true });
  writeFileSync(join(UPLOADS_DIR, name), Buffer.from(await file.arrayBuffer()));

  return {
    url: `${UPLOAD_URL_PREFIX}${name}`,
    name,
    size: file.size,
    type: contentTypeFor(name),
  };
}

/** Resolve a stored name to a safe path inside `UPLOADS_DIR`, or null. */
export function resolveUploadPath(name: string): string | null {
  const safe = basename(name);
  if (!safe || safe !== name || safe.startsWith(".")) return null;
  const path = join(UPLOADS_DIR, safe);
  if (!path.startsWith(UPLOADS_DIR)) return null;
  return existsSync(path) && statSync(path).isFile() ? path : null;
}

export function readUpload(name: string): Buffer | null {
  const path = resolveUploadPath(name);
  return path ? readFileSync(path) : null;
}

export function deleteByUrl(url: string): boolean {
  if (!url.startsWith(UPLOAD_URL_PREFIX)) return false;
  const path = resolveUploadPath(url.slice(UPLOAD_URL_PREFIX.length));
  if (!path) return false;
  try {
    unlinkSync(path);
    return true;
  } catch {
    return false;
  }
}
