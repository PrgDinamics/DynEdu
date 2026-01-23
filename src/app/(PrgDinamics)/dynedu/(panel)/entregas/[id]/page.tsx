import EntregaDetailClient from "./EntregaDetailClient";
import { fetchDeliveryOrderDetail } from "./actions";

export default async function Page({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const { id } = await params;

  // Guard: avoid querying with invalid ids (undefined/null)
  if (!id || id === "undefined" || id === "null") {
    return <EntregaDetailClient order={null} />;
  }

  const order = await fetchDeliveryOrderDetail(id);
  return <EntregaDetailClient order={order} />;
}
