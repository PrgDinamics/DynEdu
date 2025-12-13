export const dynamic = "force-dynamic";

import { getProveedores } from "./actions";
import SuppliersClient from "./SuppliersClient";

export default async function ProveedoresPage() {
  const proveedores = await getProveedores();

  return <SuppliersClient initialRows={proveedores} />;
}
