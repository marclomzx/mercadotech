import { createContext } from "../context.js";
import { invalidInput } from "../lib/errors.js";
import { defineResourceTemplate, type RegisteredResourceDefinition } from "../lib/define-resource.js";
import { getSellerResource, listSellerProfiles } from "../shared/sellers.js";
import { jsonText } from "./_json.js";

/**
 * `mercadotech://sellers/{sellerId}` — ResourceTemplate. Cliente ADMIN
 * (decisión 5 de la spec): `profiles` no tiene SELECT público
 * (`profiles_select_own_or_admin`), así que con anon esta tabla es
 * invisible por completo para un proceso sin sesión.
 *
 * Expone SOLO `display_name` + productos activos. JAMÁS `phone` (la única
 * otra columna de `profiles` fuera de `id`/`role`/`avatar_path`) ni ningún
 * dato de contacto — ver `shared/sellers.ts` para el detalle de qué
 * columnas se seleccionan.
 */
export const sellersResource: RegisteredResourceDefinition = defineResourceTemplate({
  name: "sellers",
  uriTemplate: "mercadotech://sellers/{sellerId}",
  title: "Ficha pública de un vendedor",
  description:
    "Nombre de tienda y productos activos de un vendedor. NO expone " +
    "teléfono, email ni ningún otro dato de perfil — solo display_name y el " +
    "catálogo público del vendedor.",
  list: async () => {
    const { admin } = createContext();
    const sellers = await listSellerProfiles(admin);
    return {
      resources: sellers.map((seller) => ({
        uri: `mercadotech://sellers/${seller.id}`,
        name: seller.display_name ?? seller.id,
        description: `Productos activos de ${seller.display_name ?? "este vendedor"}.`,
        mimeType: "application/json",
      })),
    };
  },
  read: async (uri, variables) => {
    const sellerId = variables.sellerId;
    if (typeof sellerId !== "string" || sellerId.length === 0) {
      throw invalidInput("falta el sellerId en la URI.");
    }

    const { admin } = createContext();
    const seller = await getSellerResource(sellerId, admin);
    return { contents: [jsonText(uri.href, seller)] };
  },
});
