import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/config";

/**
 * On-demand cache-buster for the public home hero (M12, entrega 2). The
 * public payload is served through `publicApiFetch`'s `next: { revalidate:
 * 300, tags: ["hero-slides"] }`, which keeps the home page ISR-cacheable —
 * good for anonymous traffic, but it means a slide the admin just published
 * would otherwise sit behind a stale cache for up to 5 minutes. Every
 * mutating call in `lib/api/admin-content.ts` hits this route right after a
 * successful write so the change is visible immediately.
 *
 * Guarded by the mere *presence* of the admin's access-token cookie, not a
 * full session/role check: `revalidateTag` only forces the next request to
 * refetch public, already-anonymous data — there is nothing here for a
 * missing 2FA check or an expired token to protect against, so re-deriving
 * `protect`'s full verification would be effort spent on a surface with no
 * real stakes. The cookie check exists only to keep this from being a
 * wide-open, unauthenticated POST endpoint any crawler could hit for free.
 */
export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_TOKEN_COOKIE)) {
    return NextResponse.json({ status: "fail", message: "No autenticado." }, { status: 401 });
  }

  // Next 16 requires a `cacheLife` profile as the second argument — `"max"`
  // per the framework's own migration guide, which marks the tag stale and
  // refetches in the background rather than blocking this response on it.
  revalidateTag("hero-slides", "max");
  return NextResponse.json({ status: "success", message: "Cache invalidada.", data: null });
}
