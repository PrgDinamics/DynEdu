// src/lib/store/cart.ts

export type CartItem = {
  productId: number;
  quantity: number;
};

const STORAGE_KEY = "dynedu_cart";
const EVENT_NAME = "dynedu_cart_updated";

export const CART_STORAGE_KEY = STORAGE_KEY;
export const CART_EVENT_NAME = EVENT_NAME;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function emitCartUpdated(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(EVENT_NAME));
}

function coerceProductId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);

  if (typeof value === "string") {
    const trimmed = value.trim();
    // accept numeric strings like "12"
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
  }

  return null;
}

function coerceQuantity(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.floor(n));
}

function read(): CartItem[] {
  if (!isBrowser()) return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse<any[]>(raw, []);
  if (!Array.isArray(parsed)) return [];

  // Migration + normalization (accept productId as number OR numeric string)
  const normalized = parsed
    .map((x) => {
      if (!x || typeof x !== "object") return null;

      const productId = coerceProductId((x as any).productId ?? (x as any).id);
      if (productId === null) return null;

      const quantity = coerceQuantity((x as any).quantity);

      return { productId, quantity } as CartItem;
    })
    .filter(Boolean) as CartItem[];

  // Persist normalized format if it differs
  try {
    if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    }
  } catch {
    // ignore
  }

  return normalized;
}

function write(items: CartItem[]): void {
  if (!isBrowser()) return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }

  emitCartUpdated();
}

export function getCart(): CartItem[] {
  return read();
}

export function getCartCount(): number {
  return read().reduce((acc, it) => acc + (it.quantity || 0), 0);
}

export function clearCart(): void {
  write([]);
}

export function addToCart(productIdInput: number | string, quantity = 1): CartItem[] {
  const productId = coerceProductId(productIdInput);
  if (productId === null) {
    if (isBrowser()) console.warn("[cart] Invalid productId:", productIdInput);
    return read();
  }

  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  const items = read();
  const idx = items.findIndex((x) => x.productId === productId);

  if (idx >= 0) items[idx] = { ...items[idx], quantity: items[idx].quantity + q };
  else items.push({ productId, quantity: q });

  write(items);
  return items;
}

export function removeFromCart(productIdInput: number | string): CartItem[] {
  const productId = coerceProductId(productIdInput);
  if (productId === null) return read();

  const items = read().filter((x) => x.productId !== productId);
  write(items);
  return items;
}

export function updateQuantity(productIdInput: number | string, quantity: number): CartItem[] {
  const productId = coerceProductId(productIdInput);
  if (productId === null) return read();

  const q = Math.max(0, Math.floor(Number(quantity) || 0));
  const items = read();
  const idx = items.findIndex((x) => x.productId === productId);
  if (idx < 0) return items;

  if (q === 0) {
    const next = items.filter((x) => x.productId !== productId);
    write(next);
    return next;
  }

  items[idx] = { ...items[idx], quantity: q };
  write(items);
  return items;
}

// Aliases
export const addItem = addToCart;
export const updateQty = updateQuantity;
export const removeItem = removeFromCart;

export function cartUpdatedEventName(): string {
  return EVENT_NAME;
}
