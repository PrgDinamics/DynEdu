export const dynamic = "force-dynamic";
export const revalidate = 0;

import RegisterClient from "./RegisterClient";

type SearchParams = {
  next?: string;
};

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeNext(nextRaw: string) {
  const decoded = safeDecode(nextRaw || "").trim();

  // Default path
  if (!decoded) return "/checkout";

  // Prevent open-redirect / invalid values
  if (!decoded.startsWith("/")) return "/checkout";
  if (decoded.startsWith("//")) return "/checkout";

  return decoded;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const nextRaw = typeof sp?.next === "string" ? sp.next : "";
  const nextPath = normalizeNext(nextRaw);

  return <RegisterClient nextPath={nextPath} />;
}
