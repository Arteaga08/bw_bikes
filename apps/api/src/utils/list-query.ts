import type { ApiResponseMeta } from "@bw-bikes/shared";
import { AppError } from "./app-error.js";

/**
 * Cross-cutting list utility (BACKEND_ARCHITECTURE_GUIDELINES.md §"Listados
 * administrativos"). Every admin list ends up needing the same four
 * operations — paginate, sort, search, filter — and solving them once here is
 * what stops each module from reimplementing `skip`/`limit`/`count` slightly
 * differently and drifting apart over time.
 *
 * Scope is deliberate: this module owns **pagination, sorting and free-text
 * search** only. Business filters stay explicit in each service, because a
 * generic filter parser would end up forwarding a client-controlled query
 * object straight to Mongo — exactly what §4 of the security guidelines
 * forbids.
 */

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_SEARCH_LENGTH = 80;

export interface ParseListQueryOptions {
  /**
   * Sortable fields, as an explicit whitelist. A field outside it is a 400 —
   * an unvalidated sort key lets a caller order by (and therefore probe) any
   * field in the document, including ones the projection hides.
   */
  allowedSortFields: readonly string[];
  /** Applied when the request doesn't ask for a sort. Prefix with `-` for descending. */
  defaultSort: string;
  /** Per-endpoint ceiling, never above MAX_LIMIT. */
  maxLimit?: number;
}

export interface ParsedListQuery {
  page: number;
  limit: number;
  skip: number;
  /** Ready to hand to `Model.find().sort(...)`. */
  sort: Record<string, 1 | -1>;
  /** Trimmed and length-capped; still needs `escapeRegex` before reaching a `$regex`. */
  search?: string;
}

/**
 * Escapes every character that carries meaning inside a regular expression, so
 * a user-supplied search term is matched literally. Without this, a search for
 * `.*` matches the entire collection and a crafted term like `(a+)+$` becomes
 * a ReDoS vector (BACKEND_SECURITY_GUIDELINES.md §4 / ECOMMERCE §"Red/salida").
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parsePositiveInt(raw: unknown, fallback: number, max: number, label: string): number {
  if (raw === undefined || raw === "") return fallback;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(`El parámetro "${label}" debe ser un número entero mayor a cero.`, 400);
  }
  return Math.min(parsed, max);
}

function parseSort(raw: unknown, options: ParseListQueryOptions): Record<string, 1 | -1> {
  const requested = typeof raw === "string" && raw.trim() !== "" ? raw.trim() : options.defaultSort;
  const descending = requested.startsWith("-");
  const field = descending ? requested.slice(1) : requested;

  if (!options.allowedSortFields.includes(field)) {
    throw new AppError(
      `No se puede ordenar por "${field}". Campos válidos: ${options.allowedSortFields.join(", ")}.`,
      400,
    );
  }

  return { [field]: descending ? -1 : 1 };
}

/**
 * Parses raw query params into the pagination/sort/search triplet. Caps
 * `limit` instead of rejecting an oversized one so a dashboard asking for 500
 * rows degrades to 100 rather than erroring — but it never returns an
 * unpaginated result set, however small the collection looks today.
 */
export function parseListQuery(
  query: Record<string, unknown>,
  options: ParseListQueryOptions,
): ParsedListQuery {
  const maxLimit = Math.min(options.maxLimit ?? MAX_LIMIT, MAX_LIMIT);

  const page = parsePositiveInt(query["page"], DEFAULT_PAGE, Number.MAX_SAFE_INTEGER, "page");
  const limit = parsePositiveInt(query["limit"], DEFAULT_LIMIT, maxLimit, "limit");
  const sort = parseSort(query["sort"], options);

  const rawSearch = query["search"];
  const search =
    typeof rawSearch === "string" && rawSearch.trim() !== ""
      ? rawSearch.trim().slice(0, MAX_SEARCH_LENGTH)
      : undefined;

  return { page, limit, skip: (page - 1) * limit, sort, ...(search !== undefined ? { search } : {}) };
}

/**
 * Builds the `meta` block every paginated response carries, so `total`/`page`/
 * `pages`/`limit` are computed identically across modules. `pages` is at least
 * 1 even on an empty collection — a UI that renders "página 1 de 0" is a bug
 * report waiting to happen.
 */
export function buildMeta(total: number, page: number, limit: number): ApiResponseMeta {
  return { total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}
