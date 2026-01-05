// src/app/(PrgDinamics)/dynedu/productos/page.tsx


import { fetchProductos } from "./actions";
import ProductsClient from "./ProductsClient";

export default async function ProductosPage() {
  const productos = await fetchProductos();

  return <ProductsClient initialProductos={productos} />;
}
