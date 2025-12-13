import { redirect } from "next/navigation";
import { Box, Typography } from "@mui/material";
import { getPortalColegio } from "../actions"
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
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        p: { xs: 2, md: 3 },
      }}
    >
      <Typography variant="h6" fontWeight={600} mb={2}>
        Consignación de libros
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Colegio:{" "}
        <strong>
          {colegio.nombre || colegio.razon_social || colegio.ruc}
        </strong>
      </Typography>

      <ConsignacionClient colegioId={colegio.id} productos={productos} />
    </Box>
  );
}
