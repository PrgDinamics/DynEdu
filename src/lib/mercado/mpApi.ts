import crypto from "crypto";

export type MpPreferenceItem = {
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: string;
};

export type MpCreatePreferenceInput = {
  items: MpPreferenceItem[];
  payer?: {
    name?: string;
    surname?: string;
    email?: string;
    phone?: {
      number?: string;
    };
  };
  back_urls: {
    success: string;
    pending: string;
    failure: string;
  };
  auto_return?: "approved" | "all";
  notification_url: string;
  external_reference?: string;
  metadata?: Record<string, any>;
};

export type MpCreatePreferenceResponse = {
  id: string;
  init_point: string;
  sandbox_init_point?: string;
};

export type MpPayment = {
  id: number;
  status: string;
  status_detail?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string;
  order?: { id?: number };
  merchant_order_id?: number;
  preference_id?: string;
};

function getAccessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Missing MP_ACCESS_TOKEN");
  return token;
}

export async function mpCreatePreference(
  payload: MpCreatePreferenceInput
): Promise<MpCreatePreferenceResponse> {
  const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      authorization: `Bearer ${getAccessToken()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || json?.error || "Mercado Pago preference error");
  }

  return json as MpCreatePreferenceResponse;
}

export async function mpGetPayment(paymentId: string | number): Promise<MpPayment> {
  const res = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      authorization: `Bearer ${getAccessToken()}`,
    },
    cache: "no-store",
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.message || json?.error || "Mercado Pago payment error");
  }
  return json as MpPayment;
}

// ------------------------------------------------------------
// Webhook signature verification (optional)
// ------------------------------------------------------------
export function verifyMpWebhookSignature(args: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  secret: string | undefined;
  dataId: string | null;
}): boolean {
  const { signatureHeader, requestIdHeader, secret, dataId } = args;
  if (!secret) return true; // dev fallback
  if (!signatureHeader || !requestIdHeader || !dataId) return false;

  const parts = signatureHeader
    .split(",")
    .map((x) => x.trim())
    .map((x) => x.split("="))
    .reduce<Record<string, string>>((acc, [k, v]) => {
      if (k && v) acc[k] = v;
      return acc;
    }, {});

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // manifest format per MP docs
  const manifest = `id:${dataId};request-id:${requestIdHeader};ts:${ts};`;
  const hmac = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(hmac);
  const b = Buffer.from(v1);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
