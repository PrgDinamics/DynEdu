export const dynamic = "force-dynamic";

import MovimientosClient from "./MovimientosClient";
import { fetchInventoryMovements } from "./actions";

export default async function Page() {
  const movements = await fetchInventoryMovements();
  return <MovimientosClient initialRows={movements} />;
}
