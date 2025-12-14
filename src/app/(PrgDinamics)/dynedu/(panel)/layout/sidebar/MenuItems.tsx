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
  IconActivity
} from "@tabler/icons-react";
import { uniqueId } from "lodash";
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

const Menuitems = [
  // ================
  // GENERAL
  // ================
  {
    navlabel: true,
    subheader: "GENERAL",
  },
  {
    id: uniqueId(),
    title: "Resumen",
    icon: IconLayoutDashboard,
    href: "/dynedu", // usamos el dashboard de colegio como overview
  },

  // ================
  // CATÁLOGO
  // ================
  {
    navlabel: true,
    subheader: "CATÁLOGO",
  },
  {
    id: uniqueId(),
    title: "Productos",
    icon: IconPackage,
    href: "/dynedu/productos",
  },
  {
    id: uniqueId(),
    title: "Packs",
    icon: IconBox,
    href: "/dynedu/packs",
  },
   {
    id: uniqueId(),
    title: "Catalogo De Precios",
    icon: AttachMoneyIcon,
    href: "/dynedu/precios",
  },
  {
    id: uniqueId(),
    title: "Proveedores",
    icon: IconBuilding,
    href: "/dynedu/proveedores",
  },
   {
    id: uniqueId(),
    title: "Actividad",
    icon: IconActivity,
    href: "/dynedu/actividad",
  },

  // ================
  // INVENTARIO
  // ================
  {
    navlabel: true,
    subheader: "INVENTARIO",
  },
  {
    id: uniqueId(),
    title: "Stock",
    icon: IconStack2,
    href: "/dynedu/inventario/stock",
  },
  {
    id: uniqueId(),
    title: "Movimientos",
    icon: IconArrowsLeftRight,
    href: "/dynedu/inventario/movimientos",
  },

  // ================
  // OPERACIONES
  // ================
  {
    navlabel: true,
    subheader: "OPERACIONES",
  },
  {
    id: uniqueId(),
    title: "Pedidos",
    icon: IconClipboardText,
    href: "/dynedu/pedidos",
  },
  {
    id: uniqueId(),
    title: "Consignaciones",
    icon: IconTruck,
    href: "/dynedu/consignaciones",
  },
  {
    id: uniqueId(),
    title: "Tracking",
    icon: IconClipboardText,
    href: "/dynedu/tracking",
  },

  // ================
  // ALMACÉN
  // ================
  {
    navlabel: true,
    subheader: "ALMACÉN",
  },
  {
    id: uniqueId(),
    title: "Kardex",
    icon: IconBuildingWarehouse,
    href: "/almacen/kardex",
  },

  // ================
  // REPORTES
  // ================
  {
    navlabel: true,
    subheader: "REPORTES",
  },
  {
    id: uniqueId(),
    title: "Ventas y cobranzas",
    icon: IconReportMoney,
    href: "/reportes/ventas",
  },

  // ================
  // CONFIGURACIÓN
  // ================
  {
    navlabel: true,
    subheader: "CONFIGURACIÓN",
  },
  {
    id: uniqueId(),
    title: "General",
    icon: IconSettings,
    href: "/dynedu/settings/general",
  },
  {
    id: uniqueId(),
    title: "Usuarios y roles",
    icon: IconUsers,
    href: "/dynedu/settings/usuario-roles",
  },
  {
    id: uniqueId(),
    title: "Integraciones",
    icon: IconPlugConnected,
    href: "/dynedu/settings/integraciones",
  },
  {
    id: uniqueId(),
    title: "Parámetros",
    icon: IconAdjustmentsHorizontal,
    href: "/dynedu/settings/parametros",
  },
  {
  id: "config-usuario-colegio",
  title: "Registro Colegio",
  href: "/dynedu/settings/usuario-colegio",
  icon: IconSchool
},

];

export default Menuitems;
