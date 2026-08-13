import type { NextConfig } from "next";

/**
 * Every browser request the dashboard makes stays same-origin: the API is
 * never called directly from client code. This is what lets the backend's
 * cookies (`HttpOnly` + `Secure` + `SameSite=strict`, host-only, no `Domain`
 * attribute) reach the browser as first-party cookies of *this* origin
 * instead of a separate API host — see the M8 plan for the full rationale.
 * It also means CORS never needs to be relaxed for the dashboard's own
 * traffic; `apps/api`'s CORS whitelist stays exactly as strict as it is
 * today, guarding only direct access to the API from other origins.
 *
 * `API_URL` is a server-only env var (never `NEXT_PUBLIC_*` — the browser
 * never needs to know the API's real address).
 */
function apiUrl(): string {
  const url = process.env["API_URL"];
  if (!url) {
    throw new Error("[next.config] Missing required environment variable: API_URL");
  }
  return url;
}

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl()}/api/v1/:path*`,
      },
    ];
  },
  images: {
    // The catalog gallery (M10) renders `ProductImage.url` — Cloudinary's
    // canonical delivery URL — via `next/image`. The hostname is fixed
    // regardless of account (`buildImageUrl` in packages/shared bakes the
    // cloud name into the *path*, not the host), so this doesn't depend on
    // which Cloudinary account is configured.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
};

export default nextConfig;
