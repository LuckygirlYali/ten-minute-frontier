import type { NewsBriefing, NewsItem } from "./types";

export function briefingPath(id: string) {
  return `/briefing/${id}/`;
}

export function getBriefing(item: NewsItem): Partial<NewsBriefing> {
  if (item.briefing) return item.briefing;

  return {
    facts: item.summary,
  };
}
