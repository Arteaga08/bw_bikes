import type { AdminHeroSlide, HeroSlideInput } from "@bw-bikes/shared";
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
