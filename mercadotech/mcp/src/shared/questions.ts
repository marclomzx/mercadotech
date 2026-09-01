import type { SupabaseClient } from "@supabase/supabase-js";

import * as productService from "@/services/product.service";
import type { Database } from "@/types/database";

import { notFound } from "../lib/errors.js";
import { toProductSummary } from "./products.js";

type Client = SupabaseClient<Database>;

/**
 * DERIVACIÓN — `question.service.ts` solo expone `listByProduct`, `create`
 * y `answer` (Fase 3.6): ninguna pantalla necesitó leer UNA pregunta suelta
 * por id, así que no existe `getById`. Se deriva una lectura puntual con el
 * mismo cliente y la misma política pública (`questions_select_all`) que ya
 * usa `listByProduct` — no hace falta admin.
 *
 * No se expone `user_id` (quien preguntó): igual que `getProductDetail` en
 * `shared/products.ts`, que tampoco lo incluye en `preguntas[]` — es dato de
 * un comprador, y ninguna tool/resource de esta sesión expone identidad de
 * compradores.
 */
export async function getQuestionWithProduct(questionId: string, supabase: Client) {
  const { data, error } = await supabase
    .from("questions")
    .select("id, product_id, question, answer, answered_at, created_at")
    .eq("id", questionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound(`la pregunta con id ${questionId}`);

  const product = await productService.getProductById(data.product_id, supabase);
  if (!product) throw notFound(`el producto de la pregunta ${questionId}`);

  return {
    id: data.id,
    pregunta: data.question,
    respuesta: data.answer,
    respondida_el: data.answered_at,
    creada_el: data.created_at,
    producto: {
      ...toProductSummary(product),
      descripcion: product.description,
    },
  };
}
