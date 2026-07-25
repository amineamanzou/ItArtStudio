import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import Module from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const startedAt = Date.now();
const port = Number(process.env.QA_PORT ?? 4331);
const baseUrl = process.env.QA_BASE_URL ?? `http://127.0.0.1:${port}/?qa=1`;
const qaMode = (() => {
  try {
    return new URL(baseUrl).searchParams.has("qa");
  } catch {
    return /[?&]qa(?:=|&|$)/.test(baseUrl);
  }
})();
const outputRoot = path.join(root, "qa", "artifacts", new Date().toISOString().replace(/[:.]/g, "-"));
const screenshotsDir = path.join(outputRoot, "screenshots");
const reportJsonPath = path.join(outputRoot, "report.json");
const reportMdPath = path.join(outputRoot, "report.md");

const scenarios = [];
const failures = [];
const consoleMessages = [];
let screenshotIndex = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fail(message, details = {}) {
  failures.push({ message, details });
}

function pass(name, details = {}) {
  scenarios.push({ name, status: "pass", details });
  console.log(`[qa] pass ${name}`);
}

function scenarioFail(name, message, details = {}) {
  const entry = { name, status: "fail", message, details };
  scenarios.push(entry);
  fail(`${name}: ${message}`, details);
  console.log(`[qa] fail ${name}: ${message}`);
}

function attachPageDiagnostics(page, label) {
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push({ page: label, type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => consoleMessages.push({ page: label, type: "pageerror", text: error.message }));
}

function loadPlaywright() {
  try {
    return require("playwright");
  } catch {
    const wrapperPath = "/run/current-system/sw/bin/playwright";
    if (!fs.existsSync(wrapperPath)) {
      throw new Error("Playwright module not found and system playwright wrapper is unavailable.");
    }

    const wrapper = fs.readFileSync(wrapperPath, "utf8");
    const nodePathMatch = wrapper.match(/export NODE_PATH="([^$"]+)/);
    if (!nodePathMatch) {
      throw new Error(`Could not infer NODE_PATH from ${wrapperPath}.`);
    }

    process.env.NODE_PATH = process.env.NODE_PATH
      ? `${nodePathMatch[1]}:${process.env.NODE_PATH}`
      : nodePathMatch[1];
    Module._initPaths();
    return require("playwright");
  }
}

function startServer() {
  const child = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32"
  });

  const logs = [];
  const record = (chunk) => {
    const text = chunk.toString();
    logs.push(text);
    process.stdout.write(text);
  };

  child.stdout.on("data", record);
  child.stderr.on("data", record);

  return { child, logs };
}

async function waitForServer(server) {
  const started = Date.now();
  let lastError = "";
  let consecutiveReadyChecks = 0;

  while (Date.now() - started < 45_000) {
    if (server.child.exitCode !== null) {
      throw new Error(`Dev server exited early with code ${server.child.exitCode}.\n${server.logs.join("")}`);
    }

    try {
      const response = await fetch(baseUrl);
      const body = await response.text();
      if (response.ok && body.includes("studio-map-canvas")) {
        consecutiveReadyChecks += 1;
      } else {
        consecutiveReadyChecks = 0;
      }

      if (consecutiveReadyChecks >= 2) {
        return;
      }
      lastError = `HTTP ${response.status}, ready checks ${consecutiveReadyChecks}`;
    } catch (error) {
      consecutiveReadyChecks = 0;
      lastError = error instanceof Error ? error.message : String(error);
    }

    await wait(900);
  }

  throw new Error(`Dev server did not respond at ${baseUrl}: ${lastError}`);
}

async function stopServer(server) {
  if (server.child.exitCode !== null) {
    return;
  }

  if (process.platform === "win32") {
    server.child.kill("SIGINT");
  } else {
    process.kill(-server.child.pid, "SIGINT");
  }
  await Promise.race([
    new Promise((resolve) => server.child.once("exit", resolve)),
    wait(4_000).then(() => {
      if (server.child.exitCode === null) {
        if (process.platform === "win32") {
          server.child.kill("SIGTERM");
        } else {
          process.kill(-server.child.pid, "SIGTERM");
        }
      }
    })
  ]);
}

async function getQaSnapshot(page) {
  return page.evaluate(() => {
    const qa = window.__IT_ART_STUDIO_QA__;
    return qa ? JSON.parse(JSON.stringify(qa)) : null;
  });
}

async function sampleCanvas(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#studio-map-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { ok: false, reason: "missing-canvas" };
    }

    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    if (!gl) {
      return { ok: false, reason: "missing-webgl-context" };
    }

    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(4);
    let brightPixels = 0;
    let totalLuma = 0;
    const colorFamilies = { tech: 0, art: 0, studio: 0 };
    const sampleCount = 121;

    for (let yIndex = 1; yIndex <= 11; yIndex += 1) {
      for (let xIndex = 1; xIndex <= 11; xIndex += 1) {
        const x = Math.floor((width * xIndex) / 12);
        const y = Math.floor((height * yIndex) / 12);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const luma = pixels[0] + pixels[1] + pixels[2];
        totalLuma += luma;
        if (luma > 28) {
          brightPixels += 1;
        }
        if (pixels[2] > 145 && pixels[1] > 110 && pixels[0] < 120) {
          colorFamilies.tech += 1;
        }
        if (pixels[0] > 145 && pixels[1] < 135 && pixels[2] < 145) {
          colorFamilies.art += 1;
        }
        if (pixels[0] > 165 && pixels[1] > 145 && pixels[2] < 130) {
          colorFamilies.studio += 1;
        }
      }
    }

    return {
      ok: brightPixels >= 22,
      width,
      height,
      brightPixels,
      sampleCount,
      colorFamilies,
      averageLuma: Number((totalLuma / sampleCount).toFixed(2))
    };
  });
}

async function assertReady(page) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 8_000 });
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      await wait(700 * attempt);
    }
  }

  if (lastError) {
    throw lastError;
  }

  await page.waitForLoadState("load", { timeout: 5_000 }).catch(() => {});
  await page.waitForFunction(
    () => document.documentElement.classList.contains("game-ready") && window.__IT_ART_STUDIO_QA__?.frameCount > 2,
    { timeout: 12_000 }
  );
  if (qaMode) {
    await page.waitForFunction(() => typeof window.__IT_ART_STUDIO_QA_STEP__ === "function", { timeout: 5_000 });
  }
}

async function capture(page, label, extra = {}) {
  screenshotIndex += 1;
  const filename = `${String(screenshotIndex).padStart(2, "0")}-${label}.png`;
  const filePath = path.join(screenshotsDir, filename);
  const snapshot = await getQaSnapshot(page);
  const canvas = await sampleCanvas(page);

  await page.screenshot({ path: filePath, fullPage: false });

  const entry = {
    label,
    filePath,
    relativePath: path.relative(root, filePath),
    snapshot,
    canvas,
    ...extra
  };

  scenarios.push({ name: `screenshot:${label}`, status: "capture", details: entry });
  return entry;
}

async function driveToZone(page, target) {
  const started = Date.now();
  const snapshot = await page.evaluate((routeTarget) => {
    if (typeof window.__IT_ART_STUDIO_QA_STEP__ !== "function") {
      throw new Error("Missing QA keyboard step hook.");
    }

    for (let stepIndex = 0; stepIndex < 80; stepIndex += 1) {
      const qa = window.__IT_ART_STUDIO_QA__;
      if (!qa) {
        return null;
      }
      if (qa.activeZoneId === routeTarget.id) {
        return JSON.parse(JSON.stringify(qa));
      }

      const dx = routeTarget.position.x - qa.player.x;
      const dz = routeTarget.position.z - qa.player.z;
      const direction =
        Math.abs(dx) > Math.abs(dz)
          ? dx > 0
            ? "right"
            : "left"
          : dz > 0
            ? "down"
            : "up";
      window.__IT_ART_STUDIO_QA_STEP__(direction);
    }

    return window.__IT_ART_STUDIO_QA__ ? JSON.parse(JSON.stringify(window.__IT_ART_STUDIO_QA__)) : null;
  }, target);

  if (snapshot?.activeZoneId === target.id) {
    pass(`keyboard:${target.id}`, {
      activeZoneId: snapshot.activeZoneId,
      elapsedMs: Date.now() - started,
      player: snapshot.player
    });
    return snapshot;
  }

  scenarioFail(`keyboard:${target.id}`, `Expected active zone ${target.id}`, { snapshot, target });
  console.log(
    `[qa] final ${target.id} active=${snapshot?.activeZoneId ?? "none"} player=${JSON.stringify(snapshot?.player)}`
  );
  return snapshot;
}

async function checkRealKeyboardInput(page) {
  const before = await getQaSnapshot(page);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    (startX) => {
      const qa = window.__IT_ART_STUDIO_QA__;
      return qa?.lastInputMode === "keyboard" && Math.abs(qa.player.x - startX) > 0.15;
    },
    before?.player.x ?? 0,
    { timeout: 5_000 }
  );
  const after = await getQaSnapshot(page);
  if (after?.lastInputMode === "keyboard" && Math.abs(after.player.x - (before?.player.x ?? 0)) > 0.15) {
    pass("keyboard:real-input-smoke", { before: before?.player, after: after.player });
  } else {
    scenarioFail("keyboard:real-input-smoke", "Real keyboard input did not move the player.", { before, after });
  }
}

async function checkContact(page) {
  const contact = await page.evaluate(() => {
    const cta = document.querySelector("[data-zone-cta]");
    if (!(cta instanceof HTMLAnchorElement)) {
      return { exists: false };
    }
    return {
      exists: true,
      href: cta.href,
      ariaHidden: cta.getAttribute("aria-hidden"),
      text: cta.textContent?.trim() ?? ""
    };
  });

  if (contact.exists && contact.href.startsWith("mailto:") && contact.ariaHidden === "false") {
    pass("contact-cta", contact);
  } else {
    scenarioFail("contact-cta", "Contact CTA is not active on contact zone.", contact);
  }
}

async function checkWorldRichness(page) {
  const snapshot = await getQaSnapshot(page);
  const world = snapshot?.world;
  if (
    world &&
    snapshot.zoneCount === 10 &&
    world.sceneObjects >= 145 &&
    world.decorativeObjects >= 45 &&
    world.roadSegments >= 18
  ) {
    pass("world-richness", { world, zoneCount: snapshot.zoneCount });
  } else {
    scenarioFail("world-richness", "3D world does not expose enough modeled cartography assets.", {
      world,
      zoneCount: snapshot?.zoneCount
    });
  }
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const selectors = [".game-hud", ".zone-panel", ".mobile-drive", ".mobile-zone-nav", ".world-map"];
    const visibleRects = selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
          return null;
        }
        const rect = node.getBoundingClientRect();
        return {
          selector,
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        };
      })
      .filter(Boolean);

    const overlaps = [];
    for (let i = 0; i < visibleRects.length; i += 1) {
      for (let j = i + 1; j < visibleRects.length; j += 1) {
        const a = visibleRects[i];
        const b = visibleRects[j];
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const area = x * y;
        if (area > 8) {
          overlaps.push({ a: a.selector, b: b.selector, area: Number(area.toFixed(2)) });
        }
      }
    }

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const uiArea = visibleRects.reduce((sum, rect) => sum + rect.width * rect.height, 0);
    const coverage = Number((uiArea / (viewport.width * viewport.height)).toFixed(4));
    const textOverflow = [...document.querySelectorAll("a, button, h1, h2, h3, p, li, span, strong, em")]
      .filter((node) => node instanceof HTMLElement)
      .map((node) => {
        const element = node;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") {
          return null;
        }
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className,
          text: element.textContent?.trim().slice(0, 60) ?? "",
          scrollWidth: element.scrollWidth,
          clientWidth: element.clientWidth
        };
      })
      .filter((item) => item && item.scrollWidth > item.clientWidth + 1);
    const smallTapTargets = [...document.querySelectorAll(".mobile-drive button, .mobile-zone-nav__item")]
      .filter((node) => node instanceof HTMLElement)
      .map((node) => {
        const element = node;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") {
          return null;
        }
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return null;
        }
        return {
          selector: element.className || element.getAttribute("data-drive") || element.tagName.toLowerCase(),
          width: rect.width,
          height: rect.height
        };
      })
      .filter((item) => item && (item.width < 44 || item.height < 44));

    return { visibleRects, overlaps, viewport, coverage, textOverflow, smallTapTargets };
  });
}

async function checkVisibleZoneControls(page, label) {
  const state = await page.evaluate(() => {
    const groups = [".world-map", ".mobile-zone-nav"];
    return groups.map((groupSelector) => {
      const group = document.querySelector(groupSelector);
      if (!(group instanceof HTMLElement)) {
        return { groupSelector, visible: false, pressed: [] };
      }
      const style = getComputedStyle(group);
      const visible = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0;
      const pressed = [...group.querySelectorAll("[data-zone-jump][aria-pressed='true']")].map((node) =>
        node instanceof HTMLElement ? node.dataset.zoneJump : null
      );
      return { groupSelector, visible, pressed };
    });
  });

  const visibleGroups = state.filter((group) => group.visible);
  const invalidGroups = visibleGroups.filter((group) => group.pressed.length !== 1);
  if (invalidGroups.length === 0) {
    pass(`zone-controls:${label}`, { visibleGroups });
  } else {
    scenarioFail(`zone-controls:${label}`, "Visible zone controls must each expose exactly one active zone.", { state });
  }
}

async function checkViewport(page, viewport, label, options = {}) {
  await page.emulateMedia({ reducedMotion: options.reducedMotion ?? "no-preference" });
  await page.setViewportSize(viewport);
  await page.waitForTimeout(450);
  await page.waitForFunction(
    ({ width, height }) =>
      window.innerWidth === width &&
      window.innerHeight === height &&
      document.documentElement.classList.contains("game-ready") &&
      window.__IT_ART_STUDIO_QA__?.canvas.width > 0,
    viewport,
    { timeout: 5_000 }
  );

  const layout = await measureLayout(page);
  await capture(page, label, { layout, reducedMotion: options.reducedMotion ?? "no-preference" });
  await checkVisibleZoneControls(page, label);

  if (layout.overlaps.length === 0) {
    pass(`layout:${label}`, layout);
  } else {
    scenarioFail(`layout:${label}`, "Visible UI elements overlap.", layout);
  }

  const isMobile = viewport.width <= 820;
  const maxCoverage = isMobile ? 0.56 : 0.38;
  if (layout.coverage <= maxCoverage) {
    pass(`ui-coverage:${label}`, { coverage: layout.coverage, maxCoverage });
  } else {
    scenarioFail(`ui-coverage:${label}`, "Visible UI covers too much of the viewport.", {
      coverage: layout.coverage,
      maxCoverage,
      visibleRects: layout.visibleRects
    });
  }

  if (layout.textOverflow.length === 0) {
    pass(`text-overflow:${label}`);
  } else {
    scenarioFail(`text-overflow:${label}`, "Visible text overflows its container.", {
      textOverflow: layout.textOverflow.slice(0, 10)
    });
  }

  if (layout.smallTapTargets.length === 0) {
    pass(`tap-targets:${label}`);
  } else {
    scenarioFail(`tap-targets:${label}`, "Visible mobile controls below 44x44 CSS pixels.", {
      smallTapTargets: layout.smallTapTargets
    });
  }

  if (options.reducedMotion === "reduce") {
    const snapshot = await getQaSnapshot(page);
    if (snapshot?.reducedMotion === true) {
      pass("reduced-motion", { snapshot });
    } else {
      scenarioFail("reduced-motion", "QA snapshot did not report reduced motion.", { snapshot });
    }
  }

}

async function checkMiniMapJumps(page) {
  const targets = [
    "studio-gate",
    "ai-lab",
    "observability-tower",
    "architecture-bridge",
    "cloud-dock",
    "design-atelier",
    "three-d-foundry",
    "fashion-room",
    "values-plaza",
    "contact-portal"
  ];

  for (const targetId of targets) {
    await page.locator(`.world-map [data-zone-jump="${targetId}"]`).click();
    await page.waitForFunction((zoneId) => window.__IT_ART_STUDIO_QA__?.activeZoneId === zoneId, targetId, {
      timeout: 5_000
    });

    const snapshot = await getQaSnapshot(page);
    const pressed = await page.evaluate((zoneId) => {
      const visiblePressed = [...document.querySelectorAll(".world-map [data-zone-jump][aria-pressed='true']")].map(
        (node) => (node instanceof HTMLElement ? node.dataset.zoneJump : null)
      );
      return { zoneId, visiblePressed };
    }, targetId);

    if (
      snapshot?.activeZoneId === targetId &&
      snapshot.lastInputMode === "pointer" &&
      pressed.visiblePressed.length === 1 &&
      pressed.visiblePressed[0] === targetId
    ) {
      pass(`mini-map:${targetId}`, {
        activeZoneId: snapshot.activeZoneId,
        player: snapshot.player,
        pressed,
        lastInputMode: snapshot.lastInputMode
      });
    } else {
      scenarioFail(`mini-map:${targetId}`, "Mini-map jump did not synchronize active zone and aria state.", {
        snapshot,
        pressed
      });
    }
  }
}

async function checkMobileLayout(page) {
  await checkViewport(page, { width: 390, height: 844 }, "mobile-layout");
}

async function writeReport() {
  const summary = {
    status: failures.length === 0 ? "pass" : "fail",
    baseUrl,
    outputRoot,
    durationMs: Date.now() - startedAt,
    scenarioCount: scenarios.length,
    failureCount: failures.length,
    consoleMessages,
    scenarios,
    failures
  };

  await fsp.writeFile(reportJsonPath, `${JSON.stringify(summary, null, 2)}\n`);

  const lines = [
    "# IT Art Studio QA Report",
    "",
    `Status: ${summary.status}`,
    `Base URL: ${baseUrl}`,
    `Duration: ${summary.durationMs}ms`,
    `Failures: ${failures.length}`,
    `Console messages: ${consoleMessages.length}`,
    "",
    "## Scenarios",
    "",
    ...scenarios.map((scenario) => {
      const suffix = scenario.message ? ` - ${scenario.message}` : "";
      return `- ${scenario.status}: ${scenario.name}${suffix}`;
    }),
    "",
    "## Screenshots",
    "",
    ...scenarios
      .filter((scenario) => scenario.status === "capture")
      .map((scenario) => `- ${scenario.details.label}: ${scenario.details.relativePath}`),
    "",
    "## Failures",
    "",
    ...(failures.length > 0 ? failures.map((failure) => `- ${failure.message}`) : ["- none"]),
    ""
  ];

  await fsp.writeFile(reportMdPath, `${lines.join("\n")}\n`);
  return summary;
}

async function main() {
  await fsp.mkdir(screenshotsDir, { recursive: true });

  const { chromium } = loadPlaywright();
  const server = startServer();
  let browser;

  try {
    await waitForServer(server);
    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding"
      ]
    });

    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    attachPageDiagnostics(page, "desktop");

    await assertReady(page);
    const home = await capture(page, "home-loaded");
    await checkVisibleZoneControls(page, "desktop");
    const desktopLayout = await measureLayout(page);
    if (desktopLayout.overlaps.length === 0 && desktopLayout.coverage <= 0.38) {
      pass("layout:desktop", desktopLayout);
    } else {
      scenarioFail("layout:desktop", "Desktop UI layout gate failed.", desktopLayout);
    }

    if (home.canvas.ok) {
      pass("canvas-nonblank", home.canvas);
    } else {
      scenarioFail("canvas-nonblank", "Canvas did not render enough non-dark sampled pixels.", home.canvas);
    }
    if (
      home.canvas.colorFamilies?.tech >= 2 &&
      home.canvas.colorFamilies?.art >= 2 &&
      home.canvas.colorFamilies?.studio >= 2
    ) {
      pass("canvas-color-families", home.canvas.colorFamilies);
    } else {
      scenarioFail("canvas-color-families", "Canvas did not expose the tech/art/studio color families.", home.canvas);
    }
    await checkWorldRichness(page);
    await checkRealKeyboardInput(page);

    const targets = [
      { id: "ai-lab", position: { x: -7, z: -3 }, radius: 1.8, timeoutMs: 8_000 },
      { id: "design-atelier", position: { x: 6.9, z: -3.2 }, radius: 1.8, timeoutMs: 12_000 },
      { id: "contact-portal", position: { x: 0, z: -8.2 }, radius: 1.9, timeoutMs: 8_000 }
    ];

    for (const target of targets) {
      await driveToZone(page, target);
      await capture(page, target.id);
    }

    await checkContact(page);
    await checkMiniMapJumps(page);
    await capture(page, "mini-map-jumps");
    await checkViewport(page, { width: 1280, height: 720 }, "desktop-wide");
    await checkViewport(page, { width: 1024, height: 768 }, "tablet-landscape");
    await checkViewport(page, { width: 821, height: 900 }, "tablet-boundary-desktop");
    await checkViewport(page, { width: 820, height: 900 }, "tablet-portrait");
    await checkMobileLayout(page);
    await checkViewport(page, { width: 320, height: 700 }, "mobile-small");
    await checkViewport(page, { width: 1024, height: 768 }, "reduced-motion", { reducedMotion: "reduce" });
    await page.close();
  } catch (error) {
    fail("qa-runner-crash", {
      message: error instanceof Error ? error.message : String(error),
      serverLogs: server.logs.join("").slice(-4_000)
    });
  } finally {
    if (browser) {
      await browser.close();
    }
    await stopServer(server);
  }

  const blockingConsoleMessages = consoleMessages.filter((message) => {
    if (message.text.includes("Outdated Optimize Dep")) {
      return false;
    }
    if (message.text.includes("GPU stall due to ReadPixels")) {
      return false;
    }
    return message.type === "error" || message.type === "pageerror";
  });

  if (blockingConsoleMessages.length > 0) {
    fail("browser-console-errors", { consoleMessages: blockingConsoleMessages });
  }

  const summary = await writeReport();
  console.log(`QA report: ${path.relative(root, reportMdPath)}`);

  if (summary.status !== "pass") {
    process.exitCode = 1;
  }
}

await main();
