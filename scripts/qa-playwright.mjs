import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import Module from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const port = Number(process.env.QA_PORT ?? 4321);
const baseUrl = process.env.QA_BASE_URL ?? `http://127.0.0.1:${port}/?qa=1`;
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
}

function scenarioFail(name, message, details = {}) {
  const entry = { name, status: "fail", message, details };
  scenarios.push(entry);
  fail(`${name}: ${message}`, details);
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

  while (Date.now() - started < 45_000) {
    if (server.child.exitCode !== null) {
      throw new Error(`Dev server exited early with code ${server.child.exitCode}.\n${server.logs.join("")}`);
    }

    try {
      const response = await fetch(baseUrl, { method: "HEAD" });
      if (response.ok) {
        return;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await wait(500);
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
    const sampleCount = 25;

    for (let yIndex = 1; yIndex <= 5; yIndex += 1) {
      for (let xIndex = 1; xIndex <= 5; xIndex += 1) {
        const x = Math.floor((width * xIndex) / 6);
        const y = Math.floor((height * yIndex) / 6);
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const luma = pixels[0] + pixels[1] + pixels[2];
        totalLuma += luma;
        if (luma > 28) {
          brightPixels += 1;
        }
      }
    }

    return {
      ok: brightPixels >= 8,
      width,
      height,
      brightPixels,
      sampleCount,
      averageLuma: Number((totalLuma / sampleCount).toFixed(2))
    };
  });
}

async function assertReady(page) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await page.waitForFunction(
    () => document.documentElement.classList.contains("game-ready") && window.__IT_ART_STUDIO_QA__?.frameCount > 10,
    { timeout: 30_000 }
  );
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

async function pressToward(page, target) {
  const snapshot = await getQaSnapshot(page);
  if (!snapshot) {
    throw new Error("Missing QA snapshot while driving.");
  }

  const dx = target.position.x - snapshot.player.x;
  const dz = target.position.z - snapshot.player.z;

  if (Math.hypot(dx, dz) < (target.radius ?? 1.2) * 0.72) {
    await page.waitForTimeout(320);
    return;
  }

  let axis = "z";
  let key = dz > 0 ? "ArrowDown" : "ArrowUp";
  if (Math.abs(dx) > Math.abs(dz)) {
    axis = "x";
    key = dx > 0 ? "ArrowRight" : "ArrowLeft";
  }

  await page.keyboard.down(key);
  try {
    await page.waitForFunction(
      ({ axis: drivenAxis, key: drivenKey, radius, targetId, targetPosition }) => {
        const qa = window.__IT_ART_STUDIO_QA__;
        if (!qa) {
          return false;
        }
        if (qa.activeZoneId === targetId) {
          return true;
        }

        const value = drivenAxis === "x" ? qa.player.x : qa.player.z;
        const targetValue = drivenAxis === "x" ? targetPosition.x : targetPosition.z;
        if (Math.abs(value - targetValue) <= radius * 0.55) {
          return true;
        }

        return drivenKey === "ArrowRight" || drivenKey === "ArrowDown"
          ? value >= targetValue
          : value <= targetValue;
      },
      {
        axis,
        key,
        radius: target.radius ?? 1.2,
        targetId: target.id,
        targetPosition: target.position
      },
      { timeout: 4_500 }
    );
  } catch {
    // The next loop iteration will inspect the snapshot and continue steering.
  } finally {
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(120);
}

async function driveToZone(page, target) {
  const started = Date.now();
  let snapshot = await getQaSnapshot(page);

  while (Date.now() - started < target.timeoutMs) {
    snapshot = await getQaSnapshot(page);
    if (snapshot?.activeZoneId === target.id) {
      pass(`keyboard:${target.id}`, {
        activeZoneId: snapshot.activeZoneId,
        elapsedMs: Date.now() - started,
        player: snapshot.player
      });
      return snapshot;
    }
    await pressToward(page, target);
  }

  snapshot = await getQaSnapshot(page);
  if (snapshot?.activeZoneId === target.id) {
    pass(`keyboard:${target.id}`, {
      activeZoneId: snapshot.activeZoneId,
      elapsedMs: Date.now() - started,
      player: snapshot.player,
      finalCheck: true
    });
    return snapshot;
  }

  scenarioFail(`keyboard:${target.id}`, `Expected active zone ${target.id}`, { snapshot, target });
  return snapshot;
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

async function checkMobileLayout(browser) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      consoleMessages.push({ page: "mobile", type: message.type(), text: message.text() });
    }
  });
  page.on("pageerror", (error) => consoleMessages.push({ page: "mobile", type: "pageerror", text: error.message }));

  await assertReady(page);
  const layout = await page.evaluate(() => {
    const selectors = [".game-hud", ".zone-panel", ".mobile-drive", ".world-map"];
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

    return { visibleRects, overlaps };
  });

  await capture(page, "mobile-layout", { layout });

  if (layout.overlaps.length === 0) {
    pass("mobile-layout", layout);
  } else {
    scenarioFail("mobile-layout", "Visible UI elements overlap.", layout);
  }

  await page.close();
}

async function writeReport() {
  const summary = {
    status: failures.length === 0 ? "pass" : "fail",
    baseUrl,
    outputRoot,
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
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push({ page: "desktop", type: message.type(), text: message.text() });
      }
    });
    page.on("pageerror", (error) => consoleMessages.push({ page: "desktop", type: "pageerror", text: error.message }));

    await assertReady(page);
    const home = await capture(page, "home-loaded");

    if (home.canvas.ok) {
      pass("canvas-nonblank", home.canvas);
    } else {
      scenarioFail("canvas-nonblank", "Canvas did not render enough non-dark sampled pixels.", home.canvas);
    }

    const targets = [
      { id: "ai-lab", position: { x: -7, z: -3 }, radius: 1.8, timeoutMs: 22_000 },
      { id: "observability-tower", position: { x: -8, z: 3 }, radius: 1.9, timeoutMs: 22_000 },
      { id: "design-atelier", position: { x: 6.9, z: -3.2 }, radius: 1.8, timeoutMs: 28_000 },
      { id: "contact-portal", position: { x: 0, z: -8.2 }, radius: 1.9, timeoutMs: 28_000 }
    ];

    for (const target of targets) {
      await driveToZone(page, target);
      await capture(page, target.id);
    }

    await checkContact(page);
    await checkMobileLayout(browser);
    await page.close();
  } catch (error) {
    fail("qa-runner-crash", { message: error instanceof Error ? error.message : String(error) });
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
