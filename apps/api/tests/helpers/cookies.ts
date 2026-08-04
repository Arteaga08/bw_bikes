/**
 * Supertest doesn't keep a cookie jar between requests — these parse a
 * response's `Set-Cookie` headers into a plain map and rebuild a `Cookie`
 * header for the next request. Deliberately ignores attributes (path,
 * maxAge, ...): tests control exactly which cookies they resend, which is
 * more precise than relying on a browser's path-scoping to do it for them.
 */
export function parseCookies(res: { headers: Record<string, unknown> }): Record<string, string> {
  const raw = res.headers["set-cookie"] as string[] | undefined;
  const cookies: Record<string, string> = {};
  for (const entry of raw ?? []) {
    const pair = entry.split(";")[0] ?? "";
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) continue;
    const name = pair.slice(0, separatorIndex);
    const value = pair.slice(separatorIndex + 1);
    cookies[name] = value;
  }
  return cookies;
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}
