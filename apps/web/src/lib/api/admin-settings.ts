import type { AdminSettings, SettingsSectionName, SettingsSections } from "@bw-bikes/shared";
import { apiFetch } from "./client";

export async function getAdminSettings(): Promise<AdminSettings> {
  const { data } = await apiFetch<{ settings: AdminSettings }>("/admin/settings");
  return data.settings;
}

/**
 * One `PUT` per section — the URL picks the section, never a body field, so
 * "which section can this write touch" stays answerable by reading the call
 * site alone. Each `PUT` is a full replace of that section (every field
 * required, mirroring the backend's per-section Joi schema), and always
 * returns the **whole** document, not just the section that changed.
 */
export async function updateAdminSettingsSection<K extends SettingsSectionName>(
  section: K,
  values: SettingsSections[K],
): Promise<AdminSettings> {
  const { data } = await apiFetch<{ settings: AdminSettings }>(`/admin/settings/${section}`, {
    method: "PUT",
    body: JSON.stringify(values),
  });
  return data.settings;
}
