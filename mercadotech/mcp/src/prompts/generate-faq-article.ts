import { z } from "zod";

import { createContext } from "../context.js";
import { definePrompt, type RegisteredPromptDefinition } from "../lib/define-prompt.js";
import { listPublishedArticles } from "../shared/faq.js";
import { embeddedJson, textMessage } from "./_message.js";

/**
 * `generar_articulo_faq` — MISMA función compartida que el resource
 * `mercadotech://faq` (`listPublishedArticles`, `shared/faq.ts`). Embebe los
 * 10 artículos publicados como referencia de estilo — el prompt NO reimplementa
 * el pipeline RAG de `ask_assistant`: solo redacta un borrador nuevo, no
 * responde preguntas con las fuentes existentes.
 */
export const generateFaqArticlePrompt: RegisteredPromptDefinition = definePrompt({
  name: "generar_articulo_faq",
  description:
    "Redacta el borrador de un artículo de soporte nuevo sobre un tema, con " +
    "el mismo estilo y estructura que los artículos publicados existentes.",
  argsSchema: z.object({
    tema: z
      .string()
      .min(3)
      .describe("El tema del artículo nuevo (ej. 'garantía de productos reacondicionados')."),
  }),
  handler: async ({ tema }) => {
    const { anon } = createContext();
    const articulos = await listPublishedArticles(anon);

    return {
      description: `Borrador de artículo de soporte sobre "${tema}".`,
      messages: [
        textMessage(
          [
            "Eres redactor de la base de conocimiento (FAQ) de MercadoTech, " +
              "un marketplace peruano de productos tecnológicos. Abajo (como " +
              "resource) van los artículos de soporte YA PUBLICADOS: úsalos " +
              "solo como referencia de estilo y estructura (longitud, tono, " +
              "categorías que existen, cómo cierran invitando a contactar " +
              "soporte).",
            "",
            `Redacta en español un borrador de artículo NUEVO sobre: "${tema}".`,
            "",
            "Reglas que no puedes romper:",
            "- No inventes políticas, plazos, costos ni procedimientos de " +
              "MercadoTech que no estén respaldados por los artículos " +
              "adjuntos o por información que el propio tema ya deja clara " +
              "(ej. una definición general). Ante la duda de una política " +
              "concreta, escribe el borrador con un aviso explícito de " +
              "'[confirmar con el equipo]' en vez de afirmarla.",
            "- Reutiliza una de las categorías que ya existen en los " +
              "artículos adjuntos si el tema encaja en alguna (envíos, " +
              "pagos, devoluciones, cuenta); si no encaja en ninguna, dilo.",
            "- Antes de asegurar que un tema NO está cubierto todavía, puede " +
              "convenir revisar con la tool ask_assistant en modo 'soporte' " +
              "si ya existe una respuesta parecida — para no duplicar " +
              "contenido.",
          ].join("\n"),
        ),
        embeddedJson("mercadotech://faq", { total: articulos.length, articulos }),
      ],
    };
  },
});
