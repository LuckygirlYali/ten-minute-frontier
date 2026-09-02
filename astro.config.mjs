import { defineConfig } from "astro/config";

const repository = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "ten-minute-frontier";
const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

export default defineConfig({
  site: "https://luckygirlyali.github.io",
  base: isGitHubPages ? `/${repository}` : "/",
  output: "static",
  trailingSlash: "always",
});
