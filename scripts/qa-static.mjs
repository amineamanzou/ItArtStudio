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

const shortLandscapeViewports = [
  { name: "landscape-844", width: 844, height: 390 },
  { name: "landscape-568", width: 568, height: 320 }
];

const viewports = [
  { name: "wide-desktop", width: 1920, height: 1080 },
  { name: "desktop", width: 1440, height: 1000 },
  { name: "short-laptop", width: 1440, height: 650 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 800 }
];

const report = [];
const contrastReport = [];
const motionSampling = { samples: 8, intervalMs: 650 };
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
  return page.evaluate(async () => {
    await document.fonts.ready;
    const rect = (element) => element?.getBoundingClientRect().toJSON();
    const hero = document.querySelector("[data-hero]");
    const side = (name) => {
      const field = hero.querySelector(`[data-hero-field-side="${name}"]`);
      return {
        rect: rect(field),
        artwork: rect(field.querySelector("svg")),
        runningAnimations: field.getAnimations({ subtree: true }).filter((animation) => animation.playState === "running").length
      };
    };
    const links = Array.from(hero.querySelectorAll(".hero__practice a"), (link) => {
      const box = link.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return { href: link.getAttribute("href"), rect: box.toJSON(), unobscured: hit === link || link.contains(hit) };
    });
    const signature = hero.querySelector("h1");
    const words = Array.from(signature.children, (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return { text: element.textContent, rect: rect(range) };
    });
    return {
      midpoint: window.innerWidth / 2,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      videoCount: document.querySelectorAll("video").length,
      fieldState: hero.getAttribute("data-hero-field"),
      hero: rect(hero),
      it: side("it"),
      art: side("art"),
      practiceIt: rect(hero.querySelector(".hero__practice--it")),
      practiceArt: rect(hero.querySelector(".hero__practice--art")),
      taglines: Array.from(hero.querySelectorAll(".hero__practice h2"), (element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        return rect(range);
      }),
      signature: rect(signature),
      words,
      links
    };
  });
}

function assertHeroHalves(name, hero) {
  const { it, art, midpoint, viewportWidth, viewportHeight } = hero;
  const fitsViewport = (rect) => rect.width > 0 && rect.height > 0
    && rect.left >= 0 && rect.right <= viewportWidth && rect.top >= 0 && rect.bottom <= viewportHeight;
  assert.equal(hero.videoCount, 0, `${name}: the home must not render a background video`);
  assert(Math.abs(it.rect.left) <= 1 && Math.abs(it.rect.right - midpoint) <= 1, `${name}: IT field must fill the left half`);
  assert(Math.abs(art.rect.left - midpoint) <= 1 && Math.abs(art.rect.right - viewportWidth) <= 1, `${name}: ART field must fill the right half`);
  assert(Math.abs(art.rect.width - it.rect.width) <= 1, `${name}: hero halves must carry equal weight`);
  assert([it, art].every(({ artwork }) => artwork.width > 0 && artwork.height >= viewportHeight * 0.8), `${name}: artwork must fill the scene`);
  assert(hero.hero.height <= viewportHeight + 1, `${name}: hero must finish within the first screen`);
  assert(hero.practiceIt.right <= midpoint + 1, `${name}: IT practice text crosses into ART`);
  assert(hero.practiceArt.left >= midpoint - 1, `${name}: ART practice text crosses into IT`);
  assert.deepEqual(hero.words.map(({ text }) => text), ["IT", "ART", "STUDIO"], `${name}: studio name must read in order`);
  const [{ rect: itWord }, { rect: artWord }, { rect: studioWord }] = hero.words;
  assert(itWord.right < midpoint && artWord.left > midpoint, `${name}: each practice must sit on its own side of the seam`);
  assert(Math.abs((studioWord.left + studioWord.right) / 2 - midpoint) <= 2, `${name}: STUDIO must sit on the seam`);
  assert(studioWord.width >= viewportWidth * 0.32, `${name}: STUDIO must take up at least a third of the frame`);
  for (const { text, rect } of hero.words) {
    assert(fitsViewport(rect), `${name}: ${text} must fit inside the first screen`);
  }
  assert.equal(hero.taglines.length, 2, `${name}: both practice taglines must render`);
  assert.deepEqual(hero.links.map(({ href }) => href), ["#expertises-it", "#expertises-art"], `${name}: links must follow IT then ART`);
  for (const [index, link] of hero.links.entries()) {
    const tagline = hero.taglines[index];
    assert(fitsViewport(tagline) && tagline.top >= hero.signature.bottom && tagline.bottom <= link.rect.top, `${name}: ${link.href} tagline must fit between the signature and its link`);
    assert(fitsViewport(link.rect), `${name}: ${link.href} must be visible in the first screen`);
    assert(link.rect.height >= 44 && link.unobscured, `${name}: ${link.href} must have a clear 44px hit target`);
  }
}

async function readFieldTransforms(page) {
  return page.evaluate(() => ["it", "art"].map((side) => Array.from(
    document.querySelectorAll(`.hero-field__${side}-body, .hero-field__${side}-light`),
    (element) => getComputedStyle(element).transform
  )));
}

const heroCopySelectors = [
  ".hero .hero-title__it",
  ".hero .hero-title__art",
  ".hero .hero-title__studio",
  ".hero__practice--it h2",
  ".hero__practice--it a",
  ".hero__practice--art h2",
  ".hero__practice--art a"
];

async function waitForPaint(page) {
  // The second callback runs after the preceding frame had a chance to paint.
  await page.evaluate(() => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(undefined)));
  }));
}

/*
 * Hides the copy for each captured frame and compares every text color with the
 * 99.5th-percentile brightest pixel behind it (WCAG relative luminance).
 */
async function assertHeroCopyContrast(page, name, { samples, intervalMs, minimum = 4.5 }) {
  const copies = await page.evaluate((selectors) => selectors.flatMap((selector) => {
    const element = document.querySelector(selector);
    if (!element) return [];
    const range = document.createRange();
    range.selectNodeContents(element);
    const box = range.getBoundingClientRect().toJSON();
    if (box.width === 0 || box.height === 0 || getComputedStyle(element).display === "none") return [];
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    context.fillStyle = getComputedStyle(element).color;
    context.fillRect(0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    return [{ selector, box, rgb: [red, green, blue] }];
  }), heroCopySelectors);
  assert.equal(copies.length, heroCopySelectors.length, `${name}: all visible hero copy must be measured`);

  const worst = Object.fromEntries(copies.map((copy) => [copy.selector, Number.POSITIVE_INFINITY]));
  for (let sample = 0; sample < samples; sample += 1) {
    if (sample > 0) await page.waitForTimeout(intervalMs);
    const style = await page.addStyleTag({
      content: `${heroCopySelectors.join(", ")} { color: transparent !important; text-shadow: none !important; text-decoration: none !important; }`
    });
    let capture;
    try {
      await waitForPaint(page);
      capture = await page.screenshot({ animations: "allow", scale: "css" });
    } finally {
      await style.evaluate((element) => element.remove());
      await waitForPaint(page);
    }
    const ratios = await page.evaluate(async ({ image, copies }) => {
      const linear = Array.from({ length: 256 }, (_, value) => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      const luminance = (r, g, b) => 0.2126 * linear[r] + 0.7152 * linear[g] + 0.0722 * linear[b];
      const picture = new Image();
      picture.src = `data:image/png;base64,${image}`;
      await picture.decode();
      const canvas = document.createElement("canvas");
      canvas.width = picture.naturalWidth;
      canvas.height = picture.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(picture, 0, 0);
      return copies.map(({ selector, box, rgb }) => {
        const left = Math.floor(box.left);
        const top = Math.floor(box.top);
        const width = Math.ceil(box.right) - left;
        const height = Math.ceil(box.bottom) - top;
        if (left < 0 || top < 0 || left + width > canvas.width || top + height > canvas.height) {
          throw new Error(`Contrast region outside captured frame: ${selector}`);
        }
        const { data } = context.getImageData(left, top, width, height);
        const backgrounds = [];
        for (let index = 0; index < data.length; index += 4) {
          backgrounds.push(luminance(data[index], data[index + 1], data[index + 2]));
        }
        backgrounds.sort((left, right) => left - right);
        const brightest = backgrounds[Math.min(backgrounds.length - 1, Math.floor(backgrounds.length * 0.995))];
        return { selector, contrast: (luminance(...rgb) + 0.05) / (brightest + 0.05) };
      });
    }, { image: capture.toString("base64"), copies });
    for (const { selector, contrast } of ratios) {
      worst[selector] = Math.min(worst[selector], contrast);
    }
  }

  for (const [selector, contrast] of Object.entries(worst)) {
    assert(contrast >= minimum, `${name}: ${selector} contrast fell to ${contrast.toFixed(2)}:1 (minimum ${minimum}:1 over ${samples} samples)`);
  }
  return Object.fromEntries(Object.entries(worst).map(([selector, contrast]) => [selector, Number(contrast.toFixed(2))]));
}

async function assertHeroMovesUnprompted(page, name) {
  const before = await readFieldTransforms(page);
  await page.waitForTimeout(1600);
  const after = await readFieldTransforms(page);
  for (const [index, side] of ["it", "art"].entries()) {
    assert(
      before[index].some((transform, stratum) => transform !== after[index][stratum]),
      `${name}: ${side.toUpperCase()} artwork must move without interaction`
    );
  }
}

async function assertFirstScroll(page, name) {
  const before = await page.locator("[data-hero-signature]").boundingBox();
  await page.mouse.move(15, 15);
  await page.mouse.wheel(0, 305);
  await page.waitForFunction(() => {
    const title = document.querySelector("#expertises-it .practice-services__title");
    const service = document.querySelector("#expertises-it .service-item");
    return title.getBoundingClientRect().bottom < window.innerHeight
      && service.getBoundingClientRect().top < window.innerHeight
      && getComputedStyle(service).opacity > 0.9;
  });
  const after = await page.locator("[data-hero-signature]").boundingBox();
  const scroll = await page.evaluate(() => window.scrollY);
  assert(scroll >= 200 && scroll <= 350, `${name}: a single normal wheel step must reveal services`);
  assert(Math.abs(before.y - after.y - scroll) <= 2, `${name}: signature must scroll with the document`);
  await page.screenshot({ path: join(artifactDirectory, `${name}-first-scroll.png`) });
}

async function assertReferenceCaptionGaps(page, name) {
  const marks = await page.locator(".reference-mark").evaluateAll((elements) => elements.map((element) => {
    const image = element.querySelector("img");
    const caption = element.querySelector(".reference-mark__name");
    const tile = element.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();
    const captionBox = caption.getBoundingClientRect();
    return {
      name: caption.textContent.trim(),
      gap: captionBox.top - imageBox.bottom,
      fits: imageBox.width > 0 && imageBox.height > 0 && captionBox.height > 0
        && imageBox.top >= tile.top && captionBox.bottom <= tile.bottom
    };
  }));
  assert.equal(marks.length, 9, `${name}: expected nine sets of logo and caption bounds`);
  for (const mark of marks) {
    assert(mark.fits && mark.gap >= 8, `${name}: ${mark.name} must keep an 8px logo-to-caption gap inside its tile (got ${mark.gap.toFixed(2)}px)`);
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
      if (message.type() === "error") browserErrors.push(`${message.location().url}: ${message.text()}`);
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
      assert(splitGeometry.contactIt?.right <= splitGeometry.midpoint + 1, `${viewport.name}: IT contact is on the wrong side`);
      assert(splitGeometry.contactArt?.left >= splitGeometry.midpoint - 1, `${viewport.name}: ART contact is on the wrong side`);
      assert(splitGeometry.midpoint - splitGeometry.contactIt?.right < 160, `${viewport.name}: IT contact is too far from the axis`);
      assert(splitGeometry.contactArt?.left - splitGeometry.midpoint < 160, `${viewport.name}: ART contact is too far from the axis`);
      assert.equal(splitGeometry.footerEmailCount, 0, `${viewport.name}: footer must not repeat the technical contact email`);
      assert(splitGeometry.footerSignature, `${viewport.name}: footer must reuse the multi-line split signature`);
      assert(Math.abs((splitGeometry.footerSignature?.left + splitGeometry.footerSignature?.right) / 2 - splitGeometry.midpoint) <= 1, `${viewport.name}: footer signature must be centered on the axis`);
      assert(splitGeometry.footerLegalText.includes("Société à responsabilité limitée"), `${viewport.name}: footer legal form must remain SARL`);
      assert.equal(splitGeometry.footerStyle.backgroundColor, "rgba(0, 0, 0, 0)", `${viewport.name}: footer background must remain transparent`);
      assert.equal(splitGeometry.contactLightContinuity.overflow, "visible", `${viewport.name}: contact lights must be allowed to continue into the footer`);
      assert(splitGeometry.contactLightContinuity.beforeExtends && splitGeometry.contactLightContinuity.afterExtends, `${viewport.name}: both contact lights must extend beyond the section`);
      if (viewport.name === "wide-desktop") {
        assert(splitGeometry.serviceIt?.left >= splitGeometry.midpoint - 600, `${viewport.name}: IT services are too far from the axis`);
        assert(splitGeometry.serviceArt?.right <= splitGeometry.midpoint + 600, `${viewport.name}: ART services are too far from the axis`);
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
    const reducedTransforms = await readFieldTransforms(page);
    await page.waitForTimeout(1300);
    assert.deepEqual(await readFieldTransforms(page), reducedTransforms, `${viewport.name}: reduced-motion geometry must not move`);
    await waitForPaint(page);
    await page.screenshot({ path: join(artifactDirectory, `${viewport.name}-hero-reduced.png`) });
    contrastReport.push({ name: viewport.name, motion: "reduce", worst: await assertHeroCopyContrast(page, viewport.name, { samples: 1, intervalMs: 0 }) });

    const referenceLogos = page.locator(".reference-mark img");
    assert.equal(await referenceLogos.count(), 9, `${viewport.name}: expected nine reference logos`);
    const orange = page.locator(".references-practice--it").getByRole("img", { name: "Logo Orange", exact: true });
    assert.equal(await orange.getAttribute("src"), "/assets/references/orange.svg");
    assert.deepEqual(await orange.evaluate((image) => {
      const { filter, mixBlendMode } = getComputedStyle(image);
      return { filter, mixBlendMode };
    }), { filter: "none", mixBlendMode: "normal" }, `${viewport.name}: Orange logo must retain its brand colors`);
    for (const [it, art] of [
      [".practice-services--it", ".practice-services--art"],
      [".references-practice--it", ".references-practice--art"],
      [".contact-practice--it", ".contact-practice--art"]
    ]) {
      const [first, second] = await Promise.all([page.locator(it).boundingBox(), page.locator(art).boundingBox()]);
      assert(viewport.width >= 768 ? first.x < second.x : first.y < second.y, `${viewport.name}: ${it} must precede ${art} in the layout`);
    }
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
    await assertReferenceCaptionGaps(page, viewport.name);
    if (viewport.name === "mobile") {
      await orange.locator("xpath=ancestor::li").screenshot({ path: join(artifactDirectory, "mobile-orange-reference.png") });
    }
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await waitForPaint(page);

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
  contrastReport.push({ name: "desktop-motion", motion: "no-preference", worst: await assertHeroCopyContrast(motionPage, "Motion QA", motionSampling) });

  const itService = motionPage.locator('.practice-services--it .service-item').first();
  const artService = motionPage.locator('.practice-services--art .service-item').first();
  const [itOffset, artOffset] = await Promise.all([
    itService.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41),
    artService.evaluate((element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m41)
  ]);
  assert(itOffset < 0, `Motion QA: IT services must start from the left, got ${itOffset}px`);
  assert(artOffset > 0, `Motion QA: ART services must start from the right, got ${artOffset}px`);

  await assertFirstScroll(motionPage, "desktop");
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
  assert(artReferenceOffset > 0, `Motion QA: ART logos must start from the right, got ${artReferenceOffset}px`);
  assert(itReferenceOffset < 0, `Motion QA: IT logos must start from the left, got ${itReferenceOffset}px`);
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
    await motionPage.locator("[data-hero]").getAttribute("data-hero-field"),
    "paused",
    "Motion QA: hero composition must pause once it has left the viewport"
  );
  assert.deepEqual(motionMediaRequests, [], "Motion QA: the home must not request video media");
  await motionContext.close();

  for (const responsiveMotionViewport of [
    /* Short laptop: sample contrast where artwork and copy are in closest proximity. */
    { name: "short-laptop-motion", width: 1440, height: 650 },
    { name: "tablet-motion", width: 768, height: 1024 },
    { name: "mobile-motion", width: 390, height: 844 },
    { name: "mobile-320-motion", width: 320, height: 640 },
    ...shortLandscapeViewports
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
    if (responsiveMotionViewport.name === "mobile-motion") {
      await responsiveMotionPage.screenshot({ path: join(artifactDirectory, "mobile-motion-start.png") });
    }
    await assertHeroMovesUnprompted(responsiveMotionPage, responsiveMotionViewport.name);
    await responsiveMotionPage.screenshot({ path: join(artifactDirectory, `${responsiveMotionViewport.name}-hero.png`) });
    contrastReport.push({
      name: responsiveMotionViewport.name,
      motion: "no-preference",
      worst: await assertHeroCopyContrast(responsiveMotionPage, responsiveMotionViewport.name, motionSampling)
    });
    await assertFirstScroll(responsiveMotionPage, responsiveMotionViewport.name);
    const scrolledOverflow = await responsiveMotionPage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert(scrolledOverflow <= 1, `${responsiveMotionViewport.name}: horizontal overflow of ${scrolledOverflow}px after scrolling`);
    assert.deepEqual(responsiveMediaRequests, [], `${responsiveMotionViewport.name}: the home must not request video media`);
    await responsiveMotionContext.close();
  }

  for (const keyboardViewport of [
    { name: "desktop-keyboard", width: 1440, height: 1000 },
    { name: "mobile-keyboard", width: 390, height: 844 },
    { name: "mobile-320-reduced-keyboard", width: 320, height: 640, reducedMotion: "reduce" },
    ...shortLandscapeViewports.map((viewport) => ({ ...viewport, name: `${viewport.name}-keyboard` }))
  ]) {
    const keyboardContext = await browser.newContext({
      viewport: { width: keyboardViewport.width, height: keyboardViewport.height },
      deviceScaleFactor: 1,
      reducedMotion: keyboardViewport.reducedMotion ?? "no-preference"
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
        scrollY: window.scrollY,
        outline: style ? `${style.outlineStyle} ${style.outlineWidth}` : "",
        inViewport: Boolean(box && box.top >= 0 && box.bottom <= window.innerHeight && box.left >= 0 && box.right <= window.innerWidth),
        unobscured: Boolean(element && hit && (hit === element || element.contains(hit)))
      };
    });
    const destinations = ["#expertises-it", "#expertises-art"];
    for (const [index, expected] of destinations.entries()) {
      if (index > 0) await keyboardPage.goto(origin, { waitUntil: "networkidle" });
      assertHeroHalves(keyboardViewport.name, await readHeroComposition(keyboardPage));
      await keyboardPage.keyboard.press("Tab");
      assert.equal((await focusState()).href, "#contenu", `${keyboardViewport.name}: first Tab must reach the skip link`);
      for (const href of destinations.slice(0, index + 1)) {
        await keyboardPage.keyboard.press("Tab");
        const state = await focusState();
        assert.equal(state.href, href, `${keyboardViewport.name}: expected focus on ${href}, got ${state.href}`);
        assert(state.inViewport && state.unobscured, `${keyboardViewport.name}: focused ${href} must be visible above the composition`);
        assert(!state.outline.startsWith("none") && !state.outline.endsWith(" 0px"), `${keyboardViewport.name}: focused ${href} needs a visible outline`);
        assert.equal(state.scrollY, 0, `${keyboardViewport.name}: Tab must reach ${href} without scrolling the first screen`);
      }
      await keyboardPage.screenshot({ path: join(artifactDirectory, `${keyboardViewport.name}-${expected.endsWith("-it") ? "it" : "art"}-focus.png`) });
      await keyboardPage.keyboard.press("Enter");
      await keyboardPage.waitForFunction((hash) => {
        const top = document.querySelector(hash).getBoundingClientRect().top;
        return location.hash === hash && top >= -1 && top < window.innerHeight / 2;
      }, expected);
    }
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
  for (const width of [420, 421, 760, 761, 900, 901]) {
    await reducedResizePage.setViewportSize({ width, height: 844 });
    await waitForPaint(reducedResizePage);
    await assertReferenceCaptionGaps(reducedResizePage, `Reference breakpoint QA at ${width}px`);
  }
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
  await writeFile(join(artifactDirectory, "hero-contrast.json"), `${JSON.stringify(contrastReport, null, 2)}\n`);
  console.log(JSON.stringify({ passed: true, screenshots: report.length, report, heroContrast: contrastReport }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
