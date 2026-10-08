import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

const EnvironmentSchema = z.object({
  url: z.string().url(),
  publishableKey: z.string().min(1),
});

const environment = EnvironmentSchema.safeParse({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
});

export const supabase: SupabaseClient | null = environment.success
  ? createClient(environment.data.url, environment.data.publishableKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  : null;
