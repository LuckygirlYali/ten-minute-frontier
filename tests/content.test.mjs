import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const digest = JSON.parse(await readFile(new URL("../src/data/digests/2026-08-31.json", import.meta.url)));
const currentDigest = JSON.parse(await readFile(new URL("../src/data/digests/2026-09-08.json", import.meta.url)));
const digestView = await readFile(new URL("../src/components/DigestView.astro", import.meta.url), "utf8");
const siteHeader = await readFile(new URL("../src/components/SiteHeader.astro", import.meta.url), "utf8");
const qualityPanel = await readFile(new URL("../src/components/QualityPanel.astro", import.meta.url), "utf8");
const clientScript = await readFile(new URL("../src/scripts/client.ts", import.meta.url), "utf8");
const globalCss = await readFile(new URL("../src/styles/global.css", import.meta.url), "utf8");
const articleCard = await readFile(new URL("../src/components/ArticleCard.astro", import.meta.url), "utf8");
const detailPage = await readFile(new URL("../src/pages/news/[id].astro", import.meta.url), "utf8");

test("首页示例包含三档信息", () => {
  assert.deepEqual(new Set(digest.items.map((item) => item.importance)), new Set(["重大", "值得关注", "速览"]));
});

test("每条内容都区分事实与视野", () => {
  for (const item of digest.items) {
    assert.ok(item.summary.length > 0);
    assert.ok(item.perspective.length > 0);
    assert.notEqual(item.summary, item.perspective);
  }
});

test("所有来源都是具体页面", () => {
  for (const item of digest.items) {
    for (const source of item.sources) {
      const url = new URL(source.url);
      assert.notEqual(url.pathname, "/");
    }
  }
});

test("日报不提供分类筛选", () => {
  assert.doesNotMatch(digestView, /CategoryFilter|data-category-filter/);
  assert.doesNotMatch(clientScript, /data-category-filter|applyFilter/);
});

test("编选说明位于页末并默认折叠", () => {
  assert.match(digestView, /end-nav[\s\S]*QualityPanel/);
  assert.match(qualityPanel, /<details class="quality-note"/);
  assert.match(qualityPanel, /<summary>编选说明<\/summary>/);
  assert.doesNotMatch(siteHeader, /href="#quality"/);
});

test("主标题固定两行且新闻保持单列", () => {
  assert.match(digestView, /<h1><span>真正重要的变化，<\/span><em>十分钟读完。<\/em><\/h1>/);
  assert.match(globalCss, /\.masthead h1 > span[^}]*white-space: nowrap/);
  assert.match(globalCss, /\.lead-grid \{ display: block; \}/);
  assert.doesNotMatch(globalCss, /grid-template-columns: repeat\(12/);
  assert.doesNotMatch(globalCss, /grid-template-columns: 1\.25fr 1fr/);
});

test("新闻标题进入站内详情，来源链接保持独立", () => {
  assert.match(articleCard, /href=\{withBase\(detailPath\(item\.id\)\)\}/);
  assert.doesNotMatch(articleCard, /<h3>[\s\S]*href=\{source\.url\}/);
  assert.match(articleCard, /class="source-list"[\s\S]*href=\{entry\.url\}/);
});

test("详情页提供独立事实、分析与具体观察点", () => {
  assert.match(detailPage, /完整事实/);
  assert.match(detailPage, /必要背景/);
  assert.match(detailPage, /为什么重要/);
  assert.match(detailPage, /更深层分析/);
  assert.match(detailPage, /以下为 AI 生成的编辑判断/);
  assert.match(detailPage, /信息边界与不确定性/);
  assert.match(detailPage, /接下来具体看什么/);
  assert.match(detailPage, /原始来源/);
  assert.match(articleCard, /AI 编辑分析/);
  assert.match(globalCss, /\.briefing-copy \{ width: min\(720px, 100%\); margin: 58px auto 0; \}/);
  assert.doesNotMatch(globalCss, /\.briefing-article \{[^}]*display: grid/);
  assert.doesNotMatch(globalCss, /\.briefing-hero \{[^}]*position: sticky/);
});

test("当前首页与详情承担不同的信息任务", () => {
  for (const item of currentDigest.items) {
    assert.ok(item.summary.length >= 100, `${item.id} 的首页摘要应能独立讲清事件`);
    assert.ok(item.perspective.length > 0, `${item.id} 必须保留首页视野`);
    assert.ok(item.detail, `${item.id} 必须有独立详情`);
    assert.ok(item.detail.facts.length > 0);
    assert.ok(item.detail.significance.length > 0);
    assert.ok(item.detail.watch.length > 0);

    const detailParagraphs = [
      item.detail.introduction,
      ...["facts", "background", "significance", "analysis", "reactions", "uncertainties", "watch"]
        .flatMap((field) => item.detail[field] ?? []),
    ];
    assert.ok(detailParagraphs.every((paragraph) => paragraph !== item.summary), `${item.id} 的详情不应整段复制首页`);
    assert.ok(
      detailParagraphs.join("").length > item.summary.length + item.perspective.length,
      `${item.id} 的详情应明显增加信息`,
    );
  }
});
