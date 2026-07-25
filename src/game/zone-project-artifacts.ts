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
type ArtifactManifestId = "trace-instrument" | "release-module" | "swatch-folio" | "reply-folio";
type SpecimenGeometry = {
  geometry: THREE.BufferGeometry;
  family: ProjectArtifactRecipe["form"];
  detailProfile: string;
  reliefSignatures: string[];
  roleReliefSignatures: Record<string, string[]>;
  themeRoles: string[];
  manifestId: ArtifactManifestId | "base";
  partCount: number;
  vertexCount: number;
};

type ProjectArtifactRecipe = {
  activity: ActivityType;
  signature: string;
  form: "capsule" | "slab" | "lens" | "crystal" | "folio";
  tone: "accent" | "secondary" | "light";
  motion: MotionBehavior;
  positions: Array<[number, number, number]>;
  rotations?: Array<[number, number, number]>;
  scales?: Array<[number, number, number]>;
  manifest?: ArtifactManifestId;
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

const specimenCache = new Map<string, SpecimenGeometry>();

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
  "observability-tower": {
    ...artifact("observability-audit", "signal-trace-pack", "lens", "light", "blink", [
      [-1.08, 0.34, 0.88],
      [-0.56, 0.46, 1.12]
    ]),
    manifest: "trace-instrument"
  },
  "architecture-bridge": artifact("architecture-review", "decision-stack", "slab", "secondary", "pulse", [
    [-0.92, 0.28, 0.98],
    [-0.34, 0.36, 1.18]
  ]),
  "cloud-dock": {
    ...artifact("cloud-delivery", "release-vessel", "capsule", "light", "sweep", [
      [-0.9, 0.3, 1.04],
      [-0.34, 0.36, 1.16]
    ]),
    manifest: "release-module"
  },
  "design-atelier": {
    ...artifact("brand-system", "identity-folio", "folio", "accent", "tilt", [
      [-0.98, 0.26, 1.02],
      [-0.4, 0.34, 1.22],
      [0.18, 0.26, 1.02]
    ]),
    manifest: "swatch-folio"
  },
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
  "contact-portal": {
    ...artifact("contact-brief", "first-conversation", "folio", "secondary", "tilt", [
      [-0.88, 0.72, 1.08],
      [-0.24, 0.8, 1.26]
    ]),
    manifest: "reply-folio"
  }
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
  const specimen = geometryFor(recipe.form, recipe.manifest);
  const geometry = specimen.geometry;
  const material = materialFor(recipe.tone, zone.kind, palette);
  const mesh = new THREE.InstancedMesh(geometry, material, recipe.positions.length);
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  const signatures: string[] = [];
  const materialVariants: string[] = [];
  const activityTypes: string[] = [];

  recipe.positions.forEach((position, index) => {
    const rotation = readableRotation(recipe, index);
    const scale = readableScale(recipe, index);
    dummy.position.set(...readablePosition(position, index, recipe.positions.length));
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
  tagProjectArtifact(mesh, zone, recipe, specimen, signatures, materialVariants, activityTypes);
  return mesh;
}

function readablePosition(position: [number, number, number], index: number, total: number): [number, number, number] {
  const center = (total - 1) / 2;
  const fan = index - center;
  return [position[0] + fan * 0.045, position[1] + Math.abs(fan) * 0.045, position[2] + fan * 0.035];
}

function readableRotation(recipe: ProjectArtifactRecipe, index: number): [number, number, number] {
  const explicit = recipe.rotations?.[index];
  if (explicit) {
    return explicit;
  }
  const side = index % 2 === 0 ? -1 : 1;
  return [0.08 + index * 0.025, 0.36 + index * 0.28, side * (0.16 + index * 0.025)];
}

function readableScale(recipe: ProjectArtifactRecipe, index: number): [number, number, number] {
  const explicit = recipe.scales?.[index];
  if (explicit) {
    return explicit;
  }
  const emphasis = 1 + index * 0.08;
  if (recipe.form === "capsule" || recipe.form === "crystal") {
    return [emphasis, 1.1, 1.08 - index * 0.02];
  }
  if (recipe.form === "lens") {
    return [emphasis + 0.06, 1.18, 1.02 - index * 0.02];
  }
  return [emphasis + 0.08, 1.16, 1.04 - index * 0.015];
}

function geometryFor(form: ProjectArtifactRecipe["form"], manifestId?: ArtifactManifestId): SpecimenGeometry {
  const cacheKey = `${form}:${manifestId ?? "base"}`;
  const cached = specimenCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const create = (baseParts: Array<{ signature: string; geometry: THREE.BufferGeometry }>, detailProfile: string) => {
    const manifest = manifestId ? manifestFor(manifestId) : null;
    const manifestParts = manifestPartsFor(manifestId);
    const parts = [...baseParts, ...manifestParts];
    const geometry = mergeGeometries(parts.map((part) => part.geometry));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const roleReliefSignatures = manifestParts.reduce<Record<string, string[]>>((roles, part) => {
      const signature = `${form}:${part.signature}`;
      roles[part.role] = [...(roles[part.role] ?? []), signature];
      return roles;
    }, {});
    const specimen: SpecimenGeometry = {
      geometry,
      family: form,
      detailProfile: manifest ? `${detailProfile}; ${manifest.detailProfile}` : detailProfile,
      reliefSignatures: parts.map((part) => `${form}:${part.signature}`),
      roleReliefSignatures,
      themeRoles: Object.keys(roleReliefSignatures).sort(),
      manifestId: manifestId ?? "base",
      partCount: parts.length,
      vertexCount: geometry.getAttribute("position").count
    };
    geometry.userData.detailProfile = specimen.detailProfile;
    geometry.userData.family = specimen.family;
    geometry.userData.reliefSignatures = specimen.reliefSignatures;
    geometry.userData.roleReliefSignatures = specimen.roleReliefSignatures;
    geometry.userData.themeRoles = specimen.themeRoles;
    geometry.userData.manifestId = specimen.manifestId;
    geometry.userData.vertexCount = specimen.vertexCount;
    specimenCache.set(cacheKey, specimen);
    return specimen;
  };

  if (form === "capsule") {
    return create(
      [
        { signature: "pressure-core", geometry: transformed(new THREE.CapsuleGeometry(0.12, 0.38, 5, 12), [0, 0, 0], [0, 0, Math.PI * 0.5]) },
        { signature: "left-fin", geometry: transformed(new THREE.BoxGeometry(0.08, 0.25, 0.42), [-0.16, 0, 0], [0, 0.16, 0.24]) },
        { signature: "right-fin", geometry: transformed(new THREE.BoxGeometry(0.08, 0.25, 0.42), [0.16, 0, 0], [0, -0.16, -0.24]) },
        { signature: "signal-node", geometry: transformed(new THREE.SphereGeometry(0.07, 10, 6), [0.24, 0.02, 0.12]) },
        { signature: "readout-slice", geometry: transformed(new THREE.BoxGeometry(0.28, 0.035, 0.05), [-0.02, 0.14, -0.18], [0.18, 0, 0]) }
      ],
      "winged capsule with pressure core and readout slice"
    );
  }
  if (form === "lens") {
    return create(
      [
        { signature: "pressed-glass", geometry: transformed(new THREE.SphereGeometry(0.22, 18, 10), [0, 0, 0], [0, 0, 0], [1.22, 0.32, 0.76]) },
        { signature: "outer-rim", geometry: transformed(new THREE.TorusGeometry(0.24, 0.018, 8, 40), [0, 0, 0], [Math.PI * 0.5, 0, 0], [1.18, 0.7, 0.7]) },
        { signature: "index-notch", geometry: transformed(new THREE.BoxGeometry(0.07, 0.05, 0.21), [0.22, 0.02, 0], [0, 0.42, 0]) },
        { signature: "signal-tick-a", geometry: transformed(new THREE.BoxGeometry(0.03, 0.04, 0.17), [-0.18, 0.03, 0.12], [0, -0.62, 0]) },
        { signature: "signal-tick-b", geometry: transformed(new THREE.BoxGeometry(0.03, 0.04, 0.17), [-0.12, 0.04, -0.16], [0, 0.74, 0]) }
      ],
      "flattened lens with rim, notch and signal ticks"
    );
  }
  if (form === "crystal") {
    return create(
      [
        { signature: "faceted-core", geometry: transformed(new THREE.OctahedronGeometry(0.25, 0), [0, 0.08, 0], [0.16, 0.34, 0.1], [1, 1.18, 0.88]) },
        { signature: "shadow-plinth", geometry: transformed(new THREE.BoxGeometry(0.42, 0.06, 0.28), [0, -0.18, 0], [0, 0.24, 0]) },
        { signature: "cut-line", geometry: transformed(new THREE.BoxGeometry(0.32, 0.035, 0.035), [0.02, 0.02, 0.2], [0.18, 0.5, -0.24]) },
        { signature: "orientation-chip", geometry: transformed(new THREE.BoxGeometry(0.12, 0.06, 0.1), [-0.22, -0.04, -0.12], [0.12, -0.34, 0.18]) }
      ],
      "faceted crystal specimen with plinth and orientation cut"
    );
  }
  if (form === "folio") {
    return create(
      [
        { signature: "folio-body", geometry: transformed(new THREE.BoxGeometry(0.48, 0.055, 0.31), [0, 0, 0], [0, 0, -0.14]) },
        { signature: "raised-spine", geometry: transformed(new THREE.BoxGeometry(0.07, 0.08, 0.34), [-0.22, 0.035, 0], [0, 0, -0.14]) },
        { signature: "top-tab", geometry: transformed(new THREE.BoxGeometry(0.18, 0.045, 0.09), [0.14, 0.06, -0.17], [0.02, 0.08, -0.14]) },
        { signature: "bottom-tab", geometry: transformed(new THREE.BoxGeometry(0.14, 0.045, 0.08), [0.2, 0.055, 0.16], [-0.02, -0.1, -0.14]) },
        { signature: "reading-band", geometry: transformed(new THREE.BoxGeometry(0.38, 0.035, 0.035), [0.03, 0.08, 0.02], [0, 0, 0.22]) }
      ],
      "layered folio with spine, tabs and reading band"
    );
  }
  return create(
    [
      { signature: "base-slab", geometry: transformed(new THREE.BoxGeometry(0.42, 0.08, 0.28), [0, -0.015, 0], [0, 0.16, 0]) },
      { signature: "upper-slab", geometry: transformed(new THREE.BoxGeometry(0.34, 0.055, 0.22), [0.04, 0.06, -0.02], [0.04, -0.16, 0]) },
      { signature: "side-notch", geometry: transformed(new THREE.BoxGeometry(0.08, 0.06, 0.18), [-0.24, 0.065, 0.08], [0, 0.28, 0]) },
      { signature: "cut-line", geometry: transformed(new THREE.BoxGeometry(0.32, 0.032, 0.035), [0.05, 0.11, 0.13], [0, 0, -0.08]) },
      { signature: "witness-chip", geometry: transformed(new THREE.BoxGeometry(0.1, 0.05, 0.1), [0.25, 0.09, -0.1], [0, -0.3, 0]) }
    ],
    "architectural slab stack with notch, cut line and witness chip"
  );
}

function manifestFor(manifestId: ArtifactManifestId) {
  return {
    "trace-instrument": {
      detailProfile: "trace instrument with query ring, cursor and sampled telemetry dots",
      roles: ["query-ring", "trace-cursor", "telemetry-dot"]
    },
    "release-module": {
      detailProfile: "cloud release module with deployment rail, container lock and release flag",
      roles: ["deployment-rail", "container-lock", "release-flag"]
    },
    "swatch-folio": {
      detailProfile: "atelier swatch folio with layered color cards and pattern grid",
      roles: ["swatch-card", "pattern-grid", "folio-index"]
    },
    "reply-folio": {
      detailProfile: "postal reply folio with envelope flap, seal and response tab",
      roles: ["envelope-flap", "postal-seal", "reply-tab"]
    }
  }[manifestId];
}

function manifestPartsFor(manifestId?: ArtifactManifestId) {
  if (manifestId === "trace-instrument") {
    return [
      { role: "query-ring", signature: "query-ring", geometry: transformed(new THREE.TorusGeometry(0.17, 0.012, 8, 36), [0, 0.105, 0], [Math.PI * 0.5, 0, 0]) },
      { role: "trace-cursor", signature: "trace-cursor", geometry: transformed(new THREE.BoxGeometry(0.26, 0.028, 0.028), [0.08, 0.12, 0.02], [0, 0, 0.42]) },
      { role: "telemetry-dot", signature: "telemetry-dot-a", geometry: transformed(new THREE.SphereGeometry(0.035, 8, 6), [-0.1, 0.13, 0.11]) },
      { role: "telemetry-dot", signature: "telemetry-dot-b", geometry: transformed(new THREE.SphereGeometry(0.03, 8, 6), [0.14, 0.13, -0.1]) }
    ];
  }
  if (manifestId === "release-module") {
    return [
      { role: "deployment-rail", signature: "deployment-rail", geometry: transformed(new THREE.BoxGeometry(0.48, 0.028, 0.045), [0, 0.16, -0.13], [0, 0.08, 0]) },
      { role: "container-lock", signature: "container-lock", geometry: transformed(new THREE.BoxGeometry(0.1, 0.08, 0.12), [0.22, 0.12, 0.12], [0, -0.18, 0.12]) },
      { role: "release-flag", signature: "release-flag", geometry: transformed(new THREE.ConeGeometry(0.07, 0.18, 3), [-0.24, 0.18, 0.1], [0.22, 0, Math.PI * 0.5]) }
    ];
  }
  if (manifestId === "swatch-folio") {
    return [
      { role: "swatch-card", signature: "swatch-card-cyan", geometry: transformed(new THREE.BoxGeometry(0.16, 0.032, 0.12), [-0.05, 0.12, -0.11], [0, 0, -0.08]) },
      { role: "swatch-card", signature: "swatch-card-coral", geometry: transformed(new THREE.BoxGeometry(0.16, 0.032, 0.12), [0.05, 0.14, 0], [0, 0, 0.12]) },
      { role: "swatch-card", signature: "swatch-card-paper", geometry: transformed(new THREE.BoxGeometry(0.16, 0.032, 0.12), [0.13, 0.16, 0.12], [0, 0, 0.22]) },
      { role: "pattern-grid", signature: "pattern-grid", geometry: transformed(new THREE.BoxGeometry(0.36, 0.018, 0.026), [0.02, 0.19, -0.02], [0, 0, 0.62]) },
      { role: "folio-index", signature: "folio-index", geometry: transformed(new THREE.BoxGeometry(0.055, 0.05, 0.22), [-0.18, 0.17, 0.04], [0, 0.05, -0.08]) }
    ];
  }
  if (manifestId === "reply-folio") {
    return [
      { role: "envelope-flap", signature: "envelope-flap", geometry: transformed(new THREE.ConeGeometry(0.18, 0.055, 3), [0.08, 0.13, 0], [0, 0, Math.PI * 0.5], [1, 0.5, 1.28]) },
      { role: "postal-seal", signature: "postal-seal", geometry: transformed(new THREE.CylinderGeometry(0.055, 0.055, 0.026, 16), [0.17, 0.17, 0.1], [Math.PI * 0.5, 0, 0]) },
      { role: "reply-tab", signature: "reply-tab", geometry: transformed(new THREE.BoxGeometry(0.18, 0.032, 0.09), [-0.14, 0.15, -0.12], [0, 0, -0.26]) }
    ];
  }
  return [];
}

function transformed(
  geometry: THREE.BufferGeometry,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1]
) {
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale)
  );
  const cloned = geometry.clone();
  cloned.applyMatrix4(matrix);
  return cloned;
}

function mergeGeometries(geometries: THREE.BufferGeometry[]) {
  const positions: number[] = [];
  for (const geometry of geometries) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = source.getAttribute("position");
    for (let index = 0; index < position.count; index += 1) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  return merged;
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
  const primary = readableColor(palette[kind], palette.road, 0.16);
  const secondary = readableColor(kind === "tech" ? palette.art : palette.tech, palette.road, 0.1);
  const light = readableColor(palette.road, palette[kind], 0.08);
  const counter = readableColor(palette.road, palette.ink, 0.18);
  if (tone === "light") {
    return index % 2 === 0 ? light : primary;
  }
  if (tone === "secondary") {
    return index % 2 === 0 ? secondary : counter;
  }
  return index % 2 === 0 ? primary : counter;
}

function readableColor(base: number, toward: number, amount: number) {
  return new THREE.Color(base).lerp(new THREE.Color(toward), amount).getHex();
}

function tagProjectArtifact(
  object: THREE.InstancedMesh,
  zone: StudioZone,
  recipe: ProjectArtifactRecipe,
  specimen: SpecimenGeometry,
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
  object.userData.projectArtifactSpecimenFamily = specimen.family;
  object.userData.projectArtifactManifest = specimen.manifestId;
  object.userData.projectArtifactThemeRoles = specimen.themeRoles;
  object.userData.projectArtifactRoleReliefSignatures = specimen.roleReliefSignatures;
  object.userData.projectArtifactDetailProfile = specimen.detailProfile;
  object.userData.projectArtifactReliefSignatures = specimen.reliefSignatures;
  object.userData.projectArtifactPartCount = specimen.partCount;
  object.userData.projectArtifactVertexCount = specimen.vertexCount;
  object.userData.detailProfile = specimen.detailProfile;
  object.userData.family = specimen.family;
  object.userData.reliefSignatures = specimen.reliefSignatures;
  object.userData.vertexCount = specimen.vertexCount;
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
