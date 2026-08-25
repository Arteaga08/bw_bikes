import { cn } from "@/lib/cn";

export interface MenuToggleIconProps {
  /** El estado del drawer que este glifo representa: `true` dibuja la ✕, `false` el ☰. */
  open: boolean;
}

/**
 * El glifo ☰ ⇄ ✕ del drawer móvil, animado.
 *
 * No usa el par `List`/`X` de Phosphor porque son dos glifos distintos: un
 * swap entre ellos es un corte, no una transición — no hay nada que
 * interpolar entre dos `path` sin relación. Tres barras propias sí se pueden
 * mover, que es justo lo que la transformación necesita.
 *
 * `bg-current` en vez de un color fijo: el glifo hereda el color del `Button`
 * que lo contiene, incluyendo el tono `inverse` sobre el hero y el
 * `hover:!text-dorado` que el navbar le impone. Un `bg-negro` aquí obligaría a
 * duplicar toda esa lógica de tono.
 *
 * **Dos capas por barra, y ese es el punto.** El span externo lleva el
 * `translateY` y el interno el `rotate`, cada uno con su propio delay. Una
 * sola capa solo puede correr ambas transformaciones a la vez, y el resultado
 * es que las barras rotan mientras todavía viajan — un movimiento en diagonal
 * que se lee como un glitch. Separadas, la animación tiene dos tiempos: al
 * abrir las barras primero convergen al centro y solo entonces rotan; al
 * cerrar se invierten los delays, primero desrotan y después se separan. En
 * ambos casos la barra que se mueve termina su viaje antes de girar.
 *
 * Transiciones, no keyframes: el toggle se puede pulsar dos veces seguidas y
 * una transición se re-dirige desde donde iba, mientras que un keyframe
 * reiniciaría desde el frame cero. Solo se animan `transform` y `opacity`,
 * las dos propiedades que no disparan layout ni paint.
 *
 * `prefers-reduced-motion` no necesita guarda aquí: `globals.css` ya anula
 * todas las duraciones de transición globalmente, y el glifo queda igual de
 * correcto en sus dos estados finales sin el recorrido entre ellos.
 */
const BAR_CLASSES = "absolute left-0 h-0.5 w-5 transition-transform duration-[110ms] ease-out-strong";

export function MenuToggleIcon({ open }: MenuToggleIconProps) {
  return (
    <span aria-hidden="true" className="relative block h-5 w-5">
      {/* Barra superior: baja al centro, luego rota +45°. */}
      <span
        className={cn(BAR_CLASSES, "top-1/2 -mt-px", open ? "translate-y-0 delay-0" : "-translate-y-[6px] delay-[110ms]")}
      >
        <span
          className={cn(
            "block h-0.5 w-5 origin-center bg-current transition-transform duration-[110ms] ease-out-strong",
            open ? "rotate-45 delay-[110ms]" : "rotate-0 delay-0",
          )}
        />
      </span>

      {/* Barra media: no viaja, solo desaparece — mantenerla visible mientras las
          otras dos convergen produciría tres líneas amontonadas en el centro. */}
      <span
        className={cn(
          "absolute left-0 top-1/2 -mt-px block h-0.5 w-5 origin-center bg-current transition-[opacity,transform] duration-[110ms] ease-out-strong",
          open ? "scale-x-0 opacity-0 delay-0" : "scale-x-100 opacity-100 delay-[110ms]",
        )}
      />

      {/* Barra inferior: sube al centro, luego rota -45°. */}
      <span
        className={cn(BAR_CLASSES, "top-1/2 -mt-px", open ? "translate-y-0 delay-0" : "translate-y-[6px] delay-[110ms]")}
      >
        <span
          className={cn(
            "block h-0.5 w-5 origin-center bg-current transition-transform duration-[110ms] ease-out-strong",
            open ? "-rotate-45 delay-[110ms]" : "rotate-0 delay-0",
          )}
        />
      </span>
    </span>
  );
}
