import { timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { env } from "../config/env.js";

/**
 * Resolves the identity a rate limiter should key on.
 *
 * ## Why this exists instead of `req.ip`
 *
 * `req.ip` derives from `X-Forwarded-For` whenever `trust proxy` is set, and
 * that header is attacker-controlled on **both** paths into this API:
 *
 * 1. **Directly.** The API is deployed on its own public hostname
 *    (`API_URL=https://api.blackandwhitebikes.com`), so anyone can `curl` it
 *    with a forged `X-Forwarded-For`. CORS does not stop this — CORS is
 *    enforced by browsers, not by the server — and `verifyOrigin` lets through
 *    any request carrying neither `Origin` nor `Referer`, which is exactly
 *    what a scripted request looks like.
 * 2. **Through the storefront proxy.** Next's rewrite forwards a
 *    client-supplied `X-Forwarded-For` verbatim: `base-server.js` fills it in
 *    with `??=` (so an existing value survives untouched) and the underlying
 *    proxy never appends the real address, because Next does not enable its
 *    `xfwd` option. Verified empirically against `next@16.3.0`.
 *
 * Keying on that header means every limiter — login 5/15min included — is
 * bypassed by rotating a header, which is unlimited password brute force. So
 * this module never reads `X-Forwarded-For` at all.
 *
 * ## What it trusts instead
 *
 * The transport-level peer address, which cannot be forged over TCP, unless
 * the request carries proof that it came through our own proxy: a
 * `x-bw-proxy-token` matching `PROXY_SHARED_SECRET`. Only then is the
 * `x-bw-client-ip` that the proxy stamped believed. An attacker cannot mint
 * that token, and a forged one fails the comparison, so the fallback keys them
 * by their real socket address either way.
 */

/** Real client address, stamped by the storefront proxy. Believed only alongside a valid proxy token. */
const CLIENT_IP_HEADER = "x-bw-client-ip";

/** Proof that a request came through the storefront proxy rather than straight off the internet. */
const PROXY_TOKEN_HEADER = "x-bw-proxy-token";

/**
 * IPv6 is handed out in /64 blocks, so a single subscriber typically controls
 * 2^64 addresses and can rotate through them freely. Keying on the full
 * address would let one attacker occupy an unbounded number of buckets;
 * collapsing to the /64 makes their whole allocation share one. IPv4 has no
 * equivalent problem — an address there is genuinely scarce.
 *
 * `express-rate-limit@7` keys the full IPv6 address; the /64 aggregation only
 * became its default in v8.
 */
const IPV6_PREFIX_HEXTETS = 4;
const IPV6_TOTAL_HEXTETS = 8;

const IPV4_MAPPED_PATTERN = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;
const HEXTET_PATTERN = /^[0-9a-f]{1,4}$/i;

/**
 * Reads a header as a single string. A repeated header arrives as an array,
 * which is never something our own proxy produces — treating it as absent
 * keeps an attacker from smuggling a second value past the checks below.
 */
function readHeader(req: Request, name: string): string | undefined {
  const raw = req.headers[name];
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Constant-time comparison, so the token cannot be recovered byte by byte by
 * timing the responses. Length is compared first because `timingSafeEqual`
 * throws on a length mismatch — that leak is only the secret's length, which
 * is not sensitive.
 */
function isFromTrustedProxy(req: Request): boolean {
  const secret = env.proxySharedSecret;
  if (secret === "") return false;

  const token = readHeader(req, PROXY_TOKEN_HEADER);
  if (token === undefined) return false;

  const provided = Buffer.from(token, "utf8");
  const expected = Buffer.from(secret, "utf8");
  if (provided.length !== expected.length) return false;

  return timingSafeEqual(provided, expected);
}

/** Expands `::` elision into the full 8 hextets. Returns null if the address is malformed. */
function expandIpv6(address: string): string[] | null {
  const [bare = ""] = address.split("%");
  const hasElision = bare.includes("::");
  const [headRaw = "", tailRaw = ""] = bare.split("::");

  const head = headRaw === "" ? [] : headRaw.split(":");
  const tail = !hasElision || tailRaw === "" ? [] : tailRaw.split(":");

  if (!hasElision) {
    return head.length === IPV6_TOTAL_HEXTETS && head.every((part) => HEXTET_PATTERN.test(part)) ? head : null;
  }

  const missing = IPV6_TOTAL_HEXTETS - head.length - tail.length;
  if (missing < 0) return null;

  const expanded = [...head, ...Array<string>(missing).fill("0"), ...tail];
  return expanded.every((part) => HEXTET_PATTERN.test(part)) ? expanded : null;
}

/**
 * Collapses an address to the unit a limiter should count against: the address
 * itself for IPv4, the /64 prefix for IPv6. An address that parses as neither
 * is returned unchanged — it still works as a bucket key, which is all a
 * limiter needs.
 */
export function normalizeIpKey(address: string): string {
  const mapped = IPV4_MAPPED_PATTERN.exec(address);
  if (mapped?.[1] !== undefined) return mapped[1];

  if (!address.includes(":")) return address;

  const hextets = expandIpv6(address);
  if (hextets === null) return address;

  const prefix = hextets
    .slice(0, IPV6_PREFIX_HEXTETS)
    .map((part) => parseInt(part, 16).toString(16))
    .join(":");

  return `${prefix}::/64`;
}

/**
 * The rate-limit key for a request. Never derived from `X-Forwarded-For` —
 * see this module's header comment.
 */
export function resolveClientKey(req: Request): string {
  if (isFromTrustedProxy(req)) {
    const forwarded = readHeader(req, CLIENT_IP_HEADER);
    if (forwarded !== undefined) return normalizeIpKey(forwarded);
  }

  return normalizeIpKey(req.socket.remoteAddress ?? "unknown");
}

export { CLIENT_IP_HEADER, PROXY_TOKEN_HEADER };
