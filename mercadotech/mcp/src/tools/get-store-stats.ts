import { z } from "zod";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { jsonResult } from "../lib/tool-result.js";
import { getStoreStats } from "../shared/stats.js";

const DEFAULT_TOP = 5;

export const getStoreStatsTool = defineTool({
  name: "get_store_stats",
  description:
    'Da una foto general de la tienda: responde "¿qué tan grande es el ' +
    'catálogo, en qué rango de precios se mueve y qué es lo que más se ' +
    'vende?". Devuelve solo números agregados — cuántos productos activos ' +
    "hay, cuántos por categoría, el precio mínimo y máximo, y el ranking de " +
    "unidades vendidas. No devuelve ningún dato de compradores.",
  inputSchema: z.object({
    topLimit: z
      .number()
      .int()
      .min(1)
      .max(20)
      .optional()
      .describe(`Cuántos productos incluir en el ranking de más vendidos (por defecto ${DEFAULT_TOP}).`),
  }),
  // Cliente ANON + ADMIN (decisión 4). El grueso de las estadísticas sale de
  // tablas públicas y va con anon; SOLO el ranking de más vendidos necesita
  // admin, porque `order_items` tiene `grant select ... to authenticated` y
  // sus políticas (`order_items_select_buyer` / `_seller_own` / `_admin`)
  // filtran por `auth.uid()`: un proceso sin sesión no vería ninguna fila.
  // De esa tabla se leen tres columnas agregadas (product_id, title_snapshot,
  // quantity) — nunca order_id, buyer ni nada que identifique a una persona.
  handler: async (input) => {
    const { anon, admin } = createContext();
    const stats = await getStoreStats(anon, admin, input.topLimit ?? DEFAULT_TOP);
    return jsonResult(
      `MercadoTech: ${stats.productos_activos} productos activos en ${stats.categorias_totales} categorías.`,
      stats,
    );
  },
});
