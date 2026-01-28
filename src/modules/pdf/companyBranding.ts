// src/modules/pdf/companyBranding.ts
import fs from "node:fs/promises";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { GeneralSettings } from "@/modules/settings/types";

const GENERAL_SETTINGS_KEY = "general";

// ✅ Partial: no obliga a incluir rules/notifications/etc del type real
const defaultGeneralSettings: Partial<GeneralSettings> = {
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
    logoUrl: "/images/logos/de-logo-color.png",
    themeMode: "light",
  },
  campaign: {
    year: new Date().getFullYear(),
    startDate: null,
    endDate: null,
    status: "planning",
  },
};

function safeJsonParse(input: unknown): any | null {
  if (!input) return null;
  if (typeof input === "object") return input;
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
  return null;
}

export async function fetchGeneralSettings(): Promise<GeneralSettings> {
  // Modern shape: setting_key/value(jsonb)
  const q1 = await supabaseAdmin
    .from("app_settings")
    .select("value, setting_key")
    .eq("setting_key", GENERAL_SETTINGS_KEY)
    .maybeSingle();

  const json1 = safeJsonParse(q1.data?.value);

  if (json1) {
    const merged = {
      ...defaultGeneralSettings,
      ...json1,
      company: { ...(defaultGeneralSettings as any).company, ...(json1.company ?? {}) },
      branding: { ...(defaultGeneralSettings as any).branding, ...(json1.branding ?? {}) },
      campaign: { ...(defaultGeneralSettings as any).campaign, ...(json1.campaign ?? {}) },
    };
    return merged as GeneralSettings;
  }

  // Legacy shape: key/value(text)
  const q2 = await supabaseAdmin
    .from("app_settings")
    .select("value, key")
    .eq("key", GENERAL_SETTINGS_KEY)
    .maybeSingle();

  const json2 = safeJsonParse(q2.data?.value);

  if (json2) {
    const merged = {
      ...defaultGeneralSettings,
      ...json2,
      company: { ...(defaultGeneralSettings as any).company, ...(json2.company ?? {}) },
      branding: { ...(defaultGeneralSettings as any).branding, ...(json2.branding ?? {}) },
      campaign: { ...(defaultGeneralSettings as any).campaign, ...(json2.campaign ?? {}) },
    };
    return merged as GeneralSettings;
  }

  return defaultGeneralSettings as GeneralSettings;
}

export async function fetchCompanyBrandingForPdf() {
  const settings = await fetchGeneralSettings();

  // ✅ Logo fijo (como pediste)
  const logoAbsPath = path.join(
    process.cwd(),
    "public",
    "images",
    "logos",
    "de-logo-color.png"
  );

  let logoDataUrl: string | null = null;

  try {
    const buf = await fs.readFile(logoAbsPath);
    logoDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    logoDataUrl = null;
  }

  return {
    company: settings.company,
    logoDataUrl,
  };
}
