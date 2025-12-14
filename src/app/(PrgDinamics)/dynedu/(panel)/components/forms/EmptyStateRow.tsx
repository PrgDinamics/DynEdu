"use client";

import { ReactNode } from "react";
import { Card, CardContent, Box, Typography, Stack } from "@mui/material";

type SectionCardProps = {
  id?: string;
  title?: string;
  subtitle?: string;
  /** Contenido principal de la sección (formularios, tablas, etc.) */
  children: ReactNode;
  /** Contenido alineado a la derecha del header (botones, filtros, etc.) */
  headerActions?: ReactNode;
};

export function SectionCard({
  id,
  title,
  subtitle,
  children,
  headerActions,
}: SectionCardProps) {
  return (
    <Card
      id={id}
      elevation={0}
      sx={{
        mb: 3,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {(title || subtitle || headerActions) && (
        <Box
          sx={{
            px: 3,
            pt: 2.5,
            pb: 1.5,
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            flexWrap="wrap"
          >
            <Box>
              {title && (
                <Typography variant="subtitle1" fontWeight={600}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {headerActions && <Box>{headerActions}</Box>}
          </Stack>
        </Box>
      )}

      <CardContent sx={{ p: 3 }}>{children}</CardContent>
    </Card>
  );
}
