"use client";

import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useRouter } from "next/navigation";
import type { SaleDetail } from "../actions";
import PdfDownloadButton from "../../../components/pdf/PdfDownloadButton";

function money(n: number | null | undefined) {
  if (n == null) return "—";
  return `S/${Number(n).toFixed(2)}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("es-PE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortId(id: string) {
  return String(id ?? "").replaceAll("-", "").slice(0, 8).toUpperCase();
}

export default function VentaDetalleClient({ detail }: { detail: SaleDetail | null }) {
  const router = useRouter();

  if (!detail) {
    return (
      <Box sx={{ p: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="h6">Venta no encontrada</Typography>
            <Typography variant="body2" color="text.secondary">
              No existe una orden con ese ID, o no se pudo cargar.
            </Typography>
            <Box>
              <Button variant="outlined" onClick={() => router.push("/dynedu/reportes/ventas")}>
                Volver
              </Button>
            </Box>
          </Stack>
        </Paper>
      </Box>
    );
  }

  const { order, items, payment } = detail;



  return (
    <Box sx={{ p: 2, pt: 1 }}>
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Stack spacing={0.5}>
              <Typography variant="h6" fontWeight={700}>Venta #{shortId(order.id)}</Typography>
              <Typography variant="body2" color="text.secondary">
                ID: {order.id}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center"> 
               <PdfDownloadButton
                        url={`/api/dynedu/pdf/ventas/${order.id}`}
                        filename={`entrega-${order.id}.pdf`}
                />
              
              <Button variant="outlined" onClick={() => router.push("/dynedu/reportes/ventas")}>
                Volver
              </Button>
            </Stack>
          </Stack>

          <Divider />

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Cliente
              </Typography>
              <Typography variant="body2">Nombre: {order.customer_name}</Typography>
              <Typography variant="body2">Email: {order.customer_email}</Typography>
              <Typography variant="body2">Teléfono: {order.customer_phone}</Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                Creado: {formatDateTime(order.created_at)}
              </Typography>
              <Typography variant="body2">Estado orden: {order.status}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Envío
              </Typography>
              <Typography variant="body2">Dirección: {order.shipping_address}</Typography>
              <Typography variant="body2">Distrito: {order.shipping_district ?? "—"}</Typography>
              <Typography variant="body2">Referencia: {order.shipping_reference ?? "—"}</Typography>
              <Typography variant="body2">Notas: {order.shipping_notes ?? "—"}</Typography>
            </Paper>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
              Items
            </Typography>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell>Código</TableCell>
                  <TableCell align="right">Cant.</TableCell>
                  <TableCell align="right">P. unit</TableCell>
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {it.producto?.internal_id ?? it.codigo_venta_snapshot ?? "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {it.producto?.descripcion ?? it.title_snapshot}
                      </Typography>
                    </TableCell>
                    <TableCell>{it.codigo_venta_snapshot ?? "—"}</TableCell>
                    <TableCell align="right">{it.quantity}</TableCell>
                    <TableCell align="right">{money(it.unit_price)}</TableCell>
                    <TableCell align="right">{money(it.line_total)}</TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary">
                        Sin items.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Paper>

          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Totales
              </Typography>
              <Typography variant="body2">Subtotal: {money(order.subtotal)}</Typography>
              <Typography variant="body2">
                Descuento: {money(order.discount_amount)} ({order.discount_code ?? "Sin código"})
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 800, mt: 1 }}>
                Total: {money(order.total)}
              </Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Pago
              </Typography>

              {payment ? (
                <>
                  <Typography variant="body2">Provider: {payment.provider}</Typography>
                  <Typography variant="body2">Status: {payment.status}</Typography>
                  <Typography variant="body2">Monto: {money(payment.amount)}</Typography>
                  <Typography variant="body2">payment_id: {payment.payment_id ?? "—"}</Typography>
                  <Typography variant="body2">
                    preference_id: {payment.preference_id ?? "—"}
                  </Typography>
                  <Typography variant="body2">
                    merchant_order_id: {payment.merchant_order_id ?? "—"}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Updated: {formatDateTime(payment.updated_at ?? payment.created_at)}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin pago registrado.
                </Typography>
              )}
            </Paper>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
}
