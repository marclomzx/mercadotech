import { InferenceClient } from "@huggingface/inference";

import {
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_DEFAULT,
  MAX_EMBEDDING_INPUT_CHARS,
} from "@/lib/constants/ai";

// Generación de embeddings: el ÚNICO lugar del proyecto que usa un SDK en vez
// de fetch, y está justificado por el proveedor.
//
// Hugging Face expone dos superficies distintas:
//   - El router OpenAI-compatible (router.huggingface.co/v1/*), que solo
//     implementa el catálogo de OpenAI. La tarea `feature-extraction` NO
//     existe ahí, así que un fetch directo para vectorizar FALLA.
//   - La API de inferencia con enrutado por proveedor, donde esa tarea sí
//     existe y a la que se llega con InferenceClient.featureExtraction.
// Por eso embeddings va por SDK y chat (lib/ai/completion.ts) va por fetch.
// Consecuencia práctica: son dos vías independientes y pueden fallar por
// separado — los mensajes de error dicen cuál de las dos se rompió.

function getToken(): string {
  const token = process.env.HUGGINGFACEHUB_API_TOKEN;
  if (!token) {
    throw new Error(
      "HUGGINGFACEHUB_API_TOKEN no está configurada. Agrégala a .env.local " +
        "(token de tipo Read de huggingface.co/settings/tokens) y reinicia el servidor.",
    );
  }
  return token;
}

function getModel(): string {
  return process.env.HUGGINGFACE_EMBEDDING_MODEL || EMBEDDING_MODEL_DEFAULT;
}

/**
 * Convierte un texto en su embedding: un vector plano de 384 números.
 *
 * El texto se trunca a MAX_EMBEDDING_INPUT_CHARS antes de enviarlo, porque
 * MiniLM descarta el excedente en silencio (ver lib/constants/ai.ts).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("No se puede generar un embedding de un texto vacío.");
  }

  const model = getModel();
  const client = new InferenceClient(getToken());

  let result: unknown;
  try {
    result = await client.featureExtraction({
      model,
      inputs: trimmed.slice(0, MAX_EMBEDDING_INPUT_CHARS),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Errores accionables: el alumno tiene que poder diagnosticar sin leer
    // este archivo. Se distingue token inválido de modelo caído porque la
    // solución es completamente distinta en cada caso.
    if (/401|unauthorized|invalid credentials/i.test(message)) {
      throw new Error(
        "Hugging Face rechazó el token al generar el embedding (401). " +
          "Revisa HUGGINGFACEHUB_API_TOKEN en .env.local: debe empezar con hf_ " +
          "y no estar revocado.",
      );
    }
    if (/429|rate limit|quota/i.test(message)) {
      throw new Error(
        "Se agotó la cuota gratuita de Hugging Face al generar embeddings (429). " +
          "Revisa el consumo en huggingface.co → Settings → Billing.",
      );
    }
    if (/not supported|no provider|not found/i.test(message)) {
      throw new Error(
        `El modelo de embeddings "${model}" no está disponible en tu cuenta de ` +
          "Hugging Face. Ojo: reemplazarlo exige un modelo de 384 dimensiones, " +
          "o una migración de la columna vector(384).",
      );
    }
    throw new Error(`Falló la generación del embedding con "${model}": ${message}`);
  }

  // Validación de forma. all-MiniLM-L6-v2 devuelve un array plano de 384
  // números, pero otros modelos devuelven una matriz por token (number[][]).
  // Guardar cualquier otra cosa produciría una fila corrupta que solo se
  // descubriría al buscar; mejor fallar acá con un mensaje claro.
  if (!Array.isArray(result) || result.some((value) => typeof value !== "number")) {
    throw new Error(
      `El modelo "${model}" no devolvió un vector numérico plano. ` +
        "Este proyecto espera un array de números (no una matriz por token).",
    );
  }

  const vector = result as number[];
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `El modelo "${model}" devolvió un vector de ${vector.length} dimensiones, ` +
        `pero la columna embedding es vector(${EMBEDDING_DIMENSIONS}). ` +
        "Cambiar de dimensión exige migrar la tabla y recrear índice y función.",
    );
  }

  return vector;
}

// ============================================================
// Armado del texto a vectorizar
// ============================================================
//
// Secciones etiquetadas y ORDENADAS por densidad semántica: lo que mejor
// identifica a la fuente va primero y la prosa larga al final. Si el truncado
// de MiniLM entra en acción, se lleva lo menos importante.
//
// Las etiquetas ("Título:", "Marca:") no son decorativas: le dan al modelo de
// embeddings señales de qué es cada cosa, y mejoran el emparejamiento frente
// a un texto plano concatenado.

function joinSections(sections: (string | null)[]): string {
  return sections
    .filter((section): section is string => Boolean(section))
    .join("\n")
    .slice(0, MAX_EMBEDDING_INPUT_CHARS);
}

type ProductLike = {
  title: string;
  description: string | null;
  brand: string | null;
  condition: string;
};

/**
 * Texto a vectorizar de un producto. La categoría llega por separado porque
 * en la tabla solo está el category_id: la resuelve el caller.
 */
export function buildProductEmbeddingText(
  product: ProductLike,
  categoryName: string | null,
): string {
  return joinSections([
    `Título: ${product.title}`,
    product.brand ? `Marca: ${product.brand}` : null,
    categoryName ? `Categoría: ${categoryName}` : null,
    `Condición: ${product.condition}`,
    // La descripción va última a propósito: es lo más largo y lo menos
    // determinante para identificar el producto.
    product.description ? `Descripción: ${product.description}` : null,
  ]);
}

type SupportArticleLike = {
  title: string;
  content: string;
  category: string | null;
};

/**
 * Texto a vectorizar de un artículo de la FAQ. El título suele ser la
 * pregunta literal del usuario ("¿Cómo devuelvo un producto?"), así que es la
 * señal más valiosa y va primero.
 */
export function buildSupportArticleEmbeddingText(article: SupportArticleLike): string {
  return joinSections([
    `Título: ${article.title}`,
    article.category ? `Categoría: ${article.category}` : null,
    `Contenido: ${article.content}`,
  ]);
}
