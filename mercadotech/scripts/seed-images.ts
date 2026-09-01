/**
 * Sube una foto de portada real (Unsplash) a cada uno de los 16 productos
 * FIJOS del seed (supabase/seed.sql), en el mismo `image_path` que ya
 * existe en `product_images` (position 0) — no toca la base de datos, solo
 * puebla Storage.
 *
 *   npx tsx scripts/seed-images.ts
 *
 * ¿Por qué existe?
 *
 *   El seed crea las filas de `product_images` con rutas coherentes con la
 *   convención del bucket, pero NUNCA sube el archivo real — es un gap
 *   documentado a propósito en el propio `supabase/seed.sql` ("GAP
 *   CONOCIDO"). Hasta que alguien sube una imagen real desde la UI del
 *   vendedor (sesión 3), `ProductImage` muestra el placeholder. Este script
 *   cierra ese gap para los 16 productos del seed de una sola vez.
 *
 * ¿Cuándo se corre?
 *
 *   - Después de un `supabase db reset` si además se vació el bucket
 *     `product-images` (el reset normal NO lo hace: Storage no se resetea
 *     con las migraciones, así que en el caso común no hace falta re-correrlo).
 *   - Si se agregan productos nuevos al seed: hay que sumar su entrada a
 *     `PRODUCTS` abajo (id, `image_path` de su fila `position=0`, y un
 *     término de búsqueda en inglés para su categoría).
 *
 * Es idempotente: sube con `upsert: true`, así que reemplaza el archivo si
 * ya existe en vez de fallar.
 *
 * Requiere `UNSPLASH_ACCESS_KEY` en `.env.local` (cuenta gratuita en
 * unsplash.com/developers, 50 solicitudes/hora — de sobra para 16
 * productos). Unsplash no indexa nombres de modelo exactos ("Lenovo IdeaPad
 * Slim 3"), así que las búsquedas son por categoría/tipo de producto
 * ("laptop computer", "gaming mouse"), no por marca o modelo — las fotos
 * son representativas, no la foto literal del SKU.
 *
 * Atribución: la guía de la API de Unsplash pide atribuir al fotógrafo
 * cuando la app es pública. El script imprime la lista completa al
 * terminar; si este catálogo deja de ser un proyecto de práctica, hay que
 * agregar esos créditos en algún lugar visible.
 *
 * Corre FUERA del navegador (node, vía tsx), que es lo que le permite usar
 * el cliente admin: la service role key jamás debe viajar al cliente.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createAdminClient } from "@/lib/supabase/admin";

// Mismo stub que scripts/index-all.ts: Node 20 no expone WebSocket global
// (llegó en Node 22) y supabase-js lanza al construir el cliente admin
// aunque el script solo use REST. Ver el comentario largo en index-all.ts.
if (typeof globalThis.WebSocket === "undefined") {
  class UnsupportedWebSocket {
    constructor() {
      throw new Error(
        "scripts/seed-images.ts no usa realtime. Si necesitas suscripciones, " +
          "corre con Node 22+ (que trae WebSocket nativo).",
      );
    }
  }
  (globalThis as { WebSocket?: unknown }).WebSocket = UnsupportedWebSocket;
}

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  let contents: string;
  try {
    contents = readFileSync(path, "utf8");
  } catch {
    console.error(`No se encontró ${path}. Copia .env.example y completálo.`);
    process.exit(1);
  }
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

// id del producto -> { path: image_path REAL de su fila position=0 en
// product_images, query: término de búsqueda en inglés, verificado con
// >250 resultados en Unsplash antes de fijarlo acá }.
const PRODUCTS: { id: string; path: string; query: string }[] = [
  { id: "b0000000-0000-0000-0000-000000000001", path: "a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000001/1.jpg", query: "laptop computer" },
  { id: "b0000000-0000-0000-0000-000000000002", path: "a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000002/1.jpg", query: "laptop computer" },
  { id: "b0000000-0000-0000-0000-000000000003", path: "a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000003/1.jpg", query: "laptop computer" },
  { id: "b0000000-0000-0000-0000-000000000004", path: "a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000004/1.jpg", query: "smartphone" },
  { id: "b0000000-0000-0000-0000-000000000005", path: "a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000005/1.jpg", query: "smartphone" },
  { id: "b0000000-0000-0000-0000-000000000006", path: "a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000006/1.jpg", query: "motherboard" },
  { id: "b0000000-0000-0000-0000-000000000007", path: "a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000007/1.jpg", query: "ram memory module" },
  { id: "b0000000-0000-0000-0000-000000000008", path: "a0000000-0000-0000-0000-000000000004/b0000000-0000-0000-0000-000000000008/1.jpg", query: "computer monitor" },
  { id: "b0000000-0000-0000-0000-000000000009", path: "a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000009/1.jpg", query: "wireless headphones" },
  { id: "b0000000-0000-0000-0000-000000000010", path: "a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000010/1.jpg", query: "bluetooth speaker" },
  { id: "b0000000-0000-0000-0000-000000000011", path: "a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000011/1.jpg", query: "gaming mouse" },
  { id: "b0000000-0000-0000-0000-000000000012", path: "a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000012/1.jpg", query: "mechanical keyboard" },
  { id: "b0000000-0000-0000-0000-000000000013", path: "a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000013/1.jpg", query: "gaming chair" },
  { id: "b0000000-0000-0000-0000-000000000014", path: "a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000014/1.jpg", query: "laptop backpack" },
  { id: "b0000000-0000-0000-0000-000000000015", path: "a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000015/1.jpg", query: "wifi router" },
  { id: "b0000000-0000-0000-0000-000000000016", path: "a0000000-0000-0000-0000-000000000005/b0000000-0000-0000-0000-000000000016/1.jpg", query: "wifi extender" },
];

type UnsplashResult = {
  urls: { regular: string };
  user: { name: string; links: { html: string } };
  links: { download_location: string };
};

async function searchUnsplash(query: string, key: string): Promise<UnsplashResult | null> {
  const res = await fetch(
    `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish`,
    { headers: { Authorization: `Client-ID ${key}` } },
  );
  if (!res.ok) throw new Error(`Unsplash ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.results?.[0] ?? null;
}

async function main() {
  loadEnvLocal();

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) {
    console.error(
      "UNSPLASH_ACCESS_KEY no está en .env.local. Sacar una key gratuita en " +
        "unsplash.com/developers → Your apps → New Application.",
    );
    process.exit(1);
  }

  const admin = createAdminClient();

  const attributions: { producto: string; autor: string; perfil: string }[] = [];
  let ok = 0;
  let fail = 0;

  for (const product of PRODUCTS) {
    process.stdout.write(`${product.path.split("/")[1]}  "${product.query}"  `);
    try {
      const photo = await searchUnsplash(product.query, unsplashKey);
      if (!photo) {
        console.log("SIN RESULTADOS ✗");
        fail += 1;
        continue;
      }

      const imgRes = await fetch(photo.urls.regular);
      if (!imgRes.ok) throw new Error(`descarga falló: HTTP ${imgRes.status}`);
      const bytes = new Uint8Array(await imgRes.arrayBuffer());

      const { error } = await admin.storage
        .from("product-images")
        .upload(product.path, bytes, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;

      // Registra el evento de descarga: lo pide la guía de la API de
      // Unsplash cuando el archivo se usa de verdad (no solo se previsualiza).
      void fetch(photo.links.download_location, {
        headers: { Authorization: `Client-ID ${unsplashKey}` },
      }).catch(() => {});

      attributions.push({
        producto: product.path.split("/")[1],
        autor: photo.user.name,
        perfil: photo.user.links.html,
      });

      console.log(`✓ (foto de ${photo.user.name})`);
      ok += 1;
    } catch (err) {
      console.log(`ERROR: ${err instanceof Error ? err.message : err}`);
      fail += 1;
    }
    // Pausa breve entre llamadas — cuota de sobra (50/h para 16 pedidos),
    // solo por cortesía con la API.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\n--- Resumen ---`);
  console.log(`  subidas exitosas: ${ok}`);
  console.log(`  fallidas: ${fail}`);
  console.log(`\n--- Atribución (guía de la API de Unsplash) ---`);
  for (const a of attributions) {
    console.log(`  ${a.producto}: foto de ${a.autor} (${a.perfil})`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
