import React from "react";
import Menuitems from "./MenuItems";
import { Box } from "@mui/material";
import {
  Sidebar as MUI_Sidebar,
  Menu,
  MenuItem,
  Submenu,
} from "react-mui-sidebar";

import { IconPoint } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const renderMenuItems = (items: any, pathDirect: string) => {
  return items.map((item: any) => {
    const Icon = item.icon ? item.icon : IconPoint;
    const itemIcon = <Icon stroke={1.5} size="1.3rem" />;

    if (item.navlabel && item.subheader) {
      return <Menu subHeading={item.subheader} key={item.subheader} />;
    }

    if (item.children) {
      return (
        <Submenu
          key={item.id}
          title={item.title}
          icon={itemIcon}
          borderRadius="7px"
        >
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

const SidebarItems = () => {
  const pathname = usePathname();
  const pathDirect = pathname;

  return (
  <MUI_Sidebar
    width={"100%"}
    showProfile={false}
    themeColor={"#542DA0"}
    themeSecondaryColor={"#8887E8"}
  >
    {/* Logo custom con tamaño fijo */}
    <Box px={3} pt={3} pb={2}>
      <Link href="/dynedu" passHref>
        <Box
          component="img"
          src="/images/logos/de-logo-color.png" // o .png, según tengas
          alt="Dynamic Education"
          sx={{
            height: 75,       // altura fija del logo
            width: "auto",    // mantiene proporción
            display: "block",
          }}
        />
      </Link>
    </Box>

    {renderMenuItems(Menuitems, pathDirect)}


  </MUI_Sidebar>
);

};

export default SidebarItems;
