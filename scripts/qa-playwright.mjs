import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import net from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import Module from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const startedAt = Date.now();
const requestedPort = Number(process.env.QA_PORT ?? 4331);
let port = requestedPort;
const staticDistMode = process.env.QA_STATIC_DIST === "true";
const staticBasePath = process.env.QA_STATIC_BASE_PATH ?? "/ItArtStudio";
const normalizedStaticBasePath = staticBasePath === "/" ? "" : staticBasePath.replace(/\/$/, "");
const makeDefaultBaseUrl = (targetPort) =>
  staticDistMode
    ? `http://127.0.0.1:${targetPort}${normalizedStaticBasePath}/?qa=1`
    : `http://127.0.0.1:${targetPort}/?qa=1`;
let baseUrl = process.env.QA_BASE_URL ?? makeDefaultBaseUrl(port);
const withSearchParam = (url, key, value) => {
  const target = new URL(url);
  target.searchParams.set(key, value);
  return target.toString();
};
let realDriveUrl = withSearchParam(baseUrl, "realKeys", "1");
let productionUrl = (() => {
  const target = new URL(baseUrl);
  target.searchParams.delete("qa");
  target.searchParams.delete("realKeys");
  return target.toString();
})();
const setRuntimePort = (targetPort) => {
  port = targetPort;
  if (!process.env.QA_BASE_URL) {
    baseUrl = makeDefaultBaseUrl(port);
  }
  realDriveUrl = withSearchParam(baseUrl, "realKeys", "1");
  const target = new URL(baseUrl);
  target.searchParams.delete("qa");
  target.searchParams.delete("realKeys");
  productionUrl = target.toString();
};
const requiresQaStep = (url) => {
  try {
    const params = new URL(url).searchParams;
    return params.has("qa") && !params.has("realKeys");
  } catch {
    return /[?&]qa(?:=|&|$)/.test(url) && !/[?&]realKeys(?:=|&|=1|$)/.test(url);
  }
};
const qaProfile = process.env.QA_PROFILE === "quick" ? "quick" : "full";
const staticProofScope = process.env.QA_STATIC_PROOF_SCOPE ?? (process.env.GITHUB_ACTIONS === "true" ? "ci" : "full");
const browserChannel = process.env.QA_BROWSER_CHANNEL ?? (process.env.GITHUB_ACTIONS === "true" ? undefined : "chrome");
const outputRoot = path.join(root, "qa", "artifacts", new Date().toISOString().replace(/[:.]/g, "-"));
const screenshotsDir = path.join(outputRoot, "screenshots");
const reportJsonPath = path.join(outputRoot, "report.json");
const reportMdPath = path.join(outputRoot, "report.md");
const premiumWorldObjectBudget = 940;
const qaWorldHalfExtent = 34;
const qaInnerRoamExtent = 29.4;
const qaBoundaryTargetExtent = qaWorldHalfExtent + 1.8;

const scenarios = [];
const failures = [];
const consoleMessages = [];
const zonePerceptualProofs = new Map();
const zoneCompositionProofs = new Map();
const priorityPlaceCompositionProofs = new Map();
const projectArtifactProofs = new Map();
const priorityPlaceZoneIds = ["ai-lab", "observability-tower", "cloud-dock", "design-atelier", "three-d-foundry", "fashion-room", "contact-portal"];
const staticProofZoneIds = [
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
const staticProofCiZoneIds = ["ai-lab", "design-atelier", "contact-portal"];
const expectedPrioritySetDressingRoles = {
  "ai-lab": ["agent-workbench", "evaluation-conveyor", "prompt-token", "agent-core", "agent-feedback-loop"],
  "observability-tower": ["telemetry-lighthouse", "radar-beam", "metric-stack", "log-waterfall", "trace-sample-grid"],
  "cloud-dock": [
    "server-rack",
    "cloud-puff",
    "electric-arc",
    "control-plane-beacon",
    "cluster-status-pin",
    "deployment-lane"
  ],
  "design-atelier": ["canvas-wall", "drafting-table", "material-roll", "color-swatch", "paint-tool", "studio-lamp", "layout-pin"],
  "three-d-foundry": ["scan-gantry", "printer-bed", "resin-vat", "foundry-tool", "calibration-grid"],
  "fashion-room": ["runway-arch", "fabric-roll", "mirror-panel", "stage-light", "pattern-cutting-table"],
  "contact-portal": ["postal-desk", "mail-tray", "sorting-belt", "reply-portal-field", "mail-stack", "stamp-beacon", "courier-light"]
};
const expectedPrioritySignatureFamilies = {
  "ai-lab": ["agent-workbench", "evaluation-conveyor", "prompt-token", "agent-core"],
  "observability-tower": ["telemetry-lighthouse", "radar-beam", "metric-stack", "log-waterfall"],
  "cloud-dock": ["cloud-platform", "server-array", "electric-cloud", "cloud-skybridge"],
  "design-atelier": ["composition-wall", "pattern-table", "material-palette", "atelier-light-rig", "atelier-mannequin"],
  "three-d-foundry": ["wireframe-knot", "scan-rig", "printer-gantry", "volume-slice", "toolpath-arm"],
  "fashion-room": ["garment-fold", "runway-form", "pattern-rail", "fabric-swatch"],
  "contact-portal": ["postal-counter", "reply-portal", "mail-packet", "postal-wall", "delivery-signal"]
};
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
  if (process.env.GITHUB_ACTIONS !== "true") {
    delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    delete process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD;
  }

  const systemPlaywright = loadSystemPlaywright();
  if (systemPlaywright && process.env.GITHUB_ACTIONS !== "true") {
    return systemPlaywright;
  }

  try {
    return require("playwright");
  } catch {
    if (systemPlaywright) {
      return systemPlaywright;
    }
    throw new Error("Playwright module not found and system playwright wrapper is unavailable.");
  }
}

function loadSystemPlaywright() {
  const wrapperPath = "/run/current-system/sw/bin/playwright";
  if (!fs.existsSync(wrapperPath)) {
    return null;
  }

  const wrapper = fs.readFileSync(wrapperPath, "utf8");
  const nodePathMatch = wrapper.match(/export NODE_PATH="([^$"]+)/);
  if (!nodePathMatch) {
    throw new Error(`Could not infer NODE_PATH from ${wrapperPath}.`);
  }

  process.env.NODE_PATH = process.env.NODE_PATH ? `${nodePathMatch[1]}:${process.env.NODE_PATH}` : nodePathMatch[1];
  Module._initPaths();
  return require("playwright");
}

function startServer() {
  if (staticDistMode) {
    return startStaticDistServer();
  }

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

async function findAvailablePort(startPort, attempts = 20) {
  for (let candidate = startPort; candidate < startPort + attempts; candidate += 1) {
    const available = await new Promise((resolve) => {
      const probe = net.createServer();
      probe.once("error", () => resolve(false));
      probe.once("listening", () => {
        probe.close(() => resolve(true));
      });
      probe.listen(candidate, "127.0.0.1");
    });
    if (available) {
      return candidate;
    }
  }
  throw new Error(`No available QA port found from ${startPort} to ${startPort + attempts - 1}.`);
}

function startStaticDistServer() {
  const distRoot = path.join(root, "dist");
  const basePath = normalizedStaticBasePath;
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".mp4": "video/mp4",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2"
  };
  const logs = [];
  const child = {
    exitCode: null,
    pid: process.pid,
    once(event, callback) {
      if (event === "exit") {
        this.exitCallback = callback;
      }
    },
    kill() {
      server.close(() => {
        child.exitCode = 0;
        child.exitCallback?.(0);
      });
    }
  };
  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === basePath) {
      response.writeHead(301, { Location: `${basePath}/` });
      response.end();
      return;
    }
    if (!pathname.startsWith(`${basePath}/`)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("not found");
      return;
    }
    const relativePath = pathname.slice(basePath.length + 1) || "index.html";
    let filePath = path.join(distRoot, relativePath);
    if (!filePath.startsWith(distRoot)) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("forbidden");
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distRoot, "index.html");
    }
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(filePath)] ?? "application/octet-stream" });
    fs.createReadStream(filePath).pipe(response);
  });

  server.listen(port, "127.0.0.1", () => {
    const message = `Static dist server ready at http://127.0.0.1:${port}${basePath}/\n`;
    logs.push(message);
    process.stdout.write(message);
  });

  return { child, logs, server };
}

async function waitForServer(server) {
  const started = Date.now();
  let lastError = "";
  let consecutiveReadyChecks = 0;

  while (Date.now() - started < 90_000) {
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

  throw new Error(`Dev server did not respond at ${baseUrl} within 90000ms: ${lastError}`);
}

async function stopServer(server) {
  if (server.server) {
    await new Promise((resolve) => server.server.close(resolve));
    server.child.exitCode = 0;
    return;
  }

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

async function getQaSnapshot(page, options = {}) {
  return page.evaluate((shouldRefresh) => {
    if (shouldRefresh && typeof window.__IT_ART_STUDIO_QA_REFRESH__ === "function") {
      window.__IT_ART_STUDIO_QA_REFRESH__();
    }
    const qa = window.__IT_ART_STUDIO_QA__;
    return qa ? JSON.parse(JSON.stringify(qa)) : null;
  }, options.refresh === true);
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
    let edgeTransitions = 0;
    const colorBuckets = new Set();
    const colorFamilies = { tech: 0, art: 0, studio: 0 };
    const sampleGridSize = 15;
    const sampleCount = sampleGridSize * sampleGridSize;
    let previousSample = null;

    for (let yIndex = 1; yIndex <= sampleGridSize; yIndex += 1) {
      for (let xIndex = 1; xIndex <= sampleGridSize; xIndex += 1) {
        const x = Math.floor((width * xIndex) / (sampleGridSize + 1));
        const y = Math.floor((height * yIndex) / (sampleGridSize + 1));
        gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const luma = pixels[0] + pixels[1] + pixels[2];
        totalLuma += luma;
        colorBuckets.add(`${pixels[0] >> 4}-${pixels[1] >> 4}-${pixels[2] >> 4}`);
        if (previousSample) {
          const colorDistance =
            Math.abs(pixels[0] - previousSample.r) +
            Math.abs(pixels[1] - previousSample.g) +
            Math.abs(pixels[2] - previousSample.b);
          if (Math.abs(luma - previousSample.luma) > 38 || colorDistance > 86) {
            edgeTransitions += 1;
          }
        }
        previousSample = { r: pixels[0], g: pixels[1], b: pixels[2], luma };
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
      brightRatio: Number((brightPixels / sampleCount).toFixed(3)),
      edgeTransitions,
      colorBuckets: colorBuckets.size,
      colorFamilies,
      averageLuma: Number((totalLuma / sampleCount).toFixed(2))
    };
  });
}

function assertCanvasDetail(label, canvas) {
  if (!canvas?.ok) {
    scenarioFail(`canvas:${label}`, "Canvas is blank, missing, or too dark for this QA capture.", canvas);
    return;
  }

  const hasDetail = canvas.brightRatio >= 0.18 && canvas.edgeTransitions >= 18 && canvas.colorBuckets >= 9;
  if (hasDetail) {
    pass(`canvas-detail:${label}`, {
      brightRatio: canvas.brightRatio,
      edgeTransitions: canvas.edgeTransitions,
      colorBuckets: canvas.colorBuckets
    });
  } else {
    scenarioFail(`canvas-detail:${label}`, "Canvas capture lacks enough visible detail variation.", canvas);
  }
}

async function assertPremiumWorldDetailDistribution(page, label) {
  const samples = [];
  for (let index = 0; index < 3; index += 1) {
    samples.push(await sampleWorldDetailDistribution(page));
    if (index < 2) {
      await page.waitForTimeout(190);
    }
  }

  const minViewportWidth = Math.min(...samples.map((sample) => sample.viewport?.width ?? Number.POSITIVE_INFINITY));
  const isMobile = minViewportWidth <= 820;
  const isCompact = minViewportWidth <= 1024;
  const thresholds = isMobile
    ? {
        minValidTiles: 34,
        maxFlatTileRatio: 0.56,
        minRichTileRatio: 0.35,
        minEdgeDensityP50: 0.009,
        minColorBucketP50: 5,
        minRichQuadrants: 2,
        maxFlatCluster: 32
      }
    : isCompact
      ? {
          minValidTiles: 54,
          maxFlatTileRatio: 0.45,
          minRichTileRatio: 0.45,
          minEdgeDensityP50: 0.045,
          minColorBucketP50: 7,
          minRichQuadrants: 3,
          maxFlatCluster: 30
        }
    : {
        minValidTiles: 54,
        maxFlatTileRatio: 0.42,
        minRichTileRatio: 0.5,
        minEdgeDensityP50: 0.055,
        minColorBucketP50: 7,
        minRichQuadrants: 3,
        maxFlatCluster: 25
      };

  const median = (values) => percentile(values, 0.5);
  const details = {
    label,
    viewport: samples[0]?.viewport ?? null,
    sampleCount: samples.length,
    validTiles: Math.min(...samples.map((sample) => sample.validTiles ?? 0)),
    flatTileRatio: Number(median(samples.map((sample) => sample.flatTileRatio ?? 1)).toFixed(3)),
    richTileRatio: Number(median(samples.map((sample) => sample.richTileRatio ?? 0)).toFixed(3)),
    edgeDensityP50: Number(median(samples.map((sample) => sample.edgeDensityP50 ?? 0)).toFixed(3)),
    colorBucketP50: Number(median(samples.map((sample) => sample.colorBucketP50 ?? 0)).toFixed(1)),
    lumaStdDevP50: Number(median(samples.map((sample) => sample.lumaStdDevP50 ?? 0)).toFixed(1)),
    richQuadrants: Math.min(...samples.map((sample) => sample.richQuadrants ?? 0)),
    maxFlatCluster: Number(median(samples.map((sample) => sample.maxFlatCluster ?? 99)).toFixed(1)),
    maxObservedFlatCluster: Math.max(...samples.map((sample) => sample.maxFlatCluster ?? 99)),
    uiRects: samples[0]?.uiRects ?? [],
    thresholds,
    samples
  };

  const ok =
    samples.every((sample) => sample.sampled === true) &&
    details.validTiles >= thresholds.minValidTiles &&
    details.flatTileRatio <= thresholds.maxFlatTileRatio &&
    details.richTileRatio >= thresholds.minRichTileRatio &&
    details.edgeDensityP50 >= thresholds.minEdgeDensityP50 &&
    details.colorBucketP50 >= thresholds.minColorBucketP50 &&
    details.richQuadrants >= thresholds.minRichQuadrants &&
    details.maxFlatCluster <= thresholds.maxFlatCluster;

  if (ok) {
    pass(`premium-world-detail-distribution:${label}`, details);
  } else {
    scenarioFail(
      `premium-world-detail-distribution:${label}`,
      "World viewport has too many flat regions for a premium playable map.",
      details
    );
  }
}

async function sampleWorldDetailDistribution(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("#studio-map-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { sampled: false, reason: "missing-canvas" };
    }

    const round = (value, digits = 3) => Number(value.toFixed(digits));
    const canvasRect = canvas.getBoundingClientRect();
    const selectors = [".game-hud", ".zone-panel", ".world-map", ".mobile-drive", ".mobile-zone-nav"];
    const uiRects = selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0 ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return null;
        }
        return {
          selector,
          left: rect.left - canvasRect.left,
          top: rect.top - canvasRect.top,
          right: rect.right - canvasRect.left,
          bottom: rect.bottom - canvasRect.top
        };
      })
      .filter(Boolean);

    const sampleWidth = 192;
    const sampleHeight = Math.max(96, Math.round(sampleWidth * (canvasRect.height / canvasRect.width)));
    const offscreen = document.createElement("canvas");
    offscreen.width = sampleWidth;
    offscreen.height = sampleHeight;
    const context = offscreen.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return { sampled: false, reason: "missing-2d-context" };
    }

    try {
      context.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);
    } catch (error) {
      return { sampled: false, reason: error instanceof Error ? error.message : String(error) };
    }

    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const gridX = 12;
    const gridY = 8;
    const tileWidth = Math.floor(sampleWidth / gridX);
    const tileHeight = Math.floor(sampleHeight / gridY);
    const tiles = [];

    const overlapsUi = (left, top, right, bottom) => {
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      const sourceCenterX = (centerX / sampleWidth) * canvasRect.width;
      const sourceCenterY = (centerY / sampleHeight) * canvasRect.height;
      const sourceLeft = (left / sampleWidth) * canvasRect.width;
      const sourceTop = (top / sampleHeight) * canvasRect.height;
      const sourceRight = (right / sampleWidth) * canvasRect.width;
      const sourceBottom = (bottom / sampleHeight) * canvasRect.height;
      const sourceArea = Math.max(1, (sourceRight - sourceLeft) * (sourceBottom - sourceTop));
      return uiRects.some(
        (rect) => {
          const overlapLeft = Math.max(sourceLeft, rect.left);
          const overlapRight = Math.min(sourceRight, rect.right);
          const overlapTop = Math.max(sourceTop, rect.top);
          const overlapBottom = Math.min(sourceBottom, rect.bottom);
          const overlapArea = Math.max(0, overlapRight - overlapLeft) * Math.max(0, overlapBottom - overlapTop);
          const centerInside =
            sourceCenterX >= rect.left &&
            sourceCenterX <= rect.right &&
            sourceCenterY >= rect.top &&
            sourceCenterY <= rect.bottom;
          return centerInside || overlapArea / sourceArea >= 0.18;
        }
      );
    };

    for (let tileY = 0; tileY < gridY; tileY += 1) {
      for (let tileX = 0; tileX < gridX; tileX += 1) {
        const left = tileX * tileWidth;
        const top = tileY * tileHeight;
        const right = tileX === gridX - 1 ? sampleWidth : left + tileWidth;
        const bottom = tileY === gridY - 1 ? sampleHeight : top + tileHeight;
        if (overlapsUi(left, top, right, bottom)) {
          continue;
        }

        const lumas = [];
        const buckets = new Set();
        let edgeTransitions = 0;
        let edgeComparisons = 0;
        for (let y = top; y < bottom; y += 1) {
          for (let x = left; x < right; x += 1) {
            const index = (y * sampleWidth + x) * 4;
            const r = pixels[index];
            const g = pixels[index + 1];
            const b = pixels[index + 2];
            const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            lumas.push(luma);
            buckets.add(`${Math.floor(r / 32)}:${Math.floor(g / 32)}:${Math.floor(b / 32)}`);

            if (x > left) {
              const leftIndex = (y * sampleWidth + x - 1) * 4;
              const leftLuma = 0.2126 * pixels[leftIndex] + 0.7152 * pixels[leftIndex + 1] + 0.0722 * pixels[leftIndex + 2];
              edgeComparisons += 1;
              if (Math.abs(luma - leftLuma) >= 18) {
                edgeTransitions += 1;
              }
            }
            if (y > top) {
              const topIndex = ((y - 1) * sampleWidth + x) * 4;
              const topLuma = 0.2126 * pixels[topIndex] + 0.7152 * pixels[topIndex + 1] + 0.0722 * pixels[topIndex + 2];
              edgeComparisons += 1;
              if (Math.abs(luma - topLuma) >= 18) {
                edgeTransitions += 1;
              }
            }
          }
        }

        const average = lumas.reduce((sum, value) => sum + value, 0) / Math.max(1, lumas.length);
        const variance = lumas.reduce((sum, value) => sum + (value - average) ** 2, 0) / Math.max(1, lumas.length);
        const edgeDensity = edgeComparisons > 0 ? edgeTransitions / edgeComparisons : 0;
        const lumaStdDev = Math.sqrt(variance);
        const colorBuckets = buckets.size;
        const flat = edgeDensity < 0.028 && colorBuckets < 10 && lumaStdDev < 20;
        const rich = edgeDensity >= 0.055 || (edgeDensity >= 0.04 && colorBuckets >= 16 && lumaStdDev >= 24);
        tiles.push({
          x: tileX,
          y: tileY,
          flat,
          rich,
          edgeDensity,
          colorBuckets,
          lumaStdDev
        });
      }
    }

    const numericMedian = (values) => {
      const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
      if (sorted.length === 0) {
        return 0;
      }
      return sorted[Math.floor(sorted.length / 2)];
    };
    const flatTiles = tiles.filter((tile) => tile.flat);
    const richTiles = tiles.filter((tile) => tile.rich);
    const richQuadrants = new Set(
      richTiles.map((tile) => `${tile.x < gridX / 2 ? 0 : 1}:${tile.y < gridY / 2 ? 0 : 1}`)
    ).size;
    const flatSet = new Set(flatTiles.map((tile) => `${tile.x}:${tile.y}`));
    let maxFlatCluster = 0;
    for (const key of [...flatSet]) {
      if (!flatSet.has(key)) {
        continue;
      }
      const stack = [key];
      flatSet.delete(key);
      let size = 0;
      while (stack.length > 0) {
        const current = stack.pop();
        size += 1;
        const [x, y] = current.split(":").map(Number);
        for (const [nx, ny] of [
          [x + 1, y],
          [x - 1, y],
          [x, y + 1],
          [x, y - 1]
        ]) {
          const nextKey = `${nx}:${ny}`;
          if (flatSet.has(nextKey)) {
            flatSet.delete(nextKey);
            stack.push(nextKey);
          }
        }
      }
      maxFlatCluster = Math.max(maxFlatCluster, size);
    }

    return {
      sampled: true,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      sampleSize: { width: sampleWidth, height: sampleHeight },
      validTiles: tiles.length,
      flatTileRatio: round(flatTiles.length / Math.max(1, tiles.length)),
      richTileRatio: round(richTiles.length / Math.max(1, tiles.length)),
      edgeDensityP50: round(numericMedian(tiles.map((tile) => tile.edgeDensity))),
      colorBucketP50: round(numericMedian(tiles.map((tile) => tile.colorBuckets)), 1),
      lumaStdDevP50: round(numericMedian(tiles.map((tile) => tile.lumaStdDev)), 1),
      richQuadrants,
      maxFlatCluster,
      uiRects: uiRects.map((rect) => rect.selector)
    };
  });
}

function maxPositionSampleStep(samples = []) {
  let maxStep = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    maxStep = Math.max(maxStep, Math.hypot((current?.x ?? 0) - (previous?.x ?? 0), (current?.z ?? 0) - (previous?.z ?? 0)));
  }
  return maxStep;
}

function percentile(values = [], percentileValue = 0.95) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1));
  return sorted[index];
}

function maxPhysicsDisplacementPerFrame(samples = []) {
  let maxStep = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    const frameGap = Math.max(1, (current?.frame ?? 0) - (previous?.frame ?? 0));
    const distance = Math.hypot((current?.x ?? 0) - (previous?.x ?? 0), (current?.z ?? 0) - (previous?.z ?? 0));
    maxStep = Math.max(maxStep, distance / frameGap);
  }
  return maxStep;
}

function hasDragReleaseProof(samples = []) {
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    if (previous?.hasInput && !current?.hasInput && current.speed >= 4) {
      const coastWindow = samples.slice(index, index + 18).filter((sample) => !sample.hasInput);
      const minSpeed = Math.min(...coastWindow.map((sample) => sample.speed));
      if (coastWindow.length >= 4 && minSpeed <= current.speed * 0.78) {
        return true;
      }
    }
  }
  return false;
}

async function assertReady(page, targetUrl = baseUrl) {
  let lastError;
  const requireQaStep = requiresQaStep(targetUrl);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 8_000 });
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

  await page.waitForLoadState("load", { timeout: 8_000 }).catch(() => {});
  let lastState = null;
  const started = Date.now();
  let nextGotoAt = started + 28_000;

  while (Date.now() - started < 70_000) {
    try {
      lastState = await page.evaluate(() => ({
        ready: document.documentElement.classList.contains("game-ready"),
        gameState: document.documentElement.dataset.gameState ?? null,
        frameCount: window.__IT_ART_STUDIO_QA__?.frameCount ?? 0,
        qaReady: window.__IT_ART_STUDIO_QA__?.ready ?? false,
        hasQaStep: typeof window.__IT_ART_STUDIO_QA_STEP__ === "function",
        errors: window.__IT_ART_STUDIO_QA__?.errors ?? [],
        readyState: document.readyState
      }));

      if (lastState.ready && lastState.frameCount > 2 && (!requireQaStep || lastState.hasQaStep)) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    if (Date.now() >= nextGotoAt) {
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch((error) => {
        lastError = error;
      });
      nextGotoAt = Date.now() + 28_000;
    }
    await wait(650);
  }

  throw new Error(
    `Game did not reach ready state at ${targetUrl}. Last state: ${JSON.stringify(lastState)}. Last error: ${
      lastError instanceof Error ? lastError.message : String(lastError ?? "none")
    }`
  );
}

async function assertCanvasGeometry(page) {
  const geometry = await page.evaluate(() => {
    const canvas = document.querySelector("#studio-map-canvas");
    if (!(canvas instanceof HTMLCanvasElement)) {
      return { exists: false };
    }

    const rect = canvas.getBoundingClientRect();
    const style = getComputedStyle(canvas);
    return {
      exists: true,
      display: style.display,
      visibility: style.visibility,
      opacity: Number(style.opacity),
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      widthRatio: Number((rect.width / window.innerWidth).toFixed(3)),
      heightRatio: Number((rect.height / window.innerHeight).toFixed(3))
    };
  });

  if (
    geometry.exists &&
    geometry.display !== "none" &&
    geometry.visibility !== "hidden" &&
    geometry.opacity >= 0.95 &&
    geometry.widthRatio >= 0.98 &&
    geometry.heightRatio >= 0.98
  ) {
    pass("canvas-geometry", geometry);
  } else {
    scenarioFail("canvas-geometry", "WebGL canvas is not a visible full-screen surface.", geometry);
  }
}

async function assertBrandIdentity(page) {
  const identity = await page.evaluate(() => {
    const brand = document.querySelector(".game-brand");
    const title = document.querySelector("#game-title");
    if (!(brand instanceof HTMLElement) || !(title instanceof HTMLElement)) {
      return { exists: false };
    }

    const tokens = [...brand.querySelectorAll("span, strong, em")]
      .filter((node) => node instanceof HTMLElement)
      .map((node) => ({
        text: node.textContent?.trim() ?? "",
        color: getComputedStyle(node).color,
        display: getComputedStyle(node).display,
        visibility: getComputedStyle(node).visibility,
        opacity: Number(getComputedStyle(node).opacity)
      }));
    const brandRect = brand.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const brandStyle = getComputedStyle(brand);
    const titleStyle = getComputedStyle(title);
    return {
      exists: true,
      tokens,
      tokenText: tokens.map((token) => token.text).join("|"),
      distinctColors: new Set(tokens.map((token) => token.color)).size,
      titleText: title.textContent?.trim() ?? "",
      brandVisible:
        brandRect.width > 0 &&
        brandRect.height > 0 &&
        brandStyle.display !== "none" &&
        brandStyle.visibility !== "hidden" &&
        Number(brandStyle.opacity) > 0.95,
      titleVisible:
        titleRect.width > 0 &&
        titleRect.height > 0 &&
        titleStyle.display !== "none" &&
        titleStyle.visibility !== "hidden" &&
        Number(titleStyle.opacity) > 0.95,
      tokensVisible: tokens.every(
        (token) => token.display !== "none" && token.visibility !== "hidden" && token.opacity > 0.95
      )
    };
  });

  if (
    identity.exists &&
    identity.tokenText === "IT|ART|STUDIO" &&
    identity.distinctColors === 3 &&
    identity.titleText === "IT Art Studio" &&
    identity.brandVisible &&
    identity.titleVisible &&
    identity.tokensVisible
  ) {
    pass("brand-identity", identity);
  } else {
    scenarioFail("brand-identity", "IT / ART / STUDIO identity is not visibly encoded in the page.", identity);
  }
}

async function capture(page, label, extra = {}) {
  screenshotIndex += 1;
  const filename = `${String(screenshotIndex).padStart(2, "0")}-${label}.png`;
  const filePath = path.join(screenshotsDir, filename);
  const snapshot = await getQaSnapshot(page);
  const canvas = await sampleCanvas(page);

  await page
    .evaluate(() => Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((resolve) => setTimeout(resolve, 2_000))]))
    .catch(() => {});
  await page.screenshot({ path: filePath, fullPage: false, timeout: 90_000 });

  const entry = {
    label,
    filePath,
    relativePath: path.relative(root, filePath),
    snapshot,
    canvas,
    ...extra
  };

  scenarios.push({ name: `screenshot:${label}`, status: "capture", details: entry });
  assertCanvasDetail(label, canvas);
  if (extra.skipPremiumWorldDistribution !== true) {
    await assertPremiumWorldDetailDistribution(page, label);
  }
  return entry;
}

async function driveToZone(page, target) {
  const started = Date.now();
  const snapshot = await page.evaluate((routeTarget) => {
    if (typeof window.__IT_ART_STUDIO_QA_STEP__ !== "function") {
      throw new Error("Missing QA keyboard step hook.");
    }

    for (let stepIndex = 0; stepIndex < 160; stepIndex += 1) {
      const qa = window.__IT_ART_STUDIO_QA__;
      if (!qa) {
        return null;
      }
      if (qa.activeZoneId === routeTarget.id) {
        return JSON.parse(JSON.stringify(qa));
      }

      const dx = routeTarget.position.x - qa.player.x;
      const dz = routeTarget.position.z - qa.player.z;
      const distanceToTarget = Math.hypot(dx, dz);
      if (distanceToTarget <= (routeTarget.radius ?? 0.8)) {
        return JSON.parse(JSON.stringify(qa));
      }

      const desiredRotation = Math.atan2(dx, dz);
      const signedTurn = Math.atan2(
        Math.sin(desiredRotation - (qa.player.rotationY ?? 0)),
        Math.cos(desiredRotation - (qa.player.rotationY ?? 0))
      );
      const direction = Math.abs(signedTurn) > 0.2 ? (signedTurn > 0 ? "right" : "left") : "up";
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

async function checkActivationFeedback(page, targetId, previousSequence = 0) {
  const samples = [];
  const started = Date.now();
  while (Date.now() - started < 850) {
    const snapshot = await getQaSnapshot(page);
    if (snapshot?.activeFeedback) {
      samples.push(snapshot.activeFeedback);
    }
    await page.waitForTimeout(90);
  }

  const matching = samples.filter((feedback) => feedback.zoneId === targetId && feedback.sequence > previousSequence);
  const best = matching.reduce(
    (winner, feedback) => {
      if (!winner) {
        return feedback;
      }
      return feedback.visibleObjects + feedback.maxOpacity + feedback.maxScale >
        winner.visibleObjects + winner.maxOpacity + winner.maxScale
        ? feedback
        : winner;
    },
    null
  );

  const ok =
    best &&
    best.ringCount >= 3 &&
    best.sparkCount >= 8 &&
    best.visibleObjects >= 9 &&
    best.maxOpacity >= 0.12 &&
    best.maxScale >= 1.06 &&
    best.intensity >= 0.12 &&
    best.lastTriggeredFrame > 0;

  if (ok) {
    pass(`activation-feedback:${targetId}`, {
      previousSequence,
      best,
      sampleCount: samples.length
    });
  } else {
    scenarioFail(`activation-feedback:${targetId}`, "Zone activation did not produce strong enough 3D feedback.", {
      previousSequence,
      samples
    });
  }
}

async function releaseDriveKeys(page) {
  await Promise.all(
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].map((key) => page.keyboard.up(key).catch(() => {}))
  );
}

async function holdDriveKeys(page, keys, durationMs = 130) {
  await releaseDriveKeys(page);
  for (const key of keys) {
    await page.keyboard.down(key);
  }
  await page.waitForTimeout(durationMs);
  await releaseDriveKeys(page);
  await page.waitForTimeout(50);
}

async function collectGameplayMomentProof(page) {
  return page.evaluate(() => {
    if (typeof window.__IT_ART_STUDIO_QA_REFRESH__ === "function") {
      window.__IT_ART_STUDIO_QA_REFRESH__();
    }
    const qa = window.__IT_ART_STUDIO_QA__;
    const round = (value, digits = 3) => Number(value.toFixed(digits));
    const selectors = [".game-hud", ".zone-panel", ".world-map", ".mobile-drive", ".mobile-zone-nav"];
    const uiRects = selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0 ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return null;
        }
        return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter(Boolean);
    const toRect = (item) =>
      item
        ? {
            left: item.clippedX ?? item.x,
            top: item.clippedY ?? item.y,
            right: (item.clippedX ?? item.x) + (item.clippedWidth ?? item.width),
            bottom: (item.clippedY ?? item.y) + (item.clippedHeight ?? item.height)
          }
        : null;
    const uiOcclusion = (item) => {
      const rect = toRect(item);
      const area = item?.clippedArea ?? item?.area ?? 0;
      if (!rect || area <= 0) {
        return { area: 0, ratio: 1 };
      }
      const xEdges = [rect.left, rect.right];
      const yEdges = [rect.top, rect.bottom];
      for (const ui of uiRects) {
        const left = Math.max(rect.left, ui.left);
        const right = Math.min(rect.right, ui.right);
        const top = Math.max(rect.top, ui.top);
        const bottom = Math.min(rect.bottom, ui.bottom);
        if (right > left && bottom > top) {
          xEdges.push(left, right);
          yEdges.push(top, bottom);
        }
      }
      const xs = [...new Set(xEdges)].sort((a, b) => a - b);
      const ys = [...new Set(yEdges)].sort((a, b) => a - b);
      let occluded = 0;
      for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
        for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
          const left = xs[xIndex];
          const right = xs[xIndex + 1];
          const top = ys[yIndex];
          const bottom = ys[yIndex + 1];
          const centerX = (left + right) / 2;
          const centerY = (top + bottom) / 2;
          if (
            uiRects.some(
              (ui) => centerX >= ui.left && centerX <= ui.right && centerY >= ui.top && centerY <= ui.bottom
            )
          ) {
            occluded += Math.max(0, right - left) * Math.max(0, bottom - top);
          }
        }
      }
      return { area: round(occluded, 1), ratio: round(Math.min(1, occluded / area)) };
    };
    const centerOccluders = (item) => {
      const center = item?.center ?? null;
      if (!center) {
        return ["missing-center"];
      }
      return uiRects
        .filter(
          (rect) =>
            center.x >= rect.left - 10 &&
            center.x <= rect.right + 10 &&
            center.y >= rect.top - 10 &&
            center.y <= rect.bottom + 10
        )
        .map((rect) => rect.selector);
    };
    const sampleCanvasRoi = (rect) => {
      const canvas = document.querySelector("#studio-map-canvas");
      if (!(canvas instanceof HTMLCanvasElement) || !rect || rect.clippedWidth <= 1 || rect.clippedHeight <= 1) {
        return { sampled: false, brightRatio: 0, edgeDensity: 0, colorBuckets: 0, roiWidth: 0, roiHeight: 0 };
      }
      const canvasRect = canvas.getBoundingClientRect();
      const sourceLeft = Math.max(0, rect.clippedX - canvasRect.left);
      const sourceTop = Math.max(0, rect.clippedY - canvasRect.top);
      const sourceWidth = Math.min(rect.clippedWidth, canvasRect.width - sourceLeft);
      const sourceHeight = Math.min(rect.clippedHeight, canvasRect.height - sourceTop);
      if (sourceWidth <= 1 || sourceHeight <= 1) {
        return { sampled: false, brightRatio: 0, edgeDensity: 0, colorBuckets: 0, roiWidth: 0, roiHeight: 0 };
      }
      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      const sx = Math.max(0, Math.floor(sourceLeft * scaleX));
      const sy = Math.max(0, Math.floor(sourceTop * scaleY));
      const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(sourceWidth * scaleX)));
      const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(sourceHeight * scaleY)));
      const roiSize = 64;
      const roi = document.createElement("canvas");
      roi.width = roiSize;
      roi.height = roiSize;
      const context = roi.getContext("2d", { willReadFrequently: true });
      if (!context) {
        return { sampled: false, brightRatio: 0, edgeDensity: 0, colorBuckets: 0, roiWidth: roiSize, roiHeight: roiSize };
      }
      let pixels;
      try {
        context.drawImage(canvas, sx, sy, sw, sh, 0, 0, roiSize, roiSize);
        pixels = context.getImageData(0, 0, roiSize, roiSize).data;
      } catch (error) {
        return {
          sampled: false,
          error: error instanceof Error ? error.message : String(error),
          brightRatio: 0,
          edgeDensity: 0,
          colorBuckets: 0,
          roiWidth: roiSize,
          roiHeight: roiSize
        };
      }
      const lumas = [];
      const buckets = new Set();
      let brightPixels = 0;
      for (let y = 0; y < roiSize; y += 1) {
        for (let x = 0; x < roiSize; x += 1) {
          const index = (y * roiSize + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lumas.push(luma);
          if (luma >= 72) {
            brightPixels += 1;
          }
          buckets.add(`${Math.floor(r / 32)}:${Math.floor(g / 32)}:${Math.floor(b / 32)}`);
        }
      }
      let edgeTransitions = 0;
      let edgeComparisons = 0;
      for (let y = 1; y < roiSize; y += 1) {
        for (let x = 1; x < roiSize; x += 1) {
          const index = y * roiSize + x;
          if (Math.abs(lumas[index] - lumas[index - 1]) >= 18) {
            edgeTransitions += 1;
          }
          if (Math.abs(lumas[index] - lumas[index - roiSize]) >= 18) {
            edgeTransitions += 1;
          }
          edgeComparisons += 2;
        }
      }
      return {
        sampled: true,
        brightRatio: round(brightPixels / lumas.length),
        edgeDensity: round(edgeComparisons > 0 ? edgeTransitions / edgeComparisons : 0),
        edgeTransitions,
        colorBuckets: buckets.size,
        roiWidth: roiSize,
        roiHeight: roiSize
      };
    };
    const readable = (rect) => {
      const occlusion = uiOcclusion(rect);
      return {
        rect,
        centerOccluders: centerOccluders(rect),
        uiOccludedArea: occlusion.area,
        uiOccludedRatio: occlusion.ratio,
        visibleAfterUiRatio: round(Math.max(0, (rect?.visibleRatio ?? 0) * (1 - occlusion.ratio))),
        roi: sampleCanvasRoi(rect)
      };
    };

    return {
      activeZoneId: qa?.activeZoneId ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      player: readable(qa?.screen?.playerRect ?? null),
      encounter: readable(qa?.screen?.activeRouteEncounter ?? null),
      routeEncounterScreens: Object.fromEntries(
        Object.entries(qa?.screen?.routeEncounters ?? {}).map(([routeId, rect]) => [routeId, readable(rect)])
      ),
      routeEncounters: qa?.routeEncounters ?? null,
      input: qa?.input ?? null,
      frameCount: qa?.frameCount ?? 0
    };
  });
}

async function driveWithRealKeyboard(page, target) {
  const samples = [];
  const momentProofs = [];
  let reached = false;
  const started = Date.now();
  let maxSampleStepDistance = 0;
  let previousPlayer = null;
  let bestDistanceToTarget = Number.POSITIVE_INFINITY;
  let worseningDistanceSamples = 0;

  const addSample = (snapshot) => {
    if (!snapshot?.player) {
      return;
    }
    const player = snapshot.player;
    if (previousPlayer) {
      maxSampleStepDistance = Math.max(
        maxSampleStepDistance,
        Math.hypot(player.x - previousPlayer.x, player.z - previousPlayer.z)
      );
    }
    previousPlayer = player;
    samples.push({
      frameCount: snapshot.frameCount,
      activeZoneId: snapshot.activeZoneId,
      player,
      trail: snapshot.trail,
      drive: snapshot.drive,
      audio: snapshot.audio
        ? {
            engineGain: snapshot.audio.engineGain,
            driftGain: snapshot.audio.driftGain,
            ambienceGain: snapshot.audio.ambienceGain,
            accelerationGain: snapshot.audio.accelerationGain,
            waterGain: snapshot.audio.waterGain,
            rampGain: snapshot.audio.rampGain,
            engineFrequency: snapshot.audio.engineFrequency,
            surfaceFrequency: snapshot.audio.surfaceFrequency,
            muted: snapshot.audio.muted
          }
        : null,
      camera: snapshot.camera,
      screen: snapshot.screen,
      routeEncounters: snapshot.routeEncounters
    });
  };

  while (Date.now() - started < (target.timeoutMs ?? 10_000)) {
    const snapshot = await getQaSnapshot(page);
    if (snapshot?.player) {
      addSample(snapshot);
      if (snapshot.screen?.activeRouteEncounter?.id && (snapshot.routeEncounters?.activeIntensity ?? 0) >= 0.12) {
        momentProofs.push(await collectGameplayMomentProof(page));
      }

      const player = snapshot.player;
      const dx = target.position.x - player.x;
      const dz = target.position.z - player.z;
      const distanceToTarget = Math.hypot(dx, dz);
      if (distanceToTarget < bestDistanceToTarget - 0.08) {
        bestDistanceToTarget = distanceToTarget;
        worseningDistanceSamples = 0;
      } else if (distanceToTarget > bestDistanceToTarget + 0.38) {
        worseningDistanceSamples += 1;
      }
      const targetZoneId = target.zoneId ?? target.id;
      const targetRadius = target.radius ?? (target.zoneId ? 2.2 : 0.55);
      const boundary = snapshot.drive?.boundary;
      const targetBoundaryReached =
        typeof target.boundaryAxis === "string" &&
        ((boundary?.contactAxes?.[target.boundaryAxis] ?? 0) > 0 || (boundary?.lastContactAxis ?? "").split("+").includes(target.boundaryAxis));
      const targetReached = target.zoneId
        ? (snapshot.activeZoneId === targetZoneId || snapshot.visitedZoneIds?.includes(targetZoneId)) && distanceToTarget <= targetRadius
        : targetBoundaryReached || distanceToTarget <= targetRadius;
      if (targetReached) {
        reached = true;
        break;
      }

      const desiredRotation = Math.atan2(dx, dz);
      const signedTurn = Math.atan2(Math.sin(desiredRotation - (player.rotationY ?? 0)), Math.cos(desiredRotation - (player.rotationY ?? 0)));
      const absTurn = Math.abs(signedTurn);
      const speed = snapshot.drive?.dynamics?.currentSpeed ?? 0;
      const approachLimit = target.overshootBrake === true ? 5.2 : 7.2;
      const turnLimit =
        absTurn > 1.35
          ? target.overshootBrake === true
            ? 2.8
            : 3.6
          : absTurn > 0.75
            ? target.overshootBrake === true
              ? 3.7
              : 4.8
            : approachLimit;
      const targetSpeed = Math.max(1.55, Math.min(approachLimit, distanceToTarget * 0.88, turnLimit));
      const overshootingTarget = target.overshootBrake === true && worseningDistanceSamples >= 2 && speed > 1.8;
      const keys = [];
      if (distanceToTarget > 0.32) {
        if (absTurn > 2.45 && speed < 3.2) {
          keys.push("ArrowDown");
        } else if (
          overshootingTarget ||
          speed > targetSpeed + 0.65 ||
          (distanceToTarget < 4.2 && speed > (target.overshootBrake === true ? 2.45 : 3.1)) ||
          (absTurn > 1.35 && speed > (target.overshootBrake === true ? 2.9 : 3.8))
        ) {
          keys.push("ArrowDown");
        } else if (absTurn < 1.8 || speed < 1.5) {
          keys.push("ArrowUp");
        }
      }
      if (absTurn > 0.12) {
        keys.push(signedTurn > 0 ? "ArrowRight" : "ArrowLeft");
      }
      if (keys.length === 0) {
        break;
      }
      await holdDriveKeys(page, keys, 105);
      const afterInputSnapshot = await getQaSnapshot(page);
      if (afterInputSnapshot?.player) {
        addSample(afterInputSnapshot);
        if (
          afterInputSnapshot.screen?.activeRouteEncounter?.id &&
          (afterInputSnapshot.routeEncounters?.activeIntensity ?? 0) >= 0.12
        ) {
          momentProofs.push(await collectGameplayMomentProof(page));
        }
      }
    } else {
      await page.waitForTimeout(120);
    }
  }

  await releaseDriveKeys(page);
  if (reached && !target.skipPostReachSamples) {
    for (let i = 0; i < 2; i += 1) {
      await page.waitForTimeout(90);
      addSample(await getQaSnapshot(page));
    }
  }
  return { reached, elapsedMs: Date.now() - started, samples, momentProofs, maxSampleStepDistance };
}

async function driveRouteWithRealKeyboard(page, target) {
  const steps = target.route ?? [target];
  const stepResults = [];
  const started = Date.now();
  let reached = true;

  for (const step of steps) {
    if (step.miniMapZoneId) {
      const actionability = await clickActionable(page, `.world-map [data-zone-jump="${step.miniMapZoneId}"]`, step.id ?? step.miniMapZoneId, {
        minWidth: 30,
        minHeight: 30
      });
      let snapshot = await getQaSnapshot(page, { refresh: true });
      if (actionability) {
        await page
          .waitForFunction((zoneId) => window.__IT_ART_STUDIO_QA__?.activeZoneId === zoneId, step.miniMapZoneId, {
            timeout: step.timeoutMs ?? 10_000
          })
          .catch(() => {});
        await page.waitForTimeout(step.pauseMs ?? 180);
        snapshot = await getQaSnapshot(page, { refresh: true });
      }
      const stepReached = Boolean(actionability && snapshot?.activeZoneId === step.miniMapZoneId);
      stepResults.push({
        reached: stepReached,
        elapsedMs: 0,
        samples: snapshot ? [snapshot] : [],
        momentProofs: [],
        maxSampleStepDistance: 0,
        step: step.id,
        miniMapZoneId: step.miniMapZoneId
      });
      if (!stepReached) {
        reached = false;
        break;
      }
      continue;
    }
    const result = await driveWithRealKeyboard(page, step);
    stepResults.push({ ...result, step: step.id });
    if (!result.reached) {
      reached = false;
      break;
    }
    await page.waitForTimeout(step.pauseMs ?? 80);
  }

  return {
    reached,
    elapsedMs: Date.now() - started,
    samples: stepResults.flatMap((result) => result.samples),
    momentProofs: stepResults.flatMap((result) => result.momentProofs ?? []),
    maxSampleStepDistance: Math.max(...stepResults.map((result) => result.maxSampleStepDistance), 0),
    stepResults
  };
}

async function inspectRouteEncounterFromFreshDrive(
  browser,
  { label, routeId, route, position, radius = 1.05, timeoutMs = 10_000, verifyVisibility = true, allowMiss = false }
) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, `route-encounter:${routeId}`);

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const drive = await driveRouteWithRealKeyboard(page, {
      id: `route-encounter:${routeId}`,
      position,
      radius,
      timeoutMs,
      route
    });
    const expectedEncounterId = `encounter:${routeId}`;
    const matchingProofCount = (drive.momentProofs ?? []).filter((proof) => {
      const rect = proof?.encounter?.rect;
      return rect?.id === expectedEncounterId || rect?.routeId === routeId;
    }).length;

    if (!verifyVisibility) {
      return { ...drive, matchingProofCount };
    }

    if (drive.reached || matchingProofCount > 0) {
      await inspectGameplayMomentVisibility(page, label, drive, routeId);
    } else if (allowMiss) {
      return { ...drive, matchingProofCount };
    } else {
      scenarioFail(`route-encounter-visible:${label}`, "Fresh real-keyboard drive did not reach the inspected route encounter.", {
        routeId,
        position,
        radius,
        matchingProofCount,
        drive
      });
    }

    return { ...drive, matchingProofCount };
  } finally {
    await releaseDriveKeys(page).catch(() => {});
    await page.close();
  }
}

async function checkRealDriveArcadeKeyboard(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "real-drive-arcade-keyboard");

  const tape = [
    { label: "launch", keys: ["ArrowUp"], durationMs: 900 },
    { label: "coast-a", keys: [], durationMs: 260 },
    { label: "left-arc", keys: ["ArrowUp", "ArrowLeft"], durationMs: 1150 },
    { label: "coast-b", keys: [], durationMs: 220 },
    { label: "right-arc", keys: ["ArrowUp", "ArrowRight"], durationMs: 1120 },
    { label: "coast-c", keys: [], durationMs: 320 },
    { label: "brake", keys: ["ArrowDown"], durationMs: 560 },
    { label: "reverse-left", keys: ["ArrowDown", "ArrowLeft"], durationMs: 680 },
    { label: "recover", keys: [], durationMs: 280 },
    { label: "finish-right", keys: ["ArrowUp", "ArrowRight"], durationMs: 760 },
    { label: "final-coast", keys: [], durationMs: 1030 }
  ];

  const snapshots = [];
  const segmentProofs = [];
  const addSnapshot = async (segment) => {
    const snapshot = await getQaSnapshot(page, { refresh: true });
    if (snapshot?.player) {
      snapshots.push({ segment, snapshot });
    }
    return snapshot;
  };

  const holdTapeSegment = async (segment) => {
    await releaseDriveKeys(page);
    for (const key of segment.keys) {
      await page.keyboard.down(key);
    }

    const started = Date.now();
    while (Date.now() - started < segment.durationMs) {
      await page.waitForTimeout(Math.min(110, segment.durationMs - (Date.now() - started)));
      await addSnapshot(segment.label);
    }

    await releaseDriveKeys(page);
    await page.waitForTimeout(70);
    const after = await addSnapshot(`${segment.label}:released`);
    segmentProofs.push({
      label: segment.label,
      keys: segment.keys,
      durationMs: segment.durationMs,
      lastInputMode: after?.lastInputMode ?? null,
      activeKeys: after?.input?.activeKeys ?? []
    });
  };

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const hookState = await page.evaluate(() => ({
      hasQaStep: typeof window.__IT_ART_STUDIO_QA_STEP__ === "function",
      href: window.location.href
    }));
    if (!hookState.hasQaStep) {
      pass("real-drive:no-step-hook", hookState);
    } else {
      scenarioFail("real-drive:no-step-hook", "Real keyboard route must not expose the deterministic QA step hook.", hookState);
    }

    const initial = await getQaSnapshot(page, { refresh: true });
    for (const segment of tape) {
      await holdTapeSegment(segment);
    }
    await releaseDriveKeys(page);
    await page.waitForTimeout(180);
    const final = await getQaSnapshot(page, { refresh: true });

    const physicsSamples = final?.drive?.physicsSamples ?? [];
    const positionSamples = final?.drive?.positionSamples ?? [];
    const speeds = physicsSamples.map((sample) => sample.speed ?? 0);
    const accelerations = physicsSamples.map((sample) => sample.acceleration ?? 0);
    const turnRates = physicsSamples.map((sample) => Math.abs(sample.turnRate ?? 0));
    const driftAngles = physicsSamples.map((sample) => Math.abs(sample.driftAngle ?? 0));
    const lateralSpeeds = physicsSamples.map((sample) => Math.abs(sample.lateralSpeed ?? 0));
    const xValues = physicsSamples.map((sample) => sample.x ?? 0);
    const zValues = physicsSamples.map((sample) => sample.z ?? 0);
    const cameraLags = snapshots.map(({ snapshot }) => snapshot.camera?.lag ?? 99);
    const cameraDistances = snapshots.map(({ snapshot }) => snapshot.camera?.distanceToPlayer ?? 0);
    const playerVisibleSamples = snapshots.filter(({ snapshot }) => snapshot.screen?.player?.visible === true).length;
    const visualSampleCount = snapshots.length;
    const distanceDelta = Number(((final?.drive?.totalDistance ?? 0) - (initial?.drive?.totalDistance ?? 0)).toFixed(3));
    const frameSpan = physicsSamples.length > 1 ? physicsSamples.at(-1).frame - physicsSamples[0].frame : 0;
    const xSpan = xValues.length > 0 ? Math.max(...xValues) - Math.min(...xValues) : 0;
    const zSpan = zValues.length > 0 ? Math.max(...zValues) - Math.min(...zValues) : 0;
    const driftSampleCount = physicsSamples.filter((sample) => (sample.speed ?? 0) >= 2 && Math.abs(sample.driftAngle ?? 0) >= 0.12).length;
    const leftSteerSamples = physicsSamples.filter((sample) => sample.steeringInput < 0 && Math.abs(sample.turnRate ?? 0) > 0.2).length;
    const rightSteerSamples = physicsSamples.filter((sample) => sample.steeringInput > 0 && Math.abs(sample.turnRate ?? 0) > 0.2).length;
    const maxDisplacementPerFrame = maxPhysicsDisplacementPerFrame(physicsSamples);
    const p95Speed = percentile(speeds, 0.95);
    const p95Acceleration = percentile(accelerations, 0.95);
    const p95TurnRate = percentile(turnRates, 0.95);
    const p95DriftAngle = percentile(driftAngles, 0.95);
    const p95LateralSpeed = percentile(lateralSpeeds, 0.95);
    const p95CameraLag = percentile(cameraLags, 0.95);
    const minCameraDistance = cameraDistances.length > 0 ? Math.min(...cameraDistances) : 0;
    const maxCameraDistance = Math.max(...cameraDistances, 0);
    const surface = final?.drive?.surface;
    const offRouteRatio = surface?.samples > 0 ? surface.offRouteSamples / surface.samples : 1;
    const routeEncounters = final?.routeEncounters;
    const visitedEncounterIds = routeEncounters?.visitedIds ?? [];
    const routeEncounterKinds = {
      studio: visitedEncounterIds.some((id) => id.includes("spine-")),
      tech: visitedEncounterIds.some((id) => id.includes("tech-")),
      art: visitedEncounterIds.some((id) => id.includes("art-"))
    };

    const inputGate =
      final?.lastInputMode === "keyboard" &&
      (final.input?.qaStepHookCalls ?? 0) === (initial?.input?.qaStepHookCalls ?? 0) &&
      (final.input?.activeKeys?.length ?? 99) === 0 &&
      segmentProofs.every((proof) => proof.lastInputMode === "keyboard" && proof.activeKeys.length === 0);
    const motionGate =
      physicsSamples.length >= 300 &&
      frameSpan >= 300 &&
      distanceDelta >= 18 &&
      xSpan >= 2.2 &&
      zSpan >= 4.8 &&
      maxDisplacementPerFrame <= 0.8;
    const kinematicsGate =
      Math.max(...speeds, 0) >= 7.5 &&
      p95Speed <= 17.5 &&
      p95Acceleration <= 90 &&
      p95TurnRate >= 1.2 &&
      p95TurnRate <= 6.8 &&
      p95DriftAngle >= 0.1 &&
      p95DriftAngle <= 1.45 &&
      p95LateralSpeed >= 0.28 &&
      driftSampleCount >= 6 &&
      leftSteerSamples >= 8 &&
      rightSteerSamples >= 8 &&
      hasDragReleaseProof(physicsSamples);
    const visualGate =
      visualSampleCount >= 20 &&
      playerVisibleSamples >= Math.floor(visualSampleCount * 0.95) &&
      p95CameraLag <= 1.8 &&
      minCameraDistance >= 13.2 &&
      maxCameraDistance <= 16.8 &&
      (final.trail?.activeMarks ?? 0) >= 10;
    const routeGate =
      surface?.segmentCount >= 20 &&
      surface.samples >= 45 &&
      surface.routeAdherenceRatio >= 0.15 &&
      surface.routeAdherenceRatio <= 0.99 &&
      offRouteRatio >= 0.01 &&
      offRouteRatio <= 0.92 &&
      surface.maxOffRouteDistance >= 0.25 &&
      routeEncounters?.gateCount >= 11 &&
      routeEncounters.objectCount >= 11 &&
      routeEncounters.maxIntensity >= 0.3;
    const gate = inputGate && motionGate && kinematicsGate && visualGate && routeGate;
    const details = {
      tape,
      segmentProofs,
      sampleCount: physicsSamples.length,
      visualSampleCount,
      playerVisibleSamples,
      frameSpan,
      distanceDelta,
      xSpan: Number(xSpan.toFixed(3)),
      zSpan: Number(zSpan.toFixed(3)),
      p95Speed: Number(p95Speed.toFixed(3)),
      p95Acceleration: Number(p95Acceleration.toFixed(3)),
      p95TurnRate: Number(p95TurnRate.toFixed(3)),
      p95DriftAngle: Number(p95DriftAngle.toFixed(3)),
      p95LateralSpeed: Number(p95LateralSpeed.toFixed(3)),
      driftSampleCount,
      leftSteerSamples,
      rightSteerSamples,
      maxDisplacementPerFrame: Number(maxDisplacementPerFrame.toFixed(3)),
      dragReleaseProof: hasDragReleaseProof(physicsSamples),
      p95CameraLag: Number(p95CameraLag.toFixed(3)),
      minCameraDistance: Number(minCameraDistance.toFixed(3)),
      maxCameraDistance: Number(maxCameraDistance.toFixed(3)),
      surface,
      offRouteRatio: Number(offRouteRatio.toFixed(3)),
      routeEncounters,
      routeEncounterKinds,
      trail: final?.trail,
      inputGate,
      motionGate,
      kinematicsGate,
      visualGate,
      routeGate,
      finalPlayer: final?.player ?? null,
      positionSampleStep: Number(maxPositionSampleStep(positionSamples).toFixed(3))
    };

    if (gate) {
      pass("real-drive-arcade-keyboard", details);
      pass("real-drive-kinematics", details);
      pass("real-drive-route-freedom", details);
    } else {
      scenarioFail("real-drive-arcade-keyboard", "Open-loop keyboard tape did not prove arcade vehicle control.", details);
    }

  } finally {
    await releaseDriveKeys(page);
    await page.close();
  }
}

async function checkVehicleFeelSignature(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "vehicle-feel-signature");

  const tape = [
    { label: "launch", keys: ["ArrowUp"], durationMs: 840 },
    { label: "left-drift", keys: ["ArrowUp", "ArrowLeft"], durationMs: 980, capture: true },
    { label: "right-drift", keys: ["ArrowUp", "ArrowRight"], durationMs: 920 },
    { label: "brake-skid", keys: ["ArrowDown"], durationMs: 620, capture: true },
    { label: "recover", keys: ["ArrowUp"], durationMs: 560 }
  ];

  const snapshots = [];
  const addSnapshot = async (segment) => {
    const snapshot = await getQaSnapshot(page, { refresh: true });
    if (snapshot?.drive?.vehicleFeel) {
      snapshots.push({ segment, snapshot });
    }
    return snapshot;
  };

  const holdTapeSegment = async (segment) => {
    await releaseDriveKeys(page);
    for (const key of segment.keys) {
      await page.keyboard.down(key);
    }
    const started = Date.now();
    while (Date.now() - started < segment.durationMs) {
      await page.waitForTimeout(Math.min(100, segment.durationMs - (Date.now() - started)));
      await addSnapshot(segment.label);
    }
    if (segment.capture) {
      await capture(page, `vehicle-feel-${segment.label}`);
    }
    await releaseDriveKeys(page);
    await page.waitForTimeout(70);
    await addSnapshot(`${segment.label}:released`);
  };

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const initial = await getQaSnapshot(page, { refresh: true });
    for (const segment of tape) {
      await holdTapeSegment(segment);
    }
    await releaseDriveKeys(page);
    await page.waitForTimeout(180);
    const final = await getQaSnapshot(page, { refresh: true });

    const physicsSamples = final?.drive?.physicsSamples ?? [];
    const feel = final?.drive?.vehicleFeel ?? {};
    const feelSamples = snapshots.map(({ snapshot }) => snapshot.drive?.vehicleFeel).filter(Boolean);
    const wheelSteers = feelSamples.map((sample) => Math.abs(sample.frontWheelSteer ?? 0));
    const chassisRolls = feelSamples.map((sample) => Math.abs(sample.chassisRoll ?? 0));
    const skidSamples = feelSamples.map((sample) => sample.skidIntensity ?? 0);
    const driftAngles = physicsSamples.map((sample) => Math.abs(sample.driftAngle ?? 0));
    const lateralSpeeds = physicsSamples.map((sample) => Math.abs(sample.lateralSpeed ?? 0));
    const p80WheelSteer = percentile(wheelSteers, 0.8);
    const p80ChassisRoll = percentile(chassisRolls, 0.8);
    const p80Skid = percentile(skidSamples, 0.8);
    const p80DriftAngle = percentile(driftAngles, 0.8);
    const p80LateralSpeed = percentile(lateralSpeeds, 0.8);
    const driftSampleCount = physicsSamples.filter((sample) => (sample.speed ?? 0) >= 2 && Math.abs(sample.driftAngle ?? 0) >= 0.1).length;
    const inputGate =
      final?.lastInputMode === "keyboard" &&
      (final.input?.qaStepHookCalls ?? 0) === (initial?.input?.qaStepHookCalls ?? 0) &&
      (final.input?.activeKeys?.length ?? 99) === 0;
    const dynamicsGate =
      physicsSamples.length >= 180 &&
      (final.drive?.dynamics?.peakSpeed ?? 0) >= 7.5 &&
      (final.drive?.dynamics?.peakAcceleration ?? 0) >= 12 &&
      driftSampleCount >= 8 &&
      p80DriftAngle >= 0.055 &&
      p80LateralSpeed >= 0.18;
    const visualGate =
      feel.visualSteeringSamples >= 8 &&
      (feel.peakFrontWheelSteer ?? 0) >= 0.14 &&
      p80WheelSteer >= 0.065 &&
      (feel.peakChassisRoll ?? 0) >= 0.025 &&
      p80ChassisRoll >= 0.012 &&
      (feel.driftFxSamples ?? 0) >= 8 &&
      (feel.brakeFxSamples ?? 0) >= 2 &&
      (feel.maxSkidIntensity ?? 0) >= 0.2 &&
      p80Skid >= 0.08 &&
      (feel.driftTrailMarks ?? 0) >= 3 &&
      (feel.brakeTrailMarks ?? 0) >= 1 &&
      (final.trail?.activeMarks ?? 0) >= 8;
    const gate = inputGate && dynamicsGate && visualGate;
    const details = {
      tape,
      sampleCount: physicsSamples.length,
      visualSampleCount: feelSamples.length,
      p80WheelSteer: Number(p80WheelSteer.toFixed(3)),
      p80ChassisRoll: Number(p80ChassisRoll.toFixed(3)),
      p80Skid: Number(p80Skid.toFixed(3)),
      p80DriftAngle: Number(p80DriftAngle.toFixed(3)),
      p80LateralSpeed: Number(p80LateralSpeed.toFixed(3)),
      driftSampleCount,
      inputGate,
      dynamicsGate,
      visualGate,
      vehicleFeel: feel,
      trail: final?.trail,
      dynamics: final?.drive?.dynamics,
      finalPlayer: final?.player ?? null
    };

    if (gate) {
      pass("vehicle-feel-signature", details);
    } else {
      scenarioFail("vehicle-feel-signature", "Vehicle feel did not prove steering wheels, chassis lean, drift trail and brake skid.", details);
    }
  } finally {
    await releaseDriveKeys(page);
    await page.close();
  }
}

async function checkRealDriveTour(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "real-drive");

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const hookState = await page.evaluate(() => ({
      hasQaStep: typeof window.__IT_ART_STUDIO_QA_STEP__ === "function",
      href: window.location.href
    }));
    if (!hookState.hasQaStep) {
      pass("real-drive:no-step-hook", hookState);
    } else {
      scenarioFail("real-drive:no-step-hook", "Real keyboard route must not expose the deterministic QA step hook.", hookState);
    }

    const initial = await getQaSnapshot(page);
    const targets = [
      {
        id: "ai-lab",
        optional: true,
        position: { x: -10.8, z: -4.8 },
        route: [
          { id: "cloud-dock", zoneId: "cloud-dock", position: { x: -4.1, z: -10.4 }, timeoutMs: 12_000, overshootBrake: true },
          { id: "tech-cloud-ai-approach", position: { x: -8.4, z: -9.1 }, radius: 1.45, timeoutMs: 10_000, overshootBrake: true },
          { id: "ai-lab-approach", position: { x: -10.6, z: -7 }, radius: 1.15, timeoutMs: 10_000, overshootBrake: true },
          { id: "ai-lab", zoneId: "ai-lab", position: { x: -10.8, z: -4.8 }, timeoutMs: 16_000, overshootBrake: true }
        ]
      },
      {
        id: "observability-tower",
        position: { x: -12.4, z: 4.8 },
        route: [
          { id: "observability-tower", zoneId: "observability-tower", position: { x: -12.4, z: 4.8 }, radius: 2.2, timeoutMs: 18_000, overshootBrake: true }
        ]
      },
      {
        id: "design-atelier",
        position: { x: 10.8, z: -5.2 },
        route: [
          { id: "design-spine-return", zoneId: "studio-gate", position: { x: 0, z: 0 }, radius: 2.4, timeoutMs: 18_000, overshootBrake: true },
          { id: "design-atelier", zoneId: "design-atelier", position: { x: 10.8, z: -5.2 }, radius: 3.4, timeoutMs: 18_000, overshootBrake: true }
        ]
      },
      {
        id: "contact-portal",
        position: { x: 0, z: -13.2 },
        route: [
          { id: "studio-gate", zoneId: "studio-gate", position: { x: 0, z: 0 }, timeoutMs: 9_000 },
          { id: "values-plaza", zoneId: "values-plaza", position: { x: 0, z: 12.1 }, timeoutMs: 11_000 },
          { id: "studio-gate", zoneId: "studio-gate", position: { x: 0, z: 0 }, timeoutMs: 9_000 },
          { id: "contact-portal", zoneId: "contact-portal", position: { x: 0, z: -13.2 }, timeoutMs: 11_000 }
        ]
      },
      {
        id: "values-plaza",
        position: { x: 0, z: 12.1 },
        route: [
          { id: "studio-gate", zoneId: "studio-gate", position: { x: 0, z: 0 }, timeoutMs: 9_000 },
          { id: "values-plaza", zoneId: "values-plaza", position: { x: 0, z: 12.1 }, timeoutMs: 11_000 }
        ]
      }
    ];
    const realDriveTargets = targets.filter((target) => target.disabled !== true && target.optional !== true);
    const optionalRealDriveTargets = targets.filter((target) => target.disabled !== true && target.optional === true);
    const requiredRealDriveTargetIds = ["observability-tower", "design-atelier", "contact-portal"];
    const routeResults = [];

    for (const target of realDriveTargets) {
      const result = await driveRouteWithRealKeyboard(page, target);
      const snapshot = await getQaSnapshot(page);
      const targetVisited = snapshot?.visitedZoneIds?.includes(target.id) === true;
      const normalizedResult = { target: target.id, ...result, reached: result.reached || targetVisited, targetVisited };
      routeResults.push(normalizedResult);
      if (normalizedResult.reached && snapshot?.lastInputMode === "keyboard") {
        pass(`real-drive:${target.id}`, {
          elapsedMs: result.elapsedMs,
          sampleCount: result.samples.length,
          maxSampleStepDistance: Number(result.maxSampleStepDistance.toFixed(3)),
          targetVisited,
          player: snapshot.player,
          drive: snapshot.drive
        });
        await page.waitForTimeout(220);
        await inspectCameraSafeArea(page, `real-drive:${target.id}`);
        await inspectSignatureArtifactVisibility(page, `real-drive:${target.id}`);
        await inspectProjectArtifactVisibility(page, `real-drive:${target.id}`);
        await inspectPlaceCompositionVisibility(page, `real-drive:${target.id}`);
      } else {
        scenarioFail(`real-drive:${target.id}`, "Real keyboard drive did not reach the target zone.", {
          result,
          snapshot
        });
      }
    }

    await page.waitForTimeout(320);
    const final = await getQaSnapshot(page);
    const allSamples = routeResults.flatMap((result) => result.samples);
    const xValues = allSamples.map((sample) => sample.player.x);
    const zValues = allSamples.map((sample) => sample.player.z);
    const distanceDelta = Number(((final?.drive?.totalDistance ?? 0) - (initial?.drive?.totalDistance ?? 0)).toFixed(3));
    const frameDelta = (final?.frameCount ?? 0) - (initial?.frameCount ?? 0);
    const xSpan = xValues.length > 0 ? Math.max(...xValues) - Math.min(...xValues) : 0;
    const zSpan = zValues.length > 0 ? Math.max(...zValues) - Math.min(...zValues) : 0;
    const maxStepDistance = Math.max(...routeResults.map((result) => result.maxSampleStepDistance), 0);
    const driveTelemetryMaxStep = maxPositionSampleStep(final?.drive?.positionSamples ?? []);
    const cameraSamples = allSamples.filter((sample) => sample.camera && sample.screen);
    const maxCameraLag = Math.max(...cameraSamples.map((sample) => sample.camera.lag ?? 99), 0);
    const maxCameraDistance = Math.max(...cameraSamples.map((sample) => sample.camera.distanceToPlayer ?? 0), 0);
    const minCameraDistance =
      cameraSamples.length > 0 ? Math.min(...cameraSamples.map((sample) => sample.camera.distanceToPlayer ?? 99)) : 0;
    const invisiblePlayerSamples = cameraSamples.filter((sample) => sample.screen?.player?.visible !== true);
    const invisibleActiveZoneSamples = cameraSamples.filter((sample) => sample.screen?.activeZone?.visible !== true);
    const activeZoneTransitionTolerance = Math.max(12, Math.ceil(cameraSamples.length * 0.08), Math.ceil(distanceDelta * 0.5));
    const visitedTargets = realDriveTargets.filter((target) => final?.visitedZoneIds?.includes(target.id)).map((target) => target.id);
    const visitedRequiredTargets = requiredRealDriveTargetIds.filter((targetId) => final?.visitedZoneIds?.includes(targetId));
    const surface = final?.drive?.surface;
    const expectedRouteIds = [
      "tech-ai-obs",
      "art-gate-design",
      "spine-contact-gate",
      "spine-gate-values"
    ];
    const visitedRouteIds = surface?.visitedRouteIds ?? [];
    const coveredExpectedRouteIds = expectedRouteIds.filter((routeId) => visitedRouteIds.includes(routeId));
    const offRouteRatio = surface?.samples > 0 ? surface.offRouteSamples / surface.samples : 1;
    const driveGate =
      final?.visitedZoneIds?.includes("contact-portal") === true &&
      final.lastInputMode === "keyboard" &&
      (final.input?.qaStepHookCalls ?? 0) === (initial?.input?.qaStepHookCalls ?? 0) &&
      (final.input?.keyboardDownCount ?? 0) >= realDriveTargets.length &&
      (final.input?.keyboardUpCount ?? 0) >= realDriveTargets.length &&
      (final.input?.activeKeys?.length ?? 99) === 0 &&
      frameDelta >= 40 &&
      routeResults.every((result) => (result.reached || result.target === "ai-lab") && result.samples.length >= 3) &&
      visitedTargets.length >= realDriveTargets.length - 1 &&
      visitedRequiredTargets.length === requiredRealDriveTargetIds.length &&
      distanceDelta >= 26 &&
      xSpan >= 8 &&
      zSpan >= 8 &&
      (final.drive?.rotationChange ?? 0) >= 0.8 &&
      (final.drive?.averageSpeed ?? 0) >= 2.4 &&
      (final.trail?.activeMarks ?? 0) >= 10 &&
      (final.drive?.cameraDistance ?? 0) >= 10 &&
      (final.drive?.cameraDistance ?? 0) <= 18 &&
      (final.camera?.lag ?? 99) <= 5.8 &&
      final.screen?.player?.visible === true &&
      final.screen?.activeZone?.visible === true &&
      cameraSamples.length >= allSamples.length * 0.8 &&
      invisiblePlayerSamples.length === 0 &&
      invisibleActiveZoneSamples.length <= activeZoneTransitionTolerance &&
      maxCameraLag <= 5.8 &&
      minCameraDistance >= 10 &&
      maxCameraDistance <= 18 &&
      driveTelemetryMaxStep <= 3.5;
    const continuityDistanceThreshold = realDriveTargets.length >= 3 ? 36 : 40;
    const continuityGate =
      frameDelta >= 180 &&
      (final.drive?.positionSamples?.length ?? 0) >= 45 &&
      routeResults.every(
        (result) =>
          (result.reached || result.target === "ai-lab") &&
          result.samples.length >= 2
      ) &&
      distanceDelta >= continuityDistanceThreshold &&
      driveTelemetryMaxStep <= 2.75 &&
      maxStepDistance <= 5.75 &&
      maxCameraLag <= 2.25 &&
      minCameraDistance >= 13.2 &&
      maxCameraDistance <= 16.8 &&
      invisiblePlayerSamples.length === 0 &&
      invisibleActiveZoneSamples.length <= activeZoneTransitionTolerance &&
      (final.trail?.activeMarks ?? 0) >= 16;
    const routeFreedomGate =
      surface?.segmentCount >= 20 &&
      surface.samples >= 45 &&
      surface.routeAdherenceRatio >= 0.34 &&
      surface.routeAdherenceRatio <= 0.98 &&
      offRouteRatio >= 0.02 &&
      offRouteRatio <= 0.66 &&
      surface.maxOffRouteDistance >= 0.35 &&
      coveredExpectedRouteIds.length >= expectedRouteIds.length - 1;
    const dynamics = final?.drive?.dynamics;
    const physicsSamples = collectUniquePhysicsSamples(routeResults);
    const physicsInputSamples = physicsSamples.filter(
      (sample) =>
        sample.hasInput === true ||
        Math.abs(sample.steeringInput ?? 0) > 0 ||
        Math.abs(sample.throttleInput ?? 0) > 0
    );
    const physicsSteeringSamples = physicsInputSamples.filter(
      (sample) => (sample.speed ?? 0) >= 1.2 && Math.abs(sample.turnRate ?? 0) >= 0.08
    );
    const physicsDriftWindowSamples = physicsSamples.filter(
      (sample) =>
        (sample.speed ?? 0) >= 2 &&
        (Math.abs(sample.lateralSpeed ?? 0) >= 0.16 || Math.abs(sample.driftAngle ?? 0) >= 0.045)
    );
    const physicsSpeeds = physicsSamples.map((sample) => sample.speed ?? 0);
    const physicsAccelerations = physicsSamples.map((sample) => sample.acceleration ?? 0);
    const physicsTurnRates = physicsSamples.map((sample) => Math.abs(sample.turnRate ?? 0));
    const physicsDriftAngles = physicsSamples.map((sample) => Math.abs(sample.driftAngle ?? 0));
    const physicsLateralSpeeds = physicsSamples.map((sample) => Math.abs(sample.lateralSpeed ?? 0));
    const physicsInputTurnRates = physicsSteeringSamples.map((sample) => Math.abs(sample.turnRate ?? 0));
    const physicsWindowDriftAngles = physicsDriftWindowSamples.map((sample) => Math.abs(sample.driftAngle ?? 0));
    const physicsWindowLateralSpeeds = physicsDriftWindowSamples.map((sample) => Math.abs(sample.lateralSpeed ?? 0));
    const driftSampleCount = physicsSamples.filter((sample) => (sample.speed ?? 0) >= 2 && Math.abs(sample.driftAngle ?? 0) >= 0.12).length;
    const physicsFrameSpan =
      physicsSamples.length > 1 ? physicsSamples.at(-1).frame - physicsSamples[0].frame : 0;
    const physicsMaxDisplacementPerFrame = maxPhysicsDisplacementPerFrame(physicsSamples);
    const physicsP95Speed = percentile(physicsSpeeds, 0.95);
    const physicsP95Acceleration = percentile(physicsAccelerations, 0.95);
    const physicsP95TurnRate = percentile(physicsTurnRates, 0.95);
    const physicsP95DriftAngle = percentile(physicsDriftAngles, 0.95);
    const physicsP95LateralSpeed = percentile(physicsLateralSpeeds, 0.95);
    const physicsInputP80TurnRate = percentile(physicsInputTurnRates, 0.8);
    const physicsWindowP80DriftAngle = percentile(physicsWindowDriftAngles, 0.8);
    const physicsWindowP80LateralSpeed = percentile(physicsWindowLateralSpeeds, 0.8);
    const tourDriftProof =
      driftSampleCount >= 2 ||
      (physicsDriftWindowSamples.length >= 5 &&
        physicsWindowP80DriftAngle >= 0.045 &&
        physicsWindowP80LateralSpeed >= 0.16);
    const kinematicsGate =
      physicsSamples.length >= 90 &&
      physicsInputSamples.length >= 35 &&
      physicsSteeringSamples.length >= 8 &&
      physicsDriftWindowSamples.length >= 5 &&
      physicsFrameSpan >= 120 &&
      physicsSamples.every(
        (sample) =>
          Number.isFinite(sample.tMs) &&
          Number.isFinite(sample.speed) &&
          Number.isFinite(sample.acceleration) &&
          Number.isFinite(sample.turnRate) &&
          Number.isFinite(sample.forwardSpeed) &&
          Number.isFinite(sample.lateralSpeed) &&
          Number.isFinite(sample.driftAngle)
      ) &&
      (dynamics?.movingSamples ?? 0) >= 75 &&
      (dynamics?.inputSamples ?? 0) >= 35 &&
      (dynamics?.coastingSamples ?? 0) >= 18 &&
      (dynamics?.peakSpeed ?? 0) >= 8 &&
      (dynamics?.peakSpeed ?? 99) <= 18 &&
      (dynamics?.averageAcceleration ?? 0) >= 4 &&
      (dynamics?.peakAcceleration ?? 0) >= 12 &&
      (dynamics?.peakTurnRate ?? 0) >= 1.2 &&
      (dynamics?.peakTurnRate ?? 99) <= 8.5 &&
      (dynamics?.averageTurnRate ?? 99) <= 4.4 &&
      physicsP95Speed <= 17.5 &&
      physicsP95Acceleration <= 82 &&
      physicsP95TurnRate <= 6.8 &&
      physicsInputP80TurnRate >= 0.5 &&
      physicsInputP80TurnRate <= 6.8 &&
      physicsWindowP80DriftAngle >= 0.045 &&
      physicsWindowP80DriftAngle <= 1.55 &&
      physicsWindowP80LateralSpeed >= 0.16 &&
      tourDriftProof &&
      physicsMaxDisplacementPerFrame <= 2.35 &&
      hasDragReleaseProof(physicsSamples);

    if (driveGate) {
      pass("real-drive-tour", {
        distanceDelta,
        frameDelta,
        xSpan: Number(xSpan.toFixed(3)),
        zSpan: Number(zSpan.toFixed(3)),
        maxStepDistance: Number(maxStepDistance.toFixed(3)),
        driveTelemetryMaxStep: Number(driveTelemetryMaxStep.toFixed(3)),
        maxCameraLag: Number(maxCameraLag.toFixed(3)),
        minCameraDistance: Number(minCameraDistance.toFixed(3)),
        maxCameraDistance: Number(maxCameraDistance.toFixed(3)),
        invisibleActiveZoneSamples: invisibleActiveZoneSamples.length,
        activeZoneTransitionTolerance,
        visitedTargets,
        requiredRealDriveTargetIds,
        visitedRequiredTargets,
        input: final.input,
        drive: final.drive,
        camera: final.camera,
        screen: final.screen,
        trail: final.trail
      });
    } else {
      scenarioFail("real-drive-tour", "Real keyboard tour did not prove fluid controllable traversal.", {
        distanceDelta,
        frameDelta,
        xSpan,
        zSpan,
        maxStepDistance,
        driveTelemetryMaxStep,
        maxCameraLag,
        minCameraDistance,
        maxCameraDistance,
        invisiblePlayerSamples,
        invisibleActiveZoneSamples,
        activeZoneTransitionTolerance,
        visitedTargets,
        requiredRealDriveTargetIds,
        visitedRequiredTargets,
        input: final?.input,
        final,
        routeResults
      });
    }

    if (continuityGate) {
      pass("real-drive-continuity", {
        distanceDelta,
        frameDelta,
        driveTelemetryMaxStep: Number(driveTelemetryMaxStep.toFixed(3)),
        maxStepDistance: Number(maxStepDistance.toFixed(3)),
        maxCameraLag: Number(maxCameraLag.toFixed(3)),
        minCameraDistance: Number(minCameraDistance.toFixed(3)),
        maxCameraDistance: Number(maxCameraDistance.toFixed(3)),
        distanceThreshold: continuityDistanceThreshold,
        invisiblePlayerSamples: invisiblePlayerSamples.length,
        invisibleActiveZoneSamples: invisibleActiveZoneSamples.length,
        activeZoneTransitionTolerance,
        trail: final?.trail,
        routeResults: routeResults.map((result) => ({
          target: result.target,
          reached: result.reached,
          targetVisited: result.targetVisited,
          samples: result.samples.length,
          steps: result.stepResults?.map((step) => ({ step: step.step, reached: step.reached, samples: step.samples.length })) ?? []
        }))
      });
    } else {
      scenarioFail("real-drive-continuity", "Real keyboard route is not continuous enough for a premium driving feel.", {
        distanceDelta,
        frameDelta,
        driveTelemetryMaxStep,
        maxStepDistance,
        maxCameraLag,
        minCameraDistance,
        maxCameraDistance,
        distanceThreshold: continuityDistanceThreshold,
        invisiblePlayerSamples,
        invisibleActiveZoneSamples,
        activeZoneTransitionTolerance,
        trail: final?.trail,
        routeResults
      });
    }

    if (kinematicsGate) {
      pass("real-drive-kinematics", {
        dynamics,
        sampleCount: physicsSamples.length,
        inputSampleCount: physicsInputSamples.length,
        steeringSampleCount: physicsSteeringSamples.length,
        driftWindowSampleCount: physicsDriftWindowSamples.length,
        physicsFrameSpan,
        physicsP95Speed: Number(physicsP95Speed.toFixed(3)),
        physicsP95Acceleration: Number(physicsP95Acceleration.toFixed(3)),
        physicsP95TurnRate: Number(physicsP95TurnRate.toFixed(3)),
        physicsP95DriftAngle: Number(physicsP95DriftAngle.toFixed(3)),
        physicsP95LateralSpeed: Number(physicsP95LateralSpeed.toFixed(3)),
        physicsInputP80TurnRate: Number(physicsInputP80TurnRate.toFixed(3)),
        physicsWindowP80DriftAngle: Number(physicsWindowP80DriftAngle.toFixed(3)),
        physicsWindowP80LateralSpeed: Number(physicsWindowP80LateralSpeed.toFixed(3)),
        tourDriftProof,
        driftSampleCount,
        physicsMaxDisplacementPerFrame: Number(physicsMaxDisplacementPerFrame.toFixed(3)),
        dragReleaseProof: hasDragReleaseProof(physicsSamples)
      });
    } else {
      scenarioFail("real-drive-kinematics", "Real keyboard drive does not prove acceleration, drag, and bounded turn dynamics.", {
        dynamics,
        sampleCount: physicsSamples.length,
        inputSampleCount: physicsInputSamples.length,
        steeringSampleCount: physicsSteeringSamples.length,
        driftWindowSampleCount: physicsDriftWindowSamples.length,
        physicsFrameSpan,
        physicsP95Speed,
        physicsP95Acceleration,
        physicsP95TurnRate,
        physicsP95DriftAngle,
        physicsP95LateralSpeed,
        physicsInputP80TurnRate,
        physicsWindowP80DriftAngle,
        physicsWindowP80LateralSpeed,
        tourDriftProof,
        driftSampleCount,
        physicsMaxDisplacementPerFrame,
        dragReleaseProof: hasDragReleaseProof(physicsSamples),
        firstSamples: physicsSamples.slice(0, 6),
        lastSamples: physicsSamples.slice(-6)
      });
    }

    if (routeFreedomGate) {
      pass("real-drive-route-freedom", {
        surface,
        offRouteRatio: Number(offRouteRatio.toFixed(3)),
        expectedRouteIds,
        coveredExpectedRouteIds
      });
    } else {
      scenarioFail("real-drive-route-freedom", "Real keyboard route is either glued to roads or no longer covers the designed graph.", {
        surface,
        offRouteRatio,
        expectedRouteIds,
        coveredExpectedRouteIds,
        routeResults
      });
    }

    for (const target of optionalRealDriveTargets) {
      const result = await driveRouteWithRealKeyboard(page, target);
      const snapshot = await getQaSnapshot(page);
      const targetVisited = snapshot?.visitedZoneIds?.includes(target.id) === true;
      pass(`real-drive:${target.id}:optional-coverage`, {
        reached: result.reached || targetVisited,
        elapsedMs: result.elapsedMs,
        sampleCount: result.samples.length,
        maxSampleStepDistance: Number(result.maxSampleStepDistance.toFixed(3)),
        targetVisited,
        player: snapshot?.player,
        drive: snapshot?.drive
      });
    }

    const artEncounterDrive = await inspectRouteEncounterFromFreshDrive(browser, {
      label: "real-drive:art-gate-design",
      routeId: "art-gate-design",
      position: { x: 6.4, z: -4.84 },
      radius: 1.1,
      timeoutMs: 10_000,
      route: [
        { id: "route-encounter-art-from-studio", position: { x: 3.7, z: -3.1 }, radius: 1.55, timeoutMs: 12_000, overshootBrake: true },
        { id: "route-encounter:art-gate-design", position: { x: 6.4, z: -4.84 }, radius: 1.45, timeoutMs: 16_000, overshootBrake: true }
      ]
    });

    const techEncounterDrive = await inspectRouteEncounterFromFreshDrive(browser, {
      label: "real-drive:tech-gate-cloud",
      routeId: "tech-gate-cloud",
      position: { x: -4.45, z: -10.08 },
      radius: 1.45,
      timeoutMs: 18_000,
      allowMiss: true,
      route: [
        { id: "route-encounter-tech-cloud-jump", miniMapZoneId: "cloud-dock", timeoutMs: 10_000, pauseMs: 240 },
        { id: "route-encounter-tech-via-gate-cloud-entry", position: { x: -6.1, z: -13.6 }, radius: 1.7, timeoutMs: 12_000, overshootBrake: true },
        { id: "route-encounter-tech-via-gate-cloud", position: { x: -5.1, z: -11.4 }, radius: 1.55, timeoutMs: 12_000, overshootBrake: true },
        {
          id: "route-encounter:tech-gate-cloud",
          position: { x: -4.45, z: -10.08 },
          radius: 1.35,
          timeoutMs: 18_000,
          overshootBrake: true,
          skipPostReachSamples: false
        }
      ]
    });

    const encounterDrive = await inspectRouteEncounterFromFreshDrive(browser, {
      label: "real-drive:spine-gate-values",
      routeId: "spine-gate-values",
      position: { x: -1.36, z: 9.75 },
      radius: 1.45,
      timeoutMs: 12_000,
      verifyVisibility: false,
      route: [
        { id: "route-encounter-spine-values-approach", position: { x: -0.72, z: 4.8 }, radius: 1.45, timeoutMs: 10_000, overshootBrake: true },
        {
          id: "route-encounter:spine-gate-values",
          position: { x: -1.36, z: 9.75 },
          radius: 1.55,
          timeoutMs: 14_000,
          overshootBrake: true,
          skipPostReachSamples: true
        }
      ]
    });
    const encounterFinal = await getQaSnapshot(page, { refresh: true });

    const routeEncounters = encounterFinal?.routeEncounters ?? final?.routeEncounters;
    const visitedEncounterIds = routeEncounters?.visitedIds ?? [];
    const studioEncounterProven = encounterDrive.reached || (encounterDrive.momentProofs?.length ?? 0) > 0;
    const artEncounterProven = artEncounterDrive.reached || (artEncounterDrive.momentProofs?.length ?? 0) > 0;
    const techEncounterProven = techEncounterDrive.reached || (techEncounterDrive.momentProofs?.length ?? 0) > 0;
    const provenEncounterIds = [
      ...visitedEncounterIds,
      studioEncounterProven ? "proof:spine-gate-values" : null,
      techEncounterProven ? "proof:tech-gate-cloud" : null,
      artEncounterProven ? "proof:art-gate-design" : null
    ].filter(Boolean);
    const combinedVisitedEncounterCount = new Set(provenEncounterIds).size;
    const routeEncounterKinds = {
      studio: visitedEncounterIds.some((id) => id.includes("spine-")) || studioEncounterProven,
      tech: visitedEncounterIds.some((id) => id.includes("tech-")) || techEncounterProven,
      art: visitedEncounterIds.some((id) => id.includes("art-")) || artEncounterProven
    };
    const routeEncounterFamilyProof =
      routeEncounterKinds.studio &&
      routeEncounterKinds.tech &&
      routeEncounterKinds.art &&
      combinedVisitedEncounterCount >= 3;
    const routeEncounterGate =
      routeEncounters &&
      routeEncounters.gateCount >= 11 &&
      routeEncounters.objectCount >= 11 &&
      (combinedVisitedEncounterCount >= 4 || routeEncounterFamilyProof) &&
      routeEncounters.maxIntensity >= 0.45 &&
      routeEncounterKinds.studio &&
      routeEncounterKinds.tech &&
      routeEncounterKinds.art;

    if (routeEncounterGate) {
      pass("route-encounter-triggered:real-drive", {
        routeEncounters,
        routeEncounterKinds,
        routeEncounterFamilyProof,
        studioEncounterProven,
        techEncounterProven,
        artEncounterProven,
        provenEncounterIds,
        combinedVisitedEncounterCount,
        expectedMinVisited: 4,
        expectedMinIntensity: 0.45
      });
    } else {
      scenarioFail("route-encounter-triggered:real-drive", "Real keyboard route did not trigger enough route encounter gates.", {
        routeEncounters,
        routeEncounterKinds,
        routeEncounterFamilyProof,
        studioEncounterProven,
        techEncounterProven,
        artEncounterProven,
        provenEncounterIds,
        combinedVisitedEncounterCount,
        expectedMinVisited: 4,
        expectedMinIntensity: 0.45
      });
    }

    await capture(page, "real-drive-tour");
  } finally {
    await releaseDriveKeys(page);
    await page.close();
  }
}

async function checkRealDriveFreeRoam(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "real-drive-free-roam");

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const initial = await getQaSnapshot(page, { refresh: true });
    const target = {
      id: "free-roam-southeast-field",
      position: { x: 21.5, z: -18.8 },
      radius: 1.8,
      timeoutMs: 10_000,
      overshootBrake: true,
      skipPostReachSamples: true
    };
    const result = await driveWithRealKeyboard(page, target);
    await page.waitForTimeout(320);
    const final = await getQaSnapshot(page, { refresh: true });
    const samples = result.samples ?? [];
    const xValues = samples.map((sample) => sample.player.x);
    const zValues = samples.map((sample) => sample.player.z);
    const xSpan = xValues.length > 0 ? Math.max(...xValues) - Math.min(...xValues) : 0;
    const zSpan = zValues.length > 0 ? Math.max(...zValues) - Math.min(...zValues) : 0;
    const physicsSamples = final?.drive?.physicsSamples ?? [];
    const offRoutePhysics = physicsSamples.filter((sample) => sample.onRoute === false);
    const maxRouteDistance = Math.max(...physicsSamples.map((sample) => sample.routeDistance ?? 0), 0);
    const maxStepDistance = maxPositionSampleStep(final?.drive?.positionSamples ?? []);
    const distanceDelta = Number(((final?.drive?.totalDistance ?? 0) - (initial?.drive?.totalDistance ?? 0)).toFixed(3));
    const freeRoamGate =
      result.reached &&
      final?.lastInputMode === "keyboard" &&
      (final.input?.activeKeys?.length ?? 99) === 0 &&
      distanceDelta >= 10 &&
      xSpan >= 7 &&
      zSpan >= 4 &&
      offRoutePhysics.length >= 8 &&
      maxRouteDistance >= (final?.drive?.surface?.routeWidth ?? 1.45) + 0.55 &&
      (final?.drive?.dynamics?.freeRoamRatio ?? 0) >= 0.08 &&
      maxStepDistance <= 3.4 &&
      final.screen?.player?.visible === true;

    if (freeRoamGate) {
      pass("real-drive-free-roam", {
        target,
        result: {
          reached: result.reached,
          elapsedMs: result.elapsedMs,
          sampleCount: samples.length,
          maxSampleStepDistance: Number(result.maxSampleStepDistance.toFixed(3))
        },
        distanceDelta,
        xSpan: Number(xSpan.toFixed(3)),
        zSpan: Number(zSpan.toFixed(3)),
        offRoutePhysicsSamples: offRoutePhysics.length,
        maxRouteDistance: Number(maxRouteDistance.toFixed(3)),
        maxStepDistance: Number(maxStepDistance.toFixed(3)),
        dynamics: final.drive?.dynamics,
        surface: final.drive?.surface,
        player: final.player
      });
    } else {
      scenarioFail("real-drive-free-roam", "Real keyboard drive did not prove permissive off-road traversal.", {
        target,
        result: {
          reached: result.reached,
          elapsedMs: result.elapsedMs,
          sampleCount: samples.length,
          maxSampleStepDistance: Number(result.maxSampleStepDistance.toFixed(3)),
          lastSamples: samples.slice(-6).map((sample) => ({
            frameCount: sample.frameCount,
            activeZoneId: sample.activeZoneId,
            player: sample.player,
            surface: sample.drive?.surface,
            dynamics: sample.drive?.dynamics
          }))
        },
        distanceDelta,
        xSpan,
        zSpan,
        offRoutePhysicsSamples: offRoutePhysics.length,
        maxRouteDistance,
        maxStepDistance,
        final: {
          activeZoneId: final?.activeZoneId,
          player: final?.player,
          input: final?.input,
          dynamics: final?.drive?.dynamics,
          surface: final?.drive?.surface,
          physicsSamples: physicsSamples.slice(-12)
        }
      });
    }
  } catch (error) {
    scenarioFail("real-drive-free-roam", "Free-roam keyboard gate crashed.", {
      url: realDriveUrl,
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await releaseDriveKeys(page).catch(() => {});
    await page.close();
  }
}

function collectUniquePhysicsSamples(routeResults) {
  const physicsByKey = new Map();
  for (const result of routeResults) {
    for (const snapshot of result.samples ?? []) {
      for (const sample of snapshot.drive?.physicsSamples ?? []) {
        physicsByKey.set(`${sample.frame}:${sample.x}:${sample.z}`, sample);
      }
    }
  }
  return [...physicsByKey.values()].sort((left, right) => (left.frame ?? 0) - (right.frame ?? 0));
}

async function checkRealDriveWholeMapFreedom(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "real-drive-whole-map-freedom");
  const fullTargets = [
    { id: "southwest-field", position: { x: -qaInnerRoamExtent, z: -qaInnerRoamExtent }, radius: 1.35, timeoutMs: 15_000, overshootBrake: true },
    { id: "southeast-field", position: { x: qaInnerRoamExtent, z: -qaInnerRoamExtent }, radius: 1.35, timeoutMs: 15_000, overshootBrake: true },
    { id: "east-mid-field", position: { x: qaInnerRoamExtent, z: 0 }, radius: 1.35, timeoutMs: 12_000, overshootBrake: true },
    { id: "northeast-field", position: { x: qaInnerRoamExtent, z: qaInnerRoamExtent }, radius: 1.35, timeoutMs: 15_000, overshootBrake: true },
    { id: "north-mid-field", position: { x: 0, z: qaInnerRoamExtent }, radius: 1.35, timeoutMs: 12_000, overshootBrake: true },
    {
      id: "northwest-field",
      position: { x: -qaInnerRoamExtent, z: qaInnerRoamExtent - 1.6 },
      radius: 1.6,
      timeoutMs: 18_000,
      overshootBrake: true
    },
    { id: "west-mid-field", position: { x: -qaInnerRoamExtent, z: 0 }, radius: 1.35, timeoutMs: 12_000, overshootBrake: true },
    { id: "south-mid-field", position: { x: 0, z: -qaInnerRoamExtent }, radius: 1.35, timeoutMs: 12_000, overshootBrake: true },
    { id: "center-return", position: { x: 0, z: 0 }, radius: 1.4, timeoutMs: 12_000, overshootBrake: true }
  ];
  const targets = qaProfile === "quick"
    ? [fullTargets[0], fullTargets[1], fullTargets[2], fullTargets[3], fullTargets[5], fullTargets[6], fullTargets[8]]
    : fullTargets;
  const routeResults = [];

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const initial = await getQaSnapshot(page, { refresh: true });
    for (const target of targets) {
      const result = await driveWithRealKeyboard(page, target);
      routeResults.push({ target, ...result });
      await page.waitForTimeout(120);
    }
    const final = await getQaSnapshot(page, { refresh: true });
    const positions = routeResults.flatMap((result) => (result.samples ?? []).map((sample) => sample.player).filter(Boolean));
    const xValues = positions.map((position) => position.x);
    const zValues = positions.map((position) => position.z);
    const xSpan = xValues.length > 0 ? Math.max(...xValues) - Math.min(...xValues) : 0;
    const zSpan = zValues.length > 0 ? Math.max(...zValues) - Math.min(...zValues) : 0;
    const physicsSamples = collectUniquePhysicsSamples(routeResults);
    const offRoutePhysics = physicsSamples.filter((sample) => sample.onRoute === false);
    const quadrants = new Set(
      offRoutePhysics
        .filter((sample) => Math.abs(sample.x) >= 3 && Math.abs(sample.z) >= 3)
        .map((sample) => `${sample.x >= 0 ? "east" : "west"}-${sample.z >= 0 ? "north" : "south"}`)
    );
    const interiorEdgeBands = new Set();
    const interiorBandMaxDistance = Math.max(4.2, qaWorldHalfExtent - qaInnerRoamExtent + 0.8);
    for (const sample of offRoutePhysics) {
      if ((sample.boundaryDistance ?? 99) <= 1.4 || (sample.boundaryDistance ?? 99) >= interiorBandMaxDistance) {
        continue;
      }
      if (sample.x >= qaInnerRoamExtent - 1) interiorEdgeBands.add("east");
      if (sample.x <= -qaInnerRoamExtent + 1) interiorEdgeBands.add("west");
      if (sample.z >= qaInnerRoamExtent - 1) interiorEdgeBands.add("north");
      if (sample.z <= -qaInnerRoamExtent + 1) interiorEdgeBands.add("south");
    }
    const maxRouteDistance = Math.max(...physicsSamples.map((sample) => sample.routeDistance ?? 0), 0);
    const maxPhysicsStep = maxPhysicsDisplacementPerFrame(physicsSamples);
    const positionSamples = routeResults.flatMap((result) => (result.samples ?? []).map((sample) => sample.player).filter(Boolean));
    const maxPositionStep = maxPositionSampleStep(positionSamples);
    const outOfBoundsSamples = physicsSamples.filter(
      (sample) => Math.abs(sample.x) > qaWorldHalfExtent + 0.02 || Math.abs(sample.z) > qaWorldHalfExtent + 0.02
    );
    const distanceDelta = Number(((final?.drive?.totalDistance ?? 0) - (initial?.drive?.totalDistance ?? 0)).toFixed(3));
    const reachedTargetCount = routeResults.filter((result) => result.reached).length;
    const allTargetsReached = reachedTargetCount === routeResults.length;
    const targetCoverageGate =
      qaProfile === "quick"
        ? reachedTargetCount >= 3
        : reachedTargetCount >= Math.max(5, Math.ceil(routeResults.length * 0.6));
    const maxPositionStepLimit = qaProfile === "quick" ? 3.4 : 4.2;
    const expectedQuadrants = 4;
    const expectedBands = qaProfile === "quick" ? 3 : 4;
    const freedomGate =
      targetCoverageGate &&
      xSpan >= 56 &&
      zSpan >= 56 &&
      quadrants.size >= expectedQuadrants &&
      interiorEdgeBands.size >= expectedBands &&
      distanceDelta >= (qaProfile === "quick" ? 128 : 175) &&
      offRoutePhysics.length >= (qaProfile === "quick" ? 155 : 225) &&
      (final?.drive?.dynamics?.freeRoamRatio ?? 0) >= 0.36 &&
      maxRouteDistance >= (final?.drive?.surface?.routeWidth ?? 1.45) + 6 &&
      maxPhysicsStep <= 1.1 &&
      maxPositionStep <= maxPositionStepLimit &&
      outOfBoundsSamples.length === 0 &&
      (final?.drive?.boundary?.hardStopAwayFromEdgeCount ?? 999) === 0 &&
      final?.screen?.player?.visible === true &&
      (final?.input?.activeKeys?.length ?? 99) === 0;

    if (freedomGate) {
      pass("real-drive-whole-map-freedom", {
        profile: qaProfile,
        targetCount: targets.length,
        reachedTargetCount,
        allTargetsReached,
        xSpan: Number(xSpan.toFixed(3)),
        zSpan: Number(zSpan.toFixed(3)),
        quadrants: [...quadrants].sort(),
        interiorEdgeBands: [...interiorEdgeBands].sort(),
        interiorBandMaxDistance: Number(interiorBandMaxDistance.toFixed(3)),
        distanceDelta,
        offRoutePhysicsSamples: offRoutePhysics.length,
        maxRouteDistance: Number(maxRouteDistance.toFixed(3)),
        maxPhysicsStep: Number(maxPhysicsStep.toFixed(3)),
        maxPositionStep: Number(maxPositionStep.toFixed(3)),
        maxPositionStepLimit,
        boundary: final.drive?.boundary,
        targets: routeResults.map((result) => ({
          id: result.target.id,
          reached: result.reached,
          elapsedMs: result.elapsedMs,
          sampleCount: result.samples?.length ?? 0
        }))
      });
    } else {
      scenarioFail("real-drive-whole-map-freedom", "Real keyboard route did not prove whole-map traversal without invisible stops.", {
        profile: qaProfile,
        targetCount: targets.length,
        reachedTargetCount,
        allTargetsReached,
        targetCoverageGate,
        xSpan,
        zSpan,
        quadrants: [...quadrants].sort(),
        interiorEdgeBands: [...interiorEdgeBands].sort(),
        interiorBandMaxDistance,
        distanceDelta,
        offRoutePhysicsSamples: offRoutePhysics.length,
        maxRouteDistance,
        maxPhysicsStep,
        maxPositionStep,
        maxPositionStepLimit,
        outOfBoundsSamples: outOfBoundsSamples.slice(0, 8),
        boundary: final?.drive?.boundary,
        player: final?.player,
        targets: routeResults.map((result) => ({
          id: result.target.id,
          reached: result.reached,
          elapsedMs: result.elapsedMs,
          sampleCount: result.samples?.length ?? 0,
          lastSamples: result.samples?.slice(-4).map((sample) => ({ player: sample.player, boundary: sample.drive?.boundary }))
        }))
      });
    }
  } catch (error) {
    scenarioFail("real-drive-whole-map-freedom", "Whole-map freedom gate crashed.", {
      url: realDriveUrl,
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await releaseDriveKeys(page).catch(() => {});
    await page.close();
  }
}

async function checkRealDriveVisibleBoundary(browser) {
  const targets = [
    { id: "edge-north", boundaryAxis: "z-max", position: { x: 0, z: qaBoundaryTargetExtent }, timeoutMs: 10_000 },
    { id: "edge-south", boundaryAxis: "z-min", position: { x: 0, z: -qaBoundaryTargetExtent }, timeoutMs: 10_000 },
    { id: "edge-east", boundaryAxis: "x-max", position: { x: qaBoundaryTargetExtent, z: 0 }, timeoutMs: 10_000 },
    { id: "edge-west", boundaryAxis: "x-min", position: { x: -qaBoundaryTargetExtent, z: 0 }, timeoutMs: 10_000 }
  ];
  const proofs = [];

  for (const target of targets) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    attachPageDiagnostics(page, `no-invisible-obstacles:${target.id}`);
    try {
      await assertReady(page, realDriveUrl);
      await assertCanvasGeometry(page);
      const initial = await getQaSnapshot(page, { refresh: true });
      const result = await driveWithRealKeyboard(page, {
        ...target,
        radius: 0.5,
        skipPostReachSamples: true
      });
      const final = await getQaSnapshot(page, { refresh: true });
      const samples = result.samples ?? [];
      const contactSamples = samples.filter((sample) => {
        const boundary = sample.drive?.boundary;
        return (
          (boundary?.contactAxes?.[target.boundaryAxis] ?? 0) > 0 ||
          (boundary?.lastContactAxis ?? "").split("+").includes(target.boundaryAxis) ||
          (boundary?.distanceToEdge ?? 99) <= 0.06
        );
      });
      const physicsSamples = final?.drive?.physicsSamples ?? [];
      const offRouteSamples = physicsSamples.filter((sample) => sample.onRoute === false);
      const maxRouteDistance = Math.max(...physicsSamples.map((sample) => sample.routeDistance ?? 0), 0);
      const minBoundaryDistance = Math.min(...physicsSamples.map((sample) => sample.boundaryDistance ?? 99), 99);
      const maxStepDistance = maxPositionSampleStep(final?.drive?.positionSamples ?? []);
      const distanceDelta = Number(((final?.drive?.totalDistance ?? 0) - (initial?.drive?.totalDistance ?? 0)).toFixed(3));
      const boundary = final?.drive?.boundary;
      const contactAxisCount = boundary?.contactAxes?.[target.boundaryAxis] ?? 0;
      const maxContactSpeed = Math.max(
        ...contactSamples.map((sample) => sample.drive?.boundary?.lastContactSpeed ?? 0),
        boundary?.lastContactSpeed ?? 0,
        0
      );
      const reachedVisibleEdge =
        result.reached &&
        contactSamples.length > 0 &&
        contactAxisCount > 0 &&
        minBoundaryDistance <= 0.08 &&
        maxContactSpeed >= 0.1;
      const intentionalBoundaryContact =
        distanceDelta >= 12 &&
        offRouteSamples.length >= 12 &&
        maxRouteDistance >= (final?.drive?.surface?.routeWidth ?? 1.45) + 0.75 &&
        maxStepDistance <= 3.4 &&
        final?.screen?.player?.visible === true &&
        (final?.input?.activeKeys?.length ?? 99) === 0;

      proofs.push({
        target,
        reached: result.reached,
        reachedVisibleEdge,
        intentionalBoundaryContact,
        elapsedMs: result.elapsedMs,
        sampleCount: samples.length,
        contactSamples: contactSamples.length,
        contactAxisCount,
        maxContactSpeed: Number(maxContactSpeed.toFixed(3)),
        distanceDelta,
        offRouteSamples: offRouteSamples.length,
        maxRouteDistance: Number(maxRouteDistance.toFixed(3)),
        minBoundaryDistance: Number(minBoundaryDistance.toFixed(3)),
        maxStepDistance: Number(maxStepDistance.toFixed(3)),
        boundary,
        player: final?.player,
        lastSamples: samples.slice(-4).map((sample) => ({
          frameCount: sample.frameCount,
          player: sample.player,
          boundary: sample.drive?.boundary,
          dynamics: sample.drive?.dynamics
        }))
      });
    } catch (error) {
      proofs.push({
        target,
        reached: false,
        reachedVisibleEdge: false,
        intentionalBoundaryContact: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      await releaseDriveKeys(page).catch(() => {});
      await page.close();
    }
  }

  const allEdgesReached = proofs.every((proof) => proof.reachedVisibleEdge);
  const intentionalContacts = proofs.every((proof) => proof.intentionalBoundaryContact);
  if (allEdgesReached && intentionalContacts) {
    pass("real-drive-visible-boundary", {
      edgeCount: proofs.length,
      expectedAxes: targets.map((target) => target.boundaryAxis),
      proofs
    });
  } else {
    scenarioFail("real-drive-visible-boundary", "Keyboard free-roam did not prove that world-edge contacts are visible and intentional.", {
      allEdgesReached,
      intentionalContacts,
      proofs
    });
  }
}

async function inspectGameplayMomentVisibility(page, label, driveResult = null, expectedRouteId = null) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  let state = await page.evaluate((qa) => {
    const round = (value, digits = 3) => Number(value.toFixed(digits));
    const selectors = [".game-hud", ".zone-panel", ".world-map", ".mobile-drive", ".mobile-zone-nav"];
    const uiRects = selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0 ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return null;
        }
        return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter(Boolean);
    const toRect = (item) => {
      if (!item) {
        return null;
      }
      return {
        left: item.clippedX ?? item.x,
        top: item.clippedY ?? item.y,
        right: (item.clippedX ?? item.x) + (item.clippedWidth ?? item.width),
        bottom: (item.clippedY ?? item.y) + (item.clippedHeight ?? item.height)
      };
    };
    const uiOcclusion = (item) => {
      const rect = toRect(item);
      const area = item?.clippedArea ?? item?.area ?? 0;
      if (!rect || area <= 0) {
        return { area: 0, ratio: 1 };
      }
      const xEdges = [rect.left, rect.right];
      const yEdges = [rect.top, rect.bottom];
      for (const ui of uiRects) {
        const left = Math.max(rect.left, ui.left);
        const right = Math.min(rect.right, ui.right);
        const top = Math.max(rect.top, ui.top);
        const bottom = Math.min(rect.bottom, ui.bottom);
        if (right > left && bottom > top) {
          xEdges.push(left, right);
          yEdges.push(top, bottom);
        }
      }
      const xs = [...new Set(xEdges)].sort((a, b) => a - b);
      const ys = [...new Set(yEdges)].sort((a, b) => a - b);
      let occluded = 0;
      for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
        for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
          const left = xs[xIndex];
          const right = xs[xIndex + 1];
          const top = ys[yIndex];
          const bottom = ys[yIndex + 1];
          const centerX = (left + right) / 2;
          const centerY = (top + bottom) / 2;
          if (
            uiRects.some(
              (ui) => centerX >= ui.left && centerX <= ui.right && centerY >= ui.top && centerY <= ui.bottom
            )
          ) {
            occluded += Math.max(0, right - left) * Math.max(0, bottom - top);
          }
        }
      }
      return { area: round(occluded, 1), ratio: round(Math.min(1, occluded / area)) };
    };
    const centerOccluders = (item) => {
      const center = item?.center ?? null;
      if (!center) {
        return ["missing-center"];
      }
      return uiRects
        .filter(
          (rect) =>
            center.x >= rect.left - 10 &&
            center.x <= rect.right + 10 &&
            center.y >= rect.top - 10 &&
            center.y <= rect.bottom + 10
        )
        .map((rect) => rect.selector);
    };
    const sampleCanvasRoi = (rect) => {
      const canvas = document.querySelector("#studio-map-canvas");
      if (!(canvas instanceof HTMLCanvasElement) || !rect || rect.clippedWidth <= 1 || rect.clippedHeight <= 1) {
        return { sampled: false, brightRatio: 0, edgeDensity: 0, colorBuckets: 0, roiWidth: 0, roiHeight: 0 };
      }
      const canvasRect = canvas.getBoundingClientRect();
      const sourceLeft = Math.max(0, rect.clippedX - canvasRect.left);
      const sourceTop = Math.max(0, rect.clippedY - canvasRect.top);
      const sourceWidth = Math.min(rect.clippedWidth, canvasRect.width - sourceLeft);
      const sourceHeight = Math.min(rect.clippedHeight, canvasRect.height - sourceTop);
      if (sourceWidth <= 1 || sourceHeight <= 1) {
        return { sampled: false, brightRatio: 0, edgeDensity: 0, colorBuckets: 0, roiWidth: 0, roiHeight: 0 };
      }
      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      const sx = Math.max(0, Math.floor(sourceLeft * scaleX));
      const sy = Math.max(0, Math.floor(sourceTop * scaleY));
      const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(sourceWidth * scaleX)));
      const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(sourceHeight * scaleY)));
      const roiSize = 64;
      const roi = document.createElement("canvas");
      roi.width = roiSize;
      roi.height = roiSize;
      const context = roi.getContext("2d", { willReadFrequently: true });
      if (!context) {
        return { sampled: false, brightRatio: 0, edgeDensity: 0, colorBuckets: 0, roiWidth: roiSize, roiHeight: roiSize };
      }
      let pixels;
      try {
        context.drawImage(canvas, sx, sy, sw, sh, 0, 0, roiSize, roiSize);
        pixels = context.getImageData(0, 0, roiSize, roiSize).data;
      } catch (error) {
        return {
          sampled: false,
          error: error instanceof Error ? error.message : String(error),
          brightRatio: 0,
          edgeDensity: 0,
          colorBuckets: 0,
          roiWidth: roiSize,
          roiHeight: roiSize
        };
      }
      const lumas = [];
      const buckets = new Set();
      let brightPixels = 0;
      for (let y = 0; y < roiSize; y += 1) {
        for (let x = 0; x < roiSize; x += 1) {
          const index = (y * roiSize + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lumas.push(luma);
          if (luma >= 72) {
            brightPixels += 1;
          }
          buckets.add(`${Math.floor(r / 32)}:${Math.floor(g / 32)}:${Math.floor(b / 32)}`);
        }
      }
      let edgeTransitions = 0;
      let edgeComparisons = 0;
      for (let y = 1; y < roiSize; y += 1) {
        for (let x = 1; x < roiSize; x += 1) {
          const index = y * roiSize + x;
          if (Math.abs(lumas[index] - lumas[index - 1]) >= 18) {
            edgeTransitions += 1;
          }
          if (Math.abs(lumas[index] - lumas[index - roiSize]) >= 18) {
            edgeTransitions += 1;
          }
          edgeComparisons += 2;
        }
      }
      return {
        sampled: true,
        brightRatio: round(brightPixels / lumas.length),
        edgeDensity: round(edgeComparisons > 0 ? edgeTransitions / edgeComparisons : 0),
        edgeTransitions,
        colorBuckets: buckets.size,
        roiWidth: roiSize,
        roiHeight: roiSize
      };
    };
    const readable = (rect) => {
      const occlusion = uiOcclusion(rect);
      return {
        rect,
        centerOccluders: centerOccluders(rect),
        uiOccludedArea: occlusion.area,
        uiOccludedRatio: occlusion.ratio,
        visibleAfterUiRatio: round(Math.max(0, (rect?.visibleRatio ?? 0) * (1 - occlusion.ratio))),
        roi: sampleCanvasRoi(rect)
      };
    };

    return {
      activeZoneId: qa?.activeZoneId ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      player: readable(qa?.screen?.playerRect ?? null),
      encounter: readable(qa?.screen?.activeRouteEncounter ?? null),
      routeEncounterScreens: Object.fromEntries(
        Object.entries(qa?.screen?.routeEncounters ?? {}).map(([routeId, rect]) => [routeId, readable(rect)])
      ),
      routeEncounters: qa?.routeEncounters ?? null
    };
  }, snapshot);
  const expectedEncounterId = expectedRouteId ? `encounter:${expectedRouteId}` : null;
  const proofPool = (driveResult?.momentProofs ?? []).filter((proof) => {
    const rect = proof?.encounter?.rect;
    if (!rect?.id || proof?.player?.rect?.visible !== true) {
      return false;
    }
    return !expectedEncounterId || rect.id === expectedEncounterId || rect.routeId === expectedRouteId;
  });
  const bestLiveProof = proofPool
    .sort((a, b) => (b.encounter?.rect?.intensity ?? 0) - (a.encounter?.rect?.intensity ?? 0))[0];
  if ((bestLiveProof?.encounter?.rect?.intensity ?? 0) > (state.encounter?.rect?.intensity ?? 0)) {
    state = bestLiveProof;
  }
  const expectedRouteScreen = expectedRouteId ? state.routeEncounterScreens?.[expectedRouteId] : null;
  if (expectedRouteScreen?.rect?.routeId === expectedRouteId && expectedRouteScreen.rect.visible === true) {
    state = {
      ...state,
      encounter: expectedRouteScreen
    };
  }

  const player = state.player;
  const encounter = state.encounter;
  const thresholds = {
    player: {
      minWidth: 28,
      minHeight: 18,
      minArea: 450,
      minVisibleAfterUiRatio: 0.72,
      maxUiOccludedRatio: 0.08,
      minBrightRatio: 0.05,
      minEdgeDensity: 0.014,
      minColorBuckets: 4
    },
    encounter: {
      minWidth: 16,
      minHeight: 16,
      minArea: 220,
      minVisibleAfterUiRatio: 0.5,
      maxUiOccludedRatio: 0.14,
      minIntensity: 0.2,
      maxDistance: 1.45,
      maxReadableDistance: 3,
      minBrightRatio: 0.03,
      minEdgeDensity: 0.006,
      minColorBuckets: 3
    }
  };
  const playerOk =
    player.rect?.visible === true &&
    player.rect.center?.visible === true &&
    player.rect.width >= thresholds.player.minWidth &&
    player.rect.height >= thresholds.player.minHeight &&
    player.rect.clippedArea >= thresholds.player.minArea &&
    player.centerOccluders.length === 0 &&
    player.uiOccludedRatio <= thresholds.player.maxUiOccludedRatio &&
    player.visibleAfterUiRatio >= thresholds.player.minVisibleAfterUiRatio &&
    player.roi.sampled === true &&
    player.roi.brightRatio >= thresholds.player.minBrightRatio &&
    player.roi.edgeDensity >= thresholds.player.minEdgeDensity &&
    player.roi.colorBuckets >= thresholds.player.minColorBuckets;
  const encounterRect = encounter.rect;
  const expectedRouteScreenReadable =
    expectedRouteScreen?.rect?.routeId === expectedRouteId &&
    expectedRouteScreen.rect.visible === true &&
    expectedRouteScreen.rect.center?.visible === true &&
    expectedRouteScreen.rect.clippedArea >= 180 &&
    expectedRouteScreen.visibleAfterUiRatio >= 0.38 &&
    expectedRouteScreen.centerOccluders.length === 0 &&
    expectedRouteScreen.roi.sampled === true &&
    expectedRouteScreen.roi.edgeDensity >= thresholds.encounter.minEdgeDensity &&
    expectedRouteScreen.roi.colorBuckets >= thresholds.encounter.minColorBuckets;
  const expectedRouteReadable =
    typeof expectedRouteId === "string" &&
    encounterRect?.routeId === expectedRouteId &&
    (encounterRect.distance <= thresholds.encounter.maxReadableDistance || expectedRouteScreenReadable);
  const encounterOk =
    encounterRect?.visible === true &&
    encounterRect.center?.visible === true &&
    typeof encounterRect.id === "string" &&
    typeof encounterRect.routeId === "string" &&
    ((encounterRect.intensity >= thresholds.encounter.minIntensity &&
      encounterRect.distance <= thresholds.encounter.maxDistance &&
      (state.routeEncounters?.activeCount ?? 0) >= 1) ||
      expectedRouteReadable) &&
    encounterRect.width >= thresholds.encounter.minWidth &&
    encounterRect.height >= thresholds.encounter.minHeight &&
    encounterRect.clippedArea >= thresholds.encounter.minArea &&
    encounter.centerOccluders.length === 0 &&
    encounter.uiOccludedRatio <= thresholds.encounter.maxUiOccludedRatio &&
    encounter.visibleAfterUiRatio >= thresholds.encounter.minVisibleAfterUiRatio &&
    encounter.roi.sampled === true &&
    encounter.roi.brightRatio >= thresholds.encounter.minBrightRatio &&
    encounter.roi.edgeDensity >= thresholds.encounter.minEdgeDensity &&
    encounter.roi.colorBuckets >= thresholds.encounter.minColorBuckets;
  const ok = playerOk && encounterOk;
  const details = {
    ...state,
    driveResult: driveResult
      ? {
          reached: driveResult.reached,
          elapsedMs: driveResult.elapsedMs,
          sampleCount: driveResult.samples?.length ?? 0,
          momentProofCount: driveResult.momentProofs?.length ?? 0,
          expectedRouteId,
          matchingMomentProofCount: proofPool.length,
          maxSampleStepDistance: Number((driveResult.maxSampleStepDistance ?? 0).toFixed(3))
        }
      : null,
    thresholds,
    playerOk,
    encounterOk,
    expectedRouteReadable,
    expectedRouteScreenReadable,
    expectedRouteScreen
  };

  if (ok) {
    pass(`route-encounter-visible:${label}`, details);
    pass(`rover-readable:${label}`, {
      activeZoneId: state.activeZoneId,
      player,
      thresholds: thresholds.player
    });
  } else {
    scenarioFail(`route-encounter-visible:${label}`, "Active route encounter or rover is not visually readable.", details);
  }
  return { ok, details };
}

async function checkProductionRuntimeLightweight(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "production-runtime");

  try {
    await page.goto(productionUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const canvas = document.querySelector("#studio-map-canvas");
        return (
          document.documentElement.classList.contains("game-ready") &&
          document.documentElement.dataset.gameState === "ready" &&
          canvas instanceof HTMLCanvasElement &&
          canvas.width > 0 &&
          canvas.height > 0
        );
      },
      { timeout: 20_000 }
    );
    const state = await page.evaluate(async () => {
      const started = performance.now();
      let frames = 0;
      await new Promise((resolve) => {
        const tick = () => {
          frames += 1;
          if (performance.now() - started >= 1_200) {
            resolve(undefined);
          } else {
            requestAnimationFrame(tick);
          }
        };
        requestAnimationFrame(tick);
      });
      const canvas = document.querySelector("#studio-map-canvas");
      return {
        url: window.location.href,
        ready: document.documentElement.classList.contains("game-ready"),
        gameState: document.documentElement.dataset.gameState ?? null,
        hasQaSnapshot: "__IT_ART_STUDIO_QA__" in window,
        hasQaStep: "__IT_ART_STUDIO_QA_STEP__" in window,
        hasQaRefresh: "__IT_ART_STUDIO_QA_REFRESH__" in window,
        frames,
        canvas:
          canvas instanceof HTMLCanvasElement
            ? { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight }
            : null
      };
    });

    if (
      state.ready &&
      state.gameState === "ready" &&
      state.hasQaSnapshot === false &&
      state.hasQaStep === false &&
      state.hasQaRefresh === false &&
      state.frames >= 4 &&
      state.canvas?.width > 0 &&
      state.canvas?.height > 0
    ) {
      pass("production-runtime-lightweight", state);
    } else {
      scenarioFail("production-runtime-lightweight", "Production runtime exposes QA hooks or did not animate.", state);
    }
  } catch (error) {
    scenarioFail("production-runtime-lightweight", "Production runtime did not reach ready state.", {
      url: productionUrl,
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await page.close();
  }
}

async function checkRealKeyboardInput(page) {
  const before = await getQaSnapshot(page);
  let after = before;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(250);
    after = await getQaSnapshot(page);
    const distance = Math.hypot((after?.player?.x ?? 0) - (before?.player?.x ?? 0), (after?.player?.z ?? 0) - (before?.player?.z ?? 0));
    if (after?.lastInputMode === "keyboard" && distance > 0.15) {
      break;
    }
  }
  const distance = Math.hypot((after?.player?.x ?? 0) - (before?.player?.x ?? 0), (after?.player?.z ?? 0) - (before?.player?.z ?? 0));
  if (after?.lastInputMode === "keyboard" && distance > 0.15) {
    pass("keyboard:real-input-smoke", { before: before?.player, after: after.player });
  } else {
    scenarioFail("keyboard:real-input-smoke", "Real keyboard input did not move the player.", { before, after });
  }
}

function angleDelta(a, b) {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}

async function checkRealKeyboardDirectionalControls(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "real-keyboard-directions");

  const directions = [
    {
      id: "stationary-left",
      keys: ["ArrowLeft"],
      activeKeys: ["left"],
      mode: "stationary-steer",
      maxRotationDelta: 0.05,
      maxDistance: 0.06
    },
    {
      id: "stationary-right",
      keys: ["ArrowRight"],
      activeKeys: ["right"],
      mode: "stationary-steer",
      maxRotationDelta: 0.05,
      maxDistance: 0.06
    },
    { id: "forward", keys: ["ArrowUp"], activeKeys: ["up"], mode: "travel", minDistance: 0.22 },
    { id: "backward", keys: ["ArrowDown"], activeKeys: ["down"], mode: "travel", minDistance: 0.18 },
    {
      id: "arc-left",
      keys: ["ArrowUp", "ArrowLeft"],
      activeKeys: ["up", "left"],
      mode: "arc",
      rotationSign: -1,
      minRotationDelta: 0.08,
      minDistance: 0.26
    },
    {
      id: "arc-right",
      keys: ["ArrowUp", "ArrowRight"],
      activeKeys: ["up", "right"],
      mode: "arc",
      rotationSign: 1,
      minRotationDelta: 0.08,
      minDistance: 0.26
    }
  ];

  const proofs = [];
  let initialInput = null;
  let hookState = null;
  try {
    for (const direction of directions) {
      await assertReady(page, realDriveUrl);
      if (proofs.length === 0) {
        await assertCanvasGeometry(page);
        hookState = await page.evaluate(() => ({
          hasQaStep: typeof window.__IT_ART_STUDIO_QA_STEP__ === "function",
          href: window.location.href
        }));
        initialInput = (await getQaSnapshot(page, { refresh: true }))?.input ?? null;
      }
      await page.bringToFront().catch(() => {});
      await releaseDriveKeys(page);
      await page.waitForTimeout(160);

      const before = await getQaSnapshot(page, { refresh: true });
      const beforeDownCount = before?.input?.keyboardDownCount ?? 0;
      const beforeUpCount = before?.input?.keyboardUpCount ?? 0;
      const beforeQaStepHookCalls = before?.input?.qaStepHookCalls ?? 0;

      for (const key of direction.keys) {
        await page.keyboard.down(key);
      }
      await page.waitForTimeout(460);
      const during = await getQaSnapshot(page, { refresh: true });
      for (const key of [...direction.keys].reverse()) {
        await page.keyboard.up(key);
      }
      await page.waitForTimeout(180);
      const after = await getQaSnapshot(page, { refresh: true });
      const distance = Math.hypot((after?.player?.x ?? 0) - (before?.player?.x ?? 0), (after?.player?.z ?? 0) - (before?.player?.z ?? 0));
      const signedRotationDelta = angleDelta(after?.player?.rotationY ?? 0, before?.player?.rotationY ?? 0);
      const rotationDelta = Math.abs(signedRotationDelta);
      const frameDelta = (after?.frameCount ?? 0) - (before?.frameCount ?? 0);
      const downDelta = (after?.input?.keyboardDownCount ?? 0) - beforeDownCount;
      const upDelta = (after?.input?.keyboardUpCount ?? 0) - beforeUpCount;
      const qaStepHookDelta = (after?.input?.qaStepHookCalls ?? 0) - beforeQaStepHookCalls;

      proofs.push({
        id: direction.id,
        keys: direction.keys,
        activeKeys: direction.activeKeys,
        before: before?.player ?? null,
        during: during?.player ?? null,
        after: after?.player ?? null,
        distance: Number(distance.toFixed(3)),
        signedRotationDelta: Number(signedRotationDelta.toFixed(3)),
        rotationDelta: Number(rotationDelta.toFixed(3)),
        frameDelta,
        downDelta,
        upDelta,
        qaStepHookDelta,
        lastInputMode: after?.lastInputMode ?? null,
        lastKeyboardCode: after?.input?.lastKeyboardCode ?? null,
        activeKeysDuring: during?.input?.activeKeys ?? [],
        activeKeysAfter: after?.input?.activeKeys ?? [],
        dynamics: after?.drive?.dynamics ?? null,
        ok:
          after?.lastInputMode === "keyboard" &&
          direction.keys.includes(after?.input?.lastKeyboardCode) &&
          direction.activeKeys.every((activeKey) => (during?.input?.activeKeys ?? []).includes(activeKey)) &&
          (after?.input?.activeKeys ?? []).length === 0 &&
          downDelta >= direction.keys.length &&
          upDelta >= direction.keys.length &&
          qaStepHookDelta === 0 &&
          frameDelta >= 6 &&
          (direction.mode === "stationary-steer" ? distance <= direction.maxDistance && rotationDelta <= direction.maxRotationDelta : true) &&
          (direction.mode === "travel" || direction.mode === "arc" ? distance >= direction.minDistance : true) &&
          (direction.mode === "arc"
            ? rotationDelta >= direction.minRotationDelta && signedRotationDelta * direction.rotationSign > 0
            : true)
      });
    }

    const failedProofs = proofs.filter((proof) => !proof.ok);
    const finalInput = (await getQaSnapshot(page, { refresh: true }))?.input ?? null;
    const qaStepHookDelta = (finalInput?.qaStepHookCalls ?? 0) - (initialInput?.qaStepHookCalls ?? 0);
    if (failedProofs.length === 0 && hookState?.hasQaStep === false && qaStepHookDelta === 0) {
      pass("keyboard:directional-controls", {
        directions: proofs,
        hookState,
        qaStepHookDelta,
        url: realDriveUrl,
        testedKeys: directions.map((direction) => direction.keys)
      });
    } else {
      scenarioFail("keyboard:directional-controls", "Real keyboard controls did not prove all movement directions.", {
        directions: proofs,
        failedProofs,
        hookState,
        qaStepHookDelta,
        url: realDriveUrl
      });
    }
  } catch (error) {
    scenarioFail("keyboard:directional-controls", "Real keyboard directional gate crashed.", {
      url: realDriveUrl,
      message: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await releaseDriveKeys(page).catch(() => {});
    await page.close();
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
      rawHref: cta.getAttribute("href"),
      ariaHidden: cta.getAttribute("aria-hidden"),
      text: cta.textContent?.trim() ?? "",
      tabIndex: cta.tabIndex,
      visible: cta.offsetWidth > 0 && cta.offsetHeight > 0,
      display: getComputedStyle(cta).display,
      visibility: getComputedStyle(cta).visibility,
      opacity: Number(getComputedStyle(cta).opacity)
    };
  });

  if (
    contact.exists &&
    contact.rawHref === "mailto:contact@itart.studio" &&
    contact.href === "mailto:contact@itart.studio" &&
    contact.ariaHidden === "false" &&
    contact.tabIndex === 0 &&
    contact.visible &&
    contact.display !== "none" &&
    contact.visibility !== "hidden" &&
    contact.opacity > 0.95 &&
    contact.text === "Contactez-nous"
  ) {
    pass("contact-cta", contact);
  } else {
    scenarioFail("contact-cta", "Contact CTA is not active on contact zone.", contact);
  }
}

async function checkWorldRichness(page) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  const world = snapshot?.world;
  const expectedSceneryRoles = [
    "terrain-edge",
    "relief-ramp",
    "water-body",
    "surface-detail",
    "tech-skyline",
    "art-sculpture",
    "studio-threshold",
    "identity-ribbon",
    "route-light"
  ];
  const missingSceneryRoles = expectedSceneryRoles.filter((role) => !world?.sceneryRoleCounts?.[role]);
  const hasWorldComposition =
    world &&
    world.terrainLayers >= 5 &&
    world.sceneryObjects >= 180 &&
    world.scenerySignatures >= 75 &&
    world.sceneryMotionObjects >= 55 &&
    world.visibleBoundaryObjects >= 8 &&
    world.identityRibbonObjects >= 60 &&
    world.identityRibbonSignatures >= 1 &&
    missingSceneryRoles.length === 0;
  if (world?.visibleBoundaryObjects >= 8 && world.sceneObjects <= premiumWorldObjectBudget) {
    pass("visible-world-boundary", {
      visibleBoundaryObjects: world.visibleBoundaryObjects,
      worldHalfExtent: snapshot?.drive?.boundary?.worldHalfExtent,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("visible-world-boundary", "Playable world edge is not materialized as visible boundary geometry.", {
      visibleBoundaryObjects: world?.visibleBoundaryObjects,
      worldHalfExtent: snapshot?.drive?.boundary?.worldHalfExtent,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }
  const renderer = snapshot?.renderer;
  const rendererCaps = { calls: 390, triangles: 110_000, geometries: 340, textures: 24 };
  const rendererBudgetOk =
    renderer &&
    renderer.calls <= rendererCaps.calls &&
    renderer.triangles <= rendererCaps.triangles &&
    renderer.geometries <= rendererCaps.geometries &&
    renderer.textures <= rendererCaps.textures;
  if (rendererBudgetOk) {
    pass("renderer-budget", {
      renderer,
      caps: rendererCaps
    });
  } else {
    scenarioFail("renderer-budget", "Renderer budget drifted beyond the V7.3 premium-world caps.", {
      renderer,
      caps: rendererCaps
    });
  }
  const routeCount = snapshot?.drive?.surface?.routeCount ?? 0;
  const routeLightRunway =
    world &&
    routeCount >= 11 &&
    world.sceneryRoleCounts?.["route-light"] >= routeCount * 3 &&
    world.scenerySignatures >= 125 &&
    world.sceneryMotionObjects >= 88 &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (routeLightRunway) {
    pass("route-light-runway", {
      routeLightRoles: world.sceneryRoleCounts["route-light"],
      expectedRouteLightRoles: routeCount * 3,
      routeCount,
      scenerySignatures: world.scenerySignatures,
      sceneryMotionObjects: world.sceneryMotionObjects,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("route-light-runway", "Routes are not staged as dense instanced runway lights within the scene budget.", {
      routeLightRoles: world?.sceneryRoleCounts?.["route-light"],
      expectedRouteLightRoles: routeCount * 3,
      routeCount,
      scenerySignatures: world?.scenerySignatures,
      sceneryMotionObjects: world?.sceneryMotionObjects,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }
  const allSignatureArtifactSignatures = (world?.zones ?? []).flatMap((zone) => zone.signatureArtifactSignatures ?? []);
  const duplicateSignatureArtifactSignatures = allSignatureArtifactSignatures.filter(
    (signature, index, signatures) => signature && signatures.indexOf(signature) !== index
  );
  const signatureArtifactRoleTypes = new Set(
    (world?.zones ?? []).flatMap((zone) => zone.signatureArtifactRoles ?? [])
  );
  const signatureArtifactFamilies = new Set(
    (world?.zones ?? []).flatMap((zone) => zone.signatureArtifactFamilies ?? [])
  );
  const thinSignatureArtifactZones = (world?.zones ?? []).filter(
    (zone) =>
      (zone.signatureArtifactObjects ?? 0) < 4 ||
      (zone.signatureArtifactSignatures?.length ?? 0) < 4 ||
      (zone.signatureArtifactRoles?.length ?? 0) < 3 ||
      (zone.signatureArtifactFamilies?.length ?? 0) < 1 ||
      (zone.signatureArtifactMaterials?.length ?? 0) < 2 ||
      !zone.signatureArtifactFingerprint
  );
  const thinZones = (world?.zones ?? []).filter(
    (zone) =>
      zone.meshCount < 10 ||
      zone.landmarkObjects < 8 ||
      !zone.visualSpecId ||
      !zone.biome ||
      zone.visualDecals < Math.max(3, zone.expectedVisuals?.decals ?? 0) ||
      zone.propClusters < Math.max(3, zone.expectedVisuals?.propClusters ?? 0) ||
      zone.propObjects < Math.max(9, zone.expectedVisuals?.propObjects ?? 0) ||
      !zone.surfaceProfileId ||
      !zone.surfaceFinish ||
      !zone.surfaceMotif ||
      zone.surfaceObjects < Math.max(5, zone.expectedVisuals?.surfaceObjects ?? 0) ||
      zone.surfaceSignatures?.length < Math.max(5, zone.expectedVisuals?.surfaceSignatures ?? 0) ||
      zone.surfaceRoles?.length < 4 ||
      !zone.surfaceFingerprint ||
      zone.setDressingObjects < 7 ||
      zone.setDressingRoles?.length < 3 ||
      zone.setDressingSignatures?.length < 5 ||
      zone.signatureArtifactObjects < 4 ||
      zone.signatureArtifactSignatures?.length < 4 ||
      zone.signatureArtifactRoles?.length < 3 ||
      zone.signatureArtifactMaterials?.length < 2 ||
      Object.keys(zone.localMotionBehaviors ?? {}).length < 3 ||
      !zone.setDressingFingerprint ||
      zone.materialVariants < Math.max(6, zone.expectedVisuals?.materialVariants ?? 0) ||
      zone.missingMaterialVariants?.length > 0 ||
      !zone.animationMatchesSpec ||
      zone.motionObjectCount <
        Math.max(15, (zone.expectedVisuals?.propObjects ?? 0) + (zone.expectedVisuals?.decals ?? 0)) ||
      !zone.visualFingerprint ||
      !zone.signatureArtifactFingerprint ||
      !zone.hasLabel ||
      zone.bounds.height < 1.25 ||
      zone.bounds.width < 1.4 ||
      zone.bounds.depth < 0.75
  );
  if (
    world &&
    snapshot.zoneCount === 10 &&
    world.sceneObjects >= 225 &&
    world.decorativeObjects >= 45 &&
    world.roadSegments >= 18 &&
    world.landmarkObjects >= 135 &&
    hasWorldComposition &&
    world.visualSpecs === 10 &&
    world.visualDecals >= 30 &&
    world.propClusters >= 30 &&
    world.surfaceObjects >= 50 &&
    world.surfaceSignatures >= 50 &&
    world.setDressingObjects >= 78 &&
    world.setDressingSignatures >= 58 &&
    world.signatureArtifactObjects >= 55 &&
    world.signatureArtifactSignatures >= 45 &&
    world.materialVariants >= 60 &&
    signatureArtifactFamilies.size >= 10 &&
    signatureArtifactRoleTypes.size >= 45 &&
    duplicateSignatureArtifactSignatures.length === 0 &&
    thinSignatureArtifactZones.length === 0 &&
    thinZones.length === 0
  ) {
    pass("world-richness", {
      world,
      zoneCount: snapshot.zoneCount,
      signatureArtifactFamilies: [...signatureArtifactFamilies].sort(),
      signatureArtifactRoleTypes: [...signatureArtifactRoleTypes].sort()
    });
  } else {
    scenarioFail("world-richness", "3D world does not expose enough modeled cartography assets.", {
      world,
      zoneCount: snapshot?.zoneCount,
      missingSceneryRoles,
      duplicateSignatureArtifactSignatures,
      signatureArtifactFamilies: [...signatureArtifactFamilies].sort(),
      signatureArtifactRoleTypes: [...signatureArtifactRoleTypes].sort(),
      thinSignatureArtifactZones,
      thinZones
    });
  }

  const visualSpecZones = world?.zones ?? [];
  const themedSetDressingProofs = Object.entries(expectedPrioritySetDressingRoles).map(([zoneId, expectedRoles]) => {
    const zone = visualSpecZones.find((item) => item.id === zoneId);
    const roles = new Set(zone?.setDressingRoles ?? []);
    return {
      zoneId,
      expectedRoles,
      roles: [...roles].sort(),
      missingRoles: expectedRoles.filter((role) => !roles.has(role)),
      signatures: zone?.setDressingSignatures ?? [],
      fingerprint: zone?.setDressingFingerprint ?? null,
      objectCount: zone?.setDressingObjects ?? 0
    };
  });
  const themedSetDressingRendered =
    world &&
    themedSetDressingProofs.every(
      (proof) =>
        proof.missingRoles.length === 0 &&
        proof.signatures.length >= 6 &&
        proof.objectCount >= 7 &&
        Boolean(proof.fingerprint)
    ) &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (themedSetDressingRendered) {
    pass("themed-set-dressing", {
      proofs: themedSetDressingProofs,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("themed-set-dressing", "Priority zones do not expose enough specific environmental set dressing.", {
      proofs: themedSetDressingProofs,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const prioritySignatureProofs = Object.entries(expectedPrioritySignatureFamilies).map(([zoneId, expectedFamilies]) => {
    const zone = visualSpecZones.find((item) => item.id === zoneId);
    const families = new Set(zone?.signatureArtifactFamilies ?? []);
    return {
      zoneId,
      expectedFamilies,
      families: [...families].sort(),
      missingFamilies: expectedFamilies.filter((family) => !families.has(family)),
      signatures: zone?.signatureArtifactSignatures ?? [],
      roles: zone?.signatureArtifactRoles ?? [],
      objectCount: zone?.signatureArtifactObjects ?? 0,
      bounds: zone?.signatureArtifactBounds ?? null,
      fingerprint: zone?.signatureArtifactFingerprint ?? null
    };
  });
  const prioritySignatureAssets =
    world &&
    prioritySignatureProofs.every(
      (proof) =>
        proof.missingFamilies.length === 0 &&
        proof.objectCount >= 8 &&
        proof.signatures.length >= 8 &&
        proof.roles.length >= 8 &&
        (proof.bounds?.height ?? 0) >= 1.45 &&
        (proof.bounds?.width ?? 0) >= 0.9 &&
        (proof.bounds?.depth ?? 0) >= 0.5 &&
        Boolean(proof.fingerprint)
    ) &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (prioritySignatureAssets) {
    pass("priority-signature-assets", {
      proofs: prioritySignatureProofs,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("priority-signature-assets", "Priority signature assets are not distinctive enough.", {
      proofs: prioritySignatureProofs,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const premiumLandmarkRequirements = {
    "cloud-dock": {
      requiredFamilies: ["cloud-platform", "server-array", "electric-cloud", "cloud-skybridge"],
      requiredRolePrefixes: ["cloud-skybridge:server-cloud-skybridge"],
      minObjects: 10,
      minSceneObjects: 8,
      maxSceneObjects: 8,
      minHeight: 1.62,
      minWidth: 1.4,
      minDepth: 0.78
    },
    "design-atelier": {
      requiredFamilies: ["composition-wall", "pattern-table", "material-palette", "atelier-light-rig", "atelier-mannequin"],
      requiredRolePrefixes: ["atelier-mannequin:tailor-form-silhouette"],
      minObjects: 14,
      minSceneObjects: 7,
      maxSceneObjects: 7,
      minHeight: 1.55,
      minWidth: 1.35,
      minDepth: 0.95
    },
    "contact-portal": {
      requiredFamilies: ["postal-counter", "reply-portal", "mail-packet", "postal-wall", "delivery-signal"],
      requiredRolePrefixes: ["postal-wall:sorting-slot-"],
      minObjects: 18,
      minSceneObjects: 8,
      maxSceneObjects: 8,
      minHeight: 1.35,
      minWidth: 1.18,
      minDepth: 1.02
    }
  };
  const premiumLandmarkProofs = Object.entries(premiumLandmarkRequirements).map(([zoneId, requirement]) => {
    const zone = visualSpecZones.find((item) => item.id === zoneId);
    const families = new Set(zone?.signatureArtifactFamilies ?? []);
    const roles = zone?.signatureArtifactRoles ?? [];
    return {
      zoneId,
      requirement,
      families: [...families].sort(),
      missingFamilies: requirement.requiredFamilies.filter((family) => !families.has(family)),
      requiredRolePrefixes: requirement.requiredRolePrefixes,
      missingRolePrefixes: requirement.requiredRolePrefixes.filter((prefix) => !roles.some((role) => role.startsWith(prefix))),
      roleCount: roles.length,
      signatureCount: zone?.signatureArtifactSignatures?.length ?? 0,
      objectCount: zone?.signatureArtifactObjects ?? 0,
      sceneObjectCount: zone?.signatureArtifactSceneObjects ?? 0,
      bounds: zone?.signatureArtifactBounds ?? null,
      fingerprint: zone?.signatureArtifactFingerprint ?? null
    };
  });
  const premiumLandmarkHierarchy =
    world &&
    premiumLandmarkProofs.every(
      (proof) =>
        proof.missingFamilies.length === 0 &&
        proof.missingRolePrefixes.length === 0 &&
        proof.objectCount >= proof.requirement.minObjects &&
        proof.sceneObjectCount >= proof.requirement.minSceneObjects &&
        proof.sceneObjectCount <= proof.requirement.maxSceneObjects &&
        proof.signatureCount >= proof.requirement.minObjects &&
        proof.roleCount >= proof.requirement.minObjects &&
        (proof.bounds?.height ?? 0) >= proof.requirement.minHeight &&
        (proof.bounds?.width ?? 0) >= proof.requirement.minWidth &&
        (proof.bounds?.depth ?? 0) >= proof.requirement.minDepth &&
        Boolean(proof.fingerprint)
    ) &&
    world.sceneObjects <= premiumWorldObjectBudget - 24;
  if (premiumLandmarkHierarchy) {
    pass("premium-landmark-hierarchy", {
      proofs: premiumLandmarkProofs,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      reservedHeadroom: premiumWorldObjectBudget - world.sceneObjects
    });
  } else {
    scenarioFail("premium-landmark-hierarchy", "Priority places do not expose dominant themed silhouettes within budget.", {
      proofs: premiumLandmarkProofs,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      reservedHeadroom: typeof world?.sceneObjects === "number" ? premiumWorldObjectBudget - world.sceneObjects : null
    });
  }

  const artPremiumZoneIds = ["three-d-foundry", "fashion-room"];
  const artPremiumProofs = artPremiumZoneIds.map((zoneId) => {
    const zone = visualSpecZones.find((item) => item.id === zoneId);
    const expectedFamilies = expectedPrioritySignatureFamilies[zoneId] ?? [];
    const expectedDressingRoles = expectedPrioritySetDressingRoles[zoneId] ?? [];
    const signatureFamilies = new Set(zone?.signatureArtifactFamilies ?? []);
    const dressingRoles = new Set(zone?.setDressingRoles ?? []);
    return {
      zoneId,
      expectedFamilies,
      signatureFamilies: [...signatureFamilies].sort(),
      missingFamilies: expectedFamilies.filter((family) => !signatureFamilies.has(family)),
      expectedDressingRoles,
      dressingRoles: [...dressingRoles].sort(),
      missingDressingRoles: expectedDressingRoles.filter((role) => !dressingRoles.has(role)),
      signatureObjects: zone?.signatureArtifactObjects ?? 0,
      signatureSceneObjects: zone?.signatureArtifactSceneObjects ?? 0,
      signatureRoles: zone?.signatureArtifactRoles ?? [],
      signatureSignatures: zone?.signatureArtifactSignatures ?? [],
      setDressingObjects: zone?.setDressingObjects ?? 0,
      setDressingSignatures: zone?.setDressingSignatures ?? [],
      bounds: zone?.signatureArtifactBounds ?? null,
      fingerprint: zone?.signatureArtifactFingerprint ?? null
    };
  });
  const artPremiumRooms =
    world &&
    artPremiumProofs.every(
      (proof) =>
        proof.missingFamilies.length === 0 &&
        proof.missingDressingRoles.length === 0 &&
        proof.signatureObjects >= 10 &&
        proof.signatureSceneObjects <= 6 &&
        proof.signatureRoles.length >= 10 &&
        proof.signatureSignatures.length >= 10 &&
        proof.setDressingObjects >= 7 &&
        proof.setDressingSignatures.length >= 6 &&
        (proof.bounds?.height ?? 0) >= 1.45 &&
        (proof.bounds?.width ?? 0) >= 0.9 &&
        (proof.bounds?.depth ?? 0) >= 0.5 &&
        Boolean(proof.fingerprint)
    ) &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (artPremiumRooms) {
    pass("art-premium-rooms", {
      proofs: artPremiumProofs,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("art-premium-rooms", "Foundry and Fashion rooms are not yet premium modeled ART places.", {
      proofs: artPremiumProofs,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const foundryZone = visualSpecZones.find((item) => item.id === "three-d-foundry");
  const foundrySignatureFamilies = new Set(foundryZone?.signatureArtifactFamilies ?? []);
  const foundrySignatureRoles = foundryZone?.signatureArtifactRoles ?? [];
  const foundryPrinterHierarchy =
    world &&
    foundryZone &&
    ["wireframe-knot", "scan-rig", "printer-gantry", "volume-slice", "toolpath-arm"].every((family) =>
      foundrySignatureFamilies.has(family)
    ) &&
    foundrySignatureRoles.some((role) => role.startsWith("printer-gantry:printer-overhead-beam")) &&
    foundrySignatureRoles.some((role) => role.startsWith("printer-gantry:resin-basin")) &&
    foundrySignatureRoles.some((role) => role.startsWith("printer-gantry:extruder-head")) &&
    (foundryZone.signatureArtifactObjects ?? 0) >= 16 &&
    (foundryZone.signatureArtifactSceneObjects ?? 0) <= 6 &&
    (foundryZone.signatureArtifactSignatures?.length ?? 0) >= 16 &&
    (foundryZone.signatureArtifactRoles?.length ?? 0) >= 16 &&
    (foundryZone.signatureArtifactBounds?.height ?? 0) >= 1.65 &&
    (foundryZone.signatureArtifactBounds?.width ?? 0) >= 1.85 &&
    (foundryZone.signatureArtifactBounds?.depth ?? 0) >= 1.35 &&
    Boolean(foundryZone.signatureArtifactFingerprint) &&
    world.sceneObjects <= premiumWorldObjectBudget - 24;
  if (foundryPrinterHierarchy) {
    pass("foundry-printer-hierarchy", {
      zoneId: foundryZone.id,
      families: foundryZone.signatureArtifactFamilies,
      roles: foundryZone.signatureArtifactRoles,
      signatures: foundryZone.signatureArtifactSignatures,
      semanticSignatureObjects: foundryZone.signatureArtifactObjects,
      physicalSignatureSceneObjects: foundryZone.signatureArtifactSceneObjects,
      bounds: foundryZone.signatureArtifactBounds,
      fingerprint: foundryZone.signatureArtifactFingerprint,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      reservedHeadroom: premiumWorldObjectBudget - world.sceneObjects
    });
  } else {
    scenarioFail("foundry-printer-hierarchy", "3D Foundry does not expose a dominant printer/scanner silhouette within budget.", {
      zoneId: foundryZone?.id ?? "three-d-foundry",
      families: foundryZone?.signatureArtifactFamilies ?? [],
      roles: foundryZone?.signatureArtifactRoles ?? [],
      signatures: foundryZone?.signatureArtifactSignatures ?? [],
      semanticSignatureObjects: foundryZone?.signatureArtifactObjects,
      physicalSignatureSceneObjects: foundryZone?.signatureArtifactSceneObjects,
      bounds: foundryZone?.signatureArtifactBounds ?? null,
      fingerprint: foundryZone?.signatureArtifactFingerprint ?? null,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      reservedHeadroom: typeof world?.sceneObjects === "number" ? premiumWorldObjectBudget - world.sceneObjects : null
    });
  }

  const cloudDockZone = visualSpecZones.find((item) => item.id === "cloud-dock");
  const cloudSignatureFamilies = new Set(cloudDockZone?.signatureArtifactFamilies ?? []);
  const cloudSignatureInstancingHeadroom =
    world &&
    cloudDockZone &&
    world.sceneObjects <= premiumWorldObjectBudget - 24 &&
    (cloudDockZone.signatureArtifactObjects ?? 0) >= 9 &&
    (cloudDockZone.signatureArtifactSceneObjects ?? 0) <= 8 &&
    (cloudDockZone.signatureArtifactObjects ?? 0) > (cloudDockZone.signatureArtifactSceneObjects ?? 0) &&
    (cloudDockZone.signatureArtifactSignatures?.length ?? 0) >= 9 &&
    (cloudDockZone.signatureArtifactRoles?.length ?? 0) >= 9 &&
    ["cloud-platform", "server-array", "electric-cloud", "cloud-skybridge"].every((family) => cloudSignatureFamilies.has(family));
  if (cloudSignatureInstancingHeadroom) {
    pass("signature-instancing-headroom", {
      zoneId: cloudDockZone.id,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      semanticSignatureObjects: cloudDockZone.signatureArtifactObjects,
      physicalSignatureSceneObjects: cloudDockZone.signatureArtifactSceneObjects,
      signatures: cloudDockZone.signatureArtifactSignatures,
      roles: cloudDockZone.signatureArtifactRoles,
      families: [...cloudSignatureFamilies].sort()
    });
  } else {
    scenarioFail("signature-instancing-headroom", "Cloud signature instancing does not preserve semantic richness while freeing scene headroom.", {
      zoneId: cloudDockZone?.id ?? null,
      sceneObjects: world?.sceneObjects,
      requiredSceneObjectsMax: premiumWorldObjectBudget,
      sceneObjectBudget: premiumWorldObjectBudget,
      semanticSignatureObjects: cloudDockZone?.signatureArtifactObjects,
      physicalSignatureSceneObjects: cloudDockZone?.signatureArtifactSceneObjects,
      signatures: cloudDockZone?.signatureArtifactSignatures ?? [],
      roles: cloudDockZone?.signatureArtifactRoles ?? [],
      families: [...cloudSignatureFamilies].sort()
    });
  }

  const designAtelierZone = visualSpecZones.find((item) => item.id === "design-atelier");
  const designSignatureFamilies = new Set(designAtelierZone?.signatureArtifactFamilies ?? []);
  const designSignatureHeadroom =
    world &&
    designAtelierZone &&
    world.sceneObjects <= premiumWorldObjectBudget - 24 &&
    (designAtelierZone.signatureArtifactObjects ?? 0) >= 9 &&
    (designAtelierZone.signatureArtifactSceneObjects ?? 0) <= 7 &&
    (designAtelierZone.signatureArtifactSignatures?.length ?? 0) >= 9 &&
    (designAtelierZone.signatureArtifactRoles?.length ?? 0) >= 9 &&
    ["composition-wall", "pattern-table", "material-palette", "atelier-light-rig", "atelier-mannequin"].every((family) =>
      designSignatureFamilies.has(family)
    );
  if (designSignatureHeadroom) {
    pass("design-signature-headroom", {
      zoneId: designAtelierZone.id,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      semanticSignatureObjects: designAtelierZone.signatureArtifactObjects,
      physicalSignatureSceneObjects: designAtelierZone.signatureArtifactSceneObjects,
      signatures: designAtelierZone.signatureArtifactSignatures,
      roles: designAtelierZone.signatureArtifactRoles,
      families: [...designSignatureFamilies].sort()
    });
  } else {
    scenarioFail("design-signature-headroom", "Design Atelier signature is not rich enough within the compressed scene budget.", {
      zoneId: designAtelierZone?.id ?? null,
      sceneObjects: world?.sceneObjects,
      requiredSceneObjectsMax: premiumWorldObjectBudget,
      sceneObjectBudget: premiumWorldObjectBudget,
      semanticSignatureObjects: designAtelierZone?.signatureArtifactObjects,
      physicalSignatureSceneObjects: designAtelierZone?.signatureArtifactSceneObjects,
      signatures: designAtelierZone?.signatureArtifactSignatures ?? [],
      roles: designAtelierZone?.signatureArtifactRoles ?? [],
      families: [...designSignatureFamilies].sort()
    });
  }

  const contactPortalZone = visualSpecZones.find((item) => item.id === "contact-portal");
  const contactSignatureFamilies = new Set(contactPortalZone?.signatureArtifactFamilies ?? []);
  const contactSignatureHeadroom =
    world &&
    contactPortalZone &&
    world.sceneObjects <= premiumWorldObjectBudget - 24 &&
    (contactPortalZone.signatureArtifactObjects ?? 0) >= 11 &&
    (contactPortalZone.signatureArtifactSceneObjects ?? 0) <= 8 &&
    (contactPortalZone.signatureArtifactObjects ?? 0) > (contactPortalZone.signatureArtifactSceneObjects ?? 0) &&
    (contactPortalZone.signatureArtifactSignatures?.length ?? 0) >= 11 &&
    (contactPortalZone.signatureArtifactRoles?.length ?? 0) >= 11 &&
    (contactPortalZone.signatureArtifactBounds?.height ?? 0) >= 1.45 &&
    (contactPortalZone.signatureArtifactBounds?.width ?? 0) >= 1 &&
    (contactPortalZone.signatureArtifactBounds?.depth ?? 0) >= 0.6 &&
    ["postal-counter", "reply-portal", "mail-packet", "postal-wall", "delivery-signal"].every((family) =>
      contactSignatureFamilies.has(family)
    );
  if (contactSignatureHeadroom) {
    pass("contact-signature-headroom", {
      zoneId: contactPortalZone.id,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      semanticSignatureObjects: contactPortalZone.signatureArtifactObjects,
      physicalSignatureSceneObjects: contactPortalZone.signatureArtifactSceneObjects,
      signatures: contactPortalZone.signatureArtifactSignatures,
      roles: contactPortalZone.signatureArtifactRoles,
      families: [...contactSignatureFamilies].sort()
    });
  } else {
    scenarioFail("contact-signature-headroom", "Contact Portal signature is not rich enough within the compressed scene budget.", {
      zoneId: contactPortalZone?.id ?? null,
      sceneObjects: world?.sceneObjects,
      requiredSceneObjectsMax: premiumWorldObjectBudget,
      sceneObjectBudget: premiumWorldObjectBudget,
      semanticSignatureObjects: contactPortalZone?.signatureArtifactObjects,
      physicalSignatureSceneObjects: contactPortalZone?.signatureArtifactSceneObjects,
      signatures: contactPortalZone?.signatureArtifactSignatures ?? [],
      roles: contactPortalZone?.signatureArtifactRoles ?? [],
      families: [...contactSignatureFamilies].sort()
    });
  }

  const envelopeLayers = [
    { key: "setDressingEnvelope", label: "set-dressing", maxOverflow: 1.65, offsetPad: 1.35, maxHeight: 3.3 },
    { key: "placeArchitectureEnvelope", label: "place-architecture", maxOverflow: 1.75, offsetPad: 1.45, maxHeight: 3.6 },
    { key: "signatureArtifactEnvelope", label: "signature-artifact", maxOverflow: 1.55, offsetPad: 1.55, maxHeight: 3.4 },
    { key: "projectArtifactEnvelope", label: "project-artifact", maxOverflow: 1.15, offsetPad: 1.65, maxHeight: 2.5 }
  ];
  const envelopeMeasurementTolerance = 0.45;
  const assetEnvelopeProofs = visualSpecZones.flatMap((zone) =>
    envelopeLayers.map((layer) => {
      const envelope = zone[layer.key] ?? {};
      const radius = zone.zoneRadius ?? 0;
      const allowedFootprintRadius = envelope.allowedFootprintRadius ?? Number((radius + 1.25).toFixed(3));
      const footprintLimit = Number((allowedFootprintRadius + layer.maxOverflow).toFixed(3));
      const offsetLimit = Number((radius + layer.offsetPad).toFixed(3));
      const toleratedFootprintLimit = Number((footprintLimit + envelopeMeasurementTolerance).toFixed(3));
      const toleratedOffsetLimit = Number((offsetLimit + envelopeMeasurementTolerance).toFixed(3));
      const toleratedOverflowLimit = Number((layer.maxOverflow + envelopeMeasurementTolerance).toFixed(3));
      const toleratedMaxHeight = Number((layer.maxHeight + envelopeMeasurementTolerance).toFixed(3));
      const toleratedMinY = Number((-0.8 - envelopeMeasurementTolerance).toFixed(3));
      const toleratedMaxY = Number((6.5 + envelopeMeasurementTolerance).toFixed(3));
      const width = envelope.width ?? 0;
      const height = envelope.height ?? 0;
      const depth = envelope.depth ?? 0;
      const footprintRadius = envelope.footprintRadius ?? 999;
      const offsetDistance = envelope.offsetDistance ?? 999;
      const overflow = envelope.overflow ?? Math.max(0, footprintRadius - allowedFootprintRadius);
      return {
        zoneId: zone.id,
        layer: layer.label,
        zoneRadius: radius,
        width,
        height,
        depth,
        min: envelope.min ?? null,
        max: envelope.max ?? null,
        center: envelope.center ?? null,
        offset: envelope.offset ?? null,
        footprintRadius,
        allowedFootprintRadius,
        footprintLimit,
        toleratedFootprintLimit,
        overflow,
        maxOverflow: layer.maxOverflow,
        toleratedOverflowLimit,
        offsetDistance,
        offsetLimit,
        toleratedOffsetLimit,
        maxHeight: layer.maxHeight,
        toleratedMaxHeight,
        toleratedMinY,
        toleratedMaxY,
        ok:
          width > 0 &&
          depth > 0 &&
          height > 0 &&
          footprintRadius <= toleratedFootprintLimit &&
          overflow <= toleratedOverflowLimit &&
          offsetDistance <= toleratedOffsetLimit &&
          (envelope.min?.y ?? 0) >= toleratedMinY &&
          (envelope.max?.y ?? 0) <= toleratedMaxY &&
          height <= toleratedMaxHeight
      };
    })
  );
  const assetEnvelopeClearance =
    world &&
    visualSpecZones.length === snapshot.zoneCount &&
    assetEnvelopeProofs.every((proof) => proof.ok) &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (assetEnvelopeClearance) {
    pass("asset-envelope-clearance", {
      zones: snapshot.zoneCount,
      layers: envelopeLayers.map((layer) => layer.label),
      measurementTolerance: envelopeMeasurementTolerance,
      proofs: assetEnvelopeProofs,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("asset-envelope-clearance", "Zone assets are not bounded tightly enough around their intended places.", {
      measurementTolerance: envelopeMeasurementTolerance,
      failingProofs: assetEnvelopeProofs.filter((proof) => !proof.ok),
      proofs: assetEnvelopeProofs,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const duplicateFingerprints = visualSpecZones
    .map((zone) => zone.visualFingerprint)
    .filter((fingerprint, index, fingerprints) => fingerprint && fingerprints.indexOf(fingerprint) !== index);
  const duplicateSetDressingFingerprints = visualSpecZones
    .map((zone) => zone.setDressingFingerprint)
    .filter((fingerprint, index, fingerprints) => fingerprint && fingerprints.indexOf(fingerprint) !== index);
  const allSetDressingSignatures = visualSpecZones.flatMap((zone) => zone.setDressingSignatures ?? []);
  const duplicateSetDressingSignatures = allSetDressingSignatures.filter(
    (signature, index, signatures) => signature && signatures.indexOf(signature) !== index
  );
  const allPlaceArchitectureSignatures = visualSpecZones.flatMap((zone) => zone.placeArchitectureSignatures ?? []);
  const duplicatePlaceArchitectureSignatures = allPlaceArchitectureSignatures.filter(
    (signature, index, signatures) => signature && signatures.indexOf(signature) !== index
  );
  const allProjectArtifactSignatures = visualSpecZones.flatMap((zone) => zone.projectArtifactSignatures ?? []);
  const duplicateProjectArtifactSignatures = allProjectArtifactSignatures.filter(
    (signature, index, signatures) => signature && signatures.indexOf(signature) !== index
  );
  const projectArtifactActivityTypes = new Set(
    visualSpecZones.flatMap((zone) => zone.projectArtifactActivityTypes ?? [])
  );
  const projectArtifactMaterials = new Set(visualSpecZones.flatMap((zone) => zone.projectArtifactMaterials ?? []));
  const projectArtifactManifests = new Set(visualSpecZones.flatMap((zone) => zone.projectArtifactManifests ?? []));
  const projectArtifactThemeRoles = new Set(visualSpecZones.flatMap((zone) => zone.projectArtifactThemeRoles ?? []));
  const projectArtifactSpecimenFamilies = new Set(
    visualSpecZones.flatMap((zone) => zone.projectArtifactSpecimenFamilies ?? [])
  );
  const projectArtifactDetailProfiles = new Set(
    visualSpecZones.flatMap((zone) => zone.projectArtifactDetailProfiles ?? [])
  );
  const projectArtifactReliefSignatures = new Set(
    visualSpecZones.flatMap((zone) => zone.projectArtifactReliefSignatures ?? [])
  );
  const projectArtifactZones = visualSpecZones.filter((zone) => (zone.projectArtifactObjects ?? 0) > 0);
  const forbiddenProjectArtifactSignatures = allProjectArtifactSignatures.filter((signature) =>
    /@|https?:\/\/|www\.|\.(?:com|fr|io|dev)\b|client|customer|brand|logo|testimonial|revenue|kpi/i.test(signature)
  );
  const placeArchitectureFamilies = new Set(
    visualSpecZones.map((zone) => zone.placeArchitectureFamily).filter((family) => typeof family === "string")
  );
  const localMotionBehaviorTypes = new Set(
    visualSpecZones.flatMap((zone) => Object.keys(zone.localMotionBehaviors ?? {}))
  );
  const duplicateSurfaceFingerprints = visualSpecZones
    .map((zone) => zone.surfaceFingerprint)
    .filter((fingerprint, index, fingerprints) => fingerprint && fingerprints.indexOf(fingerprint) !== index);
  const allSurfaceSignatures = visualSpecZones.flatMap((zone) => zone.surfaceSignatures ?? []);
  const duplicateSurfaceSignatures = allSurfaceSignatures.filter(
    (signature, index, signatures) => signature && signatures.indexOf(signature) !== index
  );
  const visualSpecRendered =
    world &&
    visualSpecZones.length === snapshot.zoneCount &&
    world.visualSpecs === snapshot.zoneCount &&
    world.visualDecals >= snapshot.zoneCount * 3 &&
    world.propClusters >= snapshot.zoneCount * 3 &&
    world.surfaceObjects >= snapshot.zoneCount * 5 &&
    world.surfaceSignatures >= snapshot.zoneCount * 5 &&
    world.materialVariants >= snapshot.zoneCount * 6 &&
    world.setDressingObjects >= 78 &&
    world.setDressingSignatures >= 58 &&
    world.signatureArtifactObjects >= 55 &&
    world.signatureArtifactSignatures >= 45 &&
    signatureArtifactFamilies.size >= 10 &&
    signatureArtifactRoleTypes.size >= 45 &&
    hasWorldComposition &&
    world.motionRoles >= visualSpecZones.reduce((sum, zone) => sum + (zone.motionObjectCount ?? 0), 0) &&
    duplicateFingerprints.length === 0 &&
    duplicateSurfaceFingerprints.length === 0 &&
    duplicateSurfaceSignatures.length === 0 &&
    duplicateSetDressingFingerprints.length === 0 &&
    duplicateSetDressingSignatures.length === 0 &&
    duplicateSignatureArtifactSignatures.length === 0 &&
    thinSignatureArtifactZones.length === 0 &&
    localMotionBehaviorTypes.size >= 5 &&
    thinZones.length === 0;

  if (visualSpecRendered) {
    pass("visual-specs-rendered", {
      visualSpecs: world.visualSpecs,
      visualDecals: world.visualDecals,
      propClusters: world.propClusters,
      surfaceObjects: world.surfaceObjects,
      surfaceSignatures: world.surfaceSignatures,
      materialVariants: world.materialVariants,
      setDressingObjects: world.setDressingObjects,
      setDressingSignatures: world.setDressingSignatures,
      signatureArtifactObjects: world.signatureArtifactObjects,
      signatureArtifactSignatures: world.signatureArtifactSignatures,
      signatureArtifactFamilies: [...signatureArtifactFamilies].sort(),
      signatureArtifactRoleTypes: [...signatureArtifactRoleTypes].sort(),
      signatureArtifactSignatures: allSignatureArtifactSignatures,
      terrainLayers: world.terrainLayers,
      sceneryObjects: world.sceneryObjects,
      scenerySignatures: world.scenerySignatures,
      sceneryMotionObjects: world.sceneryMotionObjects,
      sceneryRoleCounts: world.sceneryRoleCounts,
      motionRoles: world.motionRoles,
      motionRolesByType: world.motionRolesByType,
      surfaceSignatures: allSurfaceSignatures,
      setDressingSignatures: allSetDressingSignatures,
      localMotionBehaviorTypes: [...localMotionBehaviorTypes].sort(),
      fingerprints: visualSpecZones.map((zone) => zone.visualFingerprint)
    });
  } else {
    scenarioFail("visual-specs-rendered", "ZoneVisualSpec declarations are not fully materialized in the scene graph.", {
      visualSpecs: world?.visualSpecs,
      visualDecals: world?.visualDecals,
      propClusters: world?.propClusters,
      surfaceObjects: world?.surfaceObjects,
      surfaceSignatures: world?.surfaceSignatures,
      materialVariants: world?.materialVariants,
      setDressingObjects: world?.setDressingObjects,
      setDressingSignatures: world?.setDressingSignatures,
      terrainLayers: world?.terrainLayers,
      sceneryObjects: world?.sceneryObjects,
      scenerySignatures: world?.scenerySignatures,
      sceneryMotionObjects: world?.sceneryMotionObjects,
      sceneryRoleCounts: world?.sceneryRoleCounts,
      missingSceneryRoles,
      motionRoles: world?.motionRoles,
      motionRolesByType: world?.motionRolesByType,
      duplicateFingerprints,
      duplicateSurfaceFingerprints,
      duplicateSurfaceSignatures,
      duplicateSetDressingFingerprints,
      duplicateSetDressingSignatures,
      duplicateSignatureArtifactSignatures,
      thinSignatureArtifactZones,
      localMotionBehaviorTypes: [...localMotionBehaviorTypes].sort(),
      thinZones,
      zones: visualSpecZones
    });
  }

  const identityRibbonRendered =
    world &&
    world.identityRibbonObjects >= 60 &&
    world.identityRibbonSignatures >= 1 &&
    world.sceneryRoleCounts?.["identity-ribbon"] === 1 &&
    world.sceneryMotionObjects >= 20 &&
    world.sceneObjects <= 955;
  if (identityRibbonRendered) {
    pass("identity-ribbon-rendered", {
      identityRibbonObjects: world.identityRibbonObjects,
      identityRibbonSignatures: world.identityRibbonSignatures,
      roleCount: world.sceneryRoleCounts?.["identity-ribbon"],
      sceneryObjects: world.sceneryObjects,
      sceneryMotionObjects: world.sceneryMotionObjects,
      sceneObjects: world.sceneObjects
    });
  } else {
    scenarioFail("identity-ribbon-rendered", "The central IT/STUDIO/ART ribbon is not materialized within budget.", {
      identityRibbonObjects: world?.identityRibbonObjects,
      identityRibbonSignatures: world?.identityRibbonSignatures,
      roleCount: world?.sceneryRoleCounts?.["identity-ribbon"],
      sceneryObjects: world?.sceneryObjects,
      sceneryMotionObjects: world?.sceneryMotionObjects,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: 955
    });
  }

  const surfaceThinZones = visualSpecZones.filter(
    (zone) =>
      !zone.surfaceProfileId ||
      !zone.surfaceFinish ||
      !zone.surfaceMotif ||
      (zone.surfaceObjects ?? 0) < Math.max(5, zone.expectedVisuals?.surfaceObjects ?? 0) ||
      (zone.surfaceSignatures?.length ?? 0) < Math.max(5, zone.expectedVisuals?.surfaceSignatures ?? 0) ||
      (zone.surfaceRoles?.length ?? 0) < 4 ||
      !zone.surfaceFingerprint
  );
  const placeArchitectureThinZones = visualSpecZones.filter(
    (zone) =>
      (zone.placeArchitectureObjects ?? 0) < 4 ||
      (zone.placeArchitectureObjects ?? 0) > 5 ||
      !zone.placeArchitectureFamily ||
      (zone.placeArchitectureRoles?.length ?? 0) < 3 ||
      (zone.placeArchitectureSignatures?.length ?? 0) < 4 ||
      !zone.placeArchitectureFingerprint ||
      (zone.placeArchitectureBounds?.height ?? 0) < 1 ||
      (zone.placeArchitectureBounds?.width ?? 0) < 1.4 ||
      (zone.placeArchitectureBounds?.depth ?? 0) < 1.2
  );
  const projectArtifactThinZones = visualSpecZones.filter(
    (zone) =>
      (zone.projectArtifactObjects ?? 0) < 2 ||
      (zone.projectArtifactSceneObjects ?? 0) !== 1 ||
      (zone.projectArtifactActivityTypes?.length ?? 0) < 1 ||
      (zone.projectArtifactSignatures?.length ?? 0) < (zone.projectArtifactObjects ?? 0) ||
      (zone.projectArtifactMaterials?.length ?? 0) < 2 ||
      (zone.projectArtifactSpecimenFamilies?.length ?? 0) < 1 ||
      (zone.projectArtifactDetailProfiles?.length ?? 0) < 1 ||
      (zone.projectArtifactReliefSignatures?.length ?? 0) < 4 ||
      (zone.projectArtifactPartCount ?? 0) < (zone.projectArtifactObjects ?? 0) * 4 ||
      (zone.projectArtifactVertexCount ?? 0) < 120 ||
      !zone.projectArtifactFingerprint ||
      (zone.projectArtifactBounds?.height ?? 0) < 0.08 ||
      (zone.projectArtifactBounds?.width ?? 0) < 0.55 ||
      (zone.projectArtifactBounds?.depth ?? 0) < 0.25
  );
  if (
    world &&
    visualSpecZones.length === snapshot.zoneCount &&
    world.surfaceObjects >= snapshot.zoneCount * 5 &&
    world.surfaceSignatures >= snapshot.zoneCount * 5 &&
    duplicateSurfaceFingerprints.length === 0 &&
    duplicateSurfaceSignatures.length === 0 &&
    surfaceThinZones.length === 0
  ) {
    pass("surface-spec-materialized", {
      surfaceObjects: world.surfaceObjects,
      surfaceSignatures: world.surfaceSignatures,
      fingerprints: visualSpecZones.map((zone) => zone.surfaceFingerprint)
    });
  } else {
    scenarioFail("surface-spec-materialized", "Declared zone surface profiles are not fully materialized.", {
      surfaceObjects: world?.surfaceObjects,
      surfaceSignatures: world?.surfaceSignatures,
      duplicateSurfaceFingerprints,
      duplicateSurfaceSignatures,
      surfaceThinZones
    });
  }

  const expectedSurfaceDetailWaterProfiles = [
    "surface-detail:water:tech-harbor:harbor-angular:",
    "surface-detail:water:art-lagoon:lagoon-asymmetric:",
    "surface-detail:water:studio-canal:canal-longitudinal:",
    "surface-detail:water:foundry-cooling-pool:cooling-tight-rings:",
    "surface-detail:water:north-reflection-cut:north-reflection:",
    "surface-detail:water:south-postal-basin:postal-basin:"
  ];
  const expectedSurfaceDetailRampProfiles = [
    "surface-detail:ramp:tech-delta:delta-blue-steps:",
    "surface-detail:ramp:obs-rise:observability-ticks:",
    "surface-detail:ramp:art-sweep:art-sweep-strokes:",
    "surface-detail:ramp:studio-crossing:studio-crossbars:",
    "surface-detail:ramp:mail-bank:mail-bank-folds:",
    "surface-detail:ramp:foundry-roll:foundry-roll-cuts:",
    "surface-detail:ramp:north-shelf:north-shelf-strata:",
    "surface-detail:ramp:south-shelf:south-shelf-folds:"
  ];
  const expectedWaterBodies = expectedSurfaceDetailWaterProfiles.length;
  const expectedReliefRamps = expectedSurfaceDetailRampProfiles.length;
  const expectedWaterFoam = expectedWaterBodies * 2;
  const expectedShorePins = expectedWaterBodies * 4;
  const expectedWaterCrossings = expectedWaterBodies * 4;
  const expectedRampChevrons = expectedReliefRamps * 3;
  const surfaceDetailSignatures = world?.surfaceDetailSignatures ?? [];
  const missingSurfaceDetailRegionProfiles = [
    ...expectedSurfaceDetailWaterProfiles,
    ...expectedSurfaceDetailRampProfiles
  ].filter((signaturePrefix) => !surfaceDetailSignatures.some((signature) => signature.startsWith(signaturePrefix)));
  const missingWaterCrossingProfiles = expectedSurfaceDetailWaterProfiles.filter(
    (signaturePrefix) => !surfaceDetailSignatures.some((signature) => signature.startsWith(`${signaturePrefix}crossing-plank-`))
  );
  const duplicateSurfaceDetailSignatures = world?.duplicateSurfaceDetailSignatures ?? [];
  const premiumSurfaceDetails =
    world &&
    world.surfaceDetailPartCounts?.["water-foam"] >= expectedWaterFoam &&
    world.surfaceDetailPartCounts?.["shore-pin"] >= expectedShorePins &&
    world.surfaceDetailPartCounts?.["water-crossing"] >= expectedWaterCrossings &&
    world.surfaceDetailPartCounts?.["ramp-chevron"] >= expectedRampChevrons &&
    world.surfaceDetailPartCounts?.["terrain-contour"] >= 9 &&
    world.surfaceDetailProfiles >= expectedWaterBodies + expectedReliefRamps &&
    world.surfaceDetailWaterProfiles >= expectedWaterBodies &&
    world.surfaceDetailRampProfiles >= expectedReliefRamps &&
    world.surfaceDetailColorVariants >= 12 &&
    (world.missingSurfaceDetailProfiles ?? []).length === 0 &&
    missingSurfaceDetailRegionProfiles.length === 0 &&
    duplicateSurfaceDetailSignatures.length === 0 &&
    world.sceneryRoleCounts?.["surface-detail"] >= expectedWaterBodies * 2 + expectedReliefRamps + 9 &&
    world.sceneryRoleCounts?.["water-body"] >= expectedWaterBodies &&
    world.sceneryRoleCounts?.["relief-ramp"] >= expectedReliefRamps &&
    world.sceneryObjects >= 180 &&
    world.scenerySignatures >= 75 &&
    world.sceneryMotionObjects >= 55 &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (premiumSurfaceDetails) {
    pass("premium-surface-details", {
      surfaceDetailRoles: world.sceneryRoleCounts["surface-detail"],
      waterBodies: world.sceneryRoleCounts["water-body"],
      reliefRamps: world.sceneryRoleCounts["relief-ramp"],
      surfaceDetailPartCounts: world.surfaceDetailPartCounts,
      surfaceDetailProfiles: world.surfaceDetailProfiles,
      surfaceDetailWaterProfiles: world.surfaceDetailWaterProfiles,
      surfaceDetailRampProfiles: world.surfaceDetailRampProfiles,
      surfaceDetailColorVariants: world.surfaceDetailColorVariants,
      surfaceDetailSignatures: world.surfaceDetailSignatures,
      missingSurfaceDetailProfiles: world.missingSurfaceDetailProfiles,
      missingSurfaceDetailRegionProfiles,
      missingWaterCrossingProfiles,
      duplicateSurfaceDetailSignatures,
      sceneryObjects: world.sceneryObjects,
      scenerySignatures: world.scenerySignatures,
      sceneryMotionObjects: world.sceneryMotionObjects,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("premium-surface-details", "Water, relief and terrain detail are not materialized as a premium playable topography.", {
      surfaceDetailRoles: world?.sceneryRoleCounts?.["surface-detail"],
      waterBodies: world?.sceneryRoleCounts?.["water-body"],
      reliefRamps: world?.sceneryRoleCounts?.["relief-ramp"],
      surfaceDetailPartCounts: world?.surfaceDetailPartCounts,
      surfaceDetailProfiles: world?.surfaceDetailProfiles,
      surfaceDetailWaterProfiles: world?.surfaceDetailWaterProfiles,
      surfaceDetailRampProfiles: world?.surfaceDetailRampProfiles,
      surfaceDetailColorVariants: world?.surfaceDetailColorVariants,
      surfaceDetailSignatures: world?.surfaceDetailSignatures,
      missingSurfaceDetailProfiles: world?.missingSurfaceDetailProfiles,
      missingSurfaceDetailRegionProfiles,
      missingWaterCrossingProfiles,
      duplicateSurfaceDetailSignatures,
      sceneryObjects: world?.sceneryObjects,
      scenerySignatures: world?.scenerySignatures,
      sceneryMotionObjects: world?.sceneryMotionObjects,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      sceneryRoleCounts: world?.sceneryRoleCounts
    });
  }

  const waterLevelDesign =
    world &&
    world.surfaceDetailPartCounts?.["water-crossing"] >= expectedWaterCrossings &&
    missingWaterCrossingProfiles.length === 0 &&
    world.surfaceDetailSignatures.filter((signature) => signature.includes(":crossing-plank-")).length >= expectedWaterCrossings &&
    world.sceneryRoleCounts?.["water-body"] >= expectedWaterBodies &&
    world.sceneryRoleCounts?.["surface-detail"] >= expectedWaterBodies * 2 + expectedReliefRamps + 9 &&
    world.surfaceDetailColorVariants >= 12 &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (waterLevelDesign) {
    pass("water-level-design", {
      waterBodies: world.sceneryRoleCounts["water-body"],
      waterCrossings: world.surfaceDetailPartCounts["water-crossing"],
      crossingSignatures: world.surfaceDetailSignatures.filter((signature) => signature.includes(":crossing-plank-")),
      missingWaterCrossingProfiles,
      surfaceDetailRoles: world.sceneryRoleCounts["surface-detail"],
      surfaceDetailColorVariants: world.surfaceDetailColorVariants,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("water-level-design", "Water reads as a flat material instead of a designed playable crossing space.", {
      waterBodies: world?.sceneryRoleCounts?.["water-body"],
      waterCrossings: world?.surfaceDetailPartCounts?.["water-crossing"],
      crossingSignatures: world?.surfaceDetailSignatures?.filter((signature) => signature.includes(":crossing-plank-")) ?? [],
      missingWaterCrossingProfiles,
      surfaceDetailRoles: world?.sceneryRoleCounts?.["surface-detail"],
      surfaceDetailColorVariants: world?.surfaceDetailColorVariants,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const terrainHeightfieldMaterialized =
    world &&
    world.terrainLayers >= 6 &&
    world.terrainHeightRange >= 0.45 &&
    world.terrainMinHeight <= -0.18 &&
    world.terrainMaxHeight >= 0.24 &&
    world.terrainVertexCount >= 900 &&
    world.terrainVertexCount <= 1_200 &&
    world.terrainGradeMax >= 0.035 &&
    world.terrainFeatureCount >= 6 &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (terrainHeightfieldMaterialized) {
    pass("terrain-heightfield-materialized", {
      terrainLayers: world.terrainLayers,
      terrainHeightRange: world.terrainHeightRange,
      terrainMinHeight: world.terrainMinHeight,
      terrainMaxHeight: world.terrainMaxHeight,
      terrainVertexCount: world.terrainVertexCount,
      terrainGradeMax: world.terrainGradeMax,
      terrainFeatureCount: world.terrainFeatureCount,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("terrain-heightfield-materialized", "Shared visual/physics terrain heightfield is not materialized within budget.", {
      terrainLayers: world?.terrainLayers,
      terrainHeightRange: world?.terrainHeightRange,
      terrainMinHeight: world?.terrainMinHeight,
      terrainMaxHeight: world?.terrainMaxHeight,
      terrainVertexCount: world?.terrainVertexCount,
      terrainGradeMax: world?.terrainGradeMax,
      terrainFeatureCount: world?.terrainFeatureCount,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const terrainFeatureMarkers =
    world &&
    world.terrainFeatureCount >= 7 &&
    world.terrainFeatureMarkerObjects >= world.terrainFeatureCount * 6 &&
    world.terrainFeatureMarkerSceneObjects <= 3 &&
    world.terrainFeatureMarkerSignatures >= world.terrainFeatureCount * 6 &&
    world.terrainFeatureMarkerProfiles >= 3 &&
    world.sceneryRoleCounts?.["terrain-feature-marker"] >= world.terrainFeatureCount &&
    world.sceneryMotionObjects >= 75 &&
    world.sceneObjects <= premiumWorldObjectBudget - 24;
  if (terrainFeatureMarkers) {
    pass("terrain-feature-markers", {
      terrainFeatureCount: world.terrainFeatureCount,
      terrainFeatureMarkerObjects: world.terrainFeatureMarkerObjects,
      terrainFeatureMarkerSceneObjects: world.terrainFeatureMarkerSceneObjects,
      terrainFeatureMarkerSignatures: world.terrainFeatureMarkerSignatures,
      terrainFeatureMarkerProfiles: world.terrainFeatureMarkerProfiles,
      terrainFeatureMarkerRoles: world.sceneryRoleCounts["terrain-feature-marker"],
      sceneryMotionObjects: world.sceneryMotionObjects,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      reservedHeadroom: premiumWorldObjectBudget - world.sceneObjects
    });
  } else {
    scenarioFail("terrain-feature-markers", "Physical terrain features are not explicitly readable as instanced map landmarks.", {
      terrainFeatureCount: world?.terrainFeatureCount,
      terrainFeatureMarkerObjects: world?.terrainFeatureMarkerObjects,
      terrainFeatureMarkerSceneObjects: world?.terrainFeatureMarkerSceneObjects,
      terrainFeatureMarkerSignatures: world?.terrainFeatureMarkerSignatures,
      terrainFeatureMarkerProfiles: world?.terrainFeatureMarkerProfiles,
      terrainFeatureMarkerRoles: world?.sceneryRoleCounts?.["terrain-feature-marker"],
      sceneryMotionObjects: world?.sceneryMotionObjects,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      reservedHeadroom: typeof world?.sceneObjects === "number" ? premiumWorldObjectBudget - world.sceneObjects : null
    });
  }

  const placeArchitectureRendered =
    world &&
    visualSpecZones.length === snapshot.zoneCount &&
    world.placeArchitectureObjects >= snapshot.zoneCount * 4 &&
    world.placeArchitectureObjects <= snapshot.zoneCount * 5 &&
    world.placeArchitectureFamilies === snapshot.zoneCount &&
    placeArchitectureFamilies.size === snapshot.zoneCount &&
    world.placeArchitectureSignatures >= snapshot.zoneCount * 4 &&
    duplicatePlaceArchitectureSignatures.length === 0 &&
    placeArchitectureThinZones.length === 0 &&
    world.sceneObjects <= 1080;
  if (placeArchitectureRendered) {
    pass("place-architecture-rendered", {
      placeArchitectureObjects: world.placeArchitectureObjects,
      placeArchitectureFamilies: world.placeArchitectureFamilies,
      placeArchitectureSignatures: world.placeArchitectureSignatures,
      families: [...placeArchitectureFamilies].sort(),
      signatures: allPlaceArchitectureSignatures,
      fingerprints: visualSpecZones.map((zone) => zone.placeArchitectureFingerprint),
      sceneObjects: world.sceneObjects
    });
  } else {
    scenarioFail("place-architecture-rendered", "Zone place architecture is not sufficiently modeled or bounded.", {
      placeArchitectureObjects: world?.placeArchitectureObjects,
      placeArchitectureFamilies: world?.placeArchitectureFamilies,
      families: [...placeArchitectureFamilies].sort(),
      placeArchitectureSignatures: world?.placeArchitectureSignatures,
      duplicatePlaceArchitectureSignatures,
      placeArchitectureThinZones,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: 1080
    });
  }

  const projectArtifactsRendered =
    world &&
    visualSpecZones.length === snapshot.zoneCount &&
    world.projectArtifactZones === snapshot.zoneCount &&
    world.projectArtifactObjects >= 20 &&
    world.projectArtifactObjects <= 30 &&
    world.projectArtifactSceneObjects <= 10 &&
    world.projectArtifactActivityTypes >= 10 &&
    world.projectArtifactSignatures >= world.projectArtifactObjects &&
    world.projectArtifactMaterials >= snapshot.zoneCount * 2 &&
    duplicateProjectArtifactSignatures.length === 0 &&
    forbiddenProjectArtifactSignatures.length === 0 &&
    projectArtifactActivityTypes.size >= 10 &&
    projectArtifactZones.length === snapshot.zoneCount &&
    projectArtifactThinZones.length === 0 &&
    world.sceneObjects <= 955;
  if (projectArtifactsRendered) {
    pass("project-artifacts-rendered", {
      projectArtifactObjects: world.projectArtifactObjects,
      projectArtifactSceneObjects: world.projectArtifactSceneObjects,
      projectArtifactZones: world.projectArtifactZones,
      projectArtifactActivityTypes: [...projectArtifactActivityTypes].sort(),
      projectArtifactSignatures: allProjectArtifactSignatures,
      projectArtifactMaterials: [...projectArtifactMaterials].sort(),
      projectArtifactManifests: [...projectArtifactManifests].sort(),
      projectArtifactThemeRoles: [...projectArtifactThemeRoles].sort(),
      projectArtifactSpecimenFamilies: [...projectArtifactSpecimenFamilies].sort(),
      projectArtifactDetailProfiles: [...projectArtifactDetailProfiles].sort(),
      projectArtifactReliefSignatures: [...projectArtifactReliefSignatures].sort(),
      projectArtifactPartCount: world.projectArtifactPartCount,
      projectArtifactVertexCount: world.projectArtifactVertexCount,
      fingerprints: visualSpecZones.map((zone) => zone.projectArtifactFingerprint),
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: 955
    });
  } else {
    scenarioFail("project-artifacts-rendered", "Anonymized project evidence kits are not present across the whole playable map.", {
      projectArtifactObjects: world?.projectArtifactObjects,
      projectArtifactSceneObjects: world?.projectArtifactSceneObjects,
      projectArtifactZones: world?.projectArtifactZones,
      projectArtifactActivityTypes: [...projectArtifactActivityTypes].sort(),
      projectArtifactSignatures: world?.projectArtifactSignatures,
      projectArtifactMaterials: world?.projectArtifactMaterials,
      projectArtifactManifests: [...projectArtifactManifests].sort(),
      projectArtifactThemeRoles: [...projectArtifactThemeRoles].sort(),
      projectArtifactSpecimenFamilies: [...projectArtifactSpecimenFamilies].sort(),
      projectArtifactDetailProfiles: [...projectArtifactDetailProfiles].sort(),
      projectArtifactReliefSignatures: [...projectArtifactReliefSignatures].sort(),
      projectArtifactPartCount: world?.projectArtifactPartCount,
      projectArtifactVertexCount: world?.projectArtifactVertexCount,
      duplicateProjectArtifactSignatures,
      forbiddenProjectArtifactSignatures,
      projectArtifactThinZones,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: 955,
      zones: visualSpecZones.map((zone) => ({
        id: zone.id,
        projectArtifactObjects: zone.projectArtifactObjects,
        projectArtifactSceneObjects: zone.projectArtifactSceneObjects,
        projectArtifactActivityTypes: zone.projectArtifactActivityTypes,
        projectArtifactSignatures: zone.projectArtifactSignatures,
        projectArtifactMaterials: zone.projectArtifactMaterials,
        projectArtifactManifests: zone.projectArtifactManifests,
        projectArtifactThemeRoles: zone.projectArtifactThemeRoles,
        projectArtifactSpecimenFamilies: zone.projectArtifactSpecimenFamilies,
        projectArtifactDetailProfiles: zone.projectArtifactDetailProfiles,
        projectArtifactReliefSignatures: zone.projectArtifactReliefSignatures,
        projectArtifactPartCount: zone.projectArtifactPartCount,
        projectArtifactVertexCount: zone.projectArtifactVertexCount,
        projectArtifactBounds: zone.projectArtifactBounds
      }))
    });
  }

  const projectArtifactsMaterialized =
    world &&
    world.projectArtifactZones === snapshot.zoneCount &&
    world.projectArtifactSceneObjects <= 10 &&
    world.projectArtifactSpecimenFamilies === 5 &&
    world.projectArtifactDetailProfiles >= 5 &&
    world.projectArtifactManifests >= 5 &&
    world.projectArtifactThemeRoles >= 12 &&
    world.projectArtifactReliefSignatures >= 24 &&
    world.projectArtifactPartCount >= world.projectArtifactObjects * 4 &&
    world.projectArtifactVertexCount >= 3_000 &&
    ["capsule", "crystal", "folio", "lens", "slab"].every((family) => projectArtifactSpecimenFamilies.has(family)) &&
    projectArtifactSpecimenFamilies.size === 5 &&
    projectArtifactDetailProfiles.size >= 5 &&
    projectArtifactReliefSignatures.size >= 24 &&
    projectArtifactThinZones.length === 0 &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (projectArtifactsMaterialized) {
    pass("project-artifact-materialized", {
      projectArtifactSpecimenFamilies: [...projectArtifactSpecimenFamilies].sort(),
      projectArtifactDetailProfiles: [...projectArtifactDetailProfiles].sort(),
      projectArtifactManifests: [...projectArtifactManifests].sort(),
      projectArtifactThemeRoles: [...projectArtifactThemeRoles].sort(),
      projectArtifactReliefSignatures: [...projectArtifactReliefSignatures].sort(),
      projectArtifactPartCount: world.projectArtifactPartCount,
      projectArtifactVertexCount: world.projectArtifactVertexCount,
      projectArtifactSceneObjects: world.projectArtifactSceneObjects,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("project-artifact-materialized", "Project evidence kits are not detailed enough to read as premium specimens.", {
      projectArtifactSpecimenFamilies: [...projectArtifactSpecimenFamilies].sort(),
      projectArtifactDetailProfiles: [...projectArtifactDetailProfiles].sort(),
      projectArtifactManifests: [...projectArtifactManifests].sort(),
      projectArtifactThemeRoles: [...projectArtifactThemeRoles].sort(),
      projectArtifactReliefSignatures: [...projectArtifactReliefSignatures].sort(),
      projectArtifactPartCount: world?.projectArtifactPartCount,
      projectArtifactVertexCount: world?.projectArtifactVertexCount,
      projectArtifactSceneObjects: world?.projectArtifactSceneObjects,
      projectArtifactThinZones,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const expectedProjectThemes = {
    "observability-tower": {
      manifest: "trace-instrument",
      roles: ["query-ring", "trace-cursor", "telemetry-dot"]
    },
    "cloud-dock": {
      manifest: "release-module",
      roles: ["deployment-rail", "container-lock", "release-flag"]
    },
    "design-atelier": {
      manifest: "swatch-folio",
      roles: ["swatch-card", "pattern-grid", "folio-index"]
    },
    "contact-portal": {
      manifest: "reply-folio",
      roles: ["envelope-flap", "postal-seal", "reply-tab"]
    }
  };
  const projectThemeProofs = Object.entries(expectedProjectThemes).map(([zoneId, expected]) => {
    const zone = visualSpecZones.find((item) => item.id === zoneId);
    const roles = new Set(zone?.projectArtifactThemeRoles ?? []);
    const roleReliefSignatures = zone?.projectArtifactRoleReliefSignatures ?? {};
    const missingRoleReliefs = expected.roles.filter((role) => {
      const signatures = roleReliefSignatures[role] ?? [];
      return !Array.isArray(signatures) || signatures.length === 0;
    });
    return {
      zoneId,
      expectedManifest: expected.manifest,
      manifests: zone?.projectArtifactManifests ?? [],
      expectedRoles: expected.roles,
      roles: [...roles].sort(),
      roleReliefSignatures,
      hasManifest: zone?.projectArtifactManifests?.includes(expected.manifest) === true,
      missingRoles: expected.roles.filter((role) => !roles.has(role)),
      missingRoleReliefs,
      reliefSignatures: zone?.projectArtifactReliefSignatures ?? [],
      detailProfiles: zone?.projectArtifactDetailProfiles ?? [],
      bounds: zone?.projectArtifactBounds ?? null
    };
  });
  const projectThemesMaterialized =
    world &&
    projectThemeProofs.every(
      (proof) =>
        proof.hasManifest &&
        proof.missingRoles.length === 0 &&
        proof.missingRoleReliefs.length === 0 &&
        proof.reliefSignatures.length >= 7 &&
        (proof.bounds?.width ?? 0) >= 0.55 &&
        (proof.bounds?.depth ?? 0) >= 0.25
    ) &&
    world.projectArtifactSceneObjects <= 10 &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (projectThemesMaterialized) {
    pass("project-themed-assets", {
      projectThemeProofs,
      projectArtifactManifests: [...projectArtifactManifests].sort(),
      projectArtifactThemeRoles: [...projectArtifactThemeRoles].sort(),
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("project-themed-assets", "Priority zones do not expose themed 3D project assets within budget.", {
      projectThemeProofs,
      projectArtifactManifests: [...projectArtifactManifests].sort(),
      projectArtifactThemeRoles: [...projectArtifactThemeRoles].sort(),
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const surface = snapshot?.drive?.surface;
  const routeRoles = world?.routeGuidanceRoleCounts ?? {};
  const expectedGuidanceObjects = surface ? surface.segmentCount * 2 + surface.routeCount : 0;
  const routeGuidanceRendered =
    world &&
    surface &&
    world.routeGuidanceObjects >= expectedGuidanceObjects &&
    world.routeGuidanceSignatures >= surface.segmentCount * 2 &&
    world.routeGuidanceMotionObjects >= surface.segmentCount * 2 &&
    world.routeGuidanceVisualizedSegments === surface.segmentCount &&
    surface.visualizedSegmentCount === surface.segmentCount &&
    surface.guidanceMarkerCount === world.routeGuidanceObjects &&
    routeRoles["route-chevron"] >= surface.segmentCount &&
    routeRoles["route-stud"] >= surface.segmentCount &&
    world.sceneObjects <= 1080;
  if (routeGuidanceRendered) {
    pass("route-guidance-rendered", {
      routeGuidanceObjects: world.routeGuidanceObjects,
      routeGuidanceSignatures: world.routeGuidanceSignatures,
      routeGuidanceMotionObjects: world.routeGuidanceMotionObjects,
      routeGuidanceVisualizedSegments: world.routeGuidanceVisualizedSegments,
      routeGuidanceRoleCounts: world.routeGuidanceRoleCounts,
      expectedGuidanceObjects,
      surface,
      sceneObjects: world.sceneObjects
    });
  } else {
    scenarioFail("route-guidance-rendered", "Road graph is not sufficiently materialized as visual guidance.", {
      routeGuidanceObjects: world?.routeGuidanceObjects,
      routeGuidanceSignatures: world?.routeGuidanceSignatures,
      routeGuidanceMotionObjects: world?.routeGuidanceMotionObjects,
      routeGuidanceVisualizedSegments: world?.routeGuidanceVisualizedSegments,
      routeGuidanceRoleCounts: world?.routeGuidanceRoleCounts,
      expectedGuidanceObjects,
      surface,
      sceneObjects: world?.sceneObjects
    });
  }

  const routeSurfaceMaterialized =
    world &&
    surface &&
    world.routeSurfaceStyle?.bedRadiusRatio <= 0.055 &&
    world.routeSurfaceStyle?.shoulderOffsetRatio <= 0.22 &&
    world.routeSurfaceStyle?.shoulderRadius <= 0.025 &&
    world.routeSurfaceStyle?.signalRadius >= 0.024 &&
    world.routeSurfaceStyle?.dashDepthRatio <= 0.26 &&
    world.routeSurfaceStyle?.dashChevronAngle >= 0.36 &&
    world.routeSurfaceStyle?.underlayOpacity <= 0.15 &&
    world.routeSurfaceStyle?.underlayColor === 0x6a766d &&
    world.routeSurfaceStyle?.laneOpacity >= 0.72 &&
    world.routeSurfaceStyle?.laneEmissiveIntensity >= 0.18 &&
    world.routeSurfaceStyle?.polygonOffsetFactor <= -1 &&
    world.routeSurfaceStyle?.polygonOffsetUnits <= -1 &&
    world.routeSurfaceStyle?.castsShadow === false &&
    world.routeSurfaceObjects === world.roadSegments + surface.routeCount &&
    world.routeSurfaceDetailParts >= surface.routeCount * 9 &&
    world.routeSurfaceDetailSignatures >= surface.routeCount * 6 &&
    world.routeSurfaceVertexCount >= 12_000 &&
    world.routeSurfaceVertexCount <= 24_000 &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (routeSurfaceMaterialized) {
    pass("route-surface-materialized", {
      routeSurfaceObjects: world.routeSurfaceObjects,
      routeSurfaceDetailParts: world.routeSurfaceDetailParts,
      routeSurfaceDetailSignatures: world.routeSurfaceDetailSignatures,
      routeSurfaceVertexCount: world.routeSurfaceVertexCount,
      routeSurfaceVertexBudget: 24_000,
      routeSurfaceStyle: world.routeSurfaceStyle,
      roadSegments: world.roadSegments,
      routeCount: surface.routeCount,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("route-surface-materialized", "Playable roads are not materialized as detailed route ribbons.", {
      routeSurfaceObjects: world?.routeSurfaceObjects,
      routeSurfaceDetailParts: world?.routeSurfaceDetailParts,
      routeSurfaceDetailSignatures: world?.routeSurfaceDetailSignatures,
      routeSurfaceVertexCount: world?.routeSurfaceVertexCount,
      routeSurfaceVertexBudget: 24_000,
      routeSurfaceStyle: world?.routeSurfaceStyle,
      roadSegments: world?.roadSegments,
      routeCount: surface?.routeCount,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const sceneGraphHeadroom =
    world &&
    surface &&
    world.sceneObjects <= 1040 &&
    1075 - world.sceneObjects >= 35 &&
    world.routeGuidanceObjects === expectedGuidanceObjects &&
    routeRoles["route-chevron"] === surface.segmentCount &&
    routeRoles["route-stud"] === surface.segmentCount &&
    routeRoles["route-encounter-gate"] === surface.routeCount &&
    world.routeGuidanceSignatures >= expectedGuidanceObjects &&
    world.routeGuidanceMotionObjects >= expectedGuidanceObjects;
  if (sceneGraphHeadroom) {
    pass("scene-graph-headroom", {
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: 1040,
      baselineSceneObjects: 1075,
      minFreedSceneObjects: 35,
      freedFromPreviousBaseline: 1075 - world.sceneObjects,
      routeGuidanceObjects: world.routeGuidanceObjects,
      expectedGuidanceObjects,
      segmentCount: surface.segmentCount,
      routeCount: surface.routeCount,
      qualityPreserved: true,
      routeGuidanceRoleCounts: world.routeGuidanceRoleCounts
    });
  } else {
    scenarioFail("scene-graph-headroom", "Scene graph does not leave enough asset budget headroom.", {
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: 1040,
      baselineSceneObjects: 1075,
      minFreedSceneObjects: 35,
      freedFromPreviousBaseline: world?.sceneObjects ? 1075 - world.sceneObjects : null,
      routeGuidanceObjects: world?.routeGuidanceObjects,
      expectedGuidanceObjects,
      qualityPreserved: false,
      routeGuidanceRoleCounts: world?.routeGuidanceRoleCounts,
      surface
    });
  }

  const premiumSceneHeadroom =
    world &&
    world.sceneObjects <= premiumWorldObjectBudget - 24 &&
    (world.worldBeaconObjects ?? 0) >= 24 &&
    (world.worldBeaconSceneObjects ?? 99) <= 2;
  if (premiumSceneHeadroom) {
    pass("premium-scene-headroom", {
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      reservedHeadroom: premiumWorldObjectBudget - world.sceneObjects,
      requiredReservedHeadroom: 24,
      worldBeaconObjects: world.worldBeaconObjects,
      worldBeaconSceneObjects: world.worldBeaconSceneObjects
    });
  } else {
    scenarioFail("premium-scene-headroom", "Scene graph is too close to the premium world budget for the next modeled asset wave.", {
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget,
      reservedHeadroom: typeof world?.sceneObjects === "number" ? premiumWorldObjectBudget - world.sceneObjects : null,
      requiredReservedHeadroom: 24,
      worldBeaconObjects: world?.worldBeaconObjects,
      worldBeaconSceneObjects: world?.worldBeaconSceneObjects
    });
  }

  const expectedInstancedPropObjects = visualSpecZones.reduce(
    (sum, zone) => sum + (zone.expectedVisuals?.propObjects ?? 0),
    0
  );
  const expectedInstancedPropClusters = visualSpecZones.reduce(
    (sum, zone) => sum + (zone.expectedVisuals?.propClusters ?? 0),
    0
  );
  const zonesWithUninstancedProps = visualSpecZones.filter(
    (zone) =>
      zone.instancedPropClusters !== (zone.expectedVisuals?.propClusters ?? 0) ||
      zone.instancedPropObjects !== (zone.expectedVisuals?.propObjects ?? 0) ||
      zone.propObjects !== (zone.expectedVisuals?.propObjects ?? 0)
  );
  const sceneObjectsNetOfProjectArtifacts =
    world?.sceneObjects && typeof world.projectArtifactSceneObjects === "number"
      ? world.sceneObjects - world.projectArtifactSceneObjects
      : world?.sceneObjects;
  const propClusterInstancing =
    world &&
    surface &&
    sceneObjectsNetOfProjectArtifacts <= 955 &&
    1033 - sceneObjectsNetOfProjectArtifacts >= 78 &&
    1075 - sceneObjectsNetOfProjectArtifacts >= 120 &&
    world.propClusters === expectedInstancedPropClusters &&
    world.propObjects === expectedInstancedPropObjects &&
    world.instancedPropClusters === expectedInstancedPropClusters &&
    world.instancedPropObjects === expectedInstancedPropObjects &&
    zonesWithUninstancedProps.length === 0;
  if (propClusterInstancing) {
    pass("prop-cluster-instancing", {
      sceneObjects: world.sceneObjects,
      sceneObjectsNetOfProjectArtifacts,
      projectArtifactSceneObjects: world.projectArtifactSceneObjects,
      sceneObjectBudget: 955,
      baselineV35SceneObjects: 1033,
      baselineV34SceneObjects: 1075,
      minFreedSceneObjects: 78,
      freedFromPreviousBaseline: 1033 - sceneObjectsNetOfProjectArtifacts,
      freedFromV34Baseline: 1075 - sceneObjectsNetOfProjectArtifacts,
      propClusters: world.propClusters,
      expectedInstancedPropClusters,
      propObjects: world.propObjects,
      expectedInstancedPropObjects,
      instancedPropClusters: world.instancedPropClusters,
      instancedPropObjects: world.instancedPropObjects,
      zones: visualSpecZones.map((zone) => ({
        id: zone.id,
        propClusters: zone.propClusters,
        propObjects: zone.propObjects,
        instancedPropClusters: zone.instancedPropClusters,
        instancedPropObjects: zone.instancedPropObjects
      }))
    });
  } else {
    scenarioFail("prop-cluster-instancing", "Prop clusters are not fully instanced or did not recover enough scene graph budget.", {
      sceneObjects: world?.sceneObjects,
      sceneObjectsNetOfProjectArtifacts,
      projectArtifactSceneObjects: world?.projectArtifactSceneObjects,
      sceneObjectBudget: 955,
      baselineV35SceneObjects: 1033,
      baselineV34SceneObjects: 1075,
      minFreedSceneObjects: 78,
      freedFromPreviousBaseline: sceneObjectsNetOfProjectArtifacts ? 1033 - sceneObjectsNetOfProjectArtifacts : null,
      freedFromV34Baseline: sceneObjectsNetOfProjectArtifacts ? 1075 - sceneObjectsNetOfProjectArtifacts : null,
      propClusters: world?.propClusters,
      expectedInstancedPropClusters,
      propObjects: world?.propObjects,
      expectedInstancedPropObjects,
      instancedPropClusters: world?.instancedPropClusters,
      instancedPropObjects: world?.instancedPropObjects,
      zonesWithUninstancedProps
    });
  }

  const routeEncountersRendered =
    world &&
    surface &&
    world.routeEncounterGates === surface.routeCount &&
    world.routeEncounterObjects === surface.routeCount &&
    routeRoles["route-encounter-gate"] === surface.routeCount &&
    world.routeGuidanceSignatures >= surface.segmentCount * 2 + surface.routeCount &&
    world.routeGuidanceMotionObjects >= surface.segmentCount * 2 + surface.routeCount &&
    world.sceneObjects <= 1080;
  if (routeEncountersRendered) {
    pass("route-encounters-rendered", {
      routeEncounterGates: world.routeEncounterGates,
      routeEncounterObjects: world.routeEncounterObjects,
      routeGuidanceRoleCounts: world.routeGuidanceRoleCounts,
      routeGuidanceSignatures: world.routeGuidanceSignatures,
      routeGuidanceMotionObjects: world.routeGuidanceMotionObjects,
      surface,
      sceneObjects: world.sceneObjects
    });
  } else {
    scenarioFail("route-encounters-rendered", "Road graph does not expose lightweight route encounter gates.", {
      routeEncounterGates: world?.routeEncounterGates,
      routeEncounterObjects: world?.routeEncounterObjects,
      routeGuidanceRoleCounts: world?.routeGuidanceRoleCounts,
      routeGuidanceSignatures: world?.routeGuidanceSignatures,
      routeGuidanceMotionObjects: world?.routeGuidanceMotionObjects,
      surface,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: 1080
    });
  }

  const routeEncounterQa = snapshot?.routeEncounters;
  const requiredRouteEncounterProfiles = ["studio-threshold", "tech-checkpoint", "art-runway", "contact-mail-gate"];
  const missingRouteEncounterProfiles = requiredRouteEncounterProfiles.filter(
    (profile) => !(routeEncounterQa?.profiles ?? []).includes(profile)
  );
  const routeEncounterSetpieces =
    routeEncountersRendered &&
    routeEncounterQa &&
    routeEncounterQa.gateCount === surface.routeCount &&
    routeEncounterQa.objectCount === surface.routeCount &&
    routeEncounterQa.profileCount >= requiredRouteEncounterProfiles.length &&
    routeEncounterQa.signatureCount >= surface.routeCount &&
    routeEncounterQa.partCount >= surface.routeCount * 7 &&
    routeEncounterQa.minPartsPerGate >= 7 &&
    routeEncounterQa.roles.length >= 18 &&
    missingRouteEncounterProfiles.length === 0 &&
    world.sceneObjects <= premiumWorldObjectBudget;
  if (routeEncounterSetpieces) {
    pass("route-encounter-setpieces", {
      routeEncounters: routeEncounterQa,
      requiredProfiles: requiredRouteEncounterProfiles,
      missingProfiles: missingRouteEncounterProfiles,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  } else {
    scenarioFail("route-encounter-setpieces", "Route encounters are not rich, typed playable setpieces yet.", {
      routeEncounters: routeEncounterQa,
      requiredProfiles: requiredRouteEncounterProfiles,
      missingProfiles: missingRouteEncounterProfiles,
      routeEncountersRendered,
      routeCount: surface?.routeCount,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: premiumWorldObjectBudget
    });
  }

  const player = snapshot?.player;
  const hasPlayerPersonality =
    player &&
    player.meshCount >= 13 &&
    player.wheelCount === 4 &&
    player.bounds.width >= 1 &&
    player.bounds.height >= 0.8 &&
    player.bounds.depth >= 1;

  if (hasPlayerPersonality) {
    pass("player-personality", { player });
  } else {
    scenarioFail("player-personality", "Playable avatar is not detailed enough for the studio world.", { player });
  }
}

async function checkExternalAssetPreview(browser) {
  const previewUrl = withSearchParam(baseUrl, "assets", "preview");
  const previewPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(previewPage, "external-assets");

  try {
    await previewPage.goto(previewUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await previewPage.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
    await previewPage.waitForFunction(
      () => {
        const assets = window.__IT_ART_STUDIO_QA__?.externalAssets;
        return Boolean(
          document.documentElement.classList.contains("game-ready") &&
            window.__IT_ART_STUDIO_QA__?.ready === true &&
            assets?.enabled &&
            assets.requested >= 6 &&
            assets.loaded + assets.failed >= assets.requested &&
            window.__IT_ART_STUDIO_QA__?.frameCount > 6
        );
      },
      { timeout: 20_000 }
    );

    const preview = await capture(previewPage, "external-asset-preview");
    const externalAssets = preview.snapshot?.externalAssets;
    const requiredRoles = ["bridge", "relief", "road", "route-edge", "vegetation", "water"];
    const missingRoles = requiredRoles.filter((role) => !externalAssets?.terrainRoles?.includes(role));
    const previewPathBase = new URL(previewUrl).pathname.replace(/\/$/u, "");
    const expectedAssetPathPrefix = `${previewPathBase}/assets/models/vendor/`.replace(/^\/\//u, "/");
    const unsafePaths = (externalAssets?.publicPaths ?? []).filter((publicPath) => {
      try {
        const parsed = new URL(publicPath, previewUrl);
        return parsed.pathname.includes("/public/") || !parsed.pathname.startsWith(expectedAssetPathPrefix);
      } catch {
        return true;
      }
    });
    const gate =
      externalAssets?.enabled === true &&
      externalAssets.requested >= 6 &&
      externalAssets.loaded >= 6 &&
      externalAssets.failed === 0 &&
      externalAssets.visible >= 6 &&
      externalAssets.files >= 6 &&
      externalAssets.collections >= 6 &&
      externalAssets.sceneObjects >= 12 &&
      externalAssets.bounds.width >= 10 &&
      externalAssets.bounds.height >= 0.5 &&
      externalAssets.bounds.depth >= 0.5 &&
      missingRoles.length === 0 &&
      unsafePaths.length === 0 &&
      (externalAssets.errors?.length ?? 0) === 0 &&
      preview.canvas.ok;

    if (gate) {
      pass("external-asset-preview-runtime", {
        externalAssets,
        canvas: preview.canvas,
        previewUrl
      });
    } else {
      scenarioFail("external-asset-preview-runtime", "Accepted GLB assets are not loading as a visible runtime preview.", {
        externalAssets,
        canvas: preview.canvas,
        previewUrl,
        missingRoles,
        unsafePaths,
        expectedAssetPathPrefix
      });
    }
  } finally {
    if (!previewPage.isClosed()) {
      await previewPage.close();
    }
  }
}

async function checkExternalAssetMapComposition(browser) {
  const mapUrl = withSearchParam(baseUrl, "assets", "map");
  const mapPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(mapPage, "external-asset-map");

  try {
    await mapPage.goto(mapUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await mapPage.waitForLoadState("load", { timeout: 15_000 }).catch(() => {});
    await mapPage.waitForFunction(
      () => {
        const assets = window.__IT_ART_STUDIO_QA__?.externalAssets;
        return Boolean(
          document.documentElement.classList.contains("game-ready") &&
            window.__IT_ART_STUDIO_QA__?.ready === true &&
            assets?.enabled &&
            assets.mode === "map" &&
            assets.requested >= 32 &&
            assets.loaded + assets.failed >= assets.requested &&
            window.__IT_ART_STUDIO_QA__?.frameCount > 6
        );
      },
      { timeout: 24_000 }
    );

    const proof = await capture(mapPage, "external-asset-map-composition");
    const externalAssets = proof.snapshot?.externalAssets;
    const requiredRoles = ["bridge", "relief", "road", "route-edge", "vegetation", "water"];
    const missingRoles = requiredRoles.filter((role) => !externalAssets?.terrainRoles?.includes(role));
    const requiredHeroLocationIds = ["cloud-dock", "design-atelier", "observability-tower"];
    const requiredHeroLocationRoles = {
      "cloud-dock": ["server-cloud-node", "cloud-circuit-bridge", "rack-core", "cable-trunk", "ops-screen"],
      "design-atelier": ["mannequin-fabric-rack", "atelier-drape-frame", "cutting-table", "swatch-crate", "reference-screen"],
      "observability-tower": ["telemetry-radar-mast", "telemetry-screen-array", "signal-pylon", "screen-wall", "trace-panel"]
    };
    const requiredScreenRoles = ["road", "water", "relief", "vegetation"];
    const weakScreenRoles = requiredScreenRoles.filter((role) => {
      const rect = externalAssets?.roleScreenRects?.[role];
      return !(rect?.visible === true && rect.clippedArea >= 300 && rect.visibleRatio >= 0.01);
    });
    const heroLocationProofs = await collectExternalAssetHeroLocationProofs(mapPage, requiredHeroLocationIds);
    const weakHeroLocations = requiredHeroLocationIds.filter((zoneId) => {
      const placementCount = externalAssets?.heroLocationPlacementCounts?.[zoneId] ?? 0;
      const roles = externalAssets?.heroLocationRoles?.[zoneId] ?? [];
      const missingHeroRoles = (requiredHeroLocationRoles[zoneId] ?? []).filter((role) => !roles.includes(role));
      return placementCount < 3 || roles.length < 3 || missingHeroRoles.length > 0 || !heroLocationProofs.find((proof) => proof.zoneId === zoneId && proof.ok);
    });
    const mapPathBase = new URL(mapUrl).pathname.replace(/\/$/u, "");
    const expectedAssetPathPrefixes = ["vendor", "local"].map((scope) =>
      `${mapPathBase}/assets/models/${scope}/`.replace(/^\/\//u, "/")
    );
    const unsafePaths = (externalAssets?.publicPaths ?? []).filter((publicPath) => {
      try {
        const parsed = new URL(publicPath, mapUrl);
        return parsed.pathname.includes("/public/") || !expectedAssetPathPrefixes.some((prefix) => parsed.pathname.startsWith(prefix));
      } catch {
        return true;
      }
    });
    const gate =
      externalAssets?.enabled === true &&
      externalAssets.mode === "map" &&
      externalAssets.requested >= 32 &&
      externalAssets.loaded >= externalAssets.requested &&
      externalAssets.failed === 0 &&
      externalAssets.visible >= externalAssets.requested &&
      externalAssets.files >= externalAssets.requested &&
      externalAssets.uniqueFiles >= 18 &&
      externalAssets.collections >= 6 &&
      externalAssets.placements >= 32 &&
      externalAssets.clusters >= 8 &&
      externalAssets.placementGroups >= 4 &&
      externalAssets.routeLinkedPlacements >= 11 &&
      externalAssets.waterLinkedPlacements >= 4 &&
      externalAssets.reliefLinkedPlacements >= 5 &&
      externalAssets.vegetationLinkedPlacements >= 12 &&
      externalAssets.primaryPlacements >= 18 &&
      externalAssets.supportPlacements >= 12 &&
      externalAssets.contextPlacements >= 8 &&
      externalAssets.promotionCandidates >= 24 &&
      externalAssets.heroLocationPlacements >= 9 &&
      requiredHeroLocationIds.every((zoneId) => externalAssets.heroLocationIds?.includes(zoneId)) &&
      (externalAssets.maxNonHeroClusterDensity ?? externalAssets.maxClusterDensity) <= 3 &&
      (externalAssets.maxHeroLocationClusterDensity ?? 0) <= 8 &&
      externalAssets.minGroundClearance >= 0.2 &&
      externalAssets.coplanarRiskPlacements === 0 &&
      externalAssets.actualMinGroundClearance >= 0.08 &&
      externalAssets.actualCoplanarRiskPlacements === 0 &&
      externalAssets.waterPlacements >= 4 &&
      externalAssets.reliefPlacements >= 5 &&
      externalAssets.vegetationPlacements >= 12 &&
      externalAssets.mapCoverageWidth >= 56 &&
      externalAssets.mapCoverageDepth >= 56 &&
      externalAssets.mapCoverageArea >= 3136 &&
      externalAssets.bounds.width >= 56 &&
      externalAssets.bounds.depth >= 56 &&
      externalAssets.bounds.height >= 1 &&
      missingRoles.length === 0 &&
      weakScreenRoles.length === 0 &&
      weakHeroLocations.length === 0 &&
      unsafePaths.length === 0 &&
      (externalAssets.errors?.length ?? 0) === 0 &&
      proof.canvas.ok;

    if (gate) {
      pass("external-asset-map-composition", {
        externalAssets,
        heroLocationProofs,
        canvas: proof.canvas,
        mapUrl
      });
    } else {
      scenarioFail("external-asset-map-composition", "Accepted GLB assets are not yet arranged as a coherent map vocabulary layer.", {
        externalAssets,
        heroLocationProofs,
        canvas: proof.canvas,
        mapUrl,
        missingRoles,
        weakScreenRoles,
        weakHeroLocations,
        requiredHeroLocationRoles,
        unsafePaths,
        expectedAssetPathPrefixes
      });
    }
  } finally {
    if (!mapPage.isClosed()) {
      await mapPage.close();
    }
  }
}

async function collectExternalAssetHeroLocationProofs(page, zoneIds) {
  const proofs = [];
  for (const zoneId of zoneIds) {
    const label = `external-asset-hero-location:${zoneId}`;
    const actionability = await clickActionable(page, `.world-map [data-zone-jump="${zoneId}"]`, label, {
      minWidth: 30,
      minHeight: 30
    });
    if (!actionability) {
      const snapshot = await getQaSnapshot(page, { refresh: true });
      const proof = { zoneId, ok: false, actionability: null, activeZoneId: snapshot?.activeZoneId ?? null };
      proofs.push(proof);
      scenarioFail(label, "Hero location mini-map pin is not actionable in the GLB map proof.", proof);
      continue;
    }

    await page
      .waitForFunction((targetZoneId) => window.__IT_ART_STUDIO_QA__?.activeZoneId === targetZoneId, zoneId, { timeout: 10_000 })
      .catch(() => {});
    await page.waitForTimeout(420);
    const captureEntry = await capture(page, `external-asset-hero-location-${zoneId}`, {
      skipPremiumWorldDistribution: true
    });
    const snapshot = captureEntry.snapshot;
    const externalAssets = snapshot?.externalAssets;
    const rect = externalAssets?.heroLocationScreenRects?.[zoneId];
    const roles = externalAssets?.heroLocationRoles?.[zoneId] ?? [];
    const placementCount = externalAssets?.heroLocationPlacementCounts?.[zoneId] ?? 0;
    const ok =
      snapshot?.activeZoneId === zoneId &&
      placementCount >= 3 &&
      roles.length >= 3 &&
      rect?.visible === true &&
      rect.clippedArea >= 220 &&
      rect.visibleRatio >= 0.008 &&
      captureEntry.canvas.ok;
    const proof = {
      zoneId,
      ok,
      activeZoneId: snapshot?.activeZoneId ?? null,
      placementCount,
      roles,
      rect,
      canvas: captureEntry.canvas,
      capture: captureEntry.relativePath,
      actionability
    };
    proofs.push(proof);
    if (ok) {
      pass(label, proof);
    } else {
      scenarioFail(label, "Hero location GLB cluster is not visually readable in its map zone.", proof);
    }
  }
  return proofs;
}

async function checkRoverTrail(page, label) {
  const snapshot = await getQaSnapshot(page);
  const trail = snapshot?.trail;
  const hasTrailFeedback = trail && trail.totalMarks >= 18 && trail.activeMarks >= 3 && trail.maxOpacity >= 0.05;

  if (hasTrailFeedback) {
    pass(`rover-trail:${label}`, { trail, player: snapshot?.player });
  } else {
    scenarioFail(`rover-trail:${label}`, "Playable rover did not leave enough visible trail feedback.", {
      trail,
      player: snapshot?.player
    });
  }
}

async function checkAudioLayer(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "audio-layer");
  const selector = "[data-audio-toggle]";

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const actionability = await clickActionable(page, selector, "audio-toggle", {
      minWidth: 42,
      minHeight: 42
    });
    if (!actionability) {
      return;
    }

    await page.keyboard.down("ArrowUp");
    await page.waitForTimeout(520);
    const accelerationSnapshot = await getQaSnapshot(page, { refresh: true });
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(650);
    const driftSnapshot = await getQaSnapshot(page, { refresh: true });
    await releaseDriveKeys(page);
    await page.waitForTimeout(70);
    await page.keyboard.down("ArrowDown");
    const brakeSnapshots = [];
    const brakeStarted = Date.now();
    while (Date.now() - brakeStarted < 520) {
      await page.waitForTimeout(90);
      brakeSnapshots.push(await getQaSnapshot(page, { refresh: true }));
    }
    const brakeSnapshot = brakeSnapshots.at(-1) ?? (await getQaSnapshot(page, { refresh: true }));
    await releaseDriveKeys(page);
    await page.waitForTimeout(140);

    const waterTarget = {
      id: "audio-water-tech-harbor",
      position: { x: -8.4, z: -13.4 },
      radius: 0.46,
      timeoutMs: 12_000,
      skipPostReachSamples: true
    };
    const rampTarget = {
      id: "audio-ramp-tech-delta",
      position: { x: -6.7, z: -8.25 },
      radius: 0.78,
      timeoutMs: 12_000,
      skipPostReachSamples: true
    };
    const rampDrive = await driveWithRealKeyboard(page, rampTarget);
    await page.waitForTimeout(180);
    const rampSnapshot = await getQaSnapshot(page, { refresh: true });
    const waterDrive = await driveWithRealKeyboard(page, waterTarget);
    await page.waitForTimeout(180);
    const waterSnapshot = await getQaSnapshot(page, { refresh: true });
    const waterAudioSamples = waterDrive.samples.map((sample) => sample.audio).filter(Boolean);
    const rampAudioSamples = rampDrive.samples.map((sample) => sample.audio).filter(Boolean);
    const surfaceAudioSamples = [...waterAudioSamples, ...rampAudioSamples];
    const surfaceDriveSamples = [...waterDrive.samples, ...rampDrive.samples];
    const maxWaterGain = Math.max(...waterAudioSamples.map((audio) => audio.waterGain ?? 0), waterSnapshot?.audio?.waterGain ?? 0, 0);
    const maxWaterSurfaceFrequency = Math.max(
      ...waterAudioSamples.map((audio) => audio.surfaceFrequency ?? 0),
      waterSnapshot?.audio?.surfaceFrequency ?? 0,
      0
    );
    const maxRampGain = Math.max(...surfaceAudioSamples.map((audio) => audio.rampGain ?? 0), rampSnapshot?.audio?.rampGain ?? 0, 0);
    const maxRampSurfaceFrequency = Math.max(
      ...surfaceAudioSamples.map((audio) => audio.surfaceFrequency ?? 0),
      rampSnapshot?.audio?.surfaceFrequency ?? 0,
      0
    );
    const waterMaterialSamples = waterDrive.samples.filter((sample) => sample.drive?.material?.currentKind === "water").length;
    const rampMaterialSamples = surfaceDriveSamples.filter((sample) => sample.drive?.material?.currentKind === "ramp").length;

    const activeAudio = accelerationSnapshot?.audio;
    const driftAudio = driftSnapshot?.audio;
    const brakeAudioSamples = brakeSnapshots.map((snapshot) => snapshot?.audio).filter(Boolean);
    const maxBrakeGain = Math.max(...brakeAudioSamples.map((audio) => audio.brakeGain ?? 0), brakeSnapshot?.audio?.brakeGain ?? 0, 0);
    const brakingForwardSamples = brakeSnapshots.filter(
      (snapshot) =>
        (snapshot?.drive?.dynamics?.throttleInput ?? 0) < 0 &&
        (snapshot?.drive?.dynamics?.forwardSpeed ?? 0) >= 0.25
    ).length;
    const brakeAudio =
      brakeAudioSamples.reduce((best, audio) => ((audio.brakeGain ?? 0) > (best?.brakeGain ?? 0) ? audio : best), brakeSnapshot?.audio) ??
      brakeSnapshot?.audio;
    const waterAudio = waterSnapshot?.audio;
    const rampAudio = rampSnapshot?.audio;
    const zoneAudioTargets = [
      { zoneId: "ai-lab", kind: "tech", expectedSignature: "agent-lab-pulse" },
      { zoneId: "design-atelier", kind: "art", expectedSignature: "atelier-light-room" },
      { zoneId: "values-plaza", kind: "studio", expectedSignature: "shared-civic-chord" }
    ];
    const zoneAudioProofs = [];
    for (const target of zoneAudioTargets) {
      const click = await clickActionable(page, `.world-map [data-zone-jump="${target.zoneId}"]`, `audio-zone:${target.zoneId}`, {
        minWidth: 12,
        minHeight: 12
      });
      await page.waitForTimeout(420);
      const snapshot = await getQaSnapshot(page, { refresh: true });
      zoneAudioProofs.push({
        zoneId: target.zoneId,
        expectedKind: target.kind,
        expectedSignature: target.expectedSignature,
        clicked: Boolean(click),
        activeZoneId: snapshot?.activeZoneId ?? null,
        audio: snapshot?.audio ?? null
      });
    }
    const zoneAudioFrequencies = zoneAudioProofs.map((proof) => proof.audio?.ambienceFrequency ?? 0);
    const zoneAudioFrequencySpread =
      zoneAudioFrequencies.length > 0 ? Math.max(...zoneAudioFrequencies) - Math.min(...zoneAudioFrequencies) : 0;
    const zoneAudioSignatureIds = new Set(zoneAudioProofs.map((proof) => proof.audio?.zoneSignatureId).filter(Boolean));
    const activeOk =
      activeAudio?.supported === true &&
      activeAudio.initialized === true &&
      activeAudio.muted === false &&
      activeAudio.toggleVisible === true &&
      activeAudio.togglePressed === true &&
      ["running", "suspended"].includes(activeAudio.contextState) &&
      activeAudio.engineFrequency >= 80 &&
      activeAudio.engineGain > 0 &&
      activeAudio.ambienceGain > 0 &&
      activeAudio.accelerationGain >= 0.006;
    const zoneAudioOk =
      zoneAudioProofs.length === zoneAudioTargets.length &&
      zoneAudioSignatureIds.size === zoneAudioTargets.length &&
      zoneAudioFrequencySpread >= 16 &&
      zoneAudioProofs.every(
        (proof) =>
          proof.clicked === true &&
          proof.activeZoneId === proof.zoneId &&
          proof.audio?.muted === false &&
          proof.audio?.zoneSignatureKind === proof.expectedKind &&
          proof.audio?.zoneSignatureId === proof.expectedSignature &&
          (proof.audio?.ambienceGain ?? 0) >= 0.03 &&
          (proof.audio?.ambienceFrequency ?? 0) >= 40
      );
    const driftOk =
      driftAudio?.muted === false &&
      driftAudio.driftGain >= 0.008 &&
      (driftSnapshot?.drive?.dynamics?.driftAngle ?? 0) >= 0.08;
    const brakeOk =
      brakeAudio?.muted === false &&
      maxBrakeGain >= 0.008 &&
      brakingForwardSamples >= 1;
    const waterOk =
      (waterDrive.reached || (waterSnapshot?.drive?.material?.waterSamples ?? 0) >= 12) &&
      waterMaterialSamples >= 2 &&
      maxWaterGain >= 0.01 &&
      maxWaterSurfaceFrequency >= 88;
    const rampOk =
      (rampDrive.reached || (rampSnapshot?.drive?.material?.rampSamples ?? 0) >= 6) &&
      (rampMaterialSamples >= 1 || rampSnapshot?.drive?.material?.currentKind === "ramp") &&
      maxRampGain >= 0.008 &&
      maxRampSurfaceFrequency >= 105;

    await clickActionable(page, selector, "audio-toggle:mute", {
      minWidth: 42,
      minHeight: 42
    });
    await page.waitForTimeout(180);
    const mutedSnapshot = await getQaSnapshot(page, { refresh: true });
    const mutedAudio = mutedSnapshot?.audio;
    const mutedOk =
      mutedAudio?.initialized === true &&
      mutedAudio.muted === true &&
      mutedAudio.toggleVisible === true &&
      mutedAudio.togglePressed === false &&
      mutedAudio.engineGain <= 0.001 &&
      mutedAudio.driftGain <= 0.001 &&
      mutedAudio.ambienceGain <= 0.001 &&
      mutedAudio.accelerationGain <= 0.001 &&
      mutedAudio.waterGain <= 0.001 &&
      mutedAudio.rampGain <= 0.001 &&
      mutedAudio.brakeGain <= 0.001;

    if (activeOk && zoneAudioOk && driftOk && brakeOk && waterOk && rampOk && mutedOk) {
      pass("audio-layer", {
        actionability,
        activeAudio,
        zoneAudioProofs,
        zoneAudioFrequencySpread,
        driftAudio,
        brakeAudio,
        brakeAudioPeak: { maxBrakeGain, brakingForwardSamples },
        waterAudio,
        rampAudio,
        mutedAudio,
        waterDrive: { reached: waterDrive.reached, elapsedMs: waterDrive.elapsedMs },
        rampDrive: { reached: rampDrive.reached, elapsedMs: rampDrive.elapsedMs },
        surfaceAudio: { maxWaterGain, maxWaterSurfaceFrequency, maxRampGain, maxRampSurfaceFrequency, waterMaterialSamples, rampMaterialSamples }
      });
    } else {
      scenarioFail("audio-layer", "Procedural audio did not prove engine, acceleration, drift, brake, water, ramp, and mute layers.", {
        actionability,
        activeOk,
        zoneAudioOk,
        driftOk,
        brakeOk,
        waterOk,
        rampOk,
        mutedOk,
        activeAudio,
        zoneAudioProofs,
        zoneAudioFrequencySpread,
        driftAudio,
        brakeAudio,
        brakeAudioPeak: { maxBrakeGain, brakingForwardSamples, brakeSamples: brakeSnapshots.length },
        waterAudio,
        rampAudio,
        mutedAudio,
        waterDrive: { reached: waterDrive.reached, elapsedMs: waterDrive.elapsedMs, lastSamples: waterDrive.samples?.slice(-4) },
        rampDrive: { reached: rampDrive.reached, elapsedMs: rampDrive.elapsedMs, lastSamples: rampDrive.samples?.slice(-4) },
        surfaceAudio: { maxWaterGain, maxWaterSurfaceFrequency, maxRampGain, maxRampSurfaceFrequency, waterMaterialSamples, rampMaterialSamples },
        waterMaterial: waterSnapshot?.drive?.material,
        rampMaterial: rampSnapshot?.drive?.material
      });
    }
  } finally {
    await releaseDriveKeys(page);
    await page.close();
  }
}

async function checkSurfaceMaterialPhysics(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "surface-material-physics");

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const initial = await getQaSnapshot(page, { refresh: true });
    const rampTarget = {
      id: "surface-ramp-tech-delta",
      position: { x: -6.7, z: -8.25 },
      radius: 0.45,
      timeoutMs: 10_000,
      skipPostReachSamples: true
    };
    const waterTarget = {
      id: "surface-water-tech-harbor",
      position: { x: -8.4, z: -13.4 },
      radius: 0.42,
      timeoutMs: 12_000,
      skipPostReachSamples: true
    };
    const fieldTarget = {
      id: "surface-open-field",
      position: { x: -qaInnerRoamExtent, z: -qaInnerRoamExtent },
      radius: 1.2,
      timeoutMs: 12_000,
      overshootBrake: true,
      skipPostReachSamples: true
    };
    const waterDrive = await driveWithRealKeyboard(page, waterTarget);
    await page.waitForTimeout(140);
    const afterWater = await getQaSnapshot(page, { refresh: true });
    const rampDrive = await driveWithRealKeyboard(page, rampTarget);
    await page.waitForTimeout(140);
    const fieldDrive = await driveWithRealKeyboard(page, fieldTarget);
    await page.waitForTimeout(140);
    const final = await getQaSnapshot(page, { refresh: true });
    const material = final?.drive?.material;
    const physicsSamples = collectUniquePhysicsSamples([waterDrive, rampDrive, fieldDrive]);
    const waterSamples = physicsSamples.filter((sample) => sample.materialKind === "water");
    const rampSamples = physicsSamples.filter((sample) => sample.materialKind === "ramp");
    const fieldSamples = physicsSamples.filter((sample) => sample.materialKind === "field");
    const materialKinds = new Set(physicsSamples.map((sample) => sample.materialKind).filter(Boolean));
    const waterSpeedP80 = percentile(waterSamples.map((sample) => sample.speed ?? 0), 0.8);
    const rampRideP80 = percentile(rampSamples.map((sample) => Math.abs(sample.rideHeight ?? 0)), 0.8);
    const rampPitchP80 = percentile(rampSamples.map((sample) => Math.abs(sample.pitch ?? 0)), 0.8);
    const waterIntensityMax = Math.max(...waterSamples.map((sample) => sample.materialIntensity ?? 0), 0);
    const transitionDelta = (material?.materialTransitions ?? 0) - (initial?.drive?.material?.materialTransitions ?? 0);
    const emittedFxDelta = (material?.emittedFxMarks ?? 0) - (initial?.drive?.material?.emittedFxMarks ?? 0);
    const rampDriveProven = rampDrive.reached || (material?.rampSamples ?? 0) >= 18 || rampSamples.length >= 18;
    const waterDriveProven = waterDrive.reached || (material?.waterSamples ?? 0) >= 80;
    const fieldDriveProven = fieldDrive.reached || (fieldSamples.length >= 8 && materialKinds.has("field"));
    const waterWindowProven = waterSamples.length >= 8 && waterIntensityMax >= 0.12;
    const waterMaterialProven = (material?.waterSamples ?? 0) >= 80 && (material?.maxWaterIntensity ?? 0) >= 0.18;
    const rampWindowProven = rampSamples.length >= 4 && rampRideP80 >= 0.025 && rampPitchP80 >= 0.035;
    const rampMaterialProven = (material?.rampSamples ?? 0) >= 18 && (material?.maxRampRideHeight ?? 0) >= 0.065;
    const dynamicSurfaceFxProven =
      (material?.surfaceFxWaterProfiles ?? 0) >= 2 &&
      (material?.surfaceFxRampProfiles ?? 0) >= 2 &&
      (material?.surfaceFxColorVariants ?? 0) >= 4 &&
      (material?.surfaceFxSignatures ?? 0) >= 4 &&
      (material?.surfaceFxObjectCapacity ?? 0) === 28 &&
      (material?.maxSurfaceFxScaleVariance ?? 0) >= 0.42;
    const gate =
      rampDriveProven &&
      waterDriveProven &&
      fieldDriveProven &&
      final?.lastInputMode === "keyboard" &&
      material?.waterRegionCount >= 3 &&
      material?.rampRegionCount >= 5 &&
      material.waterSamples >= 8 &&
      material.rampSamples >= 4 &&
      material.fieldSamples >= 4 &&
      transitionDelta >= 2 &&
      materialKinds.has("field") &&
      material.maxWaterIntensity >= 0.18 &&
      material.maxRampRideHeight >= 0.035 &&
      (waterWindowProven || waterMaterialProven) &&
      (rampWindowProven || rampMaterialProven) &&
      emittedFxDelta >= 6 &&
      dynamicSurfaceFxProven &&
      waterSpeedP80 <= 10.5;

    if (gate) {
      pass("surface-material-physics", {
        rampDrive: {
          reached: rampDrive.reached,
          proven: rampDriveProven,
          elapsedMs: rampDrive.elapsedMs,
          sampleCount: rampDrive.samples?.length ?? 0
        },
        waterDrive: {
          reached: waterDrive.reached,
          proven: waterDriveProven,
          elapsedMs: waterDrive.elapsedMs,
          sampleCount: waterDrive.samples?.length ?? 0
        },
        fieldDrive: {
          reached: fieldDrive.reached,
          proven: fieldDriveProven,
          elapsedMs: fieldDrive.elapsedMs,
          sampleCount: fieldDrive.samples?.length ?? 0
        },
        material,
        transitionDelta,
        emittedFxDelta,
        waterSamples: waterSamples.length,
        rampSamples: rampSamples.length,
        fieldSamples: fieldSamples.length,
        materialKinds: [...materialKinds].sort(),
        waterSpeedP80: Number(waterSpeedP80.toFixed(3)),
        rampRideP80: Number(rampRideP80.toFixed(3)),
        rampPitchP80: Number(rampPitchP80.toFixed(3)),
        waterWindowProven,
        waterMaterialProven,
        rampWindowProven,
        rampMaterialProven,
        dynamicSurfaceFxProven,
        waterIntensityMax: Number(waterIntensityMax.toFixed(3)),
        afterWaterMaterial: afterWater?.drive?.material ?? null
      });
    } else {
      scenarioFail("surface-material-physics", "Water and ramps are not proven as playable physical materials.", {
        rampTarget,
        waterTarget,
        rampDrive: {
          reached: rampDrive.reached,
          proven: rampDriveProven,
          elapsedMs: rampDrive.elapsedMs,
          lastSamples: rampDrive.samples?.slice(-6)
        },
        waterDrive: {
          reached: waterDrive.reached,
          proven: waterDriveProven,
          elapsedMs: waterDrive.elapsedMs,
          lastSamples: waterDrive.samples?.slice(-6)
        },
        fieldDrive: {
          reached: fieldDrive.reached,
          proven: fieldDriveProven,
          elapsedMs: fieldDrive.elapsedMs,
          lastSamples: fieldDrive.samples?.slice(-6)
        },
        material,
        transitionDelta,
        emittedFxDelta,
        materialKinds: [...materialKinds].sort(),
        waterSamples: waterSamples.length,
        rampSamples: rampSamples.length,
        fieldSamples: fieldSamples.length,
        waterSpeedP80,
        rampRideP80,
        rampPitchP80,
        waterWindowProven,
        waterMaterialProven,
        rampWindowProven,
        rampMaterialProven,
        dynamicSurfaceFxProven,
        waterIntensityMax,
        afterWaterMaterial: afterWater?.drive?.material ?? null,
        final
      });
    }
  } finally {
    await releaseDriveKeys(page);
    await page.close();
  }
}

async function checkVehicleTerrainResponse(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, "vehicle-terrain-response");

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const waterTarget = {
      id: "terrain-water-tech-harbor",
      position: { x: -8.4, z: -13.4 },
      radius: 0.42,
      timeoutMs: 12_000,
      skipPostReachSamples: true
    };
    const rampTarget = {
      id: "terrain-ramp-tech-delta",
      position: { x: -6.7, z: -8.25 },
      radius: 0.55,
      timeoutMs: 10_000,
      overshootBrake: true,
      skipPostReachSamples: true
    };
    const artRampTarget = {
      id: "terrain-ramp-art-sweep",
      position: { x: 7.85, z: -6.2 },
      radius: 0.62,
      timeoutMs: 14_000,
      overshootBrake: true,
      skipPostReachSamples: true
    };
    const designTarget = {
      id: "terrain-design-atelier",
      zoneId: "design-atelier",
      position: { x: 10.8, z: -5.2 },
      radius: 2.4,
      timeoutMs: 10_000,
      overshootBrake: true
    };
    const waterDrive = await driveWithRealKeyboard(page, waterTarget);
    await page.waitForTimeout(120);
    const rampDrive = await driveWithRealKeyboard(page, rampTarget);
    await page.waitForTimeout(120);
    const artRampDrive = await driveWithRealKeyboard(page, artRampTarget);
    await page.waitForTimeout(120);
    const designDrive = await driveWithRealKeyboard(page, designTarget);
    await page.waitForTimeout(180);
    const final = await getQaSnapshot(page, { refresh: true });
    const material = final?.drive?.material;
    const vehicleFeel = final?.drive?.vehicleFeel ?? {};
    const physicsSamples = collectUniquePhysicsSamples([waterDrive, rampDrive, artRampDrive, designDrive]);
    const terrainSamples = physicsSamples.filter((sample) => Number.isFinite(sample.terrainHeight));
    const rampSamples = terrainSamples.filter((sample) => sample.materialKind === "ramp");
    const waterSamples = terrainSamples.filter((sample) => sample.materialKind === "water");
    const terrainHeights = terrainSamples.map((sample) => sample.terrainHeight ?? 0);
    const terrainGrades = terrainSamples.map((sample) => sample.terrainGrade ?? 0);
    const normalYs = terrainSamples.map((sample) => sample.terrainNormalY ?? 1);
    const groundDeltas = terrainSamples.map((sample) => sample.terrainGroundDelta ?? 0);
    const poseTilts = terrainSamples.map((sample) => Math.max(Math.abs(sample.pitch ?? 0), Math.abs(sample.roll ?? 0)));
    const featureIds = new Set(terrainSamples.map((sample) => sample.terrainFeatureId).filter(Boolean));
    const heightSpan = terrainHeights.length > 0 ? Math.max(...terrainHeights) - Math.min(...terrainHeights) : 0;
    const maxGrade = Math.max(...terrainGrades, 0);
    const minNormalY = Math.min(...normalYs, 1);
    const maxPoseTilt = Math.max(...poseTilts, 0);
    const groundDeltaP05 = percentile(groundDeltas, 0.05);
    const groundDeltaP95 = percentile(groundDeltas, 0.95);
    const groundDeltaSpan = groundDeltaP95 - groundDeltaP05;
    const terrainGradeTiltSamples = terrainSamples.filter(
      (sample) => (sample.terrainGrade ?? 0) >= 0.025 && Math.max(Math.abs(sample.pitch ?? 0), Math.abs(sample.roll ?? 0)) >= 0.018
    ).length;
    const terrainRouteProven =
      (waterDrive.reached || waterSamples.length >= 8) &&
      (rampDrive.reached || artRampDrive.reached || rampSamples.length >= 4) &&
      (designDrive.reached || terrainSamples.length >= 500) &&
      featureIds.size >= 2;
    const terrainGate =
      terrainRouteProven &&
      final?.lastInputMode === "keyboard" &&
      terrainSamples.length >= 120 &&
      (material?.terrainSamples ?? 0) >= 120 &&
      heightSpan >= 0.16 &&
      maxGrade >= 0.035 &&
      minNormalY <= 0.999 &&
      maxPoseTilt >= 0.035 &&
      terrainGradeTiltSamples >= 8 &&
      featureIds.size >= 2 &&
      groundDeltaP05 >= 0.18 &&
      groundDeltaP95 <= 0.58 &&
      groundDeltaSpan <= 0.32 &&
      (material?.maxTerrainHeight ?? 0) - (material?.minTerrainHeight ?? 0) >= 0.22 &&
      (material?.maxTerrainGrade ?? 0) >= 0.035;
    const suspensionGate =
      terrainGate &&
      (vehicleFeel.peakSuspensionCompression ?? 0) >= 0.055 &&
      (vehicleFeel.suspensionTravelSamples ?? 0) >= 24 &&
      (vehicleFeel.suspensionTravelVariance ?? 0) >= 0.018 &&
      (vehicleFeel.wheelTerrainContactSpan ?? 0) >= 0.025;

    const details = {
      reached: terrainRouteProven,
      elapsedMs: waterDrive.elapsedMs + rampDrive.elapsedMs + artRampDrive.elapsedMs + designDrive.elapsedMs,
      sampleCount: terrainSamples.length,
      terrainRouteProven,
      material,
      waterSampleCount: waterSamples.length,
      rampSampleCount: rampSamples.length,
      heightSpan: Number(heightSpan.toFixed(3)),
      maxGrade: Number(maxGrade.toFixed(3)),
      minNormalY: Number(minNormalY.toFixed(3)),
      maxPoseTilt: Number(maxPoseTilt.toFixed(3)),
      terrainGradeTiltSamples,
      featureIds: [...featureIds].sort(),
      groundDeltaP05: Number(groundDeltaP05.toFixed(3)),
      groundDeltaP95: Number(groundDeltaP95.toFixed(3)),
      groundDeltaSpan: Number(groundDeltaSpan.toFixed(3)),
      vehicleFeel,
      suspensionGate,
      finalPlayer: final?.player,
      routeSteps: [
        { step: waterTarget.id, reached: waterDrive.reached, samples: waterDrive.samples.length },
        { step: rampTarget.id, reached: rampDrive.reached, samples: rampDrive.samples.length },
        { step: artRampTarget.id, reached: artRampDrive.reached, samples: artRampDrive.samples.length },
        { step: designTarget.id, reached: designDrive.reached, samples: designDrive.samples.length }
      ]
    };

    if (terrainGate) {
      pass("vehicle-terrain-response", details);
    } else {
      scenarioFail("vehicle-terrain-response", "Vehicle pose does not prove response to shared terrain height and normals.", {
        ...details,
        lastSamples: terrainSamples.slice(-8)
      });
    }
    if (suspensionGate) {
      pass("vehicle-suspension-response", {
        ...details,
        peakSuspensionCompression: vehicleFeel.peakSuspensionCompression,
        suspensionTravelSamples: vehicleFeel.suspensionTravelSamples,
        suspensionTravelVariance: vehicleFeel.suspensionTravelVariance,
        wheelTerrainContactSpan: vehicleFeel.wheelTerrainContactSpan
      });
    } else {
      scenarioFail("vehicle-suspension-response", "Rover suspension does not visibly respond to terrain, ramp and water traversal.", {
        ...details,
        lastSamples: terrainSamples.slice(-8)
      });
    }
  } finally {
    await releaseDriveKeys(page);
    await page.close();
  }
}

async function checkFrameBudget(page) {
  const snapshot = await getQaSnapshot(page);
  const stats = {
    frameCount: snapshot?.frameCount ?? 0,
    averageFrameMs: snapshot?.averageFrameMs ?? 0,
    approxFps: snapshot?.averageFrameMs ? Number((1000 / snapshot.averageFrameMs).toFixed(1)) : 0
  };

  if (stats.frameCount > 0 && stats.averageFrameMs > 0) {
    pass("performance:telemetry", stats);
  } else {
    scenarioFail("performance:telemetry", "Frame telemetry is missing from the playable world.", stats);
  }
}

async function checkRuntimeFrameBudget(page, label = "runtime") {
  await page.waitForTimeout(1_200);
  const sampleFrameBudget = async () => {
    const before = await getQaSnapshot(page);
    const started = Date.now();
    await page.waitForTimeout(6_000);
    const after = await getQaSnapshot(page);
    const durationMs = Date.now() - started;
    const beforeFrameCount = before?.frameCount ?? 0;
    const afterFrameCount = after?.frameCount ?? 0;
    const frameDelta = Math.max(0, afterFrameCount - beforeFrameCount);
    const avgFrameMs = frameDelta > 0 ? durationMs / frameDelta : 0;
    const approxFps = durationMs > 0 ? frameDelta / (durationMs / 1_000) : 0;
    return {
      durationMs,
      beforeFrameCount,
      afterFrameCount,
      frameDelta,
      avgFrameMs: Number(avgFrameMs.toFixed(2)),
      approxFps: Number(approxFps.toFixed(1)),
      snapshotAverageFrameMs: Number((after?.averageFrameMs ?? 0).toFixed(2))
    };
  };

  const withinBudget = (stats) => stats.frameDelta >= 85 && stats.approxFps >= 14 && stats.avgFrameMs <= 75;
  const firstStats = await sampleFrameBudget();
  if (withinBudget(firstStats)) {
    pass(`performance:${label}-frame-budget`, firstStats);
    return;
  }

  await page.waitForTimeout(900);
  const retryStats = await sampleFrameBudget();
  if (withinBudget(retryStats)) {
    pass(`performance:${label}-frame-budget`, {
      ...retryStats,
      recoveredAfterRetry: true,
      firstAttempt: firstStats
    });
  } else {
    scenarioFail(`performance:${label}-frame-budget`, "Runtime frame budget exceeded during live QA sampling.", {
      ...retryStats,
      firstAttempt: firstStats
    });
  }
}

async function inspectCameraSafeArea(page, label) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  const screenState = await page.evaluate((qa) => {
    const selectors = [".game-hud", ".zone-panel", ".world-map", ".mobile-drive", ".mobile-zone-nav"];
    const uiRects = selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0 ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return null;
        }
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

    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const insideFrame = (point, marginRatio) =>
      Boolean(point) &&
      point.visible === true &&
      point.x >= viewport.width * marginRatio &&
      point.x <= viewport.width * (1 - marginRatio) &&
      point.y >= viewport.height * marginRatio &&
      point.y <= viewport.height * (1 - marginRatio);
    const occludersFor = (point, padding = 12) => {
      if (!point) {
        return [];
      }
      return uiRects
        .filter(
          (rect) =>
            point.x >= rect.left - padding &&
            point.x <= rect.right + padding &&
            point.y >= rect.top - padding &&
            point.y <= rect.bottom + padding
        )
        .map((rect) => rect.selector);
    };

    const player = qa?.screen?.player ?? null;
    const activeZone = qa?.screen?.activeZone ?? null;
    return {
      viewport,
      uiRects,
      player,
      activeZone,
      playerInFrame: insideFrame(player, 0.08),
      activeZoneInFrame: insideFrame(activeZone, 0.04),
      playerOccluders: occludersFor(player, 14),
      activeZoneOccluders: occludersFor(activeZone, 10),
      camera: qa?.camera ?? null,
      driveCameraDistance: qa?.drive?.cameraDistance ?? null,
      activeZoneId: qa?.activeZoneId ?? null,
      frameCount: qa?.frameCount ?? 0
    };
  }, snapshot);

  const cameraLag = screenState.camera?.lag ?? Number.POSITIVE_INFINITY;
  const cameraDistance = screenState.camera?.distanceToPlayer ?? screenState.driveCameraDistance ?? 0;
  const ok =
    screenState.playerInFrame &&
    screenState.activeZoneInFrame &&
    screenState.playerOccluders.length === 0 &&
    screenState.activeZoneOccluders.length === 0 &&
    cameraLag <= 5.8 &&
    cameraDistance >= 10 &&
    cameraDistance <= 18;

  if (ok) {
    pass(`camera-safe-area:${label}`, {
      activeZoneId: screenState.activeZoneId,
      player: screenState.player,
      activeZone: screenState.activeZone,
      camera: screenState.camera,
      uiRects: screenState.uiRects.map((rect) => rect.selector)
    });
  } else {
    scenarioFail(`camera-safe-area:${label}`, "Camera framing does not keep the playable subject and active zone readable.", {
      ...screenState,
      cameraLagLimit: 5.8,
      cameraDistanceRange: [10, 18]
    });
  }

  return ok;
}

async function inspectSignatureArtifactVisibility(page, label) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  const state = await page.evaluate((qa) => {
    const round = (value, digits = 3) => Number(value.toFixed(digits));
    const intersectArea = (a, b) => {
      const left = Math.max(a.left, b.left);
      const right = Math.min(a.right, b.right);
      const top = Math.max(a.top, b.top);
      const bottom = Math.min(a.bottom, b.bottom);
      return Math.max(0, right - left) * Math.max(0, bottom - top);
    };
    const sampleCanvasRoi = (artifact) => {
      const canvas = document.querySelector("#studio-map-canvas");
      if (!(canvas instanceof HTMLCanvasElement) || !artifact || artifact.clippedWidth <= 1 || artifact.clippedHeight <= 1) {
        return {
          sampled: false,
          roiWidth: 0,
          roiHeight: 0,
          brightRatio: 0,
          edgeTransitions: 0,
          colorBuckets: 0
        };
      }

      const canvasRect = canvas.getBoundingClientRect();
      const sourceLeft = Math.max(0, artifact.clippedX - canvasRect.left);
      const sourceTop = Math.max(0, artifact.clippedY - canvasRect.top);
      const sourceWidth = Math.min(artifact.clippedWidth, canvasRect.width - sourceLeft);
      const sourceHeight = Math.min(artifact.clippedHeight, canvasRect.height - sourceTop);
      if (sourceWidth <= 1 || sourceHeight <= 1) {
        return {
          sampled: false,
          roiWidth: 0,
          roiHeight: 0,
          brightRatio: 0,
          edgeTransitions: 0,
          colorBuckets: 0
        };
      }

      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      const sx = Math.max(0, Math.floor(sourceLeft * scaleX));
      const sy = Math.max(0, Math.floor(sourceTop * scaleY));
      const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(sourceWidth * scaleX)));
      const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(sourceHeight * scaleY)));
      const roiWidth = Math.max(24, Math.min(128, Math.round(sourceWidth)));
      const roiHeight = Math.max(24, Math.min(128, Math.round(sourceHeight)));
      const roi = document.createElement("canvas");
      roi.width = roiWidth;
      roi.height = roiHeight;
      const ctx = roi.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        return {
          sampled: false,
          roiWidth,
          roiHeight,
          brightRatio: 0,
          edgeTransitions: 0,
          colorBuckets: 0
        };
      }

      let pixels;
      try {
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, roiWidth, roiHeight);
        pixels = ctx.getImageData(0, 0, roiWidth, roiHeight).data;
      } catch (error) {
        return {
          sampled: false,
          error: error instanceof Error ? error.message : String(error),
          roiWidth,
          roiHeight,
          brightRatio: 0,
          edgeTransitions: 0,
          colorBuckets: 0
        };
      }

      let brightPixels = 0;
      const buckets = new Set();
      const luminanceGrid = [];
      for (let y = 0; y < roiHeight; y += 1) {
        const row = [];
        for (let x = 0; x < roiWidth; x += 1) {
          const index = (y * roiWidth + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          row.push(luminance);
          if (luminance >= 72) {
            brightPixels += 1;
          }
          buckets.add(`${Math.floor(r / 32)}:${Math.floor(g / 32)}:${Math.floor(b / 32)}`);
        }
        luminanceGrid.push(row);
      }

      let edgeTransitions = 0;
      const step = Math.max(2, Math.floor(Math.min(roiWidth, roiHeight) / 28));
      for (let y = step; y < roiHeight; y += step) {
        for (let x = step; x < roiWidth; x += step) {
          if (Math.abs(luminanceGrid[y][x] - luminanceGrid[y][x - step]) >= 18) {
            edgeTransitions += 1;
          }
          if (Math.abs(luminanceGrid[y][x] - luminanceGrid[y - step][x]) >= 18) {
            edgeTransitions += 1;
          }
        }
      }

      return {
        sampled: true,
        roiWidth,
        roiHeight,
        brightRatio: round(brightPixels / (roiWidth * roiHeight)),
        edgeTransitions,
        colorBuckets: buckets.size
      };
    };
    const selectors = [".game-hud", ".zone-panel", ".world-map", ".mobile-drive", ".mobile-zone-nav"];
    const uiRects = selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0 ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return null;
        }
        return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter(Boolean);
    const artifact = qa?.screen?.activeSignatureArtifact ?? null;
    const zone = (qa?.world?.zones ?? []).find((item) => item.id === qa?.activeZoneId) ?? null;
    const center = artifact?.center ?? null;
    const centerOccluders = center
      ? uiRects
          .filter(
            (rect) =>
              center.x >= rect.left - 12 &&
              center.x <= rect.right + 12 &&
              center.y >= rect.top - 12 &&
              center.y <= rect.bottom + 12
          )
          .map((rect) => rect.selector)
      : [];
    const artifactRect = artifact
      ? {
          left: artifact.clippedX ?? artifact.x,
          top: artifact.clippedY ?? artifact.y,
          right: (artifact.clippedX ?? artifact.x) + (artifact.clippedWidth ?? artifact.width),
          bottom: (artifact.clippedY ?? artifact.y) + (artifact.clippedHeight ?? artifact.height)
        }
      : null;
    const uiOccludedArea = artifactRect
      ? uiRects.reduce((sum, rect) => sum + intersectArea(artifactRect, rect), 0)
      : 0;
    const clippedArea = artifact?.clippedArea ?? artifact?.area ?? 0;
    const uiOccludedRatio = clippedArea > 0 ? Math.min(1, uiOccludedArea / clippedArea) : 1;
    const visibleRatio = artifact?.visibleRatio ?? 0;
    const visibleAfterUiRatio = Math.max(0, visibleRatio * (1 - uiOccludedRatio));
    const roi = sampleCanvasRoi(artifact);
    return {
      activeZoneId: qa?.activeZoneId ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      artifact,
      zone,
      centerOccluders,
      uiRects: uiRects.map((rect) => rect.selector),
      uiOccludedArea: round(uiOccludedArea, 1),
      uiOccludedRatio: round(uiOccludedRatio),
      visibleAfterUiRatio: round(visibleAfterUiRatio),
      roi
    };
  }, snapshot);

  const isMobile = state.viewport.width <= 820;
  const minWidth = isMobile ? 34 : 48;
  const minHeight = isMobile ? 34 : 58;
  const minArea = isMobile ? 850 : 2_200;
  const minVisibleRatio = isMobile ? 0.5 : 0.68;
  const maxUiOccludedRatio = isMobile ? 0.28 : 0.14;
  const minVisibleAfterUiRatio = isMobile ? 0.45 : 0.58;
  const minBrightRatio = isMobile ? 0.06 : 0.08;
  const minEdgeTransitions = state.artifact?.area >= 3_200 ? 14 : 8;
  const minColorBuckets = state.artifact?.area >= 3_200 ? 8 : 5;
  const ok =
    state.artifact?.visible === true &&
    state.artifact?.center?.visible === true &&
    (state.artifact?.visibleRatio ?? 0) >= minVisibleRatio &&
    (state.artifact?.cornerDepthCount ?? 0) >= 2 &&
    state.artifact.width >= minWidth &&
    state.artifact.height >= minHeight &&
    state.artifact.area >= minArea &&
    state.centerOccluders.length === 0 &&
    state.uiOccludedRatio <= maxUiOccludedRatio &&
    state.visibleAfterUiRatio >= minVisibleAfterUiRatio &&
    state.roi.sampled === true &&
    state.roi.brightRatio >= minBrightRatio &&
    state.roi.edgeTransitions >= minEdgeTransitions &&
    state.roi.colorBuckets >= minColorBuckets &&
    (state.zone?.signatureArtifactObjects ?? 0) >= 4 &&
    (state.zone?.signatureArtifactSignatures?.length ?? 0) >= 4 &&
    (state.zone?.signatureArtifactRoles?.length ?? 0) >= 3 &&
    (state.zone?.signatureArtifactFamilies?.length ?? 0) >= 1;

  if (ok) {
    pass(`signature-artifact-visible:${label}`, {
      activeZoneId: state.activeZoneId,
      artifact: state.artifact,
      uiOccludedRatio: state.uiOccludedRatio,
      visibleAfterUiRatio: state.visibleAfterUiRatio,
      roi: state.roi,
      signatureArtifactObjects: state.zone.signatureArtifactObjects,
      signatureArtifactFamilies: state.zone.signatureArtifactFamilies,
      signatureArtifactRoles: state.zone.signatureArtifactRoles.length,
      thresholds: {
        minWidth,
        minHeight,
        minArea,
        minVisibleRatio,
        maxUiOccludedRatio,
        minVisibleAfterUiRatio,
        minBrightRatio,
        minEdgeTransitions,
        minColorBuckets
      }
    });
  } else {
    scenarioFail(`signature-artifact-visible:${label}`, "Active signature artifact is not visually readable.", {
      ...state,
      minWidth,
      minHeight,
      minArea,
      minVisibleRatio,
      maxUiOccludedRatio,
      minVisibleAfterUiRatio,
      minBrightRatio,
      minEdgeTransitions,
      minColorBuckets
    });
  }

  return ok;
}

async function inspectProjectArtifactVisibility(page, label) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  const state = await page.evaluate((qa) => {
    const round = (value, digits = 3) => Number(value.toFixed(digits));
    const intersectArea = (a, b) => {
      const left = Math.max(a.left, b.left);
      const right = Math.min(a.right, b.right);
      const top = Math.max(a.top, b.top);
      const bottom = Math.min(a.bottom, b.bottom);
      return Math.max(0, right - left) * Math.max(0, bottom - top);
    };
    const rectFrom = (rect) =>
      rect
        ? {
            left: rect.clippedX ?? rect.x,
            top: rect.clippedY ?? rect.y,
            right: (rect.clippedX ?? rect.x) + (rect.clippedWidth ?? rect.width),
            bottom: (rect.clippedY ?? rect.y) + (rect.clippedHeight ?? rect.height),
            area: rect.clippedArea ?? rect.area ?? 0,
            center: rect.center ?? null
          }
        : null;
    const suspiciousOverlap = (source, candidate) => {
      const sourceRect = rectFrom(source);
      const candidateRect = rectFrom(candidate);
      if (!sourceRect || !candidateRect || sourceRect.area <= 0 || candidateRect.area <= 0) {
        return false;
      }
      const intersection = intersectArea(sourceRect, candidateRect);
      const union = sourceRect.area + candidateRect.area - intersection;
      const iou = union > 0 ? intersection / union : 0;
      const centerDistance =
        sourceRect.center && candidateRect.center
          ? Math.hypot(sourceRect.center.x - candidateRect.center.x, sourceRect.center.y - candidateRect.center.y)
          : 999;
      return iou >= 0.9 && centerDistance <= 6;
    };
    const sampleCanvasRoi = (artifact) => {
      const canvas = document.querySelector("#studio-map-canvas");
      if (!(canvas instanceof HTMLCanvasElement) || !artifact || artifact.clippedWidth <= 1 || artifact.clippedHeight <= 1) {
        return { sampled: false, brightRatio: 0, edgeTransitions: 0, colorBuckets: 0, roiWidth: 0, roiHeight: 0 };
      }

      const canvasRect = canvas.getBoundingClientRect();
      const sourceLeft = Math.max(0, artifact.clippedX - canvasRect.left);
      const sourceTop = Math.max(0, artifact.clippedY - canvasRect.top);
      const sourceWidth = Math.min(artifact.clippedWidth, canvasRect.width - sourceLeft);
      const sourceHeight = Math.min(artifact.clippedHeight, canvasRect.height - sourceTop);
      if (sourceWidth <= 1 || sourceHeight <= 1) {
        return { sampled: false, brightRatio: 0, edgeTransitions: 0, colorBuckets: 0, roiWidth: 0, roiHeight: 0 };
      }

      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      const sx = Math.max(0, Math.floor(sourceLeft * scaleX));
      const sy = Math.max(0, Math.floor(sourceTop * scaleY));
      const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(sourceWidth * scaleX)));
      const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(sourceHeight * scaleY)));
      const roiWidth = Math.max(18, Math.min(96, Math.round(sourceWidth)));
      const roiHeight = Math.max(18, Math.min(96, Math.round(sourceHeight)));
      const roi = document.createElement("canvas");
      roi.width = roiWidth;
      roi.height = roiHeight;
      const ctx = roi.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        return { sampled: false, brightRatio: 0, edgeTransitions: 0, colorBuckets: 0, roiWidth, roiHeight };
      }

      let pixels;
      try {
        ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, roiWidth, roiHeight);
        pixels = ctx.getImageData(0, 0, roiWidth, roiHeight).data;
      } catch (error) {
        return {
          sampled: false,
          error: error instanceof Error ? error.message : String(error),
          brightRatio: 0,
          edgeTransitions: 0,
          colorBuckets: 0,
          roiWidth,
          roiHeight
        };
      }

      let brightPixels = 0;
      let edgeTransitions = 0;
      const buckets = new Set();
      const lumas = [];
      for (let y = 0; y < roiHeight; y += 1) {
        for (let x = 0; x < roiWidth; x += 1) {
          const index = (y * roiWidth + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lumas.push(luminance);
          if (luminance >= 64) {
            brightPixels += 1;
          }
          buckets.add(`${Math.floor(r / 36)}:${Math.floor(g / 36)}:${Math.floor(b / 36)}`);
        }
      }
      const step = Math.max(2, Math.floor(Math.min(roiWidth, roiHeight) / 24));
      for (let y = step; y < roiHeight; y += step) {
        for (let x = step; x < roiWidth; x += step) {
          const index = y * roiWidth + x;
          if (Math.abs(lumas[index] - lumas[index - step]) >= 16) {
            edgeTransitions += 1;
          }
          if (Math.abs(lumas[index] - lumas[index - step * roiWidth]) >= 16) {
            edgeTransitions += 1;
          }
        }
      }

      return {
        sampled: true,
        brightRatio: round(brightPixels / (roiWidth * roiHeight)),
        edgeTransitions,
        colorBuckets: buckets.size,
        roiWidth,
        roiHeight
      };
    };

    const selectors = [".game-hud", ".zone-panel", ".world-map", ".mobile-drive", ".mobile-zone-nav"];
    const uiRects = selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0 ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return null;
        }
        return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter(Boolean);

    const artifact = qa?.screen?.activeProjectArtifact ?? null;
    const zone = (qa?.world?.zones ?? []).find((item) => item.id === qa?.activeZoneId) ?? null;
    const siblingOverlaps = [
      ["landmark", qa?.screen?.activeLandmark ?? null],
      ["placeArchitecture", qa?.screen?.activePlaceArchitecture ?? null],
      ["signatureArtifact", qa?.screen?.activeSignatureArtifact ?? null]
    ]
      .filter(([, candidate]) => suspiciousOverlap(artifact, candidate))
      .map(([name]) => name);
    const center = artifact?.center ?? null;
    const centerOccluders = center
      ? uiRects
          .filter(
            (rect) =>
              center.x >= rect.left - 10 &&
              center.x <= rect.right + 10 &&
              center.y >= rect.top - 10 &&
              center.y <= rect.bottom + 10
          )
          .map((rect) => rect.selector)
      : [];
    const artifactRect = artifact
      ? {
          left: artifact.clippedX ?? artifact.x,
          top: artifact.clippedY ?? artifact.y,
          right: (artifact.clippedX ?? artifact.x) + (artifact.clippedWidth ?? artifact.width),
          bottom: (artifact.clippedY ?? artifact.y) + (artifact.clippedHeight ?? artifact.height)
        }
      : null;
    const uiOccludedArea = artifactRect ? uiRects.reduce((sum, rect) => sum + intersectArea(artifactRect, rect), 0) : 0;
    const clippedArea = artifact?.clippedArea ?? artifact?.area ?? 0;
    const uiOccludedRatio = clippedArea > 0 ? Math.min(1, uiOccludedArea / clippedArea) : 1;
    const visibleRatio = artifact?.visibleRatio ?? 0;
    const visibleAfterUiRatio = Math.max(0, visibleRatio * (1 - uiOccludedRatio));
    const roi = sampleCanvasRoi(artifact);

    return {
      activeZoneId: qa?.activeZoneId ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      artifact,
      zone,
      siblingOverlaps,
      centerOccluders,
      uiOccludedArea: round(uiOccludedArea, 1),
      uiOccludedRatio: round(uiOccludedRatio),
      visibleAfterUiRatio: round(visibleAfterUiRatio),
      roi
    };
  }, snapshot);

  const isMobile = state.viewport.width <= 820;
  const minWidth = isMobile ? 18 : 22;
  const minHeight = isMobile ? 8 : 10;
  const minArea = isMobile ? 180 : 320;
  const minVisibleRatio = isMobile ? 0.34 : 0.42;
  const maxUiOccludedRatio = isMobile ? 0.45 : 0.28;
  const minVisibleAfterUiRatio = isMobile ? 0.28 : 0.36;
  const minBrightRatio = isMobile ? 0.025 : 0.035;
  const minEdgeTransitions = isMobile ? 3 : 4;
  const minColorBuckets = 3;
  const maxAreaRatio = isMobile ? 0.1 : 0.06;
  const viewportArea = state.viewport.width * state.viewport.height;
  const artifactAreaRatio = viewportArea > 0 ? (state.artifact?.clippedArea ?? 0) / viewportArea : 1;
  const mobilePanelCenterTolerated =
    isMobile &&
    state.centerOccluders.length === 1 &&
    state.centerOccluders[0] === ".zone-panel" &&
    state.uiOccludedRatio <= 0.52 &&
    state.visibleAfterUiRatio >= 0.48 &&
    state.roi.sampled === true &&
    state.roi.edgeTransitions >= 20 &&
    state.roi.colorBuckets >= 8;
  const narrowViewportOcclusionTolerated =
    (label.includes("reduced-motion") || state.viewport.width <= 1100) &&
    (state.centerOccluders.length === 0 ||
      (state.centerOccluders.length === 1 && state.centerOccluders[0] === ".zone-panel")) &&
    state.uiOccludedRatio <= 0.42 &&
    state.visibleAfterUiRatio >= 0.58 &&
    state.roi.sampled === true &&
    state.roi.brightRatio >= 0.12 &&
    state.roi.edgeTransitions >= 20 &&
    state.roi.colorBuckets >= 8;
  const uiOcclusionOk = state.uiOccludedRatio <= maxUiOccludedRatio || mobilePanelCenterTolerated || narrowViewportOcclusionTolerated;
  const ok =
    state.artifact?.visible === true &&
    state.artifact?.center?.visible === true &&
    (state.artifact?.visibleRatio ?? 0) >= minVisibleRatio &&
    (state.artifact?.cornerDepthCount ?? 0) >= 2 &&
    state.artifact.width >= minWidth &&
    state.artifact.height >= minHeight &&
    state.artifact.clippedArea >= minArea &&
    artifactAreaRatio <= maxAreaRatio &&
    (state.centerOccluders.length === 0 || mobilePanelCenterTolerated || narrowViewportOcclusionTolerated) &&
    state.siblingOverlaps.length === 0 &&
    uiOcclusionOk &&
    state.visibleAfterUiRatio >= minVisibleAfterUiRatio &&
    state.roi.sampled === true &&
    state.roi.brightRatio >= minBrightRatio &&
    state.roi.edgeTransitions >= minEdgeTransitions &&
    state.roi.colorBuckets >= minColorBuckets &&
    (state.zone?.projectArtifactObjects ?? 0) >= 2 &&
    (state.zone?.projectArtifactSceneObjects ?? 0) === 1 &&
    (state.zone?.projectArtifactActivityTypes?.length ?? 0) >= 1 &&
    (state.zone?.projectArtifactSignatures?.length ?? 0) >= (state.zone?.projectArtifactObjects ?? 0) &&
    (state.zone?.projectArtifactMaterials?.length ?? 0) >= 2;

  const details = {
    ...state,
    artifactAreaRatio: Number(artifactAreaRatio.toFixed(3)),
    mobilePanelCenterTolerated,
    narrowViewportOcclusionTolerated,
    uiOcclusionOk,
    thresholds: {
      minWidth,
      minHeight,
      minArea,
      minVisibleRatio,
      maxUiOccludedRatio,
      minVisibleAfterUiRatio,
      minBrightRatio,
      minEdgeTransitions,
      minColorBuckets,
      maxAreaRatio
    }
  };
  if (state.activeZoneId) {
    projectArtifactProofs.set(state.activeZoneId, details);
  }

  if (ok) {
    pass(`project-artifact-visible:${label}`, {
      activeZoneId: details.activeZoneId,
      artifact: details.artifact,
      uiOccludedRatio: details.uiOccludedRatio,
      visibleAfterUiRatio: details.visibleAfterUiRatio,
      artifactAreaRatio: details.artifactAreaRatio,
      roi: details.roi,
      projectArtifactObjects: state.zone.projectArtifactObjects,
      projectArtifactActivityTypes: state.zone.projectArtifactActivityTypes,
      thresholds: details.thresholds
    });
  } else {
    scenarioFail(`project-artifact-visible:${label}`, "Active project artifact kit is not visually readable.", {
      ...details
    });
  }

  return ok;
}

async function inspectIdentityRibbonVisibility(page, label) {
  const collect = async () =>
    page.evaluate(() => {
      if (typeof window.__IT_ART_STUDIO_QA_REFRESH__ === "function") {
        window.__IT_ART_STUDIO_QA_REFRESH__();
      }
      const qa = window.__IT_ART_STUDIO_QA__;
      const round = (value, digits = 3) => Number(value.toFixed(digits));
      const ribbon = qa?.screen?.identityRibbon ?? null;
      const selectors = [".game-hud", ".zone-panel", ".world-map", ".mobile-drive", ".mobile-zone-nav"];
      const uiRects = selectors
        .map((selector) => {
          const node = document.querySelector(selector);
          if (!(node instanceof HTMLElement)) {
            return null;
          }
          const style = getComputedStyle(node);
          const rect = node.getBoundingClientRect();
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            Number(style.opacity) === 0 ||
            rect.width === 0 ||
            rect.height === 0
          ) {
            return null;
          }
          return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        })
        .filter(Boolean);
      const intersectArea = (a, b) => {
        const left = Math.max(a.left, b.left);
        const right = Math.min(a.right, b.right);
        const top = Math.max(a.top, b.top);
        const bottom = Math.min(a.bottom, b.bottom);
        return Math.max(0, right - left) * Math.max(0, bottom - top);
      };
      const ribbonRect = ribbon
        ? {
            left: ribbon.clippedX ?? ribbon.x,
            top: ribbon.clippedY ?? ribbon.y,
            right: (ribbon.clippedX ?? ribbon.x) + (ribbon.clippedWidth ?? ribbon.width),
            bottom: (ribbon.clippedY ?? ribbon.y) + (ribbon.clippedHeight ?? ribbon.height)
          }
        : null;
      const clippedArea = ribbon?.clippedArea ?? ribbon?.area ?? 0;
      const uiOccludedArea = ribbonRect ? uiRects.reduce((sum, rect) => sum + intersectArea(ribbonRect, rect), 0) : 0;
      const uiOccludedRatio = clippedArea > 0 ? Math.min(1, uiOccludedArea / clippedArea) : 1;
      const visibleAfterUiRatio = Math.max(0, (ribbon?.visibleRatio ?? 0) * (1 - uiOccludedRatio));
      const sampleCanvasRoi = () => {
        const canvas = document.querySelector("#studio-map-canvas");
        if (!(canvas instanceof HTMLCanvasElement) || !ribbon || ribbon.clippedWidth <= 1 || ribbon.clippedHeight <= 1) {
          return { sampled: false, brightRatio: 0, edgeDensity: 0, edgeTransitions: 0, colorBuckets: 0 };
        }
        const canvasRect = canvas.getBoundingClientRect();
        const sourceLeft = Math.max(0, ribbon.clippedX - canvasRect.left);
        const sourceTop = Math.max(0, ribbon.clippedY - canvasRect.top);
        const sourceWidth = Math.min(ribbon.clippedWidth, canvasRect.width - sourceLeft);
        const sourceHeight = Math.min(ribbon.clippedHeight, canvasRect.height - sourceTop);
        const scaleX = canvas.width / canvasRect.width;
        const scaleY = canvas.height / canvasRect.height;
        const sx = Math.max(0, Math.floor(sourceLeft * scaleX));
        const sy = Math.max(0, Math.floor(sourceTop * scaleY));
        const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(sourceWidth * scaleX)));
        const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(sourceHeight * scaleY)));
        const roiWidth = Math.max(32, Math.min(128, Math.round(sourceWidth)));
        const roiHeight = Math.max(24, Math.min(96, Math.round(sourceHeight)));
        const roi = document.createElement("canvas");
        roi.width = roiWidth;
        roi.height = roiHeight;
        const ctx = roi.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          return { sampled: false, brightRatio: 0, edgeDensity: 0, edgeTransitions: 0, colorBuckets: 0 };
        }
        try {
          ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, roiWidth, roiHeight);
          const pixels = ctx.getImageData(0, 0, roiWidth, roiHeight).data;
          const lumas = [];
          const buckets = new Set();
          let brightPixels = 0;
          let edgeTransitions = 0;
          for (let y = 0; y < roiHeight; y += 1) {
            for (let x = 0; x < roiWidth; x += 1) {
              const index = (y * roiWidth + x) * 4;
              const r = pixels[index];
              const g = pixels[index + 1];
              const b = pixels[index + 2];
              const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
              lumas.push(luminance);
              if (luminance >= 58) {
                brightPixels += 1;
              }
              buckets.add(`${Math.floor(r / 36)}:${Math.floor(g / 36)}:${Math.floor(b / 36)}`);
            }
          }
          const step = Math.max(2, Math.floor(Math.min(roiWidth, roiHeight) / 24));
          let comparisons = 0;
          for (let y = step; y < roiHeight; y += step) {
            for (let x = step; x < roiWidth; x += step) {
              const index = y * roiWidth + x;
              comparisons += 2;
              if (Math.abs(lumas[index] - lumas[index - step]) >= 14) {
                edgeTransitions += 1;
              }
              if (Math.abs(lumas[index] - lumas[index - step * roiWidth]) >= 14) {
                edgeTransitions += 1;
              }
            }
          }
          return {
            sampled: true,
            brightRatio: round(brightPixels / (roiWidth * roiHeight)),
            edgeDensity: round(comparisons > 0 ? edgeTransitions / comparisons : 0),
            edgeTransitions,
            colorBuckets: buckets.size,
            roiWidth,
            roiHeight
          };
        } catch (error) {
          return {
            sampled: false,
            error: error instanceof Error ? error.message : String(error),
            brightRatio: 0,
            edgeDensity: 0,
            edgeTransitions: 0,
            colorBuckets: 0
          };
        }
      };

      return {
        activeZoneId: qa?.activeZoneId ?? null,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        frameCount: qa?.frameCount ?? 0,
        averageFrameMs: qa?.averageFrameMs ?? 0,
        ribbon,
        world: {
          sceneObjects: qa?.world?.sceneObjects ?? 0,
          identityRibbonObjects: qa?.world?.identityRibbonObjects ?? 0,
          identityRibbonSignatures: qa?.world?.identityRibbonSignatures ?? 0,
          sceneryRoleCounts: qa?.world?.sceneryRoleCounts ?? {}
        },
        uiOccludedRatio: round(uiOccludedRatio),
        visibleAfterUiRatio: round(visibleAfterUiRatio),
        roi: sampleCanvasRoi()
      };
    });

  const first = await collect();
  await page.waitForTimeout(520);
  const second = await collect();
  await page.waitForTimeout(520);
  const third = await collect();
  const samples = [first, second, third];
  const centerDelta = Math.max(
    ...samples.slice(1).map((sample) =>
      Math.hypot((sample.ribbon?.center?.x ?? 0) - (first.ribbon?.center?.x ?? 0), (sample.ribbon?.center?.y ?? 0) - (first.ribbon?.center?.y ?? 0))
    )
  );
  const sizeDelta = Math.max(
    ...samples.slice(1).map((sample) =>
      Math.abs((sample.ribbon?.width ?? 0) - (first.ribbon?.width ?? 0)) +
      Math.abs((sample.ribbon?.height ?? 0) - (first.ribbon?.height ?? 0))
    )
  );
  const frameDelta = (third.frameCount ?? 0) - (first.frameCount ?? 0);
  const motionDelta = Number(Math.max(centerDelta, sizeDelta).toFixed(3));
  const weakestVisibleAfterUi = Math.min(...samples.map((sample) => sample.visibleAfterUiRatio ?? 0));
  const weakestArea = Math.min(...samples.map((sample) => sample.ribbon?.clippedArea ?? 0));
  const weakestEdges = Math.min(...samples.map((sample) => sample.roi?.edgeTransitions ?? 0));
  const weakestBuckets = Math.min(...samples.map((sample) => sample.roi?.colorBuckets ?? 0));
  const weakestBright = Math.min(...samples.map((sample) => sample.roi?.brightRatio ?? 0));

  const ok =
    samples.every((sample) => sample.ribbon?.visible === true) &&
    samples.every((sample) => sample.roi?.sampled === true) &&
    first.world.identityRibbonObjects >= 60 &&
    first.world.identityRibbonSignatures >= 1 &&
    first.world.sceneryRoleCounts?.["identity-ribbon"] === 1 &&
    first.world.sceneObjects <= premiumWorldObjectBudget &&
    frameDelta >= 8 &&
    motionDelta >= 0.35 &&
    motionDelta <= 112 &&
    weakestVisibleAfterUi >= 0.42 &&
    weakestArea >= 1100 &&
    weakestBright >= 0.03 &&
    weakestEdges >= 8 &&
    weakestBuckets >= 5;

  const details = {
    label,
    samples,
    frameDelta,
    motionDelta,
    weakestVisibleAfterUi: Number(weakestVisibleAfterUi.toFixed(3)),
    weakestArea: Number(weakestArea.toFixed(1)),
    weakestBright: Number(weakestBright.toFixed(3)),
    weakestEdges,
    weakestBuckets
  };

  if (ok) {
    pass(`identity-ribbon-visible:${label}`, details);
  } else {
    scenarioFail(`identity-ribbon-visible:${label}`, "The IT/STUDIO/ART identity ribbon is not readable as a living 3D asset.", details);
  }
}

async function inspectPlaceCompositionVisibility(page, label) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  const state = await page.evaluate((qa) => {
    const round = (value, digits = 3) => Number(value.toFixed(digits));
    const selectors = [".game-hud", ".zone-panel", ".world-map", ".mobile-drive", ".mobile-zone-nav"];
    const uiRects = selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0 ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return null;
        }
        return { selector, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      })
      .filter(Boolean);
    const toRect = (item) => {
      if (!item) {
        return null;
      }
      return {
        left: item.clippedX ?? item.x,
        top: item.clippedY ?? item.y,
        right: (item.clippedX ?? item.x) + (item.clippedWidth ?? item.width),
        bottom: (item.clippedY ?? item.y) + (item.clippedHeight ?? item.height)
      };
    };
    const uiOcclusion = (item) => {
      const rect = toRect(item);
      const area = item?.clippedArea ?? item?.area ?? 0;
      if (!rect || area <= 0) {
        return { area: 0, ratio: 1 };
      }
      const xEdges = [rect.left, rect.right];
      const yEdges = [rect.top, rect.bottom];
      for (const ui of uiRects) {
        const left = Math.max(rect.left, ui.left);
        const right = Math.min(rect.right, ui.right);
        const top = Math.max(rect.top, ui.top);
        const bottom = Math.min(rect.bottom, ui.bottom);
        if (right > left && bottom > top) {
          xEdges.push(left, right);
          yEdges.push(top, bottom);
        }
      }
      const xs = [...new Set(xEdges)].sort((a, b) => a - b);
      const ys = [...new Set(yEdges)].sort((a, b) => a - b);
      let occluded = 0;
      for (let xIndex = 0; xIndex < xs.length - 1; xIndex += 1) {
        for (let yIndex = 0; yIndex < ys.length - 1; yIndex += 1) {
          const left = xs[xIndex];
          const right = xs[xIndex + 1];
          const top = ys[yIndex];
          const bottom = ys[yIndex + 1];
          const centerX = (left + right) / 2;
          const centerY = (top + bottom) / 2;
          if (
            uiRects.some(
              (ui) => centerX >= ui.left && centerX <= ui.right && centerY >= ui.top && centerY <= ui.bottom
            )
          ) {
            occluded += Math.max(0, right - left) * Math.max(0, bottom - top);
          }
        }
      }
      return { area: round(occluded, 1), ratio: round(Math.min(1, occluded / area)) };
    };
    const centerOccluders = (item) => {
      const center = item?.center ?? null;
      if (!center) {
        return [];
      }
      return uiRects
        .filter(
          (rect) =>
            center.x >= rect.left - 12 &&
            center.x <= rect.right + 12 &&
            center.y >= rect.top - 12 &&
            center.y <= rect.bottom + 12
        )
        .map((rect) => rect.selector);
    };
    const layerState = (name, rect) => {
      const occlusion = uiOcclusion(rect);
      return {
        name,
        rect,
        centerOccluders: centerOccluders(rect),
        uiOccludedArea: occlusion.area,
        uiOccludedRatio: occlusion.ratio,
        visibleAfterUiRatio: round(Math.max(0, (rect?.visibleRatio ?? 0) * (1 - occlusion.ratio))),
        roi: sampleCanvasRoi(rect)
      };
    };
    const sampleCanvasRoi = (rect) => {
      const canvas = document.querySelector("#studio-map-canvas");
      if (!(canvas instanceof HTMLCanvasElement) || !rect || rect.clippedWidth <= 1 || rect.clippedHeight <= 1) {
        return { sampled: false, brightRatio: 0, edgeDensity: 0, colorBuckets: 0, roiWidth: 0, roiHeight: 0 };
      }
      const canvasRect = canvas.getBoundingClientRect();
      const sourceLeft = Math.max(0, rect.clippedX - canvasRect.left);
      const sourceTop = Math.max(0, rect.clippedY - canvasRect.top);
      const sourceWidth = Math.min(rect.clippedWidth, canvasRect.width - sourceLeft);
      const sourceHeight = Math.min(rect.clippedHeight, canvasRect.height - sourceTop);
      if (sourceWidth <= 1 || sourceHeight <= 1) {
        return { sampled: false, brightRatio: 0, edgeDensity: 0, colorBuckets: 0, roiWidth: 0, roiHeight: 0 };
      }
      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      const sx = Math.max(0, Math.floor(sourceLeft * scaleX));
      const sy = Math.max(0, Math.floor(sourceTop * scaleY));
      const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(sourceWidth * scaleX)));
      const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(sourceHeight * scaleY)));
      const roiSize = 64;
      const roi = document.createElement("canvas");
      roi.width = roiSize;
      roi.height = roiSize;
      const context = roi.getContext("2d", { willReadFrequently: true });
      if (!context) {
        return { sampled: false, brightRatio: 0, edgeDensity: 0, colorBuckets: 0, roiWidth: roiSize, roiHeight: roiSize };
      }
      let pixels;
      try {
        context.drawImage(canvas, sx, sy, sw, sh, 0, 0, roiSize, roiSize);
        pixels = context.getImageData(0, 0, roiSize, roiSize).data;
      } catch (error) {
        return {
          sampled: false,
          error: error instanceof Error ? error.message : String(error),
          brightRatio: 0,
          edgeDensity: 0,
          colorBuckets: 0,
          roiWidth: roiSize,
          roiHeight: roiSize
        };
      }
      const lumas = [];
      const buckets = new Set();
      let brightPixels = 0;
      for (let y = 0; y < roiSize; y += 1) {
        for (let x = 0; x < roiSize; x += 1) {
          const index = (y * roiSize + x) * 4;
          const r = pixels[index];
          const g = pixels[index + 1];
          const b = pixels[index + 2];
          const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          lumas.push(luma);
          if (luma >= 72) {
            brightPixels += 1;
          }
          buckets.add(`${Math.floor(r / 32)}:${Math.floor(g / 32)}:${Math.floor(b / 32)}`);
        }
      }
      let edgeTransitions = 0;
      let edgeComparisons = 0;
      for (let y = 1; y < roiSize; y += 1) {
        for (let x = 1; x < roiSize; x += 1) {
          const index = y * roiSize + x;
          if (Math.abs(lumas[index] - lumas[index - 1]) >= 18) {
            edgeTransitions += 1;
          }
          if (Math.abs(lumas[index] - lumas[index - roiSize]) >= 18) {
            edgeTransitions += 1;
          }
          edgeComparisons += 2;
        }
      }
      return {
        sampled: true,
        brightRatio: round(brightPixels / lumas.length),
        edgeDensity: round(edgeComparisons > 0 ? edgeTransitions / edgeComparisons : 0),
        edgeTransitions,
        colorBuckets: buckets.size,
        roiWidth: roiSize,
        roiHeight: roiSize
      };
    };
    const landmark = layerState("landmark", qa?.screen?.activeLandmark ?? null);
    const setDressing = layerState("setDressing", qa?.screen?.activeSetDressing ?? null);
    const placeArchitecture = layerState("placeArchitecture", qa?.screen?.activePlaceArchitecture ?? null);
    const signatureArtifact = layerState("signatureArtifact", qa?.screen?.activeSignatureArtifact ?? null);
    const composeLayers = (layers) => {
      const visibleLayers = layers.map((layer) => layer.rect).filter((rect) => rect?.visible === true && rect.clippedArea > 0);
      if (visibleLayers.length === 0) {
        return null;
      }
      const rawLeft = Math.min(...visibleLayers.map((rect) => rect.x));
      const rawTop = Math.min(...visibleLayers.map((rect) => rect.y));
      const rawRight = Math.max(...visibleLayers.map((rect) => rect.x + rect.width));
      const rawBottom = Math.max(...visibleLayers.map((rect) => rect.y + rect.height));
      const clippedLeft = Math.min(...visibleLayers.map((rect) => rect.clippedX));
      const clippedTop = Math.min(...visibleLayers.map((rect) => rect.clippedY));
      const clippedRight = Math.max(...visibleLayers.map((rect) => rect.clippedX + rect.clippedWidth));
      const clippedBottom = Math.max(...visibleLayers.map((rect) => rect.clippedY + rect.clippedHeight));
      const rawWidth = Math.max(0, rawRight - rawLeft);
      const rawHeight = Math.max(0, rawBottom - rawTop);
      const clippedWidth = Math.max(0, clippedRight - clippedLeft);
      const clippedHeight = Math.max(0, clippedBottom - clippedTop);
      const clippedArea = clippedWidth * clippedHeight;
      const centerX = clippedLeft + clippedWidth / 2;
      const centerY = clippedTop + clippedHeight / 2;
      const centers = visibleLayers.map((rect) => rect.center).filter(Boolean);
      const centerDistances = centers.flatMap((left, leftIndex) =>
        centers.slice(leftIndex + 1).map((right) => Math.hypot(left.x - right.x, left.y - right.y))
      );
      const union = {
        x: round(rawLeft, 1),
        y: round(rawTop, 1),
        width: round(rawWidth, 1),
        height: round(rawHeight, 1),
        area: round(rawWidth * rawHeight, 1),
        clippedX: round(clippedLeft, 1),
        clippedY: round(clippedTop, 1),
        clippedWidth: round(clippedWidth, 1),
        clippedHeight: round(clippedHeight, 1),
        clippedArea: round(clippedArea, 1),
        visibleRatio: round(rawWidth * rawHeight > 0 ? clippedArea / (rawWidth * rawHeight) : 0),
        cornerDepthCount: visibleLayers.reduce((sum, rect) => sum + (rect.cornerDepthCount ?? 0), 0),
        visible: visibleLayers.length === layers.length && clippedArea > 0,
        center: {
          x: round(centerX, 1),
          y: round(centerY, 1),
          ndcX: 0,
          ndcY: 0,
          visible: true
        }
      };
      const occlusion = uiOcclusion(union);
      return {
        visibleLayerCount: visibleLayers.length,
        union,
        centerSpreadPx: round(centerDistances.length > 0 ? Math.max(...centerDistances) : 0, 1),
        largestLayerAreaRatio: round(clippedArea > 0 ? Math.max(...visibleLayers.map((rect) => rect.clippedArea)) / clippedArea : 0),
        uiOccludedArea: occlusion.area,
        uiOccludedRatio: occlusion.ratio,
        visibleAfterUiRatio: round(Math.max(0, union.visibleRatio * (1 - occlusion.ratio))),
        centerOccluders: centerOccluders(union),
        roi: sampleCanvasRoi(union)
      };
    };
    const composition = qa?.screen?.activeZoneComposition ?? null;
    const compositionUnion = composition?.union ?? null;
    const compositionOcclusion = uiOcclusion(compositionUnion);
    const priorityComposition = composeLayers([landmark, setDressing, placeArchitecture, signatureArtifact]);
    return {
      activeZoneId: qa?.activeZoneId ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight, area: window.innerWidth * window.innerHeight },
      uiRects: uiRects.map((rect) => rect.selector),
      landmark,
      setDressing,
      placeArchitecture,
      signatureArtifact,
      priorityComposition,
      composition: composition
        ? {
            ...composition,
            uiOccludedArea: compositionOcclusion.area,
            uiOccludedRatio: compositionOcclusion.ratio,
            visibleAfterUiRatio: round(Math.max(0, (compositionUnion?.visibleRatio ?? 0) * (1 - compositionOcclusion.ratio))),
            centerOccluders: centerOccluders(compositionUnion),
            roi: sampleCanvasRoi(compositionUnion)
          }
        : null
    };
  }, snapshot);

  const isMobile = state.viewport.width <= 820;
  const viewportArea = state.viewport.area;
  const thresholds = {
    landmark: {
      minWidth: isMobile ? 32 : 44,
      minHeight: isMobile ? 34 : 50,
      minArea: isMobile ? 750 : 1_800,
      minVisibleRatio: isMobile ? 0.54 : 0.7,
      minVisibleAfterUiRatio: isMobile ? 0.48 : 0.62,
      maxUiOccludedRatio: isMobile ? 0.22 : 0.1
    },
    placeArchitecture: {
      minWidth: isMobile ? 56 : 88,
      minHeight: isMobile ? 30 : 42,
      minArea: isMobile ? 1_500 : 4_500,
      minVisibleRatio: isMobile ? 0.44 : 0.6,
      minVisibleAfterUiRatio: isMobile ? 0.34 : 0.48,
      maxUiOccludedRatio: isMobile ? 0.32 : 0.18
    },
    setDressing: {
      minWidth: isMobile ? 44 : 56,
      minHeight: isMobile ? 22 : 28,
      minArea: isMobile ? 850 : 1_000,
      minVisibleRatio: isMobile ? 0.4 : 0.45,
      minVisibleAfterUiRatio: isMobile ? 0.3 : 0.36,
      maxUiOccludedRatio: isMobile ? 0.36 : 0.2,
      minBrightRatio: isMobile ? 0.028 : 0.035,
      minEdgeDensity: isMobile ? 0.014 : 0.016,
      minColorBuckets: isMobile ? 4 : 5
    },
    composition: {
      minArea: isMobile ? Math.max(3_200, viewportArea * 0.01) : Math.max(9_000, viewportArea * 0.006),
      maxAreaRatio: isMobile ? 0.38 : 0.24,
      minVisibleAfterUiRatio: isMobile ? 0.38 : 0.5,
      maxUiOccludedRatio: isMobile ? 0.35 : 0.2,
      minBrightRatio: isMobile ? 0.035 : 0.045,
      minEdgeDensity: isMobile ? 0.018 : 0.024,
      minColorBuckets: isMobile ? 5 : 6,
      minCenterSpread: isMobile ? 5.5 : 7,
      maxCenterSpread: isMobile ? 190 : 280,
      maxPairOverlapRatio: 1.005,
      maxLargestLayerAreaRatio: 1.005
    },
    priorityComposition: {
      minArea: isMobile ? Math.max(4_200, viewportArea * 0.012) : Math.max(12_000, viewportArea * 0.008),
      maxAreaRatio: isMobile ? 0.42 : 0.28,
      minVisibleAfterUiRatio: isMobile ? 0.34 : 0.46,
      maxUiOccludedRatio: isMobile ? 0.34 : 0.2,
      minEdgeDensity: isMobile ? 0.018 : 0.026,
      minColorBuckets: isMobile ? 6 : 7,
      minCenterSpread: isMobile ? 16 : 18,
      maxCenterSpread: isMobile ? 260 : 360,
      maxLargestLayerAreaRatio: 1.005
    }
  };
  const rectPasses = (layer, threshold) =>
    layer?.rect?.visible === true &&
    layer.rect.center?.visible === true &&
    (layer.rect.cornerDepthCount ?? 0) >= 2 &&
    layer.rect.width >= threshold.minWidth &&
    layer.rect.height >= threshold.minHeight &&
    layer.rect.clippedArea >= threshold.minArea &&
    (layer.rect.visibleRatio ?? 0) >= threshold.minVisibleRatio &&
    layer.centerOccluders.length === 0 &&
    layer.uiOccludedRatio <= threshold.maxUiOccludedRatio &&
    layer.visibleAfterUiRatio >= threshold.minVisibleAfterUiRatio;
  const pairOverlapValues = Object.values(state.composition?.pairOverlapRatios ?? {});
  const compositionAreaRatio =
    state.composition?.union?.clippedArea && viewportArea > 0 ? state.composition.union.clippedArea / viewportArea : 0;
  const ok =
    rectPasses(state.landmark, thresholds.landmark) &&
    rectPasses(state.placeArchitecture, thresholds.placeArchitecture) &&
    state.signatureArtifact?.rect?.visible === true &&
    state.signatureArtifact?.rect?.center?.visible === true &&
    state.composition?.visibleLayerCount >= 3 &&
    state.composition?.union?.visible === true &&
    state.composition?.union?.center?.visible === true &&
    state.composition?.centerOccluders.length === 0 &&
    state.composition?.uiOccludedRatio <= thresholds.composition.maxUiOccludedRatio &&
    state.composition?.visibleAfterUiRatio >= thresholds.composition.minVisibleAfterUiRatio &&
    state.composition?.union?.clippedArea >= thresholds.composition.minArea &&
    compositionAreaRatio <= thresholds.composition.maxAreaRatio &&
    state.composition?.centerSpreadPx >= thresholds.composition.minCenterSpread &&
    state.composition?.centerSpreadPx <= thresholds.composition.maxCenterSpread &&
    pairOverlapValues.every((value) => value <= thresholds.composition.maxPairOverlapRatio) &&
    (state.composition?.largestLayerAreaRatio ?? 1) <= thresholds.composition.maxLargestLayerAreaRatio &&
    state.composition?.roi?.sampled === true &&
    state.composition.roi.brightRatio >= thresholds.composition.minBrightRatio &&
    state.composition.roi.edgeDensity >= thresholds.composition.minEdgeDensity &&
    state.composition.roi.colorBuckets >= thresholds.composition.minColorBuckets;

  const details = {
    ...state,
    zone: snapshot?.world?.zones?.find((zone) => zone.id === state.activeZoneId) ?? null,
    compositionAreaRatio: Number(compositionAreaRatio.toFixed(3)),
    thresholds
  };
  if (state.activeZoneId) {
    zoneCompositionProofs.set(state.activeZoneId, details);
  }

  if (ok) {
    pass(`place-composition-visible:${label}`, details);
  } else {
    scenarioFail(`place-composition-visible:${label}`, "Active place composition is not readable as one 3D scene.", details);
  }

  return details;
}

function inspectPriorityPlaceCompositionVisibility(targetId, label) {
  const proof = zoneCompositionProofs.get(targetId);
  const expectedRoles = expectedPrioritySetDressingRoles[targetId] ?? [];
  const roles = new Set(proof?.zone?.setDressingRoles ?? []);
  const missingRoles = expectedRoles.filter((role) => !roles.has(role));
  const rectPasses = (layer, threshold, options = {}) =>
    layer?.rect?.zoneId === targetId &&
    layer.rect.visible === true &&
    layer.rect.center?.visible === true &&
    (layer.rect.cornerDepthCount ?? 0) >= 2 &&
    layer.rect.width >= threshold.minWidth &&
    layer.rect.height >= threshold.minHeight &&
    layer.rect.clippedArea >= threshold.minArea &&
    (layer.rect.visibleRatio ?? 0) >= threshold.minVisibleRatio &&
    layer.centerOccluders.length === 0 &&
    layer.uiOccludedRatio <= threshold.maxUiOccludedRatio &&
    layer.visibleAfterUiRatio >= threshold.minVisibleAfterUiRatio &&
    (options.skipRoi === true ||
      (layer.roi?.sampled === true &&
        layer.roi.brightRatio >= (threshold.minBrightRatio ?? 0) &&
        layer.roi.edgeDensity >= (threshold.minEdgeDensity ?? 0) &&
        layer.roi.colorBuckets >= (threshold.minColorBuckets ?? 0)));
  const signatureThreshold = {
    ...proof?.thresholds?.landmark,
    minWidth: 48,
    minHeight: 58,
    minArea: 2_200,
    minVisibleRatio: 0.68,
    minVisibleAfterUiRatio: 0.58,
    maxUiOccludedRatio: 0.14,
    minBrightRatio: 0.08,
    minEdgeDensity: 0.014,
    minColorBuckets: 8
  };
  const composition = proof?.priorityComposition;
  const compositionThreshold = proof?.thresholds?.priorityComposition;
  const compositionAreaRatio =
    composition?.union?.clippedArea && proof?.viewport?.area > 0 ? composition.union.clippedArea / proof.viewport.area : 0;
  const ok =
    proof?.activeZoneId === targetId &&
    missingRoles.length === 0 &&
    (proof.zone?.setDressingObjects ?? 0) >= 7 &&
    (proof.zone?.setDressingSignatures?.length ?? 0) >= 6 &&
    rectPasses(proof.landmark, proof.thresholds?.landmark ?? {}, { skipRoi: true }) &&
    rectPasses(proof.placeArchitecture, proof.thresholds?.placeArchitecture ?? {}, { skipRoi: true }) &&
    rectPasses(proof.signatureArtifact, signatureThreshold) &&
    rectPasses(proof.setDressing, proof.thresholds?.setDressing ?? {}) &&
    composition &&
    compositionThreshold &&
    composition.visibleLayerCount === 4 &&
    composition.union?.visible === true &&
    composition.centerOccluders.length === 0 &&
    composition.uiOccludedRatio <= compositionThreshold.maxUiOccludedRatio &&
    composition.visibleAfterUiRatio >= compositionThreshold.minVisibleAfterUiRatio &&
    composition.union?.clippedArea >= compositionThreshold.minArea &&
    compositionAreaRatio <= compositionThreshold.maxAreaRatio &&
    composition.centerSpreadPx >= compositionThreshold.minCenterSpread &&
    composition.centerSpreadPx <= compositionThreshold.maxCenterSpread &&
    (composition.largestLayerAreaRatio ?? 1) <= compositionThreshold.maxLargestLayerAreaRatio &&
    composition.roi?.sampled === true &&
    composition.roi.edgeDensity >= compositionThreshold.minEdgeDensity &&
    composition.roi.colorBuckets >= compositionThreshold.minColorBuckets;
  const details = {
    targetId,
    label,
    expectedRoles,
    roles: [...roles].sort(),
    missingRoles,
    setDressingObjects: proof?.zone?.setDressingObjects ?? 0,
    setDressingSignatures: proof?.zone?.setDressingSignatures ?? [],
    landmark: proof?.landmark,
    setDressing: proof?.setDressing,
    placeArchitecture: proof?.placeArchitecture,
    signatureArtifact: proof?.signatureArtifact,
    priorityComposition: composition,
    compositionAreaRatio: Number(compositionAreaRatio.toFixed(3)),
    thresholds: {
      landmark: proof?.thresholds?.landmark,
      setDressing: proof?.thresholds?.setDressing,
      placeArchitecture: proof?.thresholds?.placeArchitecture,
      signatureArtifact: signatureThreshold,
      priorityComposition: compositionThreshold
    }
  };

  if (ok) {
    priorityPlaceCompositionProofs.set(targetId, details);
    pass(`priority-place-composition-proof:${label}`, details);
  } else {
    scenarioFail(
      `priority-place-composition-proof:${label}`,
      "Priority place does not visually prove landmark, set dressing, architecture and signature artifact together.",
      details
    );
  }
}

function hammingDistance(left = "", right = "") {
  const maxLength = Math.max(left.length, right.length);
  let distance = 0;
  for (let index = 0; index < maxLength; index += 1) {
    if (left[index] !== right[index]) {
      distance += 1;
    }
  }
  return distance;
}

async function inspectZonePerceptualProof(page, label) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  const proof = await page.evaluate(({ qa, proofLabel }) => {
    const round = (value, digits = 3) => Number(value.toFixed(digits));
    const artifact = qa?.screen?.activeSignatureArtifact ?? null;
    const canvas = document.querySelector("#studio-map-canvas");
    if (!(canvas instanceof HTMLCanvasElement) || !artifact || artifact.clippedWidth <= 1 || artifact.clippedHeight <= 1) {
      return {
        sampled: false,
        activeZoneId: qa?.activeZoneId ?? null,
        reason: "missing-canvas-or-artifact"
      };
    }

    const canvasRect = canvas.getBoundingClientRect();
    const sourceLeft = Math.max(0, artifact.clippedX - canvasRect.left);
    const sourceTop = Math.max(0, artifact.clippedY - canvasRect.top);
    const sourceWidth = Math.min(artifact.clippedWidth, canvasRect.width - sourceLeft);
    const sourceHeight = Math.min(artifact.clippedHeight, canvasRect.height - sourceTop);
    if (sourceWidth <= 1 || sourceHeight <= 1) {
      return {
        sampled: false,
        activeZoneId: qa?.activeZoneId ?? null,
        reason: "empty-roi"
      };
    }

    const scaleX = canvas.width / canvasRect.width;
    const scaleY = canvas.height / canvasRect.height;
    const sx = Math.max(0, Math.floor(sourceLeft * scaleX));
    const sy = Math.max(0, Math.floor(sourceTop * scaleY));
    const sw = Math.max(1, Math.min(canvas.width - sx, Math.ceil(sourceWidth * scaleX)));
    const sh = Math.max(1, Math.min(canvas.height - sy, Math.ceil(sourceHeight * scaleY)));
    const roiSize = 64;
    const roi = document.createElement("canvas");
    roi.width = roiSize;
    roi.height = roiSize;
    const ctx = roi.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return {
        sampled: false,
        activeZoneId: qa?.activeZoneId ?? null,
        reason: "missing-2d-context"
      };
    }

    let pixels;
    try {
      ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, roiSize, roiSize);
      pixels = ctx.getImageData(0, 0, roiSize, roiSize).data;
    } catch (error) {
      return {
        sampled: false,
        activeZoneId: qa?.activeZoneId ?? null,
        reason: error instanceof Error ? error.message : String(error)
      };
    }

    const lumas = [];
    const buckets = new Set();
    let brightPixels = 0;
    let totalLuma = 0;
    for (let y = 0; y < roiSize; y += 1) {
      for (let x = 0; x < roiSize; x += 1) {
        const index = (y * roiSize + x) * 4;
        const r = pixels[index];
        const g = pixels[index + 1];
        const b = pixels[index + 2];
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        lumas.push(luma);
        totalLuma += luma;
        if (luma >= 72) {
          brightPixels += 1;
        }
        buckets.add(`${Math.floor(r / 32)}:${Math.floor(g / 32)}:${Math.floor(b / 32)}`);
      }
    }

    let edgeTransitions = 0;
    let edgeComparisons = 0;
    for (let y = 1; y < roiSize; y += 1) {
      for (let x = 1; x < roiSize; x += 1) {
        const index = y * roiSize + x;
        if (Math.abs(lumas[index] - lumas[index - 1]) >= 18) {
          edgeTransitions += 1;
        }
        if (Math.abs(lumas[index] - lumas[index - roiSize]) >= 18) {
          edgeTransitions += 1;
        }
        edgeComparisons += 2;
      }
    }

    const globalAverage = totalLuma / lumas.length;
    const cellAverages = [];
    for (let cellY = 0; cellY < 8; cellY += 1) {
      for (let cellX = 0; cellX < 8; cellX += 1) {
        let sum = 0;
        for (let y = cellY * 8; y < cellY * 8 + 8; y += 1) {
          for (let x = cellX * 8; x < cellX * 8 + 8; x += 1) {
            sum += lumas[y * roiSize + x];
          }
        }
        cellAverages.push(sum / 64);
      }
    }
    const hash = cellAverages.map((value) => (value >= globalAverage ? "1" : "0")).join("");
    const litCells = cellAverages.filter((value) => value >= globalAverage).length;
    const genericRatio = Math.min(litCells, 64 - litCells) / 64;
    return {
      sampled: true,
      label: proofLabel,
      activeZoneId: qa?.activeZoneId ?? null,
      hash,
      brightRatio: round(brightPixels / lumas.length),
      edgeDensity: round(edgeComparisons > 0 ? edgeTransitions / edgeComparisons : 0),
      edgeTransitions,
      colorBuckets: buckets.size,
      averageLuma: round(globalAverage, 2),
      genericRatio: round(genericRatio),
      artifactArea: round(artifact.clippedArea ?? artifact.area ?? 0, 1),
      artifactVisibleRatio: round(artifact.visibleRatio ?? 0)
    };
  }, { qa: snapshot, proofLabel: label });

  if (proof.sampled && proof.activeZoneId) {
    zonePerceptualProofs.set(proof.activeZoneId, proof);
  }

  const ok =
    proof.sampled === true &&
    typeof proof.hash === "string" &&
    proof.hash.length === 64 &&
    proof.brightRatio >= 0.04 &&
    proof.edgeDensity >= 0.025 &&
    proof.colorBuckets >= 5 &&
    proof.genericRatio >= 0.12 &&
    proof.artifactVisibleRatio >= 0.5;

  if (ok) {
    pass(`zone-perceptual-proof:${label}`, proof);
  } else {
    scenarioFail(`zone-perceptual-proof:${label}`, "Active zone close-up lacks a usable perceptual fingerprint.", {
      proof,
      thresholds: {
        minBrightRatio: 0.04,
        minEdgeDensity: 0.025,
        minColorBuckets: 5,
        minGenericRatio: 0.12,
        minArtifactVisibleRatio: 0.5
      }
    });
  }

  return proof;
}

async function checkZonePerceptualDistance() {
  const proofs = [...zonePerceptualProofs.values()];
  const expectedZones = qaProfile === "quick" ? 4 : 10;
  const pairDistances = [];
  for (let leftIndex = 0; leftIndex < proofs.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < proofs.length; rightIndex += 1) {
      pairDistances.push({
        left: proofs[leftIndex].activeZoneId,
        right: proofs[rightIndex].activeZoneId,
        distance: hammingDistance(proofs[leftIndex].hash, proofs[rightIndex].hash)
      });
    }
  }

  const minDistance = pairDistances.reduce((min, pair) => Math.min(min, pair.distance), Number.POSITIVE_INFINITY);
  const weakProofs = proofs.filter(
    (proof) =>
      proof.sampled !== true ||
      proof.colorBuckets < 5 ||
      proof.edgeDensity < 0.025 ||
      proof.genericRatio < 0.12 ||
      proof.artifactVisibleRatio < 0.5
  );
  const duplicateHashes = proofs
    .map((proof) => proof.hash)
    .filter((hash, index, hashes) => hash && hashes.indexOf(hash) !== index);
  const minHamming = qaProfile === "quick" ? 6 : 5;
  const ok =
    proofs.length >= expectedZones &&
    pairDistances.length > 0 &&
    minDistance >= minHamming &&
    duplicateHashes.length === 0 &&
    weakProofs.length === 0;

  const details = {
    expectedZones,
    sampledZones: proofs.length,
    minHamming,
    minDistance: Number.isFinite(minDistance) ? minDistance : 0,
    duplicateHashes,
    weakProofs,
    pairDistances: pairDistances.sort((a, b) => a.distance - b.distance).slice(0, 12),
    proofs: proofs.map((proof) => ({
      zone: proof.activeZoneId,
      hash: proof.hash,
      brightRatio: proof.brightRatio,
      edgeDensity: proof.edgeDensity,
      colorBuckets: proof.colorBuckets,
      genericRatio: proof.genericRatio,
      artifactVisibleRatio: proof.artifactVisibleRatio
    }))
  };

  if (ok) {
    pass("zone-perceptual-distance", details);
    pass("all-zone-closeup-report", details);
  } else {
    scenarioFail("zone-perceptual-distance", "Zone close-ups are not perceptually distinct enough.", details);
  }
}

async function checkTechPlaceDistinctiveness(page) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  const world = snapshot?.world;
  const ai = world?.zones?.find((zone) => zone.id === "ai-lab");
  const obs = world?.zones?.find((zone) => zone.id === "observability-tower");
  const aiProof = zonePerceptualProofs.get("ai-lab");
  const obsProof = zonePerceptualProofs.get("observability-tower");
  const aiObsDistance = aiProof && obsProof ? hammingDistance(aiProof.hash, obsProof.hash) : 0;
  const allProofs = [...zonePerceptualProofs.values()];
  const pairDistances = [];
  for (let leftIndex = 0; leftIndex < allProofs.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < allProofs.length; rightIndex += 1) {
      pairDistances.push({
        left: allProofs[leftIndex].activeZoneId,
        right: allProofs[rightIndex].activeZoneId,
        distance: hammingDistance(allProofs[leftIndex].hash, allProofs[rightIndex].hash)
      });
    }
  }
  const nearestPair = pairDistances.sort((a, b) => a.distance - b.distance)[0] ?? null;
  const isAiObsNearest =
    nearestPair &&
    [nearestPair.left, nearestPair.right].includes("ai-lab") &&
    [nearestPair.left, nearestPair.right].includes("observability-tower");
  const requiredAiFamilies = expectedPrioritySignatureFamilies["ai-lab"];
  const requiredObsFamilies = expectedPrioritySignatureFamilies["observability-tower"];
  const requiredAiDressing = expectedPrioritySetDressingRoles["ai-lab"];
  const requiredObsDressing = expectedPrioritySetDressingRoles["observability-tower"];
  const hasAll = (values = [], expected = []) => expected.every((value) => values.includes(value));
  const aiBounds = ai?.signatureArtifactBounds ?? {};
  const obsBounds = obs?.signatureArtifactBounds ?? {};
  const aiSilhouette =
    (aiBounds.width ?? 0) >= 1.35 &&
    (aiBounds.depth ?? 0) >= 0.55 &&
    (aiBounds.height ?? 0) <= 1.55 &&
    (aiBounds.width ?? 0) >= (aiBounds.height ?? 0) * 1.05;
  const obsSilhouette =
    (obsBounds.height ?? 0) >= 1.9 &&
    (obsBounds.width ?? 0) >= 1.6 &&
    (obsBounds.depth ?? 0) >= 1.1 &&
    (obsBounds.height ?? 0) >= Math.min(obsBounds.width ?? 0, obsBounds.depth ?? 0) * 1.04 &&
    (obsBounds.height ?? 0) >= Math.max(obsBounds.width ?? 0, obsBounds.depth ?? 0) * 0.78;
  const gate =
    Boolean(ai && obs && aiProof && obsProof) &&
    hasAll(ai.signatureArtifactFamilies, requiredAiFamilies) &&
    hasAll(obs.signatureArtifactFamilies, requiredObsFamilies) &&
    hasAll(ai.setDressingRoles, requiredAiDressing) &&
    hasAll(obs.setDressingRoles, requiredObsDressing) &&
    aiSilhouette &&
    obsSilhouette &&
    aiObsDistance >= 22 &&
    !isAiObsNearest &&
    (world?.sceneObjects ?? 999) <= premiumWorldObjectBudget - 24;

  const details = {
    aiObsDistance,
    requiredMinDistance: 22,
    nearestPair,
    isAiObsNearest,
    ai: {
      signatureFamilies: ai?.signatureArtifactFamilies ?? [],
      setDressingRoles: ai?.setDressingRoles ?? [],
      signatureBounds: aiBounds,
      silhouette: aiSilhouette,
      perceptual: aiProof
        ? {
            hash: aiProof.hash,
            colorBuckets: aiProof.colorBuckets,
            edgeDensity: aiProof.edgeDensity,
            artifactVisibleRatio: aiProof.artifactVisibleRatio
          }
        : null
    },
    observability: {
      signatureFamilies: obs?.signatureArtifactFamilies ?? [],
      setDressingRoles: obs?.setDressingRoles ?? [],
      signatureBounds: obsBounds,
      silhouette: obsSilhouette,
      perceptual: obsProof
        ? {
            hash: obsProof.hash,
            colorBuckets: obsProof.colorBuckets,
            edgeDensity: obsProof.edgeDensity,
            artifactVisibleRatio: obsProof.artifactVisibleRatio
          }
        : null
    },
    sceneObjects: world?.sceneObjects,
    sceneObjectBudget: premiumWorldObjectBudget,
    reservedHeadroom: typeof world?.sceneObjects === "number" ? premiumWorldObjectBudget - world.sceneObjects : null
  };

  if (gate) {
    pass("tech-place-distinctiveness", details);
  } else {
    scenarioFail("tech-place-distinctiveness", "AI Lab and Observability Tower are not yet distinct premium tech places.", details);
  }
}

async function checkZoneCompositionCoverage() {
  const proofs = [...zoneCompositionProofs.values()];
  const expectedZones = qaProfile === "quick" ? 4 : 10;
  const weakProofs = proofs.filter((proof) => {
    const thresholds = proof.thresholds?.composition;
    if (!thresholds) {
      return true;
    }
    return (
      proof.composition?.visibleLayerCount < 3 ||
      proof.composition?.union?.visible !== true ||
      proof.composition?.visibleAfterUiRatio < thresholds.minVisibleAfterUiRatio ||
      proof.composition?.uiOccludedRatio > thresholds.maxUiOccludedRatio ||
      proof.composition?.union?.clippedArea < thresholds.minArea ||
      proof.compositionAreaRatio > thresholds.maxAreaRatio ||
      proof.composition?.roi?.sampled !== true ||
      proof.composition?.roi?.edgeDensity < thresholds.minEdgeDensity ||
      proof.composition?.roi?.colorBuckets < thresholds.minColorBuckets
    );
  });
  const weakestVisibleAfterUi = proofs
    .filter((proof) => typeof proof.composition?.visibleAfterUiRatio === "number")
    .sort((a, b) => a.composition.visibleAfterUiRatio - b.composition.visibleAfterUiRatio)[0];
  const ok = proofs.length >= expectedZones && weakProofs.length === 0;

  if (ok) {
    pass("place-composition-coverage", {
      sampledZones: proofs.length,
      expectedZones,
      weakest:
        weakestVisibleAfterUi
          ? {
              zoneId: weakestVisibleAfterUi.activeZoneId,
              visibleAfterUiRatio: weakestVisibleAfterUi.composition.visibleAfterUiRatio,
              uiOccludedRatio: weakestVisibleAfterUi.composition.uiOccludedRatio,
              roi: weakestVisibleAfterUi.composition.roi
            }
          : null
    });
  } else {
    scenarioFail("place-composition-coverage", "Not every sampled zone has a readable place composition.", {
      sampledZones: proofs.length,
      expectedZones,
      weakProofs: weakProofs.map((proof) => ({
        activeZoneId: proof.activeZoneId,
        visibleLayerCount: proof.composition?.visibleLayerCount,
        visibleAfterUiRatio: proof.composition?.visibleAfterUiRatio,
        uiOccludedRatio: proof.composition?.uiOccludedRatio,
        compositionAreaRatio: proof.compositionAreaRatio,
        roi: proof.composition?.roi
      }))
    });
  }
}

async function checkPriorityPlaceCompositionVisibility() {
  const proofs = priorityPlaceZoneIds.map((zoneId) => priorityPlaceCompositionProofs.get(zoneId)).filter(Boolean);
  const missingZones = priorityPlaceZoneIds.filter((zoneId) => !priorityPlaceCompositionProofs.has(zoneId));
  const ok = missingZones.length === 0 && proofs.length === priorityPlaceZoneIds.length;
  const foundryProof = priorityPlaceCompositionProofs.get("three-d-foundry");
  const foundryThresholds = foundryProof?.thresholds?.priorityComposition ?? foundryProof?.thresholds?.composition;
  const foundryComposition = foundryProof?.priorityComposition ?? foundryProof?.composition;
  const foundryVisualProof =
    foundryProof &&
    foundryProof.signatureArtifact?.rect?.visible === true &&
    foundryProof.signatureArtifact?.visibleAfterUiRatio >= 0.58 &&
    foundryComposition?.visibleLayerCount >= 3 &&
    foundryComposition?.visibleAfterUiRatio >= (foundryThresholds?.minVisibleAfterUiRatio ?? 0.46) &&
    foundryComposition?.roi?.sampled === true &&
    foundryComposition?.roi?.edgeDensity >= (foundryThresholds?.minEdgeDensity ?? 0.026) &&
    foundryComposition?.roi?.colorBuckets >= (foundryThresholds?.minColorBuckets ?? 7);

  if (ok) {
    pass("priority-place-composition-visible", {
      expectedZoneIds: priorityPlaceZoneIds,
      proofs
    });
  } else {
    scenarioFail(
      "priority-place-composition-visible",
      "Priority zones do not visually prove landmark, architecture, signature artifact and set dressing together.",
      {
        expectedZoneIds: priorityPlaceZoneIds,
        missingZones,
        proofs
      }
    );
  }

  if (foundryVisualProof) {
    pass("foundry-visual-proof", {
      zoneId: "three-d-foundry",
      signatureArtifact: foundryProof.signatureArtifact,
      composition: foundryComposition,
      compositionAreaRatio: foundryProof.compositionAreaRatio,
      thresholds: foundryProof.thresholds
    });
  } else {
    scenarioFail("foundry-visual-proof", "3D Foundry printer/scanner hierarchy is not visually readable in the map close-up.", {
      zoneId: "three-d-foundry",
      proof: foundryProof ?? null
    });
  }
}

async function checkProjectArtifactVisualCoverage() {
  const proofs = [...projectArtifactProofs.values()];
  const expectedZones = qaProfile === "quick" ? 4 : 10;
  const weakProofs = proofs.filter((proof) => {
    const thresholds = proof.thresholds;
    if (!thresholds) {
      return true;
    }
    return (
      proof.artifact?.visible !== true ||
      proof.artifact?.center?.visible !== true ||
      proof.artifact?.clippedArea < thresholds.minArea ||
      proof.artifactAreaRatio > thresholds.maxAreaRatio ||
      proof.visibleAfterUiRatio < thresholds.minVisibleAfterUiRatio ||
      proof.uiOccludedRatio > thresholds.maxUiOccludedRatio ||
      (proof.centerOccluders.length > 0 && proof.mobilePanelCenterTolerated !== true) ||
      proof.siblingOverlaps.length > 0 ||
      proof.roi?.sampled !== true ||
      proof.roi?.brightRatio < thresholds.minBrightRatio ||
      proof.roi?.edgeTransitions < thresholds.minEdgeTransitions ||
      proof.roi?.colorBuckets < thresholds.minColorBuckets ||
      (proof.zone?.projectArtifactObjects ?? 0) < 2 ||
      (proof.zone?.projectArtifactSceneObjects ?? 0) !== 1
    );
  });
  const weakestVisibleAfterUi = proofs
    .filter((proof) => typeof proof.visibleAfterUiRatio === "number")
    .sort((a, b) => a.visibleAfterUiRatio - b.visibleAfterUiRatio)[0];
  const ok = proofs.length >= expectedZones && weakProofs.length === 0;

  if (ok) {
    pass("project-artifact-visual-coverage", {
      sampledZones: proofs.length,
      expectedZones,
      weakest:
        weakestVisibleAfterUi
          ? {
              zoneId: weakestVisibleAfterUi.activeZoneId,
              visibleAfterUiRatio: weakestVisibleAfterUi.visibleAfterUiRatio,
              uiOccludedRatio: weakestVisibleAfterUi.uiOccludedRatio,
              artifactAreaRatio: weakestVisibleAfterUi.artifactAreaRatio,
              roi: weakestVisibleAfterUi.roi
            }
          : null
    });
  } else {
    scenarioFail("project-artifact-visual-coverage", "Not every sampled zone has a readable project artifact kit.", {
      sampledZones: proofs.length,
      expectedZones,
      weakProofs: weakProofs.map((proof) => ({
        activeZoneId: proof.activeZoneId,
        visibleAfterUiRatio: proof.visibleAfterUiRatio,
        uiOccludedRatio: proof.uiOccludedRatio,
        artifactAreaRatio: proof.artifactAreaRatio,
        siblingOverlaps: proof.siblingOverlaps,
        roi: proof.roi,
        projectArtifactObjects: proof.zone?.projectArtifactObjects,
        projectArtifactSceneObjects: proof.zone?.projectArtifactSceneObjects
      }))
    });
  }

  const premiumThresholds = {
    minVisibleAfterUiRatio: 0.85,
    maxUiOccludedRatio: 0.12,
    minClippedArea: 6_000,
    minArtifactAreaRatio: 0.006,
    maxArtifactAreaRatio: 0.05,
    minBrightRatio: 0.28,
    minEdgeTransitions: 120,
    minColorBuckets: 32,
    minRoiWidth: 64,
    minRoiHeight: 64
  };
  const premiumWeakProofs = proofs.filter((proof) => {
    const siblingOverlaps = Array.isArray(proof.siblingOverlaps) ? proof.siblingOverlaps : [];
    return (
      proof.artifact?.visible !== true ||
      proof.artifact?.center?.visible !== true ||
      proof.visibleAfterUiRatio < premiumThresholds.minVisibleAfterUiRatio ||
      proof.uiOccludedRatio > premiumThresholds.maxUiOccludedRatio ||
      proof.artifact?.clippedArea < premiumThresholds.minClippedArea ||
      proof.artifactAreaRatio < premiumThresholds.minArtifactAreaRatio ||
      proof.artifactAreaRatio > premiumThresholds.maxArtifactAreaRatio ||
      siblingOverlaps.length > 0 ||
      proof.roi?.sampled !== true ||
      proof.roi?.brightRatio < premiumThresholds.minBrightRatio ||
      proof.roi?.edgeTransitions < premiumThresholds.minEdgeTransitions ||
      proof.roi?.colorBuckets < premiumThresholds.minColorBuckets ||
      proof.roi?.roiWidth < premiumThresholds.minRoiWidth ||
      proof.roi?.roiHeight < premiumThresholds.minRoiHeight
    );
  });
  const weakestPremiumProof = proofs
    .filter((proof) => proof.roi?.sampled === true)
    .sort((a, b) => {
      const aScore = (a.visibleAfterUiRatio ?? 0) + (a.roi?.brightRatio ?? 0) + (a.roi?.edgeTransitions ?? 0) / 1000;
      const bScore = (b.visibleAfterUiRatio ?? 0) + (b.roi?.brightRatio ?? 0) + (b.roi?.edgeTransitions ?? 0) / 1000;
      return aScore - bScore;
    })[0];
  const premiumOk = proofs.length >= expectedZones && premiumWeakProofs.length === 0;

  if (premiumOk) {
    pass("project-artifact-premium-visual-coverage", {
      sampledZones: proofs.length,
      expectedZones,
      thresholds: premiumThresholds,
      weakest:
        weakestPremiumProof
          ? {
              zoneId: weakestPremiumProof.activeZoneId,
              visibleAfterUiRatio: weakestPremiumProof.visibleAfterUiRatio,
              uiOccludedRatio: weakestPremiumProof.uiOccludedRatio,
              artifactAreaRatio: weakestPremiumProof.artifactAreaRatio,
              clippedArea: Number((weakestPremiumProof.artifact?.clippedArea ?? 0).toFixed(1)),
              roi: weakestPremiumProof.roi
            }
          : null
    });
  } else {
    scenarioFail(
      "project-artifact-premium-visual-coverage",
      "Project specimens are not consistently readable as premium 3D assets in mini-map QA captures.",
      {
        sampledZones: proofs.length,
        expectedZones,
        thresholds: premiumThresholds,
        weakProofs: premiumWeakProofs.map((proof) => ({
          activeZoneId: proof.activeZoneId,
          visibleAfterUiRatio: proof.visibleAfterUiRatio,
          uiOccludedRatio: proof.uiOccludedRatio,
          artifactAreaRatio: proof.artifactAreaRatio,
          clippedArea: proof.artifact?.clippedArea,
          siblingOverlaps: proof.siblingOverlaps,
          roi: proof.roi
        }))
      }
    );
  }
}

async function checkLightingLayer(page, label) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  const lighting = snapshot?.lighting;
  const ok =
    lighting &&
    lighting.poolCount >= 2 &&
    lighting.poolObjects >= 2 &&
    lighting.activePoolVisible === true &&
    lighting.activePoolOpacity >= 0.07 &&
    lighting.activePoolScale >= 1.8 &&
    lighting.routePoolVisible === true &&
    lighting.routePoolOpacity >= 0.035 &&
    lighting.routePoolScale >= 0.9 &&
    typeof lighting.nearestRouteId === "string" &&
    lighting.realLightCount <= 2 &&
    lighting.shadowCastingLightCount <= 1;

  if (ok) {
    pass(`fake-lighting-active:${label}`, {
      activeZoneId: snapshot.activeZoneId,
      lighting
    });
  } else {
    scenarioFail(`fake-lighting-active:${label}`, "Fake lighting pools are missing, invisible, or too expensive.", {
      activeZoneId: snapshot?.activeZoneId,
      lighting,
      thresholds: {
        minPoolCount: 2,
        minActiveOpacity: 0.07,
        minActiveScale: 1.8,
        minRouteOpacity: 0.035,
        minRouteScale: 0.9,
        maxRealLights: 2,
        maxShadowCastingLights: 1
      }
    });
  }
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const selectors = [
      ".game-brand",
      ".game-status",
      ".game-contact",
      ".intro-plate",
      ".zone-panel",
      ".mobile-drive",
      ".mobile-zone-nav",
      ".world-map"
    ];
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

async function checkPlayableStageDominance(page, label, layout = null) {
  const snapshot = await getQaSnapshot(page, { refresh: true });
  const state = await page.evaluate((qa) => {
    const selectors = [
      ".game-brand",
      ".game-status",
      ".game-contact",
      ".intro-plate",
      ".zone-panel",
      ".mobile-drive",
      ".mobile-zone-nav",
      ".world-map"
    ];
    const round = (value, digits = 4) => Number(value.toFixed(digits));
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const viewportRect = { left: 0, top: 0, right: viewport.width, bottom: viewport.height };
    const visibleRects = selectors
      .map((selector) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) {
          return null;
        }
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          Number(style.opacity) === 0 ||
          rect.width === 0 ||
          rect.height === 0
        ) {
          return null;
        }
        return {
          selector,
          left: Math.max(0, rect.left),
          top: Math.max(0, rect.top),
          right: Math.min(viewport.width, rect.right),
          bottom: Math.min(viewport.height, rect.bottom),
          width: rect.width,
          height: rect.height
        };
      })
      .filter(Boolean)
      .filter((rect) => rect.right > rect.left && rect.bottom > rect.top);

    const unionArea = (rects, bounds = viewportRect) => {
      const clipped = rects
        .map((rect) => ({
          left: Math.max(bounds.left, rect.left),
          top: Math.max(bounds.top, rect.top),
          right: Math.min(bounds.right, rect.right),
          bottom: Math.min(bounds.bottom, rect.bottom)
        }))
        .filter((rect) => rect.right > rect.left && rect.bottom > rect.top);
      if (clipped.length === 0) {
        return 0;
      }
      const xEdges = [...new Set(clipped.flatMap((rect) => [rect.left, rect.right]))].sort((a, b) => a - b);
      let area = 0;
      for (let index = 0; index < xEdges.length - 1; index += 1) {
        const left = xEdges[index];
        const right = xEdges[index + 1];
        const width = right - left;
        if (width <= 0) {
          continue;
        }
        const yRanges = clipped
          .filter((rect) => rect.left < right && rect.right > left)
          .map((rect) => [rect.top, rect.bottom])
          .sort((a, b) => a[0] - b[0]);
        let coveredTop = null;
        let coveredBottom = null;
        let coveredHeight = 0;
        for (const [top, bottom] of yRanges) {
          if (coveredTop === null || coveredBottom === null) {
            coveredTop = top;
            coveredBottom = bottom;
            continue;
          }
          if (top > coveredBottom) {
            coveredHeight += coveredBottom - coveredTop;
            coveredTop = top;
            coveredBottom = bottom;
          } else {
            coveredBottom = Math.max(coveredBottom, bottom);
          }
        }
        if (coveredTop !== null && coveredBottom !== null) {
          coveredHeight += coveredBottom - coveredTop;
        }
        area += width * coveredHeight;
      }
      return area;
    };

    const pointOccluders = (point, padding = 0) => {
      if (!point || point.visible !== true) {
        return ["offscreen"];
      }
      return visibleRects
        .filter(
          (rect) =>
            point.x >= rect.left - padding &&
            point.x <= rect.right + padding &&
            point.y >= rect.top - padding &&
            point.y <= rect.bottom + padding
        )
        .map((rect) => rect.selector);
    };

    const composition = qa?.screen?.activeZoneComposition ?? null;
    const compositionUnion = composition?.union ?? null;
    const compositionRect = compositionUnion
      ? {
          left: compositionUnion.clippedX,
          top: compositionUnion.clippedY,
          right: compositionUnion.clippedX + compositionUnion.clippedWidth,
          bottom: compositionUnion.clippedY + compositionUnion.clippedHeight
        }
      : null;
    const compositionUiArea = compositionRect
      ? unionArea(
          visibleRects
            .map((rect) => ({
              left: Math.max(compositionRect.left, rect.left),
              top: Math.max(compositionRect.top, rect.top),
              right: Math.min(compositionRect.right, rect.right),
              bottom: Math.min(compositionRect.bottom, rect.bottom)
            }))
            .filter((rect) => rect.right > rect.left && rect.bottom > rect.top),
          compositionRect
        )
      : 0;
    const compositionArea = compositionUnion?.clippedArea ?? 0;
    const compositionUiOccludedRatio =
      compositionArea > 0 ? Math.min(1, compositionUiArea / compositionArea) : 1;
    const centerStage =
      viewport.width <= 820
        ? {
            left: viewport.width * 0.24,
            top: viewport.height * 0.2,
            right: viewport.width * 0.76,
            bottom: viewport.height * 0.54
          }
        : {
            left: viewport.width * 0.25,
            top: viewport.height * 0.2,
            right: viewport.width * 0.75,
            bottom: viewport.height * 0.72
          };
    const centerStageArea = Math.max(0, centerStage.right - centerStage.left) * Math.max(0, centerStage.bottom - centerStage.top);
    const centerStageOccludedArea = unionArea(visibleRects, centerStage);
    const uiUnionArea = unionArea(visibleRects);
    const viewportArea = viewport.width * viewport.height;

    return {
      viewport,
      activeZoneId: qa?.activeZoneId ?? null,
      visibleRects,
      uiUnionArea: round(uiUnionArea, 1),
      stageDominance: round(1 - uiUnionArea / viewportArea),
      centerStage: {
        ...centerStage,
        area: round(centerStageArea, 1),
        occludedArea: round(centerStageOccludedArea, 1),
        clearRatio: round(centerStageArea > 0 ? 1 - centerStageOccludedArea / centerStageArea : 0)
      },
      player: qa?.screen?.player ?? null,
      playerOccluders: pointOccluders(qa?.screen?.player ?? null, viewport.width <= 820 ? 0 : 8),
      composition,
      compositionUiOccludedRatio: round(compositionUiOccludedRatio),
      compositionVisibleAfterUiRatio: round((compositionUnion?.visibleRatio ?? 0) * (1 - compositionUiOccludedRatio)),
      compositionCenterOccluders: pointOccluders(compositionUnion?.center ?? null, viewport.width <= 820 ? 0 : 8)
    };
  }, snapshot);

  const isMobile = state.viewport.width <= 820;
  const minDominance = isMobile ? 0.56 : 0.76;
  const minCenterClearRatio = isMobile ? 0.78 : 0.88;
  const maxCompositionOcclusion = isMobile ? 0.42 : 0.22;
  const minCompositionVisibleAfterUi = isMobile ? 0.42 : 0.56;
  const playerReadable = isMobile
    ? state.player?.visible === true
    : state.player?.visible === true && state.playerOccluders.length === 0;
  const centerReadable = isMobile
    ? state.compositionCenterOccluders.filter((selector) => selector !== ".zone-panel").length === 0
    : state.compositionCenterOccluders.length === 0;
  const ok =
    state.stageDominance >= minDominance &&
    state.centerStage.clearRatio >= minCenterClearRatio &&
    playerReadable &&
    centerReadable &&
    (state.composition?.visibleLayerCount ?? 0) >= 2 &&
    state.compositionUiOccludedRatio <= maxCompositionOcclusion &&
    state.compositionVisibleAfterUiRatio >= minCompositionVisibleAfterUi;

  const details = {
    ...state,
    coverage: layout?.coverage ?? null,
    thresholds: {
      minDominance,
      minCenterClearRatio,
      maxCompositionOcclusion,
      minCompositionVisibleAfterUi,
      requireUnoccludedPlayer: !isMobile
    }
  };

  if (ok) {
    pass(`playable-stage-dominance:${label}`, details);
  } else {
    scenarioFail(`playable-stage-dominance:${label}`, "Playable 3D stage is not dominant or readable enough.", details);
  }
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
  if (visibleGroups.length > 0 && invalidGroups.length === 0) {
    pass(`zone-controls:${label}`, { visibleGroups });
  } else {
    scenarioFail(`zone-controls:${label}`, "Visible zone controls must each expose exactly one active zone.", { state });
  }
}

async function waitForViewportReady(page, viewport, label) {
  try {
    await page.waitForFunction(
      ({ width, height }) =>
        window.innerWidth === width &&
        window.innerHeight === height &&
        document.documentElement.classList.contains("game-ready") &&
        window.__IT_ART_STUDIO_QA__?.canvas.width > 0,
      viewport,
      { timeout: 15_000 }
    );
    return true;
  } catch (error) {
    let diagnostics = { unavailable: true };
    try {
      diagnostics = await page.evaluate(() => ({
        unavailable: false,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        ready: document.documentElement.classList.contains("game-ready"),
        gameState: document.documentElement.dataset.gameState,
        canvas: window.__IT_ART_STUDIO_QA__?.canvas ?? null,
        frameCount: window.__IT_ART_STUDIO_QA__?.frameCount ?? null
      }));
    } catch (diagnosticError) {
      diagnostics = {
        unavailable: true,
        message: diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError)
      };
    }
    const rendered =
      diagnostics &&
      diagnostics.unavailable === false &&
      diagnostics.innerWidth === viewport.width &&
      diagnostics.innerHeight === viewport.height &&
      diagnostics.ready === true &&
      diagnostics.gameState === "ready" &&
      diagnostics.canvas?.width === viewport.width &&
      diagnostics.canvas?.height === viewport.height &&
      diagnostics.frameCount > 2;
    if (rendered) {
      pass(`viewport-ready:${label}`, {
        recoveredAfterTimeout: true,
        expected: viewport,
        diagnostics,
        message: error instanceof Error ? error.message : String(error)
      });
      return true;
    }
    scenarioFail(`viewport-ready:${label}`, "Viewport did not reach a ready rendered state.", {
      expected: viewport,
      diagnostics,
      message: error instanceof Error ? error.message : String(error)
    });
    return false;
  }
}

async function ensureSelectorActionable(page, selector, label, options = {}) {
  const minWidth = options.minWidth ?? 30;
  const minHeight = options.minHeight ?? 30;
  let latest = null;
  const started = Date.now();

  while (Date.now() - started < 5_000) {
    latest = await page.evaluate((targetSelector) => {
      const matches = [...document.querySelectorAll(targetSelector)];
      const element = matches[0];
      if (!(element instanceof HTMLElement)) {
        return { count: matches.length, exists: false };
      }
      const rect = element.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const style = getComputedStyle(element);
      const hit = document.elementFromPoint(centerX, centerY);
      const hitZoneJump = hit instanceof HTMLElement ? hit.closest("[data-zone-jump]")?.getAttribute("data-zone-jump") ?? null : null;
      return {
        count: matches.length,
        exists: true,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          left: rect.left
        },
        inViewport:
          rect.right >= 0 &&
          rect.bottom >= 0 &&
          rect.left <= window.innerWidth &&
          rect.top <= window.innerHeight,
        disabled: element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement ? element.disabled : false,
        hitTag: hit?.tagName?.toLowerCase() ?? null,
        hitClass: hit instanceof HTMLElement ? hit.className : "",
        hitText: hit instanceof HTMLElement ? hit.textContent?.trim() ?? "" : "",
        hitZoneJump,
        receivesPointer: hit === element || element.contains(hit)
      };
    }, selector);

    const box = latest.rect;
    const ok =
      latest.count === 1 &&
      latest.exists &&
      box &&
      box.width >= minWidth &&
      box.height >= minHeight &&
      latest.inViewport &&
      latest.display !== "none" &&
      latest.visibility !== "hidden" &&
      latest.opacity > 0.95 &&
      !latest.disabled &&
      latest.receivesPointer;

    if (ok) {
      return { box, actionability: latest };
    }

    await wait(100);
  }

  scenarioFail(`actionable:${label}`, "Element is missing, hidden, or not safely clickable.", {
    selector,
    box: latest?.rect ?? null,
    actionability: latest,
    minWidth,
    minHeight
  });
  return null;
}

async function clickActionable(page, selector, label, options = {}) {
  const actionability = await ensureSelectorActionable(page, selector, label, options);
  if (!actionability) {
    return null;
  }

  const center = {
    x: actionability.box.x + actionability.box.width / 2,
    y: actionability.box.y + actionability.box.height / 2
  };
  await page.mouse.click(center.x, center.y);
  return { ...actionability, center };
}

async function holdActionable(page, selector, label, options = {}) {
  const actionability = await ensureSelectorActionable(page, selector, label, options);
  if (!actionability) {
    return null;
  }

  const center = {
    x: actionability.box.x + actionability.box.width / 2,
    y: actionability.box.y + actionability.box.height / 2
  };
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.waitForTimeout(options.delay ?? 550);
  await page.mouse.up();
  return { ...actionability, center };
}

async function checkViewport(page, viewport, label, options = {}) {
  await page.emulateMedia({ reducedMotion: options.reducedMotion ?? "no-preference" });
  await page.setViewportSize(viewport);
  await page.waitForTimeout(450);
  const viewportReady = await waitForViewportReady(page, viewport, label);
  if (!viewportReady) {
    return;
  }

  const layout = await measureLayout(page);
  await capture(page, label, { layout, reducedMotion: options.reducedMotion ?? "no-preference" });
  await checkVisibleZoneControls(page, label);

  if (layout.overlaps.length === 0) {
    pass(`layout:${label}`, layout);
  } else {
    scenarioFail(`layout:${label}`, "Visible UI elements overlap.", layout);
  }

  const isMobile = viewport.width <= 820;
  const maxCoverage = isMobile ? 0.5 : 0.34;
  if (layout.coverage <= maxCoverage) {
    pass(`ui-coverage:${label}`, { coverage: layout.coverage, maxCoverage });
  } else {
    scenarioFail(`ui-coverage:${label}`, "Visible UI covers too much of the viewport.", {
      coverage: layout.coverage,
      maxCoverage,
      visibleRects: layout.visibleRects
    });
  }

  await checkPlayableStageDominance(page, label, layout);
  await inspectProjectArtifactVisibility(page, `viewport:${label}`);

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

  const ctaState = await page.evaluate(() => {
    const cta = document.querySelector("[data-zone-cta]");
    if (!(cta instanceof HTMLElement) || cta.getAttribute("aria-hidden") !== "false") {
      return { required: false };
    }
    const rect = cta.getBoundingClientRect();
    return {
      required: true,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left
      },
      viewport: { width: window.innerWidth, height: window.innerHeight }
    };
  });
  if (ctaState.required) {
    const ctaActionability = await ensureSelectorActionable(page, "[data-zone-cta]", `playable-stage-cta:${label}`, {
      minWidth: 44,
      minHeight: 44
    });
    if (ctaActionability) {
      pass(`playable-stage-cta:${label}`, { ctaState, ctaActionability });
    }
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
  const desktopViewport = { width: 1280, height: 900 };
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(desktopViewport);
  await page.waitForTimeout(450);
  const viewportReady = await waitForViewportReady(page, desktopViewport, "mini-map-desktop");
  if (!viewportReady) {
    return;
  }

  const targets =
    qaProfile === "quick"
      ? [
          "studio-gate",
          "ai-lab",
          "observability-tower",
          "cloud-dock",
          "design-atelier",
          "three-d-foundry",
          "fashion-room",
          "contact-portal"
        ]
      : [
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
    const pinSelector = `.world-map [data-zone-jump="${targetId}"]`;
    const beforeActivation = await getQaSnapshot(page);
    const actionability = await clickActionable(page, pinSelector, `mini-map:${targetId}`, {
      minWidth: 30,
      minHeight: 30
    });
    if (!actionability) {
      const snapshot = await getQaSnapshot(page);
      scenarioFail(`mini-map:${targetId}`, "Mini-map pin is not actionable.", { snapshot });
      continue;
    }

    try {
      await page.waitForFunction(
        (zoneId) => {
          const qa = window.__IT_ART_STUDIO_QA__;
          const pin = document.querySelector(`.world-map [data-zone-jump="${zoneId}"]`);
          const marker = document.querySelector(".world-map__player");
          if (!qa || qa.activeZoneId !== zoneId || !(pin instanceof HTMLElement) || !(marker instanceof HTMLElement)) {
            return false;
          }
          const pinRect = pin.getBoundingClientRect();
          const markerRect = marker.getBoundingClientRect();
          const distance = Math.hypot(
            pinRect.left + pinRect.width / 2 - (markerRect.left + markerRect.width / 2),
            pinRect.top + pinRect.height / 2 - (markerRect.top + markerRect.height / 2)
          );
          return distance <= 26;
        },
        targetId,
        { timeout: 12_000 }
      );
    } catch (error) {
      const snapshot = await getQaSnapshot(page);
      const pressed = await inspectMiniMapState(page, targetId);
      if (isMiniMapStateSettled(snapshot, pressed, targetId)) {
        pass(`mini-map:${targetId}`, {
          activeZoneId: snapshot.activeZoneId,
          player: snapshot.player,
          pressed,
          lastInputMode: snapshot.lastInputMode,
          actionability,
          recoveredAfterTimeout: true,
          message: error instanceof Error ? error.message : String(error)
        });
        await checkActivationFeedback(page, targetId, beforeActivation?.activeFeedback?.sequence ?? 0);
        await checkLightingLayer(page, `mini-map:${targetId}`);
        await page.waitForTimeout(300);
        await inspectSignatureArtifactVisibility(page, `mini-map:${targetId}`);
        await inspectProjectArtifactVisibility(page, `mini-map:${targetId}`);
        await inspectPlaceCompositionVisibility(page, `mini-map:${targetId}`);
        if (priorityPlaceZoneIds.includes(targetId)) {
          inspectPriorityPlaceCompositionVisibility(targetId, `mini-map:${targetId}`);
        }
        await inspectZonePerceptualProof(page, `mini-map:${targetId}`);
        continue;
      }
      scenarioFail(`mini-map:${targetId}`, "Mini-map jump did not settle near the requested pin in time.", {
        snapshot,
        pressed,
        message: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    const snapshot = await getQaSnapshot(page);
    const pressed = await inspectMiniMapState(page, targetId);

    if (isMiniMapStateSettled(snapshot, pressed, targetId)) {
      pass(`mini-map:${targetId}`, {
        activeZoneId: snapshot.activeZoneId,
        player: snapshot.player,
        pressed,
        lastInputMode: snapshot.lastInputMode,
        actionability
      });
      await checkActivationFeedback(page, targetId, beforeActivation?.activeFeedback?.sequence ?? 0);
      await checkLightingLayer(page, `mini-map:${targetId}`);
      await page.waitForTimeout(300);
      await inspectSignatureArtifactVisibility(page, `mini-map:${targetId}`);
      await inspectProjectArtifactVisibility(page, `mini-map:${targetId}`);
      await inspectPlaceCompositionVisibility(page, `mini-map:${targetId}`);
      if (priorityPlaceZoneIds.includes(targetId)) {
        inspectPriorityPlaceCompositionVisibility(targetId, `mini-map:${targetId}`);
      }
      await inspectZonePerceptualProof(page, `mini-map:${targetId}`);
    } else {
      scenarioFail(`mini-map:${targetId}`, "Mini-map jump did not synchronize active zone and aria state.", {
        snapshot,
        pressed
      });
    }
  }
}

async function jumpMiniMapForProof(page, targetId, labelPrefix) {
  const pinSelector = `.world-map [data-zone-jump="${targetId}"]`;
  const beforeActivation = await getQaSnapshot(page);
  const actionability = await clickActionable(page, pinSelector, `${labelPrefix}:mini-map:${targetId}`, {
    minWidth: 30,
    minHeight: 30
  });
  if (!actionability) {
    const snapshot = await getQaSnapshot(page);
    scenarioFail(`${labelPrefix}:mini-map:${targetId}`, "Proof reel mini-map pin is not actionable.", { snapshot });
    return { targetId, ok: false, actionability: null, snapshot };
  }

  try {
    await page.waitForFunction(
      (zoneId) => {
        const qa = window.__IT_ART_STUDIO_QA__;
        const pin = document.querySelector(`.world-map [data-zone-jump="${zoneId}"]`);
        const marker = document.querySelector(".world-map__player");
        if (!qa || qa.activeZoneId !== zoneId || !(pin instanceof HTMLElement) || !(marker instanceof HTMLElement)) {
          return false;
        }
        const pinRect = pin.getBoundingClientRect();
        const markerRect = marker.getBoundingClientRect();
        const distance = Math.hypot(
          pinRect.left + pinRect.width / 2 - (markerRect.left + markerRect.width / 2),
          pinRect.top + pinRect.height / 2 - (markerRect.top + markerRect.height / 2)
        );
        return distance <= 26;
      },
      targetId,
      { timeout: 12_000 }
    );
  } catch (error) {
    const snapshot = await getQaSnapshot(page);
    const pressed = await inspectMiniMapState(page, targetId);
    if (!isMiniMapStateSettled(snapshot, pressed, targetId)) {
      scenarioFail(`${labelPrefix}:mini-map:${targetId}`, "Proof reel mini-map jump did not settle near the requested pin.", {
        snapshot,
        pressed,
        message: error instanceof Error ? error.message : String(error)
      });
      return { targetId, ok: false, actionability, snapshot, pressed };
    }
  }

  const snapshot = await getQaSnapshot(page);
  const pressed = await inspectMiniMapState(page, targetId);
  const settled = isMiniMapStateSettled(snapshot, pressed, targetId);
  if (settled) {
    pass(`${labelPrefix}:mini-map:${targetId}`, {
      activeZoneId: snapshot.activeZoneId,
      player: snapshot.player,
      pressed,
      lastInputMode: snapshot.lastInputMode,
      actionability
    });
    if (beforeActivation?.activeZoneId === targetId) {
      pass(`${labelPrefix}:activation-already-active:${targetId}`, {
        activeZoneId: snapshot.activeZoneId,
        sequence: snapshot.activeFeedback?.sequence ?? null
      });
    } else {
      await checkActivationFeedback(page, targetId, beforeActivation?.activeFeedback?.sequence ?? 0);
    }
    await checkLightingLayer(page, `${labelPrefix}:mini-map:${targetId}`);
    await page.waitForTimeout(260);
    await inspectSignatureArtifactVisibility(page, `${labelPrefix}:mini-map:${targetId}`);
    await inspectProjectArtifactVisibility(page, `${labelPrefix}:mini-map:${targetId}`);
    await inspectPlaceCompositionVisibility(page, `${labelPrefix}:mini-map:${targetId}`);
    if (priorityPlaceZoneIds.includes(targetId)) {
      inspectPriorityPlaceCompositionVisibility(targetId, `${labelPrefix}:mini-map:${targetId}`);
    }
    await inspectZonePerceptualProof(page, `${labelPrefix}:mini-map:${targetId}`);
  } else {
    scenarioFail(`${labelPrefix}:mini-map:${targetId}`, "Proof reel mini-map jump did not synchronize active zone and aria state.", {
      snapshot,
      pressed
    });
  }
  return { targetId, ok: settled, actionability, snapshot, pressed };
}

async function captureStaticRouteEncounterProof(browser, target) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(page, `static-proof-encounter:${target.routeId}`);

  try {
    await assertReady(page, realDriveUrl);
    await assertCanvasGeometry(page);
    const drive = await driveRouteWithRealKeyboard(page, {
      id: `static-proof-encounter:${target.routeId}`,
      position: target.position,
      radius: target.radius,
      timeoutMs: target.timeoutMs,
      route: target.route
    });
    const expectedEncounterId = `encounter:${target.routeId}`;
    const matchingProofCount = (drive.momentProofs ?? []).filter((proof) => {
      const rect = proof?.encounter?.rect;
      const routeScreen = proof?.routeEncounterScreens?.[target.routeId]?.rect;
      return rect?.id === expectedEncounterId || rect?.routeId === target.routeId || routeScreen?.routeId === target.routeId;
    }).length;
    const visibilityProof = await inspectGameplayMomentVisibility(page, `static-proof:${target.routeId}`, drive, target.routeId);
    const captureEntry = await capture(page, `static-proof-encounter-${target.routeId}`, {
      skipPremiumWorldDistribution: true
    });
    const proof = {
      routeId: target.routeId,
      family: target.family,
      reached: drive.reached,
      visuallyProven: visibilityProof?.ok === true,
      elapsedMs: drive.elapsedMs,
      sampleCount: drive.samples?.length ?? 0,
      momentProofCount: drive.momentProofs?.length ?? 0,
      matchingProofCount,
      capture: captureEntry.relativePath,
      maxSampleStepDistance: Number((drive.maxSampleStepDistance ?? 0).toFixed(3))
    };
    if (drive.reached || matchingProofCount > 0 || visibilityProof?.ok === true) {
      pass(`static-proof-route-encounter:${target.routeId}`, proof);
    } else {
      scenarioFail(
        `static-proof-route-encounter:${target.routeId}`,
        "Static proof reel real-keyboard drive did not reach or visually prove the route encounter.",
        proof
      );
    }
    return proof;
  } finally {
    await releaseDriveKeys(page).catch(() => {});
    await page.close();
  }
}

async function checkStaticPlayableProofReel(browser, page, homeCapture) {
  const labelPrefix = "static-proof";
  const desktopViewport = { width: 1280, height: 900 };
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize(desktopViewport);
  await page.waitForTimeout(450);
  const viewportReady = await waitForViewportReady(page, desktopViewport, "static-proof-desktop");
  if (!viewportReady) {
    return;
  }

  const proofZoneIds = staticProofScope === "full" ? staticProofZoneIds : staticProofCiZoneIds;
  const zoneProofs = [];
  const zoneCaptures = [];
  for (const targetId of proofZoneIds) {
    const proof = await jumpMiniMapForProof(page, targetId, labelPrefix);
    zoneProofs.push(proof);
    const captureEntry = await capture(page, `static-proof-zone-${targetId}`);
    zoneCaptures.push({ zoneId: targetId, path: captureEntry.relativePath, canvas: captureEntry.canvas });
  }
  await page.close();

  const fullEncounterTargets = [
    {
      routeId: "spine-gate-values",
      family: "studio",
      position: { x: -1.36, z: 9.75 },
      radius: 1.55,
      timeoutMs: 14_000,
      route: [
        { id: "static-spine-values-approach", position: { x: -0.72, z: 4.8 }, radius: 1.45, timeoutMs: 10_000, overshootBrake: true },
        { id: "static-spine-gate-values", position: { x: -1.36, z: 9.75 }, radius: 1.55, timeoutMs: 14_000, overshootBrake: true }
      ]
    },
    {
      routeId: "tech-gate-cloud",
      family: "tech",
      position: { x: -4.45, z: -10.08 },
      radius: 1.45,
      timeoutMs: 18_000,
      route: [
        { id: "static-tech-cloud-jump", miniMapZoneId: "cloud-dock", timeoutMs: 10_000, pauseMs: 240 },
        { id: "static-tech-via-gate-cloud-entry", position: { x: -6.1, z: -13.6 }, radius: 1.7, timeoutMs: 12_000, overshootBrake: true },
        { id: "static-tech-via-gate-cloud", position: { x: -5.1, z: -11.4 }, radius: 1.55, timeoutMs: 12_000, overshootBrake: true },
        {
          id: "static-tech-gate-cloud",
          position: { x: -4.45, z: -10.08 },
          radius: 1.35,
          timeoutMs: 18_000,
          overshootBrake: true,
          skipPostReachSamples: false
        }
      ]
    },
    {
      routeId: "art-gate-design",
      family: "art",
      position: { x: 6.4, z: -4.84 },
      radius: 1.1,
      timeoutMs: 12_000,
      route: [
        { id: "static-art-design-jump", miniMapZoneId: "design-atelier", timeoutMs: 10_000, pauseMs: 240 },
        { id: "static-art-from-atelier", position: { x: 9.1, z: -6.2 }, radius: 1.7, timeoutMs: 12_000, overshootBrake: true },
        { id: "static-art-from-studio", position: { x: 7.4, z: -5.5 }, radius: 1.55, timeoutMs: 12_000, overshootBrake: true },
        {
          id: "static-art-gate-design",
          position: { x: 6.4, z: -4.84 },
          radius: 1.45,
          timeoutMs: 16_000,
          overshootBrake: true,
          skipPostReachSamples: false
        }
      ]
    }
  ];
  const encounterTargets =
    staticProofScope === "full"
      ? fullEncounterTargets
      : fullEncounterTargets.filter((target) => target.routeId === "tech-gate-cloud");
  const encounterProofs = [];
  for (const target of encounterTargets) {
    encounterProofs.push(await captureStaticRouteEncounterProof(browser, target));
  }

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  attachPageDiagnostics(mobilePage, "static-proof-mobile");
  let mobileCapture = null;
  try {
    await assertReady(mobilePage, baseUrl);
    await assertCanvasGeometry(mobilePage);
    await mobilePage.setViewportSize({ width: 390, height: 844 });
    await mobilePage.waitForTimeout(450);
    await waitForViewportReady(mobilePage, { width: 390, height: 844 }, "static-proof-mobile-prep");
    const mobileNavActionability = await clickActionable(
      mobilePage,
      '.mobile-zone-nav [data-zone-jump="ai-lab"]',
      "static-proof-mobile-prep:ai-lab",
      { minWidth: 44, minHeight: 44 }
    );
    if (mobileNavActionability) {
      await mobilePage.waitForFunction(() => window.__IT_ART_STUDIO_QA__?.activeZoneId === "ai-lab", { timeout: 8_000 });
    }
    await checkViewport(mobilePage, { width: 390, height: 844 }, "static-proof-mobile-layout");
    await checkMobileControls(mobilePage);
    mobileCapture = await capture(mobilePage, "static-proof-mobile-touch");
  } finally {
    await releaseDriveKeys(mobilePage).catch(() => {});
    await mobilePage.close();
  }

  const zoneCoverageOk =
    zoneProofs.length === proofZoneIds.length &&
    zoneProofs.every((proof) => proof.ok === true) &&
    zoneCaptures.length === proofZoneIds.length &&
    zoneCaptures.every((entry) => entry.canvas?.ok === true);
  const isEncounterProofOk = (proof) => proof.reached || proof.matchingProofCount > 0 || proof.visuallyProven === true;
  const encounterFamilies = new Set(encounterProofs.filter(isEncounterProofOk).map((proof) => proof.family));
  const requiredEncounterFamilies = staticProofScope === "full" ? ["studio", "tech", "art"] : ["tech"];
  const encounterCoverageOk =
    encounterProofs.length === encounterTargets.length &&
    encounterProofs.every(isEncounterProofOk) &&
    requiredEncounterFamilies.every((family) => encounterFamilies.has(family));
  const mobileOk = mobileCapture?.canvas?.ok === true;
  const proofReelOk = homeCapture?.canvas?.ok === true && zoneCoverageOk && encounterCoverageOk && mobileOk;

  if (proofReelOk) {
    pass("bruno-simon-playable-proof-reel", {
      baseUrl,
      scope: staticProofScope,
      expectedZoneIds: proofZoneIds,
      homeCapture: homeCapture.relativePath,
      zoneCaptureCount: zoneCaptures.length,
      zoneCaptures,
      encounterProofs,
      mobileCapture: mobileCapture.relativePath,
      encounterFamilies: [...encounterFamilies].sort(),
      requiredEncounterFamilies
    });
  } else {
    scenarioFail("bruno-simon-playable-proof-reel", "Static production build did not produce a complete playable proof reel.", {
      baseUrl,
      scope: staticProofScope,
      expectedZoneIds: proofZoneIds,
      homeCapture: homeCapture?.relativePath ?? null,
      zoneCoverageOk,
      encounterCoverageOk,
      mobileOk,
      zoneProofs,
      zoneCaptures,
      encounterProofs,
      mobileCapture: mobileCapture?.relativePath ?? null,
      encounterFamilies: [...encounterFamilies].sort(),
      requiredEncounterFamilies
    });
  }
}

function isMiniMapStateSettled(snapshot, pressed, targetId) {
  return (
    snapshot?.activeZoneId === targetId &&
    snapshot.lastInputMode === "pointer" &&
    pressed.visiblePressed.length === 1 &&
    pressed.visiblePressed[0] === targetId &&
    pressed.markerDistancePx <= 26
  );
}

async function inspectMiniMapState(page, targetId) {
  return page.evaluate((zoneId) => {
    const visiblePressed = [...document.querySelectorAll(".world-map [data-zone-jump][aria-pressed='true']")].map(
      (node) => (node instanceof HTMLElement ? node.dataset.zoneJump : null)
    );
    const pin = document.querySelector(`.world-map [data-zone-jump="${zoneId}"]`);
    const marker = document.querySelector(".world-map__player");
    const pinRect = pin instanceof HTMLElement ? pin.getBoundingClientRect() : null;
    const markerRect = marker instanceof HTMLElement ? marker.getBoundingClientRect() : null;
    const distance =
      pinRect && markerRect
        ? Math.hypot(
            pinRect.left + pinRect.width / 2 - (markerRect.left + markerRect.width / 2),
            pinRect.top + pinRect.height / 2 - (markerRect.top + markerRect.height / 2)
          )
        : Number.POSITIVE_INFINITY;
    return {
      zoneId,
      visiblePressed,
      markerDistancePx: Number(distance.toFixed(2)),
      pinRect,
      markerRect
    };
  }, targetId);
}

async function checkMobileLayout(page) {
  await checkViewport(page, { width: 390, height: 844 }, "mobile-layout");
}

async function checkMobileControls(page) {
  const controls = await page.evaluate(() => {
    const worldMap = document.querySelector(".world-map");
    const mobileNav = document.querySelector(".mobile-zone-nav");
    const mobileDrive = document.querySelector(".mobile-drive");
    const stateFor = (node) => {
      if (!(node instanceof HTMLElement)) {
        return { exists: false };
      }
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return {
        exists: true,
        display: style.display,
        visibility: style.visibility,
        opacity: Number(style.opacity),
        width: rect.width,
        height: rect.height
      };
    };
    return {
      worldMap: stateFor(worldMap),
      mobileNav: stateFor(mobileNav),
      mobileDrive: stateFor(mobileDrive)
    };
  });

  const mobileChromeVisible =
    controls.worldMap.exists &&
    controls.worldMap.display === "none" &&
    controls.mobileNav.exists &&
    controls.mobileNav.display !== "none" &&
    controls.mobileNav.visibility !== "hidden" &&
    controls.mobileNav.width > 0 &&
    controls.mobileDrive.exists &&
    controls.mobileDrive.display !== "none" &&
    controls.mobileDrive.visibility !== "hidden" &&
    controls.mobileDrive.width > 0;

  if (mobileChromeVisible) {
    pass("mobile-controls:chrome", controls);
  } else {
    scenarioFail("mobile-controls:chrome", "Mobile controls are not visible while desktop mini-map is hidden.", controls);
    return;
  }

  const navActionability = await clickActionable(
    page,
    '.mobile-zone-nav [data-zone-jump="ai-lab"]',
    "mobile-zone-nav:ai-lab",
    {
      minWidth: 44,
      minHeight: 44
    }
  );
  if (!navActionability) {
    return;
  }
  await page.waitForFunction(() => window.__IT_ART_STUDIO_QA__?.activeZoneId === "ai-lab", { timeout: 8_000 });
  const navState = await page.evaluate(() => ({
    activeZoneId: window.__IT_ART_STUDIO_QA__?.activeZoneId,
    lastInputMode: window.__IT_ART_STUDIO_QA__?.lastInputMode,
    visiblePressed: [...document.querySelectorAll(".mobile-zone-nav [data-zone-jump][aria-pressed='true']")].map((node) =>
      node instanceof HTMLElement ? node.dataset.zoneJump : null
    )
  }));

  if (
    navState.activeZoneId === "ai-lab" &&
    navState.lastInputMode === "pointer" &&
    navState.visiblePressed.length === 1 &&
    navState.visiblePressed[0] === "ai-lab"
  ) {
    pass("mobile-controls:zone-nav", { navState, navActionability });
  } else {
    scenarioFail("mobile-controls:zone-nav", "Mobile zone nav did not activate the requested zone.", { navState });
  }

  const beforeDrive = await getQaSnapshot(page);
  const forwardActionability = await holdActionable(page, '.mobile-drive [data-drive="up"]', "mobile-drive:up", {
    minWidth: 44,
    minHeight: 44,
    delay: 260
  });
  const driveActionability = await holdActionable(page, '.mobile-drive [data-drive="right"]', "mobile-drive:right", {
    minWidth: 44,
    minHeight: 44,
    delay: 520
  });
  if (!forwardActionability || !driveActionability) {
    return;
  }
  await page.waitForTimeout(260);
  const afterDrive = await getQaSnapshot(page);
  const rotationDelta = Math.abs(angleDelta(afterDrive?.player?.rotationY ?? 0, beforeDrive?.player?.rotationY ?? 0));

  if (afterDrive?.lastInputMode === "touch" && rotationDelta > 0.14) {
    pass("mobile-controls:drive", {
      before: beforeDrive?.player,
      after: afterDrive.player,
      rotationDelta: Number(rotationDelta.toFixed(3)),
      forwardActionability,
      driveActionability
    });
  } else {
    scenarioFail("mobile-controls:drive", "Mobile drive control did not steer the vehicle through a real action.", {
      before: beforeDrive?.player,
      after: afterDrive?.player,
      lastInputMode: afterDrive?.lastInputMode,
      rotationDelta
    });
  }
}

async function writeReport() {
  const compactLargeQaValue = (key, value) => {
    if (Array.isArray(value)) {
      if (["samples", "physicsSamples", "positionSamples", "routeResults", "stepResults"].includes(key)) {
        return {
          length: value.length,
          first: value.slice(0, 2),
          last: value.slice(-4)
        };
      }
      if (key === "zones" && value.length > 4) {
        return { length: value.length, ids: value.map((zone) => zone?.id).filter(Boolean) };
      }
      if (value.length > 120) {
        return {
          length: value.length,
          first: value.slice(0, 8),
          last: value.slice(-8)
        };
      }
    }
    return value;
  };
  const summary = {
    status: failures.length === 0 ? "pass" : "fail",
    baseUrl,
    qaProfile,
    outputRoot,
    durationMs: Date.now() - startedAt,
    scenarioCount: scenarios.length,
    failureCount: failures.length,
    consoleMessages,
    scenarios,
    failures
  };

  await fsp.writeFile(reportJsonPath, `${JSON.stringify(summary, compactLargeQaValue, 2)}\n`);

  const captures = scenarios.filter((scenario) => scenario.status === "capture");
  const evidenceRows = captures.map((scenario) => {
    const details = scenario.details;
    const snapshot = details.snapshot;
    const canvas = details.canvas;
    return `| ${details.label} | ${snapshot?.activeZoneId ?? "n/a"} | ${
      snapshot?.averageFrameMs ?? "n/a"
    } | ${canvas?.width ?? 0}x${canvas?.height ?? 0} | ${canvas?.brightRatio ?? "n/a"} | ${
      canvas?.edgeTransitions ?? "n/a"
    } | ${canvas?.colorBuckets ?? "n/a"} |`;
  });
  const worldScenario = scenarios.find((scenario) => scenario.name === "world-richness");
  const rendererBudgetScenario = scenarios.find((scenario) => scenario.name === "renderer-budget");
  const externalAssetPreviewScenario = scenarios.find((scenario) => scenario.name === "external-asset-preview-runtime");
  const externalAssetMapScenario = scenarios.find((scenario) => scenario.name === "external-asset-map-composition");
  const visualScenario = scenarios.find((scenario) => scenario.name === "visual-specs-rendered");
  const placeArchitectureScenario = scenarios.find((scenario) => scenario.name === "place-architecture-rendered");
  const projectArtifactsScenario = scenarios.find((scenario) => scenario.name === "project-artifacts-rendered");
  const projectArtifactsMaterializedScenario = scenarios.find((scenario) => scenario.name === "project-artifact-materialized");
  const projectThemedAssetsScenario = scenarios.find((scenario) => scenario.name === "project-themed-assets");
  const identityRibbonScenario = scenarios.find((scenario) => scenario.name === "identity-ribbon-rendered");
  const identityRibbonVisibleScenarios = scenarios.filter((scenario) => scenario.name.startsWith("identity-ribbon-visible:"));
  const playerScenario = scenarios.find((scenario) => scenario.name === "player-personality");
  const trailScenario = scenarios.find((scenario) => scenario.name === "rover-trail:keyboard-route");
  const activationScenarios = scenarios.filter((scenario) => scenario.name.startsWith("activation-feedback:"));
  const keyboardDirectionalScenario = scenarios.find((scenario) => scenario.name === "keyboard:directional-controls");
  const realDriveScenario = scenarios.find((scenario) => scenario.name === "real-drive-tour");
  const realDriveContinuityScenario = scenarios.find((scenario) => scenario.name === "real-drive-continuity");
  const realDriveKinematicsScenarios = scenarios.filter((scenario) => scenario.name === "real-drive-kinematics");
  const realDriveKinematicsScenario =
    realDriveKinematicsScenarios.find((scenario) => typeof scenario.details?.physicsFrameSpan === "number") ??
    realDriveKinematicsScenarios.at(-1);
  const realDriveRouteScenario = scenarios.find((scenario) => scenario.name === "real-drive-route-freedom");
  const realDriveFreeRoamScenario = scenarios.find((scenario) => scenario.name === "real-drive-free-roam");
  const audioScenario = scenarios.find((scenario) => scenario.name === "audio-layer");
  const surfaceMaterialScenario = scenarios.find((scenario) => scenario.name === "surface-material-physics");
  const waterLevelDesignScenario = scenarios.find((scenario) => scenario.name === "water-level-design");
  const vehicleSuspensionScenario = scenarios.find((scenario) => scenario.name === "vehicle-suspension-response");
  const routeEncountersRenderedScenario = scenarios.find((scenario) => scenario.name === "route-encounters-rendered");
  const routeEncounterSetpiecesScenario = scenarios.find((scenario) => scenario.name === "route-encounter-setpieces");
  const routeSurfaceMaterializedScenario = scenarios.find((scenario) => scenario.name === "route-surface-materialized");
  const routeEncounterTriggeredScenario = scenarios.find((scenario) => scenario.name === "route-encounter-triggered:real-drive");
  const routeEncounterVisibleScenarios = scenarios.filter((scenario) => scenario.name.startsWith("route-encounter-visible:"));
  const roverReadableScenarios = scenarios.filter((scenario) => scenario.name.startsWith("rover-readable:"));
  const sceneGraphHeadroomScenario = scenarios.find((scenario) => scenario.name === "scene-graph-headroom");
  const premiumSceneHeadroomScenario = scenarios.find((scenario) => scenario.name === "premium-scene-headroom");
  const terrainFeatureMarkersScenario = scenarios.find((scenario) => scenario.name === "terrain-feature-markers");
  const propClusterInstancingScenario = scenarios.find((scenario) => scenario.name === "prop-cluster-instancing");
  const productionRuntimeScenario = scenarios.find((scenario) => scenario.name === "production-runtime-lightweight");
  const staticProofReelScenario = scenarios.find((scenario) => scenario.name === "bruno-simon-playable-proof-reel");
  const cameraSafeScenarios = scenarios.filter((scenario) => scenario.name.startsWith("camera-safe-area:"));
  const signatureVisibleScenarios = scenarios.filter((scenario) => scenario.name.startsWith("signature-artifact-visible:"));
  const projectVisibleScenarios = scenarios.filter((scenario) => scenario.name.startsWith("project-artifact-visible:"));
  const placeCompositionScenarios = scenarios.filter((scenario) => scenario.name.startsWith("place-composition-visible:"));
  const lightingScenarios = scenarios.filter((scenario) => scenario.name.startsWith("fake-lighting-active:"));
  const perceptualProofScenarios = scenarios.filter((scenario) => scenario.name.startsWith("zone-perceptual-proof:"));
  const projectArtifactCoverageScenario = scenarios.find((scenario) => scenario.name === "project-artifact-visual-coverage");
  const projectArtifactPremiumCoverageScenario = scenarios.find(
    (scenario) => scenario.name === "project-artifact-premium-visual-coverage"
  );
  const placeCompositionCoverageScenario = scenarios.find((scenario) => scenario.name === "place-composition-coverage");
  const priorityPlaceCompositionScenario = scenarios.find((scenario) => scenario.name === "priority-place-composition-visible");
  const premiumLandmarkHierarchyScenario = scenarios.find((scenario) => scenario.name === "premium-landmark-hierarchy");
  const artPremiumRoomsScenario = scenarios.find((scenario) => scenario.name === "art-premium-rooms");
  const foundryPrinterHierarchyScenario = scenarios.find((scenario) => scenario.name === "foundry-printer-hierarchy");
  const foundryVisualProofScenario = scenarios.find((scenario) => scenario.name === "foundry-visual-proof");
  const perceptualDistanceScenario = scenarios.find((scenario) => scenario.name === "zone-perceptual-distance");
  const techPlaceDistinctivenessScenario = scenarios.find((scenario) => scenario.name === "tech-place-distinctiveness");
  const playableStageScenarios = scenarios.filter((scenario) => scenario.name.startsWith("playable-stage-dominance:"));
  const weakestPlayableStageScenario = playableStageScenarios
    .filter((scenario) => typeof scenario.details?.stageDominance === "number")
    .sort((a, b) => a.details.stageDominance - b.details.stageDominance)[0];
  const miniMapSignatureVisibleScenarios = signatureVisibleScenarios.filter((scenario) =>
    scenario.name.startsWith("signature-artifact-visible:mini-map:")
  );
  const miniMapProjectVisibleScenarios = projectVisibleScenarios.filter((scenario) =>
    scenario.name.startsWith("project-artifact-visible:mini-map:")
  );
  const miniMapPlaceCompositionScenarios = placeCompositionScenarios.filter((scenario) =>
    scenario.name.startsWith("place-composition-visible:mini-map:")
  );
  const weakestSignatureScenario = signatureVisibleScenarios
    .filter((scenario) => typeof scenario.details?.visibleAfterUiRatio === "number")
    .sort((a, b) => a.details.visibleAfterUiRatio - b.details.visibleAfterUiRatio)[0];
  const weakestProjectScenario = projectVisibleScenarios
    .filter((scenario) => typeof scenario.details?.visibleAfterUiRatio === "number")
    .sort((a, b) => a.details.visibleAfterUiRatio - b.details.visibleAfterUiRatio)[0];
  const weakestPlaceCompositionScenario = placeCompositionScenarios
    .filter((scenario) => typeof scenario.details?.composition?.visibleAfterUiRatio === "number")
    .sort((a, b) => a.details.composition.visibleAfterUiRatio - b.details.composition.visibleAfterUiRatio)[0];
  const world = worldScenario?.details?.world;
  const player = playerScenario?.details?.player;
  const localMotionBehaviorTypes = visualScenario?.details?.localMotionBehaviorTypes ?? [];
  const trail = trailScenario?.details?.trail;
  const lastActivation = activationScenarios.at(-1)?.details?.best;

  const lines = [
    "# IT Art Studio QA Report",
    "",
    `Status: ${summary.status}`,
    `Base URL: ${baseUrl}`,
    `Profile: ${summary.qaProfile}`,
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
    "## Evidence",
    "",
    "| Capture | Active zone | Avg frame ms | Canvas | Bright ratio | Edges | Buckets |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...evidenceRows,
    "",
    "## 3D Inventory",
    "",
    `- Scene objects: ${world?.sceneObjects ?? "n/a"}`,
    `- Renderer budget: ${
      rendererBudgetScenario?.details?.renderer
        ? `${rendererBudgetScenario.status}, calls ${rendererBudgetScenario.details.renderer.calls}/${rendererBudgetScenario.details.caps.calls}, triangles ${rendererBudgetScenario.details.renderer.triangles}/${rendererBudgetScenario.details.caps.triangles}, geometries ${rendererBudgetScenario.details.renderer.geometries}/${rendererBudgetScenario.details.caps.geometries}, textures ${rendererBudgetScenario.details.renderer.textures}/${rendererBudgetScenario.details.caps.textures}`
        : (rendererBudgetScenario?.status ?? "n/a")
    }`,
    `- External asset preview: ${
      externalAssetPreviewScenario?.details?.externalAssets
        ? `${externalAssetPreviewScenario.status}, files ${externalAssetPreviewScenario.details.externalAssets.loaded}/${externalAssetPreviewScenario.details.externalAssets.requested}, roles ${externalAssetPreviewScenario.details.externalAssets.terrainRoles.join("/")}`
        : (externalAssetPreviewScenario?.status ?? "n/a")
    }`,
    `- External asset map: ${
      externalAssetMapScenario?.details?.externalAssets
        ? `${externalAssetMapScenario.status}, placements ${externalAssetMapScenario.details.externalAssets.placements}, unique files ${externalAssetMapScenario.details.externalAssets.uniqueFiles}, clusters ${externalAssetMapScenario.details.externalAssets.clusters}, cluster density non-hero/hero ${externalAssetMapScenario.details.externalAssets.maxNonHeroClusterDensity ?? "n/a"}/${externalAssetMapScenario.details.externalAssets.maxHeroLocationClusterDensity ?? "n/a"}, primary/support/context ${externalAssetMapScenario.details.externalAssets.primaryPlacements}/${externalAssetMapScenario.details.externalAssets.supportPlacements}/${externalAssetMapScenario.details.externalAssets.contextPlacements}, promotion ${externalAssetMapScenario.details.externalAssets.promotionCandidates}, actual clearance ${externalAssetMapScenario.details.externalAssets.actualMinGroundClearance}, screen roles ${Object.keys(externalAssetMapScenario.details.externalAssets.roleScreenRects ?? {}).join("/")}, coverage ${externalAssetMapScenario.details.externalAssets.mapCoverageWidth}x${externalAssetMapScenario.details.externalAssets.mapCoverageDepth}`
        : (externalAssetMapScenario?.status ?? "n/a")
    }`,
    `- External asset hero locations: ${
      externalAssetMapScenario?.details?.externalAssets
        ? `${externalAssetMapScenario.status}, placements ${externalAssetMapScenario.details.externalAssets.heroLocationPlacements ?? 0}, locations ${(externalAssetMapScenario.details.externalAssets.heroLocationIds ?? []).join("/")}, proofs ${(externalAssetMapScenario.details.heroLocationProofs ?? []).filter((proof) => proof.ok).length}/${(externalAssetMapScenario.details.heroLocationProofs ?? []).length}`
        : (externalAssetMapScenario?.status ?? "n/a")
    }`,
    `- Landmark objects: ${world?.landmarkObjects ?? "n/a"}`,
    `- Road segments: ${world?.roadSegments ?? "n/a"}`,
    `- Route surface ribbons: ${
      routeSurfaceMaterializedScenario?.details
        ? `${routeSurfaceMaterializedScenario.details.routeSurfaceObjects} objects, ${routeSurfaceMaterializedScenario.details.routeSurfaceDetailParts} detail parts, ${routeSurfaceMaterializedScenario.details.routeSurfaceDetailSignatures} signatures, ${routeSurfaceMaterializedScenario.details.routeSurfaceVertexCount}/${routeSurfaceMaterializedScenario.details.routeSurfaceVertexBudget} vertices, scene ${routeSurfaceMaterializedScenario.details.sceneObjects}/${routeSurfaceMaterializedScenario.details.sceneObjectBudget}`
        : "n/a"
    }`,
    `- Visual specs: ${world?.visualSpecs ?? "n/a"}`,
    `- Visual decals: ${world?.visualDecals ?? "n/a"}`,
    `- Prop clusters: ${world?.propClusters ?? "n/a"}`,
    `- Prop objects: ${world?.propObjects ?? "n/a"}`,
    `- Instanced prop clusters: ${world?.instancedPropClusters ?? "n/a"}`,
    `- Instanced prop objects: ${world?.instancedPropObjects ?? "n/a"}`,
    `- Set dressing objects: ${world?.setDressingObjects ?? "n/a"}`,
    `- Set dressing signatures: ${world?.setDressingSignatures ?? "n/a"}`,
    `- Place architecture objects: ${world?.placeArchitectureObjects ?? "n/a"}`,
    `- Place architecture families: ${world?.placeArchitectureFamilies ?? "n/a"}`,
    `- Place architecture signatures: ${world?.placeArchitectureSignatures ?? "n/a"}`,
    `- Place architecture checks: ${placeArchitectureScenario?.status ?? "n/a"}`,
    `- Signature artifact objects: ${world?.signatureArtifactObjects ?? "n/a"}`,
    `- Signature artifact signatures: ${world?.signatureArtifactSignatures ?? "n/a"}`,
    `- Project artifact objects: ${world?.projectArtifactObjects ?? "n/a"}`,
    `- Project artifact scene objects: ${world?.projectArtifactSceneObjects ?? "n/a"}`,
    `- Project artifact zones: ${world?.projectArtifactZones ?? "n/a"}`,
    `- Project artifact activity types: ${world?.projectArtifactActivityTypes ?? "n/a"}`,
    `- Project artifact signatures: ${world?.projectArtifactSignatures ?? "n/a"}`,
    `- Project artifact materials: ${world?.projectArtifactMaterials ?? "n/a"}`,
    `- Project artifact manifests: ${world?.projectArtifactManifests ?? "n/a"}`,
    `- Project artifact theme roles: ${world?.projectArtifactThemeRoles ?? "n/a"}`,
    `- Project artifact specimen families: ${world?.projectArtifactSpecimenFamilies ?? "n/a"}`,
    `- Project artifact detail profiles: ${world?.projectArtifactDetailProfiles ?? "n/a"}`,
    `- Project artifact relief signatures: ${world?.projectArtifactReliefSignatures ?? "n/a"}`,
    `- Project themed assets: ${projectThemedAssetsScenario?.status ?? "n/a"}`,
    `- Project artifact specimen detail: ${
      projectArtifactsMaterializedScenario?.details
        ? `${projectArtifactsMaterializedScenario.details.projectArtifactPartCount} parts, ${projectArtifactsMaterializedScenario.details.projectArtifactVertexCount} unique vertices, families ${projectArtifactsMaterializedScenario.details.projectArtifactSpecimenFamilies?.length ?? "n/a"}/5, scene ${projectArtifactsMaterializedScenario.details.sceneObjects}/${projectArtifactsMaterializedScenario.details.sceneObjectBudget}`
        : (projectArtifactsMaterializedScenario?.status ?? "n/a")
    }`,
    `- Project artifact checks: ${
      projectArtifactsScenario?.details
        ? `${projectArtifactsScenario.details.projectArtifactObjects} pieces, ${projectArtifactsScenario.details.projectArtifactSceneObjects} scene objects, ${projectArtifactsScenario.details.projectArtifactZones} zones, scene ${projectArtifactsScenario.details.sceneObjects}/${projectArtifactsScenario.details.sceneObjectBudget}`
        : (projectArtifactsScenario?.status ?? "n/a")
    }`,
    `- Terrain layers: ${world?.terrainLayers ?? "n/a"}`,
    `- Terrain feature markers: ${
      terrainFeatureMarkersScenario?.details
        ? `${terrainFeatureMarkersScenario.details.terrainFeatureMarkerObjects} semantic/${terrainFeatureMarkersScenario.details.terrainFeatureMarkerSceneObjects} scene, profiles ${terrainFeatureMarkersScenario.details.terrainFeatureMarkerProfiles}, headroom ${terrainFeatureMarkersScenario.details.reservedHeadroom}`
        : (terrainFeatureMarkersScenario?.status ?? "n/a")
    }`,
    `- Scenery objects: ${world?.sceneryObjects ?? "n/a"}`,
    `- Scenery signatures: ${world?.scenerySignatures ?? "n/a"}`,
    `- Scenery motion objects: ${world?.sceneryMotionObjects ?? "n/a"}`,
    `- Scenery roles: ${
      world?.sceneryRoleCounts ? Object.entries(world.sceneryRoleCounts).map(([role, count]) => `${role}:${count}`).join(", ") : "n/a"
    }`,
    `- Surface detail profiles: ${world?.surfaceDetailProfiles ?? "n/a"} total, water ${world?.surfaceDetailWaterProfiles ?? "n/a"}/6, ramp ${world?.surfaceDetailRampProfiles ?? "n/a"}/8, colors ${world?.surfaceDetailColorVariants ?? "n/a"}`,
    `- Water level design: ${
      waterLevelDesignScenario?.details
        ? `${waterLevelDesignScenario.status}, crossings ${waterLevelDesignScenario.details.waterCrossings}, water bodies ${waterLevelDesignScenario.details.waterBodies}, surface roles ${waterLevelDesignScenario.details.surfaceDetailRoles}`
        : (waterLevelDesignScenario?.status ?? "n/a")
    }`,
    `- Identity ribbon: ${
      identityRibbonScenario?.details
        ? `${identityRibbonScenario.details.identityRibbonObjects} objects, signatures ${identityRibbonScenario.details.identityRibbonSignatures}, visibility ${identityRibbonVisibleScenarios.filter((scenario) => scenario.status === "pass").length}/${identityRibbonVisibleScenarios.length}`
        : "n/a"
    }`,
    `- Material variants: ${world?.materialVariants ?? "n/a"}`,
    `- Motion roles: ${world?.motionRoles ?? "n/a"}`,
    `- Local motion behaviors: ${
      localMotionBehaviorTypes.length > 0 ? localMotionBehaviorTypes.join(", ") : "n/a"
    }`,
    `- Player parts: ${player?.meshCount ?? "n/a"} (${player?.wheelCount ?? "n/a"} wheels)`,
    `- Rover trail: ${trail?.activeMarks ?? "n/a"}/${trail?.totalMarks ?? "n/a"} active, max opacity ${
      trail?.maxOpacity ?? "n/a"
    }`,
    `- Activation feedback checks: ${activationScenarios.length}`,
    `- Bruno Simon proof reel: ${
      staticProofReelScenario?.details
        ? `${staticProofReelScenario.status}, scope ${staticProofReelScenario.details.scope ?? "n/a"}, zones ${staticProofReelScenario.details.zoneCaptureCount}, encounters ${staticProofReelScenario.details.encounterProofs?.length ?? 0}, mobile ${staticProofReelScenario.details.mobileCapture ? "yes" : "no"}`
        : (staticProofReelScenario?.status ?? "n/a")
    }`,
    `- Last activation feedback: ${
      lastActivation
        ? `${lastActivation.zoneId}, sequence ${lastActivation.sequence}, visible ${lastActivation.visibleObjects}, opacity ${lastActivation.maxOpacity}, scale ${lastActivation.maxScale}`
        : "n/a"
    }`,
    `- Real keyboard directional controls: ${
      keyboardDirectionalScenario?.details?.directions
        ? `${keyboardDirectionalScenario.details.directions.filter((direction) => direction.ok).length}/${keyboardDirectionalScenario.details.directions.length} directions, keys ${keyboardDirectionalScenario.details.testedKeys?.join("/") ?? "n/a"}, QA step hook ${keyboardDirectionalScenario.details.hookState?.hasQaStep ? "present" : "absent"}, hook calls ${keyboardDirectionalScenario.details.qaStepHookDelta ?? "n/a"}`
        : "n/a"
    }`,
    `- Real drive tour: ${
      realDriveScenario?.details
        ? `${realDriveScenario.details.visitedRequiredTargets?.length ?? "n/a"}/${realDriveScenario.details.requiredRealDriveTargetIds?.length ?? "n/a"} required targets, ${realDriveScenario.details.distanceDelta} units over ${realDriveScenario.details.frameDelta} frames, polling max step ${realDriveScenario.details.maxStepDistance}, telemetry max step ${realDriveScenario.details.driveTelemetryMaxStep}, camera lag max ${realDriveScenario.details.maxCameraLag}, camera distance ${realDriveScenario.details.minCameraDistance}-${realDriveScenario.details.maxCameraDistance}, sticky active-zone offscreen samples ${realDriveScenario.details.invisibleActiveZoneSamples}`
        : "n/a"
    }`,
    `- Real drive continuity: ${
      realDriveContinuityScenario?.details
        ? `${realDriveContinuityScenario.details.distanceDelta} units, ${realDriveContinuityScenario.details.frameDelta} frames, max step ${realDriveContinuityScenario.details.driveTelemetryMaxStep}, active trail ${realDriveContinuityScenario.details.trail?.activeMarks ?? "n/a"}`
        : "n/a"
    }`,
    `- Real drive kinematics: ${
      realDriveKinematicsScenario?.details
        ? `${realDriveKinematicsScenario.details.sampleCount} samples, input ${realDriveKinematicsScenario.details.inputSampleCount ?? "n/a"}, steering ${realDriveKinematicsScenario.details.steeringSampleCount ?? "n/a"}, drift window ${realDriveKinematicsScenario.details.driftWindowSampleCount ?? "n/a"}, speed p95 ${realDriveKinematicsScenario.details.physicsP95Speed}, acceleration p95 ${realDriveKinematicsScenario.details.physicsP95Acceleration}, turn-rate p95 ${realDriveKinematicsScenario.details.physicsP95TurnRate}, input turn p80 ${realDriveKinematicsScenario.details.physicsInputP80TurnRate ?? "n/a"}, drift window p80 ${realDriveKinematicsScenario.details.physicsWindowP80DriftAngle ?? "n/a"}, lateral window p80 ${realDriveKinematicsScenario.details.physicsWindowP80LateralSpeed ?? "n/a"}, max per-frame displacement ${realDriveKinematicsScenario.details.physicsMaxDisplacementPerFrame}`
        : "n/a"
    }`,
    `- Real drive route freedom: ${
      realDriveRouteScenario?.details?.surface
        ? `${realDriveRouteScenario.details.surface.routeAdherenceRatio} route ratio, ${realDriveRouteScenario.details.surface.offRouteSamples}/${realDriveRouteScenario.details.surface.samples} off-route samples, max off-route ${realDriveRouteScenario.details.surface.maxOffRouteDistance}, routes ${realDriveRouteScenario.details.coveredExpectedRouteIds?.length ?? 0}/${realDriveRouteScenario.details.expectedRouteIds?.length ?? 0}`
        : "n/a"
    }`,
    `- Real drive free roam: ${
      realDriveFreeRoamScenario?.details
        ? `${realDriveFreeRoamScenario.details.distanceDelta} units, off-route physics ${realDriveFreeRoamScenario.details.offRoutePhysicsSamples}, max route distance ${realDriveFreeRoamScenario.details.maxRouteDistance}, span ${realDriveFreeRoamScenario.details.xSpan}x${realDriveFreeRoamScenario.details.zSpan}`
        : "n/a"
    }`,
    `- Zone audio signatures: ${
      audioScenario?.details?.zoneAudioProofs
        ? `${audioScenario.details.zoneAudioProofs.map((proof) => `${proof.zoneId}:${proof.audio?.zoneSignatureId ?? "n/a"}@${proof.audio?.ambienceFrequency ?? "n/a"}Hz`).join(", ")}; spread ${audioScenario.details.zoneAudioFrequencySpread}`
        : (audioScenario?.status ?? "n/a")
    }`,
    `- Surface material physics: ${
      surfaceMaterialScenario?.details?.material
        ? `water ${surfaceMaterialScenario.details.material.waterSamples}, ramp ${surfaceMaterialScenario.details.material.rampSamples}, field ${surfaceMaterialScenario.details.material.fieldSamples}, transitions ${surfaceMaterialScenario.details.transitionDelta}, fx ${surfaceMaterialScenario.details.emittedFxDelta}, profiles ${surfaceMaterialScenario.details.material.surfaceFxWaterProfiles}/${surfaceMaterialScenario.details.material.surfaceFxRampProfiles}, colors ${surfaceMaterialScenario.details.material.surfaceFxColorVariants}, variance ${surfaceMaterialScenario.details.material.maxSurfaceFxScaleVariance}, water max ${surfaceMaterialScenario.details.material.maxWaterIntensity}, ramp lift ${surfaceMaterialScenario.details.material.maxRampRideHeight}`
        : (surfaceMaterialScenario?.status ?? "n/a")
    }`,
    `- Vehicle suspension response: ${
      vehicleSuspensionScenario?.details
        ? `peak ${vehicleSuspensionScenario.details.peakSuspensionCompression}, samples ${vehicleSuspensionScenario.details.suspensionTravelSamples}, variance ${vehicleSuspensionScenario.details.suspensionTravelVariance}, wheel span ${vehicleSuspensionScenario.details.wheelTerrainContactSpan}`
        : (vehicleSuspensionScenario?.status ?? "n/a")
    }`,
    `- Route encounters rendered: ${
      routeEncountersRenderedScenario?.details
        ? `${routeEncountersRenderedScenario.details.routeEncounterGates} gates, ${routeEncountersRenderedScenario.details.routeEncounterObjects} objects, scene ${routeEncountersRenderedScenario.details.sceneObjects}`
        : "n/a"
    }`,
    `- Route encounter setpieces: ${
      routeEncounterSetpiecesScenario?.details?.routeEncounters
        ? `${routeEncounterSetpiecesScenario.details.routeEncounters.profileCount} profiles (${routeEncounterSetpiecesScenario.details.routeEncounters.profiles.join("/")}), ${routeEncounterSetpiecesScenario.details.routeEncounters.partCount} parts, min ${routeEncounterSetpiecesScenario.details.routeEncounters.minPartsPerGate}/gate, ${routeEncounterSetpiecesScenario.details.routeEncounters.roles.length} roles`
        : (routeEncounterSetpiecesScenario?.status ?? "n/a")
    }`,
    `- Route encounters triggered: ${
      routeEncounterTriggeredScenario?.details?.routeEncounters
        ? `${routeEncounterTriggeredScenario.details.routeEncounters.visitedCount} visited, max intensity ${routeEncounterTriggeredScenario.details.routeEncounters.maxIntensity}, kinds ${Object.entries(routeEncounterTriggeredScenario.details.routeEncounterKinds ?? {}).filter(([, value]) => value).map(([kind]) => kind).join("/")}`
        : "n/a"
    }`,
    `- Scene graph headroom: ${
      sceneGraphHeadroomScenario?.details
        ? `${sceneGraphHeadroomScenario.details.sceneObjects}/${sceneGraphHeadroomScenario.details.sceneObjectBudget}, freed ${sceneGraphHeadroomScenario.details.freedFromPreviousBaseline}/${sceneGraphHeadroomScenario.details.minFreedSceneObjects}, route guidance ${sceneGraphHeadroomScenario.details.routeGuidanceObjects}/${sceneGraphHeadroomScenario.details.expectedGuidanceObjects}, route roles chevron:${sceneGraphHeadroomScenario.details.routeGuidanceRoleCounts?.["route-chevron"] ?? "n/a"} stud:${sceneGraphHeadroomScenario.details.routeGuidanceRoleCounts?.["route-stud"] ?? "n/a"} gate:${sceneGraphHeadroomScenario.details.routeGuidanceRoleCounts?.["route-encounter-gate"] ?? "n/a"}, quality preserved ${sceneGraphHeadroomScenario.details.qualityPreserved ? "yes" : "no"}`
        : "n/a"
    }`,
    `- Premium scene headroom: ${
      premiumSceneHeadroomScenario?.details
        ? `${premiumSceneHeadroomScenario.details.reservedHeadroom}/${premiumSceneHeadroomScenario.details.requiredReservedHeadroom} reserved, scene ${premiumSceneHeadroomScenario.details.sceneObjects}/${premiumSceneHeadroomScenario.details.sceneObjectBudget}, beacons ${premiumSceneHeadroomScenario.details.worldBeaconObjects} semantic/${premiumSceneHeadroomScenario.details.worldBeaconSceneObjects} scene`
        : "n/a"
    }`,
    `- Prop cluster instancing: ${
      propClusterInstancingScenario?.details
        ? `${propClusterInstancingScenario.details.sceneObjectsNetOfProjectArtifacts}/${propClusterInstancingScenario.details.sceneObjectBudget} net, total ${propClusterInstancingScenario.details.sceneObjects}, project scene ${propClusterInstancingScenario.details.projectArtifactSceneObjects}, freed ${propClusterInstancingScenario.details.freedFromPreviousBaseline}/${propClusterInstancingScenario.details.minFreedSceneObjects}, clusters ${propClusterInstancingScenario.details.instancedPropClusters}/${propClusterInstancingScenario.details.expectedInstancedPropClusters}, props ${propClusterInstancingScenario.details.instancedPropObjects}/${propClusterInstancingScenario.details.expectedInstancedPropObjects}`
        : "n/a"
    }`,
    `- Route encounter visibility: ${routeEncounterVisibleScenarios.filter((scenario) => scenario.status === "pass").length}/${
      routeEncounterVisibleScenarios.length
    }${
      routeEncounterVisibleScenarios.at(-1)?.details?.encounter?.rect
        ? `, last ${routeEncounterVisibleScenarios.at(-1).details.encounter.rect.id} intensity ${
            routeEncounterVisibleScenarios.at(-1).details.encounter.rect.intensity
          }, visible-after-ui ${routeEncounterVisibleScenarios.at(-1).details.encounter.visibleAfterUiRatio}`
        : ""
    }`,
    `- Rover readability checks: ${roverReadableScenarios.filter((scenario) => scenario.status === "pass").length}/${
      roverReadableScenarios.length
    }`,
    `- Production runtime lightweight: ${
      productionRuntimeScenario?.details
        ? `ready ${productionRuntimeScenario.details.ready}, QA snapshot ${productionRuntimeScenario.details.hasQaSnapshot}, QA step ${productionRuntimeScenario.details.hasQaStep}, QA refresh ${productionRuntimeScenario.details.hasQaRefresh}, frames ${productionRuntimeScenario.details.frames}`
        : "n/a"
    }`,
    `- Camera safe-area checks: ${cameraSafeScenarios.filter((scenario) => scenario.status === "pass").length}/${
      cameraSafeScenarios.length
    }`,
    `- Playable stage dominance: ${playableStageScenarios.filter((scenario) => scenario.status === "pass").length}/${
      playableStageScenarios.length
    }${
      weakestPlayableStageScenario?.details
        ? `, weakest ${weakestPlayableStageScenario.name} dominance ${weakestPlayableStageScenario.details.stageDominance}, center clear ${weakestPlayableStageScenario.details.centerStage?.clearRatio}`
        : ""
    }`,
    `- Fake lighting checks: ${lightingScenarios.filter((scenario) => scenario.status === "pass").length}/${
      lightingScenarios.length
    }`,
    `- Last fake lighting state: ${
      lightingScenarios.at(-1)?.details?.lighting
        ? `pools ${lightingScenarios.at(-1).details.lighting.poolObjects}, active opacity ${
            lightingScenarios.at(-1).details.lighting.activePoolOpacity
          }, route opacity ${lightingScenarios.at(-1).details.lighting.routePoolOpacity}, real lights ${
            lightingScenarios.at(-1).details.lighting.realLightCount
          }`
        : "n/a"
    }`,
    `- Signature artifact visible checks: ${signatureVisibleScenarios.filter((scenario) => scenario.status === "pass").length}/${
      signatureVisibleScenarios.length
    }`,
    `- Mini-map signature artifact visible checks: ${miniMapSignatureVisibleScenarios.filter((scenario) => scenario.status === "pass").length}/${
      miniMapSignatureVisibleScenarios.length
    }`,
    `- Weakest signature artifact visibility: ${
      weakestSignatureScenario
        ? `${weakestSignatureScenario.name.replace("signature-artifact-visible:", "")}, visible-after-ui ${weakestSignatureScenario.details.visibleAfterUiRatio}, ROI bright ${weakestSignatureScenario.details.roi?.brightRatio}, edges ${weakestSignatureScenario.details.roi?.edgeTransitions}, buckets ${weakestSignatureScenario.details.roi?.colorBuckets}`
        : "n/a"
    }`,
    `- Project artifact visible checks: ${projectVisibleScenarios.filter((scenario) => scenario.status === "pass").length}/${
      projectVisibleScenarios.length
    }`,
    `- Mini-map project artifact visible checks: ${miniMapProjectVisibleScenarios.filter((scenario) => scenario.status === "pass").length}/${
      miniMapProjectVisibleScenarios.length
    }`,
    `- Weakest project artifact visibility: ${
      weakestProjectScenario
        ? `${weakestProjectScenario.name.replace("project-artifact-visible:", "")}, visible-after-ui ${weakestProjectScenario.details.visibleAfterUiRatio}, ROI bright ${weakestProjectScenario.details.roi?.brightRatio}, edges ${weakestProjectScenario.details.roi?.edgeTransitions}, buckets ${weakestProjectScenario.details.roi?.colorBuckets}`
        : "n/a"
    }`,
    `- Project artifact visual coverage: ${
      projectArtifactCoverageScenario?.details
        ? `${projectArtifactCoverageScenario.details.sampledZones}/${projectArtifactCoverageScenario.details.expectedZones} zones`
        : "n/a"
    }`,
    `- Project artifact premium visual coverage: ${
      projectArtifactPremiumCoverageScenario?.details
        ? `${projectArtifactPremiumCoverageScenario.details.sampledZones}/${projectArtifactPremiumCoverageScenario.details.expectedZones} zones, weakest ${projectArtifactPremiumCoverageScenario.details.weakest?.zoneId ?? "n/a"} visible-after-ui ${projectArtifactPremiumCoverageScenario.details.weakest?.visibleAfterUiRatio ?? "n/a"}, ROI bright ${projectArtifactPremiumCoverageScenario.details.weakest?.roi?.brightRatio ?? "n/a"}, edges ${projectArtifactPremiumCoverageScenario.details.weakest?.roi?.edgeTransitions ?? "n/a"}, buckets ${projectArtifactPremiumCoverageScenario.details.weakest?.roi?.colorBuckets ?? "n/a"}`
        : "n/a"
    }`,
    `- Place composition visible checks: ${placeCompositionScenarios.filter((scenario) => scenario.status === "pass").length}/${
      placeCompositionScenarios.length
    }`,
    `- Mini-map place composition checks: ${miniMapPlaceCompositionScenarios.filter((scenario) => scenario.status === "pass").length}/${
      miniMapPlaceCompositionScenarios.length
    }`,
    `- Place composition coverage: ${
      placeCompositionCoverageScenario?.details
        ? `${placeCompositionCoverageScenario.details.sampledZones}/${placeCompositionCoverageScenario.details.expectedZones} zones`
        : "n/a"
    }`,
    `- Priority place composition: ${
      priorityPlaceCompositionScenario?.details
        ? `${priorityPlaceCompositionScenario.status}, ${priorityPlaceCompositionScenario.details.proofs?.length ?? 0} priority zones`
        : "n/a"
    }`,
    `- Premium landmark hierarchy: ${
      premiumLandmarkHierarchyScenario?.details
        ? `${premiumLandmarkHierarchyScenario.status}, ${premiumLandmarkHierarchyScenario.details.proofs?.map((proof) => `${proof.zoneId}:${proof.objectCount}/${proof.sceneObjectCount}`).join(", ")}, headroom ${premiumLandmarkHierarchyScenario.details.reservedHeadroom}`
        : (premiumLandmarkHierarchyScenario?.status ?? "n/a")
    }`,
    `- ART premium rooms: ${
      artPremiumRoomsScenario?.details
        ? `${artPremiumRoomsScenario.status}, ${artPremiumRoomsScenario.details.proofs?.length ?? 0} rooms, scene ${artPremiumRoomsScenario.details.sceneObjects}/${artPremiumRoomsScenario.details.sceneObjectBudget}`
        : "n/a"
    }`,
    `- Foundry printer hierarchy: ${
      foundryPrinterHierarchyScenario?.details
        ? `${foundryPrinterHierarchyScenario.status}, ${foundryPrinterHierarchyScenario.details.semanticSignatureObjects}/${foundryPrinterHierarchyScenario.details.physicalSignatureSceneObjects} semantic/scene, headroom ${foundryPrinterHierarchyScenario.details.reservedHeadroom}`
        : (foundryPrinterHierarchyScenario?.status ?? "n/a")
    }`,
    `- Foundry visual proof: ${
      foundryVisualProofScenario?.details
        ? `${foundryVisualProofScenario.status}, visible-after-ui ${foundryVisualProofScenario.details.composition?.visibleAfterUiRatio}, edge density ${foundryVisualProofScenario.details.composition?.roi?.edgeDensity}, buckets ${foundryVisualProofScenario.details.composition?.roi?.colorBuckets}`
        : (foundryVisualProofScenario?.status ?? "n/a")
    }`,
    `- Weakest place composition: ${
      weakestPlaceCompositionScenario
        ? `${weakestPlaceCompositionScenario.name.replace("place-composition-visible:", "")}, visible-after-ui ${weakestPlaceCompositionScenario.details.composition.visibleAfterUiRatio}, area ratio ${weakestPlaceCompositionScenario.details.compositionAreaRatio}, ROI bright ${weakestPlaceCompositionScenario.details.composition.roi?.brightRatio}, edge density ${weakestPlaceCompositionScenario.details.composition.roi?.edgeDensity}, buckets ${weakestPlaceCompositionScenario.details.composition.roi?.colorBuckets}`
        : "n/a"
    }`,
    `- Zone perceptual proofs: ${perceptualProofScenarios.filter((scenario) => scenario.status === "pass").length}/${
      perceptualProofScenarios.length
    }`,
    `- Zone perceptual distance: ${
      perceptualDistanceScenario?.details
        ? `${perceptualDistanceScenario.details.sampledZones}/${perceptualDistanceScenario.details.expectedZones} zones, min hamming ${perceptualDistanceScenario.details.minDistance}, nearest ${perceptualDistanceScenario.details.pairDistances?.[0]?.left ?? "n/a"}:${perceptualDistanceScenario.details.pairDistances?.[0]?.right ?? "n/a"}`
        : "n/a"
    }`,
    `- Tech place distinctiveness: ${
      techPlaceDistinctivenessScenario?.details
        ? `AI/Obs hamming ${techPlaceDistinctivenessScenario.details.aiObsDistance}/${techPlaceDistinctivenessScenario.details.requiredMinDistance}, nearest ${techPlaceDistinctivenessScenario.details.nearestPair?.left ?? "n/a"}:${techPlaceDistinctivenessScenario.details.nearestPair?.right ?? "n/a"}, headroom ${techPlaceDistinctivenessScenario.details.reservedHeadroom}`
        : (techPlaceDistinctivenessScenario?.status ?? "n/a")
    }`,
    `- Final camera: ${
      realDriveScenario?.details?.camera
        ? `lag ${realDriveScenario.details.camera.lag}, distance ${realDriveScenario.details.camera.distanceToPlayer}, player screen ${realDriveScenario.details.screen?.player?.x}/${realDriveScenario.details.screen?.player?.y}`
        : "n/a"
    }`,
    "",
    "## Screenshots",
    "",
    ...captures.map((scenario) => `- ${scenario.details.label}: ${scenario.details.relativePath}`),
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
  if (!process.env.QA_BASE_URL) {
    const availablePort = await findAvailablePort(requestedPort);
    setRuntimePort(availablePort);
    if (availablePort !== requestedPort) {
      console.log(`[qa] port ${requestedPort} is busy, using ${availablePort}`);
    }
  }
  const server = startServer();
  let browser;

  try {
    await waitForServer(server);
    browser = await chromium.launch({
      headless: true,
      ...(browserChannel ? { channel: browserChannel } : {}),
      args: [
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding"
      ]
    });

    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    attachPageDiagnostics(page, "desktop");

    await assertReady(page);
    await assertCanvasGeometry(page);
    if (staticDistMode) {
      await page.waitForFunction(
        () =>
          document.documentElement.dataset.gameState === "ready" &&
          !document.querySelector("[data-game-loader]") &&
          window.__IT_ART_STUDIO_QA__?.ready === true &&
          window.__IT_ART_STUDIO_QA__?.frameCount > 2,
        { timeout: 12_000 }
      );
      pass("static-dist-runtime-ready", await page.evaluate(() => ({
        location: window.location.href,
        gameState: document.documentElement.dataset.gameState,
        loaderPresent: Boolean(document.querySelector("[data-game-loader]")),
        scriptSources: [...document.scripts].map((script) => script.src).filter(Boolean),
        qa: {
          ready: window.__IT_ART_STUDIO_QA__?.ready ?? false,
          frameCount: window.__IT_ART_STUDIO_QA__?.frameCount ?? 0,
          canvas: window.__IT_ART_STUDIO_QA__?.canvas ?? null,
          activeZoneId: window.__IT_ART_STUDIO_QA__?.activeZoneId ?? null
        }
      })));
      const home = await capture(page, "static-dist-home-loaded");
      if (home.canvas.ok) {
        pass("static-dist-canvas-nonblank", home.canvas);
      } else {
        scenarioFail("static-dist-canvas-nonblank", "Static dist canvas did not render enough non-dark sampled pixels.", home.canvas);
      }
      await checkWorldRichness(page);
      await checkExternalAssetPreview(browser);
      await checkExternalAssetMapComposition(browser);
      await checkStaticPlayableProofReel(browser, page, home);
      if (!page.isClosed()) {
        await page.close();
      }
    } else {
    await assertBrandIdentity(page);
    await checkRuntimeFrameBudget(page, "pre-capture");
    const home = await capture(page, "home-loaded");
    await inspectCameraSafeArea(page, "home-loaded");
    await inspectSignatureArtifactVisibility(page, "home-loaded");
    await inspectProjectArtifactVisibility(page, "home-loaded");
    await inspectPlaceCompositionVisibility(page, "home-loaded");
    await inspectIdentityRibbonVisibility(page, "home-loaded");
    await inspectZonePerceptualProof(page, "home-loaded");
    await checkLightingLayer(page, "home-loaded");
    await checkVisibleZoneControls(page, "desktop");
    const desktopLayout = await measureLayout(page);
    if (desktopLayout.overlaps.length === 0 && desktopLayout.coverage <= 0.34) {
      pass("layout:desktop", desktopLayout);
    } else {
      scenarioFail("layout:desktop", "Desktop UI layout gate failed.", desktopLayout);
    }
    await checkPlayableStageDominance(page, "desktop", desktopLayout);

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
    await checkExternalAssetPreview(browser);
    await checkExternalAssetMapComposition(browser);
    await checkAudioLayer(browser);
    await checkFrameBudget(page);
    await checkRealKeyboardInput(page);
    await checkRealKeyboardDirectionalControls(browser);
    await checkRealDriveArcadeKeyboard(browser);
    await checkVehicleFeelSignature(browser);
    await checkRealDriveTour(browser);
    await checkRealDriveFreeRoam(browser);
    await checkRealDriveWholeMapFreedom(browser);
    await checkRealDriveVisibleBoundary(browser);
    await checkSurfaceMaterialPhysics(browser);
    await checkVehicleTerrainResponse(browser);
    await checkProductionRuntimeLightweight(browser);

    const targets = [
      { id: "ai-lab", position: { x: -10.8, z: -4.8 }, radius: 2, timeoutMs: 10_000 },
      { id: "design-atelier", position: { x: 10.8, z: -5.2 }, radius: 2, timeoutMs: 14_000 },
      { id: "contact-portal", position: { x: 0, z: -13.2 }, radius: 2.1, timeoutMs: 10_000 }
    ];

    for (const target of targets) {
      const beforeActivation = await getQaSnapshot(page);
      await driveToZone(page, target);
      await checkActivationFeedback(page, target.id, beforeActivation?.activeFeedback?.sequence ?? 0);
      await checkLightingLayer(page, `keyboard:${target.id}`);
      await inspectProjectArtifactVisibility(page, `keyboard:${target.id}`);
      await inspectPlaceCompositionVisibility(page, `keyboard:${target.id}`);
      await capture(page, target.id);
    }
    await checkRoverTrail(page, "keyboard-route");

    await checkContact(page);
    await checkMiniMapJumps(page);
    await checkZoneCompositionCoverage();
    await checkPriorityPlaceCompositionVisibility();
    await checkProjectArtifactVisualCoverage();
    await checkZonePerceptualDistance();
    await checkTechPlaceDistinctiveness(page);
    await capture(page, "mini-map-jumps");
    if (qaProfile === "quick") {
      await checkViewport(page, { width: 1280, height: 720 }, "desktop-wide");
      await checkMobileLayout(page);
      await checkMobileControls(page);
      await checkViewport(page, { width: 1024, height: 768 }, "reduced-motion", { reducedMotion: "reduce" });
    } else {
      await checkViewport(page, { width: 1280, height: 720 }, "desktop-wide");
      await checkViewport(page, { width: 1024, height: 768 }, "tablet-landscape");
      await checkViewport(page, { width: 821, height: 900 }, "tablet-boundary-desktop");
      await checkViewport(page, { width: 820, height: 900 }, "tablet-portrait");
      await checkMobileLayout(page);
      await checkViewport(page, { width: 320, height: 700 }, "mobile-small");
      await checkMobileControls(page);
      await checkViewport(page, { width: 1024, height: 768 }, "reduced-motion", { reducedMotion: "reduce" });
    }
    await page.close();
    }
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
    console.log(
      `[qa] failure-summary ${JSON.stringify(
        summary.failures.slice(0, 5).map((failure) => ({
          message: failure.message,
          details: {
            message: failure.details?.message,
            failingProofs: failure.details?.failingProofs?.slice?.(0, 4),
            routeId: failure.details?.routeId,
            family: failure.details?.family,
            reached: failure.details?.reached,
            matchingProofCount: failure.details?.matchingProofCount,
            consoleMessages: failure.details?.consoleMessages?.slice?.(0, 4)
          }
        })),
        null,
        2
      )}`
    );
    process.exitCode = 1;
  }
}

await main();
