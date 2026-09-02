import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const digest = JSON.parse(await readFile(new URL("../src/data/digests/2026-08-31.json", import.meta.url)));

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
