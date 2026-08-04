import type { UserRole } from "@bw-bikes/shared";
import bcrypt from "bcryptjs";
import { type Document, model, Schema } from "mongoose";
import { BCRYPT_SALT_ROUNDS } from "../config/auth.js";

export interface IUser extends Document {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  role: UserRole;
  emailVerified: boolean;
  emailVerification?: {
    tokenHash?: string;
    expiresAt?: Date;
  };
  passwordReset?: {
    tokenHash?: string;
    expiresAt?: Date;
  };
  passwordChangedAt?: Date;
  twoFactor: {
    enabled: boolean;
    secret?: string; // AES-256-GCM encrypted, never plaintext at rest
    enrolledAt?: Date;
  };
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  isPasswordChangedAfter(jwtIssuedAtSeconds: number): boolean;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 60 },
    lastName: { type: String, required: true, trim: true, maxlength: 60 },
    // select: false — never returned by a default find(); callers that need
    // to verify a password must explicitly `.select("+password")`.
    password: { type: String, required: true, minlength: 8, select: false },
    role: {
      type: String,
      enum: ["customer", "admin", "superadmin"] satisfies UserRole[],
      default: "customer",
    },
    emailVerified: { type: Boolean, default: false },
    emailVerification: {
      tokenHash: { type: String, select: false, index: true },
      expiresAt: { type: Date, select: false },
    },
    passwordReset: {
      tokenHash: { type: String, select: false, index: true },
      expiresAt: { type: Date, select: false },
    },
    // Not a secret — kept in the default projection so `protect` can read
    // it on every request to invalidate tokens issued before a password
    // change, without an extra explicit .select().
    passwordChangedAt: { type: Date },
    twoFactor: {
      enabled: { type: Boolean, default: false },
      secret: { type: String, select: false },
      enrolledAt: { type: Date },
    },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

/**
 * Hashes the password on create/change only (never re-hashes an already
 * hashed value on unrelated saves). On a genuine change (not the initial
 * creation) also stamps `passwordChangedAt` slightly in the past, so a JWT
 * minted in the same request never appears "issued before the change" due
 * to clock/rounding — the classic off-by-one in this pattern.
 */
userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) {
    next();
    return;
  }
  this.password = await bcrypt.hash(this.password, BCRYPT_SALT_ROUNDS);
  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }
  next();
});

userSchema.methods.comparePassword = async function comparePassword(
  this: IUser,
  candidate: string,
): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isPasswordChangedAfter = function isPasswordChangedAfter(
  this: IUser,
  jwtIssuedAtSeconds: number,
): boolean {
  if (!this.passwordChangedAt) return false;
  const changedAtSeconds = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return jwtIssuedAtSeconds < changedAtSeconds;
};

// Defense in depth on top of `select: false`: even if a query explicitly
// selects a secret field, it never leaks through a JSON response.
userSchema.set("toJSON", {
  transform(_doc, ret) {
    const rec = ret as unknown as Record<string, unknown>;
    delete rec["password"];
    delete rec["__v"];
    const twoFactor = rec["twoFactor"] as Record<string, unknown> | undefined;
    if (twoFactor) delete twoFactor["secret"];
    const emailVerification = rec["emailVerification"] as Record<string, unknown> | undefined;
    if (emailVerification) delete emailVerification["tokenHash"];
    const passwordReset = rec["passwordReset"] as Record<string, unknown> | undefined;
    if (passwordReset) delete passwordReset["tokenHash"];
    return ret;
  },
});

export const User = model<IUser>("User", userSchema);
