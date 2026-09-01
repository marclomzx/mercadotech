import { createContext } from "../context.js";
import { defineResource, type RegisteredResourceDefinition } from "../lib/define-resource.js";
import { listPublishedArticles } from "../shared/faq.js";
import { jsonText } from "./_json.js";

/**
 * `mercadotech://faq` — artículos de soporte publicados (el seed trae 10).
 * Cliente ANON: son públicos (`support_articles_select_published_or_admin`
 * ya filtra a solo `is_published`, ver `shared/faq.ts`).
 */
export const faqResource: RegisteredResourceDefinition = defineResource({
  name: "faq",
  uri: "mercadotech://faq",
  title: "Artículos de soporte (FAQ)",
  description:
    "Los artículos de soporte publicados de MercadoTech (envíos, pagos, " +
    "devoluciones, cuenta). Es la misma base de conocimiento que usa " +
    "ask_assistant en modo soporte.",
  read: async (uri) => {
    const { anon } = createContext();
    const articulos = await listPublishedArticles(anon);
    return { contents: [jsonText(uri.href, { total: articulos.length, articulos })] };
  },
});
