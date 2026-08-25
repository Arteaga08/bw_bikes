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

export async function listAdminHeroSlides(): Promise<AdminHeroSlide[]> {
  const res = await apiFetch<{ slides: AdminHeroSlide[] }>(BASE_PATH);
  return res.data.slides;
}

export async function createHeroSlide(input: HeroSlideInput): Promise<AdminHeroSlide> {
  const res = await apiFetch<{ slide: AdminHeroSlide }>(BASE_PATH, { method: "POST", body: JSON.stringify(input) });
  return res.data.slide;
}

export async function updateHeroSlide(id: string, input: HeroSlideInput): Promise<AdminHeroSlide> {
  const res = await apiFetch<{ slide: AdminHeroSlide }>(`${BASE_PATH}/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return res.data.slide;
}

export async function deleteHeroSlide(id: string): Promise<void> {
  await apiFetch<undefined>(`${BASE_PATH}/${id}`, { method: "DELETE" });
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
  return res.data.slide;
}

export async function removeHeroSlideImage(id: string): Promise<AdminHeroSlide> {
  const res = await apiFetch<{ slide: AdminHeroSlide }>(`${BASE_PATH}/${id}/image`, { method: "DELETE" });
  return res.data.slide;
}

export async function reorderHeroSlides(ids: string[]): Promise<AdminHeroSlide[]> {
  const res = await apiFetch<{ slides: AdminHeroSlide[] }>(`${BASE_PATH}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ ids }),
  });
  return res.data.slides;
}
