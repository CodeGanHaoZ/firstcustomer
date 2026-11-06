import { afterEach, describe, expect, it, vi } from "vitest";
import { researchOutput } from "@/agents/schemas";
import { createLiveSources, searchDevto, searchWayback } from "@/agents/sources";
import type { ModelClient } from "@/ai/types";
import { detectImageType, imageError, MAX_IMAGE_BYTES, toDataUrl } from "@/domain/images";

const json = (value: unknown) =>
  new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });

afterEach(() => vi.unstubAllGlobals());

describe("Wayback 来源", () => {
  it("返回最早和最新的成功快照，只查状态 200", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url));
      const limit = new URL(String(url)).searchParams.get("limit");
      return json([
        ["timestamp", "original"],
        [limit === "1" ? "20190525180518" : "20261103030616", "https://otter.ai/pricing"],
      ]);
    });
    const results = await searchWayback("otter.ai/pricing");
    expect(calls.every((c) => c.includes("filter=statuscode%3A200"))).toBe(true);
    expect(results.map((r) => r.url)).toEqual([
      "https://web.archive.org/web/20190525180518/https://otter.ai/pricing",
      "https://web.archive.org/web/20261103030616/https://otter.ai/pricing",
    ]);
    expect(results[0].text).toContain("from 2019-05-25 to 2026-11-03");
  });

  it("没有快照时返回空结果，不编造", async () => {
    vi.stubGlobal("fetch", async () => json([]));
    expect(await searchWayback("never-archived.example")).toEqual([]);
  });
});

describe("dev.to 来源", () => {
  it("把关键词整理成单个标签", async () => {
    let requested = "";
    vi.stubGlobal("fetch", async (url: string) => {
      requested = String(url);
      return json([
        {
          url: "https://dev.to/a/post",
          title: "T",
          description: "D",
          published_at: "2026-11-04T09:20:07Z",
        },
      ]);
    });
    const [result] = await searchDevto("Meeting Notes!");
    expect(new URL(requested).searchParams.get("tag")).toBe("meetingnotes");
    expect(result).toMatchObject({ url: "https://dev.to/a/post", text: "T. D" });
  });
});

describe("来源清单", () => {
  const noModel: ModelClient = async () => {
    throw new Error("不应该调用模型");
  };

  it("默认不开联网搜索，并说明每个来源的查询方式", () => {
    vi.stubEnv("MIMO_WEB_SEARCH", "0");
    const sources = createLiveSources(noModel);
    expect(sources.names).toEqual(expect.arrayContaining(["wayback", "devto", "hn"]));
    expect(sources.names).not.toContain("web");
    expect(sources.help).toContain("wayback（");
    vi.unstubAllEnvs();
  });
});

describe("追问数量", () => {
  it("最多 3 个问题", () => {
    const question = { question: "q", why: "w" };
    expect(researchOutput.safeParse({ status: "need_info", questions: [question, question, question] }).success).toBe(true);
    expect(researchOutput.safeParse({ status: "need_info", questions: [question, question, question, question] }).success).toBe(false);
    expect(researchOutput.safeParse({ status: "need_info", questions: [] }).success).toBe(false);
  });
});

describe("图片校验", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  const webp = new TextEncoder().encode("RIFF0000WEBPVP8 ");

  it("按文件内容识别类型", () => {
    expect(detectImageType(png)).toBe("image/png");
    expect(detectImageType(jpeg)).toBe("image/jpeg");
    expect(detectImageType(webp)).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode("<svg></svg>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("RIFF0000WAVE"))).toBeNull();
  });

  it("检查大小和数量", () => {
    expect(imageError(png, 0)).toBeNull();
    expect(imageError(png, 6)).toContain("最多");
    expect(imageError(new Uint8Array(0), 0)).toContain("空");
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(png);
    expect(imageError(big, 0)).toContain("5 MB");
  });

  it("生成官方要求的 Base64 格式", () => {
    expect(toDataUrl("image/png", png)).toBe(`data:image/png;base64,${Buffer.from(png).toString("base64")}`);
  });
});
