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
const withSearchParam = (url, key, value) => {
  const target = new URL(url);
  target.searchParams.set(key, value);
  return target.toString();
};
const realDriveUrl = withSearchParam(baseUrl, "realKeys", "1");
const productionUrl = (() => {
  const target = new URL(baseUrl);
  target.searchParams.delete("qa");
  target.searchParams.delete("realKeys");
  return target.toString();
})();
const requiresQaStep = (url) => {
  try {
    const params = new URL(url).searchParams;
    return params.has("qa") && !params.has("realKeys");
  } catch {
    return /[?&]qa(?:=|&|$)/.test(url) && !/[?&]realKeys(?:=|&|=1|$)/.test(url);
  }
};
const qaProfile = process.env.QA_PROFILE === "quick" ? "quick" : "full";
const outputRoot = path.join(root, "qa", "artifacts", new Date().toISOString().replace(/[:.]/g, "-"));
const screenshotsDir = path.join(outputRoot, "screenshots");
const reportJsonPath = path.join(outputRoot, "report.json");
const reportMdPath = path.join(outputRoot, "report.md");

const scenarios = [];
const failures = [];
const consoleMessages = [];
const zonePerceptualProofs = new Map();
const zoneCompositionProofs = new Map();
const projectArtifactProofs = new Map();
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
    const sampleCount = 121;
    let previousSample = null;

    for (let yIndex = 1; yIndex <= 11; yIndex += 1) {
      for (let xIndex = 1; xIndex <= 11; xIndex += 1) {
        const x = Math.floor((width * xIndex) / 12);
        const y = Math.floor((height * yIndex) / 12);
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
    maxFlatCluster: Math.max(...samples.map((sample) => sample.maxFlatCluster ?? 99)),
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
  await assertPremiumWorldDetailDistribution(page, label);
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
      const targetZoneId = target.zoneId ?? target.id;
      if (snapshot.activeZoneId === targetZoneId || distanceToTarget <= (target.radius ?? 0.55)) {
        reached = true;
        break;
      }

      const keys = [];
      if (Math.abs(dx) > 0.38) {
        keys.push(dx > 0 ? "ArrowRight" : "ArrowLeft");
      }
      if (Math.abs(dz) > 0.38) {
        keys.push(dz > 0 ? "ArrowDown" : "ArrowUp");
      }
      if (keys.length === 0) {
        break;
      }
      await holdDriveKeys(page, keys, 120);
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
    maxSampleStepDistance: Math.max(...stepResults.map((result) => result.maxSampleStepDistance), 0),
    stepResults
  };
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
        position: { x: -7, z: -3 },
        route: [
          { id: "cloud-dock", zoneId: "cloud-dock", position: { x: -2.6, z: -6 }, timeoutMs: 8_000 },
          { id: "ai-lab", zoneId: "ai-lab", position: { x: -7, z: -3 }, timeoutMs: 8_000 }
        ]
      },
      {
        id: "observability-tower",
        position: { x: -8, z: 3 },
        route: [
          { id: "tech-ai-obs-bend", position: { x: -9, z: -0.4 }, radius: 0.65, timeoutMs: 8_000 },
          { id: "observability-tower", zoneId: "observability-tower", position: { x: -8, z: 3 }, timeoutMs: 8_000 }
        ]
      },
      {
        id: "design-atelier",
        position: { x: 6.9, z: -3.2 },
        route: [
          { id: "architecture-bridge", zoneId: "architecture-bridge", position: { x: -3, z: 5.4 }, timeoutMs: 9_000 },
          { id: "studio-gate", zoneId: "studio-gate", position: { x: 0, z: 0 }, timeoutMs: 9_000 },
          { id: "design-atelier", zoneId: "design-atelier", position: { x: 6.9, z: -3.2 }, timeoutMs: 10_000 }
        ]
      },
      {
        id: "contact-portal",
        position: { x: 0, z: -8.2 },
        route: [
          { id: "studio-gate", zoneId: "studio-gate", position: { x: 0, z: 0 }, timeoutMs: 9_000 },
          { id: "values-plaza", zoneId: "values-plaza", position: { x: 0, z: 7.4 }, timeoutMs: 9_000 },
          { id: "studio-gate", zoneId: "studio-gate", position: { x: 0, z: 0 }, timeoutMs: 9_000 },
          { id: "contact-portal", zoneId: "contact-portal", position: { x: 0, z: -8.2 }, timeoutMs: 9_000 }
        ]
      }
    ];
    const routeResults = [];

    for (const target of targets) {
      const beforeActivation = await getQaSnapshot(page);
      const result = await driveRouteWithRealKeyboard(page, target);
      routeResults.push({ target: target.id, ...result });
      const snapshot = await getQaSnapshot(page);
      if (result.reached && snapshot?.lastInputMode === "keyboard") {
        pass(`real-drive:${target.id}`, {
          elapsedMs: result.elapsedMs,
          sampleCount: result.samples.length,
          maxSampleStepDistance: Number(result.maxSampleStepDistance.toFixed(3)),
          player: snapshot.player,
          drive: snapshot.drive
        });
        await checkActivationFeedback(page, target.id, beforeActivation?.activeFeedback?.sequence ?? 0);
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
    const visitedTargets = targets.filter((target) => final?.visitedZoneIds?.includes(target.id)).map((target) => target.id);
    const surface = final?.drive?.surface;
    const expectedRouteIds = [
      "tech-gate-cloud",
      "tech-cloud-ai",
      "tech-ai-obs",
      "tech-obs-arch",
      "tech-arch-gate",
      "art-gate-design",
      "spine-contact-gate"
    ];
    const visitedRouteIds = surface?.visitedRouteIds ?? [];
    const coveredExpectedRouteIds = expectedRouteIds.filter((routeId) => visitedRouteIds.includes(routeId));
    const offRouteRatio = surface?.samples > 0 ? surface.offRouteSamples / surface.samples : 1;
    const driveGate =
      final?.activeZoneId === "contact-portal" &&
      final.lastInputMode === "keyboard" &&
      (final.input?.qaStepHookCalls ?? 0) === (initial?.input?.qaStepHookCalls ?? 0) &&
      (final.input?.keyboardDownCount ?? 0) >= targets.length &&
      (final.input?.keyboardUpCount ?? 0) >= targets.length &&
      (final.input?.activeKeys?.length ?? 99) === 0 &&
      frameDelta >= 40 &&
      routeResults.every((result) => result.reached && result.samples.length >= 3) &&
      visitedTargets.length === targets.length &&
      distanceDelta >= 26 &&
      xSpan >= 10 &&
      zSpan >= 8 &&
      (final.drive?.rotationChange ?? 0) >= 0.8 &&
      (final.drive?.averageSpeed ?? 0) >= 3 &&
      (final.trail?.activeMarks ?? 0) >= 10 &&
      (final.drive?.cameraDistance ?? 0) >= 10 &&
      (final.drive?.cameraDistance ?? 0) <= 18 &&
      (final.camera?.lag ?? 99) <= 5.8 &&
      final.screen?.player?.visible === true &&
      final.screen?.activeZone?.visible === true &&
      cameraSamples.length >= allSamples.length * 0.8 &&
      invisiblePlayerSamples.length === 0 &&
      maxCameraLag <= 5.8 &&
      minCameraDistance >= 10 &&
      maxCameraDistance <= 18 &&
      driveTelemetryMaxStep <= 3.5;
    const continuityGate =
      frameDelta >= 180 &&
      (final.drive?.positionSamples?.length ?? 0) >= 45 &&
      routeResults.every(
        (result) =>
          result.reached &&
          result.samples.length >= 2 &&
          (result.stepResults ?? []).every((step) => step.reached && step.samples.length >= 2)
      ) &&
      distanceDelta >= 60 &&
      driveTelemetryMaxStep <= 2.75 &&
      maxStepDistance <= 5.75 &&
      maxCameraLag <= 2.25 &&
      minCameraDistance >= 13.2 &&
      maxCameraDistance <= 16.8 &&
      invisiblePlayerSamples.length === 0 &&
      invisibleActiveZoneSamples.length <= 1 &&
      (final.trail?.activeMarks ?? 0) >= 16;
    const routeAdherenceGate =
      surface?.segmentCount >= 20 &&
      surface.samples >= 45 &&
      surface.routeAdherenceRatio >= 0.86 &&
      offRouteRatio <= 0.14 &&
      surface.maxOffRouteDistance <= 2.8 &&
      coveredExpectedRouteIds.length === expectedRouteIds.length;
    const dynamics = final?.drive?.dynamics;
    const physicsSamples = final?.drive?.physicsSamples ?? [];
    const physicsSpeeds = physicsSamples.map((sample) => sample.speed ?? 0);
    const physicsAccelerations = physicsSamples.map((sample) => sample.acceleration ?? 0);
    const physicsTurnRates = physicsSamples.map((sample) => Math.abs(sample.turnRate ?? 0));
    const physicsFrameSpan =
      physicsSamples.length > 1 ? physicsSamples.at(-1).frame - physicsSamples[0].frame : 0;
    const physicsMaxDisplacementPerFrame = maxPhysicsDisplacementPerFrame(physicsSamples);
    const physicsP95Speed = percentile(physicsSpeeds, 0.95);
    const physicsP95Acceleration = percentile(physicsAccelerations, 0.95);
    const physicsP95TurnRate = percentile(physicsTurnRates, 0.95);
    const kinematicsGate =
      physicsSamples.length >= 90 &&
      physicsFrameSpan >= 120 &&
      physicsSamples.every(
        (sample) =>
          Number.isFinite(sample.tMs) &&
          Number.isFinite(sample.speed) &&
          Number.isFinite(sample.acceleration) &&
          Number.isFinite(sample.turnRate)
      ) &&
      (dynamics?.movingSamples ?? 0) >= 75 &&
      (dynamics?.inputSamples ?? 0) >= 35 &&
      (dynamics?.coastingSamples ?? 0) >= 18 &&
      (dynamics?.peakSpeed ?? 0) >= 8 &&
      (dynamics?.peakSpeed ?? 99) <= 18 &&
      (dynamics?.averageAcceleration ?? 0) >= 4 &&
      (dynamics?.peakAcceleration ?? 99) <= 145 &&
      (dynamics?.peakTurnRate ?? 0) >= 1.2 &&
      (dynamics?.peakTurnRate ?? 99) <= 8.5 &&
      (dynamics?.averageTurnRate ?? 99) <= 3.8 &&
      physicsP95Speed <= 17.5 &&
      physicsP95Acceleration <= 82 &&
      physicsP95TurnRate <= 6.8 &&
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
        visitedTargets,
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
        visitedTargets,
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
        invisiblePlayerSamples: invisiblePlayerSamples.length,
        invisibleActiveZoneSamples: invisibleActiveZoneSamples.length,
        trail: final?.trail,
        routeResults: routeResults.map((result) => ({
          target: result.target,
          reached: result.reached,
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
        invisiblePlayerSamples,
        invisibleActiveZoneSamples,
        trail: final?.trail,
        routeResults
      });
    }

    if (kinematicsGate) {
      pass("real-drive-kinematics", {
        dynamics,
        sampleCount: physicsSamples.length,
        physicsFrameSpan,
        physicsP95Speed: Number(physicsP95Speed.toFixed(3)),
        physicsP95Acceleration: Number(physicsP95Acceleration.toFixed(3)),
        physicsP95TurnRate: Number(physicsP95TurnRate.toFixed(3)),
        physicsMaxDisplacementPerFrame: Number(physicsMaxDisplacementPerFrame.toFixed(3)),
        dragReleaseProof: hasDragReleaseProof(physicsSamples)
      });
    } else {
      scenarioFail("real-drive-kinematics", "Real keyboard drive does not prove acceleration, drag, and bounded turn dynamics.", {
        dynamics,
        sampleCount: physicsSamples.length,
        physicsFrameSpan,
        physicsP95Speed,
        physicsP95Acceleration,
        physicsP95TurnRate,
        physicsMaxDisplacementPerFrame,
        dragReleaseProof: hasDragReleaseProof(physicsSamples),
        firstSamples: physicsSamples.slice(0, 6),
        lastSamples: physicsSamples.slice(-6)
      });
    }

    if (routeAdherenceGate) {
      pass("real-drive-route-adherence", {
        surface,
        offRouteRatio: Number(offRouteRatio.toFixed(3)),
        expectedRouteIds,
        coveredExpectedRouteIds
      });
    } else {
      scenarioFail("real-drive-route-adherence", "Real keyboard route does not follow the designed road graph.", {
        surface,
        offRouteRatio,
        expectedRouteIds,
        coveredExpectedRouteIds,
        routeResults
      });
    }

    const routeEncounters = final?.routeEncounters;
    const visitedEncounterIds = routeEncounters?.visitedIds ?? [];
    const routeEncounterKinds = {
      studio: visitedEncounterIds.some((id) => id.includes("spine-")),
      tech: visitedEncounterIds.some((id) => id.includes("tech-")),
      art: visitedEncounterIds.some((id) => id.includes("art-"))
    };
    const routeEncounterGate =
      routeEncounters &&
      routeEncounters.gateCount >= 11 &&
      routeEncounters.objectCount >= 11 &&
      routeEncounters.visitedCount >= 5 &&
      routeEncounters.maxIntensity >= 0.45 &&
      routeEncounterKinds.studio &&
      routeEncounterKinds.tech &&
      routeEncounterKinds.art;

    if (routeEncounterGate) {
      pass("route-encounter-triggered:real-drive", {
        routeEncounters,
        routeEncounterKinds,
        expectedMinVisited: 5,
        expectedMinIntensity: 0.45
      });
    } else {
      scenarioFail("route-encounter-triggered:real-drive", "Real keyboard route did not trigger enough route encounter gates.", {
        routeEncounters,
        routeEncounterKinds,
        expectedMinVisited: 5,
        expectedMinIntensity: 0.45
      });
    }

    const encounterDrive = await driveWithRealKeyboard(page, {
      id: "route-encounter:spine-contact-gate",
      position: { x: 0, z: -3.936 },
      radius: 0.55,
      timeoutMs: 6_000,
      skipPostReachSamples: true
    });
    if (encounterDrive.reached || (encounterDrive.momentProofs?.length ?? 0) > 0) {
      await inspectGameplayMomentVisibility(page, "real-drive:spine-contact-gate", encounterDrive);
    } else {
      scenarioFail("route-encounter-visible:real-drive:spine-contact-gate", "Real keyboard drive did not reach the inspected route encounter.", {
        encounterDrive
      });
    }

    await capture(page, "real-drive-tour");
  } finally {
    await releaseDriveKeys(page);
    await page.close();
  }
}

async function inspectGameplayMomentVisibility(page, label, driveResult = null) {
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
      routeEncounters: qa?.routeEncounters ?? null
    };
  }, snapshot);
  const bestLiveProof = (driveResult?.momentProofs ?? [])
    .filter((proof) => proof?.encounter?.rect?.id && proof?.player?.rect?.visible === true)
    .sort((a, b) => (b.encounter?.rect?.intensity ?? 0) - (a.encounter?.rect?.intensity ?? 0))[0];
  if ((bestLiveProof?.encounter?.rect?.intensity ?? 0) > (state.encounter?.rect?.intensity ?? 0)) {
    state = bestLiveProof;
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
      minIntensity: 0.34,
      maxDistance: 1.2,
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
  const encounterOk =
    encounterRect?.visible === true &&
    encounterRect.center?.visible === true &&
    typeof encounterRect.id === "string" &&
    typeof encounterRect.routeId === "string" &&
    encounterRect.intensity >= thresholds.encounter.minIntensity &&
    encounterRect.distance <= thresholds.encounter.maxDistance &&
    encounterRect.width >= thresholds.encounter.minWidth &&
    encounterRect.height >= thresholds.encounter.minHeight &&
    encounterRect.clippedArea >= thresholds.encounter.minArea &&
    encounter.centerOccluders.length === 0 &&
    encounter.uiOccludedRatio <= thresholds.encounter.maxUiOccludedRatio &&
    encounter.visibleAfterUiRatio >= thresholds.encounter.minVisibleAfterUiRatio &&
    encounter.roi.sampled === true &&
    encounter.roi.brightRatio >= thresholds.encounter.minBrightRatio &&
    encounter.roi.edgeDensity >= thresholds.encounter.minEdgeDensity &&
    encounter.roi.colorBuckets >= thresholds.encounter.minColorBuckets &&
    (state.routeEncounters?.activeCount ?? 0) >= 1;
  const ok = playerOk && encounterOk;
  const details = {
    ...state,
    driveResult: driveResult
      ? {
          reached: driveResult.reached,
          elapsedMs: driveResult.elapsedMs,
          sampleCount: driveResult.samples?.length ?? 0,
          momentProofCount: driveResult.momentProofs?.length ?? 0,
          maxSampleStepDistance: Number((driveResult.maxSampleStepDistance ?? 0).toFixed(3))
        }
      : null,
    thresholds,
    playerOk,
    encounterOk
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
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(250);
    after = await getQaSnapshot(page);
    if (after?.lastInputMode === "keyboard" && Math.abs(after.player.x - (before?.player.x ?? 0)) > 0.15) {
      break;
    }
  }
  if (after?.lastInputMode === "keyboard" && Math.abs(after.player.x - (before?.player.x ?? 0)) > 0.15) {
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
    { id: "forward", key: "ArrowUp", activeKey: "up", axis: "z", sign: -1, minAxisDelta: 0.22, minDistance: 0.22 },
    { id: "backward", key: "ArrowDown", activeKey: "down", axis: "z", sign: 1, minAxisDelta: 0.22, minDistance: 0.22 },
    {
      id: "turn-left",
      key: "ArrowLeft",
      activeKey: "left",
      axis: "x",
      sign: -1,
      minAxisDelta: 0.18,
      minDistance: 0.18,
      minRotationDelta: 0.025
    },
    {
      id: "turn-right",
      key: "ArrowRight",
      activeKey: "right",
      axis: "x",
      sign: 1,
      minAxisDelta: 0.18,
      minDistance: 0.18,
      minRotationDelta: 0.025
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

      await page.keyboard.down(direction.key);
      await page.waitForTimeout(360);
      const during = await getQaSnapshot(page, { refresh: true });
      await page.keyboard.up(direction.key);
      await page.waitForTimeout(180);
      const after = await getQaSnapshot(page, { refresh: true });
      const axisDelta =
        direction.axis === "x"
          ? (after?.player?.x ?? 0) - (before?.player?.x ?? 0)
          : (after?.player?.z ?? 0) - (before?.player?.z ?? 0);
      const distance = Math.hypot((after?.player?.x ?? 0) - (before?.player?.x ?? 0), (after?.player?.z ?? 0) - (before?.player?.z ?? 0));
      const rotationDelta = Math.abs(angleDelta(after?.player?.rotationY ?? 0, before?.player?.rotationY ?? 0));
      const frameDelta = (after?.frameCount ?? 0) - (before?.frameCount ?? 0);
      const downDelta = (after?.input?.keyboardDownCount ?? 0) - beforeDownCount;
      const upDelta = (after?.input?.keyboardUpCount ?? 0) - beforeUpCount;
      const qaStepHookDelta = (after?.input?.qaStepHookCalls ?? 0) - beforeQaStepHookCalls;

      proofs.push({
        id: direction.id,
        key: direction.key,
        activeKey: direction.activeKey,
        before: before?.player ?? null,
        during: during?.player ?? null,
        after: after?.player ?? null,
        axis: direction.axis,
        axisDelta: Number(axisDelta.toFixed(3)),
        distance: Number(distance.toFixed(3)),
        rotationDelta: Number(rotationDelta.toFixed(3)),
        frameDelta,
        downDelta,
        upDelta,
        qaStepHookDelta,
        lastInputMode: after?.lastInputMode ?? null,
        lastKeyboardCode: after?.input?.lastKeyboardCode ?? null,
        activeKeysDuring: during?.input?.activeKeys ?? [],
        activeKeysAfter: after?.input?.activeKeys ?? [],
        ok:
          after?.lastInputMode === "keyboard" &&
          after?.input?.lastKeyboardCode === direction.key &&
          (during?.input?.activeKeys ?? []).includes(direction.activeKey) &&
          (after?.input?.activeKeys ?? []).length === 0 &&
          downDelta >= 1 &&
          upDelta >= 1 &&
          qaStepHookDelta === 0 &&
          frameDelta >= 6 &&
          axisDelta * direction.sign >= direction.minAxisDelta &&
          distance >= direction.minDistance &&
          rotationDelta >= (direction.minRotationDelta ?? 0)
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
        testedKeys: directions.map((direction) => direction.key)
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
    world.sceneryObjects >= 120 &&
    world.scenerySignatures >= 29 &&
    world.sceneryMotionObjects >= 20 &&
    world.identityRibbonObjects >= 60 &&
    world.identityRibbonSignatures >= 1 &&
    missingSceneryRoles.length === 0;
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
    world.projectArtifactReliefSignatures >= 24 &&
    world.projectArtifactPartCount >= world.projectArtifactObjects * 4 &&
    world.projectArtifactVertexCount >= 3_000 &&
    ["capsule", "crystal", "folio", "lens", "slab"].every((family) => projectArtifactSpecimenFamilies.has(family)) &&
    projectArtifactSpecimenFamilies.size === 5 &&
    projectArtifactDetailProfiles.size >= 5 &&
    projectArtifactReliefSignatures.size >= 24 &&
    projectArtifactThinZones.length === 0 &&
    world.sceneObjects <= 923;
  if (projectArtifactsMaterialized) {
    pass("project-artifact-materialized", {
      projectArtifactSpecimenFamilies: [...projectArtifactSpecimenFamilies].sort(),
      projectArtifactDetailProfiles: [...projectArtifactDetailProfiles].sort(),
      projectArtifactReliefSignatures: [...projectArtifactReliefSignatures].sort(),
      projectArtifactPartCount: world.projectArtifactPartCount,
      projectArtifactVertexCount: world.projectArtifactVertexCount,
      projectArtifactSceneObjects: world.projectArtifactSceneObjects,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: 923
    });
  } else {
    scenarioFail("project-artifact-materialized", "Project evidence kits are not detailed enough to read as premium specimens.", {
      projectArtifactSpecimenFamilies: [...projectArtifactSpecimenFamilies].sort(),
      projectArtifactDetailProfiles: [...projectArtifactDetailProfiles].sort(),
      projectArtifactReliefSignatures: [...projectArtifactReliefSignatures].sort(),
      projectArtifactPartCount: world?.projectArtifactPartCount,
      projectArtifactVertexCount: world?.projectArtifactVertexCount,
      projectArtifactSceneObjects: world?.projectArtifactSceneObjects,
      projectArtifactThinZones,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: 923
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
    world.routeSurfaceObjects === world.roadSegments + surface.routeCount &&
    world.routeSurfaceDetailParts >= surface.routeCount * 9 &&
    world.routeSurfaceDetailSignatures >= surface.routeCount * 6 &&
    world.routeSurfaceVertexCount >= 12_000 &&
    world.routeSurfaceVertexCount <= 24_000 &&
    world.sceneObjects <= 923;
  if (routeSurfaceMaterialized) {
    pass("route-surface-materialized", {
      routeSurfaceObjects: world.routeSurfaceObjects,
      routeSurfaceDetailParts: world.routeSurfaceDetailParts,
      routeSurfaceDetailSignatures: world.routeSurfaceDetailSignatures,
      routeSurfaceVertexCount: world.routeSurfaceVertexCount,
      routeSurfaceVertexBudget: 24_000,
      roadSegments: world.roadSegments,
      routeCount: surface.routeCount,
      sceneObjects: world.sceneObjects,
      sceneObjectBudget: 923
    });
  } else {
    scenarioFail("route-surface-materialized", "Playable roads are not materialized as detailed route ribbons.", {
      routeSurfaceObjects: world?.routeSurfaceObjects,
      routeSurfaceDetailParts: world?.routeSurfaceDetailParts,
      routeSurfaceDetailSignatures: world?.routeSurfaceDetailSignatures,
      routeSurfaceVertexCount: world?.routeSurfaceVertexCount,
      routeSurfaceVertexBudget: 24_000,
      roadSegments: world?.roadSegments,
      routeCount: surface?.routeCount,
      sceneObjects: world?.sceneObjects,
      sceneObjectBudget: 923
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
  const uiOcclusionOk = state.uiOccludedRatio <= maxUiOccludedRatio || mobilePanelCenterTolerated;
  const ok =
    state.artifact?.visible === true &&
    state.artifact?.center?.visible === true &&
    (state.artifact?.visibleRatio ?? 0) >= minVisibleRatio &&
    (state.artifact?.cornerDepthCount ?? 0) >= 2 &&
    state.artifact.width >= minWidth &&
    state.artifact.height >= minHeight &&
    state.artifact.clippedArea >= minArea &&
    artifactAreaRatio <= maxAreaRatio &&
    (state.centerOccluders.length === 0 || mobilePanelCenterTolerated) &&
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
    first.world.sceneObjects <= 923 &&
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
        visibleAfterUiRatio: round(Math.max(0, (rect?.visibleRatio ?? 0) * (1 - occlusion.ratio)))
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
    const placeArchitecture = layerState("placeArchitecture", qa?.screen?.activePlaceArchitecture ?? null);
    const signatureArtifact = layerState("signatureArtifact", qa?.screen?.activeSignatureArtifact ?? null);
    const composition = qa?.screen?.activeZoneComposition ?? null;
    const compositionUnion = composition?.union ?? null;
    const compositionOcclusion = uiOcclusion(compositionUnion);
    return {
      activeZoneId: qa?.activeZoneId ?? null,
      viewport: { width: window.innerWidth, height: window.innerHeight, area: window.innerWidth * window.innerHeight },
      uiRects: uiRects.map((rect) => rect.selector),
      landmark,
      placeArchitecture,
      signatureArtifact,
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
    composition: {
      minArea: isMobile ? Math.max(3_200, viewportArea * 0.01) : Math.max(9_000, viewportArea * 0.006),
      maxAreaRatio: isMobile ? 0.38 : 0.24,
      minVisibleAfterUiRatio: isMobile ? 0.38 : 0.5,
      maxUiOccludedRatio: isMobile ? 0.35 : 0.2,
      minBrightRatio: isMobile ? 0.035 : 0.045,
      minEdgeDensity: isMobile ? 0.018 : 0.024,
      minColorBuckets: isMobile ? 5 : 6,
      minCenterSpread: isMobile ? 5.5 : 7.5,
      maxCenterSpread: isMobile ? 190 : 280,
      maxPairOverlapRatio: 1.005,
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

  return ok;
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
      ? ["studio-gate", "ai-lab", "design-atelier", "contact-portal"]
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
      await inspectZonePerceptualProof(page, `mini-map:${targetId}`);
    } else {
      scenarioFail(`mini-map:${targetId}`, "Mini-map jump did not synchronize active zone and aria state.", {
        snapshot,
        pressed
      });
    }
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
  const driveActionability = await holdActionable(page, '.mobile-drive [data-drive="right"]', "mobile-drive:right", {
    minWidth: 44,
    minHeight: 44,
    delay: 550
  });
  if (!driveActionability) {
    return;
  }
  await page.waitForTimeout(260);
  const afterDrive = await getQaSnapshot(page);
  const deltaX = Math.abs((afterDrive?.player?.x ?? 0) - (beforeDrive?.player?.x ?? 0));

  if (afterDrive?.lastInputMode === "touch" && deltaX > 0.2) {
    pass("mobile-controls:drive", { before: beforeDrive?.player, after: afterDrive.player, deltaX, driveActionability });
  } else {
    scenarioFail("mobile-controls:drive", "Mobile drive control did not move the player through a real action.", {
      before: beforeDrive?.player,
      after: afterDrive?.player,
      lastInputMode: afterDrive?.lastInputMode,
      deltaX
    });
  }
}

async function writeReport() {
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

  await fsp.writeFile(reportJsonPath, `${JSON.stringify(summary, null, 2)}\n`);

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
  const visualScenario = scenarios.find((scenario) => scenario.name === "visual-specs-rendered");
  const placeArchitectureScenario = scenarios.find((scenario) => scenario.name === "place-architecture-rendered");
  const projectArtifactsScenario = scenarios.find((scenario) => scenario.name === "project-artifacts-rendered");
  const projectArtifactsMaterializedScenario = scenarios.find((scenario) => scenario.name === "project-artifact-materialized");
  const identityRibbonScenario = scenarios.find((scenario) => scenario.name === "identity-ribbon-rendered");
  const identityRibbonVisibleScenarios = scenarios.filter((scenario) => scenario.name.startsWith("identity-ribbon-visible:"));
  const playerScenario = scenarios.find((scenario) => scenario.name === "player-personality");
  const trailScenario = scenarios.find((scenario) => scenario.name === "rover-trail:keyboard-route");
  const activationScenarios = scenarios.filter((scenario) => scenario.name.startsWith("activation-feedback:"));
  const keyboardDirectionalScenario = scenarios.find((scenario) => scenario.name === "keyboard:directional-controls");
  const realDriveScenario = scenarios.find((scenario) => scenario.name === "real-drive-tour");
  const realDriveContinuityScenario = scenarios.find((scenario) => scenario.name === "real-drive-continuity");
  const realDriveKinematicsScenario = scenarios.find((scenario) => scenario.name === "real-drive-kinematics");
  const realDriveRouteScenario = scenarios.find((scenario) => scenario.name === "real-drive-route-adherence");
  const routeEncountersRenderedScenario = scenarios.find((scenario) => scenario.name === "route-encounters-rendered");
  const routeSurfaceMaterializedScenario = scenarios.find((scenario) => scenario.name === "route-surface-materialized");
  const routeEncounterTriggeredScenario = scenarios.find((scenario) => scenario.name === "route-encounter-triggered:real-drive");
  const routeEncounterVisibleScenarios = scenarios.filter((scenario) => scenario.name.startsWith("route-encounter-visible:"));
  const roverReadableScenarios = scenarios.filter((scenario) => scenario.name.startsWith("rover-readable:"));
  const sceneGraphHeadroomScenario = scenarios.find((scenario) => scenario.name === "scene-graph-headroom");
  const propClusterInstancingScenario = scenarios.find((scenario) => scenario.name === "prop-cluster-instancing");
  const productionRuntimeScenario = scenarios.find((scenario) => scenario.name === "production-runtime-lightweight");
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
  const perceptualDistanceScenario = scenarios.find((scenario) => scenario.name === "zone-perceptual-distance");
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
    `- Project artifact specimen families: ${world?.projectArtifactSpecimenFamilies ?? "n/a"}`,
    `- Project artifact detail profiles: ${world?.projectArtifactDetailProfiles ?? "n/a"}`,
    `- Project artifact relief signatures: ${world?.projectArtifactReliefSignatures ?? "n/a"}`,
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
    `- Scenery objects: ${world?.sceneryObjects ?? "n/a"}`,
    `- Scenery signatures: ${world?.scenerySignatures ?? "n/a"}`,
    `- Scenery motion objects: ${world?.sceneryMotionObjects ?? "n/a"}`,
    `- Scenery roles: ${
      world?.sceneryRoleCounts ? Object.entries(world.sceneryRoleCounts).map(([role, count]) => `${role}:${count}`).join(", ") : "n/a"
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
        ? `${realDriveScenario.details.distanceDelta} units over ${realDriveScenario.details.frameDelta} frames, polling max step ${realDriveScenario.details.maxStepDistance}, telemetry max step ${realDriveScenario.details.driveTelemetryMaxStep}, camera lag max ${realDriveScenario.details.maxCameraLag}, camera distance ${realDriveScenario.details.minCameraDistance}-${realDriveScenario.details.maxCameraDistance}, sticky active-zone offscreen samples ${realDriveScenario.details.invisibleActiveZoneSamples}`
        : "n/a"
    }`,
    `- Real drive continuity: ${
      realDriveContinuityScenario?.details
        ? `${realDriveContinuityScenario.details.distanceDelta} units, ${realDriveContinuityScenario.details.frameDelta} frames, max step ${realDriveContinuityScenario.details.driveTelemetryMaxStep}, active trail ${realDriveContinuityScenario.details.trail?.activeMarks ?? "n/a"}`
        : "n/a"
    }`,
    `- Real drive kinematics: ${
      realDriveKinematicsScenario?.details
        ? `${realDriveKinematicsScenario.details.sampleCount} samples, speed p95 ${realDriveKinematicsScenario.details.physicsP95Speed}, acceleration p95 ${realDriveKinematicsScenario.details.physicsP95Acceleration}, turn-rate p95 ${realDriveKinematicsScenario.details.physicsP95TurnRate}, max per-frame displacement ${realDriveKinematicsScenario.details.physicsMaxDisplacementPerFrame}`
        : "n/a"
    }`,
    `- Real drive route adherence: ${
      realDriveRouteScenario?.details?.surface
        ? `${realDriveRouteScenario.details.surface.routeAdherenceRatio} adherence, ${realDriveRouteScenario.details.surface.onRouteSamples}/${realDriveRouteScenario.details.surface.samples} on-route samples, routes ${realDriveRouteScenario.details.coveredExpectedRouteIds?.length ?? 0}/${realDriveRouteScenario.details.expectedRouteIds?.length ?? 0}`
        : "n/a"
    }`,
    `- Route encounters rendered: ${
      routeEncountersRenderedScenario?.details
        ? `${routeEncountersRenderedScenario.details.routeEncounterGates} gates, ${routeEncountersRenderedScenario.details.routeEncounterObjects} objects, scene ${routeEncountersRenderedScenario.details.sceneObjects}`
        : "n/a"
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
    await assertCanvasGeometry(page);
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
    await checkFrameBudget(page);
    await checkRealKeyboardInput(page);
    await checkRealKeyboardDirectionalControls(browser);
    await checkRealDriveTour(browser);
    await checkProductionRuntimeLightweight(browser);

    const targets = [
      { id: "ai-lab", position: { x: -7, z: -3 }, radius: 1.8, timeoutMs: 8_000 },
      { id: "design-atelier", position: { x: 6.9, z: -3.2 }, radius: 1.8, timeoutMs: 12_000 },
      { id: "contact-portal", position: { x: 0, z: -8.2 }, radius: 1.9, timeoutMs: 8_000 }
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
    await checkProjectArtifactVisualCoverage();
    await checkZonePerceptualDistance();
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
