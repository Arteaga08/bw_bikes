import { apiInternalUrl, proxySharedSecret } from "@/lib/config";

/**
 * Same-origin proxy to `apps/api`, replacing the declarative `rewrites()`
 * entry `next.config.ts` used to carry. A rewrite cannot inspect or rewrite
 * request headers; this can, which is the whole reason it exists.
 *
 * ## What this defends against
 *
 * The API keys every rate limiter (login, checkout, coupon guessing, …) on a
 * client identity — see `apps/api/src/utils/client-ip.ts` for the full
 * reasoning. That identity must not be something the caller can dictate, or
 * every limit is bypassed by rotating a header. A plain rewrite forwarded
 * whatever `X-Forwarded-For` the browser sent verbatim (confirmed against
 * the installed `next@16` — `base-server.js` only fills the header with
 * `??=` when absent, and the underlying proxy never overwrites an existing
 * one), which made login's 5-attempts-per-15-minutes ceiling unlimited for
 * anyone willing to rotate a header value.
 *
 * So every request this handler forwards:
 *   1. has any client-supplied `x-forwarded-for` / `x-real-ip` /
 *      `x-client-ip` / `x-bw-client-ip` / `x-bw-proxy-token` stripped —
 *      those names are never trusted from the browser side, only ever set
 *      by us, below;
 *   2. gets a fresh `x-bw-client-ip` stamped with the address this handler
 *      resolves as the real caller;
 *   3. gets `x-bw-proxy-token` stamped with `PROXY_SHARED_SECRET`, so the API
 *      can tell "this came through our own proxy, the client-ip claim is
 *      real" from "this hit the API directly, trust nothing it claims."
 *
 * ## The one assumption this still carries
 *
 * `resolveClientIp` below reads `X-Forwarded-For` off the incoming request —
 * the same header this whole file exists to stop trusting blindly. The
 * difference is *where* it is read: by the time it reaches this handler,
 * Next's own request lifecycle has already set it to either (a) the real
 * peer address, if nothing sent one, or (b) whatever the nearest hop in
 * front of this Node process put there. That is only trustworthy if that
 * hop — a platform edge, a CDN, a load balancer — overwrites the header
 * rather than appending to whatever the browser sent. Vercel's edge does
 * this unconditionally; a bare Node process with nothing in front of it does
 * not, and neither does a naively configured nginx (`proxy_set_header
 * X-Forwarded-For $proxy_add_x_forwarded_for` *appends*; the fix is
 * `$remote_addr`, which overwrites). This is not a gap specific to this
 * file — `apps/api`'s own `trust proxy` setting carries the identical
 * requirement one hop further in — it is the standard obligation of running
 * anything behind a reverse proxy, and it must hold for whatever sits
 * directly in front of this app in production.
 */

export const dynamic = "force-dynamic";

/** Request headers never forwarded upstream — either hop-by-hop, or ones only this handler is allowed to set. */
const STRIPPED_REQUEST_HEADERS = new Set([
  "host",
  "connection",
  "content-length",
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-port",
  "x-forwarded-proto",
  "x-real-ip",
  "x-client-ip",
  "x-bw-client-ip",
  "x-bw-proxy-token",
]);

/** Response headers never relayed back to the browser — connection framing the two hops don't share. */
const STRIPPED_RESPONSE_HEADERS = new Set(["connection", "keep-alive", "transfer-encoding", "content-length", "set-cookie"]);

function resolveClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  // Local dev (`next dev`, no edge in front) never populates X-Forwarded-For.
  // The API's own fallback (raw socket address) still applies in that case,
  // since no proxy token is sent below either.
  return "";
}

function buildUpstreamHeaders(request: Request, clientIp: string): Headers {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }

  // An empty secret (PROXY_SHARED_SECRET unset — the API's own default
  // outside production) means neither header can do anything useful: the API
  // never accepts an empty token as proof of anything, so it would ignore
  // x-bw-client-ip regardless. Omitting both here just avoids sending a claim
  // nobody is going to believe.
  const secret = proxySharedSecret();
  if (secret) {
    headers.set("x-bw-proxy-token", secret);
    if (clientIp) headers.set("x-bw-client-ip", clientIp);
  }

  return headers;
}

function buildDownstreamHeaders(upstream: Response): Headers {
  const headers = new Headers();
  for (const [key, value] of upstream.headers) {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) headers.set(key, value);
  }

  // Iterating `Headers` combines every repeated header into one comma-joined
  // value — correct for most headers, but wrong for Set-Cookie (a comma can
  // appear inside a cookie's own `Expires` attribute) and it would collapse
  // an access-token cookie and a refresh-token cookie into one unparseable
  // line. `getSetCookie()` exists specifically to hand them back as an array
  // instead, one `append` per cookie.
  for (const cookie of upstream.headers.getSetCookie()) {
    headers.append("set-cookie", cookie);
  }

  return headers;
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await context.params;
  const upstreamUrl = new URL(`/api/v1/${path.join("/")}${new URL(request.url).search}`, apiInternalUrl());

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers: buildUpstreamHeaders(request, resolveClientIp(request)),
    // GET/HEAD must not carry a body — Next's Request still exposes an empty
    // stream for them, and undici rejects a body on those methods outright.
    body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
    // Required by fetch whenever `body` is a stream, browsers and undici
    // alike — without it, streaming a multipart upload through (the admin
    // gallery's file inputs) would have to buffer the whole file in memory
    // first instead of piping it. `@types/node`'s `RequestInit` doesn't know
    // this field yet even though Node's own `fetch` (undici) has supported it
    // since Node 18; the cast is the standard workaround.
    duplex: "half",
    redirect: "manual",
  } as RequestInit & { duplex: "half" });

  return new Response(upstream.body, { status: upstream.status, headers: buildDownstreamHeaders(upstream) });
}

export {
  proxy as DELETE,
  proxy as GET,
  proxy as PATCH,
  proxy as POST,
  proxy as PUT,
};
