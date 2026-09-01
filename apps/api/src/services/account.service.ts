import type { AccountDTO, UpdateAccountProfileInput } from "@bw-bikes/shared";
import { type IUser, User } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { passwordBreachService } from "./password-breach.service.js";
import { revokeAllSessions } from "./token.service.js";

const BREACHED_PASSWORD_MESSAGE =
  "Esta contraseña ha aparecido en fugas de datos conocidas. Elige una diferente.";

function toAccountDTO(user: IUser): AccountDTO {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    birthDate: user.birthDate?.toISOString(),
    city: user.city,
  };
}

async function findAccountUser(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }
  return user;
}

export async function getAccount(userId: string): Promise<AccountDTO> {
  const user = await findAccountUser(userId);
  return toAccountDTO(user);
}

export async function updateProfile(userId: string, input: UpdateAccountProfileInput): Promise<AccountDTO> {
  const user = await findAccountUser(userId);

  if (input.firstName !== undefined) user.firstName = input.firstName;
  if (input.lastName !== undefined) user.lastName = input.lastName;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.birthDate !== undefined) user.birthDate = new Date(input.birthDate);
  if (input.city !== undefined) user.city = input.city;

  await user.save();
  return toAccountDTO(user);
}

/**
 * Verifies the current password, then reuses `resetPassword`'s exact
 * mechanism: assign the new password and let the model's `pre("save")` hook
 * hash it and stamp `passwordChangedAt`, then revoke every session
 * (`revokeAllSessions`, the same call `logoutAllHandler` makes) so a leaked
 * old session doesn't survive a password change either.
 */
export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }

  const matches = await user.comparePassword(currentPassword);
  if (!matches) {
    throw new AppError("La contraseña actual es incorrecta.", 401);
  }

  if (await passwordBreachService.isBreached(newPassword)) {
    throw new AppError(BREACHED_PASSWORD_MESSAGE, 400);
  }

  user.password = newPassword;
  await user.save();

  await revokeAllSessions(String(user._id));
}
