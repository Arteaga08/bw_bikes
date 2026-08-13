import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button, type ButtonVariant } from "@/components/ui/Button";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "text"];

function Section({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-md rounded-card-lg border border-borde bg-surface p-lg">
      <div className="flex flex-col gap-xs">
        <h2 className="font-display text-h3 text-negro">{title}</h2>
        <p className="max-w-[65ch] font-body text-caption text-grafito">{note}</p>
      </div>
      {children}
    </section>
  );
}

export default function BotonesMockupPage() {
  return (
    <>
      <PageHeader
        title="Estados de botón"
        subtitle="Puntos 6 y 7 — hoy es el componente Button real; las propuestas son previsualizaciones aparte, sin tocar el componente."
      />
      <div className="flex flex-col gap-lg p-md sm:p-lg">
        <Section
          title="Matriz de estados — componente real"
          note="Pasa el mouse por cada uno para ver el hover; usa Tab para ver el foco. Default/deshabilitado/cargando quedan fijos abajo."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-borde bg-base">
                  <th className="px-md py-sm font-ui text-caption uppercase tracking-[1px] text-grafito">Variante</th>
                  <th className="px-md py-sm font-ui text-caption uppercase tracking-[1px] text-grafito">Default (hover / focus reales)</th>
                  <th className="px-md py-sm font-ui text-caption uppercase tracking-[1px] text-grafito">Deshabilitado</th>
                  <th className="px-md py-sm font-ui text-caption uppercase tracking-[1px] text-grafito">Cargando</th>
                </tr>
              </thead>
              <tbody>
                {VARIANTS.map((variant) => (
                  <tr key={variant} className="border-b border-borde last:border-b-0">
                    <td className="px-md py-sm font-body text-body text-negro">{variant}</td>
                    <td className="px-md py-sm">
                      <Button variant={variant}>Guardar</Button>
                    </td>
                    <td className="px-md py-sm">
                      <Button variant={variant} disabled>
                        Guardar
                      </Button>
                    </td>
                    <td className="px-md py-sm">
                      <Button variant={variant} loading>
                        Guardar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="El defecto real — ghost dentro de una fila con hover"
          note="Pasa el mouse por cada fila completa (no solo el botón). Hoy: el hover del botón y el hover de la fila son el mismo color — contraste cero. Abajo, dos direcciones de arreglo, sin tocar Button.tsx todavía."
        >
          <div className="flex flex-col gap-md">
            <div className="flex flex-col gap-xs">
              <p className="font-ui text-ui text-negro">Hoy</p>
              <div className="flex items-center justify-between rounded-card border border-borde bg-surface px-md py-sm transition-colors duration-150 hover:bg-base">
                <span className="font-body text-body text-negro">Tarmac SL8</span>
                <div className="flex gap-xs">
                  <Button variant="ghost" size="sm">
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm">
                    Archivar
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <p className="font-ui text-ui text-negro">Propuesta 1 — invierte a negro sólido</p>
              <div className="flex items-center justify-between rounded-card border border-borde bg-surface px-md py-sm transition-colors duration-150 hover:bg-base">
                <span className="font-body text-body text-negro">Tarmac SL8</span>
                <div className="flex gap-xs">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-control border border-negro px-md font-ui text-ui text-negro transition-colors duration-150 hover:border-negro hover:bg-negro hover:text-blanco focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-control border border-negro px-md font-ui text-ui text-negro transition-colors duration-150 hover:border-negro hover:bg-negro hover:text-blanco focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
                  >
                    Archivar
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-xs">
              <p className="font-ui text-ui text-negro">Propuesta 2 — un paso más oscuro que la fila</p>
              <div className="flex items-center justify-between rounded-card border border-borde bg-surface px-md py-sm transition-colors duration-150 hover:bg-base">
                <span className="font-body text-body text-negro">Tarmac SL8</span>
                <div className="flex gap-xs">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-control border border-negro px-md font-ui text-ui text-negro transition-colors duration-150 hover:border-grafito hover:bg-borde focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center rounded-control border border-negro px-md font-ui text-ui text-negro transition-colors duration-150 hover:border-grafito hover:bg-borde focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-negro"
                  >
                    Archivar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section
          title="Destructivo en rojo — Eliminar / Archivar"
          note="Suave sobre estado-error-soft al pasar el mouse, sólido sobre estado-error al presionar — mismo patrón de dos pasos que ya usan hover/active en el resto del sistema."
        >
          <div className="flex items-center gap-sm">
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-control border border-negro px-md font-ui text-ui text-negro transition-colors duration-150 hover:border-estado-error hover:bg-estado-error-soft hover:text-estado-error active:bg-estado-error active:text-blanco focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-estado-error"
            >
              Eliminar
            </button>
            <span className="font-body text-caption text-grafito">← pasa el mouse, luego mantén presionado</span>
          </div>
        </Section>
      </div>
    </>
  );
}
