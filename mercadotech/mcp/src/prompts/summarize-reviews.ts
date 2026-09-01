import { z } from "zod";

import * as productService from "@/services/product.service";
import * as reviewService from "@/services/review.service";

import { createContext } from "../context.js";
import { notFound } from "../lib/errors.js";
import { definePrompt, type RegisteredPromptDefinition } from "../lib/define-prompt.js";
import { embeddedJson, textMessage } from "./_message.js";

/**
 * `resumen_de_resenas` — MISMOS services que la tool `summarize_reviews`:
 * `product.service.getProductById` + `review.service.listByProduct` +
 * `review.service.getAverage`. Cliente ANON: las reseñas son públicas
 * (`reviews_select_all`).
 *
 * Diferencia deliberada con la tool: la tool llama a `lib/ai/completion`
 * para generar el resumen ELLA MISMA (necesita `HUGGINGFACEHUB_API_TOKEN`);
 * este prompt es un formulario — deja el resumen en manos del cliente MCP
 * que lo invoque, sin depender del proveedor de IA del servidor.
 */
export const summarizeReviewsPrompt: RegisteredPromptDefinition = definePrompt({
  name: "resumen_de_resenas",
  description:
    "Extrae pros y contras según los compradores reales de un producto, a " +
    "partir de sus reseñas — para tener una versión ya redactada usa la " +
    "tool summarize_reviews.",
  argsSchema: z.object({
    productId: z
      .string()
      .uuid()
      .describe("Identificador (UUID) del producto cuyas reseñas se quieren resumir."),
  }),
  handler: async ({ productId }) => {
    const { anon } = createContext();

    const product = await productService.getProductById(productId, anon);
    if (!product) throw notFound(`el producto con id ${productId}`);

    const [reviews, average] = await Promise.all([
      reviewService.listByProduct(productId, anon),
      reviewService.getAverage(productId, anon),
    ]);

    const payload = {
      producto: { id: product.id, titulo: product.title },
      rating_promedio: average.average,
      total_resenas: average.count,
      resenas: reviews.map((review) => ({
        estrellas: review.rating,
        comentario: review.comment,
        fecha: review.created_at,
      })),
    };

    return {
      description: `Reseñas de "${product.title}" listas para resumir.`,
      messages: [
        textMessage(
          [
            "Eres un asistente que resume reseñas de compradores de " +
              "MercadoTech, un marketplace peruano de productos " +
              "tecnológicos. Con las reseñas adjuntas abajo (como resource), " +
              "escribe en español un párrafo breve de conclusión y luego " +
              "dos listas: 'Pros' y 'Contras'.",
            "",
            "Reglas que no puedes romper:",
            "- Resume ÚNICAMENTE a partir de las reseñas adjuntas: no " +
              "inventes opiniones, defectos ni virtudes que nadie mencionó.",
            "- Si solo una reseña menciona algo, dilo así ('según una " +
              "reseña...') en vez de generalizarlo como opinión de todos.",
            "- Si no hay reseñas (lista vacía), dilo con claridad — no " +
              "fabriques un resumen de la nada.",
          ].join("\n"),
        ),
        embeddedJson(`mercadotech://products/${productId}`, payload),
      ],
    };
  },
});
