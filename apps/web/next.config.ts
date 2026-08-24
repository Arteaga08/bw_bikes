import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";

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
  // Same rationale as `app.disable("x-powered-by")` on the API side: no
  // reason to tell the world which framework served the response.
  poweredByHeader: false,
  experimental: {
    // `@phosphor-icons/react` is a barrel export — every one of this app's
    // 40+ `import { Foo } from "@phosphor-icons/react"` call sites pulls
    // through the package's single entry point, and it isn't on Next's own
    // default `optimizePackageImports` list (verified against the installed
    // `next` build). This rewrites each barrel import into the equivalent
    // per-icon import at build time, so a route that uses 3 icons ships 3
    // icon modules instead of tree-shaking depending on it — the same
    // transform this option applies out of the box to `lucide-react` et al.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiUrl()}/api/v1/:path*`,
      },
    ];
  },
  // Baseline response headers for an internal admin panel. No `script-src`/
  // `default-src` CSP here on purpose: this app has no `dangerouslySetInnerHTML`
  // and no third-party scripts today, but a real script-src policy needs
  // nonces threaded through middleware and verifying against Next's hydration
  // inline scripts — a change that needs browser testing before it ships, not
  // a drive-by header. `frame-ancestors 'none'` alone is safe: it only blocks
  // this app from being framed, which nothing here relies on.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
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

/**
 * Wraps the config with `@next/bundle-analyzer`'s treemap generator — a
 * no-op unless `ANALYZE=1` is set, so this never adds cost to a normal
 * `pnpm build`. Run `ANALYZE=1 pnpm --filter @bw-bikes/web build` and it
 * opens a client/server/edge treemap after the build finishes.
 */
const withBundleAnalyzer = createBundleAnalyzer({ enabled: process.env["ANALYZE"] === "1" });

export default withBundleAnalyzer(nextConfig);
