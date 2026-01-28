// src/modules/colegio/types.ts

// ---------------------------------------------
// Tipos base compartidos
// ---------------------------------------------

export type BaseEntity = {
  id: number;
  created_at?: string;
  updated_at?: string;
};

// ---------------------------------------------
// PRODUCTOS
// ---------------------------------------------


export type Producto = BaseEntity & {
  /** Código humano: PRO0001, PRO0002, etc. */
  internal_id: string;
  codigo_venta: string | null;

  descripcion: string;

  editorial: string;
  autor?: string | null;
  anio_publicacion?: number | null;

  // Nuevos campos de la tabla
  isbn?: string | null;      // antes nro_serie
  edicion?: string | null;   // 1ra edición, etc.
  foto_url?: string | null;  // URL portada
  is_public?: boolean;
};

export type ProductoCreateInput = {
  // El código humano lo generas tú: PRO0001, PRO0002...
  internal_id: string;
  codigo_venta?: string | null;

  descripcion: string;

  editorial: string;
  autor?: string | null;
  anio_publicacion?: number | null;

  isbn?: string | null;
  edicion?: string | null;
  foto_url?: string | null;
  is_public?: boolean;
};

export type ProductoUpdateInput = Partial<
  Omit<Producto, 'id' | 'created_at' | 'updated_at' | 'internal_id'>
>;


// ---------------------------------------------
// PACKS
// ---------------------------------------------

export type PackItem = {
  id?: number;
  pack_id?: number;
  producto_id: number;
  cantidad: number;
  productos?: {
    id: number;
    internal_id: string;
    codigo_venta: string | null;
    descripcion: string;
    foto_url?: string | null;
    anio_publicacion?: number | null;
    editorial?: string | null;
  } | null;
};

export type Pack = BaseEntity & {
  internal_id: string | null;      // Código interno (puede ser PAC0001)
  codigo: string | null;           // legacy (si lo sigues usando)
  codigo_venta: string | null;     // Código venta como productos
  nombre: string;
  descripcion: string | null;
  is_public: boolean;
  foto_url?: string | null;
  items?: PackItem[];
};

export type PackCreateInput = {
  nombre: string;
  descripcion?: string | null;
  items: Array<{ producto_id: number; cantidad: number }>;
  foto_url?: string | null;
};

export type PackUpdateInput = Partial<
  Omit<Pack, "id" | "created_at" | "updated_at">
>;


// PROVEEDORES
// ---------------------------------------------

export type Proveedor = BaseEntity & {
  /** Código humano: PRV0001, PRV0002, etc. */
  internal_id: string;

  razon_social: string;
  nombre_comercial?: string | null;
  ruc: string;

  direccion?: string | null;
  referencia?: string | null;

  contacto_nombre: string;
  contacto_celular: string;
  contacto_correo?: string | null;

  total_pedidos?: number;
  total_unidades?: number;
};

export type ProveedorCreateInput = {
  internal_id: string;
  razon_social: string;
  nombre_comercial?: string | null;
  ruc: string;
  direccion?: string | null;
  referencia?: string | null;
  contacto_nombre: string;
  contacto_celular: string;
  contacto_correo?: string | null;
};

export type ProveedorUpdateInput = Partial<
  Omit<Proveedor, "id" | "created_at" | "updated_at" | "internal_id">
>;

// Contactos adicionales del proveedor
export type ProveedorContacto = BaseEntity & {
  proveedor_id: number;
  nombre: string;
  celular: string;
  correo: string;
  es_principal: boolean;
};

export type ProveedorContactoInput = {
  nombre: string;
  celular: string;
  correo: string;
  es_principal?: boolean;
};


// ---------------------------------------------
// PEDIDOS (simplificados para el dashboard)
// ---------------------------------------------

export type PedidoEstado =  'PENDIENTE' | 'PARCIAL' | 'COMPLETO';

export type Pedido = BaseEntity & {
  /** Código de pedido: PED0001, PED0002, etc. */
  codigo: string;

  proveedor_id: number;
  proveedor_nombre: string;

  fecha_registro: string;      // ISO string
  fecha_entrega?: string | null;

  estado: PedidoEstado;

  unidades_solicitadas: number;
  unidades_recibidas: number;

  doc_ref?: string | null;  
};

export type PedidoItem = {
  id: number;
  pedido_id: number;
  producto_id: number;
  producto_descripcion: string;
  cantidad_solicitada: number;
  cantidad_recibida: number;
};

// ==== Colegios (portal colegios / usuario-colegio) ====

export type Colegio = {
  id: number;
  ruc: string;
  razon_social: string | null;
  nombre: string; // NOMBRE (como los conocemos) / nombre_comercial
  direccion: string | null;
  referencia: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_celular: string | null;
  access_key: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type CreateColegioInput = {
  ruc: string;
  razon_social: string;
  nombre: string; // nombre comercial
  direccion?: string;
  referencia?: string;
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_celular?: string;
};

export type UpdateColegioInput = {
  ruc: string;
  razon_social: string;
  nombre: string;
  direccion?: string;
  referencia?: string;
  contacto_nombre?: string;
  contacto_email?: string;
  contacto_celular?: string;
  activo: boolean;
};



