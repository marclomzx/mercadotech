import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { RegisteredPromptDefinition } from "../lib/define-prompt.js";

import { compareProductsPrompt } from "./compare-products.js";
import { describeProductPrompt } from "./describe-product.js";
import { draftQuestionAnswerPrompt } from "./draft-question-answer.js";
import { generateFaqArticlePrompt } from "./generate-faq-article.js";
import { summarizeReviewsPrompt } from "./summarize-reviews.js";

/**
 * Registro central de Prompts MCP (lección 2: NO son Skills de Claude Code).
 * Agregar uno = un archivo + una línea aquí — mismo patrón que
 * `tools/index.ts` y `resources/index.ts`.
 */
export const ALL_PROMPTS: RegisteredPromptDefinition[] = [
  describeProductPrompt, //     describir_producto
  compareProductsPrompt, //     comparar_productos
  draftQuestionAnswerPrompt, // redactar_respuesta_pregunta
  summarizeReviewsPrompt, //    resumen_de_resenas
  generateFaqArticlePrompt, //  generar_articulo_faq
];

export function registerPrompts(server: McpServer): void {
  for (const prompt of ALL_PROMPTS) prompt.register(server);
}
