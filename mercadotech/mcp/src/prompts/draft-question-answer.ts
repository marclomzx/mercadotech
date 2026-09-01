import { z } from "zod";

import { createContext } from "../context.js";
import { definePrompt, type RegisteredPromptDefinition } from "../lib/define-prompt.js";
import { getQuestionWithProduct } from "../shared/questions.js";
import { embeddedJson, textMessage } from "./_message.js";

/**
 * `redactar_respuesta_pregunta` — usa `getQuestionWithProduct`
 * (`shared/questions.ts`, derivación nueva de esta fase: no existe
 * `question.service.getById`). Cliente ANON: `questions_select_all` da
 * lectura pública, igual que `question.service.listByProduct`.
 */
export const draftQuestionAnswerPrompt: RegisteredPromptDefinition = definePrompt({
  name: "redactar_respuesta_pregunta",
  description:
    "Redacta un borrador de respuesta para el vendedor a una pregunta de un " +
    "comprador, con el contexto del producto — el vendedor lo revisa y " +
    "publica desde su panel; este servidor de solo lectura no la envía.",
  argsSchema: z.object({
    questionId: z.string().uuid().describe("Identificador (UUID) de la pregunta a responder."),
  }),
  handler: async ({ questionId }) => {
    const { anon } = createContext();
    const question = await getQuestionWithProduct(questionId, anon);

    return {
      description: `Borrador de respuesta para la pregunta sobre "${question.producto.titulo}".`,
      messages: [
        textMessage(
          [
            "Eres el asistente de un vendedor de MercadoTech. Con la " +
              "pregunta y el producto adjuntos abajo (como resource), " +
              "redacta un borrador de respuesta en español: directo, " +
              "cordial y tono comercial-honesto — el vendedor lo revisa " +
              "antes de publicarlo, así que puede ser conciso.",
            "",
            "Reglas que no puedes romper:",
            "- Responde SOLO con datos del producto adjunto (precio, stock, " +
              "condición, descripción). No inventes especificaciones, " +
              "garantías ni plazos de envío que no estén ahí.",
            "- Si la pregunta ya tiene una respuesta (campo respuesta no " +
              "nulo), NO la repitas como si fuera nueva: señala que ya fue " +
              "respondida y, si acaso, sugiere cómo mejorarla.",
            "- Si el producto no tiene el dato que pide la pregunta, dilo " +
              "con honestidad ('no tengo ese dato en la ficha') en vez de " +
              "adivinar.",
            "- Si la respuesta depende de reseñas de otros compradores, usa " +
              "la tool summarize_reviews antes de afirmar algo sobre eso.",
          ].join("\n"),
        ),
        // URI sintética, mismo criterio que comparar_productos: no existe un
        // resource mercadotech://questions/{id} registrado en resources/index.ts.
        embeddedJson(`mercadotech://ephemeral/questions/${questionId}`, question),
      ],
    };
  },
});
