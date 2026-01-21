"use client";

import { Box, Card, CardContent, Typography, Button } from "@mui/material";
import { useRouter } from "next/navigation";

export default function NoAccess() {
  const router = useRouter();

  return (
    <Box sx={{ display: "flex", justifyContent: "center", mt: 6, px: 2 }}>
      <Card sx={{ maxWidth: 520, width: "100%", borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Acceso denegado
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Tu usuario no tiene permisos para acceder a esta sección.
          </Typography>

          <Button variant="contained" onClick={() => router.push("/dynedu")}>
            Volver al panel
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
