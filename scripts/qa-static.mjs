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
const remote = new URL(process.env.QA_ORIGIN ?? `http://127.0.0.1:${address.port}`);
assert(!remote.username && !remote.password && remote.pathname === "/" && !remote.search && !remote.hash, "Invalid QA origin");
assert(remote.protocol === "https:" || (remote.protocol === "http:" && ["localhost", "127.0.0.1"].includes(remote.hostname)), "QA requires HTTPS or loopback");
const origin = remote.origin;

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

const originalNewContext = browser.newContext.bind(browser);
browser.newContext = async (options = {}) => {
  const context = await originalNewContext({...options, serviceWorkers: "block", extraHTTPHeaders: {
    ...(options.extraHTTPHeaders ?? {}), ...(process.env.STAGING_SESSION_ID ? {"X-Staging-Session": process.env.STAGING_SESSION_ID} : {})
  }});
  await context.routeWebSocket("**/*", socket => socket.close());
  const pending = new Set();
  await context.route("**/*", route => {
    const task = (async () => {
      const request = route.request();
      assert.equal(new URL(request.url()).origin, origin, "External QA request refused");
      assert(["GET", "HEAD"].includes(request.method()), "Mutating QA request refused");
      const upstream = await route.fetch({maxRedirects: 0, timeout: 20000});
      try {
        assert(!(upstream.status() >= 300 && upstream.status() < 400), "QA redirect refused");
        if (process.env.STAGING_SESSION_ID) assert.equal(upstream.headers()["x-staging-session"], process.env.STAGING_SESSION_ID);
        await route.fulfill({response: upstream});
      } finally { await upstream.dispose(); }
    })();
    pending.add(task);
    return task.finally(() => pending.delete(task));
  });
  const close = context.close.bind(context);
  context.close = async () => {
    let timer;
    try {
      await Promise.race([
        (async () => {while(pending.size) await Promise.all([...pending]);})(),
        new Promise((_, reject) => {timer = setTimeout(() => reject(new Error("QA handler drain timed out")), 25000);})
      ]);
    } finally {clearTimeout(timer); await close();}
  };
  return context;
};

const retiredHeroVideoPaths = [
  "/assets/hero-scroll.mp4",
  "/assets/hero-scroll.webm",
  "/assets/hero-scroll-poster.jpg",
  "/assets/hero-scroll-mobile.mp4",
  "/assets/hero-scroll-mobile.webm",
  "/assets/hero-scroll-mobile-poster.jpg"
];

function trackMediaRequests(page) {
  const requests = [];
  page.on("request", (request) => {
    if (request.resourceType() === "media" || /\.(?:mp4|webm)(?:[?#]|$)/i.test(request.url())) {
      requests.push(request.url());
    }
  });
  return requests;
}

async function readHeroComposition(page) {
  return page.evaluate(() => {
    const rect = (element) => element?.getBoundingClientRect().toJSON();
    const hero = document.querySelector("[data-hero-scroll]");
    const side = (name) => {
      const field = document.querySelector(`[data-hero-field-side="${name}"]`);
      const visibleStrata = Array.from(field?.querySelectorAll(".hero-stratum") ?? []).filter((stratum) => {
        const box = stratum.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(stratum).visibility !== "hidden";
      });
      return {
        rect: rect(field),
        bodies: visibleStrata.filter((stratum) => stratum.classList.contains("hero-stratum--body")).length,
        echoes: visibleStrata.filter((stratum) => stratum.classList.contains("hero-stratum--ghost")).length,
        runningAnimations: (field?.getAnimations({ subtree: true }) ?? []).filter((animation) => animation.playState === "running").length
      };
    };
    const links = Array.from(document.querySelectorAll(".hero-scroll__practice a"), (link) => {
      const box = link.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { href: link.getAttribute("href"), rect: box.toJSON(), unobscured: hit === link || link.contains(hit) };
    });
    return {
      midpoint: window.innerWidth / 2,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      videoCount: document.querySelectorAll("video").length,
      fieldState: hero?.getAttribute("data-hero-field"),
      art: side("art"),
      it: side("it"),
      practiceArt: rect(document.querySelector(".hero-scroll__practice--art")),
      practiceIt: rect(document.querySelector(".hero-scroll__practice--it")),
      signature: rect(document.querySelector("[data-hero-signature] h1")),
      links
    };
  });
}

function assertHeroHalves(name, hero) {
  const { art, it, midpoint, viewportWidth } = hero;
  assert.equal(hero.videoCount, 0, `${name}: the home must not render a background video`);
  assert(art.rect && it.rect, `${name}: both hero halves must render`);
  assert(Math.abs(art.rect.left) <= 1 && Math.abs(art.rect.right - midpoint) <= 1, `${name}: ART field must fill the left half`);
  assert(Math.abs(it.rect.left - midpoint) <= 1 && Math.abs(it.rect.right - viewportWidth) <= 1, `${name}: IT field must fill the right half`);
  assert(Math.abs(art.rect.width - it.rect.width) <= 1, `${name}: hero halves must carry equal weight`);
  assert(art.bodies === 4 && it.bodies === 4, `${name}: each half must show four strata (${art.bodies}/${it.bodies})`);
  assert(art.echoes === 2 && it.echoes === 2, `${name}: each half must show two echo lines (${art.echoes}/${it.echoes})`);
  assert(hero.practiceArt?.right <= midpoint + 1, `${name}: ART practice text crosses into IT`);
  assert(hero.practiceIt?.left >= midpoint - 1, `${name}: IT practice text crosses into ART`);
  assert(hero.signature, `${name}: hero signature is missing`);
  assert(Math.abs((hero.signature.left + hero.signature.right) / 2 - midpoint) <= 2, `${name}: signature must sit on the seam`);
  assert(hero.signature.left >= 0 && hero.signature.right <= viewportWidth && hero.signature.top >= 0, `${name}: signature must stay inside the viewport`);
  assert.equal(hero.links.length, 2, `${name}: both practice links must render`);
  for (const link of hero.links) {
    assert(link.rect.bottom <= hero.viewportHeight && link.rect.right <= viewportWidth && link.rect.left >= 0, `${name}: ${link.href} must be visible in the first screen`);
    assert(link.unobscured, `${name}: ${link.href} is covered by the hero composition`);
  }
}

async function readStratumTransforms(page) {
  return page.evaluate(() => ["art", "it"].map((side) => Array.from(
    document.querySelectorAll(`[data-hero-field-side="${side}"] .hero-stratum__track`),
    (track) => getComputedStyle(track).transform
  )));
}

async function assertHeroMovesUnprompted(page, name) {
  const before = await readStratumTransforms(page);
  /* Longer than one shared beat, so the stepped IT strata must have advanced. */
  await page.waitForTimeout(1600);
  const after = await readStratumTransforms(page);
  for (const [index, side] of ["art", "it"].entries()) {
    assert(
      before[index].some((transform, stratum) => transform !== after[index][stratum]),
      `${name}: ${side.toUpperCase()} strata must move without interaction`
    );
  }
}

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: "reduce"
    });
    const page = await context.newPage();
    const mediaRequests = trackMediaRequests(page);
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
          serviceArt: rect(".practice-services--art .service-list"),
          serviceIt: rect(".practice-services--it .service-list"),
          methodCadrer: rect(".method-step:nth-child(1)"),
          methodProduire: rect(".method-step:nth-child(2)"),
          methodTransmettre: rect(".method-step:nth-child(3)"),
          methodStepsLeft: rects(".method-step--left"),
          methodStepsRight: rects(".method-step--right"),
          contactArt: rect(".contact-practice--art"),
          contactIt: rect(".contact-practice--it"),
          footerSignature: rect(".split-signature--footer"),
          footerEmailCount: document.querySelectorAll('.site-footer a[href^="mailto:"]').length,
          footerLegalText: document.querySelector(".site-footer__legal")?.textContent ?? "",
          footerStyle: (() => {
            const footer = document.querySelector(".site-footer");
            const style = getComputedStyle(footer);
            return { backgroundColor: style.backgroundColor };
          })(),
          contactLightContinuity: (() => {
            const section = document.querySelector(".contact-section");
            const style = getComputedStyle(section);
            const before = getComputedStyle(section, "::before");
            const after = getComputedStyle(section, "::after");
            const extendsPastSection = (pseudo) => parseFloat(pseudo.top) + parseFloat(pseudo.height) > section.getBoundingClientRect().height;
            return {
              overflow: style.overflow,
              beforeExtends: extendsPastSection(before),
              afterExtends: extendsPastSection(after)
            };
          })(),
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
      assert(splitGeometry.axis.height >= splitGeometry.axis.bodyHeight - 2, `${viewport.name}: central axis does not span the document`);
      assert.deepEqual(splitGeometry.crossingBorders, [], `${viewport.name}: horizontal border crosses the central axis`);
      assert(splitGeometry.methodTitleLeft?.right <= splitGeometry.midpoint + 1, `${viewport.name}: method title left is on the wrong side`);
      assert(splitGeometry.methodTitleRight?.left >= splitGeometry.midpoint - 1, `${viewport.name}: method title right is on the wrong side`);
      assert(splitGeometry.midpoint - splitGeometry.methodTitleLeft?.right < 160, `${viewport.name}: method title left is too far from the axis`);
      assert(splitGeometry.methodTitleRight?.left - splitGeometry.midpoint < 160, `${viewport.name}: method title right is too far from the axis`);
      assert(splitGeometry.methodStepsLeft.every((box) => box.right <= splitGeometry.midpoint + 1), `${viewport.name}: a left method step crosses the axis`);
      assert(splitGeometry.methodStepsRight.every((box) => box.left >= splitGeometry.midpoint - 1), `${viewport.name}: a right method step crosses the axis`);
      assert(splitGeometry.methodProduire?.top > splitGeometry.methodCadrer?.bottom + 24, `${viewport.name}: Produire must sit below Cadrer`);
      assert(splitGeometry.methodTransmettre?.top > splitGeometry.methodProduire?.bottom + 24, `${viewport.name}: Transmettre must sit below Produire`);
      assert(splitGeometry.contactArt?.right <= splitGeometry.midpoint + 1, `${viewport.name}: ART contact is on the wrong side`);
      assert(splitGeometry.contactIt?.left >= splitGeometry.midpoint - 1, `${viewport.name}: IT contact is on the wrong side`);
      assert(splitGeometry.midpoint - splitGeometry.contactArt?.right < 160, `${viewport.name}: ART contact is too far from the axis`);
      assert(splitGeometry.contactIt?.left - splitGeometry.midpoint < 160, `${viewport.name}: IT contact is too far from the axis`);
      assert.equal(splitGeometry.footerEmailCount, 0, `${viewport.name}: footer must not repeat the technical contact email`);
      assert(splitGeometry.footerSignature, `${viewport.name}: footer must reuse the multi-line split signature`);
      assert(Math.abs((splitGeometry.footerSignature?.left + splitGeometry.footerSignature?.right) / 2 - splitGeometry.midpoint) <= 1, `${viewport.name}: footer signature must be centered on the axis`);
      assert(splitGeometry.footerLegalText.includes("Société à responsabilité limitée"), `${viewport.name}: footer legal form must remain SARL`);
      assert.equal(splitGeometry.footerStyle.backgroundColor, "rgba(0, 0, 0, 0)", `${viewport.name}: footer background must remain transparent`);
      assert.equal(splitGeometry.contactLightContinuity.overflow, "visible", `${viewport.name}: contact lights must be allowed to continue into the footer`);
      assert(splitGeometry.contactLightContinuity.beforeExtends && splitGeometry.contactLightContinuity.afterExtends, `${viewport.name}: both contact lights must extend beyond the section`);
      if (viewport.name === "wide-desktop") {
        assert(splitGeometry.serviceArt?.left >= splitGeometry.midpoint - 600, `${viewport.name}: ART services are too far from the axis`);
        assert(splitGeometry.serviceIt?.right <= splitGeometry.midpoint + 600, `${viewport.name}: IT services are too far from the axis`);
        assert(splitGeometry.methodStepsLeft.every((box) => box.left >= splitGeometry.midpoint - 600), `${viewport.name}: a left method step is too far from the axis`);
        assert(splitGeometry.methodStepsRight.every((box) => box.right <= splitGeometry.midpoint + 600), `${viewport.name}: a right method step is too far from the axis`);
      }
      assert(
        splitGeometry.ambience.flat().every((light) => light.content !== "none" && light.backgroundImage.includes("radial-gradient") && light.filter === "none"),
        `${viewport.name}: method and contact ambient lights must be rendered`
      );
    }

    const reducedHero = await readHeroComposition(page);
    assertHeroHalves(viewport.name, reducedHero);
    assert.equal(reducedHero.art.runningAnimations + reducedHero.it.runningAnimations, 0, `${viewport.name}: reduced-motion hero must hold a fixed composition`);
    const reducedTransforms = await readStratumTransforms(page);
    await page.waitForTimeout(1300);
    assert.deepEqual(await readStratumTransforms(page), reducedTransforms, `${viewport.name}: reduced-motion strata must not move`);
    await page.screenshot({ path: join(artifactDirectory, `${viewport.name}-hero-reduced.png`) });

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

    assert.deepEqual(mediaRequests, [], `${viewport.name}: the home must not request video media`);
    await page.screenshot({ path: join(artifactDirectory, `${viewport.name}-home.png`), fullPage: true });
    report.push({ ...viewport, page: "/", overflow, browserErrors, mediaRequests: mediaRequests.length });
    await context.close();
  }

  const motionContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: "no-preference"
  });
  const motionPage = await motionContext.newPage();
  const motionMediaRequests = trackMediaRequests(motionPage);
  const motionResponse = await motionPage.goto(origin, { waitUntil: "networkidle" });
  assert.equal(motionResponse?.status(), 200, "Motion QA: home did not return 200");
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
  const motionHero = await readHeroComposition(motionPage);
  assertHeroHalves("Motion QA", motionHero);
  assert(motionHero.art.runningAnimations > 0 && motionHero.it.runningAnimations > 0, "Motion QA: both halves must animate on arrival");
  assert.equal(motionHero.fieldState, "running", "Motion QA: hero composition must run while visible");
  await motionPage.screenshot({ path: join(artifactDirectory, "motion-start.png") });
  await assertHeroMovesUnprompted(motionPage, "Motion QA");
  await motionPage.screenshot({ path: join(artifactDirectory, "motion-later.png") });

  const scrollRange = await motionPage.locator("[data-hero-scroll]").evaluate((section) => section.offsetHeight - window.innerHeight);
  const signatureAtArrival = await motionPage.locator("[data-hero-signature]").boundingBox();
  await motionPage.evaluate((distance) => window.scrollTo(0, distance * 0.55), scrollRange);
  await motionPage.waitForTimeout(300);
  const signatureMidway = await motionPage.locator("[data-hero-signature]").boundingBox();
  await motionPage.screenshot({ path: join(artifactDirectory, "motion-middle.png") });
  await motionPage.evaluate((distance) => window.scrollTo(0, distance), scrollRange);
  await motionPage.waitForTimeout(300);
  await motionPage.screenshot({ path: join(artifactDirectory, "motion-end.png") });
  assert(
    (signatureAtArrival?.y ?? 0) > (signatureMidway?.y ?? 0),
    "Motion QA: hero signature must rise while the stage is pinned"
  );

  const signature = motionPage.locator("[data-hero-signature]");
  const signatureAtHeroEnd = await signature.boundingBox();
  assert((signatureAtHeroEnd?.y ?? Number.POSITIVE_INFINITY) < 72, "Motion QA: hero signature must compact to the top at the end of the pinned hero");
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
  await motionPage.waitForTimeout(200);
  assert.equal(
    await motionPage.locator("[data-hero-scroll]").getAttribute("data-hero-field"),
    "paused",
    "Motion QA: hero composition must pause once it has left the viewport"
  );
  assert.deepEqual(motionMediaRequests, [], "Motion QA: the home must not request video media");
  await motionContext.close();

  for (const responsiveMotionViewport of [
    { name: "tablet-motion", width: 768, height: 1024 },
    { name: "mobile-motion", width: 390, height: 844 },
    { name: "mobile-320-motion", width: 320, height: 640 }
  ]) {
    const responsiveMotionContext = await browser.newContext({
      viewport: { width: responsiveMotionViewport.width, height: responsiveMotionViewport.height },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference"
    });
    const responsiveMotionPage = await responsiveMotionContext.newPage();
    const responsiveMediaRequests = trackMediaRequests(responsiveMotionPage);
    const response = await responsiveMotionPage.goto(origin, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${responsiveMotionViewport.name}: home did not return 200`);
    const overflow = await responsiveMotionPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(overflow <= 1, `${responsiveMotionViewport.name}: horizontal overflow of ${overflow}px before reveal`);
    const responsiveHero = await readHeroComposition(responsiveMotionPage);
    assertHeroHalves(responsiveMotionViewport.name, responsiveHero);
    assert(responsiveHero.art.runningAnimations > 0 && responsiveHero.it.runningAnimations > 0, `${responsiveMotionViewport.name}: both halves must animate on arrival`);
    await assertHeroMovesUnprompted(responsiveMotionPage, responsiveMotionViewport.name);
    await responsiveMotionPage.screenshot({ path: join(artifactDirectory, `${responsiveMotionViewport.name}-hero.png`) });
    const range = await responsiveMotionPage.locator("[data-hero-scroll]").evaluate((section) => section.offsetHeight - window.innerHeight);
    await responsiveMotionPage.evaluate((distance) => window.scrollTo(0, distance), range);
    await responsiveMotionPage.waitForTimeout(300);
    const compactSignature = await responsiveMotionPage.locator("[data-hero-signature]").boundingBox();
    assert((compactSignature?.y ?? Number.POSITIVE_INFINITY) < 72, `${responsiveMotionViewport.name}: signature must compact to the top after the hero`);
    const scrolledOverflow = await responsiveMotionPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(scrolledOverflow <= 1, `${responsiveMotionViewport.name}: horizontal overflow of ${scrolledOverflow}px after scrolling`);
    assert.deepEqual(responsiveMediaRequests, [], `${responsiveMotionViewport.name}: the home must not request video media`);
    await responsiveMotionContext.close();
  }

  for (const keyboardViewport of [
    { name: "desktop-keyboard", width: 1440, height: 1000 },
    { name: "mobile-keyboard", width: 390, height: 844 }
  ]) {
    const keyboardContext = await browser.newContext({
      viewport: { width: keyboardViewport.width, height: keyboardViewport.height },
      deviceScaleFactor: 1,
      reducedMotion: "no-preference"
    });
    const keyboardPage = await keyboardContext.newPage();
    const keyboardResponse = await keyboardPage.goto(origin, { waitUntil: "networkidle" });
    assert.equal(keyboardResponse?.status(), 200, `${keyboardViewport.name}: home did not return 200`);
    const focusState = () => keyboardPage.evaluate(() => {
      const element = document.activeElement;
      const box = element?.getBoundingClientRect();
      const style = element ? getComputedStyle(element) : undefined;
      const hit = box ? document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) : null;
      return {
        text: element?.textContent?.trim(),
        href: element?.getAttribute("href"),
        outline: style ? `${style.outlineStyle} ${style.outlineWidth}` : "",
        inViewport: Boolean(box && box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth),
        unobscured: Boolean(element && hit && (hit === element || element.contains(hit)))
      };
    });
    await keyboardPage.keyboard.press("Tab");
    assert.equal((await focusState()).href, "#contenu", `${keyboardViewport.name}: first Tab must reach the skip link`);
    for (const expected of ["#expertises-art", "#expertises-it"]) {
      await keyboardPage.keyboard.press("Tab");
      const state = await focusState();
      assert.equal(state.href, expected, `${keyboardViewport.name}: expected focus on ${expected}, got ${state.href}`);
      assert(state.inViewport && state.unobscured, `${keyboardViewport.name}: focused ${expected} must be visible above the composition`);
      assert(!state.outline.startsWith("none") && !state.outline.endsWith(" 0px"), `${keyboardViewport.name}: focused ${expected} needs a visible outline`);
    }
    await keyboardPage.screenshot({ path: join(artifactDirectory, `${keyboardViewport.name}-focus.png`) });
    await keyboardPage.keyboard.press("Enter");
    await keyboardPage.waitForTimeout(1200);
    const target = await keyboardPage.evaluate(() => ({
      hash: window.location.hash,
      top: document.querySelector("#expertises-it")?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY
    }));
    assert.equal(target.hash, "#expertises-it", `${keyboardViewport.name}: Enter must follow the IT practice link`);
    assert(Math.abs(target.top) < keyboardViewport.height / 2, `${keyboardViewport.name}: IT services must scroll into view (top ${target.top}px)`);
    await keyboardContext.close();
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
  const resizedHero = await readHeroComposition(reducedResizePage);
  assertHeroHalves("Reduced resize QA", resizedHero);
  assert.equal(resizedHero.art.runningAnimations + resizedHero.it.runningAnimations, 0, "Reduced resize QA: composition must stay still across breakpoints");
  const resizedSignature = await reducedResizePage.locator("[data-hero-signature]").boundingBox();
  assert((resizedSignature?.y ?? Number.POSITIVE_INFINITY) < 72, "Reduced resize QA: signature must stay compact after a breakpoint change");
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

  const fetchOptions = {redirect: "manual", ...(process.env.STAGING_SESSION_ID ? {headers: {"X-Staging-Session": process.env.STAGING_SESSION_ID}} : {})};
  for (const path of ["/", "/mentions-legales/", "/robots.txt", "/sitemap.xml", "/assets/hero-it.jpg"]) {
    const response = await fetch(`${origin}${path}`, fetchOptions);
    assert.equal(response.status, 200, `${path} returned ${response.status}`);
  }
  for (const path of retiredHeroVideoPaths) {
    const response = await fetch(`${origin}${path}`, fetchOptions);
    assert.equal(response.status, 404, `Retired hero media ${path} returned ${response.status}`);
  }

  await writeFile(join(artifactDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, screenshots: report.length, report }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
