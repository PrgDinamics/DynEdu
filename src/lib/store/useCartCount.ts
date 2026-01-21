"use client";

import { useSyncExternalStore } from "react";
import { CART_EVENT_NAME, CART_STORAGE_KEY, getCartCount } from "./cart";

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_STORAGE_KEY) cb();
  };

  window.addEventListener(CART_EVENT_NAME, cb);
  window.addEventListener("storage", onStorage);

  return () => {
    window.removeEventListener(CART_EVENT_NAME, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCartCount() {
  return useSyncExternalStore(
    subscribe,
    () => getCartCount(),
    () => 0
  );
}
