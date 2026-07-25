import { defineConfig } from "astro/config";

const isGitHubPages = process.env.GITHUB_PAGES === "true";
const site = process.env.SITE_URL ?? (isGitHubPages ? "https://amineamanzou.github.io" : undefined);
const base = process.env.BASE_PATH ?? (isGitHubPages ? "/ItArtStudio" : undefined);

export default defineConfig({
  output: "static",
  devToolbar: {
    enabled: false
  },
  ...(site ? { site } : {}),
  ...(base ? { base } : {})
});
