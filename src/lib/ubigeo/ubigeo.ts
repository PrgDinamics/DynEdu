// src/lib/ubigeo.ts
type UbigeoNode = {
  id: string;
  name: string;
  level: string;
  provinces?: () => UbigeoNode[];
  districts?: () => UbigeoNode[];
};

const Ubigeoperu = require("peru-ubigeo");
const ubigeo = new Ubigeoperu();

function firstNode(x: any): UbigeoNode | null {
  if (!x) return null;
  if (Array.isArray(x)) return (x[0] as UbigeoNode) ?? null;
  return x as UbigeoNode;
}

// Departamento (Región)
export function listDepartments(): { id: string; name: string }[] {
  const regions = ubigeo.getRegions() as UbigeoNode[];
  return (regions ?? []).map((r) => ({ id: r.id, name: r.name }));
}

// Provincias por Departamento
export function listProvincesByDepartment(departmentIdOrName: string): { id: string; name: string }[] {
  const region = firstNode(ubigeo.getRegions(departmentIdOrName));
  const provinces = region?.provinces?.() ?? [];
  return provinces.map((p) => ({ id: p.id, name: p.name }));
}

// Distritos por Provincia (la provincia se ubica por id o nombre)
export function listDistrictsByProvince(provinceIdOrName: string): { id: string; name: string }[] {
  const province = firstNode(ubigeo.getProvinces(provinceIdOrName));
  const districts = province?.districts?.() ?? [];
  return districts.map((d) => ({ id: d.id, name: d.name }));
}
