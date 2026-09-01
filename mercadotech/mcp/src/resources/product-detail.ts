import { createContext } from "../context.js";
import { invalidInput } from "../lib/errors.js";
import { defineResourceTemplate, type RegisteredResourceDefinition } from "../lib/define-resource.js";
import { getProductDetail, listAllActiveProductSummaries } from "../shared/products.js";
import { jsonText } from "./_json.js";

/**
 * `mercadotech://products/{id}` — ResourceTemplate: MISMA función compartida
 * que la tool `get_product` (`getProductDetail`), para que ambos caminos
 * devuelvan exactamente la misma ficha (producto + imágenes + rating +
 * preguntas). Cliente ANON, igual que la tool.
 *
 * El callback `list` (patrón de ReadHub, pedido por la Fase 5.4) enumera una
 * entrada por producto activo real, para que `resources/list` muestre
 * instancias navegables en vez de solo el patrón `{id}` en abstracto.
 */
export const productDetailResource: RegisteredResourceDefinition = defineResourceTemplate({
  name: "product-detail",
  uriTemplate: "mercadotech://products/{id}",
  title: "Ficha de un producto",
  description:
    "Detalle completo de UN producto activo por su id: descripción, precio, " +
    "stock, condición, imágenes, rating y preguntas con sus respuestas. " +
    "Misma forma que la tool get_product.",
  list: async () => {
    const { anon } = createContext();
    const productos = await listAllActiveProductSummaries(anon);
    return {
      resources: productos.map((producto) => ({
        uri: `mercadotech://products/${producto.id}`,
        name: producto.titulo,
        description: `${producto.marca ?? "Sin marca"} — S/ ${producto.precio}`,
        mimeType: "application/json",
      })),
    };
  },
  read: async (uri, variables) => {
    const id = variables.id;
    if (typeof id !== "string" || id.length === 0) {
      throw invalidInput("falta el id del producto en la URI.");
    }

    const { anon } = createContext();
    const detail = await getProductDetail(id, anon);
    return { contents: [jsonText(uri.href, detail)] };
  },
});
