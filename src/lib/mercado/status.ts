// src/lib/mercado/status.ts

export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "REFUNDED";

export type OrderStatus =
  | "PAYMENT_PENDING"
  | "PAID"
  | "PREPARING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "FAILED"
  | "REFUND";

/**
 * Mercado Pago -> internal PaymentStatus
 * MP statuses seen in practice: approved, pending, in_process, rejected, cancelled, refunded, charged_back
 */
export function mapMpPaymentStatus(mpStatus?: string | null): PaymentStatus {
  const s = String(mpStatus ?? "").toLowerCase();

  if (s === "approved") return "APPROVED";
  if (s === "rejected") return "REJECTED";
  if (s === "cancelled" || s === "canceled") return "CANCELLED";
  if (s === "refunded" || s === "charged_back") return "REFUNDED";
  if (s === "pending" || s === "in_process") return "PENDING";

  // If unknown, keep it pending so we don't mark orders incorrectly.
  return "PENDING";
}

/**
 * Internal PaymentStatus -> OrderStatus
 * IMPORTANT: keep values aligned with your DB check constraint.
 */
export function mapPaymentToOrderStatus(paymentStatus: PaymentStatus): OrderStatus {
  switch (paymentStatus) {
    case "APPROVED":
      return "PAID";

    case "REFUNDED":
      return "REFUND";

    case "REJECTED":
      return "FAILED";

    case "CANCELLED":
      return "CANCELLED";

    case "CREATED":
    case "PENDING":
    default:
      return "PAYMENT_PENDING";
  }
}
