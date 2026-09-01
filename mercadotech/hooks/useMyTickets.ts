"use client";

import { useCallback, useEffect, useState } from "react";

import * as ticketService from "@/services/ticket.service";
import type { Ticket } from "@/types/ticket";

// Lista de tickets del usuario (sección "Mis tickets" en /soporte). Mismo
// patrón que useOrders — solo lectura.
export function useMyTickets(userId: string | null) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(() => {
    if (!userId) {
      setTickets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    ticketService
      .listMine(userId)
      .then(setTickets)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "No se pudieron cargar tus tickets.");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  return { tickets, loading, error, retry: fetchTickets };
}
