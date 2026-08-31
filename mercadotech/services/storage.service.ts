import type { SupabaseClient } from "@supabase/supabase-js";

import { MIME_EXTENSIONS } from "@/lib/constants/product";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export const PRODUCT_IMAGES_BUCKET = "product-images";

// Nace aquí con SOLO getPublicUrl (decisión 4 de la spec: las imágenes se
// muestran desde la Fase 3.4, pero uploadProductImage/deleteProductImage
// recién hacen falta cuando el vendedor sube fotos, en la Fase 3.7).
//
// Usa el método real de supabase-js en vez de armar la URL a mano: si
// Supabase cambia el patrón interno, este código no se rompe.
export function getPublicUrl(
  bucket: string,
  path: string,
  supabase: Client = createClient(),
): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Path EXACTO que exige la política del bucket (Fase 2.4):
// {seller_id}/{product_id}/{n}.{ext} — el primer segmento debe ser el uid
// del vendedor o storage.objects rechaza el insert. La extensión sale del
// MIME real, no del nombre del archivo (renombrar no cambia el tipo).
export async function uploadProductImage(
  file: File,
  sellerId: string,
  productId: string,
  n: number,
  supabase: Client = createClient(),
): Promise<string> {
  const ext = MIME_EXTENSIONS[file.type] ?? "jpg";
  const path = `${sellerId}/${productId}/${n}.${ext}`;

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;

  return path;
}

// Borra en Storage Y la fila de product_images. El bucket no tiene política
// de UPDATE (decisión de la Fase 2.4: el flujo es subir + borrar, nunca
// reemplazar in-place), así que cambiar una imagen es exactamente esto
// seguido de un upload nuevo.
export async function deleteProductImage(
  imageId: string,
  imagePath: string,
  supabase: Client = createClient(),
): Promise<void> {
  const { error: storageError } = await supabase.storage
    .from(PRODUCT_IMAGES_BUCKET)
    .remove([imagePath]);
  if (storageError) throw storageError;

  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) throw error;
}

// Registra en product_images una imagen ya subida a Storage. Se expone acá
// (y no se hace desde el hook) para que la regla de capas se mantenga:
// hooks → services → Supabase, nunca el hook tocando el cliente.
export async function addProductImage(
  productId: string,
  imagePath: string,
  position: number,
  supabase: Client = createClient(),
): Promise<{ id: string; image_path: string; position: number; product_id: string }> {
  const { data, error } = await supabase
    .from("product_images")
    .insert({ product_id: productId, image_path: imagePath, position })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Upsert con FILAS COMPLETAS a propósito: image_path y product_id son NOT
// NULL, así que un upsert parcial (solo id + position) los mandaría como
// null y violaría la restricción. Por eso el caller debe pasar la fila
// entera, no solo lo que cambió.
export async function saveImageOrder(
  items: { id: string; product_id: string; image_path: string; position: number }[],
  supabase: Client = createClient(),
): Promise<void> {
  const { error } = await supabase.from("product_images").upsert(items);
  if (error) throw error;
}
