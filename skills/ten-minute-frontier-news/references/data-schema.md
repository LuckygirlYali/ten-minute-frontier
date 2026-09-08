# 日报数据契约

正式文件位于 `src/data/digests/YYYY-MM-DD.json`，文件名与顶层 `date` 一致。

## 顶层字段

- `date`：北京时间日期。
- `generatedAt`：带时区 ISO 时间。
- `windowStart`、`windowEnd`：本期增量采集窗口。
- `thesis`：当天一句话趋势。
- `status`：`published` 或 `no-major-updates`。
- `items`：新闻数组。
- `quality`：信源、原始信号、去重和链接核验计数及说明。

## 新闻字段

- `id`：`YYYY-MM-DD-英文短 slug`，全站稳定且唯一。
- `title`、`summary`。
- `perspective`：可选。只有确有信息增量时填写，不超过 60 字。
- `briefing`：2026-09-09 起必填的站内短报道对象。`conclusion`、`facts`、`whyItMatters` 必填；`context`、`affected`、`uncertainty` 只在有助理解时填写，禁止空字符串。正文目标长度：重大 200–350 字，值得关注 60–120 字，速览 30–60 字；偏离时人工复核，不得为凑字数补写废话。`conclusion` 不超过 60 字。
- `importance`：`重大`、`值得关注`、`速览`。
- `category`：`AI`、`科技`、`商业`、`宏观国际`。
- `kind`：`事实`、`观点`。
- `publishedAt`、`collectedAt`：ISO 时间。
- `tags`：字符串数组。
- `sources`：至少一个 `{name,url,kind,paywalled?}`，`kind` 为 `官方`、`媒体`、`论文`、`观点`。
- `score`：`impact`、`relevance`、`novelty`、`reliability`、`convergence`、`feedback`、`total`。
- `correction`：可选 `{correctedAt,note}`。

`src/data/digests/2026-08-31.json` 仅可作为旧版公共字段示例；新日报以本契约中的 `briefing` 结构为准。写入后始终运行 `node scripts/validate-digests.mjs`，不要凭目测判断合法性。
