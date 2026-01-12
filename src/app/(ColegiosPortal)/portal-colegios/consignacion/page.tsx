import "./consignacion.css";
import { redirect } from "next/navigation";
import { Typography } from "@mui/material";
import { getPortalColegio } from "../actions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ConsignacionClient from "./ConsignacionClient";
import PortalLogoutButton from "../components/PortalLogoutButton";

type ProductoBasic = {
  id: number;
  internal_id: string;
  descripcion: string;
};

type ProductoMini = {
  id: number;
  internal_id: string;
  descripcion: string;
};

type PortalConsItem = {
  id: number;
  consignacion_id: number;
  producto_id: number;
  cantidad: number;
  cantidad_aprobada: number | null;
  product: ProductoMini | null;
};

export type PortalConsignacionRow = {
  id: number;
  codigo: string;
  estado: "PENDIENTE" | "ABIERTA" | "CERRADA" | "ANULADA";
  fecha_salida: string;
  fecha_entrega: string | null;
  observaciones: string | null;
  items: PortalConsItem[];
};

async function fetchProductosBasic(): Promise<ProductoBasic[]> {
  const { data, error } = await supabaseAdmin
    .from("productos")
    .select("id,internal_id,descripcion")
    .order("internal_id", { ascending: true });

  if (error) {
    console.error("[fetchProductosBasic] error:", error);
    return [];
  }

  return (data || []) as ProductoBasic[];
}

async function fetchConsignacionesForColegio(colegioId: number): Promise<PortalConsignacionRow[]> {
  const { data: consRows, error: consError } = await supabaseAdmin
    .from("consignaciones")
    .select("id,codigo,estado,fecha_salida,fecha_entrega,observaciones")
    .eq("colegio_id", colegioId)
    .order("id", { ascending: false })
    .limit(80);

  if (consError) {
    console.error("[fetchConsignacionesForColegio] consignaciones error:", consError);
    return [];
  }

  const consignaciones = (consRows || []) as any[];
  if (!consignaciones.length) return [];

  const consignacionIds = consignaciones.map((c) => c.id);

  const { data: itemRows, error: itemsError } = await supabaseAdmin
    .from("consignacion_items")
    .select("id,consignacion_id,producto_id,cantidad,cantidad_aprobada")
    .in("consignacion_id", consignacionIds);

  if (itemsError) {
    console.error("[fetchConsignacionesForColegio] items error:", itemsError);
    return consignaciones.map((c) => ({ ...c, items: [] })) as any;
  }

  const items = (itemRows || []) as any[];
  const productIds = Array.from(new Set(items.map((i) => i.producto_id).filter(Boolean)));

  const { data: prodRows, error: prodError } = await supabaseAdmin
    .from("productos")
    .select("id,internal_id,descripcion")
    .in("id", productIds);

  if (prodError) {
    console.error("[fetchConsignacionesForColegio] products error:", prodError);
  }

  const prodMap = new Map<number, ProductoMini>();
  (prodRows || []).forEach((p: any) => {
    prodMap.set(p.id, {
      id: p.id,
      internal_id: p.internal_id,
      descripcion: p.descripcion,
    });
  });

  const itemsByCons = new Map<number, PortalConsItem[]>();
  for (const it of items) {
    const row: PortalConsItem = {
      id: it.id,
      consignacion_id: it.consignacion_id,
      producto_id: it.producto_id,
      cantidad: Number(it.cantidad ?? 0),
      cantidad_aprobada:
        it.cantidad_aprobada === null || it.cantidad_aprobada === undefined
          ? null
          : Number(it.cantidad_aprobada),
      product: prodMap.get(it.producto_id) ?? null,
    };

    const arr = itemsByCons.get(row.consignacion_id) ?? [];
    arr.push(row);
    itemsByCons.set(row.consignacion_id, arr);
  }

  return consignaciones.map((c: any) => ({
    id: c.id,
    codigo: c.codigo,
    estado: c.estado,
    fecha_salida: c.fecha_salida,
    fecha_entrega: c.fecha_entrega ?? null,
    observaciones: c.observaciones ?? null,
    items: itemsByCons.get(c.id) ?? [],
  })) as PortalConsignacionRow[];
}

export default async function Page() {
  const colegio = await getPortalColegio();
  if (!colegio) redirect("/portal-colegios");

  const [productos, consignaciones] = await Promise.all([
    fetchProductosBasic(),
    fetchConsignacionesForColegio(colegio.id),
  ]);

  return (
    <div className="portalConsign">
      <div className="portalConsign__inner">
        <header className="portalConsign__header">
          <div className="portalConsign__left">
            <div className="portalConsign__pill">PORTAL COLEGIOS</div>

            <h1 className="portalConsign__title">Consignación de libros</h1>

            <Typography className="portalConsign__school">
              Colegio: <b>{colegio.nombre || colegio.razon_social || colegio.ruc}</b>
            </Typography>
          </div>

          <div className="portalConsign__right">
            <PortalLogoutButton />
          </div>
        </header>

        <ConsignacionClient
          colegioId={colegio.id}
          productos={productos}
          initialConsignaciones={consignaciones}
        />
      </div>
    </div>
  );
}
