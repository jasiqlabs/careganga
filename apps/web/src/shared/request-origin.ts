import type { NextRequest } from "next/server";

export function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  if (origin === request.nextUrl.origin) return true;
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) {
    if (
      origin === `${proto}://${host}` ||
      origin === `https://${host}` ||
      origin === `http://${host}`
    ) {
      return true;
    }
    const hostWithoutPort = host.split(":")[0];
    try {
      const originHost = new URL(origin).host.split(":")[0];
      if (originHost === hostWithoutPort) return true;
    } catch {}
  }
  const publicOrigin = process.env.PUBLIC_SITE_ORIGIN?.replace(/\/$/, "");
  if (publicOrigin && (origin === publicOrigin || origin.startsWith(publicOrigin))) return true;
  return false;
}
