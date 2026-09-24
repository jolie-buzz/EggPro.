import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import type { CloudStore } from "./store";
export const apiOrigin = (import.meta.env.VITE_API_URL || "").replace(
  /\/$/,
  "",
);
if (apiOrigin && new URL(apiOrigin).protocol !== "https:")
  throw new Error("Use HTTPS for the EggPro server URL.");
export const neonSessionKey =
  "eggpro-neon-auth:" + (apiOrigin || location.origin);
export function savedNeonSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(neonSessionKey) ?? "null");
    return s?.user?.id && s?.access_token ? s : null;
  } catch {
    return null;
  }
}
const listeners = new Set<
  (event: AuthChangeEvent, session: Session | null) => void
>();
export function acceptNeonSession(session: Session) {
  localStorage.setItem(neonSessionKey, JSON.stringify(session));
  listeners.forEach((fn) => fn("SIGNED_IN", session));
}
export async function api<T>(
  path: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const token = savedNeonSession()?.access_token;
  let response: Response;
  try {
    response = await fetch(apiOrigin + path, {
      method: body === undefined ? "GET" : method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
  } catch {
    throw new Error(
      "Cannot reach EggPro online. Saved phone records are kept; reconnect to sync.",
    );
  }
  const payload = await response
    .json()
    .catch(() => ({
      error:
        "The EggPro server is not configured yet. Set the Render Start Command to npm start and configure DATABASE_URL.",
    }));
  if (!response.ok || payload?.error)
    throw new Error(
      payload.error ?? "Cloud request failed. Saved phone records are kept.",
    );
  return payload as T;
}
export async function createNeonAccount(
  email: string,
  password: string,
  recoveryCode?: string,
) {
  return api<{ session: Session; recoveryCode: string }>(
    recoveryCode ? "/api/auth/recover" : "/api/auth/signup",
    { email, password, ...(recoveryCode ? { recoveryCode } : {}) },
  );
}
export const neonAuth = {
  onAuthStateChange(
    fn: (event: AuthChangeEvent, session: Session | null) => void,
  ) {
    listeners.add(fn);
    return {
      data: { subscription: { unsubscribe: () => listeners.delete(fn) } },
    };
  },
  async getSession() {
    return {
      data: { session: savedNeonSession() },
      error: null as Error | null,
    };
  },
  async signInWithPassword(body: { email: string; password: string }) {
    try {
      const { session } = await api<{ session: Session }>(
        "/api/auth/login",
        body,
      );
      acceptNeonSession(session);
      return { error: null };
    } catch (e) {
      return { error: e as Error };
    }
  },
  async signOut(_options?: unknown) {
    try {
      await api("/api/auth/logout", {});
    } catch {
      /* Local logout still hides the phone's records offline. */
    }
    localStorage.removeItem(neonSessionKey);
    listeners.forEach((fn) => fn("SIGNED_OUT", null));
    return { error: null };
  },
  async signUp(_body: unknown) {
    return {
      data: { session: null },
      error: new Error("Use the account creation form."),
    };
  },
  async resetPasswordForEmail(_email: string, _options?: unknown) {
    return {
      error: new Error("Use your recovery key to reset your password."),
    };
  },
  async updateUser(_body: unknown) {
    return {
      error: new Error("Use your recovery key to reset your password."),
    };
  },
};
export function neonStore(owner: string): CloudStore {
  function verifyOwner() {
    if (savedNeonSession()?.user.id !== owner)
      throw new Error("This account changed. Reopen EggPro.");
  }
  return {
    async read() {
      verifyOwner();
      return api("/api/farm");
    },
    async write(document, revision, mutationId) {
      verifyOwner();
      const data = await api<{
        revision: number;
        mutation_id: string;
        updated_at: string;
      }>("/api/farm", { document, revision, mutationId }, "PUT");
      return { ...data, document };
    },
  };
}
