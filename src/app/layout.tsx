"use client";

import { baselightTheme } from "@/utils/theme/DefaultColors";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import "./global.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* Título del tab */}
        <title>Dynamic Education</title>

        {/* Opción 1: si pusiste el archivo en public/de-logo-icon.ico */}
        <link rel="icon" href="/favicon.ico" />

        {/* Opción 2: si lo tienes en public/images/logos/de-logo-icon.ico
        <link rel="icon" href="/images/logos/de-logo-icon.ico" />
        */}
      </head>
      <body>
        <ThemeProvider theme={baselightTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
