import React from "react";

import { Box, Typography } from "@mui/material";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ActividadClient from "./ActividadClient";

type ProveedorRow = {
  id: number;
  razon_social: string;
  ruc: string | null;
  contacto_nombre: string | null;
};

type ProductoRow = {
  id: number;
  internal_id: string;
  descripcion: string;
  editorial: string | null;
};

type PedidoRow = {
  id: number;
  codigo: string;
  proveedor_nombre: string;
  fecha_registro: string | null;
  estado: string;
  unidades_solicitadas: number | null;
};

type TrackingRow = {
  id: number;
  pedido_id: number | null;
  tipo_evento: string | null;
  detalle: string | null;
  created_at: string | null;
  pedido: {
    codigo: string;
    proveedor_nombre: string;
    estado: string;
  } | null;
};

function normalizePedidoEmbed(value: any) {
  if (!value) return null;
  // Sometimes PostgREST returns embedded relationship as an array
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

async function getActividadData() {
  // Proveedores
  const { data: proveedoresData, error: proveedoresError } = await supabaseAdmin
    .from("proveedores")
    .select("id, razon_social, ruc, contacto_nombre")
    .order("razon_social", { ascending: true });

  if (proveedoresError) {
    console.error("❌ Error cargando proveedores para actividad:", proveedoresError);
  }

  // Productos
  const { data: productosData, error: productosError } = await supabaseAdmin
    .from("productos")
    .select("id, internal_id, descripcion, editorial")
    .order("id", { ascending: true });

  if (productosError) {
    console.error("❌ Error cargando productos para actividad:", productosError);
  }

  // Pedidos
  const { data: pedidosData, error: pedidosError } = await supabaseAdmin
    .from("pedidos")
    .select("id, codigo, proveedor_nombre, fecha_registro, estado, unidades_solicitadas")
    .order("fecha_registro", { ascending: false });

  if (pedidosError) {
    console.error("❌ Error cargando pedidos para actividad:", pedidosError);
  }

  // Tracking (últimos eventos)
  const { data: trackingData, error: trackingError } = await supabaseAdmin
    .from("pedido_tracking")
    .select(
      // ✅ Force the FK so PostgREST returns a single object (not an array)
      "id, pedido_id, tipo_evento, detalle, created_at, pedido:pedidos!pedido_tracking_pedido_id_fkey(codigo, proveedor_nombre, estado)"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (trackingError) {
    console.warn("⚠️ No se pudo cargar pedido_tracking (se mostrará vacío):", trackingError);
  }

  // ✅ Normalize embedded pedido to always be an object|null
  const normalizedTracking = (trackingData ?? []).map((t: any) => ({
    ...t,
    pedido: normalizePedidoEmbed(t.pedido),
  })) as TrackingRow[];

  return {
    proveedores: (proveedoresData ?? []) as ProveedorRow[],
    productos: (productosData ?? []) as ProductoRow[],
    pedidos: (pedidosData ?? []) as PedidoRow[],
    tracking: normalizedTracking,
  };
}

const ActividadPage = async () => {
  const { proveedores, productos, pedidos, tracking } = await getActividadData();

  return (
    <Box>
      <Typography variant="h4" fontWeight={600} mb={0.5}>
        Actividad
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Últimos pedidos y movimientos recientes.
      </Typography>

      <ActividadClient
        proveedores={proveedores}
        productos={productos}
        pedidos={pedidos}
        tracking={tracking}
      />
    </Box>
  );
};

export default ActividadPage;
