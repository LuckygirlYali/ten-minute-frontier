import { readFile, readdir } from "node:fs/promises";
import { basename, resolve } from "node:path";
import process from "node:process";

const directory = resolve("src/data/digests");
const formalPaths = (await readdir(directory)).filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file)).map((file) => resolve(directory, file));
const requestedPaths = process.argv.slice(2).map((file) => resolve(file));
const paths = [...new Set([...formalPaths, ...requestedPaths])].sort();
const requiredCategories = new Set(["AI", "科技", "商业", "宏观国际"]);
const requiredImportance = new Set(["重大", "值得关注", "速览"]);
const requiredKinds = new Set(["事实", "观点"]);
const sourceKinds = new Set(["官方", "媒体", "论文", "观点"]);
const statuses = new Set(["published", "no-major-updates"]);
const seenIds = new Set();
const failures = [];
const warnings = [];
const detailRequiredFrom = "2026-09-08";
const requiredDetailArrays = ["facts", "significance", "watch"];
const optionalDetailArrays = ["background", "analysis", "reactions", "uncertainties"];
const bannedTitleWords = ["重磅", "突发", "史诗级", "彻底变天", "震惊"];
const emptyPerspectives = new Set(["未来值得关注", "影响仍有待观察", "行业竞争进一步加剧", "短期影响取决于后续发展", "机遇与挑战并存"]);

function fail(file, path, message) { failures.push(`${file} · ${path}: ${message}`); }
function warn(file, path, message) { warnings.push(`${file} · ${path}: ${message}`); }
function validIso(value) { return typeof value === "string" && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d{2}:\d{2})$/.test(value); }
function validUrl(value) {
  try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && url.pathname !== "/"; } catch { return false; }
}
function scoreTotal(score) {
  return Number((score.impact * .3 + score.relevance * .25 + score.novelty * .1 + score.reliability * .2 + score.convergence * .1 + score.feedback * .05).toFixed(1));
}

for (const path of paths) {
  const file = basename(path);
  const usesCurrentScoring = requestedPaths.includes(path) || file >= "2026-09-16.json";
  let digest;
  try { digest = JSON.parse(await readFile(path, "utf8")); } catch (error) { fail(file, "JSON", error.message); continue; }
  const expectedDate = file.replace(".json", "");
  if (digest.date !== expectedDate) fail(file, "date", "必须与文件名一致");
  for (const field of ["generatedAt", "windowStart", "windowEnd"]) if (!validIso(digest[field])) fail(file, field, "必须是带时区 ISO 时间");
  if (validIso(digest.windowStart) && validIso(digest.windowEnd) && Date.parse(digest.windowStart) > Date.parse(digest.windowEnd)) fail(file, "windowStart", "不能晚于 windowEnd");
  if (!statuses.has(digest.status)) fail(file, "status", "必须是 published 或 no-major-updates");
  if (typeof digest.thesis !== "string" || !digest.thesis.trim()) fail(file, "thesis", "必须提供当天趋势句");
  if (!Array.isArray(digest.items) || digest.items.length < 1 || digest.items.length > 15) fail(file, "items", "必须包含 1–15 条内容");
  if ((digest.items ?? []).filter((item) => item.importance === "重大").length > 5) fail(file, "items", "重大内容最多 5 条");
  for (const field of ["sourcesChecked", "sourcesHealthy", "rawSignals", "afterDeduplication", "linksVerified"]) {
    if (!Number.isInteger(digest.quality?.[field]) || digest.quality[field] < 0) fail(file, `quality.${field}`, "必须是非负整数");
  }
  if (!Array.isArray(digest.quality?.notes) || digest.quality.notes.some((note) => typeof note !== "string" || !note.trim())) fail(file, "quality.notes", "必须是非空字符串数组");
  if (digest.quality?.sourcesHealthy > digest.quality?.sourcesChecked) fail(file, "quality.sourcesHealthy", "不能超过检查的信源数");
  const uniqueDigestSources = new Set((digest.items ?? []).flatMap((item) => (item.sources ?? []).map((source) => source.url)));
  if (Number.isInteger(digest.quality?.linksVerified) && digest.quality.linksVerified < uniqueDigestSources.size) fail(file, "quality.linksVerified", "不能少于入选的唯一链接数");
  const health = digest.quality?.sourcesChecked ? digest.quality.sourcesHealthy / digest.quality.sourcesChecked : 0;
  if (health < .7 && !(digest.quality?.notes ?? []).some((note) => /低于\s*70%|信源.{0,6}(缺失|异常|不可达)/.test(note))) fail(file, "quality.notes", "信源健康率低于 70% 时必须明确披露");

  for (const [index, item] of (digest.items ?? []).entries()) {
    const at = `items[${index}]`;
    if (!item.id || seenIds.has(item.id)) fail(file, `${at}.id`, "ID 为空或跨日报重复");
    seenIds.add(item.id);
    if (typeof item.id === "string" && !item.id.startsWith(`${digest.date}-`)) fail(file, `${at}.id`, "必须以日报日期开头");
    if (!requiredCategories.has(item.category)) fail(file, `${at}.category`, "类别不合法");
    if (!requiredImportance.has(item.importance)) fail(file, `${at}.importance`, "重要性不合法");
    if (!requiredKinds.has(item.kind)) fail(file, `${at}.kind`, "内容类型不合法");
    if (!item.title || !item.summary || !item.perspective) fail(file, at, "标题、首页摘要和首页视野均为必填");
    if (!validIso(item.publishedAt) || !validIso(item.collectedAt)) fail(file, at, "publishedAt 和 collectedAt 必须是带时区 ISO 时间");
    if (!Array.isArray(item.tags) || item.tags.length === 0 || item.tags.some((tag) => typeof tag !== "string" || !tag.trim())) fail(file, `${at}.tags`, "必须提供非空标签数组");
    if (typeof item.perspective === "string" && emptyPerspectives.has(item.perspective.trim().replace(/[。！!]$/, ""))) fail(file, `${at}.perspective`, "视野不能使用没有机制或对象的空泛判断");
    if (digest.date >= detailRequiredFrom) for (const word of bannedTitleWords) if (item.title.includes(word)) fail(file, `${at}.title`, `标题禁止使用“${word}”`);
    if (digest.date >= detailRequiredFrom && !item.detail) fail(file, `${at}.detail`, "新版日报必须包含与首页分离的详情内容");
    if (item.detail) {
      if (typeof item.detail.introduction !== "string" || !item.detail.introduction.trim()) fail(file, `${at}.detail.introduction`, "详情导语为必填");
      for (const field of requiredDetailArrays) if (!Array.isArray(item.detail[field]) || item.detail[field].length === 0) fail(file, `${at}.detail.${field}`, "完整事实、重要性和具体观察点均需至少一段");
      for (const field of [...requiredDetailArrays, ...optionalDetailArrays]) {
        if (item.detail[field] !== undefined && (!Array.isArray(item.detail[field]) || item.detail[field].length === 0)) fail(file, `${at}.detail.${field}`, "详情分节如无内容应省略，不得保留空数组");
        else if (item.detail[field]?.some((paragraph) => typeof paragraph !== "string" || !paragraph.trim())) fail(file, `${at}.detail.${field}`, "详情段落必须是非空字符串");
      }
      const normalizedSummary = item.summary.replace(/\s+/g, "").trim();
      const detailParagraphs = [item.detail.introduction, ...[...requiredDetailArrays, ...optionalDetailArrays].flatMap((field) => item.detail[field] ?? [])].filter(Boolean);
      if (detailParagraphs.some((paragraph) => paragraph.replace(/\s+/g, "").trim() === normalizedSummary)) fail(file, `${at}.detail`, "详情页不得整段复制首页摘要");
      if (detailParagraphs.reduce((length, paragraph) => length + paragraph.trim().length, 0) <= item.summary.trim().length + item.perspective.trim().length) warn(file, `${at}.detail`, "详情信息量未明显高于首页，需人工复核");
      const watchText = item.detail.watch?.join("") ?? "";
      if (["后续值得持续关注", "未来值得关注", "继续观察后续发展"].some((phrase) => watchText.includes(phrase))) fail(file, `${at}.detail.watch`, "必须给出可验证的具体指标或事件");
    }
    if (!Array.isArray(item.sources) || item.sources.length === 0) fail(file, `${at}.sources`, "至少需要一个来源");
    for (const [sourceIndex, source] of (item.sources ?? []).entries()) {
      if (!validUrl(source.url)) fail(file, `${at}.sources[${sourceIndex}].url`, "必须是具体的 HTTP(S) 内容页");
      if (!sourceKinds.has(source.kind)) fail(file, `${at}.sources[${sourceIndex}].kind`, "来源类型不合法");
      if (!source.name) fail(file, `${at}.sources[${sourceIndex}].name`, "来源名称必填");
    }
    const values = ["impact", "relevance", "novelty", "reliability", "convergence", "feedback"];
    for (const field of values) if (!Number.isFinite(item.score?.[field]) || item.score[field] < 0 || item.score[field] > 100) fail(file, `${at}.score.${field}`, "评分必须在 0–100 之间");
    if (usesCurrentScoring && values.every((field) => Number.isFinite(item.score?.[field])) && Math.abs(item.score.total - scoreTotal(item.score)) > .05) fail(file, `${at}.score.total`, "与编辑政策权重计算结果不一致");
  }
}

if (failures.length) { console.error(`内容验证失败（${failures.length} 项）：\n${failures.map((item) => `- ${item}`).join("\n")}`); process.exit(1); }
if (warnings.length) console.warn(`内容提醒（${warnings.length} 项）：\n${warnings.map((item) => `- ${item}`).join("\n")}`);
console.log(`内容验证通过：${paths.length} 期，${seenIds.size} 条内容。`);
