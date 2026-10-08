import { describe, expect, it } from "vitest";
import { parseGuideRequest, renderGuideMarkdown } from "./guide";

describe("parseGuideRequest", () => {
  it("trims and accepts a route when both cities are provided", () => {
    expect(parseGuideRequest({ origin: " 杭州 ", destination: " 黄山 " })).toEqual({
      origin: "杭州",
      destination: "黄山",
    });
  });

  it("rejects missing or blank route endpoints", () => {
    expect(() => parseGuideRequest({ origin: "  ", destination: "黄山" })).toThrow();
    expect(() => parseGuideRequest({ origin: "杭州" })).toThrow();
    expect(() => parseGuideRequest({ origin: "杭".repeat(81), destination: "黄山" })).toThrow();
  });

  it("renders Markdown without allowing model supplied script elements", () => {
    const html = renderGuideMarkdown("# 行程\n\n<script>window.hacked = true</script>\n\n**第一天**\n\n[危险链接](javascript:alert(1))");
    const container = document.createElement("div");
    container.innerHTML = html;

    expect(container.querySelector("h1")?.textContent).toBe("行程");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("strong")?.textContent).toBe("第一天");
    expect(container.querySelector("a")?.getAttribute("href")).toBeNull();
  });
});
