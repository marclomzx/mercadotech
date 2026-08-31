// PRODUCTS_PAGE_SIZE: múltiplo de 2, 3 y 4 a la vez — el grid usa esas
// mismas columnas según el breakpoint (1/2/3/4), así que con 12 nunca queda
// una fila a medias en ningún tamaño de pantalla. Con los 14 productos
// activos del seed da exactamente 2 páginas (12 + 2).
export const PRODUCTS_PAGE_SIZE = 12;

export const SORT_OPTIONS = [
  { value: "recientes", label: "Más recientes" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]["value"];

export const DEFAULT_SORT: SortOption = "recientes";

// Rango por defecto del filtro de precio: cubre holgadamente el catálogo del
// seed (S/ 89 – S/ 2,399) sin acotar de entrada — el usuario lo angosta.
export const DEFAULT_MIN_PRICE = 0;
export const DEFAULT_MAX_PRICE = 5000;
