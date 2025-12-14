import { fetchRoles, fetchUsers } from "./actions";
import UsuarioRolesClient from "./UsuarioRolesClient";

export default async function UsuarioRolesPage() {
  const [roles, users] = await Promise.all([fetchRoles(), fetchUsers()]);

  return <UsuarioRolesClient initialRoles={roles} initialUsers={users} />;
}
