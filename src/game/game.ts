import * as THREE from "three";
import { defaultZone, zones, type StudioZone, type ZoneKind } from "./zones";

const mapRange = 20;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

const colors: Record<ZoneKind | "ground" | "road" | "ink", number> = {
  tech: 0x17d2ff,
  art: 0xff6f7d,
  studio: 0xffe38a,
  ground: 0x12342c,
  road: 0xf8f0d4,
  ink: 0x101015
};

type DriveKey = "up" | "down" | "left" | "right";

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
  private readonly playerPosition = new THREE.Vector3(0, 0.28, 0);
  private readonly targetPosition = new THREE.Vector3(0, 0.28, 0);
  private activeZoneId = defaultZone.id;
  private frameId = 0;
  private lastFrameTime = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: window.devicePixelRatio < 2,
      alpha: false,
      powerPreference: "high-performance"
    });
  }

  start() {
    document.documentElement.classList.add("game-ready");
    document.querySelector("[data-game-loader]")?.remove();

    this.setScene();
    this.setWorld();
    this.setPlayer();
    this.setEvents();
    this.resize();
    this.updatePanel(defaultZone);
    this.animate();
  }

  private setScene() {
    this.scene.background = new THREE.Color(0x07100e);
    this.scene.fog = new THREE.Fog(0x07100e, 14, 34);

    const hemi = new THREE.HemisphereLight(0xfff0d0, 0x0b1624, 2.2);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-6, 11, 8);
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

    const marker = this.createMarker(zone);
    marker.userData.zoneId = zone.id;
    group.add(marker);

    const label = this.createLabel(zone.shortLabel, accent);
    label.position.set(0, 1.78, 0);
    group.add(label);

    this.zoneMeshes.set(zone.id, group);
    this.scene.add(group);
  }

  private createMarker(zone: StudioZone) {
    const accent = colors[zone.kind];
    const material = new THREE.MeshStandardMaterial({
      color: accent,
      roughness: 0.54,
      metalness: zone.kind === "tech" ? 0.42 : 0.12,
      emissive: accent,
      emissiveIntensity: 0.18
    });

    if (zone.kind === "tech") {
      const tower = new THREE.Group();
      for (let index = 0; index < 3; index++) {
        const block = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9 + index * 0.28, 0.55), material);
        block.position.set((index - 1) * 0.52, 0.62 + index * 0.14, (index % 2) * 0.3);
        tower.add(block);
      }
      return tower;
    }

    if (zone.kind === "art") {
      const shape = new THREE.Mesh(new THREE.TorusKnotGeometry(0.44, 0.14, 72, 8), material);
      shape.position.y = 0.84;
      shape.rotation.x = Math.PI * 0.16;
      return shape;
    }

    const studio = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), material);
    core.position.y = 0.92;
    studio.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.055, 8, 48), material);
    ring.position.y = 0.88;
    ring.rotation.x = Math.PI * 0.5;
    studio.add(ring);
    return studio;
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
        this.keys.add(key);
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = this.keyFromEvent(event);
      if (key) {
        this.keys.delete(key);
      }
    });

    this.canvas.addEventListener("pointerdown", (event) => this.handleCanvasPointer(event));

    document.querySelectorAll<HTMLButtonElement>("[data-zone-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        const zone = zones.find((item) => item.id === button.dataset.zoneJump);
        if (zone) {
          this.moveToZone(zone);
        }
      });
    });

    document.querySelectorAll<HTMLButtonElement>("[data-drive]").forEach((button) => {
      const direction = button.dataset.drive as DriveKey | undefined;
      if (!direction) {
        return;
      }
      const start = () => this.keys.add(direction);
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
  }

  private animate = () => {
    this.frameId = window.requestAnimationFrame(this.animate);
    const now = performance.now();
    const delta = Math.min((now - this.lastFrameTime) / 1000, 0.04);
    this.lastFrameTime = now;

    this.updatePlayer(delta);
    this.updateActiveZone();
    this.updateWorldMotion(delta);
    this.updateCamera(delta);
    this.updateMiniMap();
    this.renderer.render(this.scene, this.camera);
  };

  private updatePlayer(delta: number) {
    const direction = new THREE.Vector3();
    if (this.keys.has("up")) direction.z -= 1;
    if (this.keys.has("down")) direction.z += 1;
    if (this.keys.has("left")) direction.x -= 1;
    if (this.keys.has("right")) direction.x += 1;

    if (direction.lengthSq() > 0) {
      direction.normalize();
      this.targetPosition.copy(this.playerPosition).add(direction.multiplyScalar(delta * 6.2));
    }

    this.targetPosition.x = clamp(this.targetPosition.x, -9.4, 9.4);
    this.targetPosition.z = clamp(this.targetPosition.z, -9.4, 9.4);

    this.playerPosition.lerp(this.targetPosition, 1 - Math.pow(0.0008, delta));
    const travel = this.targetPosition.clone().sub(this.player.position);
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
    document.querySelector("[data-game-loader]")?.replaceChildren("Mode carte statique");
  }
};

boot();
