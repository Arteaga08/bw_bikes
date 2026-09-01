import type {
  AccountDTO,
  BillingInfo,
  CustomerFit,
  SaveAddressInput,
  SavedAddress,
  UpdateAccountProfileInput,
  UpdateFitInput,
} from "@bw-bikes/shared";
import { apiFetch } from "./client";

export async function getAccount(): Promise<AccountDTO> {
  const { data } = await apiFetch<{ account: AccountDTO }>("/account");
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
