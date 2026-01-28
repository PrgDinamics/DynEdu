"use client";

import { useMemo, useState } from "react";
import "./mis-compras.css";
import { Mail, Package, ChevronDown, ChevronUp, ShoppingBag } from "lucide-react";

type OrderRow = {
  id: string;
  created_at: string;
  total: number;
  currency: string;
  status: string;
  fulfillment_status: "REGISTERED" | "PACKING" | "DELIVERY" | "DELIVERED";
  delivery_date: string | null;
  fulfillment_updated_at: string;
};

type PaymentRow = {
  order_id: string;
  status: string;
  payment_id: string | null;
};

type FulfillmentEventRow = {
  order_id: string;
  status: "REGISTERED" | "PACKING" | "DELIVERY" | "DELIVERED";
  note: string | null;
  created_at: string;
};

type OrderItemRow = {
  order_id: string;
  producto_id: number | null; // null = pack header
  title_snapshot: string;
  codigo_venta_snapshot: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
};

const stepOrder: OrderRow["fulfillment_status"][] = ["REGISTERED", "PACKING", "DELIVERY", "DELIVERED"];

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fulfillLabel(s: OrderRow["fulfillment_status"]) {
  if (s === "REGISTERED") return "Pedido registrado";
  if (s === "PACKING") return "Empacando";
  if (s === "DELIVERY") return "En reparto";
  return "Entregado";
}

function mpStatusLabel(s: string) {
  const x = (s || "").toUpperCase();
  if (x === "APPROVED") return "Pago aprobado";
  if (x === "PENDING") return "Pago pendiente";
  if (x === "REJECTED") return "Pago rechazado";
  if (x === "CANCELLED") return "Pago cancelado";
  if (x === "REFUNDED") return "Pago reembolsado";
  if (x === "CREATED") return "Pago creado";
  return `Pago: ${s}`;
}

function formatMoney(amount: number, currency: string) {
  const cur = (currency || "PEN").toUpperCase();
  try {
    return new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(Number(amount ?? 0));
  } catch {
    return `${Number(amount ?? 0).toFixed(2)} ${cur}`;
  }
}

export default function MisComprasClient({
  userEmail,
  initialOrders,
  initialPayments,
  initialEvents,
  initialItems,
  initialError,
}: {
  userEmail: string;
  initialOrders: OrderRow[];
  initialPayments: PaymentRow[];
  initialEvents: FulfillmentEventRow[];
  initialItems: OrderItemRow[];
  initialError: string | null;
}) {
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);

  const paymentsByOrder = useMemo(() => {
    const map: Record<string, PaymentRow> = {};
    for (const p of initialPayments) map[p.order_id] = p;
    return map;
  }, [initialPayments]);

  const eventsByOrder = useMemo(() => {
    const map: Record<string, FulfillmentEventRow[]> = {};
    for (const ev of initialEvents) {
      if (!map[ev.order_id]) map[ev.order_id] = [];
      map[ev.order_id].push(ev);
    }
    return map;
  }, [initialEvents]);

  const itemsByOrder = useMemo(() => {
    const map: Record<string, OrderItemRow[]> = {};
    for (const it of initialItems) {
      if (!map[it.order_id]) map[it.order_id] = [];
      map[it.order_id].push(it);
    }
    return map;
  }, [initialItems]);

  return (
    <div className="mcPage">
      <div className="mcWrap">
        <div className="mcHeader">
          <div>
            <h1 className="mcTitle">Mis compras</h1>
            <div className="mcSub">
              <Mail size={14} />
              <span>{userEmail || "—"}</span>
            </div>
          </div>

          <div className="mcCount">
            <Package size={16} />
            <span>{initialOrders.length} pedido(s)</span>
          </div>
        </div>

        {initialError && <div className="mcMsg mcErr">Error: {initialError}</div>}

        {!initialError && initialOrders.length === 0 && (
          <div className="mcCard">
            <div className="mcEmpty">Aún no tienes compras registradas.</div>
          </div>
        )}

        <div className="mcList">
          {initialOrders.map((o) => {
            const pay = paymentsByOrder[o.id];
            const events = eventsByOrder[o.id] ?? [];
            const rawItems = itemsByOrder[o.id] ?? [];
            const stepIndex = Math.max(0, stepOrder.indexOf(o.fulfillment_status));
            const isOpen = openOrderId === o.id;

            // ✅ PACK RULE:
            const hasPackHeader = rawItems.some((it) => it.producto_id == null);

            const items = rawItems.filter((it) => {
              const isPackHeader = it.producto_id == null;
              const looksLikePackComponent = String(it.title_snapshot || "").includes("(Pack)");
              const isZeroLine = Number(it.line_total ?? 0) === 0;

              if (!hasPackHeader) return true;
              if (isPackHeader) return true;
              if (looksLikePackComponent || isZeroLine) return false;
              return true;
            });

            const itemsSubtotal = items.reduce((acc, it) => acc + Number(it.line_total ?? 0), 0);

            return (
              <div key={o.id} className="mcCard">
                <div className="mcTopRow">
                  <div className="mcLeft">
                    <div className="mcOrderId">Orden: {o.id.slice(0, 8).toUpperCase()}</div>
                    <div className="mcMeta">
                      <span>{formatDate(o.created_at)}</span>
                      <span>•</span>
                      <span>Total: {formatMoney(Number(o.total ?? 0), o.currency)}</span>
                    </div>
                  </div>

                  <div className="mcRight">
                    <div className="mcPill">{pay ? mpStatusLabel(pay.status) : "Pago: —"}</div>
                    <button type="button" className="mcBtn" onClick={() => setOpenOrderId(isOpen ? null : o.id)}>
                      {isOpen ? (
                        <>
                          Cerrar <ChevronUp size={16} />
                        </>
                      ) : (
                        <>
                          Ver <ChevronDown size={16} />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mcProgress">
                  {stepOrder.map((s, idx) => {
                    const active = idx <= stepIndex;
                    return (
                      <div key={s} className={`mcStep ${active ? "isActive" : ""}`}>
                        <div className="mcDot" />
                        <div className="mcLabel">{fulfillLabel(s)}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mcDelivery">
                  Entrega: <b>{o.delivery_date ? formatDate(o.delivery_date) : "por confirmar"}</b>
                </div>

                {isOpen && (
                  <div className="mcDetails">
                    <div className="mcDetailTitle mcDetailTitleRow">
                      <span className="mcDetailTitleLeft">
                        <ShoppingBag size={16} />
                        Detalle de compra
                      </span>
                      <span className="mcDetailTitleRight">
                        {items.length ? formatMoney(itemsSubtotal, o.currency) : "—"}
                      </span>
                    </div>

                    {items.length === 0 ? (
                      <div className="mcDetailEmpty">No se encontraron items para esta orden.</div>
                    ) : (
                      <div className="mcItems">
                        {items.map((it, idx) => {
                          const isPackHeader = it.producto_id == null;

                          return (
                            <div key={idx} className="mcItemRow">
                              <div className="mcItemMain">
                                <div className="mcItemTitle">
                                  {it.title_snapshot}
                                  {isPackHeader && <span style={{ marginLeft: 8, opacity: 0.8 }}>(Pack)</span>}
                                </div>
                                <div className="mcItemSub">
                                  {it.codigo_venta_snapshot ? (
                                    <span>Código: {it.codigo_venta_snapshot}</span>
                                  ) : (
                                    <span />
                                  )}
                                  <span className="mcItemQty">x{Number(it.quantity ?? 0)}</span>
                                </div>
                              </div>

                              <div className="mcItemPrices">
                                <div className="mcItemUnit">{formatMoney(Number(it.unit_price ?? 0), o.currency)}</div>
                                <div className="mcItemTotal">{formatMoney(Number(it.line_total ?? 0), o.currency)}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="mcDetailTitle" style={{ marginTop: 14 }}>
                      Seguimiento
                    </div>

                    {events.length === 0 ? (
                      <div className="mcDetailEmpty">Aún no hay actualizaciones.</div>
                    ) : (
                      <div className="mcTimeline">
                        {events.map((ev, i) => (
                          <div key={i} className="mcEvent">
                            <div className="mcEventDot" />
                            <div className="mcEventBody">
                              <div className="mcEventTop">
                                <b>{fulfillLabel(ev.status)}</b>
                                <span>{formatDate(ev.created_at)}</span>
                              </div>
                              {ev.note && <div className="mcEventNote">{ev.note}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {pay?.payment_id && (
                      <div className="mcPaymentRef">
                        Operación MP: <b>{pay.payment_id}</b>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
