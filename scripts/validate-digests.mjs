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
const warnings = [];
const briefingRequiredFrom = "2026-09-09";
const requiredBriefingFields = ["conclusion", "facts", "whyItMatters"];
const optionalBriefingFields = ["context", "affected", "uncertainty"];
const briefingLengths = {
  重大: [200, 350],
  值得关注: [60, 120],
  速览: [30, 60],
};
const bannedTitleWords = ["重磅", "突发", "史诗级", "彻底变天", "震惊"];
const emptyPerspectives = new Set([
  "未来值得关注",
  "影响仍有待观察",
  "行业竞争进一步加剧",
  "短期影响取决于后续发展",
  "机遇与挑战并存",
]);

function fail(file, path, message) {
  failures.push(`${file} · ${path}: ${message}`);
}

function warn(file, path, message) {
  warnings.push(`${file} · ${path}: ${message}`);
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
    if (!item.title || !item.summary) fail(file, at, "标题和事实摘要均为必填");
    if (item.perspective !== undefined) {
      if (typeof item.perspective !== "string" || item.perspective.trim() === "") {
        fail(file, `${at}.perspective`, "视野如无信息增量应省略，不得保留空值");
      } else if (digest.date >= briefingRequiredFrom && item.perspective.trim().length > 60) {
        fail(file, `${at}.perspective`, "视野不能超过 60 字");
      } else if (digest.date >= briefingRequiredFrom && emptyPerspectives.has(item.perspective.trim().replace(/[。！!]$/, ""))) {
        fail(file, `${at}.perspective`, "视野不能使用没有机制或对象的空泛判断");
      }
    }
    if (digest.date >= briefingRequiredFrom) {
      for (const word of bannedTitleWords) {
        if (item.title.includes(word)) fail(file, `${at}.title`, `标题禁止使用“${word}”`);
      }
    }
    if (digest.date >= briefingRequiredFrom && !item.briefing) {
      fail(file, `${at}.briefing`, "新版日报必须包含站内短报道");
    }
    if (item.briefing) {
      for (const field of requiredBriefingFields) {
        if (typeof item.briefing[field] !== "string" || item.briefing[field].trim() === "") {
          fail(file, `${at}.briefing.${field}`, "短报道的结论、事实和重要性说明均为必填");
        }
      }
      for (const field of optionalBriefingFields) {
        if (item.briefing[field] !== undefined && (typeof item.briefing[field] !== "string" || item.briefing[field].trim() === "")) {
          fail(file, `${at}.briefing.${field}`, "可选层次如无必要应省略，不得保留空值");
        }
      }
      const briefingLength = [...requiredBriefingFields, ...optionalBriefingFields].reduce(
        (length, field) => length + (item.briefing[field]?.trim().length ?? 0),
        0,
      );
      const [minimum, maximum] = briefingLengths[item.importance] ?? [0, Infinity];
      if (briefingLength < minimum || briefingLength > maximum) {
        warn(file, `${at}.briefing`, `正文共 ${briefingLength} 字，建议复核是否应控制在 ${minimum}–${maximum} 字；不得为凑字数补废话`);
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

if (warnings.length) {
  console.warn(`内容提醒（${warnings.length} 项）：\n${warnings.map((item) => `- ${item}`).join("\n")}`);
}

console.log(`内容验证通过：${files.length} 期，${seenIds.size} 条内容。`);
