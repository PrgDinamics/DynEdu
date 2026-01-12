import Menuitems from "./MenuItems";
import { Box } from "@mui/material";
import { Sidebar as MUI_Sidebar, Menu, MenuItem, Submenu } from "react-mui-sidebar";
import { IconPoint } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { PermissionMap } from "../../PanelShell";

type MenuNode = {
  id?: string;
  title?: string;
  href?: string;
  icon?: any;
  navlabel?: boolean;
  subheader?: string;
  children?: MenuNode[];
  permissionKey?: string;
  permissionAnyOf?: string[];
};

function isAllowed(item: MenuNode, permissions: PermissionMap | null) {
  // Mientras no exista login (permissions=null), NO filtramos nada (para no romper).
  if (!permissions) return true;

  if (item.permissionAnyOf?.length) {
    return item.permissionAnyOf.some((k) => permissions[k] === true);
  }
  if (item.permissionKey) {
    return permissions[item.permissionKey] === true;
  }
  return true;
}

function filterMenu(items: MenuNode[], permissions: PermissionMap | null): MenuNode[] {
  const out: MenuNode[] = [];
  for (const item of items) {
    // Labels: se agregan luego si hay items debajo
    if (item.navlabel && item.subheader) {
      out.push(item);
      continue;
    }

    if (item.children?.length) {
      const children = filterMenu(item.children, permissions);
      if (children.length > 0 && isAllowed(item, permissions)) {
        out.push({ ...item, children });
      }
      continue;
    }

    if (isAllowed(item, permissions)) out.push(item);
  }

  // Limpia labels que queden “colgados” (sin items debajo)
  const cleaned: MenuNode[] = [];
  for (let i = 0; i < out.length; i++) {
    const curr = out[i];
    if (curr.navlabel && curr.subheader) {
      const next = out[i + 1];
      if (!next || (next.navlabel && next.subheader)) {
        continue;
      }
    }
    cleaned.push(curr);
  }
  return cleaned;
}

const renderMenuItems = (items: MenuNode[], pathDirect: string) => {
  return items.map((item: MenuNode) => {
    const Icon = item.icon ? item.icon : IconPoint;
    const itemIcon = <Icon stroke={1.5} size="1.3rem" />;

    if (item.navlabel && item.subheader) {
      return <Menu subHeading={item.subheader} key={item.subheader} />;
    }

    if (item.children) {
      return (
        <Submenu key={item.id} title={item.title} icon={itemIcon} borderRadius="7px">
          {renderMenuItems(item.children, pathDirect)}
        </Submenu>
      );
    }

    return (
      <Box px={3} key={item.id}>
        <MenuItem
          isSelected={pathDirect === item?.href}
          borderRadius="8px"
          icon={itemIcon}
          link={item.href}
          component={Link as any}
        >
          {item.title}
        </MenuItem>
      </Box>
    );
  });
};

const SidebarItems = ({ permissions }: { permissions: PermissionMap | null }) => {
  const pathname = usePathname();
  const pathDirect = pathname;

  const filtered = filterMenu(Menuitems as any, permissions);

  return (
    <MUI_Sidebar
      width={"100%"}
      showProfile={false}
      themeColor={"#542DA0"}
      themeSecondaryColor={"#8887E8"}
    >
      <Box px={3} pt={3} pb={2}>
        <Link href="/dynedu" passHref>
          <Box
            component="img"
            src="/images/logos/de-logo-color.png"
            alt="Dynamic Education"
            sx={{
              height: 75,
              width: "auto",
              display: "block",
            }}
          />
        </Link>
      </Box>

      {renderMenuItems(filtered, pathDirect)}
    </MUI_Sidebar>
  );
};

export default SidebarItems;
