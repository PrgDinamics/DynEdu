export const dynamic = "force-dynamic";
export const revalidate = 0;

import NoAccess from "../components/error/NoAccess";
import { getDyneduMeWithPermissions, hasAnyPermission } from "@/lib/dynedu/guard";

import {
  ensureDefaultPriceList,
  fetchProductosConPrecios,
  fetchPacksConPrecios,
} from "./actions";
import PricesClient from "./PricesClient";

export default async function PriceListPage() {
  const me = await getDyneduMeWithPermissions();

  // Not logged / no profile / inactive
  if (!me) {
    return <NoAccess />;
  }

  // Tipo Productos: NO bloqueamos toda la ruta por permisos.
  // Solo decidimos si podemos traer data o si mostramos "sin acceso" dentro del client.
  const canView = hasAnyPermission(me, [
    "canViewPriceCatalog",
    "canManagePriceCatalog",
    "canManagePricecatalog", // legacy typo
  ]);

  // Si no puede ver, igual renderiza el client (o NoAccess si prefieres),
  // pero sin data para no reventar por actions/RLS.
  if (!canView) {
    return (
      <PricesClient
        priceListId={0}
        listaInfo={null as any}
        initialProductos={[]}
        initialPacks={[]}
        // si tu PricesClient soporta esto, mejor:
        // me={me}
        // canManage={false}
        // canView={false}
      />
    );
  }

  // Si puede ver, intentamos cargar. Si algo falla, igual renderiza con vacío.
  try {
    const lista = await ensureDefaultPriceList();
    const [productosConPrecios, packsConPrecios] = await Promise.all([
      fetchProductosConPrecios(lista.id),
      fetchPacksConPrecios(lista.id),
    ]);

    return (
      <PricesClient
        priceListId={lista.id}
        listaInfo={{
          internal_id: lista.internal_id,
          nombre: lista.nombre,
          descripcion: lista.descripcion,
          moneda: lista.moneda,
        }}
        initialProductos={productosConPrecios}
        initialPacks={packsConPrecios}
      />
    );
  } catch (e) {
    // fallback seguro (tipo productos: no rompe toda la vista)
    return (
      <PricesClient
        priceListId={0}
        listaInfo={null as any}
        initialProductos={[]}
        initialPacks={[]}
      />
    );
  }
}
