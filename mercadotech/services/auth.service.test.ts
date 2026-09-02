import { describe, expect, it, vi } from "vitest";

import {
  getCurrentUser,
  getProfile,
  login,
  logout,
  onAuthStateChange,
  register,
} from "@/services/auth.service";
import { fail, mockSupabase, ok } from "@/services/test-utils/supabase-mock";

const authError = { message: "Invalid login credentials", status: 400, name: "AuthApiError" };

describe("register", () => {
  it("manda display_name y role en options.data (los lee handle_new_user)", async () => {
    const supabase = mockSupabase({ auth: { signUp: ok({ user: { id: "u1" }, session: null }) } });

    await register(
      { email: "a@b.com", password: "12345678", displayName: "Ana", role: "seller" },
      supabase,
    );

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "12345678",
      options: { data: { display_name: "Ana", role: "seller" } },
    });
  });

  it("no actualiza profiles después del alta: el rol solo se fija en el INSERT del trigger", async () => {
    const supabase = mockSupabase({ auth: { signUp: ok({ user: { id: "u1" }, session: null }) } });

    await register(
      { email: "a@b.com", password: "12345678", displayName: "Ana", role: "buyer" },
      supabase,
    );

    expect(supabase.callsFor("profiles")).toEqual([]);
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ auth: { signUp: fail(authError) } });

    await expect(
      register({ email: "a@b.com", password: "x", displayName: "Ana", role: "buyer" }, supabase),
    ).rejects.toMatchObject({ message: "Invalid login credentials" });
  });
});

describe("login / logout", () => {
  it("login pasa email y password a signInWithPassword", async () => {
    const supabase = mockSupabase({
      auth: { signInWithPassword: ok({ user: { id: "u1" }, session: { access_token: "t" } }) },
    });

    const data = await login({ email: "a@b.com", password: "secreta" }, supabase);

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.com",
      password: "secreta",
    });
    expect(data.user).toEqual({ id: "u1" });
  });

  it("login propaga el error con su mensaje real", async () => {
    const supabase = mockSupabase({ auth: { signInWithPassword: fail(authError) } });

    await expect(login({ email: "a@b.com", password: "mala" }, supabase)).rejects.toMatchObject({
      message: "Invalid login credentials",
    });
  });

  it("logout llama a signOut", async () => {
    const supabase = mockSupabase();

    await logout(supabase);

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it("logout propaga el error", async () => {
    const supabase = mockSupabase({ auth: { signOut: fail(authError) } });

    await expect(logout(supabase)).rejects.toMatchObject({ message: "Invalid login credentials" });
  });
});

describe("getCurrentUser", () => {
  it("devuelve el usuario con su profile", async () => {
    const supabase = mockSupabase({
      auth: { getUser: ok({ user: { id: "u1", email: "a@b.com" } }) },
      profiles: { maybeSingle: { id: "u1", role: "buyer", display_name: "Ana" } },
    });

    const current = await getCurrentUser(supabase);

    expect(current?.user.id).toBe("u1");
    expect(current?.profile).toMatchObject({ role: "buyer" });
  });

  // Sin sesión, getUser devuelve error: es el caso normal de un anónimo, no
  // un fallo que deba propagarse.
  it("devuelve null si getUser da error, sin lanzar", async () => {
    const supabase = mockSupabase({ auth: { getUser: fail(authError) } });

    await expect(getCurrentUser(supabase)).resolves.toBeNull();
    expect(supabase.callsFor("profiles")).toEqual([]);
  });

  it("devuelve null si no hay usuario en la respuesta", async () => {
    const supabase = mockSupabase({ auth: { getUser: ok({ user: null }) } });

    await expect(getCurrentUser(supabase)).resolves.toBeNull();
  });
});

describe("getProfile", () => {
  it("busca el profile por id", async () => {
    const supabase = mockSupabase({ profiles: { maybeSingle: { id: "u1", role: "seller" } } });

    const profile = await getProfile("u1", supabase);

    expect(profile).toMatchObject({ role: "seller" });
    expect(supabase.filters("profiles")).toEqual([{ method: "eq", args: ["id", "u1"] }]);
  });

  it("devuelve null si no existe", async () => {
    const supabase = mockSupabase({ profiles: { maybeSingle: null } });

    await expect(getProfile("u1", supabase)).resolves.toBeNull();
  });

  it("propaga el error", async () => {
    const supabase = mockSupabase({ profiles: fail({ message: "denied", code: "42501" }) });

    await expect(getProfile("u1", supabase)).rejects.toMatchObject({ code: "42501" });
  });
});

describe("onAuthStateChange", () => {
  it("entrega el user de la sesión al callback", () => {
    const supabase = mockSupabase();
    const callback = vi.fn();

    onAuthStateChange(callback, supabase);
    supabase.emitAuthState("SIGNED_IN", { user: { id: "u1" } });

    expect(callback).toHaveBeenCalledWith({ id: "u1" });
  });

  it("entrega null cuando no hay sesión", () => {
    const supabase = mockSupabase();
    const callback = vi.fn();

    onAuthStateChange(callback, supabase);
    supabase.emitAuthState("SIGNED_OUT", null);

    expect(callback).toHaveBeenCalledWith(null);
  });

  it("la función devuelta desuscribe", () => {
    const supabase = mockSupabase();

    const unsubscribe = onAuthStateChange(vi.fn(), supabase);
    expect(supabase.authUnsubscribe).not.toHaveBeenCalled();

    unsubscribe();
    expect(supabase.authUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
