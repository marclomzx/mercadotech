import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { RegisteredResourceDefinition } from "../lib/define-resource.js";

import { categoriesResource } from "./categories.js";
import { faqResource } from "./faq.js";
import { infoResource } from "./info.js";
import { productDetailResource } from "./product-detail.js";
import { productsResource } from "./products.js";
import { sellersResource } from "./sellers.js";
import { statsResource } from "./stats.js";

/**
 * Registro central de resources. Agregar uno = un archivo + una línea aquí.
 * Orden: el estático primero (info), luego los de la tabla de la Fase 5.4.
 */
export const ALL_RESOURCES: RegisteredResourceDefinition[] = [
  infoResource, //          mercadotech://info                — estático
  productsResource, //      mercadotech://products             — anon
  productDetailResource, // mercadotech://products/{id}        — anon · template
  categoriesResource, //    mercadotech://categories           — anon
  sellersResource, //       mercadotech://sellers/{sellerId}   — admin · template
  faqResource, //           mercadotech://faq                  — anon
  statsResource, //         mercadotech://stats                — anon + admin
];

export function registerResources(server: McpServer): void {
  for (const resource of ALL_RESOURCES) resource.register(server);
}
