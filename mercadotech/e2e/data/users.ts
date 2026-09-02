// Usuarios DEL SEED (supabase/seed.sql, sección USERS) — no se crean por la
// UI ni por API: ya existen tras `supabase db reset`. Los 6 usuarios de
// laboratorio comparten la misma contraseña.
export const SEED_PASSWORD = "MercadoTech123!";

export type TestUser = {
  email: string;
  password: string;
  displayName: string;
};

// a0000000-…-0001 · Camila Torres. Comprador sin tickets de soporte propios
// (útil para no chocar con datos de otras suites).
export const BUYER1: TestUser = {
  email: "buyer1@mercadotech.test",
  password: SEED_PASSWORD,
  displayName: "Camila Torres",
};

// a0000000-…-0002 · Diego Huamán. Comprador SIN cart_items propios en el
// seed (igual que buyer1) — se usa para negativos que necesitan un carrito
// vacío garantizado sin competir con buyer-flow.spec.ts, que corre en
// paralelo (otro archivo, otro worker) y deja/quita ítems del carrito de
// buyer1 durante su propia corrida.
export const BUYER2: TestUser = {
  email: "buyer2@mercadotech.test",
  password: SEED_PASSWORD,
  displayName: "Diego Huamán",
};

// a0000000-…-0004 · ElectroMax Perú. Vendedor con productos y pedidos reales
// del seed (incluye un pedido 'pagado', punto de partida del E2E de kanban).
export const SELLER1: TestUser = {
  email: "seller1@mercadotech.test",
  password: SEED_PASSWORD,
  displayName: "ElectroMax Perú",
};
