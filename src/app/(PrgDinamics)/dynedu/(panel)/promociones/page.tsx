// src/app/(PrgDinamics)/dynedu/(panel)/promociones/page.tsx

export const dynamic = "force-dynamic";
export const revalidate = 0;

import PromocionesClient from "./PromocionesClient";
import { fetchPromotionsPageData } from "./actions";
import { createSupabaseServerClient } from "@/lib/supabaseClient";

export default async function PromocionesPage() {
  const supabase = await createSupabaseServerClient();

  // Basic auth gate: if user exists => can manage
  // If you already have role logic (admin/manager), we can swap this.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const canManage = Boolean(user);

  const { promotions, products, colegios } = await fetchPromotionsPageData();

  return (
    <PromocionesClient
      initialPromotions={promotions}
      products={products}
      colegios={colegios}
      canManage={canManage}
    />
  );
}
