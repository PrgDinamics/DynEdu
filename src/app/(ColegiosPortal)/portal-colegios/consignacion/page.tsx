import "./consignacion.css";
import { redirect } from "next/navigation";
import { Typography } from "@mui/material";
import { getPortalColegio } from "../actions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ConsignacionClient from "./ConsignacionClient";

type ProductoBasic = {
  id: number;
  internal_id: string;
  descripcion: string;
};

async function fetchProductosBasic(): Promise<ProductoBasic[]> {
  const { data, error } = await supabaseAdmin
    .from("productos")
    .select("id, internal_id, descripcion")
    .order("descripcion", { ascending: true });

  if (error) {
    console.error("[fetchProductosBasic] error:", error);
    return [];
  }

  return (data ?? []) as ProductoBasic[];
}

export default async function ColegioConsignacionPage() {
  const colegio = await getPortalColegio();

  if (!colegio) {
    redirect("/portal-colegios");
  }

  const productos = await fetchProductosBasic();

  return (
    <div className="portalConsign">
      <div className="portalConsign__inner">
        <header className="portalConsign__header">
          <div className="portalConsign__left">
            <div className="portalConsign__pill">PORTAL COLEGIOS</div>

            <h1 className="portalConsign__title">Consignación de libros</h1>

            <Typography className="portalConsign__school">
              Colegio:{" "}
              <b>{colegio.nombre || colegio.razon_social || colegio.ruc}</b>
            </Typography>
          </div>
        </header>

        <ConsignacionClient colegioId={colegio.id} productos={productos} />
      </div>
    </div>
  );
}
