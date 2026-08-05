import type {
  AdminApplication,
  AmbassadorDetails,
  ApplicationAttachment,
  ApplicationType,
  PublicApplication,
  SponsorshipDetails,
} from "@bw-bikes/shared";
import { Types } from "mongoose";
import type { IApplication, IUser } from "../models/index.js";
import { Application } from "../models/index.js";
import { buildSignedAttachmentUrl } from "../services/storage/index.js";
import type { AttachmentFormat } from "../utils/index.js";
import { AppError, buildMeta, parseListQuery } from "../utils/index.js";
import { assertTransition } from "./application-state.js";
import { recordAuditLog } from "./audit-log.service.js";
import type { ActorContext } from "./product.service.js";
import { settingsService } from "./settings.service.js";

/** What the controller hands the service after uploading — Cloudinary's result plus the name the client sent. */
export interface ApplicationAttachmentInput {
  publicId: string;
  format: AttachmentFormat;
  originalName: string;
}

const MODULE_NAME = "applications";
const SORTABLE_FIELDS = ["createdAt", "status", "type"] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function toCoarseFormat(format: AttachmentFormat): "image" | "pdf" {
  return format === "pdf" ? "pdf" : "image";
}

function toPublicApplication(application: IApplication): PublicApplication {
  const attachments: ApplicationAttachment[] = application.attachments.map((attachment) => ({
    format: toCoarseFormat(attachment.format),
    originalName: attachment.originalName,
    url: buildSignedAttachmentUrl(attachment.publicId, attachment.format),
  }));

  return {
    id: String(application._id),
    type: application.type,
    status: application.status,
    ...(application.ambassador
      ? {
          ambassador: {
            discipline: application.ambassador.discipline,
            city: application.ambassador.city,
            socialMediaHandle: application.ambassador.socialMediaHandle,
            followersApprox: application.ambassador.followersApprox,
            motivation: application.ambassador.motivation,
          },
        }
      : {}),
    ...(application.sponsorship
      ? {
          sponsorship: {
            eventName: application.sponsorship.eventName,
            eventDate: application.sponsorship.eventDate.toISOString(),
            venue: application.sponsorship.venue,
            expectedAttendees: application.sponsorship.expectedAttendees,
            supportRequested: application.sponsorship.supportRequested,
          },
        }
      : {}),
    attachments,
    ...(application.rejectionReason !== undefined ? { rejectionReason: application.rejectionReason } : {}),
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
  };
}

function toAdminApplication(
  application: IApplication,
  applicant?: Pick<IUser, "_id" | "email" | "firstName" | "lastName"> | null,
): AdminApplication {
  return {
    ...toPublicApplication(application),
    applicant: applicant
      ? {
          id: String(applicant._id),
          email: applicant.email,
          firstName: applicant.firstName,
          lastName: applicant.lastName,
        }
      : null,
  };
}

/**
 * The three reasons a new application is refused before it ever reaches the
 * unique index. This is what turns the race into a clean, specific 409 in the
 * common (non-concurrent) case; the partial unique index on `{ userId, type,
 * status: "pending" }` is what actually closes the race when two submissions
 * land at once — see `createApplication`'s catch block.
 */
async function assertCanApply(userId: string, type: ApplicationType): Promise<void> {
  const latest = await Application.findOne({ userId, type }).sort({ createdAt: -1 }).exec();
  if (!latest) return;

  if (latest.status === "pending") {
    throw new AppError("Ya tienes una solicitud de este tipo en revisión.", 409);
  }

  if (latest.status === "approved") {
    throw new AppError("Tu solicitud de este tipo ya fue aprobada.", 409);
  }

  // Rejected: blocked only within the cooldown window, measured from the
  // rejection itself, not from the original submission.
  if (latest.rejectedAt) {
    const { applications } = await settingsService.get();
    const cooldownEndsAt = new Date(latest.rejectedAt.getTime() + applications.cooldownDays * MS_PER_DAY);
    if (cooldownEndsAt > new Date()) {
      throw new AppError(
        `Puedes volver a enviar una solicitud de este tipo a partir del ${cooldownEndsAt.toISOString().slice(0, 10)}.`,
        409,
      );
    }
  }
}

interface CreateApplicationParams {
  userId: string;
  type: ApplicationType;
  ambassador?: AmbassadorDetails;
  sponsorship?: SponsorshipDetails;
  attachments: ApplicationAttachmentInput[];
}

async function createApplication(params: CreateApplicationParams, actor: ActorContext): Promise<PublicApplication> {
  await assertCanApply(params.userId, params.type);

  let application: IApplication;
  try {
    application = await Application.create({
      userId: params.userId,
      type: params.type,
      status: "pending",
      ...(params.ambassador ? { ambassador: params.ambassador } : {}),
      ...(params.sponsorship ? { sponsorship: params.sponsorship } : {}),
      attachments: params.attachments,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError("Ya tienes una solicitud de este tipo en trámite.", 409);
    }
    throw error;
  }

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "application.submitted",
    module: MODULE_NAME,
    targetId: String(application._id),
    after: { type: params.type },
    ip: actor.ip,
  });

  return toPublicApplication(application);
}

async function submitAmbassadorApplication(
  userId: string,
  input: AmbassadorDetails,
  attachments: ApplicationAttachmentInput[],
  actor: ActorContext,
): Promise<PublicApplication> {
  return createApplication({ userId, type: "ambassador", ambassador: input, attachments }, actor);
}

async function submitSponsorshipApplication(
  userId: string,
  input: SponsorshipDetails,
  attachments: ApplicationAttachmentInput[],
  actor: ActorContext,
): Promise<PublicApplication> {
  return createApplication({ userId, type: "event_sponsorship", sponsorship: input, attachments }, actor);
}

async function findByIdOrFail(applicationId: string): Promise<IApplication> {
  if (!Types.ObjectId.isValid(applicationId)) {
    throw new AppError("La solicitud no existe.", 404);
  }
  const application = await Application.findById(applicationId).exec();
  if (!application) {
    throw new AppError("La solicitud no existe.", 404);
  }
  return application;
}

async function listForUser(userId: string): Promise<PublicApplication[]> {
  const documents = await Application.find({ userId }).sort({ createdAt: -1 }).exec();
  return documents.map(toPublicApplication);
}

/** Named filters only — the client's query object never becomes a Mongo filter. */
async function listForAdmin(query: Record<string, unknown>) {
  const { page, limit, skip, sort } = parseListQuery(query, {
    allowedSortFields: SORTABLE_FIELDS,
    defaultSort: "-createdAt",
  });

  const filter: Record<string, unknown> = {};
  const status = query["status"];
  if (typeof status === "string") filter["status"] = status;
  const type = query["type"];
  if (typeof type === "string") filter["type"] = type;

  const [documents, total] = await Promise.all([
    Application.find(filter).sort(sort).skip(skip).limit(limit).populate("userId", "email firstName lastName").exec(),
    Application.countDocuments(filter).exec(),
  ]);

  return {
    applications: documents.map((application) =>
      toAdminApplication(application, application.populated("userId") ? (application.userId as unknown as IUser) : null),
    ),
    meta: buildMeta(total, page, limit),
  };
}

async function getForAdmin(applicationId: string): Promise<AdminApplication> {
  const application = await findByIdOrFail(applicationId);
  await application.populate("userId", "email firstName lastName");
  return toAdminApplication(
    application,
    application.populated("userId") ? (application.userId as unknown as IUser) : null,
  );
}

async function approve(applicationId: string, actor: ActorContext): Promise<AdminApplication> {
  const application = await findByIdOrFail(applicationId);
  assertTransition(application.status, "approved");

  application.status = "approved";
  await application.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "application.approved",
    module: MODULE_NAME,
    targetId: String(application._id),
    before: { status: "pending" },
    after: { status: "approved" },
    ip: actor.ip,
  });

  return getForAdmin(applicationId);
}

/** Rejecting requires a reason — the applicant is about to be told no, and "sin motivo" isn't an answer. */
async function reject(applicationId: string, reason: string, actor: ActorContext): Promise<AdminApplication> {
  const application = await findByIdOrFail(applicationId);
  assertTransition(application.status, "rejected");

  application.status = "rejected";
  application.rejectionReason = reason;
  application.rejectedAt = new Date();
  await application.save();

  await recordAuditLog({
    actorId: actor.actorId,
    actorType: "user",
    action: "application.rejected",
    module: MODULE_NAME,
    targetId: String(application._id),
    before: { status: "pending" },
    after: { status: "rejected", reason },
    ip: actor.ip,
  });

  return getForAdmin(applicationId);
}

export const applicationService = {
  submitAmbassadorApplication,
  submitSponsorshipApplication,
  listForUser,
  getForAdmin,
  listForAdmin,
  findByIdOrFail,
  approve,
  reject,
};

export { toAdminApplication, toPublicApplication };
