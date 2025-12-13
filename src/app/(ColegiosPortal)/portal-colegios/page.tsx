import { redirect } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getPortalColegio, loginColegioAction } from "./actions";

// Acción de formulario en el lado del servidor
async function loginFormAction(formData: FormData) {
  "use server";

  const ruc = String(formData.get("ruc") ?? "");
  const accessKey = String(formData.get("accessKey") ?? "");

  const result = await loginColegioAction({ ruc, accessKey });

  // Si falla, por ahora simplemente volvemos al login
  if (!result.success) {
    // Más adelante podemos mejorar esto con manejo de errores en cliente
    redirect("/portal-colegios");
  }

  // Si todo ok, ya se guardó la cookie en loginColegioAction
  redirect("/portal-colegios/consignacion");
}

export default async function ColegioPortalLoginPage() {
  const colegio = await getPortalColegio();

  if (colegio) {
    redirect("/portal-colegios/consignacion");
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 420, width: "100%", borderRadius: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            Portal de colegios
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Ingrese el RUC del colegio y el código de acceso asignado para
            registrar consignaciones de libros.
          </Typography>

          <form action={loginFormAction}>
            <Stack spacing={2}>
              <TextField
                name="ruc"
                label="RUC del colegio"
                fullWidth
                size="small"
                required
              />
              <TextField
                name="accessKey"
                label="Código de acceso"
                fullWidth
                size="small"
                type="password"
                required
              />

              <Button type="submit" variant="contained" fullWidth>
                Ingresar
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
