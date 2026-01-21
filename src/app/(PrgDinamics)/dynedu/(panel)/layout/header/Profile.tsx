import React, { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Menu,
  Button,
  IconButton,
  Typography,
  Divider,
  Stack,
} from "@mui/material";

import { createSupabaseBrowserClient } from "@/lib/supabaseBrowserClient";

type HeaderUser = {
  fullName: string;
  email: string;
  username: string;
};

function getInitials(fullName: string, username: string, email: string) {
  const base = fullName?.trim() || username?.trim() || email?.trim() || "U";
  const parts = base.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (base[0] ?? "U").toUpperCase();
}

const Profile = ({ user }: { user: HeaderUser | null }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const initials = useMemo(() => {
    if (!user) return "U";
    return getInitials(user.fullName, user.username, user.email);
  }, [user]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) =>
    setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = async () => {
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/dynedu";
    }
  };

  return (
    <Box>
      <IconButton
        size="large"
        aria-label="profile"
        color="inherit"
        aria-controls="profile-menu"
        aria-haspopup="true"
        onClick={handleOpen}
        sx={{
          ...(anchorEl && { color: "primary.main" }),
        }}
      >
        <Avatar
          sx={{
            width: 35,
            height: 35,
            fontWeight: 800,
            fontSize: 14,
          }}
        >
          {initials}
        </Avatar>
      </IconButton>

      <Menu
        id="profile-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        sx={{
          "& .MuiMenu-paper": {
            width: 280,
            borderRadius: 2,
          },
        }}
      >
        <Box px={2} pt={2} pb={1.5}>
          <Stack spacing={0.5}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {user?.fullName?.trim() || user?.username?.trim() || "Usuario"}
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {user?.email || "—"}
            </Typography>

            {user?.username ? (
              <Typography variant="caption" color="text.secondary">
                @{user.username}
              </Typography>
            ) : null}
          </Stack>
        </Box>

        <Divider />

        <Box py={1} px={2}>
          <Button onClick={handleLogout} variant="outlined" color="primary" fullWidth>
            Cerrar sesión
          </Button>
        </Box>
      </Menu>
    </Box>
  );
};

export default Profile;
