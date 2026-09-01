import type { UpdateAccountProfileInput } from "@bw-bikes/shared";
import type { Request, Response } from "express";
import { changePassword, getAccount, updateProfile } from "../services/account.service.js";
import { AppError, asyncHandler, sendResponse } from "../utils/index.js";

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError("No autenticado.", 401);
  }
  return req.user.id;
}

export const getAccountHandler = asyncHandler(async (req: Request, res: Response) => {
  const account = await getAccount(requireUserId(req));
  sendResponse(res, 200, "Cuenta obtenida.", { account });
});

export const updateProfileHandler = asyncHandler(async (req: Request, res: Response) => {
  const account = await updateProfile(requireUserId(req), req.body as UpdateAccountProfileInput);
  sendResponse(res, 200, "Perfil actualizado.", { account });
});

export const changePasswordHandler = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  await changePassword(requireUserId(req), currentPassword, newPassword);
  sendResponse(res, 200, "Contraseña actualizada.");
});
