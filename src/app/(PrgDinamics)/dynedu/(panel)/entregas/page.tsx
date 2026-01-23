import EntregasClient from "./EntregasClient";
import { fetchDeliveryOrders } from "./actions";

export default async function Page() {
  const orders = await fetchDeliveryOrders();
  return <EntregasClient initialOrders={orders} />;
}
