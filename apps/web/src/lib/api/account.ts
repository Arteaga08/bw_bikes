import type { AccountDTO, UpdateAccountProfileInput } from "@bw-bikes/shared";
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
