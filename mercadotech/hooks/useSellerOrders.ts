"use client";

import { useCallback, useEffect, useState } from "react";

import { ORDER_STATUS_FLOW } from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";
import * as sellerService from "@/services/seller.service";
import type { SellerOrder } from "@/types/order";

// ÚNICA regla de negocio que la spec asigna explícitamente a un hook: la RLS
// permite poner pagado/enviado/entregado pero NO valida la secuencia
// (aceptaría entregado → pagado, o pendiente → entregado saltando pasos).
// Solo se admite avanzar exactamente un paso en ORDER_STATUS_FLOW.
// 'cancelado' no está en el FLOW, así que indexOf devuelve -1 y cualquier
// movimiento hacia/desde esa columna queda rechazado sin tocar la red.
export function canMove(from: OrderStatus, to: OrderStatus): boolean {
  const fromIndex = ORDER_STATUS_FLOW.indexOf(from);
  const toIndex = ORDER_STATUS_FLOW.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return false;
  return toIndex === fromIndex + 1;
}

export function useSellerOrders(sellerId: string | null) {
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(() => {
    if (!sellerId) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    sellerService
      .listMyOrders(sellerId)
      .then(setOrders)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar los pedidos.");
      })
      .finally(() => setLoading(false));
  }, [sellerId]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Actualización optimista: mueve la tarjeta en el estado local, llama al
  // service y revierte si falla (RLS, red). Las transiciones inválidas se
  // rechazan ANTES, sin llegar al service.
  const move = useCallback(
    async (orderId: string, toStatus: OrderStatus) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) return;

      if (!canMove(order.status, toStatus)) {
        throw new Error(
          `No puedes mover un pedido de "${order.status}" a "${toStatus}": solo se avanza un paso a la vez.`,
        );
      }

      const previous = orders;
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: toStatus } : o)),
      );

      try {
        await sellerService.updateOrderStatus(orderId, toStatus);
      } catch (err) {
        setOrders(previous);
        throw err;
      }
    },
    [orders],
  );

  return { orders, loading, error, move, retry: fetchOrders };
}
