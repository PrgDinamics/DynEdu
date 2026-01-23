import NoAccess from "../../components/error/NoAccess";
import { fetchRolesAndUsers } from "./actions";
import UsuarioRolesClient from "./UsuarioRolesClient";

export default async function UsuarioRolesPage() {
const { roles, users } = await fetchRolesAndUsers();

  // Si no está autorizado, tus actions retornan [] (NO throw)
  if (!roles.length) return <NoAccess />;

  return <UsuarioRolesClient initialRoles={roles} initialUsers={users} />;
}
