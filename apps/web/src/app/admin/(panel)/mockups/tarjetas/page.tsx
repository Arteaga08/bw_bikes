import type { ReactNode } from "react";
import { CaretRight, ImagesSquare } from "@phosphor-icons/react/ssr";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrencyCents } from "@/lib/format";
import { MOCK_PRODUCTS, type MockProduct } from "../fixtures";

/**
 * Placeholder for a product photo — real cards will use `next/image` against
 * Cloudinary (already whitelisted in `next.config.ts`), but this mockup has
 * no real asset to load. Same "empty box" convention `BrandsView`'s logo
 * column already uses, with an icon so a photo-led card doesn't read as
 * broken instead of "no photo yet".
 */
function PhotoPlaceholder({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-base text-grafito ${className ?? ""}`} aria-hidden="true">
      <ImagesSquare size={28} />
    </div>
  );
}

function Section({ letter, title, note, children }: { letter: string; title: string; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-lg">
      <div className="flex flex-col gap-xs">
        <h2 className="font-display text-h3 text-negro">
          Variante {letter} · {title}
        </h2>
        <p className="max-w-[65ch] font-body text-caption text-grafito">{note}</p>
      </div>
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/** Variante A — imagen a sangre arriba, cuerpo con jerarquía completa, pie con acciones. */
function CardClean({ product }: { product: MockProduct }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card-lg border border-borde bg-surface">
      <PhotoPlaceholder className="aspect-[4/3] w-full" />
      <div className="flex flex-1 flex-col gap-sm p-md">
        <div className="flex flex-col gap-xs">
          <h3 className="font-ui text-ui text-negro">{product.name}</h3>
          <p className="font-body text-caption text-grafito">
            {product.brand} · {product.category}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          {product.badge ? <Badge variant={product.badge.variant}>{product.badge.label}</Badge> : null}
          <Badge variant={product.status === "active" ? "exito" : "neutral"}>
            {product.status === "active" ? "Activo" : "Archivado"}
          </Badge>
        </div>
        <p className="mt-auto font-ui text-h3 text-negro">{formatCurrencyCents(product.priceCents)}</p>
      </div>
      <div className="flex items-center justify-between gap-sm border-t border-borde p-sm">
        <Button variant="secondary" size="sm">
          Editar
        </Button>
        <Button variant="ghost" size="sm">
          {product.status === "active" ? "Archivar" : "Restaurar"}
        </Button>
      </div>
    </div>
  );
}

/** Variante B — badge y estatus superpuestos en la imagen, cuerpo más corto: cabe más por pantalla. */
function CardOverlay({ product }: { product: MockProduct }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-card-lg border border-borde bg-surface">
      <div className="relative">
        <PhotoPlaceholder className="aspect-[4/3] w-full" />
        {product.badge ? (
          <Badge variant={product.badge.variant} className="absolute left-xs top-xs">
            {product.badge.label}
          </Badge>
        ) : null}
        <span className="absolute right-xs top-xs rounded-control bg-overlay/70 px-sm py-1 font-ui text-badge uppercase text-blanco">
          {product.status === "active" ? "Activo" : "Archivado"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-xs p-md">
        <div className="flex items-baseline justify-between gap-sm">
          <h3 className="font-ui text-ui text-negro">{product.name}</h3>
          <span className="shrink-0 font-ui text-ui text-negro">{formatCurrencyCents(product.priceCents)}</span>
        </div>
        <p className="font-body text-caption text-grafito">{product.brand}</p>
      </div>
      <div className="flex items-center justify-between gap-sm border-t border-borde p-sm">
        <Button variant="secondary" size="sm">
          Editar
        </Button>
        <Button variant="ghost" size="sm">
          {product.status === "active" ? "Archivar" : "Restaurar"}
        </Button>
      </div>
    </div>
  );
}

/** Variante C — imagen cuadrada a la izquierda, datos a la derecha: la más fácil de escanear en volumen. */
function CardHorizontal({ product }: { product: MockProduct }) {
  return (
    <div className="flex overflow-hidden rounded-card-lg border border-borde bg-surface">
      <PhotoPlaceholder className="aspect-square w-28 shrink-0" />
      <div className="flex flex-1 flex-col gap-xs p-md">
        <h3 className="font-ui text-ui text-negro">{product.name}</h3>
        <p className="font-body text-caption text-grafito">
          {product.brand} · {product.category}
        </p>
        <div className="flex flex-wrap items-center gap-xs">
          {product.badge ? <Badge variant={product.badge.variant}>{product.badge.label}</Badge> : null}
          <Badge variant={product.status === "active" ? "exito" : "neutral"}>
            {product.status === "active" ? "Activo" : "Archivado"}
          </Badge>
        </div>
        <div className="mt-auto flex items-center justify-between gap-sm">
          <span className="font-ui text-ui text-negro">{formatCurrencyCents(product.priceCents)}</span>
          <div className="flex items-center gap-xs">
            <Button variant="secondary" size="sm">
              Editar
            </Button>
            <Button variant="ghost" size="sm">
              {product.status === "active" ? "Archivar" : "Restaurar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TarjetasMockupPage() {
  return (
    <>
      <PageHeader
        title="Tarjeta de producto"
        subtitle="Punto 8a — mismos 3 productos falsos en las tres composiciones. Elige mirando, no describiendo."
      />
      <div className="flex flex-col gap-lg p-md sm:p-lg">
        <Section
          letter="A"
          title="Ficha limpia"
          note="Imagen 4:3 a sangre arriba, cuerpo con jerarquía completa (nombre, marca · categoría, badges, precio), pie con acciones. La más cercana a la referencia de Casa de Cristal."
        >
          {MOCK_PRODUCTS.map((product) => (
            <CardClean key={product.id} product={product} />
          ))}
        </Section>

        <Section
          letter="B"
          title="Ficha con overlay"
          note="Badge y estatus superpuestos en la imagen, cuerpo más corto. Cabe más por pantalla a costa de menos aire."
        >
          {MOCK_PRODUCTS.map((product) => (
            <CardOverlay key={product.id} product={product} />
          ))}
        </Section>

        <Section
          letter="C"
          title="Ficha horizontal"
          note="Imagen cuadrada a la izquierda, datos a la derecha. La más fácil de escanear con 50+ productos; la menos 'escaparate'."
        >
          {MOCK_PRODUCTS.map((product) => (
            <CardHorizontal key={product.id} product={product} />
          ))}
        </Section>

        <p className="flex items-center gap-xs font-body text-caption text-grafito">
          <CaretRight aria-hidden="true" size={12} />
          Las miniaturas son un cuadro de relleno — la implementación real usará <code>row.gallery[0]</code>.
        </p>
      </div>
    </>
  );
}
