import type { Metadata } from "next";
import { BikeComparator } from "@/components/storefront/comparator/BikeComparator";
import { ApiError } from "@/lib/api/error";
import { getComparatorSeed } from "@/lib/api/public-catalog";

export const metadata: Metadata = {
  title: "Comparar bicicletas",
  description:
    "Compara dos bicicletas lado a lado — precio, cuadro, transmisión y frenos — y decide cuál te conviene.",
};

/**
 * The bike comparator (M12). A page of its own rather than a home section:
 * a side-by-side spec sheet is a considered, mid-funnel task, and dropping
 * it into the middle of the home would interrupt the visitor who came to
 * browse. The home links here through `HomeComparatorBanner`.
 *
 * Same degrade contract as every storefront section: an unreachable catalog,
 * or a catalog without two photographed bikes, renders an explanation rather
 * than an error screen or a half-empty comparison.
 */
export default async function CompararPage() {
  let seed: Awaited<ReturnType<typeof getComparatorSeed>> = { options: [], initialPair: null };
  try {
    seed = await getComparatorSeed();
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  }

  return (
    <section className="bg-base py-3xl">
      <div className="mx-auto w-full max-w-[72rem] px-lg">
        <h1 className="font-display text-h2 font-extrabold uppercase text-negro sm:text-h1">
          Compara antes de decidir
        </h1>
        <p className="mt-md max-w-[34rem] font-body text-body-l text-grafito">
          Elige dos bicicletas y mira sus fichas técnicas enfrentadas, dato por dato.
        </p>

        {seed.initialPair ? (
          <div className="mt-2xl">
            <BikeComparator options={seed.options} initialPair={seed.initialPair} />
          </div>
        ) : (
          <p className="mt-2xl font-body text-body text-grafito">
            Todavía no hay suficientes bicicletas publicadas para comparar. Vuelve pronto.
          </p>
        )}
      </div>
    </section>
  );
}
