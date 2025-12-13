"use client";

import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

const SettingsUsuariosPage: React.FC = () => (
  <Box>
    <Typography variant="h4" fontWeight={600} mb={0.5}>
      Usuarios y roles
    </Typography>
    <Typography variant="body2" color="text.secondary" mb={4}>
      Gestión mock de usuarios internos y sus permisos.
    </Typography>

    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Typography variant="body2">
          Más adelante aquí irán los usuarios, roles (Administrador, Operaciones,
          Inventario, Colegio, etc.) y sus permisos.
        </Typography>
      </CardContent>
    </Card>
  </Box>
);

export default SettingsUsuariosPage;
