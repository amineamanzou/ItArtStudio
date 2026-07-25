import * as THREE from "three";
import type { StudioZone, ZoneKind } from "./zones";

type Palette = Record<ZoneKind | "road" | "ink", number>;
type ActivityType =
  | "studio-strategy"
  | "ai-prototype"
  | "observability-audit"
  | "architecture-review"
  | "cloud-delivery"
  | "brand-system"
  | "product-visualization"
  | "collection-study"
  | "shared-values"
  | "contact-brief";
type MotionBehavior = "pulse" | "sweep" | "tilt" | "float" | "blink";

type ProjectArtifactRecipe = {
  activity: ActivityType;
  signature: string;
  form: "capsule" | "slab" | "lens" | "crystal" | "folio";
  tone: "accent" | "secondary" | "light";
  motion: MotionBehavior;
  positions: Array<[number, number, number]>;
  rotations?: Array<[number, number, number]>;
  scales?: Array<[number, number, number]>;
};

export type RenderedZoneProjectArtifacts = {
  group: THREE.Object3D;
  objectCount: number;
  sceneObjectCount: number;
  activityTypes: Set<string>;
  signatures: Set<string>;
  materialVariants: Set<string>;
  motionObjects: THREE.Object3D[];
};

const projectRecipes: Record<string, ProjectArtifactRecipe> = {
  "studio-gate": artifact("studio-strategy", "dual-discipline-map", "folio", "light", "tilt", [
    [-1.06, 0.26, 1.3],
    [0, 0.28, 1.46],
    [1.06, 0.26, 1.3]
  ]),
  "ai-lab": artifact("ai-prototype", "agent-evaluation-core", "capsule", "accent", "sweep", [
    [-1.08, 0.3, 1.02],
    [-0.58, 0.38, 1.18],
    [-0.1, 0.3, 1.02]
  ]),
  "observability-tower": artifact("observability-audit", "signal-trace-pack", "lens", "light", "blink", [
    [-1.08, 0.34, 0.88],
    [-0.56, 0.46, 1.12]
  ]),
  "architecture-bridge": artifact("architecture-review", "decision-stack", "slab", "secondary", "pulse", [
    [-0.92, 0.28, 0.98],
    [-0.34, 0.36, 1.18]
  ]),
  "cloud-dock": artifact("cloud-delivery", "release-vessel", "capsule", "light", "sweep", [
    [-0.9, 0.3, 1.04],
    [-0.34, 0.36, 1.16]
  ]),
  "design-atelier": artifact("brand-system", "identity-folio", "folio", "accent", "tilt", [
    [-0.98, 0.26, 1.02],
    [-0.4, 0.34, 1.22],
    [0.18, 0.26, 1.02]
  ]),
  "three-d-foundry": artifact("product-visualization", "volume-study", "crystal", "secondary", "float", [
    [-0.96, 0.38, 0.98],
    [-0.38, 0.5, 1.18]
  ]),
  "fashion-room": artifact("collection-study", "silhouette-samples", "slab", "accent", "pulse", [
    [-0.9, 0.28, 1.0],
    [-0.34, 0.38, 1.2]
  ]),
  "values-plaza": artifact("shared-values", "common-principles", "lens", "light", "float", [
    [-0.96, 0.34, 1.12],
    [-0.32, 0.46, 1.32],
    [0.32, 0.34, 1.12]
  ]),
  "contact-portal": artifact("contact-brief", "first-conversation", "folio", "secondary", "tilt", [
    [-0.88, 0.26, 1.08],
    [-0.24, 0.34, 1.26]
  ])
};

export function createZoneProjectArtifacts(zone: StudioZone, palette: Palette): RenderedZoneProjectArtifacts {
  const recipe = projectRecipes[zone.id];
  if (!recipe) {
    const empty = new THREE.Group();
    empty.userData.zoneId = zone.id;
    empty.userData.projectArtifactZone = zone.id;
    return {
      group: empty,
      objectCount: 0,
      sceneObjectCount: 0,
      activityTypes: new Set(),
      signatures: new Set(),
      materialVariants: new Set(),
      motionObjects: []
    };
  }

  const mesh = createProjectArtifactMesh(zone, palette, recipe);
  const signatures = new Set<string>(mesh.userData.projectArtifactSignatures);
  const materialVariants = new Set<string>(mesh.userData.projectArtifactMaterials);

  return {
    group: mesh,
    objectCount: recipe.positions.length,
    sceneObjectCount: 1,
    activityTypes: new Set([recipe.activity]),
    signatures,
    materialVariants,
    motionObjects: [mesh]
  };
}

function artifact(
  activity: ActivityType,
  signature: string,
  form: ProjectArtifactRecipe["form"],
  tone: ProjectArtifactRecipe["tone"],
  motion: MotionBehavior,
  positions: ProjectArtifactRecipe["positions"],
  rotations?: ProjectArtifactRecipe["rotations"],
  scales?: ProjectArtifactRecipe["scales"]
): ProjectArtifactRecipe {
  return { activity, signature, form, tone, motion, positions, rotations, scales };
}

function createProjectArtifactMesh(zone: StudioZone, palette: Palette, recipe: ProjectArtifactRecipe) {
  const geometry = geometryFor(recipe.form);
  const material = materialFor(recipe.tone, zone.kind, palette);
  const mesh = new THREE.InstancedMesh(geometry, material, recipe.positions.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const signatures: string[] = [];
  const materialVariants: string[] = [];
  const activityTypes: string[] = [];

  recipe.positions.forEach((position, index) => {
    const rotation = recipe.rotations?.[index] ?? [0, 0.22 + index * 0.24, index % 2 === 0 ? -0.08 : 0.08];
    const scale = recipe.scales?.[index] ?? [1 + index * 0.06, 1, 1 - index * 0.04];
    dummy.position.set(...position);
    dummy.rotation.set(...rotation);
    dummy.scale.set(...scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    color.setHex(colorForInstance(recipe.tone, zone.kind, palette, index));
    mesh.setColorAt(index, color);
    signatures.push(`project:${zone.kind}:${zone.id}:${recipe.signature}:${index + 1}`);
    materialVariants.push(`${zone.id}:project:${recipe.tone}:${recipe.form}:${index % 2 === 0 ? "primary" : "counter"}`);
    activityTypes.push(recipe.activity);
  });

  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) {
    mesh.instanceColor.needsUpdate = true;
  }
  tagProjectArtifact(mesh, zone, recipe, signatures, materialVariants, activityTypes);
  return mesh;
}

function geometryFor(form: ProjectArtifactRecipe["form"]) {
  if (form === "capsule") {
    const geometry = new THREE.CapsuleGeometry(0.12, 0.38, 5, 12);
    geometry.rotateZ(Math.PI * 0.5);
    return geometry;
  }
  if (form === "lens") {
    const geometry = new THREE.SphereGeometry(0.22, 18, 10);
    geometry.scale(1.2, 0.36, 0.78);
    return geometry;
  }
  if (form === "crystal") {
    return new THREE.OctahedronGeometry(0.25, 0);
  }
  if (form === "folio") {
    const geometry = new THREE.BoxGeometry(0.46, 0.07, 0.3);
    geometry.rotateZ(-0.16);
    return geometry;
  }
  return new THREE.BoxGeometry(0.4, 0.11, 0.28);
}

function materialFor(tone: ProjectArtifactRecipe["tone"], kind: ZoneKind, palette: Palette) {
  const secondary = kind === "tech" ? palette.art : palette.tech;
  const color = tone === "accent" ? palette[kind] : tone === "secondary" ? secondary : palette.road;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.28,
    metalness: 0.58,
    emissive: color,
    emissiveIntensity: 0.18,
    vertexColors: true
  });
}

function colorForInstance(tone: ProjectArtifactRecipe["tone"], kind: ZoneKind, palette: Palette, index: number) {
  if (tone === "light") {
    return index % 2 === 0 ? palette.road : palette[kind];
  }
  if (tone === "secondary") {
    return index % 2 === 0 ? (kind === "tech" ? palette.art : palette.tech) : palette.road;
  }
  return index % 2 === 0 ? palette[kind] : palette.road;
}

function tagProjectArtifact(
  object: THREE.InstancedMesh,
  zone: StudioZone,
  recipe: ProjectArtifactRecipe,
  signatures: string[],
  materialVariants: string[],
  activityTypes: string[]
) {
  object.name = `${zone.id}-project-evidence-kit`;
  object.userData.zoneId = zone.id;
  object.userData.projectArtifactZone = zone.id;
  object.userData.projectArtifactActivity = recipe.activity;
  object.userData.projectArtifactActivities = activityTypes;
  object.userData.projectArtifactRole = `${recipe.activity}:${recipe.form}`;
  object.userData.projectArtifactSignature = signatures[0];
  object.userData.projectArtifactSignatures = signatures;
  object.userData.projectArtifactMaterial = materialVariants[0];
  object.userData.projectArtifactMaterials = materialVariants;
  object.userData.projectArtifactObjectCount = signatures.length;
  object.userData.materialVariant = materialVariants[0];
  object.userData.motionRole = `project:${recipe.activity}`;
  object.userData.localMotionBehavior = recipe.motion;
  object.userData.motionBaseX = object.position.x;
  object.userData.motionBaseY = object.position.y;
  object.userData.motionBaseZ = object.position.z;
  object.userData.motionBaseRotationX = object.rotation.x;
  object.userData.motionBaseRotationY = object.rotation.y;
  object.userData.motionBaseRotationZ = object.rotation.z;
  object.castShadow = true;
  object.receiveShadow = true;
}
