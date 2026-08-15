import { defineConfig } from "astro/config";

const site = process.env.SITE_URL;
const base = process.env.BASE_PATH;

export default defineConfig({
  output: "static",
  devToolbar: {
    enabled: false
  },
  ...(site ? { site } : {}),
  ...(base ? { base } : {})
});
