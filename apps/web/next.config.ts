import type { NextConfig } from "next";
import createBundleAnalyzer from "@next/bundle-analyzer";

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
  // Every browser request stays same-origin: `/api/v1/*` is handled by
  // `app/api/v1/[...path]/route.ts`, not by a declarative `rewrites()` proxy
  // — a route handler can inspect and rewrite the request before it reaches
  // `apps/api`, which a rewrite cannot. That is what lets the API tell a
  // request that came through this proxy from one that hit it directly (see
  // that handler's header comment, and `apps/api/src/utils/client-ip.ts`).
  // It's also still what lets the backend's cookies (`HttpOnly` + `Secure` +
  // `SameSite=strict`, host-only, no `Domain` attribute) reach the browser as
  // first-party cookies of *this* origin instead of a separate API host, and
  // still means CORS never needs to relax for the app's own traffic.
  //
  // Baseline response headers for the whole app — the public storefront and
  // the admin panel both live here, not just the panel (this comment used to
  // say "internal admin panel" from back when it was; corrected). No
  // `script-src`/`default-src` CSP here yet: this app has no
  // `dangerouslySetInnerHTML` and no third-party scripts today (audited), but
  // a real script-src policy needs nonces threaded through `proxy.ts` (Next's
  // renamed `middleware.ts`, not present in this repo yet) and verifying
  // against Next's own hydration inline scripts and Stripe.js — a change
  // that needs browser testing before it ships, not a drive-by header.
  // `frame-ancestors 'none'` alone is safe: it only blocks this app from
  // being framed, which nothing here relies on.
  //
  // HSTS, by contrast, needs no such verification — it only ever affects a
  // browser that already reached this app over HTTPS (a plain-HTTP response
  // carrying it is spec-ignored), which is what makes it safe to send
  // unconditionally, matching `apps/api`'s own `securityHeaders` (helmet).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
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
