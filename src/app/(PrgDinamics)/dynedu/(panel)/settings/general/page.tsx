

import { getGeneralSettings } from "./actions";
import GeneralSettingsClient from "./GeneralSettingsClient";

export default async function GeneralSettingsPage() {
  const settings = await getGeneralSettings();

  return <GeneralSettingsClient initialSettings={settings} />;
}
