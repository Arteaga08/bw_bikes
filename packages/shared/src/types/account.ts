/**
 * The customer account (`GET /api/v1/account`, M13). A2 fills only the
 * profile fields below; A3–A5 extend this same shape with addresses, billing
 * info, fit, and wishlist as each is built — the DTO is defined complete
 * from the start so those entregas only add fields, never reshape this one.
 */
export interface AccountDTO {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  birthDate?: string;
  city?: string;
}

export interface UpdateAccountProfileInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  birthDate?: string;
  city?: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}
