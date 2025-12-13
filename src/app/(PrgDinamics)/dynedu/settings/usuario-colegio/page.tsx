export const dynamic = "force-dynamic";


import { fetchColegios } from "./actions";
import UsuarioColegio from "./UsuarioColegio";

export default async function UsuarioColegioPage() {
  const colegios = await fetchColegios();
  return <UsuarioColegio initialColegios={colegios} />;
}
