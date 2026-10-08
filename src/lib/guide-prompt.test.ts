import { describe, expect, it } from "vitest";
import { buildGuideMessages } from "../../supabase/functions/_shared/guide-prompt";

describe("buildGuideMessages", () => {
  it("includes both endpoints and prevents unsupported live travel claims", () => {
    const messages = buildGuideMessages("深圳", "喀什");

    expect(messages[1]?.content).toContain("出发地：深圳");
    expect(messages[1]?.content).toContain("目的地：喀什");
    expect(messages[0]?.content).toContain("不要编造精确的现行票价");
    expect(messages[0]?.content).toContain("没有实时搜索");
  });
});
