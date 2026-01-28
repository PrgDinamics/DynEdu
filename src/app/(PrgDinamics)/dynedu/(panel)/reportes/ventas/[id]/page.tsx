export const dynamic = "force-dynamic";

import VentaDetalleClient from "./VentaDetalleClient";
import { fetchSaleDetail } from "../actions";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params; // ✅ unwrap params promise

  const detail = await fetchSaleDetail(id);
  return <VentaDetalleClient detail={detail} />;
}
