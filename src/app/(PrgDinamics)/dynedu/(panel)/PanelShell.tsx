"use client";

import { styled, Container, Box } from "@mui/material";
import React, { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Header from "./layout/header/Header";
import Sidebar from "./layout/sidebar/Sidebar";
import NoAccess from "./components/error/NoAccess";

export type PermissionMap = Record<string, boolean>;

// 🔒 Map de rutas => permisos requeridos (edítalo cuando agregues módulos)
const ROUTE_PERMS: Array<{ startsWith: string; anyOf: string[] }> = [
  { startsWith: "/dynedu/productos", anyOf: ["canViewProducts"] },
  { startsWith: "/dynedu/packs", anyOf: ["canViewPacks"] },
  { startsWith: "/dynedu/precios", anyOf: ["canViewPriceCatalog", "canManagePriceCatalog", "canManagePricecatalog"] },

  // settings
  { startsWith: "/dynedu/settings/usuario-roles", anyOf: ["canManageUsers", "canManageRoles"] },

  // agrega más acá:
  // { startsWith: "/dynedu/consignaciones", anyOf: ["canViewConsignaciones"] },
];

const MainWrapper = styled("div")(() => ({
  display: "flex",
  minHeight: "100vh",
  width: "100%",
}));

const PageWrapper = styled("div")(() => ({
  display: "flex",
  flexGrow: 1,
  paddingBottom: "60px",
  flexDirection: "column",
  zIndex: 1,
  backgroundColor: "transparent",
}));

function hasAnyPermission(permissions: PermissionMap | null, keys: string[]) {
  if (!permissions) return false;
  return keys.some((k) => permissions[k] === true);
}

export default function PanelShell({
  children,
  permissions,
}: {
  children: React.ReactNode;
  permissions: PermissionMap | null;
}) {
  const pathname = usePathname();

  const [isSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ✅ Decide si esta ruta requiere permisos
  const access = useMemo(() => {
    if (!pathname) return { ok: true as const };

    const rule = ROUTE_PERMS.find((r) => pathname.startsWith(r.startsWith));
    if (!rule) return { ok: true as const }; // rutas sin regla => permitidas

    const ok = hasAnyPermission(permissions, rule.anyOf);
    return ok ? ({ ok: true as const } as const) : ({ ok: false as const } as const);
  }, [pathname, permissions]);

  // ✅ Bloqueo global por ruta
  if (!access.ok) {
    return <NoAccess />;
  }

  return (
    <MainWrapper className="mainwrapper">
      <Sidebar
        permissions={permissions}
        isSidebarOpen={isSidebarOpen}
        isMobileSidebarOpen={isMobileSidebarOpen}
        onSidebarClose={() => setMobileSidebarOpen(false)}
      />

      <PageWrapper className="page-wrapper">
        <Header toggleMobileSidebar={() => setMobileSidebarOpen(true)} />

        <Container
          maxWidth={false}
          sx={{
            paddingTop: "100px",
            maxWidth: "1200px",
          }}
        >
          <Box sx={{ minHeight: "calc(100vh - 170px)" }}>{children}</Box>
        </Container>
      </PageWrapper>
    </MainWrapper>
  );
}
