import test from "node:test";
import assert from "node:assert/strict";
import { assertEditorialDiversity, assertSourcesWereSearched, boundedWindowStart, buildDigest, calculateScoreTotal, normalizeSourceUrl, selectRssCandidates } from "../scripts/generate-digest.mjs";

test("评分按编辑政策权重计算", () => {
  assert.equal(calculateScoreTotal({ impact: 90, relevance: 80, novelty: 70, reliability: 60, convergence: 50, feedback: 40 }), 73);
});

test("来源 URL 归一化只移除追踪参数和锚点", () => {
  assert.equal(normalizeSourceUrl("https://Example.com/news/item/?utm_source=x&id=2#part"), "https://example.com/news/item?id=2");
});

test("候选来源必须来自本次 RSS 采集", () => {
  const items = [{ id: "x", sources: [{ url: "https://example.com/news?a=1&utm_source=x" }] }];
  assert.doesNotThrow(() => assertSourcesWereSearched(items, new Set(["https://example.com/news?a=1"])));
  assert.throws(() => assertSourcesWereSearched(items, new Set(["https://other.example/news"])), /不在本次 RSS 候选来源池/);
});

test("采集窗口最多回看 36 小时，避免失败后无限累积", () => {
  assert.equal(boundedWindowStart("2026-09-16T08:00:00+08:00", "2026-09-20T08:00:00+08:00"), "2026-09-18T12:00:00.000Z");
  assert.equal(boundedWindowStart("2026-09-19T09:00:00+08:00", "2026-09-20T08:00:00+08:00"), "2026-09-19T01:00:00.000Z");
});

test("RSS 候选限制总量并优先保持信源多样性", () => {
  const articles = Array.from({ length: 10 }, (_, index) => ({
    title: `A${index}`, url: `https://a.example/news/${index}`, summary: "x",
    date: `2026-09-20T0${9 - index}:00:00Z`, feed_title: "A", feed_category: "tech",
  })).concat(Array.from({ length: 4 }, (_, index) => ({
    title: `B${index}`, url: `https://b.example/news/${index}`, summary: "x",
    date: `2026-09-20T0${8 - index}:30:00Z`, feed_title: "B", feed_category: "ai",
  })));
  const selected = selectRssCandidates(articles, {
    windowStart: "2026-09-19T00:00:00Z", generatedAt: "2026-09-21T00:00:00Z", limit: 8, maxPerFeed: 4,
  });
  assert.equal(selected.length, 8);
  assert.equal(selected.filter((item) => item.feed_title === "B").length, 4);
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

test("单源不足时不回填超限文章，不让多个订阅绕过同域名上限", () => {
  const articles = Array.from({length: 10}, (_, i) => ({ title: `News ${i}`, url: `https://www.ithome.com/news/${i}`, date: "2026-09-21T01:00:00Z", feed_title: `Feed ${i}`, feed_category: "cn-tech" }));
  assert.equal(selectRssCandidates(articles, {windowStart:"2026-09-20T00:00:00Z", generatedAt:"2026-09-22T00:00:00Z"}).length, 2);
});

test("成稿不能全来自一家媒体，也不能把同一文章拆成多条", () => {
  const items = [1,2,3].map(i => ({title:`标题${i}`, sources:[{url:`https://ithome.com/news/${i}`}]}));
  assert.throws(() => assertEditorialDiversity(items), /来源不足/);
  items[1].sources[0].url = "https://bbc.com/news/2";
  items[2].sources[0].url = "https://huggingface.co/blog/3";
  assert.doesNotThrow(() => assertEditorialDiversity(items));
  items[2].sources[0].url = items[0].sources[0].url;
  assert.throws(() => assertEditorialDiversity(items), /拆成多条/);
});
