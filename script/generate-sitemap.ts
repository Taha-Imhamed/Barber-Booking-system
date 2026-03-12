import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";

const siteUrl = (process.env.SITE_URL || "https://istanbulsalon.online").replace(/\/$/, "");
const publicDir = join(process.cwd(), "client", "public");
const sitemapPath = join(publicDir, "sitemap.xml");

const routes = [
  "/",
  "/auth",
  "/display",
];

function buildSitemapXml() {
  const urls = routes
    .map((path) => `  <url>\n    <loc>${siteUrl}${path}</loc>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export async function generateSitemap() {
  await mkdir(dirname(sitemapPath), { recursive: true });
  await writeFile(sitemapPath, buildSitemapXml(), "utf-8");
  return sitemapPath;
}
