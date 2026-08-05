/**
 * The two forms the spec calls for — ambassador and event sponsorship — share
 * one collection and one approval flow (`pending → approved | rejected`,
 * rejection with a mandatory reason, a reapplication cooldown) and differ only
 * in the fields each form asks for. Splitting them into two collections would
 * duplicate the state machine and the cooldown logic for no benefit; a shared
 * `type` discriminant plus two optional detail blocks keeps one of everything.
 */
export type ApplicationType = "ambassador" | "event_sponsorship";

export type ApplicationStatus = "pending" | "approved" | "rejected";

/** Present only when `type === "ambassador"`. */
export interface AmbassadorDetails {
  discipline: string;
  city: string;
  socialMediaHandle: string;
  followersApprox: number;
  motivation: string;
}

/** Present only when `type === "event_sponsorship"`. */
export interface SponsorshipDetails {
  eventName: string;
  /** ISO date of the event itself, not the application. */
  eventDate: string;
  venue: string;
  expectedAttendees: number;
  supportRequested: string;
}

/**
 * An uploaded attachment. Stored privately in Cloudinary (`authenticated`
 * delivery) because these documents belong to a real person or a third
 * party's event proposal — `url` is a short-lived signed link generated when
 * the DTO is built, never a permanent public one.
 */
export interface ApplicationAttachment {
  format: "image" | "pdf";
  originalName: string;
  url: string;
}

export interface PublicApplication {
  id: string;
  type: ApplicationType;
  status: ApplicationStatus;
  ambassador?: AmbassadorDetails;
  sponsorship?: SponsorshipDetails;
  attachments: ApplicationAttachment[];
  /** Present only when `status === "rejected"`. */
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** What the admin bandeja additionally sees: who applied. */
export interface AdminApplication extends PublicApplication {
  applicant: { id: string; email: string; firstName: string; lastName: string } | null;
}
