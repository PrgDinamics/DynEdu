"use client";

import * as React from "react";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";

type Props = {
  url: string;
  filename?: string;
  openInNewTab?: boolean;
  label?: string;
  variant?: "text" | "outlined" | "contained";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  sx?: any; // allow caller overrides

  // NEW: para usarlo como ícono en tablas
  mode?: "button" | "icon";
  tooltip?: string;
};

export default function PdfDownloadButton({
  url,
  filename,
  openInNewTab = true,
  label = "Descargar PDF",
  variant = "contained",
  size = "small",
  disabled,
  sx,

  mode = "button",
  tooltip = "Descargar PDF",
}: Props) {
  const handleClick = React.useCallback(() => {
    if (!url) return;

    if (openInNewTab) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [url, filename, openInNewTab]);

  // ICON MODE (para tablas tipo Orders)
  if (mode === "icon") {
    return (
      <Tooltip title={tooltip}>
        <span>
          <IconButton
            onClick={handleClick}
            disabled={disabled}
            size="small"
            sx={{
              color: "success.main",
              ...sx,
            }}
          >
            <PictureAsPdfIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  // BUTTON MODE (default, como lo tienes en ventas)
  return (
    <Tooltip title={tooltip}>
      <span>
        <Button
          onClick={handleClick}
          size={size}
          variant={variant}
          disabled={disabled}
          sx={{
            textTransform: "none",
            fontWeight: 800,
            borderRadius: 2,
            px: 2,
            minHeight: 36,
            boxShadow: variant === "contained" ? "0 6px 18px rgba(0,0,0,.12)" : "none",
            ...sx,
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Stack
              alignItems="center"
              justifyContent="center"
              sx={{
                width: 26,
                height: 26,
                borderRadius: 1.2,
                bgcolor: "rgba(255,255,255,.25)",
              }}
            >
              <PictureAsPdfIcon sx={{ fontSize: 18 }} />
            </Stack>
            <span>{label}</span>
          </Stack>
        </Button>
      </span>
    </Tooltip>
  );
}
