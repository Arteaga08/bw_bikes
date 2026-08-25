// Cuántos px de lado muestrea el canvas oculto — suficiente para promediar
// color sin costo real de decodificación, un logo no necesita resolución
// completa para esto.
const SAMPLE_SIZE = 24;

// Alfa por debajo de este valor cuenta como "transparente" al promediar —
// evita que anti-aliasing en el borde (alfa ~1-15) se cuente como opaco.
const ALPHA_TRANSPARENT_THRESHOLD = 16;

// Si menos de este % de píxeles son transparentes, el asset se trata como
// opaco (JPG o PNG con fondo sólido) — invertirlo solo cambiaría su propio
// fondo de blanco a negro y corrompería el color de marca del trazo (un rojo
// se vuelve cian), sin resolver ningún problema de legibilidad real.
const MIN_TRANSPARENT_RATIO = 0.15;

// Luminancia relativa (0-1) por debajo de la cual el trazo opaco de un logo
// transparente se considera "oscuro" y necesita invertirse para leerse sobre
// negro — ver el caso real de Trek (wordmark negro puro sobre PNG con alfa).
const DARK_LUMINANCE_THRESHOLD = 0.35;

const darkLogoCache = new Map<string, Promise<boolean>>();

/**
 * Relative luminance (BT.709 weights), 0 (black) to 1 (white).
 */
function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/**
 * Muestrea un logo (canvas oculto, downscale a `SAMPLE_SIZE`) para decidir si
 * necesita `invert()` para leerse sobre el fondo negro del marquee de marcas.
 *
 * Solo invierte cuando el asset **es transparente** (tiene alfa real, no un
 * JPG/PNG de fondo sólido) **y** su trazo opaco es oscuro — invertir un logo
 * opaco de color (p. ej. el rojo de Cannondale) cambiaría su color de marca
 * en vez de resolver un problema de contraste real. Ver
 * `apps/web/src/components/storefront/brands/BrandMarquee.tsx`.
 *
 * Memoizado por `url`: el mismo logo se repite hasta `LOOP_COPIES` veces en
 * el DOM del marquee, y no hace falta re-muestrear el canvas por cada copia.
 */
export function isLogoDarkOnTransparent(url: string): Promise<boolean> {
  const cached = darkLogoCache.get(url);
  if (cached) return cached;

  const promise = new Promise<boolean>((resolve) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_SIZE;
        canvas.height = SAMPLE_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(false);
          return;
        }

        ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
        const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

        let opaquePixels = 0;
        let transparentPixels = 0;
        let luminanceSum = 0;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          const alpha = data[i + 3] ?? 0;
          if (alpha < ALPHA_TRANSPARENT_THRESHOLD) {
            transparentPixels += 1;
            continue;
          }
          opaquePixels += 1;
          luminanceSum += luminance(r, g, b);
        }

        const totalPixels = SAMPLE_SIZE * SAMPLE_SIZE;
        const transparentRatio = transparentPixels / totalPixels;
        const avgOpaqueLuminance = opaquePixels > 0 ? luminanceSum / opaquePixels : 1;

        resolve(transparentRatio >= MIN_TRANSPARENT_RATIO && avgOpaqueLuminance < DARK_LUMINANCE_THRESHOLD);
      } catch {
        // Canvas "tainted" por CORS u otro fallo de lectura — no invertir es
        // el fallback seguro (el peor caso es un logo oscuro poco legible,
        // no uno con los colores de marca rotos).
        resolve(false);
      }
    };

    img.onerror = () => resolve(false);
    img.src = url;
  });

  darkLogoCache.set(url, promise);
  return promise;
}
