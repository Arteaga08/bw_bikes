import type { PublicBike } from "@bw-bikes/shared";
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/error";
import { publicApiFetch } from "@/lib/api/public";
import { toComparableBike } from "@/lib/api/public-catalog";

/**
 * Reads one bike's comparable projection for the browser.
 *
 * Exists because `publicApiFetch` is server-only — it targets the API's
 * *internal* URL and relies on `next: { revalidate }`, neither of which a
 * client component can use. The comparator needs a fresh bike every time a
 * visitor changes a picker, so it needs a same-origin seam.
 *
 * Deliberately unlike the handlers in `app/api/revalidate/*`: those are POSTs
 * gated on the admin cookie because they mutate cache state. This is a GET
 * that forwards data the public catalog already serves anonymously to anyone
 * — a cookie check here would protect nothing and would break the
 * unauthenticated shopper it exists for. The upstream service still forces
 * `PUBLIC_VISIBILITY` (`apps/api/src/services/product.service.ts`), so an
 * archived or inactive bike 404s here exactly as it does on the PDP, and
 * `publicApiFetch`'s own `revalidate` means repeat picks are served from
 * Next's cache instead of hitting the API again.
 */

/** Mirrors the API's own slug shape. Checked before interpolation — the value lands inside the upstream URL. */
const SLUG_PATTERN = /^[a-z0-9-]{1,120}$/;

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await context.params;

  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ status: "fail", message: "Bicicleta no válida.", data: null }, { status: 400 });
  }

  try {
    const res = await publicApiFetch<{ bike: PublicBike }>(
      `/catalog/bikes/${encodeURIComponent(slug)}`,
      { revalidateSeconds: 300 },
    );
    return NextResponse.json({
      status: "success",
      message: "Bicicleta obtenida.",
      data: { bike: toComparableBike(res.data.bike) },
    });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // El mensaje del API ya viene en español y `error-handler.ts` nunca filtra
    // stack traces en producción, así que se puede reenviar tal cual.
    const status = error.httpStatus === 404 ? 404 : 502;
    return NextResponse.json({ status: "fail", message: error.message, data: null }, { status });
  }
}
