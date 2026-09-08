import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const directory = resolve("src/data/digests");
const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
const requiredCategories = new Set(["AI", "科技", "商业", "宏观国际"]);
const requiredImportance = new Set(["重大", "值得关注", "速览"]);
const requiredKinds = new Set(["事实", "观点"]);
const seenIds = new Set();
const failures = [];
const briefingRequiredFrom = "2026-09-09";
const briefingFields = ["conclusion", "facts", "context", "impact", "affected", "uncertainty"];

function fail(file, path, message) {
  failures.push(`${file} · ${path}: ${message}`);
}

function validUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && url.pathname !== "/";
  } catch {
    return false;
  }
}

for (const file of files) {
  const digest = JSON.parse(await readFile(resolve(directory, file), "utf8"));
  if (digest.date !== file.replace(".json", "")) fail(file, "date", "必须与文件名一致");
  if (!Array.isArray(digest.items) || digest.items.length === 0) fail(file, "items", "至少需要一条内容");
  for (const [index, item] of (digest.items ?? []).entries()) {
    const at = `items[${index}]`;
    if (!item.id || seenIds.has(item.id)) fail(file, `${at}.id`, "ID 为空或跨日报重复");
    seenIds.add(item.id);
    if (!requiredCategories.has(item.category)) fail(file, `${at}.category`, "类别不合法");
    if (!requiredImportance.has(item.importance)) fail(file, `${at}.importance`, "重要性不合法");
    if (!requiredKinds.has(item.kind)) fail(file, `${at}.kind`, "内容类型不合法");
    if (!item.title || !item.summary || !item.perspective) fail(file, at, "标题、事实摘要和视野均为必填");
    if (digest.date >= briefingRequiredFrom && !item.briefing) {
      fail(file, `${at}.briefing`, "新版日报必须包含站内短报道");
    }
    if (item.briefing) {
      for (const field of briefingFields) {
        if (typeof item.briefing[field] !== "string" || item.briefing[field].trim() === "") {
          fail(file, `${at}.briefing.${field}`, "短报道各层次均为必填");
        }
      }
      const briefingLength = briefingFields.reduce(
        (length, field) => length + (item.briefing[field]?.trim().length ?? 0),
        0,
      );
      if (briefingLength < 150 || briefingLength > 300) {
        fail(file, `${at}.briefing`, `正文共 ${briefingLength} 字，必须控制在 150–300 字`);
      }
      if ((item.briefing.conclusion?.trim().length ?? 0) > 60) {
        fail(file, `${at}.briefing.conclusion`, "一句话结论不能超过 60 字");
      }
    }
    if (!Array.isArray(item.sources) || item.sources.length === 0) fail(file, `${at}.sources`, "至少需要一个来源");
    for (const [sourceIndex, source] of (item.sources ?? []).entries()) {
      if (!validUrl(source.url)) fail(file, `${at}.sources[${sourceIndex}].url`, "必须是具体的 HTTP(S) 内容页");
    }
    const values = ["impact", "relevance", "novelty", "reliability", "convergence", "feedback"];
    for (const field of values) {
      if (!Number.isFinite(item.score?.[field]) || item.score[field] < 0 || item.score[field] > 100) {
        fail(file, `${at}.score.${field}`, "评分必须在 0–100 之间");
      }
    }
  }
}

if (failures.length) {
  console.error(`内容验证失败（${failures.length} 项）:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log(`内容验证通过：${files.length} 期，${seenIds.size} 条内容。`);
