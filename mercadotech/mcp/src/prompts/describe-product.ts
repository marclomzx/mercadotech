import { z } from "zod";

import { createContext } from "../context.js";
import { definePrompt, type RegisteredPromptDefinition } from "../lib/define-prompt.js";
import { getProductDetail } from "../shared/products.js";
import { embeddedJson, textMessage } from "./_message.js";

/**
 * `describir_producto` — MISMA función compartida que la tool `get_product`
 * y el resource `mercadotech://products/{id}` (`getProductDetail` en
 * `shared/products.ts`): el prompt no vuelve a consultar Supabase a su
 * manera, solo redacta instrucciones alrededor de ese mismo JSON.
 */
export const describeProductPrompt: RegisteredPromptDefinition = definePrompt({
  name: "describir_producto",
  description:
    "Redacta una ficha de venta atractiva y FIEL a los datos reales de un " +
    "producto (precio, stock, condición) — para publicar o mejorar su " +
    "descripción en el catálogo.",
  argsSchema: z.object({
    productId: z.string().uuid().describe("Identificador (UUID) del producto a describir."),
  }),
  handler: async ({ productId }) => {
    const { anon } = createContext();
    const detail = await getProductDetail(productId, anon);

    return {
      description: `Ficha de "${detail.titulo}" lista para redactar.`,
      messages: [
        textMessage(
          [
            "Eres redactor comercial de MercadoTech, un marketplace peruano " +
              "de productos tecnológicos. Con el producto adjunto abajo " +
              "(como resource), redacta una ficha de venta en español: " +
              "atractiva, pero honesta — tono comercial-honesto de la " +
              "plataforma, nunca exagerado ni engañoso.",
            "",
            "Reglas que no puedes romper:",
            "- No inventes especificaciones, marca, garantía ni stock que no " +
              "estén en los datos adjuntos.",
            '- Si el stock es 0, dilo con naturalidad ("agotado por ahora"); ' +
              "nunca lo omitas ni des a entender que hay disponibilidad.",
            "- Los precios están en soles peruanos (S/); no los conviertas ni " +
              "los redondees.",
            "- Si algún dato falta (marca, descripción), trabaja solo con lo " +
              "que hay — no lo rellenes por tu cuenta.",
            "- Si necesitas más contexto para decidir el enfoque (qué opinan " +
              "los compradores, cómo se compara con otro producto), usa las " +
              "tools summarize_reviews o compare_products de este mismo " +
              "servidor en vez de asumir nada.",
          ].join("\n"),
        ),
        embeddedJson(`mercadotech://products/${productId}`, detail),
      ],
    };
  },
});
