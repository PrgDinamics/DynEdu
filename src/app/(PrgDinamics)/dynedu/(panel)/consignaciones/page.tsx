import ConsignacionesClient from "./ConsignacionesClient";
import { fetchConsignacionesWithItems } from "./actions";

export default async function Page() {
  const consignaciones = await fetchConsignacionesWithItems();
  return <ConsignacionesClient consignaciones={consignaciones} />;
}
