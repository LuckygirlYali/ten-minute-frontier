import type { NewsDetail, NewsItem } from "./types";

export function detailPath(id: string) {
  return `/news/${id}/`;
}

export function getDetail(item: NewsItem): Partial<NewsDetail> {
  if (item.detail) return item.detail;

  return {
    introduction: item.summary,
    facts: [item.summary],
    significance: [item.perspective],
  };
}
