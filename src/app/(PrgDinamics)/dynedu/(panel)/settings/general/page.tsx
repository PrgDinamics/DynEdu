export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";


import { getGeneralSettings } from "./actions";
import GeneralSettingsClient from "./GeneralSettingsClient";

export default async function GeneralSettingsPage() {
  const settings = await getGeneralSettings();

  return <GeneralSettingsClient initialSettings={settings} />;
}
