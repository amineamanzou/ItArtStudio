import * as THREE from "three";
import type { StudioZone, ZoneKind } from "./zones";

type Palette = Record<ZoneKind | "road" | "ink", number>;
type MotionBehavior = "pulse" | "sweep" | "tilt" | "float" | "blink";
type ArtifactRole =
  | "threshold-glyph"
  | "agent-workbench"
  | "evaluation-conveyor"
  | "prompt-token"
  | "agent-core"
  | "trace-helix"
  | "telemetry-tower"
  | "telemetry-lighthouse"
  | "log-waterfall"
  | "metric-stack"
  | "radar-beam"
  | "metric-array"
  | "load-lattice"
  | "cloud-platform"
  | "server-array"
  | "electric-cloud"
  | "composition-wall"
  | "pattern-table"
  | "material-palette"
  | "atelier-light-rig"
  | "wireframe-knot"
  | "scan-rig"
  | "volume-slice"
  | "toolpath-arm"
  | "garment-fold"
  | "runway-form"
  | "pattern-rail"
  | "fabric-swatch"
  | "value-crossing"
  | "postal-counter"
  | "reply-portal"
  | "mail-packet"
  | "delivery-signal";

export type RenderedZoneSignatureArtifacts = {
  group: THREE.Group;
  objectCount: number;
  roles: Set<string>;
  signatures: Set<string>;
  materialVariants: Set<string>;
  motionObjects: THREE.Object3D[];
};

const makeMaterial = (color: number, emissive = 0.16, metalness = 0.2, opacity = 1) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.46,
    metalness,
    emissive: color,
    emissiveIntensity: emissive,
    transparent: opacity < 1,
    opacity
  });

const artifactPalette = (zone: StudioZone, palette: Palette) => {
  const secondary = zone.kind === "tech" ? palette.art : palette.tech;
  return {
    accent: makeMaterial(palette[zone.kind], 0.22, zone.kind === "tech" ? 0.34 : 0.18),
    secondary: makeMaterial(secondary, 0.18, 0.2),
    light: makeMaterial(palette.road, 0.14, 0.16),
    dark: makeMaterial(palette.ink, 0.04, 0.18, 0.9)
  };
};

const box = (size: readonly [number, number, number], mat: THREE.Material, position: readonly [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const instancedBoxes = (
  size: readonly [number, number, number],
  mat: THREE.MeshStandardMaterial,
  placements: readonly {
    position: readonly [number, number, number];
    scale?: readonly [number, number, number];
    color?: number;
  }[]
) => {
  const instanceMat = mat.clone();
  instanceMat.color.set(0xffffff);
  instanceMat.vertexColors = true;
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size[0], size[1], size[2]), instanceMat, placements.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  placements.forEach((placement, index) => {
    matrix.compose(
      new THREE.Vector3(placement.position[0], placement.position[1], placement.position[2]),
      quaternion,
      new THREE.Vector3(placement.scale?.[0] ?? 1, placement.scale?.[1] ?? 1, placement.scale?.[2] ?? 1)
    );
    mesh.setMatrixAt(index, matrix);
    if (typeof placement.color === "number") {
      mesh.setColorAt(index, new THREE.Color(placement.color));
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  return mesh;
};

const sphere = (radius: number, mat: THREE.Material, position: readonly [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 10), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const cylinder = (
  radiusTop: number,
  radiusBottom: number,
  height: number,
  mat: THREE.Material,
  position: readonly [number, number, number],
  segments = 16
) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const tube = (points: THREE.Vector3[], radius: number, mat: THREE.Material) =>
  new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 8, false), mat);

const ring = (
  radius: number,
  tubeRadius: number,
  mat: THREE.Material,
  position: readonly [number, number, number],
  rotation: readonly [number, number, number] = [Math.PI * 0.5, 0, 0]
) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tubeRadius, 10, 72), mat);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  return mesh;
};

const add = (
  group: THREE.Group,
  object: THREE.Object3D,
  zone: StudioZone,
  role: ArtifactRole,
  signature: string,
  materialVariant: string,
  motion: MotionBehavior
) => {
  object.userData.zoneId = zone.id;
  object.userData.signatureArtifactZone = zone.id;
  object.userData.signatureArtifactFamily = role;
  object.userData.signatureArtifactRole = `${role}:${signature}`;
  object.userData.signatureArtifactSignature = `${zone.id}:${signature}`;
  object.userData.signatureArtifactMaterial = `${zone.id}:${materialVariant}`;
  object.userData.materialVariant = `${zone.id}:signature:${materialVariant}`;
  object.userData.motionRole = `signature:${role}`;
  object.userData.localMotionBehavior = motion;
  object.userData.motionBaseX = object.position.x;
  object.userData.motionBaseY = object.position.y;
  object.userData.motionBaseZ = object.position.z;
  object.userData.motionBaseRotationX = object.rotation.x;
  object.userData.motionBaseRotationY = object.rotation.y;
  object.userData.motionBaseRotationZ = object.rotation.z;
  object.traverse((child) => {
    child.userData.zoneId = zone.id;
    child.userData.signatureArtifactZone = zone.id;
    child.userData.signatureArtifactFamily = role;
    child.userData.signatureArtifactRole = `${role}:${signature}`;
    child.userData.signatureArtifactSignature = `${zone.id}:${signature}`;
    child.userData.signatureArtifactMaterial = `${zone.id}:${materialVariant}`;
    child.userData.materialVariant = `${zone.id}:signature:${materialVariant}`;
    child.userData.motionRole = `signature:${role}`;
    child.userData.localMotionBehavior = motion;
    child.userData.motionBaseX = child.position.x;
    child.userData.motionBaseY = child.position.y;
    child.userData.motionBaseZ = child.position.z;
    child.userData.motionBaseRotationX = child.rotation.x;
    child.userData.motionBaseRotationY = child.rotation.y;
    child.userData.motionBaseRotationZ = child.rotation.z;
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  group.add(object);
};

const tagSemanticParts = (
  object: THREE.Object3D,
  zone: StudioZone,
  parts: readonly { role: ArtifactRole; signature: string; materialVariant: string }[]
) => {
  object.userData.signatureArtifactObjectCount = parts.length;
  object.userData.signatureArtifactRoles = parts.map((part) => `${part.role}:${part.signature}`);
  object.userData.signatureArtifactSignatures = parts.map((part) => `${zone.id}:${part.signature}`);
  object.userData.signatureArtifactMaterials = parts.map((part) => `${zone.id}:${part.materialVariant}`);
};

const addMetadataValue = (target: Set<string>, value: unknown) => {
  if (typeof value === "string") {
    target.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        target.add(item);
      }
    }
  }
};

export function createZoneSignatureArtifacts(zone: StudioZone, palette: Palette): RenderedZoneSignatureArtifacts {
  const mats = artifactPalette(zone, palette);
  const group = new THREE.Group();
  group.name = `${zone.id}-signature-artifacts`;
  group.userData.zoneId = zone.id;
  group.userData.signatureArtifactGroup = zone.id;

  if (zone.id === "studio-gate") createStudioGateArtifacts(group, zone, mats);
  else if (zone.id === "ai-lab") createAiArtifacts(group, zone, mats);
  else if (zone.id === "observability-tower") createTraceArtifacts(group, zone, mats);
  else if (zone.id === "architecture-bridge") createArchitectureArtifacts(group, zone, mats);
  else if (zone.id === "cloud-dock") createCloudArtifacts(group, zone, mats);
  else if (zone.id === "design-atelier") createDesignArtifacts(group, zone, mats);
  else if (zone.id === "three-d-foundry") createFoundryArtifacts(group, zone, mats);
  else if (zone.id === "fashion-room") createFashionArtifacts(group, zone, mats);
  else if (zone.id === "values-plaza") createValuesArtifacts(group, zone, mats);
  else createContactArtifacts(group, zone, mats);

  const roles = new Set<string>();
  const signatures = new Set<string>();
  const materialVariants = new Set<string>();
  const motionObjects: THREE.Object3D[] = [];
  let objectCount = 0;

  group.traverse((child) => {
    if (child instanceof THREE.InstancedMesh && typeof child.userData.signatureArtifactRole === "string") {
      objectCount +=
        typeof child.userData.signatureArtifactObjectCount === "number"
          ? child.userData.signatureArtifactObjectCount
          : child.count;
    } else if (child instanceof THREE.Mesh && typeof child.userData.signatureArtifactRole === "string") {
      objectCount += typeof child.userData.signatureArtifactObjectCount === "number" ? child.userData.signatureArtifactObjectCount : 1;
    }
    addMetadataValue(roles, child.userData.signatureArtifactRole);
    addMetadataValue(roles, child.userData.signatureArtifactRoles);
    addMetadataValue(signatures, child.userData.signatureArtifactSignature);
    addMetadataValue(signatures, child.userData.signatureArtifactSignatures);
    addMetadataValue(materialVariants, child.userData.signatureArtifactMaterial);
    addMetadataValue(materialVariants, child.userData.signatureArtifactMaterials);
    if (typeof child.userData.motionRole === "string") {
      motionObjects.push(child);
    }
  });

  return { group, objectCount, roles, signatures, materialVariants, motionObjects };
}

type ArtifactMaterials = ReturnType<typeof artifactPalette>;

function createStudioGateArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  add(group, ring(0.54, 0.025, mats.light, [-1.0, 1.18, 0.74], [0.35, 0.2, 0.1]), zone, "threshold-glyph", "tech-orbit", "light-ring", "sweep");
  add(group, ring(0.54, 0.025, mats.accent, [1.0, 1.18, -0.74], [0.35, -0.2, 0.1]), zone, "threshold-glyph", "art-orbit", "accent-ring", "sweep");
  add(group, box([0.08, 1.26, 0.08], mats.secondary, [-0.28, 0.92, 0.74]), zone, "threshold-glyph", "frontier-pin-a", "secondary-pin", "pulse");
  add(group, box([0.08, 1.26, 0.08], mats.accent, [0.28, 0.92, -0.74]), zone, "threshold-glyph", "frontier-pin-b", "accent-pin", "pulse");
}

function createAiArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  const workbench = box([1.48, 0.18, 0.72], mats.dark, [0, 0.52, -0.72]);
  workbench.rotation.y = -0.04;
  add(group, workbench, zone, "agent-workbench", "agentic-workbench-slab", "dark-workbench", "tilt");

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), mats.accent);
  core.position.set(-0.52, 0.9, -0.72);
  core.scale.set(1.15, 0.82, 1.15);
  add(group, core, zone, "agent-core", "compact-agent-core", "accent-core", "pulse");

  const conveyor = box([1.52, 0.08, 0.22], mats.secondary, [0.28, 0.7, -0.14]);
  conveyor.rotation.y = 0.12;
  add(group, conveyor, zone, "evaluation-conveyor", "evaluation-conveyor-belt", "secondary-belt", "sweep");

  const evaluationRails = instancedBoxes([0.28, 0.055, 0.08], mats.light, [
    { position: [-0.36, 0.82, 0.02], scale: [1, 1, 1], color: mats.light.color.getHex() },
    { position: [0.1, 0.86, 0.02], scale: [1.16, 1, 1], color: mats.secondary.color.getHex() },
    { position: [0.62, 0.9, 0.02], scale: [0.92, 1, 1], color: mats.accent.color.getHex() }
  ]);
  add(group, evaluationRails, zone, "evaluation-conveyor", "evaluation-score-rail", "instanced-evaluation-rail", "blink");
  tagSemanticParts(evaluationRails, zone, [
    { role: "evaluation-conveyor", signature: "eval-score-a", materialVariant: "light-score" },
    { role: "evaluation-conveyor", signature: "eval-score-b", materialVariant: "secondary-score" },
    { role: "evaluation-conveyor", signature: "eval-score-c", materialVariant: "accent-score" }
  ]);

  const evaluationDisplay = box([0.86, 0.18, 0.08], mats.light, [0.32, 1.78, -0.36]);
  evaluationDisplay.rotation.y = 0.18;
  add(group, evaluationDisplay, zone, "evaluation-conveyor", "agent-evaluation-display", "light-evaluation-display", "blink");

  const promptTokens = instancedBoxes([0.16, 0.16, 0.16], mats.light, [
    { position: [-0.62, 0.74, 0.42], color: mats.accent.color.getHex() },
    { position: [-0.22, 0.8, 0.5], color: mats.light.color.getHex() },
    { position: [0.18, 0.76, 0.46], color: mats.secondary.color.getHex() },
    { position: [0.58, 0.84, 0.54], color: mats.accent.color.getHex() }
  ]);
  add(group, promptTokens, zone, "prompt-token", "prompt-token-batch", "instanced-prompt-tokens", "float");
  tagSemanticParts(promptTokens, zone, [
    { role: "prompt-token", signature: "prompt-token-system", materialVariant: "accent-token" },
    { role: "prompt-token", signature: "prompt-token-tool", materialVariant: "light-token" },
    { role: "prompt-token", signature: "prompt-token-memory", materialVariant: "secondary-token" },
    { role: "prompt-token", signature: "prompt-token-output", materialVariant: "accent-token" }
  ]);

  add(
    group,
    tube([
      new THREE.Vector3(-0.52, 0.9, -0.72),
      new THREE.Vector3(-0.12, 1.02, -0.42),
      new THREE.Vector3(0.54, 0.9, -0.14)
    ], 0.018, mats.light),
    zone,
    "agent-core",
    "agent-core-to-eval-loop",
    "light-feedback-loop",
    "pulse"
  );
}

function createTraceArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  add(group, cylinder(0.09, 0.18, 2.18, mats.dark, [0, 1.32, -0.78], 18), zone, "telemetry-lighthouse", "telemetry-lighthouse-mast", "dark-lighthouse", "pulse");
  add(group, cylinder(0.44, 0.56, 0.14, mats.secondary, [0, 0.42, -0.78], 24), zone, "telemetry-lighthouse", "lighthouse-radar-base", "secondary-base", "tilt");
  add(group, ring(0.72, 0.018, mats.accent, [0, 2.26, -0.78], [Math.PI * 0.5, 0.14, 0.26]), zone, "radar-beam", "radar-sweep-crown", "accent-crown", "sweep");
  add(
    group,
    tube([
      new THREE.Vector3(-0.72, 2.12, -0.78),
      new THREE.Vector3(-0.2, 2.38, -0.96),
      new THREE.Vector3(0.44, 2.12, -0.56),
      new THREE.Vector3(1.16, 1.92, -0.78)
    ], 0.018, mats.accent),
    zone,
    "radar-beam",
    "wide-radar-beam",
    "accent-radar-beam",
    "sweep"
  );
  const metricStack = instancedBoxes([0.16, 0.24, 0.08], mats.light, [
    { position: [-0.5, 1.12, -0.46], scale: [1, 0.8, 1], color: mats.light.color.getHex() },
    { position: [-0.24, 1.22, -0.46], scale: [1, 1.15, 1], color: mats.secondary.color.getHex() },
    { position: [0.02, 1.34, -0.46], scale: [1, 1.5, 1], color: mats.accent.color.getHex() },
    { position: [0.28, 1.46, -0.46], scale: [1, 1.9, 1], color: mats.light.color.getHex() }
  ]);
  add(group, metricStack, zone, "metric-stack", "vertical-metric-stack", "instanced-metric-stack", "blink");
  tagSemanticParts(metricStack, zone, [
    { role: "metric-stack", signature: "metric-p50", materialVariant: "light-metric" },
    { role: "metric-stack", signature: "metric-p95", materialVariant: "secondary-metric" },
    { role: "metric-stack", signature: "metric-error", materialVariant: "accent-metric" },
    { role: "metric-stack", signature: "metric-slo", materialVariant: "light-metric" }
  ]);

  const logWaterfall = instancedBoxes([0.5, 0.04, 0.08], mats.secondary, [
    { position: [0.66, 1.44, -0.78], scale: [0.9, 1, 1], color: mats.secondary.color.getHex() },
    { position: [0.7, 1.24, -0.78], scale: [1.12, 1, 1], color: mats.light.color.getHex() },
    { position: [0.66, 1.04, -0.78], scale: [0.74, 1, 1], color: mats.accent.color.getHex() },
    { position: [0.7, 0.84, -0.78], scale: [1.02, 1, 1], color: mats.secondary.color.getHex() }
  ]);
  add(group, logWaterfall, zone, "log-waterfall", "log-waterfall-strips", "instanced-log-waterfall", "float");
  tagSemanticParts(logWaterfall, zone, [
    { role: "log-waterfall", signature: "log-ingest", materialVariant: "secondary-log" },
    { role: "log-waterfall", signature: "log-parse", materialVariant: "light-log" },
    { role: "log-waterfall", signature: "log-alert", materialVariant: "accent-log" },
    { role: "log-waterfall", signature: "log-retain", materialVariant: "secondary-log" }
  ]);
}

function createArchitectureArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  const anchors = [
    new THREE.Vector3(-0.84, 0.58, -0.76),
    new THREE.Vector3(0, 1.54, 0),
    new THREE.Vector3(0.84, 0.58, 0.76),
    new THREE.Vector3(-0.84, 0.58, 0.76),
    new THREE.Vector3(0.84, 0.58, -0.76)
  ];
  [[0, 1], [1, 2], [1, 3], [1, 4], [0, 4], [3, 2]].forEach(([a, b], index) => {
    add(group, tube([anchors[a], anchors[b]], 0.02, index % 2 ? mats.light : mats.accent), zone, "load-lattice", `load-edge-${index}`, index % 2 ? "light-edge" : "accent-edge", "pulse");
  });
  add(group, box([0.44, 0.08, 0.44], mats.secondary, [0, 1.54, 0]), zone, "load-lattice", "decision-node", "secondary-node", "tilt");
}

function createCloudArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  add(group, box([1.28, 0.18, 0.68], mats.dark, [0, 0.42, -0.88]), zone, "cloud-platform", "floating-dock-deck", "dark-dock", "pulse");
  add(group, box([0.86, 0.08, 0.16], mats.light, [0, 0.6, -1.18]), zone, "cloud-platform", "deployment-runway", "light-runway", "pulse");
  add(group, cylinder(0.05, 0.08, 1.02, mats.secondary, [-0.62, 0.98, -0.86], 12), zone, "server-array", "uplink-mast", "secondary-mast", "tilt");
  const rackArray = instancedBoxes([0.18, 1, 0.22], mats.light, [
    { position: [-0.36, 0.88, -0.92], scale: [1, 0.78, 1], color: mats.accent.color.getHex() },
    { position: [-0.08, 0.98, -0.92], scale: [1, 0.96, 1], color: mats.light.color.getHex() },
    { position: [0.2, 0.84, -0.92], scale: [1, 0.68, 1], color: mats.secondary.color.getHex() }
  ]);
  add(group, rackArray, zone, "server-array", "edge-rack-cluster", "instanced-racks", "blink");
  tagSemanticParts(rackArray, zone, [
    { role: "server-array", signature: "edge-rack-a", materialVariant: "accent-rack" },
    { role: "server-array", signature: "edge-rack-b", materialVariant: "light-rack" },
    { role: "server-array", signature: "edge-rack-c", materialVariant: "secondary-rack" }
  ]);
  add(group, sphere(0.39, mats.light, [0.52, 1.5, -0.58]), zone, "electric-cloud", "cloud-core", "light-cloud", "float");
  add(group, sphere(0.27, mats.secondary, [0.88, 1.36, -0.58]), zone, "electric-cloud", "cloud-lobe", "secondary-cloud", "float");
  add(
    group,
    tube([
      new THREE.Vector3(-0.56, 1.36, -0.86),
      new THREE.Vector3(-0.18, 1.66, -0.72),
      new THREE.Vector3(0.26, 1.32, -0.68),
      new THREE.Vector3(0.62, 1.5, -0.58)
    ], 0.018, mats.accent),
    zone,
    "electric-cloud",
    "rack-to-cloud-arc",
    "accent-arc",
    "sweep"
  );
}

function createDesignArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  add(group, box([1.22, 0.88, 0.06], mats.light, [0.18, 1.2, -0.82]), zone, "composition-wall", "canvas-plane", "light-plane", "tilt");

  const easelFrame = instancedBoxes([1, 1, 0.055], mats.dark, [
    { position: [-0.48, 1.2, -0.76], scale: [0.055, 1.06, 1], color: mats.dark.color.getHex() },
    { position: [0.84, 1.2, -0.76], scale: [0.055, 1.06, 1], color: mats.dark.color.getHex() },
    { position: [0.18, 1.68, -0.76], scale: [1.38, 0.055, 1], color: mats.accent.color.getHex() },
    { position: [0.18, 0.72, -0.76], scale: [1.22, 0.055, 1], color: mats.secondary.color.getHex() }
  ]);
  add(group, easelFrame, zone, "composition-wall", "easel-frame-cluster", "instanced-frame", "pulse");
  tagSemanticParts(easelFrame, zone, [
    { role: "composition-wall", signature: "easel-left-rail", materialVariant: "dark-frame" },
    { role: "composition-wall", signature: "easel-right-rail", materialVariant: "dark-frame" },
    { role: "composition-wall", signature: "easel-top-rail", materialVariant: "accent-frame" },
    { role: "composition-wall", signature: "easel-bottom-rail", materialVariant: "secondary-frame" }
  ]);

  add(group, tube([
    new THREE.Vector3(-0.32, 1.1, -0.75),
    new THREE.Vector3(-0.04, 1.52, -0.74),
    new THREE.Vector3(0.34, 1.34, -0.73),
    new THREE.Vector3(0.64, 1.56, -0.72)
  ], 0.02, mats.accent), zone, "composition-wall", "paint-gesture-curve", "accent-gesture", "pulse");

  const draftingTable = box([1.12, 0.14, 0.54], mats.dark, [0.22, 0.48, 0.72]);
  draftingTable.rotation.y = -0.34;
  add(group, draftingTable, zone, "pattern-table", "diagonal-drafting-table", "dark-table", "tilt");

  add(group, tube([
    new THREE.Vector3(-0.7, 1.94, 0.52),
    new THREE.Vector3(-0.22, 1.7, 0.38),
    new THREE.Vector3(0.38, 1.02, 0.56),
    new THREE.Vector3(0.72, 0.74, 0.78)
  ], 0.026, mats.secondary), zone, "atelier-light-rig", "diagonal-studio-lamp", "secondary-light-rig", "sweep");

  const swatches = instancedBoxes([0.18, 0.08, 0.18], mats.light, [
    { position: [-0.36, 0.66, 1.0], color: mats.accent.color.getHex() },
    { position: [-0.1, 0.6, 0.92], color: mats.secondary.color.getHex() },
    { position: [0.16, 0.64, 0.98], color: mats.light.color.getHex() },
    { position: [0.42, 0.58, 0.9], color: mats.accent.color.getHex() },
    { position: [0.68, 0.62, 0.96], color: mats.secondary.color.getHex() }
  ]);
  add(group, swatches, zone, "material-palette", "material-rail-cluster", "instanced-materials", "blink");
  tagSemanticParts(swatches, zone, [
    { role: "material-palette", signature: "material-swatch-0", materialVariant: "accent-swatch" },
    { role: "material-palette", signature: "material-swatch-1", materialVariant: "secondary-swatch" },
    { role: "material-palette", signature: "material-swatch-2", materialVariant: "light-swatch" },
    { role: "material-palette", signature: "material-swatch-3", materialVariant: "accent-swatch" },
    { role: "material-palette", signature: "material-swatch-4", materialVariant: "secondary-swatch" }
  ]);
}

function createFoundryArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.34, 0.035, 88, 10, 2, 3), mats.accent);
  knot.position.set(0.1, 1.28, -0.84);
  knot.rotation.set(0.4, 0.2, -0.1);
  add(group, knot, zone, "wireframe-knot", "parametric-knot", "accent-knot", "sweep");
  add(group, ring(0.6, 0.014, mats.light, [0.1, 1.28, -0.84], [0.8, 0.2, 0.4]), zone, "volume-slice", "section-ring-a", "light-section", "tilt");
  add(group, ring(0.48, 0.014, mats.secondary, [0.1, 1.28, -0.84], [0.2, 0.9, 0.1]), zone, "volume-slice", "section-ring-b", "secondary-section", "tilt");
  const scanPosts = instancedBoxes([0.1, 1.02, 0.1], mats.dark, [
    { position: [-0.72, 0.96, -0.84], scale: [1, 1, 1], color: mats.dark.color.getHex() },
    { position: [0.92, 0.86, -0.82], scale: [0.82, 0.82, 0.82], color: mats.light.color.getHex() },
    { position: [0.1, 0.56, -1.42], scale: [0.72, 0.58, 0.72], color: mats.secondary.color.getHex() }
  ]);
  add(group, scanPosts, zone, "scan-rig", "scan-post-array", "instanced-scan-posts", "blink");
  tagSemanticParts(scanPosts, zone, [
    { role: "scan-rig", signature: "scan-post-left", materialVariant: "dark-post" },
    { role: "scan-rig", signature: "scan-post-right", materialVariant: "light-post" },
    { role: "scan-rig", signature: "depth-calibration-pin", materialVariant: "secondary-pin" }
  ]);
  const toolpath = instancedBoxes([0.34, 0.045, 0.06], mats.light, [
    { position: [-0.42, 1.86, -0.78], scale: [1, 1, 1], color: mats.light.color.getHex() },
    { position: [-0.08, 1.72, -0.58], scale: [0.86, 1, 1], color: mats.accent.color.getHex() },
    { position: [0.36, 1.62, -0.7], scale: [0.74, 1, 1], color: mats.secondary.color.getHex() },
    { position: [0.72, 1.42, -0.96], scale: [0.58, 1, 1], color: mats.light.color.getHex() }
  ]);
  toolpath.rotation.y = -0.32;
  add(group, toolpath, zone, "toolpath-arm", "milling-toolpath", "instanced-toolpath", "sweep");
  tagSemanticParts(toolpath, zone, [
    { role: "toolpath-arm", signature: "toolpath-cut-0", materialVariant: "light-cut" },
    { role: "toolpath-arm", signature: "toolpath-cut-1", materialVariant: "accent-cut" },
    { role: "toolpath-arm", signature: "toolpath-cut-2", materialVariant: "secondary-cut" },
    { role: "toolpath-arm", signature: "toolpath-cut-3", materialVariant: "light-cut" }
  ]);
}

function createFashionArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  const garmentShape = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.16, 0),
      new THREE.Vector2(0.48, 0.36),
      new THREE.Vector2(0.32, 0.82),
      new THREE.Vector2(0.18, 1.12)
    ],
    18
  );
  const garment = new THREE.Mesh(garmentShape, mats.accent);
  garment.position.set(0, 0.42, -0.82);
  garment.scale.set(0.72, 1.38, 0.72);
  add(group, garment, zone, "garment-fold", "lathe-drape", "accent-drape", "tilt");
  add(group, tube([new THREE.Vector3(-0.62, 1.64, -0.82), new THREE.Vector3(0, 1.82, -0.82), new THREE.Vector3(0.62, 1.64, -0.82)], 0.018, mats.light), zone, "runway-form", "hanger-curve", "light-hanger", "sweep");
  const ribs = instancedBoxes([0.055, 0.72, 0.04], mats.secondary, [
    { position: [-0.48, 0.94, -0.44], scale: [1, 1, 1], color: mats.secondary.color.getHex() },
    { position: [0, 0.98, -0.42], scale: [0.82, 1.08, 1], color: mats.light.color.getHex() },
    { position: [0.48, 0.94, -0.44], scale: [1, 1, 1], color: mats.secondary.color.getHex() }
  ]);
  add(group, ribs, zone, "garment-fold", "fabric-rib-array", "instanced-ribs", "float");
  tagSemanticParts(ribs, zone, [
    { role: "garment-fold", signature: "fabric-rib-left", materialVariant: "secondary-rib" },
    { role: "garment-fold", signature: "fabric-rib-center", materialVariant: "light-rib" },
    { role: "garment-fold", signature: "fabric-rib-right", materialVariant: "secondary-rib" }
  ]);
  const patternRails = instancedBoxes([0.62, 0.04, 0.055], mats.light, [
    { position: [-0.42, 0.56, 0.18], scale: [1, 1, 1], color: mats.light.color.getHex() },
    { position: [0.42, 0.56, 0.18], scale: [1, 1, 1], color: mats.accent.color.getHex() },
    { position: [0, 0.62, 0.52], scale: [1.24, 1, 1], color: mats.secondary.color.getHex() }
  ]);
  patternRails.rotation.y = 0.12;
  add(group, patternRails, zone, "pattern-rail", "cut-pattern-rails", "instanced-pattern-rails", "blink");
  tagSemanticParts(patternRails, zone, [
    { role: "pattern-rail", signature: "pattern-rail-left", materialVariant: "light-pattern" },
    { role: "pattern-rail", signature: "pattern-rail-right", materialVariant: "accent-pattern" },
    { role: "pattern-rail", signature: "center-grain-line", materialVariant: "secondary-pattern" }
  ]);
  const swatches = instancedBoxes([0.16, 0.06, 0.18], mats.light, [
    { position: [-0.66, 0.44, 0.78], color: mats.accent.color.getHex() },
    { position: [-0.4, 0.44, 0.84], color: mats.secondary.color.getHex() },
    { position: [-0.14, 0.44, 0.8], color: mats.light.color.getHex() }
  ]);
  add(group, swatches, zone, "fabric-swatch", "material-swatch-run", "instanced-swatches", "pulse");
  tagSemanticParts(swatches, zone, [
    { role: "fabric-swatch", signature: "fabric-swatch-accent", materialVariant: "accent-swatch" },
    { role: "fabric-swatch", signature: "fabric-swatch-secondary", materialVariant: "secondary-swatch" },
    { role: "fabric-swatch", signature: "fabric-swatch-light", materialVariant: "light-swatch" }
  ]);
}

function createValuesArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  add(group, ring(0.58, 0.03, mats.accent, [0, 1.1, -0.68], [0.85, 0, 0]), zone, "value-crossing", "art-value-ring", "accent-ring", "sweep");
  add(group, ring(0.58, 0.03, mats.secondary, [0, 1.1, 0.68], [0.85, Math.PI * 0.5, 0]), zone, "value-crossing", "tech-value-ring", "secondary-ring", "sweep");
  ["clarte", "soin", "audace", "impact"].forEach((name, index) => {
    const angle = (index / 4) * Math.PI * 2 + Math.PI * 0.25;
    add(group, cylinder(0.06, 0.1, 0.74, index % 2 ? mats.light : mats.accent, [Math.cos(angle) * 0.92, 0.74, Math.sin(angle) * 0.92], 10), zone, "value-crossing", `value-pillar-${name}`, index % 2 ? "light-pillar" : "accent-pillar", "pulse");
  });
}

function createContactArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  add(group, box([1.08, 0.28, 0.54], mats.dark, [-0.08, 0.48, -0.76]), zone, "postal-counter", "service-counter", "dark-counter", "pulse");
  add(group, box([0.62, 0.12, 0.38], mats.secondary, [0.28, 0.72, -0.74]), zone, "postal-counter", "mail-sort-tray", "secondary-tray", "blink");
  add(group, ring(0.74, 0.032, mats.light, [0.1, 1.14, -0.72], [0, 0.16, 0]), zone, "reply-portal", "reply-field-ring", "light-ring", "sweep");
  const mailStack = instancedBoxes([0.58, 0.24, 0.045], mats.light, [
    { position: [-0.04, 0.92, -0.68], scale: [1, 1, 1], color: mats.accent.color.getHex() },
    { position: [0.08, 0.98, -0.66], scale: [0.9, 0.86, 1], color: mats.light.color.getHex() },
    { position: [0.2, 1.04, -0.64], scale: [0.84, 0.78, 1], color: mats.secondary.color.getHex() },
    { position: [0.32, 1.1, -0.62], scale: [0.76, 0.68, 1], color: mats.accent.color.getHex() }
  ]);
  add(group, mailStack, zone, "mail-packet", "envelope-stack", "instanced-envelopes", "pulse");
  tagSemanticParts(mailStack, zone, [
    { role: "mail-packet", signature: "message-card-0", materialVariant: "accent-card" },
    { role: "mail-packet", signature: "message-card-1", materialVariant: "light-card" },
    { role: "mail-packet", signature: "message-card-2", materialVariant: "secondary-card" },
    { role: "mail-packet", signature: "message-card-3", materialVariant: "accent-card" }
  ]);
  add(group, tube([new THREE.Vector3(-0.28, 1.08, -0.66), new THREE.Vector3(0.1, 0.84, -0.64), new THREE.Vector3(0.48, 1.08, -0.66)], 0.016, mats.light), zone, "mail-packet", "envelope-fold", "light-fold", "pulse");
  add(group, tube([
    new THREE.Vector3(-0.72, 0.82, 0.18),
    new THREE.Vector3(-0.28, 1.2, -0.16),
    new THREE.Vector3(0.34, 1.42, -0.42),
    new THREE.Vector3(0.82, 1.26, -0.72)
  ], 0.018, mats.secondary), zone, "delivery-signal", "sorting-signal-arc", "secondary-signal", "sweep");
  const signalDots = instancedBoxes([0.09, 0.09, 0.09], mats.light, [
    { position: [-0.5, 1.58, -0.72], color: mats.light.color.getHex() },
    { position: [0.02, 1.7, -0.72], color: mats.secondary.color.getHex() },
    { position: [0.54, 1.56, -0.72], color: mats.light.color.getHex() }
  ]);
  add(group, signalDots, zone, "delivery-signal", "signal-dot-cluster", "instanced-dots", "blink");
  tagSemanticParts(signalDots, zone, [
    { role: "delivery-signal", signature: "signal-dot-0", materialVariant: "light-dot" },
    { role: "delivery-signal", signature: "signal-dot-1", materialVariant: "secondary-dot" },
    { role: "delivery-signal", signature: "signal-dot-2", materialVariant: "light-dot" }
  ]);
}
