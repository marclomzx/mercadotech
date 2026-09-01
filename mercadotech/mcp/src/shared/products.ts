import type { SupabaseClient } from "@supabase/supabase-js";

import * as productService from "@/services/product.service";
import * as questionService from "@/services/question.service";
import * as reviewService from "@/services/review.service";
import type { Database } from "@/types/database";
import type { Product } from "@/types/product";

import { notFound } from "../lib/errors.js";

type Client = SupabaseClient<Database>;

/**
 * Derivaciones sobre productos (lección 6).
 *
 * Aquí NO hay lógica de negocio nueva: cada función compone llamadas a
 * `services/*` que ya existen. Vive en `shared/` porque la usan varias tools
 * y, desde la Fase 5.4, también los resources y prompts — de modo que el
 * detalle de un producto tenga UNA sola forma en todo el servidor.
 */

/**
 * ⚠️ DERIVACIÓN — `product.service.getProductsByIds` NO EXISTE.
 *
 * La spec de la sesión 5 lo da por existente (tabla "Estado de partida":
 * "`product.service.getProductsByIds` ya existe | insumo directo de
 * `compare_products`"), pero en el repo no está: `product.service.ts` exporta
 * `listActiveProducts`, `getProductById`, `getProductImages`, `registerView`,
 * `mapProductRow` y `PRODUCT_SELECT`, nada más.
 *
 * Siguiendo la lección 6 (y en vez de agregar un service nuevo al proyecto
 * web, que es exactamente lo que la lección prohíbe hacer "porque era más
 * corto"), se DERIVA componiendo `getProductById`: N ids → N lecturas en
 * paralelo, con el mismo mapeo, el mismo `image_url` resuelto y el mismo
 * cálculo de rating que cualquier otra pantalla del catálogo.
 *
 * El costo es N consultas en vez de una con `.in()`. Con el tope de 4 ids de
 * `compare_products` es irrelevante, y a cambio no se duplica ni una línea de
 * la forma de un Product. Si algún día hace falta para listas largas, el
 * lugar correcto es `product.service.ts`, no aquí.
 */
export async function getProductsByIds(
  ids: string[],
  supabase: Client,
): Promise<Product[]> {
  const found = await Promise.all(
    ids.map((id) => productService.getProductById(id, supabase)),
  );

  // Los ids que no existen (o que apuntan a un producto no visible con este
  // cliente) se reportan por nombre: es más útil que devolver la lista corta
  // y dejar que el modelo adivine cuál faltó.
  const missing = ids.filter((_, index) => found[index] === null);
  if (missing.length > 0) {
    throw notFound(`el/los producto(s) con id ${missing.join(", ")}`);
  }

  return found as Product[];
}

/** Vista compacta de un producto: lo que se muestra en un listado. */
export function toProductSummary(product: Product) {
  return {
    id: product.id,
    titulo: product.title,
    marca: product.brand,
    precio: product.price,
    moneda: "PEN",
    condicion: product.condition,
    stock: product.stock,
    categoria_id: product.category_id,
    rating_promedio: product.average_rating,
    total_resenas: product.review_count,
    imagen_url: product.image_url,
  };
}

/**
 * Detalle completo de un producto: producto + imágenes + rating + preguntas.
 *
 * DERIVACIÓN documentada: compone `getProductById`, `getProductImages`,
 * `review.getAverage` y `question.listByProduct`, los cuatro services que la
 * tabla de la Fase 5.3 asigna a la tool #2. La comparte la tool `get_product`
 * y —desde la 5.4— el resource `mercadotech://products/{id}`, para que ambos
 * devuelvan exactamente la misma estructura.
 *
 * Todo lo que lee es público (RLS: `products_select_active_or_own`,
 * `product_images_select_visible_product`, `reviews_select_all`,
 * `questions_select_all`), así que va con el cliente anon.
 */
export async function getProductDetail(productId: string, supabase: Client) {
  const product = await productService.getProductById(productId, supabase);
  if (!product) throw notFound(`el producto con id ${productId}`);

  const [images, rating, questions] = await Promise.all([
    productService.getProductImages(productId, supabase),
    reviewService.getAverage(productId, supabase),
    questionService.listByProduct(productId, supabase),
  ]);

  return {
    ...toProductSummary(product),
    descripcion: product.description,
    activo: product.is_active,
    vendedor_id: product.seller_id,
    publicado: product.created_at,
    imagenes: images.map((image) => ({
      url: image.image_url,
      posicion: image.position,
    })),
    rating: { promedio: rating.average, total_resenas: rating.count },
    preguntas: questions.map((question) => ({
      pregunta: question.question,
      respuesta: question.answer,
      fecha: question.created_at,
    })),
  };
}
