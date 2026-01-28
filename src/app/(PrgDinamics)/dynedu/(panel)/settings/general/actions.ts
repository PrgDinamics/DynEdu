"use server";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {  GeneralSettings } from "@/modules/settings/types";

import { revalidatePath } from "next/cache";

export type CampaignStatus = "DRAFT" | "ACTIVE" | "CLOSED";

export type CampaignRow = {
  id: string;
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  status: CampaignStatus;
  timezone: string;
  created_at: string;
  updated_at: string;
};

export type ActiveCampaignViewRow = CampaignRow & {
  start_ts_utc: string;
  end_ts_utc_exclusive: string;
};

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

  revalidatePath("/dynedu/settings/general");
}

// -------------------------
// Campaigns (Academic Year)
// -------------------------

export async function listCampaigns(): Promise<CampaignRow[]> {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("id,name,start_date,end_date,status,timezone,created_at,updated_at")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("Error fetching campaigns:", error);
    throw error;
  }

  return (data ?? []) as CampaignRow[];
}

export async function getActiveCampaign(): Promise<ActiveCampaignViewRow | null> {
  const { data, error } = await supabaseAdmin
    .from("v_active_campaign")
    .select("*")
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching active campaign:", error);
    throw error;
  }

  return (data ?? null) as ActiveCampaignViewRow | null;
}

export async function createCampaign(input: {
  name: string;
  start_date: string;
  end_date: string;
  timezone?: string;
}): Promise<CampaignRow> {
  const payload = {
    name: input.name,
    start_date: input.start_date,
    end_date: input.end_date,
    status: "DRAFT" as const,
    timezone: input.timezone ?? "America/Lima",
  };

  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .insert(payload)
    .select("id,name,start_date,end_date,status,timezone,created_at,updated_at")
    .single();

  if (error) {
    console.error("Error creating campaign:", error);
    throw error;
  }

  revalidatePath("/dynedu/settings/general");
  revalidatePath("/dynedu/dashboard");

  return data as CampaignRow;
}

export async function activateCampaign(campaignId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("activate_campaign", {
    p_campaign_id: campaignId,
  });

  if (error) {
    console.error("Error activating campaign:", error);
    throw error;
  }

  revalidatePath("/dynedu/settings/general");
  revalidatePath("/dynedu/dashboard");
}

export async function closeCampaign(campaignId: string): Promise<void> {
  const { error } = await supabaseAdmin.rpc("close_campaign", {
    p_campaign_id: campaignId,
  });

  if (error) {
    console.error("Error closing campaign:", error);
    throw error;
  }

  revalidatePath("/dynedu/settings/general");
  revalidatePath("/dynedu/dashboard");
}
