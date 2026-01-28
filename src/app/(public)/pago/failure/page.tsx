import { redirect } from "next/navigation";

export default async function PagoFailurePage({
  searchParams,
}: {
  searchParams: { orderId?: string };
}) {
  const orderId = String(searchParams?.orderId ?? "").trim();

  if (orderId) {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");

    try {
      await fetch(`${base}/api/orders/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, reason: "mp_failure" }),
        cache: "no-store",
      });
    } catch {}
  }

  redirect("/mis-compras");
}
