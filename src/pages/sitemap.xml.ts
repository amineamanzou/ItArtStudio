import type { APIRoute } from "astro";

const pages = ["https://itart.studio/", "https://itart.studio/mentions-legales/"];

export const GET: APIRoute = () => new Response(
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages
    .map((page) => `  <url><loc>${page}</loc></url>`)
    .join("\n")}\n</urlset>\n`,
  { headers: { "Content-Type": "application/xml; charset=utf-8" } }
);
