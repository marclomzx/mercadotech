import { defineResource, type RegisteredResourceDefinition } from "../lib/define-resource.js";
import { jsonText } from "./_json.js";

/**
 * Único resource ESTÁTICO del servidor: no toca Supabase, así que aparece en
 * `resources/list` incluso con la base de datos completamente caída — es la
 * ancla de la prueba de degradación de la Fase 5.4 ("info estático
 * presente"). Describe la plataforma y el mostrador para un cliente MCP que
 * los ve por primera vez.
 */
const INFO = {
  plataforma: "MercadoTech",
  descripcion:
    "Marketplace peruano de productos tecnológicos (laptops, smartphones, " +
    "componentes de PC, periféricos y accesorios) con catálogo público, " +
    "reseñas verificadas por compra, preguntas y respuestas por producto, " +
    "y asistencia por IA (asesor de compras y soporte) sobre el contenido " +
    "publicado de la plataforma.",
  moneda: "PEN",
  servidor_mcp: {
    nombre: "mercadotech",
    tipo: "SOLO LECTURA — ninguna tool ni resource muta datos",
    advertencia_privacidad:
      "Ninguna tool/resource expone datos privados: ni carritos, ni " +
      "favoritos, ni tickets de soporte, ni email/teléfono/rol de usuarios. " +
      "get_order_status y mercadotech://sellers/{id} son las únicas fuentes " +
      "con cliente admin, y ambas están recortadas a propósito.",
    capacidades: { tools: 10, resources: 7, prompts: 5 },
  },
  resources: [
    { uri: "mercadotech://info", que_es: "Esta descripción de la plataforma." },
    { uri: "mercadotech://products", que_es: "Resumen de todos los productos activos." },
    {
      uri: "mercadotech://products/{id}",
      que_es: "Ficha completa de un producto (template: enumera instancias reales).",
    },
    { uri: "mercadotech://categories", que_es: "Categorías con conteo de productos activos." },
    {
      uri: "mercadotech://sellers/{sellerId}",
      que_es:
        "Nombre de tienda y productos activos de un vendedor (template: " +
        "enumera instancias reales). Nunca expone teléfono ni email.",
    },
    { uri: "mercadotech://faq", que_es: "Artículos de soporte publicados." },
    { uri: "mercadotech://stats", que_es: "Estadísticas agregadas de la tienda." },
  ],
  prompts: [
    "describir_producto",
    "comparar_productos",
    "redactar_respuesta_pregunta",
    "resumen_de_resenas",
    "generar_articulo_faq",
  ],
  para_profundizar:
    "Las 10 tools (search_products, get_product, list_categories, " +
    "semantic_search_products, ask_assistant, compare_products, " +
    "find_related_products, summarize_reviews, get_store_stats, " +
    "get_order_status) cubren cada consulta puntual; los resources son para " +
    "leer contenido de un vistazo y los prompts para tareas de redacción " +
    "recurrentes con ese mismo contenido ya embebido.",
};

export const infoResource: RegisteredResourceDefinition = defineResource({
  name: "info",
  uri: "mercadotech://info",
  title: "Información de MercadoTech",
  description:
    "Qué es MercadoTech y qué ofrece este servidor MCP: capacidades, " +
    "resources, prompts y a qué tools recurrir para profundizar. Contenido " +
    "estático — no depende de Supabase.",
  read: (uri) => ({
    contents: [jsonText(uri.href, INFO)],
  }),
});
