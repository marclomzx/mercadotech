/**
 * Indexación completa: genera las fichas (embeddings) de TODOS los productos
 * activos y artículos de soporte publicados.
 *
 *   npx tsx scripts/index-all.ts
 *
 * ¿Cuándo se corre?
 *
 *   - Una vez al principio, para fichar el seed entero (24 fichas).
 *   - **Cada vez que el admin edita artículos de soporte por SQL.** Los
 *     productos se refichan solos (el trigger de useProductForm/
 *     useSellerProducts dispara /api/v1/reindex al publicar o editar), pero
 *     los support_articles NO tienen UI de edición en este proyecto: se
 *     tocan directo en la base, y nada dispara su reindexado. Este script es
 *     la única vía.
 *   - Como plan B cuando el trigger falló (Hugging Face caído al publicar):
 *     el warn de la consola del servidor lo sugiere explícitamente.
 *
 * Es idempotente: el upsert sobre unique(source_type, source_id, chunk_index)
 * actualiza las fichas existentes en vez de duplicarlas, así que se puede
 * correr las veces que haga falta.
 *
 * Corre FUERA del navegador (node, vía tsx), que es lo que le permite usar el
 * cliente admin: la service role key jamás debe viajar al cliente.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";
import * as embeddingService from "@/services/embedding.service";

// Node 20 no expone `WebSocket` global (llegó como global estable en Node 22),
// y supabase-js LANZA al construir el cliente si no lo encuentra — aunque
// solo se vayan a usar llamadas REST, como es el caso acá.
//
// Este script no usa realtime en ningún momento, así que se define un stub
// que satisface la comprobación y falla ruidosamente si alguien intentara
// suscribirse de verdad. La alternativa sería exigir Node 22 o agregar la
// dependencia `ws` solo para esto. En el navegador y en el Route Handler no
// hace falta nada de esto: ahí WebSocket existe.
if (typeof globalThis.WebSocket === "undefined") {
  class UnsupportedWebSocket {
    constructor() {
      throw new Error(
        "scripts/index-all.ts no usa realtime. Si necesitas suscripciones, " +
          "corre con Node 22+ (que trae WebSocket nativo).",
      );
    }
  }
  (globalThis as { WebSocket?: unknown }).WebSocket = UnsupportedWebSocket;
}

// tsx no carga .env.local (eso lo hace Next, y acá no hay Next). Se cargan a
// mano las variables que necesitan el cliente admin y lib/ai.
function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    console.error(`No se encontró ${path}. Copia .env.example y complétalo.`);
    process.exit(1);
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

async function main() {
  loadEnvLocal();
  const admin = createAdminClient();

  // Se indexa exactamente lo que la búsqueda debe poder encontrar: productos
  // ACTIVOS y artículos PUBLICADOS. Los pausados o en borrador quedan fuera a
  // propósito (y si tenían ficha de antes, indexSource la borraría).
  const [{ data: products, error: productsError }, { data: articles, error: articlesError }] =
    await Promise.all([
      admin.from("products").select("id").eq("is_active", true),
      admin.from("support_articles").select("id").eq("is_published", true),
    ]);

  if (productsError) throw productsError;
  if (articlesError) throw articlesError;

  console.log(
    `Fuentes a indexar: ${products?.length ?? 0} productos activos, ` +
      `${articles?.length ?? 0} artículos publicados.\n`,
  );

  const failures: string[] = [];
  let indexedProducts = 0;
  let indexedArticles = 0;

  // Secuencial y no en paralelo: el nivel gratuito de Hugging Face tiene
  // límite de tasa, y 24 llamadas simultáneas lo agotan. Tarda unos segundos
  // más y evita un 429 que dejaría la mitad de las fichas sin generar.
  for (const product of products ?? []) {
    try {
      await embeddingService.indexProduct(product.id, admin);
      indexedProducts += 1;
      process.stdout.write(`  producto ${product.id} ✓\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`producto ${product.id}: ${message}`);
      process.stdout.write(`  producto ${product.id} ✗\n`);
    }
  }

  for (const article of articles ?? []) {
    try {
      await embeddingService.indexSupportArticle(article.id, admin);
      indexedArticles += 1;
      process.stdout.write(`  artículo ${article.id} ✓\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`artículo ${article.id}: ${message}`);
      process.stdout.write(`  artículo ${article.id} ✗\n`);
    }
  }

  const { count } = await admin
    .from("knowledge_embeddings")
    .select("*", { count: "exact", head: true });

  console.log("\n--- Resumen ---");
  console.log(`  productos indexados: ${indexedProducts}`);
  console.log(`  artículos indexados: ${indexedArticles}`);
  console.log(`  total fichas en knowledge_embeddings: ${count ?? 0}`);

  if (failures.length > 0) {
    console.log(`\n  ${failures.length} fallaron:`);
    for (const failure of failures) console.log(`    - ${failure}`);
    // Salida distinta de 0 para que se note en CI o en un encadenado.
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
