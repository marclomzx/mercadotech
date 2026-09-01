import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { RegisteredToolDefinition } from "../lib/define-tool.js";

import { askAssistantTool } from "./ask-assistant.js";
import { compareProductsTool } from "./compare-products.js";
import { findRelatedProductsTool } from "./find-related-products.js";
import { getOrderStatusTool } from "./get-order-status.js";
import { getProductTool } from "./get-product.js";
import { getStoreStatsTool } from "./get-store-stats.js";
import { listCategoriesTool } from "./list-categories.js";
import { searchProductsTool } from "./search-products.js";
import { semanticSearchProductsTool } from "./semantic-search-products.js";
import { summarizeReviewsTool } from "./summarize-reviews.js";

/**
 * Registro central de tools. Agregar una tool = un archivo + una línea aquí.
 * El orden es el de la tabla de la Fase 5.3.
 */
export const ALL_TOOLS: RegisteredToolDefinition[] = [
  searchProductsTool, //           1 · anon
  getProductTool, //               2 · anon
  listCategoriesTool, //           3 · anon
  semanticSearchProductsTool, //   4 · admin (knowledge_embeddings) · HF
  askAssistantTool, //             5 · admin (knowledge_embeddings) · HF
  compareProductsTool, //          6 · anon
  findRelatedProductsTool, //      7 · admin (knowledge_embeddings) · HF
  summarizeReviewsTool, //         8 · anon · HF
  getStoreStatsTool, //            9 · anon + admin (order_items)
  getOrderStatusTool, //          10 · admin (orders / order_items)
];

export function registerTools(server: McpServer): void {
  for (const tool of ALL_TOOLS) tool.register(server);
}
