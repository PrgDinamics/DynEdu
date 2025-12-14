
import {
  ensureDefaultPriceList,
  fetchProductosConPrecios,
  fetchPacksConPrecios,
} from "./actions";
import PricesClient from "./PricesClient";

export default async function PriceListPage() {
  const lista = await ensureDefaultPriceList();

  const productosConPrecios = await fetchProductosConPrecios(lista.id);
  const packsConPrecios = await fetchPacksConPrecios(lista.id);

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
}
