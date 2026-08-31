import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { Question } from "@/types/question";

type Client = SupabaseClient<Database>;

export async function listByProduct(
  productId: string,
  supabase: Client = createClient(),
): Promise<Question[]> {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .eq("product_id", productId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Política questions_insert_own exige auth.uid() = user_id — cualquier
// usuario autenticado puede preguntar, en cualquier producto.
export async function create(
  productId: string,
  userId: string,
  question: string,
  supabase: Client = createClient(),
): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .insert({ product_id: productId, user_id: userId, question })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Política questions_update_seller_answers exige que el caller sea el
// seller_id del producto de esta pregunta. No hay trigger en la BD que
// bloquee columnas ajenas a la respuesta (a diferencia de profiles.role),
// así que el payload se limita a propósito a answer/answered_at — defensa
// en profundidad, aunque el único punto de entrada (AnswerForm) tampoco
// ofrece editar nada más.
export async function answer(
  questionId: string,
  answerText: string,
  supabase: Client = createClient(),
): Promise<Question> {
  const { data, error } = await supabase
    .from("questions")
    .update({ answer: answerText, answered_at: new Date().toISOString() })
    .eq("id", questionId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
