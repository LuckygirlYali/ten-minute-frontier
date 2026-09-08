import type { DailyDigest, NewsItem } from "./types";

const modules = import.meta.glob<{ default: DailyDigest }>("../data/digests/*.json", {
  eager: true,
});

export const digests = Object.values(modules)
  .map((module) => module.default)
  .sort((a, b) => b.date.localeCompare(a.date));

export const latestDigest = digests[0];

export function formatChineseDate(date: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date(`${date}T00:00:00+08:00`));
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function readingMinutes(items: NewsItem[]) {
  const characters = items.reduce(
    (sum, item) => sum + item.title.length + item.summary.length + (item.perspective?.length ?? 0),
    0,
  );
  return Math.max(1, Math.round(characters / 420));
}

export function digestPath(date: string) {
  return `/archive/${date}/`;
}
