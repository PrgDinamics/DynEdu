// src/lib/colegio/formatters.ts

// Fecha y hora en formato local (la que ya usábamos)
export function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("es-PE", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

// Color para el Chip según estado del pedido
export function getPedidoStatusColor(estado?: string | null) {
  switch (estado) {
    case "COMPLETO":
      return "success";
    case "PARCIAL":
      return "warning";
    case "PENDIENTE":
    default:
      return "default";
  }
}
