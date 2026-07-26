import * as THREE from "three";
import type { StudioZone, ZoneKind } from "./zones";

type Palette = Record<ZoneKind | "road" | "ink", number>;
type MotionBehavior = "pulse" | "sweep" | "tilt" | "float" | "blink";
type ArtifactRole =
  | "threshold-glyph"
  | "agent-core"
  | "trace-helix"
  | "load-lattice"
  | "cloud-vessel"
  | "composition-wall"
  | "wireframe-knot"
  | "garment-fold"
  | "value-crossing"
  | "contact-signal";

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
    if (child instanceof THREE.Mesh && typeof child.userData.signatureArtifactRole === "string") {
      objectCount += 1;
    }
    if (typeof child.userData.signatureArtifactRole === "string") {
      roles.add(child.userData.signatureArtifactRole);
    }
    if (typeof child.userData.signatureArtifactSignature === "string") {
      signatures.add(child.userData.signatureArtifactSignature);
    }
    if (typeof child.userData.signatureArtifactMaterial === "string") {
      materialVariants.add(child.userData.signatureArtifactMaterial);
    }
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
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), mats.accent);
  core.position.set(0, 1.42, -0.82);
  add(group, core, zone, "agent-core", "agent-poly-core", "accent-poly", "tilt");
  for (let index = 0; index < 3; index += 1) {
    add(group, ring(0.5 + index * 0.12, 0.014, index % 2 ? mats.light : mats.secondary, [0, 1.42, -0.82], [0.55, index * 0.7, 0.3]), zone, "agent-core", `agent-orbit-${index}`, index % 2 ? "light-orbit" : "secondary-orbit", "sweep");
  }
  add(group, tube([new THREE.Vector3(-0.86, 0.58, -0.55), new THREE.Vector3(-0.22, 1.12, -0.7), new THREE.Vector3(0, 1.42, -0.82)], 0.018, mats.light), zone, "agent-core", "prompt-stream-a", "light-tube", "pulse");
  add(group, tube([new THREE.Vector3(0.86, 0.58, -0.55), new THREE.Vector3(0.24, 1.12, -0.95), new THREE.Vector3(0, 1.42, -0.82)], 0.018, mats.secondary), zone, "agent-core", "prompt-stream-b", "secondary-tube", "pulse");
}

function createTraceArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  const points = Array.from({ length: 9 }, (_, index) => {
    const t = index / 8;
    const angle = t * Math.PI * 2.6;
    return new THREE.Vector3(Math.cos(angle) * 0.54, 0.55 + t * 1.22, Math.sin(angle) * 0.54);
  });
  add(group, tube(points, 0.022, mats.accent), zone, "trace-helix", "trace-spiral", "accent-helix", "sweep");
  points.slice(1, -1).forEach((point, index) => {
    add(group, sphere(0.075, index % 2 ? mats.light : mats.secondary, [point.x, point.y, point.z]), zone, "trace-helix", `trace-sample-${index}`, index % 2 ? "light-sample" : "secondary-sample", "blink");
  });
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
  add(group, box([1.08, 0.28, 0.46], mats.dark, [0, 0.5, -0.88]), zone, "cloud-vessel", "deployment-hull", "dark-hull", "pulse");
  for (let index = 0; index < 4; index += 1) {
    add(group, box([0.2, 0.24 + index * 0.04, 0.18], index % 2 ? mats.light : mats.accent, [-0.42 + index * 0.28, 0.76 + index * 0.02, -0.9]), zone, "cloud-vessel", `container-${index}`, index % 2 ? "light-container" : "accent-container", "blink");
  }
  add(group, sphere(0.28, mats.light, [0.12, 1.3, -0.52]), zone, "cloud-vessel", "cloud-node-a", "light-cloud", "float");
  add(group, sphere(0.2, mats.secondary, [0.48, 1.22, -0.52]), zone, "cloud-vessel", "cloud-node-b", "secondary-cloud", "float");
}

function createDesignArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  add(group, box([1.16, 0.74, 0.06], mats.light, [0.24, 1.18, -0.82]), zone, "composition-wall", "canvas-plane", "light-plane", "tilt");
  const curve = tube([
    new THREE.Vector3(-0.24, 1.1, -0.76),
    new THREE.Vector3(0.12, 1.44, -0.75),
    new THREE.Vector3(0.58, 1.08, -0.74)
  ], 0.018, mats.accent);
  add(group, curve, zone, "composition-wall", "gesture-line", "accent-gesture", "pulse");
  for (let index = 0; index < 5; index += 1) {
    add(group, box([0.16, 0.08, 0.16], index % 2 ? mats.secondary : mats.accent, [-0.18 + index * 0.24, 0.58, 0.92]), zone, "composition-wall", `swatch-specimen-${index}`, index % 2 ? "secondary-swatch" : "accent-swatch", "pulse");
  }
}

function createFoundryArtifacts(group: THREE.Group, zone: StudioZone, mats: ArtifactMaterials) {
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.34, 0.035, 88, 10, 2, 3), mats.accent);
  knot.position.set(0.1, 1.28, -0.84);
  knot.rotation.set(0.4, 0.2, -0.1);
  add(group, knot, zone, "wireframe-knot", "parametric-knot", "accent-knot", "sweep");
  add(group, ring(0.6, 0.014, mats.light, [0.1, 1.28, -0.84], [0.8, 0.2, 0.4]), zone, "wireframe-knot", "section-ring-a", "light-section", "tilt");
  add(group, ring(0.48, 0.014, mats.secondary, [0.1, 1.28, -0.84], [0.2, 0.9, 0.1]), zone, "wireframe-knot", "section-ring-b", "secondary-section", "tilt");
  add(group, box([0.12, 1.02, 0.12], mats.dark, [-0.68, 0.96, -0.84]), zone, "wireframe-knot", "scan-post", "dark-post", "blink");
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
  garment.position.set(0, 0.62, -0.82);
  garment.scale.set(0.72, 0.72, 0.72);
  add(group, garment, zone, "garment-fold", "lathe-drape", "accent-drape", "tilt");
  add(group, tube([new THREE.Vector3(-0.62, 1.38, -0.82), new THREE.Vector3(0, 1.52, -0.82), new THREE.Vector3(0.62, 1.38, -0.82)], 0.018, mats.light), zone, "garment-fold", "hanger-curve", "light-hanger", "sweep");
  for (const x of [-0.48, 0, 0.48]) {
    add(group, box([0.06, 0.72, 0.04], mats.secondary, [x, 0.94, -0.44]), zone, "garment-fold", `fabric-rib-${x}`, "secondary-rib", "float");
  }
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
  add(group, ring(0.76, 0.035, mats.light, [0, 1.08, -0.74], [Math.PI * 0.5, 0.15, 0]), zone, "contact-signal", "signal-ring", "light-ring", "sweep");
  add(group, box([0.72, 0.42, 0.05], mats.accent, [0, 0.92, -0.72]), zone, "contact-signal", "mail-card", "accent-card", "pulse");
  add(group, tube([new THREE.Vector3(-0.34, 0.98, -0.67), new THREE.Vector3(0, 0.78, -0.65), new THREE.Vector3(0.34, 0.98, -0.67)], 0.016, mats.light), zone, "contact-signal", "mail-fold", "light-fold", "pulse");
  for (let index = 0; index < 3; index += 1) {
    add(group, sphere(0.07, index % 2 ? mats.secondary : mats.light, [-0.52 + index * 0.52, 1.62, -0.72]), zone, "contact-signal", `signal-dot-${index}`, index % 2 ? "secondary-dot" : "light-dot", "blink");
  }
}
