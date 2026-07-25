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

function maxPositionSampleStep(samples = []) {
  let maxStep = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1];
    const current = samples[index];
    maxStep = Math.max(maxStep, Math.hypot((current?.x ?? 0) - (previous?.x ?? 0), (current?.z ?? 0) - (previous?.z ?? 0)));
  }
  return maxStep;
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

async function driveWithRealKeyboard(page, target) {
  const samples = [];
  let reached = false;
  const started = Date.now();
  let maxSampleStepDistance = 0;
  let previousPlayer = null;

  while (Date.now() - started < (target.timeoutMs ?? 10_000)) {
    const snapshot = await getQaSnapshot(page);
    if (snapshot?.player) {
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
        screen: snapshot.screen
      });

      if (snapshot.activeZoneId === target.id) {
        reached = true;
        break;
      }

      const dx = target.position.x - player.x;
      const dz = target.position.z - player.z;
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
    } else {
      await page.waitForTimeout(120);
    }
  }

  await releaseDriveKeys(page);
  return { reached, elapsedMs: Date.now() - started, samples, maxSampleStepDistance };
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
      { id: "ai-lab", position: { x: -7, z: -3 }, timeoutMs: 10_000 },
      { id: "observability-tower", position: { x: -8, z: 3 }, timeoutMs: 10_000 },
      { id: "design-atelier", position: { x: 6.9, z: -3.2 }, timeoutMs: 12_000 },
      { id: "contact-portal", position: { x: 0, z: -8.2 }, timeoutMs: 10_000 }
    ];
    const routeResults = [];

    for (const target of targets) {
      const beforeActivation = await getQaSnapshot(page);
      const result = await driveWithRealKeyboard(page, target);
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

    await capture(page, "real-drive-tour");
  } finally {
    await releaseDriveKeys(page);
    await page.close();
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
          if (performance.now() - started >= 650) {
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
  const snapshot = await getQaSnapshot(page);
  const world = snapshot?.world;
  const expectedSceneryRoles = ["terrain-edge", "tech-skyline", "art-sculpture", "studio-threshold", "route-light"];
  const missingSceneryRoles = expectedSceneryRoles.filter((role) => !world?.sceneryRoleCounts?.[role]);
  const hasWorldComposition =
    world &&
    world.terrainLayers >= 5 &&
    world.sceneryObjects >= 60 &&
    world.scenerySignatures >= 24 &&
    world.sceneryMotionObjects >= 20 &&
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
  const localMotionBehaviorTypes = new Set(
    visualSpecZones.flatMap((zone) => Object.keys(zone.localMotionBehaviors ?? {}))
  );
  const visualSpecRendered =
    world &&
    visualSpecZones.length === snapshot.zoneCount &&
    world.visualSpecs === snapshot.zoneCount &&
    world.visualDecals >= snapshot.zoneCount * 3 &&
    world.propClusters >= snapshot.zoneCount * 3 &&
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
      setDressingSignatures: allSetDressingSignatures,
      localMotionBehaviorTypes: [...localMotionBehaviorTypes].sort(),
      fingerprints: visualSpecZones.map((zone) => zone.visualFingerprint)
    });
  } else {
    scenarioFail("visual-specs-rendered", "ZoneVisualSpec declarations are not fully materialized in the scene graph.", {
      visualSpecs: world?.visualSpecs,
      visualDecals: world?.visualDecals,
      propClusters: world?.propClusters,
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
      duplicateSetDressingFingerprints,
      duplicateSetDressingSignatures,
      duplicateSignatureArtifactSignatures,
      thinSignatureArtifactZones,
      localMotionBehaviorTypes: [...localMotionBehaviorTypes].sort(),
      thinZones,
      zones: visualSpecZones
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
  const stats = {
    durationMs,
    beforeFrameCount,
    afterFrameCount,
    frameDelta,
    avgFrameMs: Number(avgFrameMs.toFixed(2)),
    approxFps: Number(approxFps.toFixed(1)),
    snapshotAverageFrameMs: Number((after?.averageFrameMs ?? 0).toFixed(2))
  };

  const withinBudget = frameDelta >= 85 && approxFps >= 14 && avgFrameMs <= 75;
  if (withinBudget) {
    pass(`performance:${label}-frame-budget`, stats);
  } else {
    scenarioFail(`performance:${label}-frame-budget`, "Runtime frame budget exceeded during live QA sampling.", stats);
  }
}

async function inspectCameraSafeArea(page, label) {
  const snapshot = await getQaSnapshot(page);
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
  const snapshot = await getQaSnapshot(page);
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
      const canvas = document.querySelector("canvas");
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
        await page.waitForTimeout(300);
        await inspectSignatureArtifactVisibility(page, `mini-map:${targetId}`);
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
      await page.waitForTimeout(300);
      await inspectSignatureArtifactVisibility(page, `mini-map:${targetId}`);
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
  const playerScenario = scenarios.find((scenario) => scenario.name === "player-personality");
  const trailScenario = scenarios.find((scenario) => scenario.name === "rover-trail:keyboard-route");
  const activationScenarios = scenarios.filter((scenario) => scenario.name.startsWith("activation-feedback:"));
  const realDriveScenario = scenarios.find((scenario) => scenario.name === "real-drive-tour");
  const productionRuntimeScenario = scenarios.find((scenario) => scenario.name === "production-runtime-lightweight");
  const cameraSafeScenarios = scenarios.filter((scenario) => scenario.name.startsWith("camera-safe-area:"));
  const signatureVisibleScenarios = scenarios.filter((scenario) => scenario.name.startsWith("signature-artifact-visible:"));
  const miniMapSignatureVisibleScenarios = signatureVisibleScenarios.filter((scenario) =>
    scenario.name.startsWith("signature-artifact-visible:mini-map:")
  );
  const weakestSignatureScenario = signatureVisibleScenarios
    .filter((scenario) => typeof scenario.details?.visibleAfterUiRatio === "number")
    .sort((a, b) => a.details.visibleAfterUiRatio - b.details.visibleAfterUiRatio)[0];
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
    `- Visual specs: ${world?.visualSpecs ?? "n/a"}`,
    `- Visual decals: ${world?.visualDecals ?? "n/a"}`,
    `- Prop clusters: ${world?.propClusters ?? "n/a"}`,
    `- Set dressing objects: ${world?.setDressingObjects ?? "n/a"}`,
    `- Set dressing signatures: ${world?.setDressingSignatures ?? "n/a"}`,
    `- Signature artifact objects: ${world?.signatureArtifactObjects ?? "n/a"}`,
    `- Signature artifact signatures: ${world?.signatureArtifactSignatures ?? "n/a"}`,
    `- Terrain layers: ${world?.terrainLayers ?? "n/a"}`,
    `- Scenery objects: ${world?.sceneryObjects ?? "n/a"}`,
    `- Scenery signatures: ${world?.scenerySignatures ?? "n/a"}`,
    `- Scenery motion objects: ${world?.sceneryMotionObjects ?? "n/a"}`,
    `- Scenery roles: ${
      world?.sceneryRoleCounts ? Object.entries(world.sceneryRoleCounts).map(([role, count]) => `${role}:${count}`).join(", ") : "n/a"
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
    `- Real drive tour: ${
      realDriveScenario?.details
        ? `${realDriveScenario.details.distanceDelta} units over ${realDriveScenario.details.frameDelta} frames, polling max step ${realDriveScenario.details.maxStepDistance}, telemetry max step ${realDriveScenario.details.driveTelemetryMaxStep}, camera lag max ${realDriveScenario.details.maxCameraLag}, camera distance ${realDriveScenario.details.minCameraDistance}-${realDriveScenario.details.maxCameraDistance}, sticky active-zone offscreen samples ${realDriveScenario.details.invisibleActiveZoneSamples}`
        : "n/a"
    }`,
    `- Production runtime lightweight: ${
      productionRuntimeScenario?.details
        ? `ready ${productionRuntimeScenario.details.ready}, QA snapshot ${productionRuntimeScenario.details.hasQaSnapshot}, QA step ${productionRuntimeScenario.details.hasQaStep}, frames ${productionRuntimeScenario.details.frames}`
        : "n/a"
    }`,
    `- Camera safe-area checks: ${cameraSafeScenarios.filter((scenario) => scenario.status === "pass").length}/${
      cameraSafeScenarios.length
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
    await checkFrameBudget(page);
    await checkRealKeyboardInput(page);
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
      await capture(page, target.id);
    }
    await checkRoverTrail(page, "keyboard-route");

    await checkContact(page);
    await checkMiniMapJumps(page);
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
      await checkMobileControls(page);
      await checkViewport(page, { width: 320, height: 700 }, "mobile-small");
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
