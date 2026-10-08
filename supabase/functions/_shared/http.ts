import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

export type CorsHeaders = Readonly<Record<string, string>>;

export type AuthenticatedContext = {
  readonly ok: true;
  readonly userId: string;
  readonly admin: SupabaseClient;
};

export type AuthenticationFailure = {
  readonly ok: false;
  readonly response: Response;
};

export type AuthenticationResult = AuthenticatedContext | AuthenticationFailure;

export function corsFor(request: Request): CorsHeaders | null {
  const origin = request.headers.get("origin");
  const configuredOrigin = Deno.env.get("APP_ORIGIN");
  const allowedOrigins = configuredOrigin ? [configuredOrigin] : [];
  if (origin && !allowedOrigins.includes(origin)) return null;
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function jsonResponse(payload: unknown, status: number, headers: CorsHeaders): Response {
  return new Response(JSON.stringify(payload), { status, headers });
}

export function optionsResponse(headers: CorsHeaders): Response {
  return new Response("ok", { headers });
}

export async function authenticate(request: Request, headers: CorsHeaders): Promise<AuthenticationResult> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: jsonResponse({ code: "unauthorized", message: "请先登录后再继续。" }, 401, headers),
    };
  }

  const url = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !publishableKey || !serviceRoleKey) throw new Error("Supabase server environment is incomplete");

  const authClient = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await authClient.auth.getUser();
  if (error || !data.user) {
    return {
      ok: false,
      response: jsonResponse({ code: "unauthorized", message: "登录状态已失效，请重新登录。" }, 401, headers),
    };
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return { ok: true, userId: data.user.id, admin };
}
