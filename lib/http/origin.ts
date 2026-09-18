import type { NextRequest } from "next/server";

/**
 * Origin yang dilihat browser, untuk redirect internal.
 * `new URL(request.url).origin` bisa ternormalisasi ke `localhost` oleh dev server,
 * padahal browser memakai `127.0.0.1`, sehingga redirect lintas-origin menghilangkan cookie.
 */
export function requestOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") ?? "http";
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}