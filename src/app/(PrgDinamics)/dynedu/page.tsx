"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Stack,
  Alert,
} from "@mui/material";

import { supabaseBrowser } from "@/lib/supabaseBrowserClient";

export default function DynEduLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    if (!email || !password) {
      setError("Debes ingresar correo y contraseña.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabaseBrowser.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      console.error(error);
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }

    // ✅ Login OK -> ir al dashboard de DynEdu
    router.push("/prgdinamics/dynedu/dashboard");
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 2,
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 420,
          borderRadius: 3,
          boxShadow: 6,
        }}
      >
        <CardContent>
          <Typography variant="h5" fontWeight={700} mb={0.5}>
            Intranet DynEdu
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Inicia sesión para acceder al panel de campaña académica.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2}>
              <TextField
                label="Correo institucional"
                name="email"
                type="email"
                size="small"
                fullWidth
                autoComplete="email"
                required
              />

              <TextField
                label="Contraseña"
                name="password"
                type="password"
                size="small"
                fullWidth
                autoComplete="current-password"
                required
              />

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={loading}
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
