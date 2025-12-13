"use client";

export const dynamic = "force-dynamic";

import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";

const SettingsIntegracionesPage: React.FC = () => (
  <Box>
    <Typography variant="h4" fontWeight={600} mb={0.5}>
      Integraciones
    </Typography>
    <Typography variant="body2" color="text.secondary" mb={4}>
      Conexión futura con ERPs, pasarelas de pago, etc. (mock).
    </Typography>

    <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Typography variant="body2">
          Aquí podrás configurar integraciones con otros sistemas:
          contabilidad, pasarelas de pago, plataformas del colegio, etc.
        </Typography>
      </CardContent>
    </Card>
  </Box>
);

export default SettingsIntegracionesPage;
