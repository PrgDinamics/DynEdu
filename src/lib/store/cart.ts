// src/lib/store/cart.ts

export type CartItemProduct = {
  type: "PRODUCT";
  productId: number;
  quantity: number;
};

export type CartItemPack = {
  type: "PACK";
  packId: number;
  quantity: number;
};

export type CartItem = CartItemProduct | CartItemPack;

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

function coerceId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value);

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) return Number(trimmed);
  }

  return null;
}

function coerceQuantity(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.floor(n));
}

function normalizeRawItem(x: any): CartItem | null {
  if (!x || typeof x !== "object") return null;

  const rawType = String((x as any).type ?? "").toUpperCase();

  // PACK (support different field names)
  if (rawType === "PACK" || (x as any).packId != null || (x as any).pack_id != null) {
    const packId = coerceId((x as any).packId) ?? coerceId((x as any).pack_id);
    if (packId === null) return null;

    const quantity = coerceQuantity((x as any).quantity ?? (x as any).qty);
    return { type: "PACK", packId, quantity };
  }

  // PRODUCT (legacy + current)
  const productId =
    coerceId((x as any).productId ?? (x as any).id) ?? coerceId((x as any).product_id);

  if (productId === null) return null;

  const quantity = coerceQuantity((x as any).quantity ?? (x as any).qty);
  return { type: "PRODUCT", productId, quantity };
}

function read(): CartItem[] {
  if (!isBrowser()) return [];

  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = safeParse<any[]>(raw, []);
  if (!Array.isArray(parsed)) return [];

  const normalized = parsed.map(normalizeRawItem).filter(Boolean) as CartItem[];

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

// ------------------------------
// Public getters
// ------------------------------

export function getCart(): CartItem[] {
  return read();
}

/**
 * IMPORTANT:
 * Use this for the /create-preference payload.
 * DO NOT map the cart items manually in CheckoutClient.
 */
export function getCheckoutItems(): CartItem[] {
  // return a clean copy (avoid accidental mutation)
  return read().map((it) => ({ ...it }));
}

export function getCartCount(): number {
  // counts quantities of both PRODUCT and PACK
  return read().reduce((acc, it) => acc + (it.quantity || 0), 0);
}

export function getCartLineCount(): number {
  // how many distinct lines (PRODUCTs + PACKs)
  return read().length;
}

export function clearCart(): void {
  write([]);
}

// ------------------------------
// Add (keep backward compatibility)
// ------------------------------

// Backward-compatible: this adds PRODUCTS (your existing code keeps working)
export function addToCart(productIdInput: number | string, quantity = 1): CartItem[] {
  return addProductToCart(productIdInput, quantity);
}

export function addProductToCart(productIdInput: number | string, quantity = 1): CartItem[] {
  const productId = coerceId(productIdInput);
  if (productId === null) {
    if (isBrowser()) console.warn("[cart] Invalid productId:", productIdInput);
    return read();
  }

  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  const items = read();

  const idx = items.findIndex((x) => x.type === "PRODUCT" && x.productId === productId);

  if (idx >= 0) {
    const cur = items[idx] as CartItemProduct;
    items[idx] = { ...cur, quantity: cur.quantity + q };
  } else {
    items.push({ type: "PRODUCT", productId, quantity: q });
  }

  write(items);
  return items;
}

export function addPackToCart(packIdInput: number | string, quantity = 1): CartItem[] {
  const packId = coerceId(packIdInput);
  if (packId === null) {
    if (isBrowser()) console.warn("[cart] Invalid packId:", packIdInput);
    return read();
  }

  const q = Math.max(1, Math.floor(Number(quantity) || 1));
  const items = read();

  const idx = items.findIndex((x) => x.type === "PACK" && x.packId === packId);

  if (idx >= 0) {
    const cur = items[idx] as CartItemPack;
    items[idx] = { ...cur, quantity: cur.quantity + q };
  } else {
    items.push({ type: "PACK", packId, quantity: q });
  }

  write(items);
  return items;
}

// ------------------------------
// Remove
// ------------------------------

export function removeFromCart(productIdInput: number | string): CartItem[] {
  return removeProductFromCart(productIdInput);
}

export function removeProductFromCart(productIdInput: number | string): CartItem[] {
  const productId = coerceId(productIdInput);
  if (productId === null) return read();

  const items = read().filter((x) => !(x.type === "PRODUCT" && x.productId === productId));
  write(items);
  return items;
}

export function removePackFromCart(packIdInput: number | string): CartItem[] {
  const packId = coerceId(packIdInput);
  if (packId === null) return read();

  const items = read().filter((x) => !(x.type === "PACK" && x.packId === packId));
  write(items);
  return items;
}

// ------------------------------
// Update quantity
// ------------------------------

export function updateQuantity(productIdInput: number | string, quantity: number): CartItem[] {
  return updateProductQuantity(productIdInput, quantity);
}

export function updateProductQuantity(productIdInput: number | string, quantity: number): CartItem[] {
  const productId = coerceId(productIdInput);
  if (productId === null) return read();

  const q = Math.max(0, Math.floor(Number(quantity) || 0));
  const items = read();
  const idx = items.findIndex((x) => x.type === "PRODUCT" && x.productId === productId);
  if (idx < 0) return items;

  if (q === 0) {
    const next = items.filter((x) => !(x.type === "PRODUCT" && x.productId === productId));
    write(next);
    return next;
  }

  const cur = items[idx] as CartItemProduct;
  items[idx] = { ...cur, quantity: q };
  write(items);
  return items;
}

export function updatePackQuantity(packIdInput: number | string, quantity: number): CartItem[] {
  const packId = coerceId(packIdInput);
  if (packId === null) return read();

  const q = Math.max(0, Math.floor(Number(quantity) || 0));
  const items = read();
  const idx = items.findIndex((x) => x.type === "PACK" && x.packId === packId);
  if (idx < 0) return items;

  if (q === 0) {
    const next = items.filter((x) => !(x.type === "PACK" && x.packId === packId));
    write(next);
    return next;
  }

  const cur = items[idx] as CartItemPack;
  items[idx] = { ...cur, quantity: q };
  write(items);
  return items;
}

// Aliases (keep old names working for products)
export const addItem = addToCart;
export const updateQty = updateQuantity;
export const removeItem = removeFromCart;

export function cartUpdatedEventName(): string {
  return EVENT_NAME;
}
