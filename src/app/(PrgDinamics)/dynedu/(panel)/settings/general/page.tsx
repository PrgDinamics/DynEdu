export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";


import { getGeneralSettings, getActiveCampaign, listCampaigns } from "./actions";
import GeneralSettingsClient from "./GeneralSettingsClient";

export default async function GeneralSettingsPage() {
  const settings = await getGeneralSettings();
  const [campaigns, activeCampaign] = await Promise.all([
    listCampaigns(),
    getActiveCampaign(),
  ]);

  return (
    <GeneralSettingsClient
      initialSettings={settings}
      initialCampaigns={campaigns}
      initialActiveCampaign={activeCampaign}
    />
  );
}
