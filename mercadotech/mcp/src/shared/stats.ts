import type { SupabaseClient } from "@supabase/supabase-js";

import * as categoryService from "@/services/category.service";
import * as productService from "@/services/product.service";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

/**
 * DERIVACIONES de agregados (lección 6 / decisión 6).
 *
 * El proyecto web NO tiene services de estadísticas: ninguna pantalla los
 * necesitaba, así que nunca se escribieron. La lección 6 es explícita sobre
 * qué hacer entonces: se DERIVA componiendo services existentes en
 * `mcp/src/shared/` y se documenta como derivación — jamás se agrega un
 * service nuevo al proyecto web solo porque el MCP lo pida.
 *
 * Todo lo de aquí es agregado puro: conteos, rangos y totales. CERO datos
 * personales — ni compradores, ni emails, ni teléfonos (decisión 4).
 */

/**
 * DERIVACIÓN: categorías con su conteo de productos activos.
 *
 * Compone `category.listCategories` + una `product.listActiveProducts` por
 * categoría, de la que solo se usa el `total` (que PostgREST calcula con
 * `count: "exact"`, sin traer las filas de más). Son 8 categorías en el seed:
 * 9 consultas baratas contra una vista materializada que nadie pidió.
 *
 * Cliente anon: `categories_select_all` y `products_select_active_or_own`
 * permiten ambas lecturas sin sesión.
 */
export async function listCategoriesWithCount(supabase: Client) {
  const categories = await categoryService.listCategories(supabase);

  return Promise.all(
    categories.map(async (category) => {
      const { total } = await productService.listActiveProducts(
        { categorySlug: category.slug },
        supabase,
      );
      return {
        id: category.id,
        nombre: category.name,
        slug: category.slug,
        productos_activos: total,
      };
    }),
  );
}

/**
 * DERIVACIÓN: los productos más vendidos, agregando `order_items`.
 *
 * ⚠️ CLIENTE ADMIN OBLIGATORIO. `order_items` solo tiene
 * `grant select ... to authenticated`, y sus tres políticas
 * (`order_items_select_buyer`, `_seller_own`, `_admin`) filtran por
 * `auth.uid()`: un cliente anon —que es lo que es el MCP, un proceso sin
 * sesión— no ve NINGUNA fila. Es la decisión 4 de la spec.
 *
 * Lectura directa a la tabla y no a un service porque no existe ninguno que
 * agregue ventas: `order.service` solo expone `getOrderById` y
 * `listMyOrders`, ambos por pedido/usuario. La tabla de la Fase 5.3 sanciona
 * explícitamente esta derivación ("+ top vendidos vía `order_items` con
 * admin").
 *
 * Se leen SOLO tres columnas: el snapshot del título, el id del producto y la
 * cantidad. Ni `order_id`, ni `seller_id`, ni nada que permita reconstruir
 * quién compró qué.
 */
async function getTopSellingProducts(admin: Client, limit: number) {
  const { data, error } = await admin
    .from("order_items")
    .select("product_id, title_snapshot, quantity");
  if (error) throw error;

  const byProduct = new Map<string, { titulo: string; unidades: number }>();
  for (const item of data) {
    // Agrupa por producto; si el producto fue borrado (product_id queda null
    // por el ON DELETE SET NULL) se agrupa por el título del snapshot, que es
    // la fuente de verdad histórica del pedido.
    const key = item.product_id ?? item.title_snapshot;
    const current = byProduct.get(key);
    if (current) current.unidades += item.quantity;
    else byProduct.set(key, { titulo: item.title_snapshot, unidades: item.quantity });
  }

  return [...byProduct.values()]
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, limit);
}

/**
 * DERIVACIÓN: estadísticas agregadas de la tienda.
 *
 * Compone `listCategoriesWithCount` (anon), `listActiveProducts` (anon, para
 * el total y para los extremos de precio vía el `sort` que el service ya
 * soporta) y `getTopSellingProducts` (admin). Ningún número de aquí sale de
 * una consulta de negocio nueva.
 */
export async function getStoreStats(
  anon: Client,
  admin: Client,
  topLimit: number,
) {
  const [categorias, todos, masBaratos, masCaros, topVendidos] =
    await Promise.all([
      listCategoriesWithCount(anon),
      productService.listActiveProducts({}, anon),
      productService.listActiveProducts({ sort: "precio_asc" }, anon),
      productService.listActiveProducts({ sort: "precio_desc" }, anon),
      getTopSellingProducts(admin, topLimit),
    ]);

  return {
    productos_activos: todos.total,
    categorias_totales: categorias.length,
    precio_minimo: masBaratos.items[0]?.price ?? null,
    precio_maximo: masCaros.items[0]?.price ?? null,
    moneda: "PEN",
    por_categoria: categorias,
    mas_vendidos: topVendidos,
  };
}
