// src/modules/settings/types.ts

export type GeneralSettingsCompany = {
  name: string;
  tradeName: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
};

export type GeneralSettingsBranding = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string;
  themeMode: "light" | "dark";
};

export type GeneralSettingsCampaignStatus = "planning" | "active" | "closed";

export type GeneralSettingsCampaign = {
  year: number;
  startDate: string | null; // ISO date (YYYY-MM-DD)
  endDate: string | null;
  status: GeneralSettingsCampaignStatus;
};

export type GeneralSettingsOrderEditStatus = "draft" | "in_progress" | "never";

export type GeneralSettingsRules = {
  ordersEditableUntilStatus: GeneralSettingsOrderEditStatus;
  defaultDeliveryDays: number;
  autoUpdateStockOnComplete: boolean;
};

export type GeneralSettingsNotifications = {
  internalEmail: string;
  notifyOnOrderCompleted: boolean;
  notifyOnStockLow: boolean;
  notifyOnConsignCreated: boolean;
  notifySchoolOnConsignApproved: boolean;
};

export type GeneralSettings = {
  company: GeneralSettingsCompany;
  branding: GeneralSettingsBranding;
  campaign: GeneralSettingsCampaign;
  rules: GeneralSettingsRules;
  notifications: GeneralSettingsNotifications;
};
