import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";

import type { Database } from "@/types/database";

// Doble de utilería del cliente Supabase, INYECTADO por el último parámetro
// de cada service (arquitectura de la sesión 2). Nunca se mockea el módulo
// lib/supabase/*: si un test necesitara eso, el service estaría mal diseñado.
//
// Cubre las cuatro superficies que usan los services: el query builder
// encadenable, rpc(), storage y auth. Ninguna abre red.

const RESPONSE = Symbol("supabase-mock-response");

const CONFIG_KEYS = [
  "data",
  "single",
  "maybeSingle",
  "select",
  "insert",
  "update",
  "upsert",
  "delete",
] as const;

export type MockResponse = {
  [RESPONSE]: true;
  data: unknown;
  error: unknown;
  count: number | null;
};

/** Respuesta exitosa. `count` solo hace falta con `{ count: "exact" }`. */
export function ok(data: unknown = null, count: number | null = null): MockResponse {
  return { [RESPONSE]: true, data, error: null, count };
}

/** Respuesta con error: el service debe propagarlo tal cual. */
export function fail(error: unknown): MockResponse {
  return { [RESPONSE]: true, data: null, error, count: null };
}

/** Error con la forma de PostgrestError (code + message es lo que se afirma). */
export function pgError(message: string, code = "PGRST000") {
  return { message, code, details: "", hint: "", name: "PostgrestError" };
}

function isResponse(value: unknown): value is MockResponse {
  return typeof value === "object" && value !== null && RESPONSE in value;
}

// Un objeto es "config por operación" si usa alguna de las claves conocidas
// ({ single: … }, { update: fail(…) }); cualquier otra cosa es la fila/lista
// cruda que debe devolver el await final.
function isKeyedConfig(value: unknown): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  if (isResponse(value)) return false;
  return CONFIG_KEYS.some((key) => key in (value as Record<string, unknown>));
}

function toResponse(value: unknown): MockResponse {
  return isResponse(value) ? value : ok(value);
}

type Operation = "select" | "insert" | "update" | "upsert" | "delete";
type Terminal = "single" | "maybeSingle" | null;

function resolveResponse(
  tableConfig: unknown,
  operation: Operation,
  terminal: Terminal,
): MockResponse {
  const empty = () => ok(terminal ? null : []);

  if (tableConfig === undefined) return empty();
  if (isResponse(tableConfig)) return tableConfig;

  if (isKeyedConfig(tableConfig)) {
    const keyed = tableConfig as Record<string, unknown>;
    // La operación gana sobre el terminal: permite programar por separado la
    // lectura y la escritura de una misma tabla (cart_items lee y actualiza).
    if (keyed[operation] !== undefined) return toResponse(keyed[operation]);
    if (terminal && keyed[terminal] !== undefined) return toResponse(keyed[terminal]);
    if (keyed.data !== undefined) return toResponse(keyed.data);
    return empty();
  }

  return ok(tableConfig);
}

export type CallLog = { table: string; method: string; args: unknown[] };

export type MockConfig = {
  /** Respuesta por tabla: cruda, `ok()`/`fail()`, o por operación/terminal. */
  [table: string]: unknown;
} & {
  rpc?: Record<string, unknown>;
  storage?: { publicUrl?: string; upload?: unknown; remove?: unknown };
  auth?: Record<string, unknown>;
};

type Recorders = {
  calls: CallLog[];
  callsFor(table: string): CallLog[];
  /** Argumentos de cada llamada a un método sobre una tabla. */
  argsFor(table: string, method: string): unknown[][];
  /** Payloads de cada insert/update/upsert sobre una tabla. */
  inserts(table: string): unknown[];
  updates(table: string): unknown[];
  upserts(table: string): unknown[];
  /** Cuántos delete se dispararon sobre la tabla. */
  deletes(table: string): number;
  /** Filtros aplicados, en orden: [{ method: "eq", args: ["id", "p1"] }, …]. */
  filters(table: string): { method: string; args: unknown[] }[];
  rpcCalls(): { fn: string; args: unknown }[];
  storageUploads(): { bucket: string; path: string; file: unknown; options: unknown }[];
  storageRemoves(): { bucket: string; paths: unknown }[];
  /** Dispara el callback registrado por auth.onAuthStateChange. */
  emitAuthState(event: string, session: unknown): void;
  authUnsubscribe: ReturnType<typeof vi.fn>;
};

export type SupabaseMock = SupabaseClient<Database> & Recorders;

const FILTER_METHODS = new Set([
  "eq",
  "neq",
  "in",
  "or",
  "gt",
  "gte",
  "lt",
  "lte",
  "like",
  "ilike",
  "is",
  "order",
  "range",
  "limit",
  "match",
]);

function createBuilder(table: string, tableConfig: unknown, calls: CallLog[]) {
  let operation: Operation = "select";
  let terminal: Terminal = null;

  const settle = () => {
    const response = resolveResponse(tableConfig, operation, terminal);
    return Promise.resolve({
      data: response.data,
      error: response.error,
      count: response.count,
      status: response.error ? 400 : 200,
      statusText: response.error ? "Bad Request" : "OK",
    });
  };

  const builder: unknown = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === "symbol") return undefined;

        if (prop === "then") {
          return (onFulfilled?: never, onRejected?: never) => settle().then(onFulfilled, onRejected);
        }
        if (prop === "catch") {
          return (onRejected?: never) => settle().catch(onRejected);
        }
        if (prop === "finally") {
          return (onFinally?: never) => settle().finally(onFinally);
        }

        return (...args: unknown[]) => {
          calls.push({ table, method: prop, args });

          if (prop === "insert" || prop === "update" || prop === "upsert" || prop === "delete") {
            operation = prop;
          }
          if (prop === "single" || prop === "maybeSingle") {
            terminal = prop;
          }
          return builder;
        };
      },
    },
  );

  return builder;
}

export function mockSupabase(config: MockConfig = {}): SupabaseMock {
  const calls: CallLog[] = [];
  const rpcCalls: { fn: string; args: unknown }[] = [];
  const uploads: { bucket: string; path: string; file: unknown; options: unknown }[] = [];
  const removes: { bucket: string; paths: unknown }[] = [];
  const authUnsubscribe = vi.fn();
  let authCallback: ((event: string, session: unknown) => void) | null = null;

  const authResponse = (method: string, fallback: unknown) => {
    const configured = (config.auth as Record<string, unknown> | undefined)?.[method];
    if (configured === undefined) return { data: fallback, error: null };
    const response = toResponse(configured);
    return { data: response.data, error: response.error };
  };

  const client = {
    from(table: string) {
      calls.push({ table, method: "from", args: [table] });
      return createBuilder(table, config[table], calls);
    },

    rpc(fn: string, args: unknown) {
      rpcCalls.push({ fn, args });
      const response = toResponse((config.rpc as Record<string, unknown> | undefined)?.[fn]);
      return Promise.resolve({ data: response.data, error: response.error });
    },

    storage: {
      from(bucket: string) {
        return {
          getPublicUrl(path: string) {
            const publicUrl =
              config.storage?.publicUrl ?? `https://mock.supabase.co/storage/${bucket}/${path}`;
            return { data: { publicUrl } };
          },
          async upload(path: string, file: unknown, options: unknown) {
            uploads.push({ bucket, path, file, options });
            const response = toResponse(config.storage?.upload);
            return { data: response.data, error: response.error };
          },
          async remove(paths: unknown) {
            removes.push({ bucket, paths });
            const response = toResponse(config.storage?.remove);
            return { data: response.data, error: response.error };
          },
        };
      },
    },

    auth: {
      onAuthStateChange(callback: (event: string, session: unknown) => void) {
        authCallback = callback;
        return { data: { subscription: { unsubscribe: authUnsubscribe } } };
      },
      signUp: vi.fn(async () => authResponse("signUp", { user: null, session: null })),
      signInWithPassword: vi.fn(async () =>
        authResponse("signInWithPassword", { user: null, session: null }),
      ),
      signOut: vi.fn(async () => {
        const response = toResponse((config.auth as Record<string, unknown> | undefined)?.signOut);
        return { error: response.error };
      }),
      getUser: vi.fn(async () => authResponse("getUser", { user: null })),
    },

    // ---- lectores para las aserciones ----
    calls,
    callsFor: (table: string) => calls.filter((call) => call.table === table),
    argsFor: (table: string, method: string) =>
      calls.filter((call) => call.table === table && call.method === method).map((call) => call.args),
    inserts: (table: string) =>
      calls.filter((call) => call.table === table && call.method === "insert").map((call) => call.args[0]),
    updates: (table: string) =>
      calls.filter((call) => call.table === table && call.method === "update").map((call) => call.args[0]),
    upserts: (table: string) =>
      calls.filter((call) => call.table === table && call.method === "upsert").map((call) => call.args[0]),
    deletes: (table: string) =>
      calls.filter((call) => call.table === table && call.method === "delete").length,
    filters: (table: string) =>
      calls
        .filter((call) => call.table === table && FILTER_METHODS.has(call.method))
        .map((call) => ({ method: call.method, args: call.args })),
    rpcCalls: () => rpcCalls,
    storageUploads: () => uploads,
    storageRemoves: () => removes,
    emitAuthState: (event: string, session: unknown) => authCallback?.(event, session),
    authUnsubscribe,
  };

  return client as unknown as SupabaseMock;
}
