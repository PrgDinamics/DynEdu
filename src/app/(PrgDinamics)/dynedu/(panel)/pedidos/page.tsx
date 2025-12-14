// src/app/(PrgDinamics)/colegio/pedidos/page.tsx

import OrdersClient from "./OrdersClient";
import {
  fetchPedidos,
  fetchProveedores,
  fetchProductos,
} from "./actions";

const PedidosPage = async () => {
  // Cargamos todo desde Supabase en el servidor
  const [pedidos, proveedores, productos] = await Promise.all([
    fetchPedidos(),
    fetchProveedores(),
    fetchProductos(),
  ]);

  return (
    <OrdersClient
      initialPedidos={pedidos}
      proveedores={proveedores}
      productos={productos}
    />
  );
};

export default PedidosPage;
