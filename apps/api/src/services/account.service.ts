import type {
  AccountDTO,
  AddWishlistItemInput,
  BillingInfo,
  CustomerFit,
  ItemType,
  SaveAddressInput,
  SavedAddress,
  UpdateAccountProfileInput,
  UpdateFitInput,
  WishlistEntry,
} from "@bw-bikes/shared";
import { Types } from "mongoose";
import { type ISavedAddress, MAX_SAVED_ADDRESSES } from "../models/schemas/saved-address.schema.js";
import { type IWishlistEntry, MAX_WISHLIST_ITEMS } from "../models/schemas/wishlist-entry.schema.js";
import { type IAccessory, type IBike, type IUser, User } from "../models/index.js";
import { AppError } from "../utils/index.js";
import { toPublicAccessory } from "./accessory.service.js";
import { toPublicBike } from "./bike.service.js";
import { loadProducts } from "./order-pricing.js";
import { passwordBreachService } from "./password-breach.service.js";
import { revokeAllSessions } from "./token.service.js";

const BREACHED_PASSWORD_MESSAGE =
  "Esta contraseña ha aparecido en fugas de datos conocidas. Elige una diferente.";

function toSavedAddressDTO(address: ISavedAddress): SavedAddress {
  return {
    id: String(address._id),
    label: address.label,
    isDefault: address.isDefault,
    recipientName: address.recipientName,
    phone: address.phone,
    street: address.street,
    interiorNumber: address.interiorNumber,
    neighborhood: address.neighborhood,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    references: address.references,
  };
}

function toAccountDTO(user: IUser): AccountDTO {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone,
    birthDate: user.birthDate?.toISOString(),
    city: user.city,
    addresses: user.addresses.map(toSavedAddressDTO),
    billingInfo: user.billingInfo,
    fit: user.fit,
    wishlistCount: user.wishlist.length,
  };
}

async function findAccountUser(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError("Sesión inválida o expirada.", 401);
  }
  return user;
}

/** Finds an address subdocument by id, or throws the same 404 every other by-id lookup in this API throws. */
function findAddressOrFail(user: IUser, addressId: string): ISavedAddress {
  const address = user.addresses.id(addressId);
  if (!address) {
    throw new AppError("Dirección no encontrada.", 404);
  }
  return address;
}

/** Unmarks every other address's `isDefault`, so at most one ever stays true after a save. */
function clearOtherDefaults(user: IUser, keepAddressId: string): void {
  for (const address of user.addresses) {
    if (String(address._id) !== keepAddressId) {
      address.isDefault = false;
    }
  }
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

export async function listAddresses(userId: string): Promise<SavedAddress[]> {
  const user = await findAccountUser(userId);
  return user.addresses.map(toSavedAddressDTO);
}

/**
 * The first address in an empty book is marked `isDefault` automatically
 * (A3-direcciones.md): a book with exactly one entry and no default makes no
 * sense to the customer.
 */
export async function createAddress(userId: string, input: SaveAddressInput): Promise<SavedAddress[]> {
  const user = await findAccountUser(userId);

  if (user.addresses.length >= MAX_SAVED_ADDRESSES) {
    throw new AppError(`No puedes guardar más de ${MAX_SAVED_ADDRESSES} direcciones.`, 409);
  }

  user.addresses.push({ ...input, isDefault: user.addresses.length === 0 });
  await user.save();
  return user.addresses.map(toSavedAddressDTO);
}

export async function updateAddress(userId: string, addressId: string, input: SaveAddressInput): Promise<SavedAddress[]> {
  const user = await findAccountUser(userId);
  const address = findAddressOrFail(user, addressId);

  address.label = input.label;
  address.recipientName = input.recipientName;
  address.phone = input.phone;
  address.street = input.street;
  address.interiorNumber = input.interiorNumber;
  address.neighborhood = input.neighborhood;
  address.city = input.city;
  address.state = input.state;
  address.postalCode = input.postalCode;
  address.country = input.country;
  address.references = input.references;

  await user.save();
  return user.addresses.map(toSavedAddressDTO);
}

/**
 * Deleting the default address promotes the first one remaining, so the book
 * never ends up with entries but no default (A3-direcciones.md). Deleting the
 * last address leaves an empty book — nothing more to do.
 */
export async function removeAddress(userId: string, addressId: string): Promise<SavedAddress[]> {
  const user = await findAccountUser(userId);
  const address = findAddressOrFail(user, addressId);
  const wasDefault = address.isDefault;

  user.addresses.pull({ _id: addressId });

  if (wasDefault && user.addresses.length > 0) {
    user.addresses[0]!.isDefault = true;
  }

  await user.save();
  return user.addresses.map(toSavedAddressDTO);
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<SavedAddress[]> {
  const user = await findAccountUser(userId);
  const address = findAddressOrFail(user, addressId);

  clearOtherDefaults(user, addressId);
  address.isDefault = true;

  await user.save();
  return user.addresses.map(toSavedAddressDTO);
}

export async function setBillingInfo(userId: string, billingInfo: BillingInfo): Promise<BillingInfo> {
  const user = await findAccountUser(userId);
  user.billingInfo = billingInfo;
  await user.save();
  return user.billingInfo!;
}

export async function removeBillingInfo(userId: string): Promise<void> {
  const user = await findAccountUser(userId);
  user.billingInfo = undefined;
  await user.save();
}

export async function setFit(userId: string, input: UpdateFitInput): Promise<CustomerFit> {
  const user = await findAccountUser(userId);
  user.fit = {
    heightCm: input.heightCm,
    rideStyle: input.rideStyle,
    gearSizes: input.gearSizes ?? [],
  };
  await user.save();
  return user.fit!;
}

/**
 * Resolves every saved reference against the live catalog in one batch —
 * reusing `loadProducts`, the same lookup `resolveCartLines` prices a cart
 * with, so this never re-implements "does this itemId still exist and is it
 * active" a second time. A product that no longer resolves, or resolves but
 * is archived, comes back `isAvailable: false` instead of being dropped —
 * the wishlist never silently shrinks (A5-guardados.md).
 */
async function hydrateWishlist(entries: IWishlistEntry[]): Promise<WishlistEntry[]> {
  if (entries.length === 0) return [];

  const products = await loadProducts(
    entries.map((entry) => ({ itemType: entry.itemType, itemId: String(entry.itemId), sku: "", qty: 1 })),
  );

  return entries.map((entry) => {
    const itemId = String(entry.itemId);
    const product = products.get(`${entry.itemType}:${itemId}`);

    return {
      itemType: entry.itemType,
      itemId,
      addedAt: entry.addedAt.toISOString(),
      isAvailable: Boolean(product?.isActive),
      ...(product
        ? { product: entry.itemType === "bike" ? toPublicBike(product as IBike) : toPublicAccessory(product as IAccessory) }
        : {}),
    };
  });
}

export async function listWishlist(userId: string): Promise<WishlistEntry[]> {
  const user = await findAccountUser(userId);
  return hydrateWishlist(user.wishlist);
}

/**
 * Idempotent: saving an already-saved product is a no-op, not a duplicate or
 * an error (A5-guardados.md) — `wasNew` is what lets the controller answer
 * 200 instead of 201 for that case.
 */
export async function addWishlistItem(
  userId: string,
  input: AddWishlistItemInput,
): Promise<{ wishlist: WishlistEntry[]; wasNew: boolean }> {
  const user = await findAccountUser(userId);
  const alreadySaved = user.wishlist.some(
    (entry) => entry.itemType === input.itemType && String(entry.itemId) === input.itemId,
  );

  if (!alreadySaved) {
    if (user.wishlist.length >= MAX_WISHLIST_ITEMS) {
      throw new AppError(`No puedes guardar más de ${MAX_WISHLIST_ITEMS} productos guardados.`, 409);
    }
    user.wishlist.push({
      itemType: input.itemType,
      itemId: new Types.ObjectId(input.itemId),
      addedAt: new Date(),
    } as IWishlistEntry);
    await user.save();
  }

  return { wishlist: await hydrateWishlist(user.wishlist), wasNew: !alreadySaved };
}

export async function removeWishlistItem(userId: string, itemType: ItemType, itemId: string): Promise<WishlistEntry[]> {
  const user = await findAccountUser(userId);
  user.wishlist = user.wishlist.filter((entry) => !(entry.itemType === itemType && String(entry.itemId) === itemId));
  await user.save();
  return hydrateWishlist(user.wishlist);
}
