import { z } from "zod";

import * as reviewService from "@/services/review.service";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { jsonResult } from "../lib/tool-result.js";
import { getProductsByIds } from "../shared/products.js";

export const compareProductsTool = defineTool({
  name: "compare_products",
  description:
    "Pone dos a cuatro productos lado a lado para decidir entre ellos: " +
    'responde "¿cuál de estos me conviene?". Devuelve, para cada uno, ' +
    "precio, marca, condición, stock, valoración de los compradores y su " +
    "descripción, más el más barato y el mejor valorado del grupo. Necesita " +
    "los ids: consíguelos antes con search_products o " +
    "semantic_search_products.",
  inputSchema: z.object({
    productIds: z
      .array(z.string().uuid())
      .min(2)
      .max(4)
      .describe(
        "Entre 2 y 4 identificadores (UUID) de producto. Compara productos " +
          "comparables (dos laptops, dos teclados); mezclar categorías " +
          "distintas da una tabla que no ayuda a decidir.",
      ),
  }),
  // Cliente ANON: productos y reseñas son públicos
  // (`products_select_active_or_own`, `reviews_select_all`).
  handler: async (input) => {
    const { anon } = createContext();

    // getProductsByIds es una DERIVACIÓN de shared/products.ts, no un service:
    // `product.service.getProductsByIds` no existe en el repo pese a lo que
    // dice la spec. El porqué y el cómo, documentados en ese archivo.
    const products = await getProductsByIds(input.productIds, anon);

    const ratings = await Promise.all(
      products.map((product) => reviewService.getAverage(product.id, anon)),
    );

    const comparativa = products.map((product, index) => ({
      id: product.id,
      titulo: product.title,
      marca: product.brand,
      precio: product.price,
      moneda: "PEN",
      condicion: product.condition,
      stock: product.stock,
      disponible: product.stock > 0,
      rating_promedio: ratings[index].count > 0 ? ratings[index].average : null,
      total_resenas: ratings[index].count,
      descripcion: product.description,
    }));

    // Los dos "ganadores" son lecturas del mismo arreglo, no criterios nuevos:
    // el más barato y el mejor valorado. Cualquier otra recomendación es
    // trabajo del modelo, con estos datos delante.
    const masBarato = [...comparativa].sort((a, b) => a.precio - b.precio)[0];
    const mejorValorado = [...comparativa]
      .filter((item) => item.rating_promedio !== null)
      .sort((a, b) => (b.rating_promedio ?? 0) - (a.rating_promedio ?? 0))[0];

    return jsonResult(`Comparación de ${comparativa.length} productos.`, {
      productos: comparativa,
      mas_barato: { id: masBarato.id, titulo: masBarato.titulo, precio: masBarato.precio },
      mejor_valorado: mejorValorado
        ? {
            id: mejorValorado.id,
            titulo: mejorValorado.titulo,
            rating_promedio: mejorValorado.rating_promedio,
          }
        : null,
    });
  },
});
