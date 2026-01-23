import {
  IconLayoutDashboard,
  IconPackage,
  IconBox,
  IconBuilding,
  IconStack2,
  IconArrowsLeftRight,
  IconClipboardText,
  IconTruck,
  IconBuildingWarehouse,
  IconReportMoney,
  IconSettings,
  IconUsers,
  IconPlugConnected,
  IconAdjustmentsHorizontal,
  IconSchool,
  IconActivity,
  IconShoppingCart,
  IconBook
} from "@tabler/icons-react";
import { uniqueId } from "lodash";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

const Menuitems = [
  { navlabel: true, subheader: "GENERAL" },
  {
    id: uniqueId(),
    title: "Resumen",
    icon: IconLayoutDashboard,
    href: "/dynedu/dashboard",
    permissionKey: "canViewDashboard",
    
  },
   {
    id: uniqueId(),
    title: "Actividad",
    icon: IconActivity,
    href: "/dynedu/actividad",
    permissionKey: "canViewActivity",
  },

  { navlabel: true, subheader: "CATÁLOGO" },
  {
    id: uniqueId(),
    title: "Productos",
    icon: IconBook,
    href: "/dynedu/productos",
    permissionKey: "canViewProducts",
  },
  {
    id: uniqueId(),
    title: "Packs",
    icon: IconBox,
    href: "/dynedu/packs",
    permissionKey: "canViewPacks",
  },
  {
    id: uniqueId(),
    title: "Catalogo De Precios",
    icon: AttachMoneyIcon,
    href: "/dynedu/precios",
    permissionKey: "canViewPriceCatalog",
  },
  {
    id: uniqueId(),
    title: "Proveedores",
    icon: IconBuilding,
    href: "/dynedu/proveedores",
    permissionKey: "canViewSuppliers",
  },

  { navlabel: true, subheader: "INVENTARIO" },
  {
    id: uniqueId(),
    title: "Stock",
    icon: IconStack2,
    href: "/dynedu/inventario/stock",
    permissionKey: "canViewStock",
  },
  {
    id: uniqueId(),
    title: "Movimientos",
    icon: IconArrowsLeftRight,
    href: "/dynedu/inventario/movimientos",
    permissionKey: "canViewInventoryMovements",
  },

  { navlabel: true, subheader: "OPERACIONES" },
  {
    id: uniqueId(),
    title: "Pedidos",
    icon: IconClipboardText,
    href: "/dynedu/pedidos",
    permissionKey: "canViewOrders",
  },
  {
    id: uniqueId(),
    title: "Tracking",
    icon: IconClipboardText,
    href: "/dynedu/tracking",
    permissionKey: "canViewTracking",
  },
  {
    id: uniqueId(),
    title: "Consignaciones",
    icon: IconTruck,
    href: "/dynedu/consignaciones",
    permissionKey: "canViewConsignations",
  },

   {
    id: uniqueId(),
    title: "Entregas",
    icon: IconShoppingCart,
    href: "/dynedu/entregas",
    permissionKey: "canViewOrders",
  },
  
  

  // { navlabel: true, subheader: "ALMACÉN" },
  // {
  //   id: uniqueId(),
  //   title: "Kardex",
  //   icon: IconBuildingWarehouse,
  //   href: "/almacen/kardex",
  //   permissionKey: "canViewKardex",
  // },

  { navlabel: true, subheader: "REPORTES" },
  {
    id: uniqueId(),
    title: "Ventas",
    icon: IconReportMoney,
    href: "/dynedu/reportes/ventas",
    permissionKey: "canViewSalesCollections",
  },

  { navlabel: true, subheader: "CONFIGURACIÓN" },
  {
    id: uniqueId(),
    title: "General",
    icon: IconSettings,
    href: "/dynedu/settings/general",
    permissionKey: "canManageGeneralSettings",
  },
  {
    id: uniqueId(),
    title: "Usuarios y roles",
    icon: IconUsers,
    href: "/dynedu/settings/usuario-roles",
    permissionAnyOf: ["canManageUsers", "canManageRoles"],
  },
  {
    id: "config-usuario-colegio",
    title: "Registro Colegio",
    href: "/dynedu/settings/usuario-colegio",
    icon: IconSchool,
    permissionKey: "canManageSchoolRegistry",
  },
];

export default Menuitems;
