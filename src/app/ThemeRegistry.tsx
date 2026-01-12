"use client";

import * as React from "react";
import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import { useServerInsertedHTML } from "next/navigation";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { baselightTheme } from "@/utils/theme/DefaultColors";

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cache] = React.useState(() => {
    const c = createCache({ key: "mui", prepend: true });
    (c as any).compat = true;
    return c;
  });

  useServerInsertedHTML(() => {
    const inserted = cache.inserted as Record<string, string | boolean>;
    const names = Object.keys(inserted).filter(
      (n) => typeof inserted[n] === "string"
    );
    if (names.length === 0) return null;

    let styles = "";
    for (const name of names) styles += inserted[name] as string;

    return (
      <style
        data-emotion={`${cache.key} ${names.join(" ")}`}
        dangerouslySetInnerHTML={{ __html: styles }}
      />
    );
  });

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={baselightTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
