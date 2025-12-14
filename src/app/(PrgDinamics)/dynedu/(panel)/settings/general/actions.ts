"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  GeneralSettings,
  GeneralSettingsCampaignStatus,
  GeneralSettingsOrderEditStatus,
} from "@/modules/settings/types";

const GENERAL_SETTINGS_KEY = "general";

// Defaults por si aún no hay nada en la BD
const defaultGeneralSettings: GeneralSettings = {
  company: {
    name: "PRG Dinamics",
    tradeName: "PRG Dinamics",
    ruc: "",
    address: "",
    phone: "",
    email: "",
  },
  branding: {
    primaryColor: "#542DA0",
    secondaryColor: "#8887E8",
    accentColor: "#3333FF",
    logoUrl: "/images/logos/dark-logo.svg",
    themeMode: "light",
  },
  campaign: {
    year: new Date().getFullYear(),
    startDate: null,
    endDate: null,
    status: "planning",
  },
  rules: {
    ordersEditableUntilStatus: "in_progress",
    defaultDeliveryDays: 7,
    autoUpdateStockOnComplete: true,
  },
  notifications: {
    internalEmail: "",
    notifyOnOrderCompleted: true,
    notifyOnStockLow: false,
    notifyOnConsignCreated: true,
    notifySchoolOnConsignApproved: false,
  },
};

type AppSettingsRow = {
  id: number;
  setting_key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
};

const mergeSettings = (value: any): GeneralSettings => {
  const v = value ?? {};

  return {
    company: {
      ...defaultGeneralSettings.company,
      ...(v.company ?? {}),
    },
    branding: {
      ...defaultGeneralSettings.branding,
      ...(v.branding ?? {}),
    },
    campaign: {
      ...defaultGeneralSettings.campaign,
      ...(v.campaign ?? {}),
    },
    rules: {
      ...defaultGeneralSettings.rules,
      ...(v.rules ?? {}),
    },
    notifications: {
      ...defaultGeneralSettings.notifications,
      ...(v.notifications ?? {}),
    },
  };
};

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const { data, error } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("setting_key", GENERAL_SETTINGS_KEY)
    .maybeSingle<AppSettingsRow>();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching general settings:", error);
    throw error;
  }

  if (!data || !data.value) {
    return defaultGeneralSettings;
  }

  return mergeSettings(data.value);
}

export async function saveGeneralSettings(
  settings: GeneralSettings,
  updatedBy?: string,
): Promise<void> {
  const payload = {
    setting_key: GENERAL_SETTINGS_KEY,
    value: settings,
    updated_by: updatedBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert(payload, {
      onConflict: "setting_key",
    });

  if (error) {
    console.error("Error saving general settings:", error);
    throw error;
  }
}
