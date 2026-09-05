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
import { apiFetch } from "./client";

/**
 * `options.unauthorizedRedirectPath: null` is for a storefront call site that
 * must not send an anonymous visitor into `/ingresar` just for checking
 * whether they're signed in — `ProductInfo`'s fit lookup (M-optimización) is
 * the first one: it wants "no fit, this visitor is anonymous" as a normal
 * outcome, not a redirect away from the PDP they're already looking at.
 */
export async function getAccount(options?: { unauthorizedRedirectPath?: string | null }): Promise<AccountDTO> {
  const { data } = await apiFetch<{ account: AccountDTO }>("/account", undefined, options);
  return data.account;
}

export async function updateAccountProfile(input: UpdateAccountProfileInput): Promise<AccountDTO> {
  const { data } = await apiFetch<{ account: AccountDTO }>("/account/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data.account;
}

export async function changeAccountPassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiFetch("/account/password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function createAccountAddress(input: SaveAddressInput): Promise<SavedAddress[]> {
  const { data } = await apiFetch<{ addresses: SavedAddress[] }>("/account/addresses", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.addresses;
}

export async function updateAccountAddress(addressId: string, input: SaveAddressInput): Promise<SavedAddress[]> {
  const { data } = await apiFetch<{ addresses: SavedAddress[] }>(`/account/addresses/${addressId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return data.addresses;
}

export async function deleteAccountAddress(addressId: string): Promise<SavedAddress[]> {
  const { data } = await apiFetch<{ addresses: SavedAddress[] }>(`/account/addresses/${addressId}`, {
    method: "DELETE",
  });
  return data.addresses;
}

export async function setDefaultAccountAddress(addressId: string): Promise<SavedAddress[]> {
  const { data } = await apiFetch<{ addresses: SavedAddress[] }>(`/account/addresses/${addressId}/default`, {
    method: "POST",
  });
  return data.addresses;
}

export async function setAccountBillingInfo(input: BillingInfo): Promise<BillingInfo> {
  const { data } = await apiFetch<{ billingInfo: BillingInfo }>("/account/billing-info", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return data.billingInfo;
}

export async function deleteAccountBillingInfo(): Promise<void> {
  await apiFetch("/account/billing-info", { method: "DELETE" });
}

export async function setAccountFit(input: UpdateFitInput): Promise<CustomerFit> {
  const { data } = await apiFetch<{ fit: CustomerFit }>("/account/fit", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return data.fit;
}

/**
 * `unauthorizedRedirectPath: null` on every wishlist call below: unlike the
 * rest of this file (only ever called from behind `/mi-cuenta`'s own session
 * guard), `SaveButton`/`WishlistProvider` mount on public storefront pages —
 * an anonymous shopper's 401 here must resolve to a catchable `ApiError`,
 * never bounce them into the admin login screen.
 */
export async function getAccountWishlist(): Promise<WishlistEntry[]> {
  const { data } = await apiFetch<{ wishlist: WishlistEntry[] }>("/account/wishlist", undefined, {
    unauthorizedRedirectPath: null,
  });
  return data.wishlist;
}

export async function addAccountWishlistItem(input: AddWishlistItemInput): Promise<WishlistEntry[]> {
  const { data } = await apiFetch<{ wishlist: WishlistEntry[] }>(
    "/account/wishlist",
    { method: "POST", body: JSON.stringify(input) },
    { unauthorizedRedirectPath: null },
  );
  return data.wishlist;
}

export async function removeAccountWishlistItem(itemType: ItemType, itemId: string): Promise<WishlistEntry[]> {
  const { data } = await apiFetch<{ wishlist: WishlistEntry[] }>(
    `/account/wishlist/${itemType}/${itemId}`,
    { method: "DELETE" },
    { unauthorizedRedirectPath: null },
  );
  return data.wishlist;
}
