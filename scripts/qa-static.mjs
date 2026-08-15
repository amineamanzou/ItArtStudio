import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const distDirectory = join(root, "dist");
const artifactDirectory = join(root, "qa", "artifacts", "static");

const mimeTypes = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".webm": "video/webm",
  ".xml": "application/xml; charset=utf-8"
};

function resolveRequestPath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const relativePath = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const safePath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  return join(distDirectory, safePath);
}

const server = createServer(async (request, response) => {
  try {
    let filePath = resolveRequestPath(request.url ?? "/");
    let metadata = await stat(filePath);
    if (metadata.isDirectory()) {
      filePath = join(filePath, "index.html");
      metadata = await stat(filePath);
    }
    const body = await readFile(filePath);
    const contentType = mimeTypes[extname(filePath)] ?? "application/octet-stream";
    const range = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);

    if (range) {
      const start = range[1] ? Number(range[1]) : 0;
      const end = range[2] ? Math.min(Number(range[2]), metadata.size - 1) : metadata.size - 1;
      assert(start >= 0 && start <= end && end < metadata.size, `Invalid byte range: ${request.headers.range}`);
      response.writeHead(206, {
        "accept-ranges": "bytes",
        "content-length": end - start + 1,
        "content-range": `bytes ${start}-${end}/${metadata.size}`,
        "content-type": contentType
      });
      response.end(body.subarray(start, end + 1));
      return;
    }

    response.writeHead(200, {
      "accept-ranges": "bytes",
      "content-length": metadata.size,
      "content-type": contentType
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

await mkdir(artifactDirectory, { recursive: true });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address === "object", "Static QA server did not start");
const origin = `http://127.0.0.1:${address.port}`;

const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 800 }
];

const report = [];
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  ?? (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce"
    });
    const page = await context.newPage();
    const browserErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));

    const response = await page.goto(origin, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${viewport.name}: home did not return 200`);
    assert.equal(await page.locator("h1").count(), 1, `${viewport.name}: expected one h1`);
    assert(await page.locator('a[href="mailto:amine@itart.studio"]').count() > 0, `${viewport.name}: contact link missing`);
    assert.equal(browserErrors.length, 0, `${viewport.name}: browser errors: ${browserErrors.join(" | ")}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${viewport.name}: horizontal overflow of ${overflow}px`);

    const heroVideo = page.locator("[data-hero-video]");
    assert.equal(await heroVideo.count(), 1, `${viewport.name}: expected one hero video`);
    await heroVideo.evaluate((video) => new Promise((resolve, reject) => {
      if (video.readyState >= 1) return resolve();
      video.addEventListener("loadedmetadata", resolve, { once: true });
      video.addEventListener("error", () => reject(new Error("hero video failed to load")), { once: true });
    }));
    assert(await heroVideo.evaluate((video) => video.paused), `${viewport.name}: hero video must remain paused`);
    assert(await heroVideo.evaluate((video) => Math.abs(video.currentTime - video.duration) < 0.12), `${viewport.name}: reduced-motion hero must show its final frame`);

    await page.screenshot({ path: join(artifactDirectory, `${viewport.name}-home.png`), fullPage: true });
    report.push({ ...viewport, page: "/", overflow, browserErrors });
    await context.close();
  }

  const motionContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference"
  });
  const motionPage = await motionContext.newPage();
  const motionResponse = await motionPage.goto(origin, { waitUntil: "networkidle" });
  assert.equal(motionResponse?.status(), 200, "Motion QA: home did not return 200");
  const motionVideo = motionPage.locator("[data-hero-video]");
  await motionVideo.evaluate((video) => new Promise((resolve, reject) => {
    if (video.readyState >= 1) return resolve();
    video.addEventListener("loadedmetadata", resolve, { once: true });
    video.addEventListener("error", () => reject(new Error("hero video failed to load")), { once: true });
  }));
  await motionPage.evaluate(() => window.scrollTo(0, 0));
  await motionPage.waitForTimeout(250);
  const startTime = await motionVideo.evaluate((video) => video.currentTime);
  await motionPage.screenshot({ path: join(artifactDirectory, "motion-start.png") });
  const scrollRange = await motionPage.locator("[data-hero-scroll]").evaluate((section) => section.offsetHeight - window.innerHeight);
  await motionPage.evaluate((distance) => window.scrollTo(0, distance * 0.55), scrollRange);
  await motionPage.waitForTimeout(650);
  const middleTime = await motionVideo.evaluate((video) => video.currentTime);
  await motionPage.screenshot({ path: join(artifactDirectory, "motion-middle.png") });
  await motionPage.evaluate((distance) => window.scrollTo(0, distance), scrollRange);
  await motionPage.waitForTimeout(650);
  const endTime = await motionVideo.evaluate((video) => video.currentTime);
  await motionPage.screenshot({ path: join(artifactDirectory, "motion-end.png") });
  assert(startTime < 0.12, `Motion QA: expected start frame, got ${startTime}`);
  assert(middleTime > 1.3 && middleTime < 3.2, `Motion QA: expected middle frame, got ${middleTime}`);
  assert(endTime > 3.72, `Motion QA: expected final frame, got ${endTime}`);
  assert(startTime < middleTime && middleTime < endTime, "Motion QA: scrub time must increase monotonically");
  assert(await motionVideo.evaluate((video) => video.paused), "Motion QA: hero video must not autoplay");
  await motionContext.close();

  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const legalPage = await context.newPage();
  const legalResponse = await legalPage.goto(`${origin}/mentions-legales/`, { waitUntil: "networkidle" });
  assert.equal(legalResponse?.status(), 200, "Legal page did not return 200");
  assert.equal(await legalPage.locator("h1").count(), 1, "Legal page must contain one h1");
  assert(await legalPage.getByText("Société à responsabilité limitée", { exact: false }).count() > 0, "Legal form is missing");
  assert(await legalPage.getByText("915 019 129", { exact: false }).count() > 0, "SIREN is missing");
  const legalOverflow = await legalPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert(legalOverflow <= 1, `Legal page: horizontal overflow of ${legalOverflow}px`);
  await legalPage.screenshot({ path: join(artifactDirectory, "mobile-legal.png"), fullPage: true });
  report.push({ width: 390, height: 844, page: "/mentions-legales/", overflow: legalOverflow, browserErrors: [] });
  await context.close();

  for (const path of ["/", "/mentions-legales/", "/robots.txt", "/sitemap.xml", "/assets/hero-scroll.mp4", "/assets/hero-scroll.webm", "/assets/hero-scroll-poster.jpg"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
  }

  await writeFile(join(artifactDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, screenshots: report.length, report }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
