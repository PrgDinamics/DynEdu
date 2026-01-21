"use client";

import * as React from "react";
import { Dialog, DialogActions, DialogContent, DialogTitle, Button, Typography } from "@mui/material";

type Props = {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export default function ErrorDialog({ open, title = "Ocurrió un error", message, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Typography sx={{ whiteSpace: "pre-wrap" }}>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>OK</Button>
      </DialogActions>
    </Dialog>
  );
}
