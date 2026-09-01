import { z } from "zod";

import { createContext } from "../context.js";
import { invalidInput } from "../lib/errors.js";
import { definePrompt, type RegisteredPromptDefinition } from "../lib/define-prompt.js";
import { compareProducts } from "../shared/products.js";
import { embeddedJson, textMessage } from "./_message.js";

/**
 * `comparar_productos` — MISMA función compartida que la tool
 * `compare_products` (`compareProducts` en `shared/products.ts`, subida a
 * `shared/` en esta fase precisamente para que el prompt no la reimplemente).
 *
 * `ids` llega como STRING separado por comas: los argumentos de un Prompt
 * MCP viajan siempre como string por protocolo (ver `lib/define-prompt.ts`),
 * a diferencia del array tipado que acepta la tool.
 */
export const compareProductsPrompt: RegisteredPromptDefinition = definePrompt({
  name: "comparar_productos",
  description:
    "Arma una tabla comparativa entre 2 y 4 productos y recomienda según " +
    "perfil de uso, a partir de datos reales (precio, condición, rating).",
  argsSchema: z.object({
    ids: z
      .string()
      .describe(
        "De 2 a 4 identificadores (UUID) de producto, separados por comas " +
          "(ej. 'id1,id2,id3'). Consíguelos con search_products.",
      ),
  }),
  handler: async ({ ids }) => {
    const productIds = ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    if (productIds.length < 2 || productIds.length > 4) {
      throw invalidInput(
        `se esperaban entre 2 y 4 ids separados por comas, llegaron ${productIds.length}.`,
      );
    }

    const { anon } = createContext();
    const comparativa = await compareProducts(productIds, anon);

    return {
      description: `Comparación de ${comparativa.length} productos lista para redactar.`,
      messages: [
        textMessage(
          [
            "Eres el asesor de compras de MercadoTech. Con los productos " +
              "adjuntos abajo (como resource), arma en español una tabla " +
              "comparativa y una recomendación breve por perfil de uso (ej. " +
              "'para oficina', 'para diseño', 'para el día a día').",
            "",
            "Reglas que no puedes romper:",
            "- Compara SOLO con los campos adjuntos: precio, condición, " +
              "stock, rating y descripción. No inventes specs que no estén.",
            "- Si un producto no tiene reseñas (rating_promedio en null), " +
              "dilo en vez de omitirlo o inventar un promedio.",
            "- Los precios están en soles peruanos (S/).",
            "- Si necesitas la ficha completa de alguno (imágenes, " +
              "preguntas de compradores), usa la tool get_product.",
          ].join("\n"),
        ),
        embeddedJson("mercadotech://compare", { productos: comparativa }),
      ],
    };
  },
});
