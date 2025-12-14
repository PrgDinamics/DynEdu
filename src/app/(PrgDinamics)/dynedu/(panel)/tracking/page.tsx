
import TrackingClient from "./TrackingClient";
import { getOrderTimeline, getTrackingOrders } from "./actions";
import { fetchPedidoDetalle } from "../pedidos/actions";


type TrackingPageProps = {
  searchParams: Promise<{
    [key: string]: string | string[] | undefined;
    pedidoId?: string | string[];
    realId?: string | string[];
  }>;
};

export default async function TrackingPage(props: TrackingPageProps) {
  const rawSearchParams = await props.searchParams;

  const getParam = (name: "pedidoId" | "realId") => {
    const raw = rawSearchParams[name];
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return raw[0];
    return undefined;
  };

  const pedidoIdParam = getParam("pedidoId");
  const realIdParam = getParam("realId");

  const selectedId = pedidoIdParam ? Number(pedidoIdParam) : null;
  const realId = realIdParam ? Number(realIdParam) : null;

  const [orders, timeline, pedidoRealDetalle] = await Promise.all([
    getTrackingOrders(),
    selectedId ? getOrderTimeline(selectedId) : Promise.resolve([]),
    realId ? fetchPedidoDetalle(realId) : Promise.resolve(null),
  ]);

  const selectedOrder = selectedId
    ? orders.find((o) => o.id === selectedId)
    : undefined;

  return (
    <TrackingClient
      orders={orders}
      selectedOrder={selectedOrder}
      timeline={timeline}
      pedidoRealDetalle={pedidoRealDetalle}
    />
  );
}
