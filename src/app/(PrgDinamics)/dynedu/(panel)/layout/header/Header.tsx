import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  styled,
  Stack,
  IconButton,
  Badge,
  Typography,
} from "@mui/material";
import PropTypes from "prop-types";
import { IconBellRinging, IconMenu } from "@tabler/icons-react";
import Profile from "./Profile";

type HeaderUser = {
  fullName: string;
  email: string;
  username: string;
};

interface ItemType {
  toggleMobileSidebar: (event: React.MouseEvent<HTMLElement>) => void;
}

function normalizeUser(payload: any): HeaderUser | null {
  const u = payload?.user ?? payload;
  if (!u) return null;

  const fullName = (u.fullName ?? u.full_name ?? "").toString();
  const email = (u.email ?? "").toString();
  const username = (u.username ?? "").toString();

  if (!fullName && !email && !username) return null;

  return { fullName, email, username };
}

async function fetchMeWithRetry(): Promise<HeaderUser | null> {
  // try a couple times in case cookie/session is still settling right after login
  for (let i = 0; i < 3; i++) {
    const res = await fetch("/api/dynedu/me", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
    });

    if (res.ok) {
      const json = await res.json();
      return normalizeUser(json);
    }

    // Helpful logs (dev)
    if (process.env.NODE_ENV !== "production") {
      console.warn("[dynedu/me] failed:", res.status);
    }

    // retry only on 401 (not logged in yet / cookie race)
    if (res.status !== 401) return null;

    await new Promise((r) => setTimeout(r, 200));
  }

  return null;
}

const Header = ({ toggleMobileSidebar }: ItemType) => {
  const [user, setUser] = useState<HeaderUser | null>(null);

  const AppBarStyled = styled(AppBar)(({ theme }) => ({
    boxShadow: "none",
    background: theme.palette.background.paper,
    justifyContent: "center",
    backdropFilter: "blur(4px)",
    borderBottom: `1px solid ${theme.palette.divider}`,
    [theme.breakpoints.up("lg")]: {
      minHeight: "70px",
    },
  }));

  const ToolbarStyled = styled(Toolbar)(({ theme }) => ({
    width: "100%",
    color: theme.palette.text.secondary,
  }));

  const greetingName = useMemo(() => {
    if (!user) return "";
    return user.fullName?.trim() || user.username?.trim() || user.email;
  }, [user]);

  useEffect(() => {
    let mounted = true;

    const loadMe = async () => {
      try {
        const me = await fetchMeWithRetry();
        if (!mounted) return;
        if (me) setUser(me);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[Header] loadMe error:", err);
        }
      }
    };

    loadMe();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppBarStyled position="sticky" color="default">
      <ToolbarStyled>
        <IconButton
          color="inherit"
          aria-label="menu"
          onClick={toggleMobileSidebar}
          sx={{ display: { lg: "none", xs: "inline" } }}
        >
          <IconMenu width="20" height="20" />
        </IconButton>

        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton
            size="large"
            aria-label="notifications"
            color="inherit"
            aria-controls="msgs-menu"
            aria-haspopup="true"
          >
            <Badge variant="dot" color="primary">
              <IconBellRinging size="21" stroke="1.5" />
            </Badge>
          </IconButton>

          {greetingName ? (
            <Typography variant="body2" sx={{ color: "text.primary" }}>
              Bienvenido, <b>{greetingName}</b>
            </Typography>
          ) : null}
        </Stack>

        <Box flexGrow={1} />

        <Stack spacing={1} direction="row" alignItems="center">
          <Profile user={user} />
        </Stack>
      </ToolbarStyled>
    </AppBarStyled>
  );
};

Header.propTypes = {
  sx: PropTypes.object,
};

export default Header;
