"use client";

import type { AdminSettings } from "@bw-bikes/shared";
import { useState } from "react";
import {
  ApplicationsSection,
  InventorySection,
  JobsSection,
  OrdersSection,
  PricingSection,
  ShippingSection,
} from "./SettingsSections";

export interface SettingsViewProps {
  initial: AdminSettings;
}

/**
 * Six independent forms, in `SETTINGS_SECTIONS` order — `page.tsx` resolves
 * one `GET /admin/settings` server-side; every section's own save then hands
 * back the *whole* refreshed document (every `PUT` returns it), which is
 * what keeps all six in sync without a shared refetch.
 */
export function SettingsView({ initial }: SettingsViewProps) {
  const [settings, setSettings] = useState(initial);

  return (
    <div className="flex flex-col gap-lg p-md sm:p-lg">
      <InventorySection settings={settings} onSaved={setSettings} />
      <OrdersSection settings={settings} onSaved={setSettings} />
      <PricingSection settings={settings} onSaved={setSettings} />
      <ShippingSection settings={settings} onSaved={setSettings} />
      <ApplicationsSection settings={settings} onSaved={setSettings} />
      <JobsSection settings={settings} onSaved={setSettings} />
    </div>
  );
}
