// Límites de validación del formulario de producto y de sus imágenes.

// 5 caracteres descarta títulos inútiles ("PC"); 120 es el ancho que el
// ProductCard puede mostrar en 2 líneas sin truncar de forma agresiva.
export const TITLE_MIN = 5;
export const TITLE_MAX = 120;

// 6 imágenes llenan la galería del detalle sin volverla interminable.
export const MAX_IMAGES_PER_PRODUCT = 6;

// Estos DOS valores replican exactamente los límites del bucket
// `product-images` (migración de la Fase 2.4). Se validan también en el
// cliente para dar un error legible ANTES de que Storage rechace la subida
// con un 400 opaco. Si cambian en el bucket, hay que cambiarlos acá.
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// Extensión derivada del MIME real, no del nombre del archivo: un usuario
// puede renombrar "algo.exe" a "algo.jpg", pero el MIME que reporta el
// navegador es el que el bucket va a validar.
export const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
