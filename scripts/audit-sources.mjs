import { readFile, readdir } from "node:fs/promises";
import { selectRssCandidates, sourceGroup } from "./generate-digest.mjs";

const cacheDirectory = "skills/ten-minute-frontier-news/scripts/rss_cache";
const files = (await readdir(cacheDirectory)).filter(n => /^articles_.*\.json$/.test(n)).sort();
if (!files.length) throw new Error("先运行 RSS 采集");
const rss = JSON.parse(await readFile(`${cacheDirectory}/${files.at(-1)}`, "utf8"));
const generatedAt = rss.fetched_at;
const windowStart = new Date(Date.parse(generatedAt) - 36 * 3600000).toISOString();
const selected = selectRssCandidates(rss.articles, {windowStart, generatedAt});
const count = (key) => selected.reduce((out, a) => { const k = key(a); out[k] = (out[k] || 0) + 1; return out; }, {});
console.log(JSON.stringify({healthy:rss.feeds_ok, total:rss.total_feeds, signals:rss.total_articles, selected:selected.length, publishers:count(a=>a.feed_title), groups:count(a=>sourceGroup(a.feed_category)), failures:rss.feed_stats.filter(s=>s.status!=="ok")}, null, 2));
if (rss.feeds_ok < 5 || selected.length < 8) process.exitCode = 1;
