import type { CategoryImage } from "./catalog.js";

/**
 * Editorial content the admin edits and the storefront renders — as opposed
 * to `settings.ts`, which is operational configuration (TTLs, thresholds,
 * toggles). The distinction is load-bearing rather than cosmetic: settings
 * are numbers behind `protect` + `restrictTo` with no public read path,
 * while this is image-bearing, ordered, and read anonymously on every visit
 * to the home page.
 */

/**
 * What a hero CTA points at. The four catalog kinds store a document
 * reference and let the API resolve the current slug at read time, so
 * renaming a bike never leaves the hero pointing at a 404. `url` is the
 * escape hatch for destinations that aren't catalog documents (an editorial
 * page like `/compromiso`) and is restricted to internal paths.
 */
export const HERO_CTA_TARGET_TYPES = ["bike", "bikeCategory", "accessory", "accessoryCategory", "url"] as const;

export type HeroCtaTargetType = (typeof HERO_CTA_TARGET_TYPES)[number];

/** At most five slides; a sixth is refused by the API. */
export const MAX_HERO_SLIDES = 5;

/**
 * One CTA is required, a second is optional — the two-button case is a photo
 * that shows one bike but belongs to a whole category (one button to the
 * bike, one to the category).
 */
export const MAX_HERO_CTAS_PER_SLIDE = 2;

export const MAX_HERO_CTA_LABEL_LENGTH = 40;
export const MAX_HERO_EYEBROW_LENGTH = 60;
export const MAX_HERO_TITLE_LENGTH = 80;
export const MAX_HERO_SUBTITLE_LENGTH = 160;
export const MAX_HERO_CTA_URL_LENGTH = 200;

/**
 * Where the image is anchored when `object-fit: cover` crops it — a wide
 * landscape shot cropped to a phone's portrait viewport loses most of its
 * width, and which third survives is an editorial decision, not a default.
 */
export const HERO_FOCAL_POINTS = ["left", "center", "right"] as const;

export type HeroFocalPoint = (typeof HERO_FOCAL_POINTS)[number];

/** The stored half of a CTA target — exactly one of `refId`/`url` is set, decided by `type`. */
export interface HeroCtaTarget {
  type: HeroCtaTargetType;
  /** Set for every `type` except `"url"`: the referenced catalog document. */
  refId?: string;
  /** Set only when `type` is `"url"`: an internal path, always starting with `/`. */
  url?: string;
}

/**
 * A CTA as the admin panel sees it: the stored target, plus the `href` the
 * API resolved from it so the panel can show where the button actually goes
 * without re-deriving URL shapes on the client.
 */
export interface AdminHeroSlideCta {
  label: string;
  target: HeroCtaTarget;
  /** Resolved destination, or `null` when the referenced document is gone/archived. */
  href: string | null;
  /** `true` when `href` is `null` — surfaced in the panel so a dead button is visible before it ships. */
  isBroken: boolean;
}

/** A CTA as the storefront sees it: no target internals, and `href` is never null (broken ones are dropped). */
export interface PublicHeroSlideCta {
  label: string;
  href: string;
}

/**
 * Named `Admin…`/`Public…` rather than a bare `HeroSlide`, matching
 * `AdminBike`/`PublicBike` in `catalog.ts` — and, concretely, so the DTO
 * never collides with the Mongoose model of the same concept in
 * `apps/api/src/models/hero-slide.model.ts`.
 */
export interface AdminHeroSlide {
  id: string;
  /** Unset until the first image upload — a slide is created text-first, same two-step flow as a category's image. */
  image?: CategoryImage;
  focalPoint: HeroFocalPoint;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctas: AdminHeroSlideCta[];
  order: number;
  isActive: boolean;
  updatedAt: string;
}

export interface PublicHeroSlide {
  image: CategoryImage;
  // Always set: `listPublic` excludes any slide with no image, so a
  // published slide is guaranteed to carry one — see hero-slide.service.ts.
  focalPoint: HeroFocalPoint;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctas: PublicHeroSlideCta[];
}

/** Write payload for create/update — `image` is uploaded separately, so it is never part of this. */
export interface HeroSlideInput {
  focalPoint: HeroFocalPoint;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  ctas: { label: string; target: HeroCtaTarget }[];
  isActive: boolean;
}
