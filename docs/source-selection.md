# 来源发现与筛选

本轮借鉴 BestBlogs 的精选订阅目录和多维内容评价思想，保留本站独立编辑政策。没有安装 BestBlogs 后台，也没有将它的模型评分当作事实证据。

来源目录参考：
- https://github.com/ginobefun/BestBlogs/blob/main/BestBlogs_RSS_Articles.opml
- https://github.com/plenaryapp/awesome-rss-feeds
- 美联储官方订阅目录 https://www.federalreserve.gov/feeds/feeds.htm

优先使用发布方原生 RSS：OpenAI、Hugging Face、LangChain、AWS、Meta、Google Cloud 等来自 BestBlogs 清单的直连订阅；增加 BBC 商业和美联储政策，保留研究、中文媒体和专业媒体。来源数量不代表每天都有新内容。

RSSHub 是没有原生订阅时的候选适配层。目前新增来源已有原生 RSS，无需依赖公共 RSSHub 实例或把第三方聚合源作为唯一入口；本轮没有部署 RSSHub 或 TrendRadar。

候选保持 36 小时窗口，标准模式最多送入 14 条并生成 4 条，恢复模式最多送入 10 条并生成 3 条，以降低第三方模型网关超时概率。候选按官方、商业政策、研究、国际科技、中文媒体、发现线索轮流取样；按 URL 域名合并发布方，同源最多两条，“发现线索”组最多两条，候选不足也不突破上限。历史 URL 在送给模型前去重。

模型按主体、动作和时间合并事件后评价影响、相关性、新颖性、可靠性和多源关注，不以语言、热度或发稿频率代替重要性。语义事件合并仍由模型完成，并非经过确定性事实核查。

最终成稿三条及以上至少三个发布方，每个发布方最多参与两条且不超过半数向上取整；禁止相同来源文章被拆成多条。可信内容少时允许少报，不能为多样性凑数。违反门禁停止发布。

运行 `python3 skills/ten-minute-frontier-news/scripts/rss_fetch.py` 后运行 `node scripts/audit-sources.mjs` 查看真实健康度及候选分布。抓取状态保存在忽略的缓存中，不改写版本化来源清单。缺失日期的文章不冒充新文章；含时区日期统一转换 UTC。

限制：目前自动流程仍以 RSS 提供的材料为基础；链接可达检查不等于全文事实核查，也没有实现全网主动搜索。高影响事件仍需要原文与独立报道支持。
