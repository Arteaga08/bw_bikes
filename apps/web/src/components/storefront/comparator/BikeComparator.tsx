"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Select } from "@/components/ui/Select";
import type { ComparableBike, ComparatorOption } from "@/lib/api/public-catalog";
import { ComparatorColumn } from "./ComparatorColumn";
import { ComparatorSpecs } from "./ComparatorSpecs";
import { buildComparison } from "./comparator-rows";

export interface BikeComparatorProps {
  options: ComparatorOption[];
  initialPair: [ComparableBike, ComparableBike];
}

type Side = "left" | "right";

const LOAD_ERROR = "No pudimos cargar esa bicicleta. Intenta de nuevo.";

/**
 * The comparator's only client island: two pickers over a pair of columns.
 *
 * The initial pair is rendered on the server, so the page is complete and
 * indexable before this component hydrates — nothing here fetches on mount.
 * A change fetches exactly one bike through
 * `app/api/catalog/bikes/[slug]/route.ts` (`publicApiFetch` is server-only),
 * which is what keeps the page from shipping all 100 bikes' spec sheets to
 * the browser just in case.
 *
 * Two failure modes get explicit handling, because both are reachable by a
 * visitor flicking through a `<select>` on a slow connection:
 *
 * - **Out-of-order responses.** Each side keeps a request counter; a response
 *   whose token is no longer current is discarded. Without it, picking A then
 *   B could settle on A when A's response happens to land second.
 * - **A failed load.** The previous bike stays on screen with a message
 *   beside it. Blanking the column would lose the comparison the visitor was
 *   in the middle of reading, and there is nothing useful to put in its place.
 */
export function BikeComparator({ options, initialPair }: BikeComparatorProps) {
  const [bikes, setBikes] = useState<Record<Side, ComparableBike>>({
    left: initialPair[0],
    right: initialPair[1],
  });
  const [loadingSide, setLoadingSide] = useState<Side | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Un contador por lado, no un booleano: identifica *cuál* petición contesta.
  const requestTokens = useRef<Record<Side, number>>({ left: 0, right: 0 });
  const controllers = useRef<Record<Side, AbortController | null>>({ left: null, right: null });

  useEffect(() => {
    const inFlight = controllers.current;
    return () => {
      inFlight.left?.abort();
      inFlight.right?.abort();
    };
  }, []);

  const selectBike = useCallback(async (side: Side, slug: string) => {
    controllers.current[side]?.abort();
    const controller = new AbortController();
    controllers.current[side] = controller;

    const token = requestTokens.current[side] + 1;
    requestTokens.current[side] = token;

    setLoadingSide(side);
    setError(null);

    try {
      const res = await fetch(`/api/catalog/bikes/${encodeURIComponent(slug)}`, {
        signal: controller.signal,
      });
      const body: { data?: { bike?: ComparableBike } } = await res.json();
      const bike = body.data?.bike;
      if (!res.ok || !bike) throw new Error(LOAD_ERROR);

      // Llegó tarde: el visitante ya eligió otra bici de este lado.
      if (requestTokens.current[side] !== token) return;
      setBikes((current) => ({ ...current, [side]: bike }));
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
      if (requestTokens.current[side] !== token) return;
      setError(LOAD_ERROR);
    } finally {
      if (requestTokens.current[side] === token) setLoadingSide(null);
    }
  }, []);

  const groups = buildComparison(bikes.left, bikes.right);

  return (
    <div>
      <div className="grid grid-cols-2 gap-md sm:gap-lg">
        {(["left", "right"] as const).map((side) => {
          const otherSlug = side === "left" ? bikes.right.slug : bikes.left.slug;
          return (
            <Select
              key={side}
              label={side === "left" ? "Primera bicicleta" : "Segunda bicicleta"}
              value={bikes[side].slug}
              onChange={(event) => {
                void selectBike(side, event.target.value);
              }}
            >
              {options.map((option) => (
                <option
                  key={option.slug}
                  value={option.slug}
                  // Elegir la misma bici de los dos lados no compara nada.
                  disabled={option.slug === otherSlug}
                >
                  {option.brandName} · {option.name}
                </option>
              ))}
            </Select>
          );
        })}
      </div>

      {error ? (
        <p role="status" className="mt-md font-body text-body text-estado-error">
          {error}
        </p>
      ) : null}

      <div className="mt-lg grid grid-cols-2 gap-md sm:gap-lg">
        <ComparatorColumn bike={bikes.left} isLoading={loadingSide === "left"} />
        <ComparatorColumn bike={bikes.right} isLoading={loadingSide === "right"} />
      </div>

      <ComparatorSpecs groups={groups} leftName={bikes.left.name} rightName={bikes.right.name} />
    </div>
  );
}
