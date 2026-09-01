import type {
  AddWishlistItemInput,
  BillingInfo,
  ItemType,
  SaveAddressInput,
  UpdateAccountProfileInput,
  UpdateFitInput,
} from "@bw-bikes/shared";
import type { Request, Response } from "express";
import {
  addWishlistItem,
  changePassword,
  createAddress,
  getAccount,
  listAddresses,
  listWishlist,
  removeAddress,
  removeBillingInfo,
  removeWishlistItem,
  setBillingInfo,
  setDefaultAddress,
  setFit,
  updateAddress,
  updateProfile,
} from "../services/account.service.js";
import { AppError, asyncHandler, routeParam, sendResponse } from "../utils/index.js";

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

export const listAddressesHandler = asyncHandler(async (req: Request, res: Response) => {
  const addresses = await listAddresses(requireUserId(req));
  sendResponse(res, 200, "Direcciones obtenidas.", { addresses });
});

export const createAddressHandler = asyncHandler(async (req: Request, res: Response) => {
  const addresses = await createAddress(requireUserId(req), req.body as SaveAddressInput);
  sendResponse(res, 201, "Dirección guardada.", { addresses });
});

export const updateAddressHandler = asyncHandler(async (req: Request, res: Response) => {
  const addresses = await updateAddress(requireUserId(req), routeParam(req, "addressId"), req.body as SaveAddressInput);
  sendResponse(res, 200, "Dirección actualizada.", { addresses });
});

export const removeAddressHandler = asyncHandler(async (req: Request, res: Response) => {
  const addresses = await removeAddress(requireUserId(req), routeParam(req, "addressId"));
  sendResponse(res, 200, "Dirección eliminada.", { addresses });
});

export const setDefaultAddressHandler = asyncHandler(async (req: Request, res: Response) => {
  const addresses = await setDefaultAddress(requireUserId(req), routeParam(req, "addressId"));
  sendResponse(res, 200, "Dirección marcada como predeterminada.", { addresses });
});

export const setBillingInfoHandler = asyncHandler(async (req: Request, res: Response) => {
  const billingInfo = await setBillingInfo(requireUserId(req), req.body as BillingInfo);
  sendResponse(res, 200, "Datos de facturación guardados.", { billingInfo });
});

export const removeBillingInfoHandler = asyncHandler(async (req: Request, res: Response) => {
  await removeBillingInfo(requireUserId(req));
  sendResponse(res, 200, "Datos de facturación eliminados.");
});

export const setFitHandler = asyncHandler(async (req: Request, res: Response) => {
  const fit = await setFit(requireUserId(req), req.body as UpdateFitInput);
  sendResponse(res, 200, "Tus tallas se guardaron.", { fit });
});

export const listWishlistHandler = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await listWishlist(requireUserId(req));
  sendResponse(res, 200, "Guardados obtenidos.", { wishlist });
});

export const addWishlistItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const { wishlist, wasNew } = await addWishlistItem(requireUserId(req), req.body as AddWishlistItemInput);
  sendResponse(res, wasNew ? 201 : 200, "Producto guardado.", { wishlist });
});

export const removeWishlistItemHandler = asyncHandler(async (req: Request, res: Response) => {
  const wishlist = await removeWishlistItem(
    requireUserId(req),
    routeParam(req, "itemType") as ItemType,
    routeParam(req, "itemId"),
  );
  sendResponse(res, 200, "Producto quitado de guardados.", { wishlist });
});
