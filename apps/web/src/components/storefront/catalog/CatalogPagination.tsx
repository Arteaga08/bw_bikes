import { ButtonLink } from "@/components/ui/ButtonLink";

export interface CatalogPaginationProps {
  /** The page's own path (no query string) — `?page=` is appended here, never carried by the caller. */
  basePath: string;
  page: number;
  pages: number;
  /** The active filters serialized as a query string (no leading `?`, no `page` — `serializeFilterState(filters).toString()`), so "Anterior"/"Siguiente" carry them forward instead of silently resetting to an unfiltered page. Omitted on a page with no filter bar. */
  filterQuery?: string;
}

function pageHref(basePath: string, filterQuery: string | undefined, page: number): string {
  const query = filterQuery ? `${filterQuery}&page=${page}` : `page=${page}`;
  return `${basePath}?${query}`;
}

/**
 * Prev/next over `?page=N` (plus whatever filters are active), server-
 * rendered — no client state. Renders nothing on a single-page result: a
 * paginator with no page to go to is chrome, not navigation.
 */
export function CatalogPagination({ basePath, page, pages, filterQuery }: CatalogPaginationProps) {
  if (pages <= 1) return null;

  return (
    <nav aria-label="Paginación de resultados" className="flex items-center justify-center gap-lg px-lg py-xl">
      {page > 1 ? (
        <ButtonLink href={pageHref(basePath, filterQuery, page - 1)} variant="text" tone="neutral">
          Anterior
        </ButtonLink>
      ) : (
        <span aria-disabled="true" className="font-ui text-ui text-negro-disabled-text">
          Anterior
        </span>
      )}

      <p className="font-body text-body text-grafito">
        Página {page} de {pages}
      </p>

      {page < pages ? (
        <ButtonLink href={pageHref(basePath, filterQuery, page + 1)} variant="text" tone="neutral">
          Siguiente
        </ButtonLink>
      ) : (
        <span aria-disabled="true" className="font-ui text-ui text-negro-disabled-text">
          Siguiente
        </span>
      )}
    </nav>
  );
}
