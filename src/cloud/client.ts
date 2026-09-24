import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const cloudConfigured = Boolean(url && key);
export const localMode = import.meta.env.VITE_LOCAL_ONLY === "true";
// Only a publishable/anon key belongs in the web bundle. RLS protects every account.
export const supabase = cloudConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        storageKey: "eggpro-auth",
      },
    })
  : null;
