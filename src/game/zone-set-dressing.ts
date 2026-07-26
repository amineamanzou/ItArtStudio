import * as THREE from "three";
import type { StudioZone, ZoneKind } from "./zones";

type Palette = Record<ZoneKind | "road" | "ink", number>;
type Tone = "accent" | "secondary" | "light" | "dark";
type PrimitiveKind = "block" | "cylinder" | "sphere" | "cone" | "ring" | "beam" | "sign";
type LocalMotionBehavior = "pulse" | "sweep" | "tilt" | "float" | "blink";

type DressingPrimitive = {
  id: string;
  kind: PrimitiveKind;
  role: string;
  tone: Tone;
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  text?: string;
  to?: [number, number, number];
  motion?: LocalMotionBehavior;
};

type ZoneDressingRecipe = {
  signature: string;
  primitives: DressingPrimitive[];
};

export type RenderedZoneSetDressing = {
  group: THREE.Group;
  objectCount: number;
  roles: Set<string>;
  signatures: Set<string>;
  motionObjects: THREE.Object3D[];
};

const recipes: Record<string, ZoneDressingRecipe> = {
  "studio-gate": {
    signature: "split-frontier-gateway",
    primitives: [
      block("tech-threshold", "threshold-rail", "accent", [-1.52, 0.15, -0.28], [0.08, 0.18, 1.72]),
      block("art-threshold", "threshold-rail", "secondary", [1.52, 0.15, 0.28], [0.08, 0.18, 1.72]),
      beam("frontier-light", "boundary-beam", "light", [-1.22, 0.8, -0.88], [1.22, 0.8, 0.88], 0.035),
      ring("studio-orbit", "shared-orbit", "light", [0, 1.18, 0], [1.18, 0.035, 1.18], [Math.PI * 0.5, 0, 0]),
      sign("gate-sign", "wayfinding-sign", "light", [0, 0.9, -1.56], "IT/ART")
    ]
  },
  "ai-lab": {
    signature: "agentic-evaluation-workshop",
    primitives: [
      block("agent-workbench-left", "agent-workbench", "dark", [-0.48, 0.22, -1.18], [1.2, 0.18, 0.46]),
      block("agent-workbench-right", "agent-workbench", "dark", [0.78, 0.24, -1.04], [0.72, 0.16, 0.36], [0, 0.16, 0]),
      block("evaluation-conveyor", "evaluation-conveyor", "secondary", [0.08, 0.48, -0.42], [1.52, 0.08, 0.22], [0, 0.1, 0]),
      block("prompt-token-a", "prompt-token", "accent", [-0.72, 0.66, 0.38], [0.18, 0.18, 0.18]),
      block("prompt-token-b", "prompt-token", "light", [-0.28, 0.72, 0.48], [0.16, 0.16, 0.16]),
      sphere("agent-core-node", "agent-core", "accent", [0.42, 0.86, 0.18], [0.24, 0.24, 0.24]),
      beam("evaluation-feedback-loop", "agent-feedback-loop", "light", [-0.5, 0.74, 0.32], [0.72, 0.9, -0.34], 0.018)
    ]
  },
  "observability-tower": {
    signature: "telemetry-lighthouse-tower",
    primitives: [
      cylinder("telemetry-lighthouse-mast", "telemetry-lighthouse", "light", [0.18, 0.96, -0.82], [0.06, 1.58, 0.06], [0.08, 0, -0.1]),
      cone("radar-dish", "radar-beam", "accent", [0.18, 1.86, -0.82], [0.34, 0.32, 0.34], [0.62, 0.1, -0.48]),
      beam("radar-sweep", "radar-beam", "accent", [0.24, 1.78, -0.82], [1.36, 1.44, -0.36], 0.02),
      block("metric-stack-a", "metric-stack", "dark", [-1.12, 0.52, -0.76], [0.28, 0.94, 0.08], [0, 0.18, 0]),
      block("metric-stack-b", "metric-stack", "light", [-0.78, 0.72, -0.76], [0.22, 1.22, 0.08], [0, 0.18, 0]),
      block("log-waterfall-a", "log-waterfall", "secondary", [0.78, 1.0, -0.68], [0.5, 0.06, 0.1]),
      block("log-waterfall-b", "log-waterfall", "accent", [0.78, 0.74, -0.68], [0.38, 0.06, 0.1]),
      block("trace-sample-grid", "trace-sample-grid", "secondary", [0.36, 0.34, 1.12], [0.72, 0.08, 0.34], [0, -0.22, 0])
    ]
  },
  "architecture-bridge": {
    signature: "blueprint-load-bridge",
    primitives: [
      block("blueprint-slab", "blueprint-table", "dark", [0, 0.18, 1.28], [1.52, 0.12, 0.48]),
      beam("load-vector-a", "load-vector", "light", [-1.16, 0.52, -0.88], [0, 1.16, 0.88], 0.024),
      beam("load-vector-b", "load-vector", "accent", [1.16, 0.52, -0.88], [0, 1.16, 0.88], 0.024),
      cylinder("decision-pin-a", "decision-pin", "accent", [-1.18, 0.42, 0.78], [0.12, 0.5, 0.12]),
      cylinder("decision-pin-b", "decision-pin", "light", [1.18, 0.42, 0.78], [0.12, 0.5, 0.12]),
      sign("arch-sign", "wayfinding-sign", "light", [0, 0.78, -1.42], "ARCH")
    ]
  },
  "cloud-dock": {
    signature: "harbor-cloud-infrastructure",
    primitives: [
      block("server-rack-a", "server-rack", "dark", [-1.16, 0.36, 0.92], [0.34, 0.74, 0.32]),
      block("server-rack-b", "server-rack", "accent", [-0.76, 0.46, 0.92], [0.28, 0.94, 0.28]),
      sphere("cloud-puff-a", "cloud-puff", "light", [0.72, 1.16, -0.88], [0.36, 0.24, 0.32]),
      sphere("cloud-puff-b", "cloud-puff", "accent", [1.08, 1.28, -0.76], [0.46, 0.3, 0.36]),
      beam("electric-arc", "electric-arc", "accent", [-1.08, 1.0, -1.18], [0.56, 1.34, -1.08], 0.022),
      block("k8s-control-plane", "control-plane-beacon", "light", [-0.18, 0.62, -1.02], [0.62, 0.08, 0.36], [0, 0.18, 0]),
      cylinder("cluster-status-pin", "cluster-status-pin", "accent", [0.18, 0.88, -1.02], [0.055, 0.52, 0.055]),
      beam("deploy-lane", "deployment-lane", "light", [-0.78, 0.78, -0.96], [0.72, 0.96, -0.96], 0.016)
    ]
  },
  "design-atelier": {
    signature: "creative-direction-atelier",
    primitives: [
      block("paper-wall", "canvas-wall", "light", [0, 0.8, -1.36], [1.35, 0.72, 0.06]),
      block("drafting-table", "drafting-table", "dark", [0.2, 0.34, 1.06], [0.9, 0.14, 0.5], [0, -0.24, 0]),
      cylinder("material-roll", "material-roll", "secondary", [-0.82, 0.48, 1.08], [0.1, 0.66, 0.1], [Math.PI * 0.5, 0, 0.22]),
      block("swatch-tech", "color-swatch", "secondary", [-0.4, 0.48, 1.18], [0.28, 0.1, 0.28]),
      block("swatch-art", "color-swatch", "accent", [-0.06, 0.44, 1.1], [0.28, 0.1, 0.28]),
      cylinder("paint-pot", "paint-tool", "accent", [0.8, 0.28, 1.0], [0.16, 0.32, 0.16]),
      cone("studio-lamp", "studio-lamp", "light", [1.04, 0.78, -1.04], [0.2, 0.46, 0.2], [0.58, 0, 0.34]),
      sphere("layout-pin", "layout-pin", "accent", [0.52, 1.08, -1.28], [0.09, 0.09, 0.09])
    ]
  },
  "three-d-foundry": {
    signature: "wireframe-sculpture-foundry",
    primitives: [
      ring("scanner-orbit-x", "scan-gantry", "secondary", [0.78, 0.9, -0.9], [0.46, 0.018, 0.46], [Math.PI * 0.5, 0.55, 0]),
      ring("scanner-orbit-y", "scan-gantry", "light", [0.78, 0.9, -0.9], [0.46, 0.018, 0.46], [0, 0, Math.PI * 0.5]),
      block("printer-bed", "printer-bed", "dark", [-1.08, 0.24, 0.96], [0.74, 0.32, 0.56]),
      sphere("resin-volume", "resin-vat", "accent", [-1.08, 0.62, 0.96], [0.28, 0.28, 0.28]),
      beam("tool-arm", "foundry-tool", "accent", [-1.36, 1.18, -0.98], [0.18, 1.42, -0.98], 0.024),
      sign("calibration-grid", "calibration-grid", "accent", [1.18, 0.74, 1.22], "3D")
    ]
  },
  "fashion-room": {
    signature: "runway-fabric-room",
    primitives: [
      block("runway-left", "runway-arch", "light", [-0.42, 0.18, -1.32], [0.14, 0.1, 1.34]),
      block("runway-right", "runway-arch", "accent", [0.42, 0.18, -1.32], [0.14, 0.1, 1.34]),
      block("fabric-roll-a", "fabric-roll", "accent", [-1.08, 0.78, 0.88], [0.08, 0.9, 0.5]),
      block("mirror-panel", "mirror-panel", "light", [1.08, 0.78, 0.88], [0.08, 0.9, 0.5]),
      cone("spotlight-a", "stage-light", "light", [-1.22, 0.64, -0.78], [0.24, 0.52, 0.24], [0.45, 0, -0.28]),
      cone("spotlight-b", "stage-light", "accent", [1.22, 0.64, -0.78], [0.24, 0.52, 0.24], [0.45, 0, 0.28]),
      sign("pattern-table", "pattern-cutting-table", "accent", [0, 0.82, 1.38], "MODE")
    ]
  },
  "values-plaza": {
    signature: "crossing-values-plaza",
    primitives: [
      block("value-clarte", "value-monolith", "light", [-1.18, 0.56, 0], [0.22, 0.92, 0.22]),
      block("value-audace", "value-monolith", "accent", [1.18, 0.56, 0], [0.22, 0.92, 0.22]),
      block("value-soin", "value-monolith", "secondary", [0, 0.56, -1.18], [0.22, 0.92, 0.22]),
      block("value-impact", "value-monolith", "light", [0, 0.56, 1.18], [0.22, 0.92, 0.22]),
      beam("shared-axis-tech", "shared-axis", "secondary", [-1.28, 1.08, 0], [1.28, 1.08, 0], 0.024),
      beam("shared-axis-art", "shared-axis", "accent", [0, 1.22, -1.28], [0, 1.22, 1.28], 0.024),
      sign("values-sign", "wayfinding-sign", "light", [0.95, 0.78, -1.1], "VALEURS")
    ]
  },
  "contact-portal": {
    signature: "postal-reply-office",
    primitives: [
      block("postal-desk", "postal-desk", "secondary", [-0.72, 0.28, -0.82], [0.94, 0.34, 0.62]),
      block("mail-tray", "mail-tray", "accent", [0.76, 0.42, -0.82], [0.66, 0.22, 0.5], [0, -0.16, 0]),
      beam("sorting-belt-a", "sorting-belt", "light", [-1.08, 0.82, 0.96], [0, 1.18, 1.36], 0.024),
      beam("sorting-belt-b", "sorting-belt", "accent", [1.08, 0.82, 0.96], [0, 1.18, 1.36], 0.024),
      ring("reply-portal-field", "reply-portal-field", "light", [0, 0.9, 0.18], [1.12, 0.028, 1.12], [Math.PI * 0.5, 0.16, 0]),
      block("mail-stack", "mail-stack", "light", [-0.06, 0.7, -1.3], [0.66, 0.1, 0.12], [0, 0.12, 0]),
      sphere("stamp-beacon", "stamp-beacon", "light", [0.82, 0.84, -1.16], [0.11, 0.11, 0.11]),
      cone("courier-light", "courier-light", "accent", [-0.92, 0.86, -1.12], [0.18, 0.44, 0.18], [0.58, 0, -0.28])
    ]
  }
};

export function createZoneSetDressing(zone: StudioZone, palette: Palette): RenderedZoneSetDressing {
  const recipe = recipes[zone.id];
  const group = new THREE.Group();
  const roles = new Set<string>();
  const signatures = new Set<string>();
  const motionObjects: THREE.Object3D[] = [];
  let objectCount = 0;

  group.name = `${zone.id}-set-dressing`;
  group.userData.zoneId = zone.id;
  group.userData.setDressingSignature = recipe?.signature ?? `${zone.id}-dressing`;

  for (const primitive of recipe?.primitives ?? []) {
    const object = createPrimitive(primitive, zone, palette, recipe.signature);
    group.add(object);
    roles.add(primitive.role);
    signatures.add(`${recipe.signature}:${primitive.id}`);
    objectCount += countTaggedObjects(object);
    motionObjects.push(...collectMotionObjects(object));
  }

  return { group, objectCount, roles, signatures, motionObjects };
}

function block(
  id: string,
  role: string,
  tone: Tone,
  position: [number, number, number],
  scale: [number, number, number],
  rotation?: [number, number, number]
): DressingPrimitive {
  return { id, role, kind: "block", tone, position, scale, rotation };
}

function cylinder(
  id: string,
  role: string,
  tone: Tone,
  position: [number, number, number],
  scale: [number, number, number],
  rotation?: [number, number, number]
): DressingPrimitive {
  return { id, role, kind: "cylinder", tone, position, scale, rotation };
}

function sphere(
  id: string,
  role: string,
  tone: Tone,
  position: [number, number, number],
  scale: [number, number, number]
): DressingPrimitive {
  return { id, role, kind: "sphere", tone, position, scale };
}

function cone(
  id: string,
  role: string,
  tone: Tone,
  position: [number, number, number],
  scale: [number, number, number],
  rotation?: [number, number, number]
): DressingPrimitive {
  return { id, role, kind: "cone", tone, position, scale, rotation };
}

function ring(
  id: string,
  role: string,
  tone: Tone,
  position: [number, number, number],
  scale: [number, number, number],
  rotation?: [number, number, number]
): DressingPrimitive {
  return { id, role, kind: "ring", tone, position, scale, rotation };
}

function beam(
  id: string,
  role: string,
  tone: Tone,
  from: [number, number, number],
  to: [number, number, number],
  radius: number
): DressingPrimitive {
  return { id, role, kind: "beam", tone, position: from, scale: [radius, radius, radius], to };
}

function sign(
  id: string,
  role: string,
  tone: Tone,
  position: [number, number, number],
  text: string
): DressingPrimitive {
  return { id, role, kind: "sign", tone, position, scale: [0.82, 0.44, 0.06], text };
}

function createPrimitive(primitive: DressingPrimitive, zone: StudioZone, palette: Palette, signature: string) {
  const mat = createToneMaterial(primitive.tone, zone.kind, palette);
  const object =
    primitive.kind === "block"
      ? new THREE.Mesh(new THREE.BoxGeometry(...primitive.scale), mat)
      : primitive.kind === "cylinder"
        ? new THREE.Mesh(
            new THREE.CylinderGeometry(primitive.scale[0], primitive.scale[2], primitive.scale[1], 12),
            mat
          )
        : primitive.kind === "sphere"
          ? new THREE.Mesh(new THREE.SphereGeometry(1, 14, 9), mat)
          : primitive.kind === "cone"
            ? new THREE.Mesh(new THREE.ConeGeometry(primitive.scale[0], primitive.scale[1], 12), mat)
            : primitive.kind === "ring"
              ? new THREE.Mesh(new THREE.TorusGeometry(primitive.scale[0], primitive.scale[1], 8, 44), mat)
              : primitive.kind === "beam"
                ? createBeam(primitive, mat)
                : createSign(primitive, mat, zone.kind, palette);

  object.position.set(...primitive.position);
  if (primitive.kind === "sphere") {
    object.scale.set(...primitive.scale);
  }
  if (primitive.rotation) {
    object.rotation.set(...primitive.rotation);
  }

  tagObject(object, zone.id, signature, primitive);
  return object;
}

function createBeam(primitive: DressingPrimitive, mat: THREE.Material) {
  const to = primitive.to ?? primitive.position;
  const localTo = new THREE.Vector3(
    to[0] - primitive.position[0],
    to[1] - primitive.position[1],
    to[2] - primitive.position[2]
  );
  const curve = new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), localTo);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 1, primitive.scale[0], 8), mat);
}

function createSign(primitive: DressingPrimitive, mat: THREE.Material, kind: ZoneKind, palette: Palette) {
  const group = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.034, 0.55, 8), mat);
  stem.position.y = -0.31;
  const panel = new THREE.Mesh(new THREE.BoxGeometry(...primitive.scale), mat);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(primitive.scale[0] * 0.92, primitive.scale[1] * 0.72),
    createSignMaterial(primitive.text ?? "", kind, palette)
  );
  face.position.z = primitive.scale[2] * 0.54;
  group.add(stem, panel, face);
  return group;
}

function createSignMaterial(text: string, kind: ZoneKind, palette: Palette) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  const accent = palette[kind];
  const accentHex = `#${accent.toString(16).padStart(6, "0")}`;

  if (context) {
    context.fillStyle = "#080b10";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = accentHex;
    context.lineWidth = 10;
    context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    context.fillStyle = "#fff7df";
    context.font = "800 56px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture, transparent: false });
}

function createToneMaterial(tone: Tone, kind: ZoneKind, palette: Palette) {
  const secondary = kind === "tech" ? palette.art : palette.tech;
  const color = tone === "accent" ? palette[kind] : tone === "secondary" ? secondary : tone === "light" ? palette.road : palette.ink;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: tone === "dark" ? 0.82 : 0.42,
    metalness: tone === "light" ? 0.18 : 0.28,
    emissive: color,
    emissiveIntensity: tone === "dark" ? 0.04 : 0.18,
    transparent: tone === "dark",
    opacity: tone === "dark" ? 0.86 : 1
  });
}

function tagObject(object: THREE.Object3D, zoneId: string, signature: string, primitive: DressingPrimitive) {
  const motionBehavior = primitive.motion ?? motionBehaviorFor(primitive);
  object.userData.zoneId = zoneId;
  object.userData.setDressingZone = zoneId;
  object.userData.setDressingRole = primitive.role;
  object.userData.setDressingSignature = `${signature}:${primitive.id}`;
  object.userData.motionRole = `dressing:${primitive.role}`;
  object.userData.localMotionBehavior = motionBehavior;
  object.userData.motionBaseY = object.position.y;
  object.userData.motionBaseX = object.position.x;
  object.userData.motionBaseZ = object.position.z;
  object.userData.motionBaseRotationX = object.rotation.x;
  object.userData.motionBaseRotationY = object.rotation.y;
  object.userData.motionBaseRotationZ = object.rotation.z;
  object.traverse((child) => {
    child.userData.zoneId = zoneId;
    child.userData.setDressingZone = zoneId;
    child.userData.setDressingRole = primitive.role;
    child.userData.setDressingSignature = `${signature}:${primitive.id}`;
    child.userData.motionRole = `dressing:${primitive.role}`;
    child.userData.localMotionBehavior = motionBehavior;
    child.userData.motionBaseY = child.position.y;
    child.userData.motionBaseX = child.position.x;
    child.userData.motionBaseZ = child.position.z;
    child.userData.motionBaseRotationX = child.rotation.x;
    child.userData.motionBaseRotationY = child.rotation.y;
    child.userData.motionBaseRotationZ = child.rotation.z;
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });
}

function motionBehaviorFor(primitive: DressingPrimitive): LocalMotionBehavior {
  if (primitive.role.includes("stage-light") || primitive.role.includes("runway-rail")) {
    return "sweep";
  }
  if (primitive.role.includes("color-swatch") || primitive.role.includes("paint-tool")) {
    return "pulse";
  }
  if (primitive.role.includes("fabric-panel")) {
    return "float";
  }
  if (primitive.kind === "ring" || primitive.role.includes("orbit") || primitive.role.includes("field")) {
    return "sweep";
  }
  if (primitive.kind === "beam" || primitive.role.includes("link") || primitive.role.includes("axis")) {
    return "pulse";
  }
  if (primitive.kind === "sign" || primitive.role.includes("panel") || primitive.role.includes("screen")) {
    return "tilt";
  }
  if (primitive.kind === "sphere" || primitive.role.includes("puff") || primitive.role.includes("node")) {
    return "float";
  }
  return "blink";
}

function countTaggedObjects(object: THREE.Object3D) {
  let count = 0;
  object.traverse((child) => {
    if (typeof child.userData.setDressingRole === "string" && child instanceof THREE.Mesh) {
      count += 1;
    }
  });
  return count;
}

function collectMotionObjects(object: THREE.Object3D) {
  const objects: THREE.Object3D[] = [];
  object.traverse((child) => {
    if (typeof child.userData.motionRole === "string") {
      objects.push(child);
    }
  });
  return objects;
}
