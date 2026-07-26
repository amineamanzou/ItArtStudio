import * as THREE from "three";
import type { StudioZone, ZoneKind } from "./zones";

type Palette = Record<ZoneKind | "road" | "ink", number>;
type PlaceRole = "threshold-frame" | "working-rig" | "boundary-rail" | "orientation-post" | "viewpoint-marker";
type MotionBehavior = "pulse" | "sweep" | "tilt" | "float" | "blink";

type PlacePrimitive = {
  id: string;
  role: PlaceRole;
  kind: "block" | "cylinder" | "ring" | "beam";
  tone: "accent" | "secondary" | "light" | "dark";
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  to?: [number, number, number];
  motion: MotionBehavior;
};

export type RenderedZonePlaceArchitecture = {
  group: THREE.Group;
  objectCount: number;
  family: string;
  roles: Set<string>;
  signatures: Set<string>;
  motionObjects: THREE.Object3D[];
};

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
const secondaryColor = (kind: ZoneKind, palette: Palette) => (kind === "tech" ? palette.art : palette.tech);

const materialFor = (tone: PlacePrimitive["tone"], kind: ZoneKind, palette: Palette) => {
  const color =
    tone === "accent"
      ? palette[kind]
      : tone === "secondary"
        ? secondaryColor(kind, palette)
        : tone === "light"
        ? palette.road
        : palette.ink;

  const key = `${kind}:${tone}:${color}`;
  const cached = materialCache.get(key);
  if (cached) {
    return cached;
  }

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: tone === "dark" ? 0.78 : 0.5,
    metalness: tone === "light" ? 0.18 : 0.26,
    emissive: color,
    emissiveIntensity: tone === "dark" ? 0.035 : 0.12,
    transparent: tone === "dark",
    opacity: tone === "dark" ? 0.82 : 1
  });
  materialCache.set(key, mat);
  return mat;
};

const block = (
  id: string,
  role: PlaceRole,
  tone: PlacePrimitive["tone"],
  position: [number, number, number],
  scale: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  motion: MotionBehavior = "blink"
): PlacePrimitive => ({ id, role, kind: "block", tone, position, scale, rotation, motion });

const cylinder = (
  id: string,
  role: PlaceRole,
  tone: PlacePrimitive["tone"],
  position: [number, number, number],
  scale: [number, number, number],
  motion: MotionBehavior = "float"
): PlacePrimitive => ({ id, role, kind: "cylinder", tone, position, scale, motion });

const ring = (
  id: string,
  role: PlaceRole,
  tone: PlacePrimitive["tone"],
  position: [number, number, number],
  scale: [number, number, number],
  rotation: [number, number, number],
  motion: MotionBehavior = "sweep"
): PlacePrimitive => ({ id, role, kind: "ring", tone, position, scale, rotation, motion });

const beam = (
  id: string,
  role: PlaceRole,
  tone: PlacePrimitive["tone"],
  from: [number, number, number],
  to: [number, number, number],
  radius: number,
  motion: MotionBehavior = "pulse"
): PlacePrimitive => ({ id, role, kind: "beam", tone, position: from, scale: [radius, radius, radius], to, motion });

const recipeFor = (zone: StudioZone): PlacePrimitive[] => {
  const r = zone.radius;
  const front = r * 0.92;
  const side = r * 0.76;
  const back = -r * 0.9;
  const tall = zone.kind === "studio" ? 1.36 : 1.12;

  if (zone.id === "studio-gate") {
    return [
      block("biface-tech-arch", "threshold-frame", "accent", [-side, 0.78, back], [0.12, 1.24, 0.22], [0, 0, -0.16], "tilt"),
      block("biface-art-arch", "threshold-frame", "secondary", [side, 0.78, back], [0.12, 1.24, 0.22], [0, 0, 0.16], "tilt"),
      beam("studio-keystone", "working-rig", "light", [-side, 1.42, back], [side, 1.42, back], 0.026, "pulse"),
      ring("frontier-compass", "viewpoint-marker", "light", [0, 0.9, front * 0.25], [0.7, 0.018, 0.7], [Math.PI * 0.5, 0.18, 0], "sweep")
    ];
  }

  if (zone.id === "ai-lab") {
    return [
      block("agent-workshop-bench", "working-rig", "dark", [0, 0.44, back * 0.72], [r * 1.34, 0.16, 0.38], [0, -0.04, 0], "blink"),
      block("evaluation-lane", "boundary-rail", "secondary", [0.14, 0.62, front * 0.1], [r * 1.42, 0.08, 0.18], [0, 0.08, 0], "pulse"),
      beam("low-agent-loop", "working-rig", "light", [-side, 0.84, front * 0.34], [side, 0.92, front * 0.08], 0.018, "pulse"),
      cylinder("agent-core-post", "orientation-post", "accent", [-side * 0.76, 0.72, front * 0.56], [0.052, 1.18, 0.052], "float")
    ];
  }

  if (zone.id === "observability-tower") {
    return [
      cylinder("telemetry-lighthouse-spine", "orientation-post", "light", [0, 0.96, back * 0.72], [0.065, 1.64, 0.065], "blink"),
      ring("radar-crown", "viewpoint-marker", "accent", [0, 1.82, back * 0.72], [0.82, 0.018, 0.82], [Math.PI * 0.5, 0.1, 0.36], "sweep"),
      beam("log-waterfall-gantry", "working-rig", "light", [side * 0.46, 1.52, back], [side * 0.46, 0.48, front * 0.68], 0.018, "pulse"),
      block("metric-balcony", "threshold-frame", "accent", [-side * 0.78, 1.06, back * 0.52], [0.18, 1.06, 0.16], [0, 0, -0.04], "tilt")
    ];
  }

  if (zone.id === "architecture-bridge") {
    return [
      beam("load-gantry-left", "working-rig", "light", [-side, 0.54, -front], [0, 1.34, back], 0.022, "pulse"),
      beam("load-gantry-right", "working-rig", "accent", [side, 0.54, -front], [0, 1.34, back], 0.022, "pulse"),
      block("suspended-blueprint", "viewpoint-marker", "dark", [0, 0.82, front * 0.48], [1.08, 0.08, 0.52], [0, 0.16, 0], "tilt"),
      block("decision-rail", "boundary-rail", "light", [0, 0.34, back * 0.12], [r * 1.2, 0.08, 0.12], [0, -0.12, 0], "blink")
    ];
  }

  if (zone.id === "cloud-dock") {
    return [
      block("container-pier", "boundary-rail", "dark", [-side * 0.3, 0.34, front * 0.64], [r * 1.08, 0.16, 0.28], [0, 0.08, 0], "blink"),
      beam("crane-boom", "working-rig", "accent", [-side, 1.18, back], [side * 0.36, 1.42, back], 0.026, "pulse"),
      block("dock-tower", "threshold-frame", "accent", [-side, 0.78, back], [0.14, 1.22, 0.22], [0, 0, -0.04], "tilt"),
      cylinder("harbor-mast", "orientation-post", "light", [side, 0.62, front * 0.72], [0.052, 1.02, 0.052], "float")
    ];
  }

  if (zone.id === "design-atelier") {
    return [
      block("gallery-wall", "threshold-frame", "light", [0, 0.9, back], [r * 1.18, 1.02, 0.1], [0, 0.06, 0], "tilt"),
      beam("swatch-canopy", "working-rig", "accent", [-side, 1.32, back * 0.88], [side, 1.2, back * 0.7], 0.022, "pulse"),
      block("composition-bench", "boundary-rail", "dark", [0, 0.34, front * 0.68], [r * 1.05, 0.08, 0.2], [0, -0.08, 0], "blink"),
      cylinder("palette-pin", "orientation-post", "accent", [side * 0.9, 0.56, front * 0.6], [0.052, 0.9, 0.052], "float")
    ];
  }

  if (zone.id === "three-d-foundry") {
    return [
      block("scanner-left", "threshold-frame", "accent", [-side, 0.76, back], [0.12, 1.18, 0.18], [0, 0, -0.1], "tilt"),
      block("scanner-right", "threshold-frame", "light", [side, 0.76, back], [0.12, 1.18, 0.18], [0, 0, 0.1], "tilt"),
      ring("forge-mouth", "viewpoint-marker", "secondary", [0, 0.72, front * 0.34], [0.66, 0.024, 0.66], [Math.PI * 0.5, 0.2, 0], "sweep"),
      beam("scan-crossbar", "working-rig", "accent", [-side, 1.32, back], [side, 1.32, back], 0.022, "pulse")
    ];
  }

  if (zone.id === "fashion-room") {
    return [
      block("runway-portal-left", "threshold-frame", "accent", [-side, 0.74, back], [0.08, 1.1, 0.18], [0, 0, -0.08], "tilt"),
      block("runway-portal-right", "threshold-frame", "light", [side, 0.74, back], [0.08, 1.1, 0.18], [0, 0, 0.08], "tilt"),
      block("catwalk-spine", "boundary-rail", "dark", [0, 0.34, 0.04], [0.28, 0.08, r * 1.8], [0, 0, 0], "pulse"),
      beam("atelier-crossbar", "working-rig", "light", [-side, 1.32, back], [side, 1.32, back], 0.02, "pulse")
    ];
  }

  if (zone.id === "values-plaza") {
    return [
      block("civic-column-tech", "threshold-frame", "secondary", [-side, 0.78, 0], [0.14, 1.16, 0.18], [0, 0, -0.06], "tilt"),
      block("civic-column-art", "threshold-frame", "accent", [side, 0.78, 0], [0.14, 1.16, 0.18], [0, 0, 0.06], "tilt"),
      beam("shared-cornice", "working-rig", "light", [-side, 1.38, 0], [side, 1.38, 0], 0.024, "pulse"),
      block("crossing-axis", "boundary-rail", "dark", [0, 0.34, front * 0.1], [0.18, 0.08, r * 1.55], [0, 0, 0], "blink")
    ];
  }

  if (zone.id === "contact-portal") {
    return [
      block("mail-left-pier", "threshold-frame", "secondary", [-side, 0.78, back], [0.12, 1.16, 0.22], [0, 0, -0.08], "tilt"),
      block("mail-right-pier", "threshold-frame", "accent", [side, 0.78, back], [0.12, 1.16, 0.22], [0, 0, 0.08], "tilt"),
      beam("mail-header", "working-rig", "light", [-side, 1.38, back], [side, 1.38, back], 0.024, "pulse"),
      ring("mail-field", "viewpoint-marker", "light", [0, 0.86, front * 0.36], [0.74, 0.02, 0.74], [Math.PI * 0.5, 0.12, 0], "sweep")
    ];
  }

  return [
    block("left-place-pier", "threshold-frame", "accent", [-side, 0.68, back], [0.1, tall, 0.16], [0, 0, -0.08], "tilt"),
    block("right-place-pier", "threshold-frame", zone.kind === "studio" ? "secondary" : "light", [side, 0.68, back], [0.1, tall, 0.16], [0, 0, 0.08], "tilt"),
    beam("overhead-place-rig", "working-rig", "light", [-side, 1.22, back], [side, 1.22, back], 0.02, "pulse"),
    block("front-boundary-rail", "boundary-rail", "dark", [0, 0.34, front], [r * 1.16, 0.08, 0.12], [0, 0.08, 0], "blink"),
    cylinder("orientation-pin", "orientation-post", "accent", [side * 0.86, 0.58, front * 0.72], [0.05, 0.94, 0.05], "float")
  ];
};

const familyFor = (zone: StudioZone) => `${zone.id}:place:${zoneVisualFamily(zone.id)}`;

const zoneVisualFamily = (zoneId: string) =>
  ({
    "studio-gate": "biface-arcade",
    "ai-lab": "agent-workshop",
    "observability-tower": "telemetry-lighthouse",
    "architecture-bridge": "load-gantry",
    "cloud-dock": "container-crane",
    "design-atelier": "gallery-canopy",
    "three-d-foundry": "scanner-forge",
    "fashion-room": "runway-proscenium",
    "values-plaza": "civic-colonnade",
    "contact-portal": "inbox-gate"
  })[zoneId] ?? "place-structure";

const createPrimitive = (primitive: PlacePrimitive, zone: StudioZone, palette: Palette, family: string, signature: string) => {
  const mat = materialFor(primitive.tone, zone.kind, palette);
  const object =
    primitive.kind === "block"
      ? new THREE.Mesh(new THREE.BoxGeometry(...primitive.scale), mat)
      : primitive.kind === "cylinder"
        ? new THREE.Mesh(new THREE.CylinderGeometry(primitive.scale[0], primitive.scale[2], primitive.scale[1], 12), mat)
        : primitive.kind === "ring"
          ? new THREE.Mesh(new THREE.TorusGeometry(primitive.scale[0], primitive.scale[1], 8, 56), mat)
          : createBeam(primitive, mat);

  object.position.set(...primitive.position);
  if (primitive.rotation) {
    object.rotation.set(...primitive.rotation);
  }
  tagObject(object, zone.id, family, signature, primitive);
  return object;
};

const createBeam = (primitive: PlacePrimitive, mat: THREE.Material) => {
  const to = primitive.to ?? primitive.position;
  const localTo = new THREE.Vector3(
    to[0] - primitive.position[0],
    to[1] - primitive.position[1],
    to[2] - primitive.position[2]
  );
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, 0, 0), localTo), 1, primitive.scale[0], 8), mat);
};

const tagObject = (object: THREE.Object3D, zoneId: string, family: string, signature: string, primitive: PlacePrimitive) => {
  const role = primitive.role;
  const taggedSignature = `${signature}:${primitive.id}`;
  object.userData.zoneId = zoneId;
  object.userData.placeArchitectureZone = zoneId;
  object.userData.placeArchitectureFamily = family;
  object.userData.placeArchitectureRole = role;
  object.userData.placeArchitectureSignature = taggedSignature;
  object.userData.motionRole = `place:${role}`;
  object.userData.localMotionBehavior = primitive.motion;
  object.userData.motionBaseX = object.position.x;
  object.userData.motionBaseY = object.position.y;
  object.userData.motionBaseZ = object.position.z;
  object.userData.motionBaseRotationX = object.rotation.x;
  object.userData.motionBaseRotationY = object.rotation.y;
  object.userData.motionBaseRotationZ = object.rotation.z;

  object.traverse((child) => {
    child.userData.zoneId = zoneId;
    child.userData.placeArchitectureZone = zoneId;
    child.userData.placeArchitectureFamily = family;
    child.userData.placeArchitectureRole = role;
    child.userData.placeArchitectureSignature = taggedSignature;
    child.userData.motionRole = `place:${role}`;
    child.userData.localMotionBehavior = primitive.motion;
    child.userData.motionBaseX = child.position.x;
    child.userData.motionBaseY = child.position.y;
    child.userData.motionBaseZ = child.position.z;
    child.userData.motionBaseRotationX = child.rotation.x;
    child.userData.motionBaseRotationY = child.rotation.y;
    child.userData.motionBaseRotationZ = child.rotation.z;
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });
};

export function createZonePlaceArchitecture(zone: StudioZone, palette: Palette): RenderedZonePlaceArchitecture {
  const signature = `${zone.id}-place-architecture`;
  const family = familyFor(zone);
  const group = new THREE.Group();
  const roles = new Set<string>();
  const signatures = new Set<string>();
  const motionObjects: THREE.Object3D[] = [];
  let objectCount = 0;

  group.name = `${zone.id}-place-architecture`;
  group.userData.zoneId = zone.id;
  group.userData.placeArchitectureGroup = zone.id;
  group.userData.placeArchitectureFamily = family;

  for (const primitive of recipeFor(zone)) {
    const object = createPrimitive(primitive, zone, palette, family, signature);
    group.add(object);
    roles.add(primitive.role);
    signatures.add(`${signature}:${primitive.id}`);
  }

  group.traverse((child) => {
    if (child instanceof THREE.Mesh && typeof child.userData.placeArchitectureRole === "string") {
      objectCount += 1;
    }
    if (typeof child.userData.motionRole === "string") {
      motionObjects.push(child);
    }
  });

  return { group, objectCount, family, roles, signatures, motionObjects };
}
