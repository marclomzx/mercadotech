"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import * as cartService from "@/services/cart.service";
import type { CartItem } from "@/services/cart.service";
import * as orderService from "@/services/order.service";

// Store compartido a nivel de módulo. useCart se monta simultáneamente en
// tres lugares (CartIndicator del navbar, BuyBox del detalle y /carrito);
// con useState local cada instancia tendría su propia copia y el contador
// del navbar quedaría desactualizado al agregar algo desde el detalle.
// useSyncExternalStore mantiene las tres sincronizadas sin necesidad de un
// Context provider en el layout.
const EMPTY: CartItem[] = [];

let items: CartItem[] = EMPTY;
let loading = true;
let error: string | null = null;
const listeners = new Set<() => void>();

// Snapshot inmutable: useSyncExternalStore compara por referencia, así que
// solo cambia cuando cambia el contenido de verdad.
type CartSnapshot = { items: CartItem[]; loading: boolean; error: string | null };

let snapshot: CartSnapshot = { items, loading, error };

function emit() {
  snapshot = { items, loading, error };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

async function loadItems(userId: string | null) {
  if (!userId) {
    items = EMPTY;
    loading = false;
    error = null;
    emit();
    return;
  }

  loading = true;
  error = null;
  emit();

  try {
    items = await cartService.getItems(userId);
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudo cargar el carrito.";
  } finally {
    loading = false;
    emit();
  }
}

export function useCart(userId: string | null) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void loadItems(userId);
  }, [userId]);

  const reload = useCallback(() => loadItems(userId), [userId]);

  const add = useCallback(
    async (productId: string, quantity = 1) => {
      if (!userId) return;
      await cartService.addItem(userId, productId, quantity);
      await loadItems(userId);
    },
    [userId],
  );

  const update = useCallback(
    async (itemId: string, quantity: number) => {
      await cartService.updateQuantity(itemId, quantity);
      await loadItems(userId);
    },
    [userId],
  );

  const remove = useCallback(
    async (itemId: string) => {
      await cartService.removeItem(itemId);
      await loadItems(userId);
    },
    [userId],
  );

  // Devuelve el id del pedido creado; propaga el error del RPC tal cual
  // para que la página lo muestre con el mensaje original de Postgres.
  // Pase lo que pase, recarga el carrito: si falló, el stock pudo haber
  // cambiado; si salió bien, el RPC ya lo vació y hay que reflejarlo.
  const checkout = useCallback(async (): Promise<string> => {
    if (!userId) throw new Error("Necesitas iniciar sesión para comprar.");
    try {
      return await orderService.checkout(userId);
    } finally {
      await loadItems(userId);
    }
  }, [userId]);

  // Subtotal con el precio ACTUAL del producto (el snapshot lo fija el RPC).
  // Los ítems con product null (inactivos) no suman: no se pueden comprar.
  const subtotal = state.items.reduce(
    (sum, item) => sum + (item.product ? item.product.price * item.quantity : 0),
    0,
  );
  const count = state.items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: state.items,
    loading: state.loading,
    error: state.error,
    subtotal,
    count,
    add,
    update,
    remove,
    checkout,
    reload,
  };
}
