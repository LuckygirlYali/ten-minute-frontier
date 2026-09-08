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
const detailRequiredFrom = "2026-09-08";
const requiredDetailArrays = ["facts", "significance", "watch"];
const optionalDetailArrays = ["background", "analysis", "reactions", "uncertainties"];
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
    if (!item.title || !item.summary || !item.perspective) fail(file, at, "标题、首页摘要和首页视野均为必填");
    if (typeof item.perspective === "string" && emptyPerspectives.has(item.perspective.trim().replace(/[。！!]$/, ""))) {
      fail(file, `${at}.perspective`, "视野不能使用没有机制或对象的空泛判断");
    }
    if (digest.date >= detailRequiredFrom) {
      for (const word of bannedTitleWords) {
        if (item.title.includes(word)) fail(file, `${at}.title`, `标题禁止使用“${word}”`);
      }
    }
    if (digest.date >= detailRequiredFrom && !item.detail) {
      fail(file, `${at}.detail`, "新版日报必须包含与首页分离的详情内容");
    }
    if (item.detail) {
      if (typeof item.detail.introduction !== "string" || item.detail.introduction.trim() === "") {
        fail(file, `${at}.detail.introduction`, "详情导语为必填");
      }
      for (const field of requiredDetailArrays) {
        if (!Array.isArray(item.detail[field]) || item.detail[field].length === 0) {
          fail(file, `${at}.detail.${field}`, "完整事实、重要性和具体观察点均需至少一段");
        }
      }
      for (const field of [...requiredDetailArrays, ...optionalDetailArrays]) {
        if (item.detail[field] !== undefined) {
          if (!Array.isArray(item.detail[field]) || item.detail[field].length === 0) {
            fail(file, `${at}.detail.${field}`, "详情分节如无内容应省略，不得保留空数组");
          } else if (item.detail[field].some((paragraph) => typeof paragraph !== "string" || paragraph.trim() === "")) {
            fail(file, `${at}.detail.${field}`, "详情段落必须是非空字符串");
          }
        }
      }
      const normalizedSummary = item.summary.replace(/\s+/g, "").trim();
      const detailParagraphs = [item.detail.introduction, ...[...requiredDetailArrays, ...optionalDetailArrays].flatMap((field) => item.detail[field] ?? [])];
      if (detailParagraphs.some((paragraph) => paragraph.replace(/\s+/g, "").trim() === normalizedSummary)) {
        fail(file, `${at}.detail`, "详情页不得整段复制首页摘要");
      }
      const detailLength = detailParagraphs.reduce((length, paragraph) => length + paragraph.trim().length, 0);
      const homeLength = item.summary.trim().length + item.perspective.trim().length;
      if (detailLength <= homeLength) {
        warn(file, `${at}.detail`, "详情信息量未明显高于首页，需人工复核是否真正提供深入理解");
      }
      const watchText = item.detail.watch?.join("") ?? "";
      if (["后续值得持续关注", "未来值得关注", "继续观察后续发展"].some((phrase) => watchText.includes(phrase))) {
        fail(file, `${at}.detail.watch`, "必须给出可验证的具体指标或事件，不能使用泛泛的关注提示");
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
