# 十分钟前沿

每天北京时间 08:17 启动的中文 AI、科技、商业与宏观国际简报（GitHub 调度可能延迟）。网站针对十分钟阅读设计。

## 本地运行

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env`，填入 Supabase 项目 URL 与 anon key 后可测试 GitHub 登录和投票。没有配置时，所有日报内容仍可正常阅读，投票按钮显示“待连接”。

## 内容与质量

日报存放在 `src/data/digests/YYYY-MM-DD.json`。运行：

```bash
npm run validate:content
npm test
npm run build
```

项目内技能 `skills/ten-minute-frontier-news/` 定义每日采集、筛选、事实核验、链接验证和安全发布流程。来源无法核验时宁可不收录；自动化失败时不得覆盖上一期。

## Supabase

1. 创建项目并运行 `supabase/schema.sql`。
2. 在 Authentication → Providers 启用 GitHub。
3. 在 GitHub OAuth App 和 Supabase 中配置部署网址及回调地址。
4. 将 `PUBLIC_SUPABASE_URL` 与 `PUBLIC_SUPABASE_ANON_KEY` 添加到 GitHub Actions secrets。

数据库只保存主动投票，不保存普通浏览和点击。页面只通过安全函数展示汇总票数，不公开用户身份。

## GitHub Pages

仓库设置中将 Pages Source 设为 **GitHub Actions**。推送至 `main` 后，`.github/workflows/deploy.yml` 会构建并发布站点。构建失败不会替换上一版。

## 自动化与恢复

- `.github/workflows/daily-digest.yml` 在 GitHub Actions 云端运行，不依赖个人电脑开机。
- 08:17：采集最近 36 小时内最多 24 条公开 RSS 候选，调用兼容模型进行筛选和中文整理；模型只能引用本次采集到的具体链接。验证内容、逐个检查链接并完整构建后，才提交当天日报。
- 09:37：检查当天文件；缺失时以最多 12 条候选的精简模式自动补跑一次。
- 任一质量门失败都不提交，因此不会覆盖上一期网站。

仓库通过 Actions secret `OPENTECH_API_KEY` 访问 `https://api.opentech.top/v1`。密钥只进入 GitHub Actions 的受保护环境，不写入仓库。变量 `OPENAI_DIGEST_MODEL` 当前设为该服务实际提供、响应更快的 `gpt-5.6-luna`。生成器同时支持通用的 `AI_API_KEY`、`AI_API_BASE_URL`，以及官方 OpenAI 的 `OPENAI_API_KEY` 回退。第三方服务会收到公开 RSS 候选和编辑提示，但不会收到网站访客数据、GitHub 凭据或其他本地文件。

## 故障处理

- 内容验证失败：查看验证器列出的字段或链接，不发布残缺日报。
- 信源不足：发布“今日无重大更新”状态，不降低门槛凑数。
- GitHub 推送失败：保留本地生成物并报告失败，不改写线上内容。
- Supabase 不可用：阅读功能继续工作，投票暂时不可用。

## 第三方来源

见 `THIRD_PARTY_NOTICES.md`。

来源池与筛选规则见 [来源说明](docs/source-selection.md)：参考 BestBlogs 的精选订阅，使用 22 个直连源，按来源类型轮流取样，每个发布方最多两条候选，成稿再做多样性门禁。运行 `node scripts/audit-sources.mjs` 查看最近一次 RSS 采集分布。
