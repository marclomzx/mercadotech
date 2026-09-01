import { z } from "zod";

import * as orderService from "@/services/order.service";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { notFound } from "../lib/errors.js";
import { jsonResult } from "../lib/tool-result.js";

export const getOrderStatusTool = defineTool({
  name: "get_order_status",
  description:
    'Consulta en qué va un pedido a partir de su número: responde "¿ya me lo ' +
    'enviaron?", "¿qué pedí en este pedido?". Devuelve el estado ' +
    "(pendiente, pagado, enviado, entregado o cancelado), la fecha, el total " +
    "y los productos con el precio que tenían al comprarlos. NO devuelve " +
    "ningún dato del comprador: ni nombre, ni correo, ni teléfono, ni " +
    "dirección.",
  inputSchema: z.object({
    orderId: z
      .string()
      .uuid()
      .describe("Número (UUID) del pedido, tal como aparece en el correo de confirmación."),
  }),
  // ⚠️ CLIENTE ADMIN (decisión 4). Las tres políticas de SELECT sobre `orders`
  // —`orders_select_buyer` (buyer_id = auth.uid()),
  // `orders_select_seller_with_items` y `orders_select_admin`— exigen una
  // sesión; el MCP no la tiene, así que con anon `getOrderById` devolvería
  // siempre null. Lo mismo vale para `order_items`, que solo concede SELECT a
  // `authenticated`.
  //
  // ⚠️ EN PRODUCCIÓN ESTA TOOL EXIGIRÍA AUTENTICACIÓN DEL COMPRADOR. Tal como
  // está, cualquiera que adivine (o consiga) un UUID de pedido puede ver su
  // estado: el cliente admin bypassa la RLS que normalmente lo impediría. Es
  // aceptable en este proyecto de curso —con una base local y datos de
  // semilla— y NO lo es en un despliegue real, donde el servidor MCP tendría
  // que recibir el token del comprador y usar un cliente de sesión en vez del
  // de servicio.
  //
  // La salida está deliberadamente recortada por eso mismo: estado, fecha,
  // total e ítems (snapshots de título y precio). `buyer_id` y cualquier dato
  // personal se quedan fuera aunque el cliente admin los tenga delante.
  //
  // La reutiliza el agente de voz de la sesión 8: si cambia su forma, ese
  // agente cambia con ella.
  handler: async (input) => {
    const { admin } = createContext();

    const result = await orderService.getOrderById(input.orderId, admin);
    if (!result) throw notFound(`el pedido con id ${input.orderId}`);

    const { order, items } = result;

    return jsonResult(
      `El pedido está "${order.status}" (${items.length} producto(s), S/ ${order.total}).`,
      {
        pedido_id: order.id,
        estado: order.status,
        fecha: order.created_at,
        total: order.total,
        moneda: "PEN",
        items: items.map((item) => ({
          titulo: item.title_snapshot,
          precio_unitario: item.price_snapshot,
          cantidad: item.quantity,
          producto_id: item.product_id,
        })),
      },
    );
  },
});
