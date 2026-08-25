"use client";

import { useEffect, useState } from "react";
import { isLogoDarkOnTransparent } from "@/lib/catalog/logo-luminance";

/**
 * `true` una vez que `isLogoDarkOnTransparent` confirma que este logo es
 * oscuro sobre transparencia (necesita `invert()` para leerse en
 * `BrandMarquee`). Empieza en `false` mientras se muestrea — el logo se ve
 * en su color real hasta que el análisis resuelve, nunca invertido de más.
 */
export function useDarkLogo(url: string): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isLogoDarkOnTransparent(url).then((result) => {
      if (!cancelled) setIsDark(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return isDark;
}
