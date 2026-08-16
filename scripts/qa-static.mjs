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
  { name: "wide-desktop", width: 1920, height: 1080 },
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
    assert.equal(await page.locator(".site-header").count(), 0, `${viewport.name}: decorative header must be absent`);
    assert.equal(await page.getByText("Écrire au studio", { exact: true }).count(), 0, `${viewport.name}: redundant header contact must be absent`);
    assert(await page.locator('a[href="mailto:amine@itart.studio"]').count() > 0, `${viewport.name}: contact link missing`);
    assert.equal(browserErrors.length, 0, `${viewport.name}: browser errors: ${browserErrors.join(" | ")}`);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${viewport.name}: horizontal overflow of ${overflow}px`);

    const fullBleedSections = await page.evaluate(() => [
      ".services-section",
      ".references-section",
      ".method-section",
      ".contact-section",
      ".site-footer"
    ].map((selector) => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return { selector, left: box?.left, right: box?.right, viewport: window.innerWidth };
    }));
    for (const section of fullBleedSections) {
      assert(Math.abs(section.left ?? Number.POSITIVE_INFINITY) <= 1, `${viewport.name}: ${section.selector} must touch the left viewport edge`);
      assert(Math.abs((section.right ?? 0) - section.viewport) <= 1, `${viewport.name}: ${section.selector} must touch the right viewport edge`);
    }

    if (viewport.width >= 768) {
      const splitGeometry = await page.evaluate(() => {
        const midpoint = window.innerWidth / 2;
        const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect().toJSON();
        const rects = (selector) => Array.from(document.querySelectorAll(selector), (element) => element.getBoundingClientRect().toJSON());
        const axis = getComputedStyle(document.body, "::before");
        const crossingBorders = Array.from(document.querySelectorAll("body *")).flatMap((element) => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const crossesMidpoint = box.left < midpoint && box.right > midpoint;
          const hasHorizontalBorder = parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderBottomWidth) > 0;
          return crossesMidpoint && hasHorizontalBorder
            ? [{ tag: element.tagName, className: element.className, borderTop: style.borderTopWidth, borderBottom: style.borderBottomWidth }]
            : [];
        });

        return {
          midpoint,
          axis: {
            display: axis.display,
            left: parseFloat(axis.left),
            height: parseFloat(axis.height),
            bodyHeight: document.body.scrollHeight
          },
          methodTitleLeft: rect(".method-title__left"),
          methodTitleRight: rect(".method-title__right"),
          methodCadrer: rect(".method-step:nth-child(1)"),
          methodProduire: rect(".method-step:nth-child(2)"),
          methodTransmettre: rect(".method-step:nth-child(3)"),
          methodStepsLeft: rects(".method-step--left"),
          methodStepsRight: rects(".method-step--right"),
          contactArt: rect(".contact-practice--art"),
          contactIt: rect(".contact-practice--it"),
          ambience: [".method-section", ".contact-section"].map((selector) => {
            const section = document.querySelector(selector);
            return ["::before", "::after"].map((pseudo) => {
              const style = getComputedStyle(section, pseudo);
              return { content: style.content, backgroundImage: style.backgroundImage, filter: style.filter };
            });
          }),
          crossingBorders
        };
      });

      assert.equal(splitGeometry.axis.display, "block", `${viewport.name}: central axis must be displayed`);
      assert(Math.abs(splitGeometry.axis.left - splitGeometry.midpoint) <= 1, `${viewport.name}: central axis is not aligned to 50%`);
      assert(splitGeometry.axis.height >= splitGeometry.axis.bodyHeight - 1, `${viewport.name}: central axis does not span the document`);
      assert.deepEqual(splitGeometry.crossingBorders, [], `${viewport.name}: horizontal border crosses the central axis`);
      assert(splitGeometry.methodTitleLeft?.right <= splitGeometry.midpoint + 1, `${viewport.name}: method title left is on the wrong side`);
      assert(splitGeometry.methodTitleRight?.left >= splitGeometry.midpoint - 1, `${viewport.name}: method title right is on the wrong side`);
      assert(splitGeometry.methodStepsLeft.every((box) => box.right <= splitGeometry.midpoint + 1), `${viewport.name}: a left method step crosses the axis`);
      assert(splitGeometry.methodStepsRight.every((box) => box.left >= splitGeometry.midpoint - 1), `${viewport.name}: a right method step crosses the axis`);
      assert(splitGeometry.methodProduire?.top > splitGeometry.methodCadrer?.bottom + 24, `${viewport.name}: Produire must sit below Cadrer`);
      assert(splitGeometry.methodTransmettre?.top > splitGeometry.methodProduire?.bottom + 24, `${viewport.name}: Transmettre must sit below Produire`);
      assert(splitGeometry.contactArt?.right <= splitGeometry.midpoint + 1, `${viewport.name}: ART contact is on the wrong side`);
      assert(splitGeometry.contactIt?.left >= splitGeometry.midpoint - 1, `${viewport.name}: IT contact is on the wrong side`);
      assert(
        splitGeometry.ambience.flat().every((light) => light.content !== "none" && light.backgroundImage.includes("radial-gradient") && light.filter === "none"),
        `${viewport.name}: method and contact ambient lights must be rendered`
      );
    }

    const expectedHeroGroup = viewport.width > 1100 ? "wide" : viewport.width > 760 ? "split" : "mobile";
    const activeHeroGroup = page.locator(`[data-hero-video-group="${expectedHeroGroup}"]`);
    assert.equal(await activeHeroGroup.count(), 1, `${viewport.name}: expected ${expectedHeroGroup} hero group`);
    assert(await activeHeroGroup.evaluate((element) => getComputedStyle(element).display !== "none"), `${viewport.name}: ${expectedHeroGroup} hero group must be visible`);
    const activeHeroVideos = activeHeroGroup.locator("[data-hero-video]");
    assert.equal(await activeHeroVideos.count(), expectedHeroGroup === "split" ? 2 : 1, `${viewport.name}: unexpected active hero video count`);
    for (let videoIndex = 0; videoIndex < await activeHeroVideos.count(); videoIndex += 1) {
      const heroVideo = activeHeroVideos.nth(videoIndex);
      await heroVideo.evaluate((video) => new Promise((resolve, reject) => {
        if (video.readyState >= 1) return resolve();
        video.addEventListener("loadedmetadata", resolve, { once: true });
        video.addEventListener("error", () => reject(new Error("hero video failed to load")), { once: true });
      }));
      assert(await heroVideo.evaluate((video) => video.paused), `${viewport.name}: hero video must remain paused`);
      assert(await heroVideo.evaluate((video) => Math.abs(video.currentTime - video.duration) < 0.12), `${viewport.name}: reduced-motion hero must show its final frame`);
    }
    if (expectedHeroGroup === "mobile") {
      const mobileDimensions = await activeHeroVideos.first().evaluate((video) => ({ width: video.videoWidth, height: video.videoHeight }));
      assert(mobileDimensions.height > mobileDimensions.width, `${viewport.name}: mobile hero must use a vertical source`);
      assert(Math.abs(mobileDimensions.width / mobileDimensions.height - 9 / 16) < 0.01, `${viewport.name}: mobile hero must use a 9:16 source`);
    }

    const reducedSignature = page.locator("[data-hero-signature]");
    assert.equal(await reducedSignature.count(), 1, `${viewport.name}: persistent hero signature is missing`);
    const reducedSignatureBox = await reducedSignature.boundingBox();
    assert((reducedSignatureBox?.y ?? Number.POSITIVE_INFINITY) < 72, `${viewport.name}: reduced-motion signature must be compact at the top`);

    const referenceLogos = page.locator(".reference-mark img");
    assert.equal(await referenceLogos.count(), 8, `${viewport.name}: expected eight reference logos`);
    assert.equal(await page.getByText("Des organisations accompagnées sur des projets critiques qui nous font confiance.").count(), 0, `${viewport.name}: references statement must be removed`);
    assert(
      await page.locator(".reference-mark__visual").evaluateAll((visuals) => visuals.every((visual) => {
        const style = getComputedStyle(visual);
        return style.clipPath === "none" && style.filter === "none" && style.transform === "none";
      })),
      `${viewport.name}: reduced-motion reference logos must remain immediately visible`
    );
    for (let index = 0; index < await referenceLogos.count(); index += 1) {
      const logo = referenceLogos.nth(index);
      await logo.scrollIntoViewIfNeeded();
      await logo.evaluate((image) => new Promise((resolve, reject) => {
        if (image.complete) {
          return image.naturalWidth > 0
            ? resolve()
            : reject(new Error(`reference logo completed without pixels: ${image.src}`));
        }
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", () => reject(new Error(`reference logo failed to load: ${image.src}`)), { once: true });
      }));
    }
    assert(
      await referenceLogos.evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)),
      `${viewport.name}: every reference logo must decode successfully`
    );
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(50);

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
  const motionVideo = motionPage.locator('[data-hero-video-group="wide"] [data-hero-video]');
  await motionVideo.evaluate((video) => new Promise((resolve, reject) => {
    if (video.readyState >= 1) return resolve();
    video.addEventListener("loadedmetadata", resolve, { once: true });
    video.addEventListener("error", () => reject(new Error("hero video failed to load")), { once: true });
  }));
  await motionPage.evaluate(() => window.scrollTo(0, 0));
  await motionPage.waitForTimeout(250);
  const initialSideRevealState = await motionPage.locator('[data-reveal="split-left"], [data-reveal="split-right"]').evaluateAll((elements) => elements.map((element) => ({
    reveal: element.getAttribute("data-reveal"),
    offset: new DOMMatrixReadOnly(getComputedStyle(element).transform).m41,
    opacity: getComputedStyle(element).opacity
  })));
  assert(initialSideRevealState.length > 0, "Motion QA: expected side-aware reveal elements");
  for (const state of initialSideRevealState) {
    assert(Number(state.opacity) < 0.01, `Motion QA: ${state.reveal} element must start hidden`);
    if (state.reveal === "split-left") {
      assert(state.offset < 0, `Motion QA: split-left element must start from the left, got ${state.offset}px`);
    } else {
      assert(state.offset > 0, `Motion QA: split-right element must start from the right, got ${state.offset}px`);
    }
  }
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

  const signature = motionPage.locator("[data-hero-signature]");
  const signatureAtHeroEnd = await signature.boundingBox();
  assert((signatureAtHeroEnd?.y ?? Number.POSITIVE_INFINITY) < 72, "Motion QA: hero signature must compact to the top at the end of the scrub");
  await motionPage.evaluate((distance) => window.scrollTo(0, distance + window.innerHeight * 0.75), scrollRange);
  await motionPage.waitForTimeout(200);
  const signatureAfterHero = await signature.boundingBox();
  assert(Math.abs((signatureAfterHero?.y ?? 9999) - (signatureAtHeroEnd?.y ?? 0)) < 2, "Motion QA: compact hero signature must remain fixed after the hero");

  const artService = motionPage.locator('.service-item[data-reveal="split-left"]').first();
  const itService = motionPage.locator('.service-item[data-reveal="split-right"]').first();
  const [artOffset, itOffset] = await Promise.all([
    artService.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41),
    itService.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)
  ]);
  assert(artOffset < 0, `Motion QA: ART services must start from the left, got ${artOffset}px`);
  assert(itOffset > 0, `Motion QA: IT services must start from the right, got ${itOffset}px`);
  await artService.scrollIntoViewIfNeeded();
  await itService.scrollIntoViewIfNeeded();
  await motionPage.waitForTimeout(1100);
  assert(await artService.evaluate((element) => element.classList.contains("is-revealed")), "Motion QA: ART service did not reveal");
  assert(await itService.evaluate((element) => element.classList.contains("is-revealed")), "Motion QA: IT service did not reveal");

  const artReferenceMark = motionPage.locator('.references-practice--art [data-reveal-kind="logo"]').first();
  const itReferenceMark = motionPage.locator('.references-practice--it [data-reveal-kind="logo"]').first();
  const [artReferenceOffset, itReferenceOffset] = await Promise.all([
    artReferenceMark.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41),
    itReferenceMark.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)
  ]);
  assert(artReferenceOffset < 0, `Motion QA: ART logos must start from the left, got ${artReferenceOffset}px`);
  assert(itReferenceOffset > 0, `Motion QA: IT logos must start from the right, got ${itReferenceOffset}px`);
  assert.equal(await artReferenceMark.locator(".reference-mark__visual").evaluate((element) => getComputedStyle(element).clipPath), "inset(100% 0px 0px)", "Motion QA: reference must start masked");
  await artReferenceMark.scrollIntoViewIfNeeded();
  await itReferenceMark.scrollIntoViewIfNeeded();
  await motionPage.waitForTimeout(1100);
  const referenceRevealState = await artReferenceMark.evaluate((element) => ({
    className: element.className,
    documentClassName: document.documentElement.className,
    rect: element.getBoundingClientRect().toJSON(),
    scrollY: window.scrollY,
    viewportHeight: window.innerHeight
  }));
  assert(
    await artReferenceMark.evaluate((element) => element.classList.contains("is-revealed")),
    `Motion QA: reference did not reveal: ${JSON.stringify(referenceRevealState)}`
  );
  assert(await itReferenceMark.evaluate((element) => element.classList.contains("is-revealed")), "Motion QA: IT reference did not reveal");
  assert.equal(await artReferenceMark.locator(".reference-mark__visual").evaluate((element) => getComputedStyle(element).clipPath), "inset(0px)", "Motion QA: reference mask did not open");

  for (const selector of [
    ".method-title__left",
    ".method-title__right",
    ".method-step:nth-child(1)",
    ".method-step:nth-child(2)",
    ".method-step:nth-child(3)",
    ".contact-practice--art",
    ".contact-practice--it"
  ]) {
    const item = motionPage.locator(selector);
    await item.scrollIntoViewIfNeeded();
    await motionPage.waitForTimeout(900);
    assert(await item.evaluate((element) => element.classList.contains("is-revealed")), `Motion QA: ${selector} did not reveal on scroll`);
  }
  await motionContext.close();

  for (const responsiveMotionViewport of [
    { name: "tablet-motion", width: 768, height: 1024, group: "split", videos: 2 },
    { name: "mobile-motion", width: 390, height: 844, group: "mobile", videos: 1 }
  ]) {
    const responsiveMotionContext = await browser.newContext({
      viewport: { width: responsiveMotionViewport.width, height: responsiveMotionViewport.height },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference"
    });
    const responsiveMotionPage = await responsiveMotionContext.newPage();
    const response = await responsiveMotionPage.goto(origin, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${responsiveMotionViewport.name}: home did not return 200`);
    const group = responsiveMotionPage.locator(`[data-hero-video-group="${responsiveMotionViewport.group}"]`);
    const videos = group.locator("[data-hero-video]");
    assert.equal(await videos.count(), responsiveMotionViewport.videos, `${responsiveMotionViewport.name}: unexpected video count`);
    for (let index = 0; index < await videos.count(); index += 1) {
      await videos.nth(index).evaluate((video) => new Promise((resolve, reject) => {
        if (video.readyState >= 1) return resolve();
        video.addEventListener("loadedmetadata", resolve, { once: true });
        video.addEventListener("error", () => reject(new Error("responsive hero video failed to load")), { once: true });
      }));
    }
    const range = await responsiveMotionPage.locator("[data-hero-scroll]").evaluate((section) => section.offsetHeight - window.innerHeight);
    await responsiveMotionPage.evaluate((distance) => window.scrollTo(0, distance * 0.55), range);
    await responsiveMotionPage.waitForTimeout(700);
    const times = await videos.evaluateAll((elements) => elements.map((video) => video.currentTime));
    assert(times.every((time) => time > 1.3 && time < 3.2), `${responsiveMotionViewport.name}: active videos did not scrub to the middle frame: ${times.join(", ")}`);
    if (times.length === 2) {
      assert(Math.abs(times[0] - times[1]) < 0.05, `${responsiveMotionViewport.name}: split videos are not synchronized: ${times.join(", ")}`);
    }
    await responsiveMotionContext.close();
  }

  const reducedResizeContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce"
  });
  const reducedResizePage = await reducedResizeContext.newPage();
  const reducedResizeResponse = await reducedResizePage.goto(origin, { waitUntil: "networkidle" });
  assert.equal(reducedResizeResponse?.status(), 200, "Reduced resize QA: home did not return 200");
  await reducedResizePage.setViewportSize({ width: 768, height: 1024 });
  await reducedResizePage.waitForTimeout(350);
  const resizedSplitVideos = reducedResizePage.locator('[data-hero-video-group="split"] [data-hero-video]');
  const resizedTimes = await resizedSplitVideos.evaluateAll((videos) => videos.map((video) => ({
    currentTime: video.currentTime,
    duration: video.duration
  })));
  assert.equal(resizedTimes.length, 2, "Reduced resize QA: split pair is missing after breakpoint change");
  assert(
    resizedTimes.every(({ currentTime, duration }) => Number.isFinite(duration) && Math.abs(currentTime - duration) < 0.12),
    `Reduced resize QA: newly active split videos must show the final frame: ${JSON.stringify(resizedTimes)}`
  );
  await reducedResizeContext.close();

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

  for (const path of ["/", "/mentions-legales/", "/robots.txt", "/sitemap.xml", "/assets/hero-scroll.mp4", "/assets/hero-scroll.webm", "/assets/hero-scroll-poster.jpg", "/assets/hero-scroll-mobile.mp4", "/assets/hero-scroll-mobile.webm", "/assets/hero-scroll-mobile-poster.jpg"]) {
    const response = await fetch(`${origin}${path}`);
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
  }

  await writeFile(join(artifactDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, screenshots: report.length, report }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
