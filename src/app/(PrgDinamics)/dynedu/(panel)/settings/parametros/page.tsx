"use client";


import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

const SettingsParametrosPage: React.FC = () => (
  <Box>
    <Typography variant="h4" fontWeight={600} mb={0.5}>
      Parámetros
    </Typography>
    <Typography variant="body2" color="text.secondary" mb={4}>
      Catálogos y parámetros maestros de la suite (mock).
    </Typography>

    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Typography variant="body2">
          Aquí se podrán configurar catálogos como niveles, grados,
          tipos de pedido, estados personalizados, etc.
        </Typography>
      </CardContent>
    </Card>
  </Box>
);

export default SettingsParametrosPage;
