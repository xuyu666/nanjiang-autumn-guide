import { z } from "npm:zod@4";
import { decryptApiKey, encryptApiKey } from "../_shared/api-key-crypto.ts";
import { authenticate, corsFor, jsonResponse, optionsResponse } from "../_shared/http.ts";

const RequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }).strict(),
  z.object({ action: z.literal("save"), apiKey: z.string().trim().min(12).max(300) }).strict(),
  z.object({ action: z.literal("delete") }).strict(),
]);

function failure(code: string, message: string, status: number, headers: Readonly<Record<string, string>>): Response {
  return jsonResponse({ code, message }, status, headers);
}

function assertNever(value: never): never {
  throw new Error(`Unsupported API key action: ${String(value)}`);
}

Deno.serve(async (request: Request): Promise<Response> => {
  const headers = corsFor(request);
  if (!headers) return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return optionsResponse(headers);
  if (request.method !== "POST") return failure("method_not_allowed", "不支持此请求方式。", 405, headers);

  const auth = await authenticate(request, headers);
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (cause) {
    if (cause instanceof SyntaxError) return failure("invalid_input", "请求内容无法读取。", 400, headers);
    throw cause;
  }
  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success) return failure("invalid_input", "请提供有效的操作和 API Key。", 400, headers);

  switch (parsed.data.action) {
    case "status": {
      const { data, error } = await auth.admin.from("user_api_keys").select("user_id").eq("user_id", auth.userId).maybeSingle();
      if (error) return failure("storage_unavailable", "暂时无法读取密钥状态，请稍后重试。", 500, headers);
      return jsonResponse({ configured: Boolean(data) }, 200, headers);
    }
    case "delete": {
      const { error } = await auth.admin.from("user_api_keys").delete().eq("user_id", auth.userId);
      if (error) return failure("storage_unavailable", "暂时无法删除密钥，请稍后重试。", 500, headers);
      return jsonResponse({ configured: false }, 200, headers);
    }
    case "save": {
      const encryptionSecret = Deno.env.get("DEEPSEEK_KEY_ENCRYPTION_SECRET");
      if (!encryptionSecret) return failure("server_not_configured", "密钥服务尚未完成配置，请联系网站管理员。", 503, headers);
      try {
        const encrypted = await encryptApiKey(encryptionSecret, parsed.data.apiKey, auth.userId);
        const { error } = await auth.admin.from("user_api_keys").upsert({
          user_id: auth.userId,
          key_ciphertext: encrypted.ciphertext,
          key_iv: encrypted.iv,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (error) return failure("storage_unavailable", "密钥未能保存，请稍后重试。", 500, headers);
        return jsonResponse({ configured: true }, 200, headers);
      } catch (error) {
        if (error instanceof Error) {
          return failure("encryption_failed", "密钥加密失败，请联系网站管理员。", 500, headers);
        }
        throw error;
      }
    }
    default:
      return assertNever(parsed.data);
  }
});
