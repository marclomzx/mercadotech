import { z } from "zod";

import { generateCompletion } from "@/lib/ai/completion";
import * as productService from "@/services/product.service";
import * as reviewService from "@/services/review.service";

import { createContext } from "../context.js";
import { defineTool } from "../lib/define-tool.js";
import { notFound } from "../lib/errors.js";
import { emptyResult, jsonResult } from "../lib/tool-result.js";

// Instrucciones locales de esta tool. NO van a lib/ai/prompts.ts: ese archivo
// es del proyecto web (asistentes de compras y soporte) y la regla es que el
// MCP no le agregue nada al proyecto. Aquí solo se le pide al modelo que
// resuma un texto que ya se le entrega — cero recuperación, cero negocio.
const SYSTEM_INSTRUCTIONS =
  "Eres un asistente que resume reseñas de compradores de un marketplace. " +
  "Resume ÚNICAMENTE a partir de las reseñas que te dan: no inventes " +
  "opiniones, defectos ni virtudes que nadie mencionó. Responde en español, " +
  "con un párrafo breve de conclusión y después dos listas: 'Pros' y " +
  "'Contras'. Si una reseña es la única que menciona algo, dilo.";

export const summarizeReviewsTool = defineTool({
  name: "summarize_reviews",
  description:
    "Resume en pros y contras lo que dicen los compradores reales de un " +
    'producto: responde "¿qué opina la gente que ya lo compró?" sin tener ' +
    "que leer reseña por reseña. Devuelve el resumen redactado junto al " +
    "promedio de estrellas y las reseñas originales. Si el producto no tiene " +
    "reseñas, lo dice en vez de inventar.",
  inputSchema: z.object({
    productId: z
      .string()
      .uuid()
      .describe("Identificador (UUID) del producto cuyas reseñas se quieren resumir."),
  }),
  // Cliente ANON: `reviews_select_all` concede SELECT de reseñas a anon —
  // son públicas, se ven en la página de producto sin iniciar sesión.
  //
  // Requiere HUGGINGFACEHUB_API_TOKEN (generateCompletion). Sin token, el
  // error accionable de lib/ai/completion.ts vuelve como error de tool.
  handler: async (input) => {
    const { anon } = createContext();

    const product = await productService.getProductById(input.productId, anon);
    if (!product) throw notFound(`el producto con id ${input.productId}`);

    const [reviews, average] = await Promise.all([
      reviewService.listByProduct(input.productId, anon),
      reviewService.getAverage(input.productId, anon),
    ]);

    // Sin reseñas no se llama al proveedor: no hay nada que resumir y una
    // llamada vacía solo gastaría cuota.
    if (reviews.length === 0) {
      return emptyResult(`reseñas para "${product.title}"`);
    }

    const reviewsText = reviews
      .map(
        (review, index) =>
          `Reseña ${index + 1} — ${review.rating}/5 estrellas: ` +
          `${review.comment ?? "(sin comentario escrito)"}`,
      )
      .join("\n");

    const completion = await generateCompletion(
      SYSTEM_INSTRUCTIONS,
      `Producto: ${product.title}\n\n${reviewsText}`,
    );

    return jsonResult(completion.text, {
      producto: { id: product.id, titulo: product.title },
      rating_promedio: average.average,
      total_resenas: average.count,
      resumen: completion.text,
      resenas: reviews.map((review) => ({
        estrellas: review.rating,
        comentario: review.comment,
        fecha: review.created_at,
      })),
      modelo: completion.model,
    });
  },
});
