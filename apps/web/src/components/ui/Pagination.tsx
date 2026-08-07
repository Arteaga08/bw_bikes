"use client";

import type { ApiResponseMeta } from "@bw-bikes/shared";
import { Button } from "./Button";

export interface PaginationProps {
  meta: ApiResponseMeta;
  onPageChange: (page: number) => void;
}

/** Consumes the `ApiResponseMeta` every admin list endpoint returns (packages/shared). */
export function Pagination({ meta, onPageChange }: PaginationProps) {
  const { page, pages, total } = meta;
  if (pages <= 1) return null;

  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-md py-md">
      <p className="font-body text-caption text-grafito">
        Página {page} de {pages} · {total} resultados
      </p>
      <div className="flex gap-sm">
        <Button variant="ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Anterior
        </Button>
        <Button variant="ghost" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          Siguiente
        </Button>
      </div>
    </nav>
  );
}
