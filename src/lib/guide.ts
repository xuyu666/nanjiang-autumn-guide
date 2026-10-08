import { z } from "zod";
import DOMPurify from "dompurify";
import { marked } from "marked";

export const GuideRequestSchema = z.object({
  origin: z.string().trim().min(1).max(80),
  destination: z.string().trim().min(1).max(80),
});

export type GuideRequest = z.infer<typeof GuideRequestSchema>;

export function parseGuideRequest(input: unknown): GuideRequest {
  return GuideRequestSchema.parse(input);
}

export function renderGuideMarkdown(markdown: string): string {
  const html = marked.parse(markdown, { async: false, gfm: true });
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_ATTR: ["style"],
    FORBID_TAGS: ["iframe", "object", "embed", "form"],
  });
}

export const GuideResponseSchema = z.object({
  markdown: z.string().trim().min(1).max(50_000),
});
