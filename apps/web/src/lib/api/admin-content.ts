import type {
  AdminBikeOfMonth,
  AdminHeroSlide,
  AdminHomeTile,
  BikeOfMonthInput,
  HeroSlideInput,
  HomeTileSlot,
} from "@bw-bikes/shared";
import { apiFetch } from "./client";

/**
 * Admin client for the home hero's slides (M12, entrega 2). Same shape as
 * `admin-catalog.ts`'s category API: plain JSON for the text fields, a
 * separate `FormData` call for the image — a slide is created text-first,
 * then its photo is uploaded right after, same two-request-one-save-action
 * flow `HeroSlideFormModal` drives.
 */
const BASE_PATH = "/admin/content/hero-slides";

/**
 * Best-effort cache-buster: fires after every mutation below so the public
 * home page reflects it immediately instead of waiting out the 5-minute ISR
 * window (`app/api/revalidate/hero-slides/route.ts`). Never awaited by the
 * caller and never throws — a failed revalidate just means the change shows
 * up in up to 5 minutes instead of instantly, not a reason to fail the
 * admin's save.
 */
function triggerPublicRevalidate(): void {
  void fetch("/api/revalidate/hero-slides", { method: "POST" }).catch(() => {});
}

export async function listAdminHeroSlides(): Promise<AdminHeroSlide[]> {
  const res = await apiFetch<{ slides: AdminHeroSlide[] }>(BASE_PATH);
  return res.data.slides;
}

export async function createHeroSlide(input: HeroSlideInput): Promise<AdminHeroSlide> {
  const res = await apiFetch<{ slide: AdminHeroSlide }>(BASE_PATH, { method: "POST", body: JSON.stringify(input) });
  triggerPublicRevalidate();
  return res.data.slide;
}

export async function updateHeroSlide(id: string, input: HeroSlideInput): Promise<AdminHeroSlide> {
  const res = await apiFetch<{ slide: AdminHeroSlide }>(`${BASE_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  triggerPublicRevalidate();
  return res.data.slide;
}

export async function deleteHeroSlide(id: string): Promise<void> {
  await apiFetch<undefined>(`${BASE_PATH}/${id}`, { method: "DELETE" });
  triggerPublicRevalidate();
}

/** A slide carries exactly one photo — same `FormData` pattern as `admin-catalog.ts`'s category `uploadImage`. */
export async function uploadHeroSlideImage(id: string, file: File, alt?: string): Promise<AdminHeroSlide> {
  const formData = new FormData();
  formData.append("images", file);
  if (alt) formData.append("alt", alt);

  const res = await apiFetch<{ slide: AdminHeroSlide }>(`${BASE_PATH}/${id}/image`, {
    method: "POST",
    body: formData,
  });
  triggerPublicRevalidate();
  return res.data.slide;
}

export async function removeHeroSlideImage(id: string): Promise<AdminHeroSlide> {
  const res = await apiFetch<{ slide: AdminHeroSlide }>(`${BASE_PATH}/${id}/image`, { method: "DELETE" });
  triggerPublicRevalidate();
  return res.data.slide;
}

export async function reorderHeroSlides(ids: string[]): Promise<AdminHeroSlide[]> {
  const res = await apiFetch<{ slides: AdminHeroSlide[] }>(`${BASE_PATH}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
  triggerPublicRevalidate();
  return res.data.slides;
}

/**
 * Admin client for the home's two CTA tile photos (M12, entrega 6). Only
 * `list`/`uploadImage`/`removeImage` — no create/update/delete/reorder, the
 * two slots are fixed and always exist server-side (`home-tile.service.ts`
 * upserts them on first read).
 */
const HOME_TILES_BASE_PATH = "/admin/content/home-tiles";

function triggerHomeTilesRevalidate(): void {
  void fetch("/api/revalidate/home-tiles", { method: "POST" }).catch(() => {});
}

export async function listAdminHomeTiles(): Promise<AdminHomeTile[]> {
  const res = await apiFetch<{ tiles: AdminHomeTile[] }>(HOME_TILES_BASE_PATH);
  return res.data.tiles;
}

export async function uploadHomeTileImage(slot: HomeTileSlot, file: File): Promise<AdminHomeTile> {
  const formData = new FormData();
  formData.append("images", file);

  const res = await apiFetch<{ tile: AdminHomeTile }>(`${HOME_TILES_BASE_PATH}/${slot}/image`, {
    method: "POST",
    body: formData,
  });
  triggerHomeTilesRevalidate();
  return res.data.tile;
}

export async function removeHomeTileImage(slot: HomeTileSlot): Promise<AdminHomeTile> {
  const res = await apiFetch<{ tile: AdminHomeTile }>(`${HOME_TILES_BASE_PATH}/${slot}/image`, { method: "DELETE" });
  triggerHomeTilesRevalidate();
  return res.data.tile;
}

/**
 * Admin client for the home's single "bici del mes" banner (M12). Like the
 * home tiles above there's no create/delete — one document always exists
 * server-side — but unlike them there's text to save alongside the photo,
 * so this exposes an `update` for the text fields plus the same
 * upload/remove pair for the image.
 */
const BIKE_OF_MONTH_BASE_PATH = "/admin/content/bike-of-month";

function triggerBikeOfMonthRevalidate(): void {
  void fetch("/api/revalidate/bike-of-month", { method: "POST" }).catch(() => {});
}

export async function getAdminBikeOfMonth(): Promise<AdminBikeOfMonth> {
  const res = await apiFetch<{ bikeOfMonth: AdminBikeOfMonth }>(BIKE_OF_MONTH_BASE_PATH);
  return res.data.bikeOfMonth;
}

export async function updateBikeOfMonth(input: BikeOfMonthInput): Promise<AdminBikeOfMonth> {
  const res = await apiFetch<{ bikeOfMonth: AdminBikeOfMonth }>(BIKE_OF_MONTH_BASE_PATH, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  triggerBikeOfMonthRevalidate();
  return res.data.bikeOfMonth;
}

export async function uploadBikeOfMonthImage(file: File): Promise<AdminBikeOfMonth> {
  const formData = new FormData();
  formData.append("images", file);

  const res = await apiFetch<{ bikeOfMonth: AdminBikeOfMonth }>(`${BIKE_OF_MONTH_BASE_PATH}/image`, {
    method: "POST",
    body: formData,
  });
  triggerBikeOfMonthRevalidate();
  return res.data.bikeOfMonth;
}

export async function removeBikeOfMonthImage(): Promise<AdminBikeOfMonth> {
  const res = await apiFetch<{ bikeOfMonth: AdminBikeOfMonth }>(`${BIKE_OF_MONTH_BASE_PATH}/image`, {
    method: "DELETE",
  });
  triggerBikeOfMonthRevalidate();
  return res.data.bikeOfMonth;
}
