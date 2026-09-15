import test from "node:test";
import assert from "node:assert/strict";
import { assertSourcesWereSearched, buildDigest, calculateScoreTotal, normalizeSourceUrl } from "../scripts/generate-digest.mjs";

test("评分按编辑政策权重计算", () => {
  assert.equal(calculateScoreTotal({ impact: 90, relevance: 80, novelty: 70, reliability: 60, convergence: 50, feedback: 40 }), 73);
});

test("来源 URL 归一化只移除追踪参数和锚点", () => {
  assert.equal(normalizeSourceUrl("https://Example.com/news/item/?utm_source=x&id=2#part"), "https://example.com/news/item?id=2");
});

test("候选来源必须来自本次网页搜索", () => {
  const items = [{ id: "x", sources: [{ url: "https://example.com/news?a=1&utm_source=x" }] }];
  assert.doesNotThrow(() => assertSourcesWereSearched(items, new Set(["https://example.com/news?a=1"])));
  assert.throws(() => assertSourcesWereSearched(items, new Set(["https://other.example/news"])), /不在本次网页检索来源池/);
});

test("组装日报时计算总分并移除空的可选详情分节", () => {
  const score = { impact: 80, relevance: 80, novelty: 80, reliability: 80, convergence: 80, feedback: 50 };
  const candidate = { thesis: "趋势", status: "published", qualityNotes: [], items: [{
    id: "2026-09-16-example", title: "标题", summary: "摘要", perspective: "视野",
    detail: { introduction: "导语", facts: ["事实"], background: [], significance: ["意义"], analysis: [], reactions: [], uncertainties: [], watch: ["指标"] },
    importance: "速览", category: "科技", kind: "事实", publishedAt: "2026-09-16T00:00:00Z", tags: ["测试"],
    sources: [{ name: "Example", url: "https://example.com/news", kind: "官方", paywalled: false }], score,
  }] };
  const digest = buildDigest(candidate, { date: "2026-09-16", generatedAt: "2026-09-16T08:00:00+08:00", windowStart: "2026-09-15T08:00:00+08:00", rss: { total_feeds: 1, feeds_ok: 1, total_articles: 3 }, searchedSources: new Set(["https://example.com/news"]) });
  assert.equal(digest.items[0].score.total, 78.5);
  assert.equal(digest.items[0].collectedAt, "2026-09-16T08:00:00+08:00");
  assert.equal("analysis" in digest.items[0].detail, false);
  assert.equal("paywalled" in digest.items[0].sources[0], false);
});
