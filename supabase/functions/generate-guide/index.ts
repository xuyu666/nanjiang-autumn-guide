import ky, { HTTPError, TimeoutError } from "npm:ky@2";
import { z } from "npm:zod@4";
import { decryptApiKey } from "../_shared/api-key-crypto.ts";
import { authenticate, corsFor, jsonResponse, optionsResponse } from "../_shared/http.ts";
import { buildGuideMessages } from "../_shared/guide-prompt.ts";

const RequestSchema = z.object({
  origin: z.string().trim().min(1).max(80),
  destination: z.string().trim().min(1).max(80),
}).strict();

const DeepSeekResponseSchema = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
});

type UpstreamFailure = {
  readonly code: string;
  readonly message: string;
  readonly status: number;
};

function failure(result: UpstreamFailure, headers: Readonly<Record<string, string>>): Response {
  return jsonResponse({ code: result.code, message: result.message }, result.status, headers);
}

function mapUpstreamError(error: unknown): UpstreamFailure {
  if (error instanceof HTTPError) {
    switch (error.response.status) {
      case 401:
      case 403:
        return { code: "invalid_deepseek_key", message: "DeepSeek 未接受此 API Key，请到账户设置中检查或替换。", status: 502 };
      case 402:
        return { code: "insufficient_balance", message: "DeepSeek 账户余额不足，请检查账户额度。", status: 502 };
      case 429:
        return { code: "rate_limited", message: "DeepSeek 请求过于频繁，请稍后重试。", status: 429 };
      default:
        return { code: "deepseek_unavailable", message: "DeepSeek 暂时无法完成请求，请稍后重试。", status: 502 };
    }
  }
  if (error instanceof TimeoutError) {
    return { code: "deepseek_timeout", message: "生成时间较长，请稍后重试。", status: 504 };
  }
  return { code: "deepseek_unavailable", message: "暂时无法连接 DeepSeek，请检查网络后重试。", status: 502 };
}

Deno.serve(async (request: Request): Promise<Response> => {
  const headers = corsFor(request);
  if (!headers) return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return optionsResponse(headers);
  if (request.method !== "POST") {
    return jsonResponse({ code: "method_not_allowed", message: "不支持此请求方式。" }, 405, headers);
  }

  const auth = await authenticate(request, headers);
  if (!auth.ok) return auth.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonResponse({ code: "invalid_input", message: "请填写有效的出发地和目的地。" }, 400, headers);
    }
    throw error;
  }
  const parsed = RequestSchema.safeParse(payload);
  if (!parsed.success) {
    return jsonResponse({ code: "invalid_input", message: "请填写有效的出发地和目的地。" }, 400, headers);
  }

  const { data: storedKey, error: lookupError } = await auth.admin
    .from("user_api_keys")
    .select("key_ciphertext, key_iv")
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (lookupError) {
    return jsonResponse({ code: "storage_unavailable", message: "暂时无法读取账户设置，请稍后重试。" }, 500, headers);
  }
  if (!storedKey) {
    return jsonResponse({ code: "missing_api_key", message: "请先在账户设置中添加 DeepSeek API Key。" }, 409, headers);
  }

  const encryptionSecret = Deno.env.get("DEEPSEEK_KEY_ENCRYPTION_SECRET");
  if (!encryptionSecret) {
    return jsonResponse({ code: "server_not_configured", message: "密钥服务尚未完成配置，请联系网站管理员。" }, 503, headers);
  }

  try {
    const apiKey = await decryptApiKey(encryptionSecret, {
      ciphertext: storedKey.key_ciphertext,
      iv: storedKey.key_iv,
    }, auth.userId);
    const upstream = await ky.post("https://api.deepseek.com/chat/completions", {
      headers: { Authorization: `Bearer ${apiKey}` },
      json: {
        model: "deepseek-flash",
        messages: buildGuideMessages(parsed.data.origin, parsed.data.destination),
        max_tokens: 5000,
        stream: false,
      },
      retry: 0,
      timeout: 65_000,
    }).json<unknown>();
    const response = DeepSeekResponseSchema.safeParse(upstream);
    const markdown = response.success ? response.data.choices[0]?.message.content.trim() : undefined;
    if (!markdown) {
      return jsonResponse({ code: "invalid_upstream_response", message: "DeepSeek 返回内容为空，请重新生成。" }, 502, headers);
    }
    return jsonResponse({ markdown }, 200, headers);
  } catch (error) {
    const result = mapUpstreamError(error);
    return failure(result, headers);
  }
});
