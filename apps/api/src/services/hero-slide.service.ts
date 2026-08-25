import type {
  AdminHeroSlide,
  AdminHeroSlideCta,
  AuditAction,
  CategoryImage,
  HeroCtaTargetType,
  HeroSlideInput,
  PublicHeroSlide,
  PublicHeroSlideCta,
} from "@bw-bikes/shared";
import { MAX_HERO_SLIDES } from "@bw-bikes/shared";
import { type Model, Types } from "mongoose";
import {
  Accessory,
  AccessoryCategory,
  Bike,
  BikeCategory,
  HeroSlide,
  type IHeroSlide,
  type IHeroSlideCta,
} from "../models/index.js";
import { AppError } from "../utils/index.js";
import { recordAuditLog } from "./audit-log.service.js";
import { deleteImage } from "./storage/index.js";

const MODULE_NAME = "content.hero";

interface ActorContext {
  actorId: string;
  ip?: string | undefined;
}

/**
 * A catalog document, reduced to what a CTA needs to know about it. Both
 * products and categories expose `slug` and `isActive`; only products can be
 * archived, so `archivedAt` is optional here rather than modelled twice.
 */
interface LinkableDocument {
  _id: Types.ObjectId;
  slug: string;
  isActive: boolean;
  archivedAt?: Date | null;
}

/**
 * URL shape per target type. These are the storefront's routes (M12 entregas
 * 4+), so a slide can reference a page that doesn't render yet — the link is
 * correct, the page is pending.
 */
const HREF_BUILDERS: Record<Exclude<HeroCtaTargetType, "url">, (slug: string) => string> = {
  bike: (slug) => `/bicicletas/${slug}`,
  bikeCategory: (slug) => `/bicicletas?categoria=${slug}`,
  accessory: (slug) => `/accesorios/${slug}`,
  accessoryCategory: (slug) => `/accesorios?categoria=${slug}`,
};

/**
 * Narrowed to `Model<LinkableDocument>` rather than left as the union of the
 * four concrete models: indexing a union of `Model<T>` produces a union of
 * incompatible `find()` overloads that TypeScript refuses to call at all.
 * The cast is honest — every one of these four collections really does carry
 * `slug` and `isActive`, and `archivedAt` is optional precisely because only
 * the two product models have it.
 */
const MODELS_BY_TARGET_TYPE = {
  bike: Bike,
  bikeCategory: BikeCategory,
  accessory: Accessory,
  accessoryCategory: AccessoryCategory,
} as unknown as Record<Exclude<HeroCtaTargetType, "url">, Model<LinkableDocument>>;

/**
 * Resolves every catalog reference across every slide in one query per
 * collection, not one per CTA.
 *
 * Written as a batch rather than a `populate()` on the model because the
 * *absence* of a document is the interesting case: `populate` on a deleted
 * reference yields `null` indistinguishably from a field that was never set,
 * while a slug that resolves to nothing here is precisely the signal that a
 * button is dead and must be dropped from the public payload.
 */
async function resolveHrefs(slides: IHeroSlide[]): Promise<Map<string, string>> {
  const idsByType = new Map<Exclude<HeroCtaTargetType, "url">, Set<string>>();

  for (const slide of slides) {
    for (const cta of slide.ctas) {
      const { type, refId } = cta.target;
      if (type === "url" || !refId) continue;
      const bucket = idsByType.get(type) ?? new Set<string>();
      bucket.add(String(refId));
      idsByType.set(type, bucket);
    }
  }

  const hrefByRefId = new Map<string, string>();

  await Promise.all(
    [...idsByType].map(async ([type, ids]) => {
      const documents = (await MODELS_BY_TARGET_TYPE[type]
        .find({ _id: { $in: [...ids].map((id) => new Types.ObjectId(id)) } })
        .select("slug isActive archivedAt")
        .lean()
        .exec()) as unknown as LinkableDocument[];

      for (const document of documents) {
        // An inactive or archived destination is treated exactly like a
        // deleted one: the storefront would serve it a 404 either way, so
        // there is no honest link to build.
        if (!document.isActive || document.archivedAt) continue;
        hrefByRefId.set(`${type}:${String(document._id)}`, HREF_BUILDERS[type](document.slug));
      }
    }),
  );

  return hrefByRefId;
}

function resolveCta(cta: IHeroSlideCta, hrefByRefId: Map<string, string>): AdminHeroSlideCta {
  const { type, refId, url } = cta.target;
  const href = type === "url" ? (url ?? null) : (hrefByRefId.get(`${type}:${String(refId)}`) ?? null);

  return {
    label: cta.label,
    target: {
      type,
      ...(refId ? { refId: String(refId) } : {}),
      ...(url ? { url } : {}),
    },
    href,
    isBroken: href === null,
  };
}

function toAdminHeroSlide(slide: IHeroSlide, hrefByRefId: Map<string, string>): AdminHeroSlide {
  return {
    id: String(slide._id),
    ...(slide.image ? { image: slide.image as CategoryImage } : {}),
    focalPoint: slide.focalPoint,
    ...(slide.eyebrow ? { eyebrow: slide.eyebrow } : {}),
    title: slide.title,
    ...(slide.subtitle ? { subtitle: slide.subtitle } : {}),
    ctas: slide.ctas.map((cta) => resolveCta(cta, hrefByRefId)),
    order: slide.order,
    isActive: slide.isActive,
    updatedAt: slide.updatedAt.toISOString(),
  };
}

/**
 * The public projection drops broken CTAs entirely, and with them any slide
 * left with no button at all — a full-screen hero panel whose only call to
 * action 404s is worse than one fewer slide.
 */
function toPublicHeroSlide(slide: IHeroSlide, hrefByRefId: Map<string, string>): PublicHeroSlide | null {
  // A slide with no image yet is still being drafted — never a real visitor's problem.
  if (!slide.image) return null;

  const ctas: PublicHeroSlideCta[] = [];
  for (const cta of slide.ctas) {
    const resolved = resolveCta(cta, hrefByRefId);
    if (resolved.href) ctas.push({ label: resolved.label, href: resolved.href });
  }
  if (ctas.length === 0) return null;

  return {
    image: slide.image as CategoryImage,
    focalPoint: slide.focalPoint,
    ...(slide.eyebrow ? { eyebrow: slide.eyebrow } : {}),
    title: slide.title,
    ...(slide.subtitle ? { subtitle: slide.subtitle } : {}),
    ctas,
  };
}

async function findByIdOrFail(id: string): Promise<IHeroSlide> {
  const slide = await HeroSlide.findById(id).exec();
  if (!slide) {
    throw new AppError("Slide no encontrado.", 404);
  }
  return slide;
}

/** Every slide, display order, with each CTA's destination resolved and dead ones flagged. */
async function listAdmin(): Promise<AdminHeroSlide[]> {
  const slides = await HeroSlide.find().sort({ order: 1, _id: 1 }).exec();
  const hrefByRefId = await resolveHrefs(slides);
  return slides.map((slide) => toAdminHeroSlide(slide, hrefByRefId));
}

/** Active slides only, in order, with broken CTAs and empty slides removed. */
async function listPublic(): Promise<PublicHeroSlide[]> {
  const slides = await HeroSlide.find({ isActive: true }).sort({ order: 1, _id: 1 }).exec();
  const hrefByRefId = await resolveHrefs(slides);

  const publicSlides: PublicHeroSlide[] = [];
  for (const slide of slides) {
    const publicSlide = toPublicHeroSlide(slide, hrefByRefId);
    if (publicSlide) publicSlides.push(publicSlide);
  }
  return publicSlides;
}

function toStoredCtas(ctas: HeroSlideInput["ctas"]): IHeroSlideCta[] {
  return ctas.map((cta) => ({
    label: cta.label,
    target: {
      type: cta.target.type,
      ...(cta.target.refId ? { refId: new Types.ObjectId(cta.target.refId) } : {}),
      ...(cta.target.url ? { url: cta.target.url } : {}),
    },
  }));
}

/**
 * Refuses a reference to a document that doesn't exist *at capture time*.
 * This is deliberately not the same guarantee as `resolveHrefs`: this one
 * stops a typo'd id from ever being stored, while that one copes with a
 * destination that disappears later. Both are needed — neither substitutes
 * for the other.
 */
async function assertTargetsExist(ctas: HeroSlideInput["ctas"]): Promise<void> {
  await Promise.all(
    ctas.map(async (cta) => {
      const { type, refId } = cta.target;
      if (type === "url" || !refId) return;

      const exists = await MODELS_BY_TARGET_TYPE[type].exists({ _id: refId }).exec();
      if (!exists) {
        throw new AppError(`El destino del botón "${cta.label}" ya no existe en el catálogo.`, 400);
      }
    }),
  );
}

async function create(input: HeroSlideInput, actor: ActorContext): Promise<AdminHeroSlide> {
  const count = await HeroSlide.countDocuments().exec();
  if (count >= MAX_HERO_SLIDES) {
    throw new AppError(
      `El hero admite un máximo de ${MAX_HERO_SLIDES} slides. Elimina o desactiva uno antes de agregar otro.`,
      400,
    );
  }
  await assertTargetsExist(input.ctas);

  // No `image` here — creation is text-first, same two-step flow as a
  // category's image (`setImage`, right below). Appended last rather than
  // inserted: a new slide taking over position 1 without being asked to
  // would silently change what every visitor sees first. Reordering is its
  // own explicit action.
  const slide = await HeroSlide.create({
    focalPoint: input.focalPoint,
    ...(input.eyebrow ? { eyebrow: input.eyebrow } : {}),
    title: input.title,
    ...(input.subtitle ? { subtitle: input.subtitle } : {}),
    ctas: toStoredCtas(input.ctas),
    order: count,
    isActive: input.isActive,
  });

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.hero_slide_created" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: String(slide._id),
    after: { title: slide.title, isActive: slide.isActive },
    ip: actor.ip,
  });

  const hrefByRefId = await resolveHrefs([slide]);
  return toAdminHeroSlide(slide, hrefByRefId);
}

async function update(id: string, input: HeroSlideInput, actor: ActorContext): Promise<AdminHeroSlide> {
  const slide = await findByIdOrFail(id);
  const before = { title: slide.title, isActive: slide.isActive, ctaCount: slide.ctas.length };

  await assertTargetsExist(input.ctas);

  // A replace contract, like every settings section: the validator requires
  // every field, so an absent optional means "cleared", not "unchanged".
  slide.focalPoint = input.focalPoint;
  slide.eyebrow = input.eyebrow;
  slide.title = input.title;
  slide.subtitle = input.subtitle;
  slide.ctas = toStoredCtas(input.ctas);
  slide.isActive = input.isActive;
  await slide.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.hero_slide_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before,
    after: { title: slide.title, isActive: slide.isActive, ctaCount: slide.ctas.length },
    ip: actor.ip,
  });

  const hrefByRefId = await resolveHrefs([slide]);
  return toAdminHeroSlide(slide, hrefByRefId);
}

async function setImage(id: string, image: CategoryImage, actor: ActorContext): Promise<AdminHeroSlide> {
  const slide = await findByIdOrFail(id);
  const previousPublicId = slide.image?.publicId;

  slide.image = image;
  await slide.save();

  // Best-effort, after the save: same order as `category.service.ts`'s
  // `setImage` — losing the old asset matters less than leaving the document
  // pointing at one that no longer exists.
  if (previousPublicId && previousPublicId !== image.publicId) {
    await deleteImage(previousPublicId);
  }

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.hero_slide_image_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    after: { publicId: image.publicId },
    ip: actor.ip,
  });

  const hrefByRefId = await resolveHrefs([slide]);
  return toAdminHeroSlide(slide, hrefByRefId);
}

async function removeImage(id: string, actor: ActorContext): Promise<AdminHeroSlide> {
  const slide = await findByIdOrFail(id);
  if (!slide.image) {
    throw new AppError("El slide no tiene imagen.", 409);
  }
  const publicId = slide.image.publicId;

  slide.image = undefined;
  await slide.save();
  await deleteImage(publicId);

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.hero_slide_image_updated" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before: { publicId },
    ip: actor.ip,
  });

  const hrefByRefId = await resolveHrefs([slide]);
  return toAdminHeroSlide(slide, hrefByRefId);
}

async function remove(id: string, actor: ActorContext): Promise<void> {
  const slide = await findByIdOrFail(id);
  const publicId = slide.image?.publicId;

  await slide.deleteOne();
  if (publicId) {
    await deleteImage(publicId);
  }

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.hero_slide_deleted" satisfies AuditAction,
    module: MODULE_NAME,
    targetId: id,
    before: { title: slide.title },
    ip: actor.ip,
  });
}

/**
 * Reorders by rewriting every slide's `order` from the given sequence.
 *
 * Requires the *complete* set of ids rather than accepting a partial list:
 * a subset would leave the omitted slides holding stale positions that
 * collide with the new ones, and "what happens to the slides you didn't
 * mention" has no answer a caller could rely on.
 */
async function reorder(ids: string[], actor: ActorContext): Promise<AdminHeroSlide[]> {
  const total = await HeroSlide.countDocuments().exec();
  const unique = new Set(ids);

  if (unique.size !== ids.length || ids.length !== total) {
    throw new AppError("El nuevo orden debe incluir cada slide exactamente una vez.", 400);
  }

  const existing = await HeroSlide.countDocuments({ _id: { $in: ids } }).exec();
  if (existing !== ids.length) {
    throw new AppError("El nuevo orden incluye un slide que ya no existe.", 400);
  }

  await HeroSlide.bulkWrite(
    ids.map((id, index) => ({ updateOne: { filter: { _id: id }, update: { $set: { order: index } } } })),
  );

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "content.hero_slides_reordered" satisfies AuditAction,
    module: MODULE_NAME,
    after: { order: ids },
    ip: actor.ip,
  });

  return listAdmin();
}

export const heroSlideService = {
  listAdmin,
  listPublic,
  findByIdOrFail,
  create,
  update,
  setImage,
  removeImage,
  remove,
  reorder,
};
