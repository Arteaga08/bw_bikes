import { revalidateTag } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/config";

/**
 * On-demand cache-buster for the home's "bici del mes" banner (M12) — same
 * shape and same guard as `revalidate/home-tiles/route.ts`, see that file's
 * comment for the full reasoning.
 */
export async function POST(): Promise<NextResponse> {
  const cookieStore = await cookies();
  if (!cookieStore.get(ACCESS_TOKEN_COOKIE)) {
    return NextResponse.json({ status: "fail", message: "No autenticado." }, { status: 401 });
  }

  revalidateTag("bike-of-month", "max");
  return NextResponse.json({ status: "success", message: "Cache invalidada.", data: null });
}
