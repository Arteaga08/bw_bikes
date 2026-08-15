"use client";

import { CaretDown, CaretUp, Minus, Plus, ShoppingCart, SignOut, Trash } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Button, type ButtonTone, type ButtonVariant } from "@/components/ui/Button";
import { ButtonGroup } from "@/components/ui/ButtonGroup";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CloseButton } from "@/components/ui/CloseButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { SocialButton } from "@/components/ui/SocialButton";
import { Tab, TabList } from "@/components/ui/Tabs";
import { useAsyncAction } from "@/hooks/use-async-action";
import { useToast } from "@/hooks/use-toast";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "bare", "text"];
const TONED_VARIANTS: Array<Extract<ButtonVariant, "ghost" | "bare">> = ["ghost", "bare"];
const TONES: ButtonTone[] = ["neutral", "danger", "danger-strong", "inverse"];

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

function Th({ children }: { children: ReactNode }) {
  return <th className="px-md py-sm font-ui text-caption uppercase tracking-[1px] text-grafito">{children}</th>;
}

/**
 * The full add-to-cart interaction, wired the way a real storefront would wire
 * it: `useAsyncAction` owns the lockout, `Button` shows it, the toast carries
 * the message. The fake latency stands in for the request M12 will make.
 */
function AddToCartDemo() {
  const { toast } = useToast();
  const add = useAsyncAction(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    toast({ variant: "success", title: "Agregado al carrito", description: "Moterra SL Carbon · 1 unidad" });
  });

  return (
    <Button
      variant="secondary"
      iconLeft={<ShoppingCart />}
      onClick={add.run}
      loading={add.pending}
      success={add.succeeded}
      successLabel="Agregado"
    >
      Agregar al carrito
    </Button>
  );
}

/**
 * The button catalog: every variant × tone × size × state the system defines,
 * rendered with the real components so it can never describe something the
 * code doesn't do.
 *
 * This page replaced the M10.5 scratch mockups. It is no longer disposable —
 * it's the reference the design system points at, and the fastest way to check
 * a state that's awkward to reach in a real screen (pressed, loading, a
 * disabled control inside a nested panel).
 */
export default function BotonesPage() {
  const [tab, setTab] = useState<"admin" | "tienda">("admin");

  return (
    <>
      <PageHeader
        title="Catálogo de botones"
        subtitle="Cinco variantes, cuatro tonos, cinco tamaños. Pasa el mouse para ver hover, usa Tab para ver el foco."
      />
      <div className="flex flex-col gap-lg p-md sm:p-lg">
        <Section
          title="Variantes × estados"
          note="Variante es la forma y el peso del control. Las tres primeras son sólidas o contorneadas; bare no dibuja borde en reposo; text es un enlace, no una superficie."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 border-collapse text-left">
              <thead>
                <tr className="border-b border-borde bg-inset">
                  <Th>Variante</Th>
                  <Th>Default (hover y foco reales)</Th>
                  <Th>Deshabilitado</Th>
                  <Th>Cargando</Th>
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
          title="Tonos"
          note="Tono es el eje de color, encima de la forma. danger es el tier reversible (Archivar): suave en hover, sólido solo al presionar. danger-strong es el irreversible (Eliminar): hover directo a sólido. inverse se muestra sobre overlay porque es su único contexto válido."
        >
          <div className="flex flex-col gap-md">
            {TONED_VARIANTS.map((variant) => (
              <div key={variant} className="flex flex-col gap-xs">
                <p className="font-ui text-ui text-negro">{variant}</p>
                <div className="flex flex-wrap items-center gap-sm">
                  {TONES.filter((tone) => tone !== "inverse").map((tone) => (
                    <Button key={tone} variant={variant} tone={tone}>
                      {tone}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-sm rounded-control bg-overlay p-md">
                  <Button variant={variant} tone="inverse">
                    inverse
                  </Button>
                  <Button variant="text" tone="inverse" iconLeft={<SignOut />}>
                    Cerrar sesión
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Tamaños"
          note="md para formularios, sm para acciones de fila, y tres cuadrados de ícono: icon-sm (20px) dentro de un chip, icon (36px) en fila o barra, icon-lg (44px) para chrome suelto que necesita el área táctil completa. El glifo escala con el control."
        >
          <div className="flex flex-wrap items-center gap-md">
            <Button size="md">md — 44px</Button>
            <Button size="sm">sm — 36px</Button>
            <Button variant="bare" size="icon-sm" aria-label="Quitar" iconLeft={<Trash />} />
            <Button variant="bare" size="icon" aria-label="Eliminar" iconLeft={<Trash />} />
            <Button variant="bare" size="icon-lg" aria-label="Eliminar" iconLeft={<Trash />} />
          </div>
        </Section>

        <Section
          title="bare dentro de un panel anidado"
          note="El caso que motivó la variante. El panel es bg-inset (#EAEAE6) dentro de una tarjeta blanca; el hover de bare es #E2E2DE, un paso más oscuro. Con ghost, cada ícono traía su propio recuadro negro y el control menos importante de la fila cargaba el borde más fuerte."
        >
          <div className="flex flex-col gap-sm rounded-control border border-borde bg-inset p-md">
            <div className="flex items-center gap-sm">
              <span className="flex-1 rounded-control border border-borde bg-surface px-md py-sm font-body text-body text-negro">
                Cuadro
              </span>
              <span className="flex-2 rounded-control border border-borde bg-surface px-md py-sm font-body text-body text-negro">
                Moterra SL Carbon, 150mm travel
              </span>
              <ButtonGroup label="Reordenar campo" className="shrink-0">
                <Button variant="bare" size="icon" aria-label="Subir campo" iconLeft={<CaretUp />} />
                <Button variant="bare" size="icon" aria-label="Bajar campo" disabled iconLeft={<CaretDown />} />
              </ButtonGroup>
              <Button variant="bare" size="icon" tone="danger-strong" aria-label="Eliminar campo" iconLeft={<Trash />} className="shrink-0" />
            </div>
          </div>
        </Section>

        <Section
          title="bare sobre una fila de tabla"
          note="La otra prueba del mismo hover: la fila pasa a bg-base (#F1F1EE) al pasar el mouse, y el control a #E2E2DE. Un paso de diferencia, visible sin que el botón grite."
        >
          <div className="overflow-hidden rounded-card border border-borde bg-surface">
            {["Tarmac SL8", "Moterra SL"].map((name) => (
              <div
                key={name}
                className="flex items-center justify-between border-b border-borde px-md py-sm transition-colors duration-150 last:border-b-0 hover:bg-base"
              >
                <span className="font-body text-body text-negro">{name}</span>
                <div className="flex items-center gap-xs">
                  <ButtonLink href="#" variant="secondary" size="sm">
                    Editar
                  </ButtonLink>
                  <Button variant="ghost" size="sm" tone="danger">
                    Archivar
                  </Button>
                  <Button variant="bare" size="icon" tone="danger-strong" aria-label={`Eliminar ${name}`} iconLeft={<Trash />} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Compuestos"
          note="ButtonGroup agrupa acciones adyacentes en un control; CloseButton es el único cierre del sistema; Tabs cambia el contenido de abajo (no navega); SocialButton abre un perfil externo con rel noopener y nombre accesible."
        >
          <div className="flex flex-col gap-md">
            <div className="flex flex-wrap items-center gap-md">
              <ButtonGroup label="Cantidad">
                <Button variant="bare" size="icon" aria-label="Restar uno" iconLeft={<Minus />} />
                <Button variant="bare" size="icon" aria-label="Sumar uno" iconLeft={<Plus />} />
              </ButtonGroup>
              <CloseButton />
              <span className="inline-flex items-center gap-xs rounded-control bg-inset px-sm py-1 font-ui text-caption text-negro">
                Casco Aero
                <CloseButton size="icon-sm" aria-label="Quitar Casco Aero" />
              </span>
            </div>

            <TabList label="Ejemplo de pestañas">
              <Tab selected={tab === "admin"} onSelect={() => setTab("admin")} badge="12">
                Panel
              </Tab>
              <Tab selected={tab === "tienda"} onSelect={() => setTab("tienda")}>
                Tienda
              </Tab>
            </TabList>

            <div className="flex items-center gap-sm rounded-control bg-overlay p-md">
              <SocialButton network="instagram" href="https://instagram.com/" />
              <SocialButton network="facebook" href="https://facebook.com/" />
              <SocialButton network="whatsapp" href="https://wa.me/" />
              <SocialButton network="youtube" href="https://youtube.com/" />
            </div>
          </div>
        </Section>

        <Section
          title="Tienda — composiciones, no componentes nuevos"
          note="Carrito, checkout y login son Button con otra etiqueta y otro ícono. Se muestran aquí para fijar el diseño antes de M12, pero no llevan componente propio: nombrarlos antes de que exista el flujo sería abstracción prematura. La regla del acento único manda: un solo primary dorado por vista, reservado a la conversión."
        >
          <div className="flex flex-wrap items-center gap-sm">
            <Button variant="primary">Ir a pagar</Button>
            <AddToCartDemo />
            <Button variant="ghost" size="sm">
              Filtrar
            </Button>
            <Button variant="text">Seguir comprando</Button>
          </div>
        </Section>

        <Section
          title="Agregar al carrito — confirmación y doble clic"
          note="Haz clic y luego intenta hacer clic otra vez de inmediato: no cuenta. El botón se bloquea mientras la acción corre y sigue bloqueado durante los 2 s de confirmación, que es justo cuando un clic impaciente agregaría una segunda unidad. El aviso sale además como toast, porque el botón puede estar fuera de vista al hacer scroll."
        >
          <div className="flex flex-col gap-md">
            <div className="flex flex-wrap items-center gap-sm">
              <AddToCartDemo />
              <span className="font-body text-caption text-grafito">← pruébalo, y luego haz doble clic</span>
            </div>
            <div className="flex flex-wrap items-center gap-sm">
              <Button variant="secondary" loading>
                Agregar al carrito
              </Button>
              <Button variant="secondary" success successLabel="Agregado">
                Agregar al carrito
              </Button>
              <span className="font-body text-caption text-grafito">Los dos estados, fijos, para verlos con calma.</span>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
