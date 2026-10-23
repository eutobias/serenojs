/**
 * Small helpers for auth API route handlers (standard Request/Response).
 */

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const data = await request.json();
      return data && typeof data === "object"
        ? (data as Record<string, unknown>)
        : {};
    }
    const form = await request.formData();
    return Object.fromEntries(form.entries());
  } catch {
    return {};
  }
}

/** Whether the caller expects a JSON response rather than a redirect. */
export function wantsJson(request: Request): boolean {
  const contentType = request.headers.get("content-type") ?? "";
  const accept = request.headers.get("accept") ?? "";
  return contentType.includes("application/json") || accept.includes("application/json");
}

/** Build a redirect response carrying the given (cookie) headers. */
export function redirectWith(location: string, headers: Headers): Response {
  headers.set("Location", location);
  return new Response(null, { status: 303, headers });
}
