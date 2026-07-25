import * as THREE from "three";
import { createZoneLandmark } from "./procedural-assets";
import { defaultZone, zones, type StudioZone, type ZoneKind } from "./zones";

const mapRange = 20;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const qaMode = new URLSearchParams(window.location.search).has("qa");
const playerSpeed = qaMode ? 15.5 : 7.4;

const colors: Record<ZoneKind | "ground" | "road" | "ink", number> = {
  tech: 0x17d2ff,
  art: 0xff6f7d,
  studio: 0xffe38a,
  ground: 0x12342c,
  road: 0xf8f0d4,
  ink: 0x101015
};

type DriveKey = "up" | "down" | "left" | "right";

type QaSnapshot = {
  ready: boolean;
  activeZoneId: string;
  activeZoneLabel: string;
  zoneCount: number;
  player: { x: number; z: number };
  canvas: { width: number; height: number; dpr: number };
  frameCount: number;
  averageFrameMs: number;
  visitedZoneIds: string[];
  reducedMotion: boolean;
  lastInputMode: "keyboard" | "pointer" | "touch" | "programmatic" | "none";
  errors: string[];
};

declare global {
  interface Window {
    __IT_ART_STUDIO_QA__?: QaSnapshot;
  }
}

class StudioGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly zoneMeshes = new Map<string, THREE.Object3D>();
  private readonly keys = new Set<DriveKey>();
  private readonly player = new THREE.Group();
  private readonly errors: string[] = [];
  private readonly playerPosition = new THREE.Vector3(0, 0.28, 0);
  private readonly targetPosition = new THREE.Vector3(0, 0.28, 0);
  private activeZoneId = defaultZone.id;
  private frameId = 0;
  private lastFrameTime = performance.now();
  private frameCount = 0;
  private readonly frameDeltas: number[] = [];
  private readonly visitedZoneIds = new Set<string>([defaultZone.id]);
  private readonly qaSnapshot: QaSnapshot = {
    ready: false,
    activeZoneId: defaultZone.id,
    activeZoneLabel: defaultZone.label,
    zoneCount: zones.length,
    player: { x: 0, z: 0 },
    canvas: { width: 0, height: 0, dpr: 1 },
    frameCount: 0,
    averageFrameMs: 0,
    visitedZoneIds: [defaultZone.id],
    reducedMotion: motionQuery.matches,
    lastInputMode: "none",
    errors: []
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio < 2,
      alpha: false,
      preserveDrawingBuffer: qaMode,
      powerPreference: "high-performance"
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  start() {
    this.setScene();
    this.setWorld();
    this.setPlayer();
    this.setEvents();
    this.resize();
    this.updatePanel(defaultZone);
    this.exposeQaSnapshot();
    this.animate();
  }

  private setScene() {
    this.scene.background = new THREE.Color(0x07100e);
    this.scene.fog = new THREE.Fog(0x07100e, 14, 34);

    const hemi = new THREE.HemisphereLight(0xfff0d0, 0x0b1624, 2.2);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-6, 11, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -14;
    key.shadow.camera.right = 14;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    this.scene.add(key);

    this.camera.position.set(8, 9, 8);
    this.camera.lookAt(0, 0, 0);
  }

  private setWorld() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(12.8, 7),
      new THREE.MeshStandardMaterial({
        color: colors.ground,
        roughness: 0.86,
        metalness: 0.05
      })
    );
    ground.rotation.x = -Math.PI * 0.5;
    ground.rotation.z = Math.PI * 0.06;
    ground.scale.set(1.12, 1, 0.88);
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.addRoads();

    for (const zone of zones) {
      this.addZone(zone);
    }
  }

  private addRoads() {
    const material = new THREE.LineBasicMaterial({
      color: colors.road,
      transparent: true,
      opacity: 0.34
    });

    for (const zone of zones.slice(1)) {
      const points = [
        new THREE.Vector3(0, 0.035, 0),
        new THREE.Vector3(zone.position[0], 0.035, zone.position[1])
      ];
      this.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    }
  }

  private addZone(zone: StudioZone) {
    const group = new THREE.Group();
    group.name = zone.id;
    group.position.set(zone.position[0], 0, zone.position[1]);
    group.userData.zoneId = zone.id;

    const accent = colors[zone.kind];
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(zone.radius, zone.radius * 1.08, 0.22, zone.kind === "studio" ? 10 : 7),
      new THREE.MeshStandardMaterial({
        color: accent,
        roughness: 0.72,
        metalness: 0.08,
        emissive: accent,
        emissiveIntensity: 0.08
      })
    );
    base.position.y = 0.11;
    base.userData.zoneId = zone.id;
    group.add(base);

    const marker = createZoneLandmark(zone, colors);
    marker.userData.zoneId = zone.id;
    group.add(marker);

    const label = this.createLabel(zone.shortLabel, accent);
    label.position.set(0, 1.78, 0);
    group.add(label);

    this.zoneMeshes.set(zone.id, group);
    this.scene.add(group);
  }

  private createLabel(text: string, accent: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const context = canvas.getContext("2d");

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(5, 8, 9, 0.78)";
      context.fillRect(0, 36, canvas.width, 88);
      context.strokeStyle = `#${accent.toString(16).padStart(6, "0")}`;
      context.lineWidth = 6;
      context.strokeRect(5, 41, canvas.width - 10, 78);
      context.fillStyle = "#fff7de";
      context.font = "700 62px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, canvas.width / 2, 82);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      })
    );
    sprite.scale.set(1.72, 0.54, 1);
    return sprite;
  }

  private setPlayer() {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff2b0,
      roughness: 0.45,
      metalness: 0.16,
      emissive: 0xffc847,
      emissiveIntensity: 0.18
    });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x121217, roughness: 0.8 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.34, 1.08), bodyMaterial);
    body.position.y = 0.42;
    this.player.add(body);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.42), bodyMaterial);
    nose.position.set(0, 0.54, -0.42);
    this.player.add(nose);

    for (const x of [-0.48, 0.48]) {
      for (const z of [-0.42, 0.42]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 16), wheelMaterial);
        wheel.rotation.z = Math.PI * 0.5;
        wheel.position.set(x, 0.22, z);
        this.player.add(wheel);
      }
    }

    this.player.position.copy(this.playerPosition);
    this.scene.add(this.player);
  }

  private setEvents() {
    window.addEventListener("resize", () => this.resize());

    window.addEventListener("keydown", (event) => {
      const key = this.keyFromEvent(event);
      if (key) {
        event.preventDefault();
        this.qaSnapshot.lastInputMode = "keyboard";
        this.keys.add(key);
        if (qaMode && !event.repeat) {
          this.applyQaKeyboardStep(key);
        }
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = this.keyFromEvent(event);
      if (key) {
        this.keys.delete(key);
      }
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.qaSnapshot.lastInputMode = event.pointerType === "touch" ? "touch" : "pointer";
      this.handleCanvasPointer(event);
    });

    document.querySelectorAll<HTMLButtonElement>("[data-zone-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        const zone = zones.find((item) => item.id === button.dataset.zoneJump);
        if (zone) {
          this.qaSnapshot.lastInputMode = "pointer";
          this.moveToZone(zone);
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>("[data-drive]").forEach((button) => {
      const direction = button.dataset.drive as DriveKey | undefined;
      if (!direction) {
        return;
      }
      const start = () => {
        this.qaSnapshot.lastInputMode = "touch";
        this.keys.add(direction);
      };
      const end = () => this.keys.delete(direction);
      button.addEventListener("pointerdown", start);
      button.addEventListener("pointerup", end);
      button.addEventListener("pointerleave", end);
      button.addEventListener("blur", end);
    });
  }

  private keyFromEvent(event: KeyboardEvent): DriveKey | null {
    if (event.code === "ArrowUp" || event.code === "KeyW") return "up";
    if (event.code === "ArrowDown" || event.code === "KeyS") return "down";
    if (event.code === "ArrowLeft" || event.code === "KeyA") return "left";
    if (event.code === "ArrowRight" || event.code === "KeyD") return "right";
    return null;
  }

  private applyQaKeyboardStep(direction: DriveKey) {
    const step = 1.05;
    if (direction === "up") this.playerPosition.z -= step;
    if (direction === "down") this.playerPosition.z += step;
    if (direction === "left") this.playerPosition.x -= step;
    if (direction === "right") this.playerPosition.x += step;

    this.playerPosition.x = clamp(this.playerPosition.x, -9.4, 9.4);
    this.playerPosition.z = clamp(this.playerPosition.z, -9.4, 9.4);
    this.targetPosition.copy(this.playerPosition);
    this.player.position.copy(this.playerPosition);
    this.updateActiveZone();
    this.updateMiniMap();
    this.syncQaSnapshot();
  }

  private handleCanvasPointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects([...this.zoneMeshes.values()], true);
    const zoneId = intersects.find((item) => typeof item.object.userData.zoneId === "string")?.object.userData.zoneId;
    const zone = zones.find((item) => item.id === zoneId);

    if (zone) {
      this.moveToZone(zone);
    }
  }

  private moveToZone(zone: StudioZone) {
    if (this.qaSnapshot.lastInputMode === "none") {
      this.qaSnapshot.lastInputMode = "programmatic";
    }
    this.targetPosition.set(zone.position[0], 0.28, zone.position[1]);
    this.updatePanel(zone);
  }

  private resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const frustum = aspect > 1 ? 12.5 : 15.5;

    this.camera.left = (-frustum * aspect) / 2;
    this.camera.right = (frustum * aspect) / 2;
    this.camera.top = frustum / 2;
    this.camera.bottom = -frustum / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(width, height);
    this.syncQaSnapshot();
  }

  private animate = () => {
    this.frameId = window.requestAnimationFrame(this.animate);
    const now = performance.now();
    const rawDeltaMs = now - this.lastFrameTime;
    const delta = Math.min(rawDeltaMs / 1000, qaMode ? 0.18 : 0.05);
    this.lastFrameTime = now;
    this.frameCount += 1;
    this.frameDeltas.push(rawDeltaMs);
    if (this.frameDeltas.length > 90) {
      this.frameDeltas.shift();
    }

    this.updatePlayer(delta);
    this.updateActiveZone();
    this.updateWorldMotion(delta);
    this.updateCamera(delta);
    this.updateMiniMap();
    this.renderer.render(this.scene, this.camera);
    this.markReady();
    this.syncQaSnapshot();
  };

  private updatePlayer(delta: number) {
    const direction = new THREE.Vector3();
    if (this.keys.has("up")) direction.z -= 1;
    if (this.keys.has("down")) direction.z += 1;
    if (this.keys.has("left")) direction.x -= 1;
    if (this.keys.has("right")) direction.x += 1;

    const previousPosition = this.playerPosition.clone();

    if (direction.lengthSq() > 0) {
      direction.normalize();
      this.playerPosition.add(direction.multiplyScalar(delta * playerSpeed));
      this.targetPosition.copy(this.playerPosition);
    } else {
      this.playerPosition.lerp(this.targetPosition, 1 - Math.pow(0.0008, delta));
    }

    this.playerPosition.x = clamp(this.playerPosition.x, -9.4, 9.4);
    this.playerPosition.z = clamp(this.playerPosition.z, -9.4, 9.4);
    this.targetPosition.x = clamp(this.targetPosition.x, -9.4, 9.4);
    this.targetPosition.z = clamp(this.targetPosition.z, -9.4, 9.4);

    const travel = this.playerPosition.clone().sub(previousPosition);
    this.player.position.copy(this.playerPosition);

    if (travel.lengthSq() > 0.0001) {
      const targetRotation = Math.atan2(travel.x, travel.z);
      this.player.rotation.y += (targetRotation - this.player.rotation.y) * 0.14;
    }
  }

  private updateWorldMotion(delta: number) {
    if (motionQuery.matches) {
      return;
    }

    for (const zone of zones) {
      const mesh = this.zoneMeshes.get(zone.id);
      if (!mesh) {
        continue;
      }
      const active = zone.id === this.activeZoneId;
      mesh.rotation.y += delta * (active ? 0.45 : 0.12);
      const targetScale = active ? 1.12 : 1;
      mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.002, delta));
    }
  }

  private updateCamera(delta: number) {
    const target = this.playerPosition;
    const desired = new THREE.Vector3(target.x + 8, 9.4, target.z + 8);
    this.camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
    this.camera.lookAt(target.x, 0, target.z);
  }

  private updateActiveZone() {
    let closest = defaultZone;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const zone of zones) {
      const distance = Math.hypot(this.playerPosition.x - zone.position[0], this.playerPosition.z - zone.position[1]);
      if (distance < zone.radius && distance < closestDistance) {
        closest = zone;
        closestDistance = distance;
      }
    }

    if (closest.id !== this.activeZoneId) {
      this.updatePanel(closest);
    }
  }

  private updatePanel(zone: StudioZone) {
    this.activeZoneId = zone.id;
    this.visitedZoneIds.add(zone.id);
    document.querySelector("[data-game-root]")?.setAttribute("data-active-zone", zone.id);
    document.querySelector("[data-active-kind]")?.replaceChildren(zone.kind);
    document.querySelector("[data-active-label]")?.replaceChildren(zone.label);
    document.querySelector("[data-zone-kind]")?.replaceChildren(zone.kind);
    document.querySelector("[data-zone-title]")?.replaceChildren(zone.title);
    document.querySelector("[data-zone-summary]")?.replaceChildren(zone.summary);
    document.querySelector("[data-zone-details]")?.replaceChildren(zone.details);

    const signalList = document.querySelector("[data-zone-signals]");
    if (signalList) {
      signalList.replaceChildren(
        ...zone.signals.map((signal) => {
          const item = document.createElement("li");
          item.textContent = signal;
          return item;
        })
      );
    }

    const cta = document.querySelector<HTMLAnchorElement>("[data-zone-cta]");
    if (cta) {
      const hasCta = Boolean(zone.cta);
      cta.href = zone.cta ?? "#";
      cta.setAttribute("aria-hidden", String(!hasCta));
      cta.tabIndex = hasCta ? 0 : -1;
    }

    document.querySelectorAll<HTMLButtonElement>("[data-zone-jump]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.zoneJump === zone.id));
    });
  }

  private markReady() {
    if (this.qaSnapshot.ready) {
      return;
    }

    this.qaSnapshot.ready = true;
    document.documentElement.classList.add("game-ready");
    document.documentElement.dataset.gameState = "ready";
    document.querySelector("[data-game-loader]")?.remove();
  }

  private exposeQaSnapshot() {
    window.__IT_ART_STUDIO_QA__ = this.qaSnapshot;
  }

  private syncQaSnapshot() {
    const averageFrameMs =
      this.frameDeltas.length > 0
        ? this.frameDeltas.reduce((sum, item) => sum + item, 0) / this.frameDeltas.length
        : 0;
    const activeZone = zones.find((zone) => zone.id === this.activeZoneId) ?? defaultZone;

    this.qaSnapshot.activeZoneId = activeZone.id;
    this.qaSnapshot.activeZoneLabel = activeZone.label;
    this.qaSnapshot.player = {
      x: Number(this.playerPosition.x.toFixed(3)),
      z: Number(this.playerPosition.z.toFixed(3))
    };
    this.qaSnapshot.canvas = {
      width: this.canvas.width,
      height: this.canvas.height,
      dpr: this.renderer.getPixelRatio()
    };
    this.qaSnapshot.frameCount = this.frameCount;
    this.qaSnapshot.averageFrameMs = Number(averageFrameMs.toFixed(2));
    this.qaSnapshot.visitedZoneIds = [...this.visitedZoneIds];
    this.qaSnapshot.reducedMotion = motionQuery.matches;
    this.qaSnapshot.errors = [...this.errors];
  }

  private updateMiniMap() {
    const marker = document.querySelector<HTMLElement>("[data-map-player]");
    if (!marker) {
      return;
    }

    marker.style.left = `${((this.playerPosition.x + mapRange / 2) / mapRange) * 100}%`;
    marker.style.top = `${((this.playerPosition.z + mapRange / 2) / mapRange) * 100}%`;
  }

  destroy() {
    window.cancelAnimationFrame(this.frameId);
    this.renderer.dispose();
  }
}

const boot = () => {
  const canvas = document.querySelector<HTMLCanvasElement>("#studio-map-canvas");
  if (!canvas) {
    return;
  }

  try {
    const game = new StudioGame(canvas);
    game.start();
    window.addEventListener("pagehide", () => game.destroy(), { once: true });
  } catch (error) {
    console.error(error);
    document.documentElement.classList.add("game-fallback");
    document.documentElement.dataset.gameState = "fallback";
    document.querySelector("[data-game-loader]")?.replaceChildren("Mode carte statique");
  }
};

boot();
