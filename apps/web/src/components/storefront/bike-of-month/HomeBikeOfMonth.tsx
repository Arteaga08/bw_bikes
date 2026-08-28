import type { PublicBikeOfMonth } from "@bw-bikes/shared";
import { publicApiFetch } from "@/lib/api/public";
import { ApiError } from "@/lib/api/error";
import { HomeBikeOfMonthBanner } from "./HomeBikeOfMonthBanner";

/**
 * Server Component: the home's "bici del mes" banner (M12), after
 * `HomeCategoryCtas`. Same fetch/degrade contract as every other home
 * section: no banner configured (missing image, title, or a working link to
 * the chosen bike) just means this renders nothing.
 */
export async function HomeBikeOfMonth() {
  let bikeOfMonth: PublicBikeOfMonth | null = null;
  try {
    const res = await publicApiFetch<{ bikeOfMonth: PublicBikeOfMonth | null }>("/content/bike-of-month", {
      tags: ["bike-of-month"],
    });
    bikeOfMonth = res.data.bikeOfMonth;
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    bikeOfMonth = null;
  }

  if (!bikeOfMonth) return null;

  return (
    <section className="bg-blanco">
      <HomeBikeOfMonthBanner bikeOfMonth={bikeOfMonth} />
    </section>
  );
}
