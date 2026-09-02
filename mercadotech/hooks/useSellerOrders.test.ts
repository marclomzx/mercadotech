import { describe, expect, it } from "vitest";

import { ORDER_STATUS_FLOW } from "@/lib/constants/orders";
import type { OrderStatus } from "@/lib/constants/roles";
import { canMove } from "@/hooks/useSellerOrders";

// La ÚNICA regla de negocio que el proyecto asigna a un hook (CLAUDE.md: la
// secuencia del kanban vive acá, no en seller.service). `canMove` es una
// función de módulo pura, así que se prueba directo: sin React, sin
// renderHook, sin DOM.

describe("canMove — pasos válidos del flujo", () => {
  it("acepta cada paso adelante del ORDER_STATUS_FLOW real", () => {
    const steps = ORDER_STATUS_FLOW.slice(0, -1).map(
      (from, index) => [from, ORDER_STATUS_FLOW[index + 1]] as const,
    );

    // pendiente→pagado, pagado→enviado, enviado→entregado
    expect(steps).toHaveLength(3);
    for (const [from, to] of steps) {
      expect(canMove(from, to)).toBe(true);
    }
  });
});

describe("canMove — saltos y retrocesos", () => {
  it("rechaza saltarse un paso", () => {
    expect(canMove("pendiente", "enviado")).toBe(false);
    expect(canMove("pendiente", "entregado")).toBe(false);
    expect(canMove("pagado", "entregado")).toBe(false);
  });

  it("rechaza retroceder, aunque la RLS lo aceptaría", () => {
    expect(canMove("entregado", "enviado")).toBe(false);
    expect(canMove("enviado", "pagado")).toBe(false);
    expect(canMove("pagado", "pendiente")).toBe(false);
  });

  it("rechaza quedarse en el mismo estado", () => {
    for (const status of ORDER_STATUS_FLOW) {
      expect(canMove(status, status)).toBe(false);
    }
  });

  it("rechaza avanzar más allá del último estado", () => {
    const last = ORDER_STATUS_FLOW[ORDER_STATUS_FLOW.length - 1];
    expect(last).toBe("entregado");
    expect(canMove(last, "cancelado")).toBe(false);
  });
});

describe("canMove — 'cancelado' y estados desconocidos", () => {
  it("'cancelado' no es destino alcanzable desde ningún estado del flujo", () => {
    for (const status of ORDER_STATUS_FLOW) {
      expect(canMove(status, "cancelado")).toBe(false);
    }
  });

  it("un pedido 'cancelado' no se reactiva hacia ningún estado", () => {
    for (const status of ORDER_STATUS_FLOW) {
      expect(canMove("cancelado", status)).toBe(false);
    }
    expect(canMove("cancelado", "cancelado")).toBe(false);
  });

  it("un estado desconocido se rechaza como origen y como destino", () => {
    const unknown = "reembolsado" as OrderStatus;

    expect(canMove(unknown, "pagado")).toBe(false);
    expect(canMove("pagado", unknown)).toBe(false);
    expect(canMove(unknown, unknown)).toBe(false);
  });
});
