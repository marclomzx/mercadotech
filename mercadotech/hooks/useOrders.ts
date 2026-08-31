"use client";

import { useCallback, useEffect, useState } from "react";

import * as orderService from "@/services/order.service";
import type { Order, OrderItem } from "@/types/order";

// Lista de pedidos del comprador (/pedidos).
export function useOrders(userId: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(() => {
    if (!userId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    orderService
      .listMyOrders(userId)
      .then(setOrders)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar tus pedidos.");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, retry: fetchOrders };
}

// Detalle de un pedido (/pedidos/[id]) + cancelación.
export function useOrder(orderId: string) {
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrder = useCallback(() => {
    setLoading(true);
    setError(null);
    orderService
      .getOrderById(orderId)
      .then((result) => {
        // null = no existe o la RLS no deja verlo (pedido de otro
        // comprador). La UI lo trata igual: "no encontrado", sin filtrar
        // información sobre si existe o no.
        setOrder(result?.order ?? null);
        setItems(result?.items ?? []);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudo cargar el pedido.");
      })
      .finally(() => setLoading(false));
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const cancel = useCallback(async () => {
    const updated = await orderService.cancelIfPending(orderId);
    if (!updated) {
      // El pedido ya no estaba 'pendiente' (lo avanzó el vendedor entre
      // medio). Se recarga para mostrar el estado real.
      fetchOrder();
      throw new Error("Este pedido ya no se puede cancelar.");
    }
    setOrder(updated);
  }, [orderId, fetchOrder]);

  return { order, items, loading, error, cancel, retry: fetchOrder };
}
