export const dynamic = "force-dynamic";

import VentasClient from "./VentasClient";
import { fetchSalesOverview } from "./actions";


export default async function Page() {
  const rows = await fetchSalesOverview();
  return <VentasClient initialRows={rows} />;
}
