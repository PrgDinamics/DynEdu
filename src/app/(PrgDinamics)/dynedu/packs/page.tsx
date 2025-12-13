export const dynamic = "force-dynamic";


import { obtenerPacks, obtenerProductosParaPacks } from "./actions";
import PackClient from "./PackClient";

export default async function PacksPage() {
  const packs = await obtenerPacks();
  const productos = await obtenerProductosParaPacks();

  return (
    <PackClient
      initialPacks={packs}
      productos={productos}
    />
  );
}
