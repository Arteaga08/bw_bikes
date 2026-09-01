import type { OrderLineSnapshot } from "@bw-bikes/shared";
import { buildImageUrl } from "@bw-bikes/shared";
import Image from "next/image";
import { cloudinaryCloudName } from "@/lib/config";
import { formatCurrencyCents } from "@/lib/format";

export interface OrderLinesListProps {
  lines: OrderLineSnapshot[];
}

/**
 * `imagePublicId` is the only image field frozen on the snapshot (never a
 * baked URL, per `OrderLineSnapshot`'s own comment) — resolved here rather
 * than re-fetched from the catalog, so a discontinued product still renders.
 */
export function OrderLinesList({ lines }: OrderLinesListProps) {
  return (
    <ul className="flex flex-col gap-md">
      {lines.map((line, index) => (
        <li key={`${line.sku}-${index}`} className="flex gap-md">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-control bg-blanco">
            {line.imagePublicId ? (
              <Image
                src={buildImageUrl(cloudinaryCloudName(), line.imagePublicId, { width: 160 })}
                alt={line.name}
                fill
                sizes="80px"
                className="object-contain"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-body text-eyebrow uppercase text-grafito">{line.brand}</p>
            <p className="font-ui text-ui text-negro">{line.name}</p>
            <p className="font-body text-caption text-grafito">
              {[line.size, line.color].filter(Boolean).join(" · ")}
              {line.size || line.color ? " · " : ""}
              Cantidad: {line.qty}
            </p>
          </div>
          <p className="shrink-0 font-body text-body text-negro">{formatCurrencyCents(line.lineTotalCents)}</p>
        </li>
      ))}
    </ul>
  );
}
