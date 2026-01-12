"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@mui/material";
import { LogOut } from "lucide-react";

import { logoutColegioAction } from "../actions";

type Props = {
  className?: string;
};

export default function PortalLogoutButton({ className }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onLogout = () => {
    startTransition(async () => {
      try {
        await logoutColegioAction();
      } finally {
        router.refresh();
        router.push("/portal-colegios");
      }
    });
  };

  return (
    <Button
      className={className}
      onClick={onLogout}
      disabled={isPending}
      variant="outlined"
      startIcon={<LogOut size={18} />}
      sx={{
        borderRadius: 2,
        textTransform: "none",
        fontWeight: 900,
        borderColor: "rgba(255,255,255,0.22)",
        color: "rgba(255,255,255,0.92)",
        backgroundColor: "rgba(255,255,255,0.04)",
        "&:hover": {
          backgroundColor: "rgba(255,255,255,0.08)",
          borderColor: "rgba(255,255,255,0.34)",
        },
      }}
    >
      {isPending ? "Saliendo..." : "Cerrar sesión"}
    </Button>
  );
}
