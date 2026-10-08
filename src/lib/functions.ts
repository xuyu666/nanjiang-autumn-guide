import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GuideRequestSchema, GuideResponseSchema, type GuideRequest } from "./guide";

const KeyStatusSchema = z.object({ configured: z.boolean() });
const FunctionErrorSchema = z.object({ code: z.string(), message: z.string() });

export class AppFunctionError extends Error {
  readonly name = "AppFunctionError";

  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function invoke<T>(
  client: SupabaseClient,
  functionName: string,
  body: Record<string, unknown>,
  responseSchema: z.ZodType<T>,
): Promise<T> {
  const { data, error } = await client.functions.invoke(functionName, { body });
  if (error instanceof FunctionsHttpError) {
    let payload: unknown;
    try {
      payload = await error.context.json();
    } catch (cause) {
      if (cause instanceof SyntaxError) {
        throw new AppFunctionError("invalid_response", "服务暂时无法处理请求，请稍后再试。");
      }
      throw cause;
    }
    const parsedError = FunctionErrorSchema.safeParse(payload);
    if (parsedError.success) {
      throw new AppFunctionError(parsedError.data.code, parsedError.data.message);
    }
    throw new AppFunctionError("request_failed", "服务暂时无法处理请求，请稍后再试。");
  }
  if (error) {
    throw new AppFunctionError("network_error", "连接服务失败，请检查网络后重试。");
  }
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) {
    throw new AppFunctionError("invalid_response", "服务返回了无法识别的内容，请稍后重试。");
  }
  return parsed.data;
}

export function getApiKeyStatus(client: SupabaseClient): Promise<{ readonly configured: boolean }> {
  return invoke(client, "manage-api-key", { action: "status" }, KeyStatusSchema);
}

export function saveApiKey(client: SupabaseClient, apiKey: string): Promise<{ readonly configured: boolean }> {
  return invoke(client, "manage-api-key", { action: "save", apiKey }, KeyStatusSchema);
}

export function deleteApiKey(client: SupabaseClient): Promise<{ readonly configured: boolean }> {
  return invoke(client, "manage-api-key", { action: "delete" }, KeyStatusSchema);
}

export function generateGuide(
  client: SupabaseClient,
  input: unknown,
): Promise<z.infer<typeof GuideResponseSchema>> {
  const request: GuideRequest = GuideRequestSchema.parse(input);
  return invoke(client, "generate-guide", request, GuideResponseSchema);
}
