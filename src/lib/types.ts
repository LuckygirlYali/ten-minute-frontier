export const categories = ["AI", "科技", "商业", "宏观国际"] as const;
export const importanceLevels = ["重大", "值得关注", "速览"] as const;
export const contentKinds = ["事实", "观点"] as const;

export type Category = (typeof categories)[number];
export type Importance = (typeof importanceLevels)[number];
export type ContentKind = (typeof contentKinds)[number];

export interface NewsSource {
  name: string;
  url: string;
  kind: "官方" | "媒体" | "论文" | "观点";
  paywalled?: boolean;
}

export interface ScoreBreakdown {
  impact: number;
  relevance: number;
  novelty: number;
  reliability: number;
  convergence: number;
  feedback: number;
  total: number;
}

export interface NewsDetail {
  introduction: string;
  facts: string[];
  background?: string[];
  significance: string[];
  analysis?: string[];
  reactions?: string[];
  uncertainties?: string[];
  watch: string[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  perspective: string;
  detail?: NewsDetail;
  importance: Importance;
  category: Category;
  kind: ContentKind;
  publishedAt: string;
  collectedAt: string;
  tags: string[];
  sources: NewsSource[];
  score: ScoreBreakdown;
  correction?: {
    correctedAt: string;
    note: string;
  };
}

export interface QualityReport {
  sourcesChecked: number;
  sourcesHealthy: number;
  rawSignals: number;
  afterDeduplication: number;
  linksVerified: number;
  notes: string[];
}

export interface DailyDigest {
  date: string;
  generatedAt: string;
  windowStart: string;
  windowEnd: string;
  thesis: string;
  status: "published" | "no-major-updates";
  items: NewsItem[];
  quality: QualityReport;
}
