import helmet from "helmet";

/**
 * Explicit `helmet` configuration, tuned for a pure JSON API rather than
 * helmet's own defaults (which assume the server also serves HTML, and so
 * leave room for `'self'` scripts/styles/fonts that this API never sends).
 *
 * ## Content-Security-Policy
 *
 * `default-src 'none'` — nothing here ever renders a page, so nothing should
 * ever be allowed to load, execute, or connect from a response of this API.
 * A CSP header on a JSON response is inert in the browser sense (there is no
 * document to apply it to), but it is not free: if an attacker ever manages
 * to get this API to reflect or serve attacker-controlled HTML (a
 * misconfigured error page, a future static route), this is what stops it
 * from executing anything. Belt-and-suspenders, not a load-bearing control.
 *
 * ## HSTS
 *
 * A full year (`31536000`s) with `includeSubDomains` and `preload` — long
 * enough, and marked for HSTS preload list submission
 * (https://hstspreload.org). `preload: true` only has effect once the domain
 * is actually submitted and accepted there; setting it here is a
 * prerequisite, not a guarantee.
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  strictTransportSecurity: {
    maxAge: 31_536_000,
    includeSubDomains: true,
    preload: true,
  },
});
