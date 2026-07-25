import * as THREE from "three";
import { createZoneLandmark } from "./procedural-assets";
import { createWorldScenery } from "./world-scenery";
import { createZoneSetDressing } from "./zone-set-dressing";
import { zoneVisualSpecs, type ZoneVisualSpec } from "./visual-specs";
import { renderZoneVisuals } from "./zone-visual-renderer";
import { defaultZone, worldRoutes, zones, type StudioZone, type ZoneKind } from "./zones";

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

type BoundsQa = { width: number; height: number; depth: number };
type TrailMark = { mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>; age: number; maxAge: number };

type ZoneAssetQa = {
  id: string;
  meshCount: number;
  landmarkObjects: number;
  visualSpecId: string | null;
  biome: string | null;
  visualDecals: number;
  propClusters: number;
  propObjects: number;
  setDressingObjects: number;
  setDressingRoles: string[];
  setDressingSignatures: string[];
  materialVariants: number;
  declaredMaterialVariants: string[];
  renderedMaterialVariants: string[];
  missingMaterialVariants: string[];
  expectedVisuals: { decals: number; propClusters: number; propObjects: number; materialVariants: number };
  expectedAnimation: { idleSpin: number; activeSpin: number; activeScale: number; pulse: number } | null;
  appliedAnimation: { idleSpin: number; activeSpin: number; activeScale: number; pulse: number } | null;
  animationMatchesSpec: boolean;
  motionObjectCount: number;
  motionRoleCounts: Record<string, number>;
  localMotionBehaviors: Record<string, number>;
  visualFingerprint: string;
  setDressingFingerprint: string;
  hasLabel: boolean;
  bounds: BoundsQa;
};

type QaSnapshot = {
  ready: boolean;
  activeZoneId: string;
  activeZoneLabel: string;
  zoneCount: number;
  world: {
    sceneObjects: number;
    decorativeObjects: number;
    roadSegments: number;
    landmarkObjects: number;
    playerParts: number;
    visualSpecs: number;
    visualDecals: number;
    propClusters: number;
    setDressingObjects: number;
    setDressingSignatures: number;
    sceneryObjects: number;
    scenerySignatures: number;
    sceneryMotionObjects: number;
    sceneryRoleCounts: Record<string, number>;
    terrainLayers: number;
    materialVariants: number;
    motionRoles: number;
    motionRolesByType: Record<string, number>;
    zones: ZoneAssetQa[];
  };
  player: { x: number; z: number; rotationY: number; meshCount: number; wheelCount: number; bounds: BoundsQa };
  trail: { totalMarks: number; activeMarks: number; maxOpacity: number };
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
    __IT_ART_STUDIO_QA_STEP__?: (direction: DriveKey) => void;
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
  private readonly trailGroup = new THREE.Group();
  private readonly errors: string[] = [];
  private readonly playerPosition = new THREE.Vector3(0, 0.28, 0);
  private readonly targetPosition = new THREE.Vector3(0, 0.28, 0);
  private activeZoneId = defaultZone.id;
  private frameId = 0;
  private lastFrameTime = performance.now();
  private lastQaSyncTime = 0;
  private elapsedTime = 0;
  private frameCount = 0;
  private decorativeObjectCount = 0;
  private roadSegmentCount = 0;
  private visualDecalCount = 0;
  private propClusterCount = 0;
  private setDressingObjectCount = 0;
  private sceneryObjectCount = 0;
  private terrainLayerCount = 0;
  private motionRoleCount = 0;
  private playerPartCount = 0;
  private readonly renderedVisualSpecIds = new Set<string>();
  private readonly materialVariantIds = new Set<string>();
  private readonly setDressingSignatureIds = new Set<string>();
  private readonly scenerySignatureIds = new Set<string>();
  private readonly zoneMotionObjects = new Map<string, THREE.Object3D[]>();
  private readonly worldSceneryMotionObjects: THREE.Object3D[] = [];
  private readonly wheelMeshes: THREE.Mesh[] = [];
  private readonly trailMarks: TrailMark[] = [];
  private readonly frameDeltas: number[] = [];
  private readonly visitedZoneIds = new Set<string>([defaultZone.id]);
  private trailCursor = 0;
  private trailDistance = 0;
  private readonly qaSnapshot: QaSnapshot = {
    ready: false,
    activeZoneId: defaultZone.id,
    activeZoneLabel: defaultZone.label,
    zoneCount: zones.length,
    world: {
      sceneObjects: 0,
      decorativeObjects: 0,
      roadSegments: 0,
      landmarkObjects: 0,
      playerParts: 0,
      visualSpecs: 0,
      visualDecals: 0,
      propClusters: 0,
      setDressingObjects: 0,
      setDressingSignatures: 0,
      sceneryObjects: 0,
      scenerySignatures: 0,
      sceneryMotionObjects: 0,
      sceneryRoleCounts: {},
      terrainLayers: 0,
      materialVariants: 0,
      motionRoles: 0,
      motionRolesByType: {},
      zones: []
    },
    player: { x: 0, z: 0, rotationY: 0, meshCount: 0, wheelCount: 0, bounds: { width: 0, height: 0, depth: 0 } },
    trail: { totalMarks: 0, activeMarks: 0, maxOpacity: 0 },
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
      antialias: !qaMode && window.devicePixelRatio < 2,
      alpha: false,
      preserveDrawingBuffer: qaMode,
      powerPreference: "high-performance"
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
  }

  start() {
    this.setScene();
    this.setWorld();
    this.setPlayer();
    this.setPlayerTrail();
    this.setEvents();
    this.resize();
    this.updatePanel(defaultZone);
    this.exposeQaSnapshot();
    this.exposeQaControls();
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

    this.addDistrictPlates();
    this.addWorldScenery();
    this.addRoads();
    this.addWorldProps();

    for (const zone of zones) {
      this.addZone(zone);
    }
  }

  private addWorldScenery() {
    const rendered = createWorldScenery(colors);
    this.scene.add(rendered.group);
    this.sceneryObjectCount += rendered.objectCount;
    this.terrainLayerCount += rendered.terrainLayers;
    this.decorativeObjectCount += rendered.objectCount;
    this.motionRoleCount += rendered.motionObjects.length;
    this.worldSceneryMotionObjects.push(...rendered.motionObjects);
    for (const signature of rendered.signatures) {
      this.scenerySignatureIds.add(signature);
    }
  }

  private createDistrictPlate(points: Array<readonly [number, number]>, color: number, opacity: number) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], index) => {
      if (index === 0) {
        shape.moveTo(x, -z);
      } else {
        shape.lineTo(x, -z);
      }
    });
    shape.closePath();

    const plate = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.92,
        metalness: 0.02,
        transparent: true,
        opacity,
        depthWrite: false
      })
    );
    plate.rotation.x = -Math.PI * 0.5;
    plate.position.y = 0.018;
    plate.receiveShadow = true;
    this.scene.add(plate);
    this.decorativeObjectCount += 1;
  }

  private addDistrictPlates() {
    this.createDistrictPlate(
      [
        [-10.6, -6.9],
        [-5.2, -9.2],
        [-1.1, -5.2],
        [-2.3, 6.7],
        [-8.7, 6.9],
        [-11.1, 1.4]
      ],
      colors.tech,
      0.11
    );
    this.createDistrictPlate(
      [
        [2.1, -8.4],
        [10.5, -7.1],
        [10.9, 4.7],
        [5.4, 8.2],
        [1.2, 4.8],
        [0.9, -4.6]
      ],
      colors.art,
      0.1
    );
    this.createDistrictPlate(
      [
        [-3.2, -3.6],
        [2.7, -4.1],
        [4.1, 1.8],
        [0.8, 8.8],
        [-3.6, 6.4],
        [-4.4, 0.4]
      ],
      colors.studio,
      0.12
    );
  }

  private addRoads() {
    const underlay = new THREE.MeshStandardMaterial({
      color: colors.ink,
      roughness: 0.78,
      metalness: 0.1,
      transparent: true,
      opacity: 0.72
    });
    const routeMaterial = new THREE.MeshStandardMaterial({
      color: colors.road,
      roughness: 0.44,
      metalness: 0.18,
      emissive: colors.road,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.82
    });

    const zoneById = new Map(zones.map((zone) => [zone.id, zone]));

    for (const routeInfo of worldRoutes) {
      const from = zoneById.get(routeInfo.from);
      const to = zoneById.get(routeInfo.to);
      if (!from || !to) {
        continue;
      }

      const accent = colors[routeInfo.kind];
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: accent,
        roughness: 0.52,
        metalness: 0.24,
        emissive: accent,
        emissiveIntensity: 0.18,
        transparent: true,
        opacity: 0.88
      });
      const points = [
        new THREE.Vector3(from.position[0], 0.075, from.position[1]),
        ...(routeInfo.via ?? []).map(([x, z]) => new THREE.Vector3(x, 0.08, z)),
        new THREE.Vector3(to.position[0], 0.075, to.position[1])
      ];
      const curve = new THREE.CatmullRomCurve3(points);
      const base = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.085, 8, false), underlay);
      const route = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.035, 8, false), accentMaterial);
      base.receiveShadow = true;
      route.castShadow = true;
      this.scene.add(base, route);
      this.roadSegmentCount += 2;
      this.decorativeObjectCount += 2;

      const node = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 0.12, 12),
        routeMaterial
      );
      node.position.set(to.position[0], 0.24, to.position[1]);
      node.castShadow = true;
      this.scene.add(node);
      this.decorativeObjectCount += 1;
    }
  }

  private addWorldProps() {
    const beaconMaterial = new THREE.MeshStandardMaterial({
      color: colors.studio,
      roughness: 0.36,
      metalness: 0.22,
      emissive: colors.studio,
      emissiveIntensity: 0.24
    });
    const techMaterial = new THREE.MeshStandardMaterial({
      color: colors.tech,
      roughness: 0.48,
      metalness: 0.24,
      emissive: colors.tech,
      emissiveIntensity: 0.16
    });
    const artMaterial = new THREE.MeshStandardMaterial({
      color: colors.art,
      roughness: 0.48,
      metalness: 0.16,
      emissive: colors.art,
      emissiveIntensity: 0.16
    });

    const props = [
      [-5.4, -1.1, techMaterial],
      [-6.6, 1.3, techMaterial],
      [-3.8, 3.2, techMaterial],
      [-1.4, -4.3, techMaterial],
      [5.2, -1.1, artMaterial],
      [6.8, 0.7, artMaterial],
      [4.5, 3.4, artMaterial],
      [2.4, 4.8, artMaterial],
      [-1.2, 1.4, beaconMaterial],
      [1.1, 1.3, beaconMaterial],
      [-0.9, -1.8, beaconMaterial],
      [1.4, -2.1, beaconMaterial]
    ] as const;

    for (const [x, z, mat] of props) {
      const post = new THREE.Group();
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 8), mat);
      stem.position.y = 0.48;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), mat);
      cap.position.y = 0.9;
      post.add(stem, cap);
      post.position.set(x, 0, z);
      post.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.scene.add(post);
      this.decorativeObjectCount += 2;
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

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(zone.radius * 1.09, 0.045, 8, 72),
      new THREE.MeshStandardMaterial({
        color: accent,
        roughness: 0.36,
        metalness: 0.2,
        emissive: accent,
        emissiveIntensity: 0.22,
        transparent: true,
        opacity: 0.82
      })
    );
    rim.rotation.x = Math.PI * 0.5;
    rim.position.y = 0.26;
    rim.userData.zoneId = zone.id;
    group.add(rim);

    const visualSpec = zoneVisualSpecs[zone.id];
    if (visualSpec) {
      this.addZoneVisualSpec(group, zone, visualSpec);
    }

    this.addZoneSetDressing(group, zone);

    const marker = createZoneLandmark(zone, colors);
    marker.userData.zoneId = zone.id;
    marker.traverse((child) => {
      child.userData.zoneId = zone.id;
      child.userData.landmarkZone = zone.id;
    });
    group.add(marker);

    const label = this.createLabel(zone.shortLabel, accent);
    label.position.set(0, 1.78, 0);
    group.add(label);

    this.zoneMeshes.set(zone.id, group);
    this.scene.add(group);
  }

  private addZoneVisualSpec(group: THREE.Group, zone: StudioZone, spec: ZoneVisualSpec) {
    const rendered = renderZoneVisuals(group, zone, spec, colors);
    group.userData.expectedAnimation = spec.animation;
    this.renderedVisualSpecIds.add(rendered.visualSpecId);
    this.visualDecalCount += rendered.visualDecals;
    this.propClusterCount += rendered.propClusters;
    this.decorativeObjectCount += rendered.visualDecals + rendered.propObjects;
    this.motionRoleCount += rendered.motionObjects.length;
    this.zoneMotionObjects.set(zone.id, rendered.motionObjects);
    for (const variant of rendered.materialVariants) {
      this.materialVariantIds.add(variant);
    }
  }

  private addZoneSetDressing(group: THREE.Group, zone: StudioZone) {
    const rendered = createZoneSetDressing(zone, colors);
    group.add(rendered.group);
    this.setDressingObjectCount += rendered.objectCount;
    this.decorativeObjectCount += rendered.objectCount;
    this.motionRoleCount += rendered.motionObjects.length;
    for (const signature of rendered.signatures) {
      this.setDressingSignatureIds.add(signature);
    }
    const existingMotionObjects = this.zoneMotionObjects.get(zone.id) ?? [];
    this.zoneMotionObjects.set(zone.id, [...existingMotionObjects, ...rendered.motionObjects]);
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
    const techMaterial = new THREE.MeshStandardMaterial({
      color: colors.tech,
      roughness: 0.42,
      metalness: 0.24,
      emissive: colors.tech,
      emissiveIntensity: 0.2
    });
    const artMaterial = new THREE.MeshStandardMaterial({
      color: colors.art,
      roughness: 0.5,
      metalness: 0.14,
      emissive: colors.art,
      emissiveIntensity: 0.18
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff7df,
      roughness: 0.22,
      metalness: 0.08,
      transparent: true,
      opacity: 0.86,
      emissive: 0xffe38a,
      emissiveIntensity: 0.12
    });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x121217, roughness: 0.8 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.28, 1.16), bodyMaterial);
    chassis.position.y = 0.4;
    this.player.add(chassis);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.42), bodyMaterial);
    nose.position.set(0, 0.52, -0.48);
    this.player.add(nose);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.44), glassMaterial);
    cabin.position.set(0, 0.72, -0.02);
    cabin.rotation.x = -0.08;
    this.player.add(cabin);

    const techFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.62), techMaterial);
    techFin.position.set(-0.48, 0.58, 0.06);
    techFin.rotation.z = -0.16;
    this.player.add(techFin);

    const artFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.62), artMaterial);
    artFin.position.set(0.48, 0.58, 0.06);
    artFin.rotation.z = 0.16;
    this.player.add(artFin);

    const brush = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 12), artMaterial);
    brush.position.set(0.32, 0.92, 0.3);
    brush.rotation.x = Math.PI * 0.58;
    this.player.add(brush);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.54, 8), techMaterial);
    antenna.position.set(-0.28, 0.98, 0.24);
    antenna.rotation.z = -0.24;
    this.player.add(antenna);

    const antennaCap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6), techMaterial);
    antennaCap.position.set(-0.34, 1.24, 0.24);
    this.player.add(antennaCap);

    for (const x of [-0.22, 0.22]) {
      const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6), glassMaterial);
      headlight.position.set(x, 0.54, -0.72);
      this.player.add(headlight);
    }

    for (const x of [-0.48, 0.48]) {
      for (const z of [-0.42, 0.42]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 16), wheelMaterial);
        wheel.rotation.z = Math.PI * 0.5;
        wheel.position.set(x, 0.22, z);
        this.player.add(wheel);
        this.wheelMeshes.push(wheel);
      }
    }

    this.player.traverse((child) => {
      child.userData.playerPart = true;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        this.playerPartCount += 1;
      }
    });
    this.player.position.copy(this.playerPosition);
    this.scene.add(this.player);
  }

  private setPlayerTrail() {
    this.trailGroup.name = "studio-rover-trail";
    this.trailGroup.userData.trailGroup = true;
    const geometry = new THREE.CircleGeometry(0.18, 18);

    for (let index = 0; index < 18; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: colors.studio,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mark = new THREE.Mesh(geometry, material);
      mark.rotation.x = -Math.PI * 0.5;
      mark.position.y = 0.04;
      mark.visible = false;
      mark.userData.trailMark = true;
      this.trailGroup.add(mark);
      this.trailMarks.push({ mesh: mark, age: 12, maxAge: 12 });
    }

    this.decorativeObjectCount += this.trailMarks.length;
    this.scene.add(this.trailGroup);
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
    const step = 1.2;
    const previousPosition = this.playerPosition.clone();
    if (direction === "up") this.playerPosition.z -= step;
    if (direction === "down") this.playerPosition.z += step;
    if (direction === "left") this.playerPosition.x -= step;
    if (direction === "right") this.playerPosition.x += step;

    this.playerPosition.x = clamp(this.playerPosition.x, -9.4, 9.4);
    this.playerPosition.z = clamp(this.playerPosition.z, -9.4, 9.4);
    this.targetPosition.copy(this.playerPosition);
    this.player.position.copy(this.playerPosition);
    this.emitTrail(previousPosition, this.playerPosition.clone().sub(previousPosition));
    this.updateTrail(0.08);
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
    this.elapsedTime += delta;
    this.lastFrameTime = now;
    this.frameCount += 1;
    this.frameDeltas.push(rawDeltaMs);
    if (this.frameDeltas.length > 90) {
      this.frameDeltas.shift();
    }

    this.updatePlayer(delta);
    this.updateActiveZone();
    this.updateWorldMotion(delta);
    this.updateWorldSceneryMotion(delta);
    this.updateCamera(delta);
    this.updateMiniMap();
    this.renderer.render(this.scene, this.camera);
    const shouldSyncQa = !this.qaSnapshot.ready || now - this.lastQaSyncTime > 250;
    this.markReady();
    if (shouldSyncQa) {
      this.syncQaSnapshot();
    }
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
    this.emitTrail(previousPosition, travel);

    if (travel.lengthSq() > 0.0001) {
      const targetRotation = Math.atan2(travel.x, travel.z);
      this.player.rotation.y += (targetRotation - this.player.rotation.y) * 0.14;
      for (const wheel of this.wheelMeshes) {
        wheel.rotation.x += travel.length() * 3.8;
      }
    }
    this.updateTrail(delta);
  }

  private emitTrail(previousPosition: THREE.Vector3, travel: THREE.Vector3) {
    const distance = travel.length();
    if (distance <= 0.001) {
      return;
    }

    this.trailDistance += distance;
    if (this.trailDistance < 0.26) {
      return;
    }
    this.trailDistance = 0;

    const activeZone = zones.find((zone) => zone.id === this.activeZoneId) ?? defaultZone;
    const mark = this.trailMarks[this.trailCursor];
    this.trailCursor = (this.trailCursor + 1) % this.trailMarks.length;
    mark.age = 0;
    mark.maxAge = 12;
    mark.mesh.visible = true;
    mark.mesh.position.set(previousPosition.x, 0.04, previousPosition.z);
    mark.mesh.rotation.z = this.player.rotation.y;
    mark.mesh.scale.setScalar(0.64 + Math.min(distance, 0.8) * 0.5);
    mark.mesh.material.color.setHex(colors[activeZone.kind]);
    mark.mesh.material.opacity = 0.38;
  }

  private updateTrail(delta: number) {
    for (const mark of this.trailMarks) {
      if (!mark.mesh.visible) {
        continue;
      }
      mark.age += delta;
      const life = clamp(1 - mark.age / mark.maxAge, 0, 1);
      mark.mesh.material.opacity = life * 0.38;
      mark.mesh.scale.multiplyScalar(1 + delta * 0.08);
      if (life <= 0.02) {
        mark.mesh.visible = false;
      }
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
      const spec = zoneVisualSpecs[zone.id];
      const animation = spec?.animation ?? { idleSpin: 0.12, activeSpin: 0.45, activeScale: 1.12, pulse: 0.1 };
      mesh.rotation.y += delta * (active ? animation.activeSpin * 0.08 : animation.idleSpin * 0.04);
      const targetScale = active ? animation.activeScale : 1;
      mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.002, delta));
      mesh.userData.appliedAnimation = animation;
      this.updateZoneMotionRoles(zone.id, animation.pulse, active, delta);
    }
  }

  private updateZoneMotionRoles(zoneId: string, pulse: number, active: boolean, delta: number) {
    const objects = this.zoneMotionObjects.get(zoneId) ?? [];
    const amplitude = active ? pulse : pulse * 0.28;
    objects.forEach((object, index) => {
      const role = object.userData.motionRole;
      const baseY = typeof object.userData.motionBaseY === "number" ? object.userData.motionBaseY : object.position.y;
      const baseX = typeof object.userData.motionBaseX === "number" ? object.userData.motionBaseX : object.position.x;
      const baseZ = typeof object.userData.motionBaseZ === "number" ? object.userData.motionBaseZ : object.position.z;
      const baseRotationX =
        typeof object.userData.motionBaseRotationX === "number" ? object.userData.motionBaseRotationX : object.rotation.x;
      const baseRotationY =
        typeof object.userData.motionBaseRotationY === "number" ? object.userData.motionBaseRotationY : object.rotation.y;
      const baseRotationZ =
        typeof object.userData.motionBaseRotationZ === "number" ? object.userData.motionBaseRotationZ : object.rotation.z;
      const phase = this.elapsedTime * (1.6 + (index % 5) * 0.08) + index * 0.7;
      const behavior = object.userData.localMotionBehavior;
      if (behavior === "sweep") {
        object.rotation.y += (active ? 1.25 : 0.42) * delta;
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.06;
      } else if (behavior === "pulse") {
        const pulseScale = 1 + Math.sin(phase) * amplitude * (active ? 0.16 : 0.05);
        object.scale.setScalar(Math.max(0.82, pulseScale));
        object.position.y = baseY + Math.sin(phase * 0.8) * amplitude * 0.05;
      } else if (behavior === "tilt") {
        object.rotation.x = baseRotationX + Math.sin(phase) * amplitude * 0.42;
        object.rotation.y = baseRotationY + Math.cos(phase * 0.7) * amplitude * 0.28;
        object.rotation.z = baseRotationZ + Math.sin(phase * 0.9) * amplitude * 0.18;
      } else if (behavior === "float") {
        object.position.x = baseX + Math.cos(phase * 0.7) * amplitude * 0.1;
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.2;
        object.position.z = baseZ + Math.sin(phase * 0.55) * amplitude * 0.1;
      } else if (behavior === "blink") {
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.08;
        object.rotation.y = baseRotationY + Math.sin(phase * 0.75) * amplitude * 0.28;
      } else if (role === "surface-detail") {
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.03;
      } else if (role === "cluster") {
        object.rotation.y += (active ? 0.72 : 0.24) * delta * (1 + (index % 2) * 0.4);
      } else {
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.16;
        object.rotation.y += (active ? 1.08 : 0.36) * delta;
      }
    });
  }

  private updateWorldSceneryMotion(delta: number) {
    if (motionQuery.matches) {
      return;
    }

    this.worldSceneryMotionObjects.forEach((object, index) => {
      const baseY = typeof object.userData.motionBaseY === "number" ? object.userData.motionBaseY : object.position.y;
      const baseX = typeof object.userData.motionBaseX === "number" ? object.userData.motionBaseX : object.position.x;
      const baseZ = typeof object.userData.motionBaseZ === "number" ? object.userData.motionBaseZ : object.position.z;
      const baseRotationX =
        typeof object.userData.motionBaseRotationX === "number" ? object.userData.motionBaseRotationX : object.rotation.x;
      const baseRotationY =
        typeof object.userData.motionBaseRotationY === "number" ? object.userData.motionBaseRotationY : object.rotation.y;
      const baseRotationZ =
        typeof object.userData.motionBaseRotationZ === "number" ? object.userData.motionBaseRotationZ : object.rotation.z;
      const behavior = object.userData.localMotionBehavior;
      const phase = this.elapsedTime * (0.9 + (index % 6) * 0.07) + index * 0.41;
      const amplitude = 0.12;

      if (behavior === "sweep") {
        object.rotation.y += delta * 0.38;
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.08;
      } else if (behavior === "pulse") {
        const pulseScale = 1 + Math.sin(phase * 1.2) * 0.045;
        object.scale.setScalar(pulseScale);
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.06;
      } else if (behavior === "tilt") {
        object.rotation.x = baseRotationX + Math.sin(phase) * amplitude * 0.8;
        object.rotation.z = baseRotationZ + Math.cos(phase * 0.72) * amplitude * 0.46;
      } else if (behavior === "float") {
        object.position.x = baseX + Math.cos(phase * 0.6) * amplitude * 0.3;
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.52;
        object.position.z = baseZ + Math.sin(phase * 0.5) * amplitude * 0.28;
      } else if (behavior === "blink") {
        object.position.y = baseY + Math.sin(phase * 1.4) * amplitude * 0.16;
        object.rotation.y = baseRotationY + Math.sin(phase * 0.9) * amplitude * 0.7;
      } else {
        object.rotation.x = baseRotationX;
        object.rotation.y = baseRotationY;
        object.rotation.z = baseRotationZ;
      }
    });
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

  private exposeQaControls() {
    if (!qaMode) {
      return;
    }
    window.__IT_ART_STUDIO_QA_STEP__ = (direction: DriveKey) => {
      this.qaSnapshot.lastInputMode = "keyboard";
      this.applyQaKeyboardStep(direction);
    };
  }

  private syncQaSnapshot() {
    this.lastQaSyncTime = performance.now();
    const stableFrameDeltas = this.frameDeltas.filter((item) => item > 0 && item < 120);
    const averageFrameMs =
      stableFrameDeltas.length > 0
        ? stableFrameDeltas.reduce((sum, item) => sum + item, 0) / stableFrameDeltas.length
        : 0;
    const activeZone = zones.find((zone) => zone.id === this.activeZoneId) ?? defaultZone;

    this.qaSnapshot.activeZoneId = activeZone.id;
    this.qaSnapshot.activeZoneLabel = activeZone.label;
    let sceneObjects = 0;
    let landmarkObjects = 0;
    this.scene.traverse((object) => {
      sceneObjects += 1;
      if (typeof object.userData.landmarkZone === "string") {
        landmarkObjects += 1;
      }
    });
    const zoneAssets = zones.map((zone) => this.inspectZoneAsset(zone));
    const motionRolesByType = zoneAssets.reduce<Record<string, number>>((summary, zone) => {
      Object.entries(zone.motionRoleCounts).forEach(([role, count]) => {
        summary[role] = (summary[role] ?? 0) + count;
      });
      return summary;
    }, {});
    const sceneryRoleCounts: Record<string, number> = {};
    this.scene.traverse((object) => {
      const role = object.userData.worldSceneryRole;
      if (typeof role === "string") {
        sceneryRoleCounts[role] = (sceneryRoleCounts[role] ?? 0) + 1;
      }
    });

    this.qaSnapshot.world = {
      sceneObjects,
      decorativeObjects: this.decorativeObjectCount,
      roadSegments: this.roadSegmentCount,
      landmarkObjects,
      playerParts: this.playerPartCount,
      visualSpecs: this.renderedVisualSpecIds.size,
      visualDecals: this.visualDecalCount,
      propClusters: this.propClusterCount,
      setDressingObjects: this.setDressingObjectCount,
      setDressingSignatures: this.setDressingSignatureIds.size,
      sceneryObjects: this.sceneryObjectCount,
      scenerySignatures: this.scenerySignatureIds.size,
      sceneryMotionObjects: this.worldSceneryMotionObjects.length,
      sceneryRoleCounts,
      terrainLayers: this.terrainLayerCount,
      materialVariants: this.materialVariantIds.size,
      motionRoles: this.motionRoleCount,
      motionRolesByType,
      zones: zoneAssets
    };
    const playerBounds = this.measureObject(this.player);
    this.qaSnapshot.player = {
      x: Number(this.playerPosition.x.toFixed(3)),
      z: Number(this.playerPosition.z.toFixed(3)),
      rotationY: Number(this.player.rotation.y.toFixed(3)),
      meshCount: this.playerPartCount,
      wheelCount: this.wheelMeshes.length,
      bounds: playerBounds
    };
    const activeTrailMarks = this.trailMarks.filter((mark) => mark.mesh.visible && mark.mesh.material.opacity > 0.02);
    this.qaSnapshot.trail = {
      totalMarks: this.trailMarks.length,
      activeMarks: activeTrailMarks.length,
      maxOpacity: Number(
        activeTrailMarks.reduce((max, mark) => Math.max(max, mark.mesh.material.opacity), 0).toFixed(3)
      )
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

  private inspectZoneAsset(zone: StudioZone): ZoneAssetQa {
    const group = this.zoneMeshes.get(zone.id);
    if (!group) {
      return {
        id: zone.id,
        meshCount: 0,
        landmarkObjects: 0,
        visualSpecId: null,
        biome: null,
        visualDecals: 0,
        propClusters: 0,
        propObjects: 0,
        setDressingObjects: 0,
        setDressingRoles: [],
        setDressingSignatures: [],
        materialVariants: 0,
        declaredMaterialVariants: [],
        renderedMaterialVariants: [],
        missingMaterialVariants: [],
        expectedVisuals: { decals: 0, propClusters: 0, propObjects: 0, materialVariants: 0 },
        expectedAnimation: null,
        appliedAnimation: null,
        animationMatchesSpec: false,
        motionObjectCount: 0,
        motionRoleCounts: {},
        localMotionBehaviors: {},
        visualFingerprint: "",
        setDressingFingerprint: "",
        hasLabel: false,
        bounds: { width: 0, height: 0, depth: 0 }
      };
    }

    let meshCount = 0;
    let landmarkObjects = 0;
    let visualDecals = 0;
    let propObjects = 0;
    const decalIds = new Set<string>();
    const propClusters = new Set<string>();
    const setDressingRoles = new Set<string>();
    const setDressingSignatures = new Set<string>();
    let setDressingObjects = 0;
    const materialVariants = new Set<string>();
    const semanticMaterialVariants = new Set<string>();
    const motionRoleCounts: Record<string, number> = {};
    const localMotionBehaviors: Record<string, number> = {};
    const spec = zoneVisualSpecs[zone.id];
    const expectedMaterialVariants = new Set<string>();
    if (spec) {
      for (const decal of spec.decals) {
        expectedMaterialVariants.add(`${spec.id}:${decal.tone}:decal`);
      }
      for (const cluster of spec.propClusters) {
        expectedMaterialVariants.add(`${spec.id}:${cluster.tone}:${cluster.form}`);
      }
    }
    let hasLabel = false;
    group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshCount += 1;
      }
      if (typeof child.userData.landmarkZone === "string") {
        landmarkObjects += 1;
      }
      if (typeof child.userData.visualDecal === "string") {
        visualDecals += 1;
        decalIds.add(child.userData.visualDecal);
      }
      if (typeof child.userData.propCluster === "string") {
        propClusters.add(child.userData.propCluster);
        if (child instanceof THREE.Mesh && child.userData.visualSpecRole === "prop") {
          propObjects += 1;
        }
      }
      if (typeof child.userData.setDressingRole === "string") {
        setDressingRoles.add(child.userData.setDressingRole);
        if (child instanceof THREE.Mesh) {
          setDressingObjects += 1;
          if (typeof child.userData.setDressingSignature === "string") {
            setDressingSignatures.add(child.userData.setDressingSignature);
          }
        }
      }
      if (typeof child.userData.materialVariant === "string") {
        materialVariants.add(child.userData.materialVariant);
      }
      if (typeof child.userData.semanticMaterialVariant === "string") {
        semanticMaterialVariants.add(child.userData.semanticMaterialVariant);
      }
      if (typeof child.userData.motionRole === "string") {
        motionRoleCounts[child.userData.motionRole] = (motionRoleCounts[child.userData.motionRole] ?? 0) + 1;
      }
      if (typeof child.userData.localMotionBehavior === "string") {
        localMotionBehaviors[child.userData.localMotionBehavior] =
          (localMotionBehaviors[child.userData.localMotionBehavior] ?? 0) + 1;
      }
      if (child instanceof THREE.Sprite) {
        hasLabel = true;
      }
    });
    const declaredMaterialVariants = spec?.materialVariants ?? [];
    const renderedMaterialVariants = [...semanticMaterialVariants].sort();
    const missingMaterialVariants = declaredMaterialVariants.filter((variant) => !semanticMaterialVariants.has(variant));
    const expectedAnimation = spec?.animation ?? null;
    const appliedAnimation =
      typeof group.userData.appliedAnimation === "object" && group.userData.appliedAnimation
        ? group.userData.appliedAnimation
        : null;
    const animationMatchesSpec =
      Boolean(expectedAnimation && appliedAnimation) &&
      JSON.stringify(expectedAnimation) === JSON.stringify(appliedAnimation);

    return {
      id: zone.id,
      meshCount,
      landmarkObjects,
      visualSpecId: typeof group.userData.visualSpecId === "string" ? group.userData.visualSpecId : null,
      biome: typeof group.userData.visualBiome === "string" ? group.userData.visualBiome : null,
      visualDecals,
      propClusters: propClusters.size,
      propObjects,
      setDressingObjects,
      setDressingRoles: [...setDressingRoles].sort(),
      setDressingSignatures: [...setDressingSignatures].sort(),
      materialVariants: materialVariants.size,
      declaredMaterialVariants,
      renderedMaterialVariants,
      missingMaterialVariants,
      expectedVisuals: {
        decals: spec?.decals.length ?? 0,
        propClusters: spec?.propClusters.length ?? 0,
        propObjects: spec?.propClusters.reduce((sum, cluster) => sum + cluster.count, 0) ?? 0,
        materialVariants: expectedMaterialVariants.size
      },
      expectedAnimation,
      appliedAnimation,
      animationMatchesSpec,
      motionObjectCount: Object.values(motionRoleCounts).reduce((sum, count) => sum + count, 0),
      motionRoleCounts,
      localMotionBehaviors,
      visualFingerprint: [
        group.userData.visualSpecId ?? "missing",
        group.userData.visualBiome ?? "missing-biome",
        [...decalIds].sort().join("+"),
        [...propClusters].sort().join("+"),
        [...materialVariants].sort().join("+")
      ].join("|"),
      setDressingFingerprint: [...setDressingSignatures].sort().join("|"),
      hasLabel,
      bounds: this.measureObject(group)
    };
  }

  private measureObject(object: THREE.Object3D): BoundsQa {
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    return {
      width: Number(size.x.toFixed(3)),
      height: Number(size.y.toFixed(3)),
      depth: Number(size.z.toFixed(3))
    };
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
