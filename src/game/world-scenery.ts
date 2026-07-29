import * as THREE from "three";
import type { WorldRoute, ZoneKind } from "./zones";
import { worldRoutes, zones } from "./zones";
import { worldGroundRadius, worldSize } from "./world-config";
import { sampleTerrain, terrainConfig, worldMaterialRegions } from "./world-materials";

export type WorldSceneryPalette = Record<ZoneKind | "ground" | "road" | "ink", number>;

export type RenderedWorldScenery = {
  group: THREE.Group;
  objectCount: number;
  terrainLayers: number;
  mapTextureRoles: string[];
  mapTextureUrls: string[];
  mapTextureMaterialCount: number;
  signatures: Set<string>;
  motionObjects: THREE.Object3D[];
  motionObjectCount: number;
  identityRibbon: THREE.Object3D | null;
  terrainHeightRange: number;
  terrainMinHeight: number;
  terrainMaxHeight: number;
  terrainVertexCount: number;
  terrainGradeMax: number;
  terrainFeatureCount: number;
};

type SceneRole =
  | "terrain-edge"
  | "terrain-feature-marker"
  | "relief-ramp"
  | "water-body"
  | "surface-detail"
  | "tech-skyline"
  | "art-sculpture"
  | "studio-threshold"
  | "identity-ribbon"
  | "route-light";
type MotionBehavior = "pulse" | "sweep" | "tilt" | "float" | "blink" | "instance-pulse";

type RuntimeMapTextureRole = "cloud-dock" | "design-atelier" | "observability-tower" | "relief" | "road" | "vegetation" | "water";

type RuntimeMapTexture = {
  role: RuntimeMapTextureRole;
  url: string;
  texture: THREE.Texture;
};

const mapTextureSpecs: Array<{ role: RuntimeMapTextureRole; path: string; repeat: number }> = [
  { role: "vegetation", path: "assets/textures/map/field/field-grain-studio.svg", repeat: 9 },
  { role: "relief", path: "assets/textures/map/relief/relief-contours-studio.svg", repeat: 7 },
  { role: "road", path: "assets/textures/map/road/road-asphalt-studio.svg", repeat: 5 },
  { role: "water", path: "assets/textures/map/water/water-edge-studio.svg", repeat: 4 },
  { role: "cloud-dock", path: "assets/textures/map/hero/cloud-dock-circuit-pad.svg", repeat: 2 },
  { role: "design-atelier", path: "assets/textures/map/hero/design-atelier-pattern-pad.svg", repeat: 2 },
  { role: "observability-tower", path: "assets/textures/map/hero/observability-trace-pad.svg", repeat: 2 }
];

const runtimeAssetUrl = (path: string) => {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${path.replace(/^\/+/u, "")}`;
};

const createRuntimeMapTextures = (): RuntimeMapTexture[] =>
  mapTextureSpecs.map((spec) => {
    const url = runtimeAssetUrl(spec.path);
    const texture = new THREE.TextureLoader().load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(spec.repeat, spec.repeat);
    texture.userData.mapTextureRole = spec.role;
    texture.userData.mapTextureUrl = url;
    return { role: spec.role, url, texture };
  });

const material = (color: number, emissive = 0.06, metalness = 0.14, opacity = 1, map?: THREE.Texture) => {
  const parameters: THREE.MeshStandardMaterialParameters = {
    color,
    roughness: 0.62,
    metalness,
    emissive: color,
    emissiveIntensity: emissive,
    transparent: opacity < 1,
    opacity
  };
  if (map) {
    parameters.map = map;
  }
  return new THREE.MeshStandardMaterial(parameters);
};

const box = (size: readonly [number, number, number], mat: THREE.Material, position: readonly [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const sphere = (radius: number, mat: THREE.Material, position: readonly [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 7), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const torus = (radius: number, tube: number, mat: THREE.Material, position: readonly [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 36), mat);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.x = Math.PI * 0.5;
  return mesh;
};

const beam = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  radius: number,
  mat: THREE.Material
) => {
  const curve = new THREE.LineCurve3(new THREE.Vector3(...from), new THREE.Vector3(...to));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 1, radius, 6), mat);
};

const instancedColorMaterial = <T extends THREE.Material>(mat: T) => {
  const clone = mat.clone();
  (clone as THREE.Material & { vertexColors?: boolean }).vertexColors = true;
  return clone;
};

const tag = (
  object: THREE.Object3D,
  role: SceneRole,
  signature: string,
  motionBehavior?: MotionBehavior,
  semanticRoleCount = 1,
  semanticObjectCount = 1,
  semanticMotionCount = motionBehavior ? 1 : 0
) => {
  object.userData.worldSceneryRole = role;
  object.userData.worldScenerySignature = signature;
  object.userData.worldSceneryRoleCount = semanticRoleCount;
  object.userData.worldSceneryObjectCount = semanticObjectCount;
  if (motionBehavior) {
    object.userData.localMotionBehavior = motionBehavior;
    object.userData.worldSceneryMotionCount = semanticMotionCount;
  }
  object.userData.motionBaseX = object.position.x;
  object.userData.motionBaseY = object.position.y;
  object.userData.motionBaseZ = object.position.z;
  object.userData.motionBaseRotationX = object.rotation.x;
  object.userData.motionBaseRotationY = object.rotation.y;
  object.userData.motionBaseRotationZ = object.rotation.z;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });
  return object;
};

export function createWorldScenery(palette: WorldSceneryPalette): RenderedWorldScenery {
  const group = new THREE.Group();
  group.name = "studio-world-scenery";

  const signatures = new Set<string>();
  const motionObjects: THREE.Object3D[] = [];
  let objectCount = 0;
  let motionObjectCount = 0;
  let terrainLayers = 0;
  let terrainHeightRange = 0;
  let terrainMinHeight = 0;
  let terrainMaxHeight = 0;
  let terrainVertexCount = 0;
  let terrainGradeMax = 0;
  const mapTextures = createRuntimeMapTextures();
  const mapTextureByRole = new Map(mapTextures.map((entry) => [entry.role, entry.texture]));

  const add = (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number } = {}
  ) => {
    const semanticObjectCount = options.objectCount ?? countMeshes(object);
    const semanticRoleCount = options.roleCount ?? 1;
    const semanticMotionCount = options.motionCount ?? (motionBehavior ? 1 : 0);
    tag(object, role, signature, motionBehavior, semanticRoleCount, semanticObjectCount, semanticMotionCount);
    group.add(object);
    objectCount += semanticObjectCount;
    for (const item of options.signatures ?? [signature]) {
      signatures.add(item);
    }
    if (motionBehavior) {
      motionObjects.push(object);
      motionObjectCount += semanticMotionCount;
    }
  };

  const terrainMat = material(palette.ground, 0.02, 0.04, 0.74, mapTextureByRole.get("vegetation"));
  const terrainShade = material(palette.ink, 0.01, 0.02, 0.62, mapTextureByRole.get("relief"));
  const roadMat = material(palette.road, 0.14, 0.12, 0.92, mapTextureByRole.get("road"));
  const contourMat = new THREE.MeshBasicMaterial({
    color: 0x7b8371,
    transparent: true,
    opacity: 0.2,
    depthWrite: false
  });
  const techMat = material(palette.tech, 0.2, 0.24, 0.94);
  const artMat = material(palette.art, 0.2, 0.12, 0.94);
  const studioMat = material(palette.studio, 0.2, 0.14, 0.94);
  const inkMat = material(palette.ink, 0.02, 0.1, 0.9);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x123f55,
    map: mapTextureByRole.get("water"),
    roughness: 0.18,
    metalness: 0.08,
    emissive: palette.tech,
    emissiveIntensity: 0.16,
    transparent: true,
    opacity: 0.68
  });

  const heightfield = createTerrainHeightfield(terrainMat);
  heightfield.mesh.userData.mapTextureRole = "vegetation";
  add(heightfield.mesh, "terrain-edge", "terrain:heightfield:shared-physics", undefined, {
    signatures: ["terrain:heightfield:shared-physics", ...terrainConfig.features.map((feature) => `terrain-feature:${feature.id}`)]
  });
  terrainLayers += 1;
  terrainHeightRange = heightfield.heightRange;
  terrainMinHeight = heightfield.minHeight;
  terrainMaxHeight = heightfield.maxHeight;
  terrainVertexCount = heightfield.vertexCount;
  terrainGradeMax = heightfield.gradeMax;

  addTerrainFeatureMarkers(add, techMat, artMat, studioMat, roadMat, inkMat);
  const terrainSpecs = [
    ["outer-cut", worldGroundRadius * 0.96, 1.08, 0.94, -0.012, terrainShade, -0.18],
    ["field-shelf", worldGroundRadius * 0.88, 1.04, 0.91, 0.0, terrainMat, 0.14],
    ["tech-ledge", 5.8, 1.9, 0.82, 0.05, techMat, -0.16, -10.8, -0.8],
    ["art-ledge", 5.95, 1.82, 0.88, 0.065, artMat, 0.18, 10.8, -0.7],
    ["studio-ledge", 5.7, 1.06, 1.26, 0.08, studioMat, 0.06, 0, 2]
  ] as const;

  for (const [id, radius, scaleX, scaleZ, y, mat, rotation, x = 0, z = 0] of terrainSpecs) {
    const shelf = new THREE.Mesh(new THREE.CircleGeometry(radius, 7), mat);
    shelf.rotation.x = -Math.PI * 0.5;
    shelf.rotation.z = rotation;
    shelf.position.set(x, y, z);
    shelf.scale.set(scaleX, 1, scaleZ);
    shelf.renderOrder = -3;
    shelf.receiveShadow = true;
    shelf.userData.mapTextureRole = mat === terrainShade ? "relief" : mat === terrainMat ? "vegetation" : undefined;
    add(shelf, "terrain-edge", `terrain:${id}`);
    terrainLayers += 1;
  }

  addWaterBodies(add, waterMat, studioMat);
  addReliefRamps(add, techMat, artMat, studioMat, roadMat, inkMat);
  addHeroTexturePads(add, mapTextureByRole, palette);
  addSurfaceDetails(add, studioMat, roadMat, contourMat);
  addFashionTerrainWeave(add, artMat, studioMat, roadMat, inkMat);
  addTechSkyline(add, techMat, roadMat, inkMat);
  addArtSculptures(add, artMat, roadMat, inkMat);
  addStudioThreshold(add, studioMat, techMat, artMat, roadMat);
  const identityRibbon = addIdentityRibbon(add, palette, roadMat, inkMat);
  addRouteLights(add, worldRoutes, roadMat);

  return {
    group,
    objectCount,
    terrainLayers,
    mapTextureRoles: mapTextures.map((entry) => entry.role).sort(),
    mapTextureUrls: mapTextures.map((entry) => entry.url).sort(),
    mapTextureMaterialCount: mapTextures.length,
    signatures,
    motionObjects,
    motionObjectCount,
    identityRibbon,
    terrainHeightRange,
    terrainMinHeight,
    terrainMaxHeight,
    terrainVertexCount,
    terrainGradeMax,
    terrainFeatureCount: terrainConfig.featureCount
  };
}

function addTerrainFeatureMarkers(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  techMat: THREE.Material,
  artMat: THREE.Material,
  studioMat: THREE.Material,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const features = terrainConfig.features;
  const featureCount = features.length;
  const strataPerFeature = 3;
  const pinsPerFeature = 2;
  const markers = new THREE.Group();
  markers.name = "terrain-feature-marker-instances";

  const footprints = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.012, 4, 40), instancedColorMaterial(roadMat), featureCount);
  const strata = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.82, 0.032, 0.072),
    instancedColorMaterial(studioMat),
    featureCount * strataPerFeature
  );
  const pins = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.022, 0.034, 0.42, 6),
    instancedColorMaterial(inkMat),
    featureCount * pinsPerFeature
  );

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  const signatures: string[] = [];
  const profileIds = new Set<string>();
  const materialByFeature = {
    ridge: techMat,
    basin: roadMat,
    mound: artMat
  } as const;

  features.forEach((feature, featureIndex) => {
    const profileId = `terrain:${feature.kind}`;
    profileIds.add(profileId);
    const featureMaterial = materialByFeature[feature.kind] ?? studioMat;
    const featureColor = (featureMaterial as THREE.MeshStandardMaterial).color?.getHex() ?? 0xffe38a;
    const accentColor = feature.kind === "basin" ? 0x54d8f2 : feature.kind === "mound" ? 0xff6f7d : 0x17d2ff;
    const heightLift = Math.max(0.02, Math.abs(feature.height) * 0.18);

    quaternion.setFromEuler(new THREE.Euler(Math.PI * 0.5, feature.rotation, 0));
    scale.set(feature.radiusX, feature.radiusZ, 1);
    matrix.compose(
      new THREE.Vector3(feature.center[0], 0.105 + featureIndex * 0.003 + heightLift, feature.center[1]),
      quaternion,
      scale
    );
    footprints.setMatrixAt(featureIndex, matrix);
    footprints.setColorAt(featureIndex, color.setHex(accentColor));
    signatures.push(`terrain-marker:${feature.id}:${feature.kind}:footprint`);

    for (let strataIndex = 0; strataIndex < strataPerFeature; strataIndex += 1) {
      const localT = (strataIndex - 1) / 1.25;
      const localOffset = new THREE.Vector3(localT * feature.radiusX * 0.35, 0, feature.radiusZ * (0.14 + strataIndex * 0.08)).applyAxisAngle(
        up,
        feature.rotation
      );
      quaternion.setFromEuler(new THREE.Euler(0, feature.rotation + localT * 0.16, 0));
      scale.set(0.92 + strataIndex * 0.2, 1, 1);
      matrix.compose(
        new THREE.Vector3(
          feature.center[0] + localOffset.x,
          0.18 + heightLift + strataIndex * 0.035,
          feature.center[1] + localOffset.z
        ),
        quaternion,
        scale
      );
      const index = featureIndex * strataPerFeature + strataIndex;
      strata.setMatrixAt(index, matrix);
      strata.setColorAt(index, color.setHex(strataIndex === 1 ? featureColor : accentColor));
      signatures.push(`terrain-marker:${feature.id}:${feature.kind}:strata-${strataIndex}`);
    }

    for (let pinIndex = 0; pinIndex < pinsPerFeature; pinIndex += 1) {
      const side = pinIndex === 0 ? -1 : 1;
      const localOffset = new THREE.Vector3(side * feature.radiusX * 0.56, 0, -feature.radiusZ * 0.22).applyAxisAngle(
        up,
        feature.rotation
      );
      quaternion.setFromEuler(new THREE.Euler(0.08 * side, feature.rotation, -0.08 * side));
      scale.setScalar(1 + Math.abs(feature.height) * 0.9);
      matrix.compose(
        new THREE.Vector3(
          feature.center[0] + localOffset.x,
          0.32 + heightLift + pinIndex * 0.035,
          feature.center[1] + localOffset.z
        ),
        quaternion,
        scale
      );
      const index = featureIndex * pinsPerFeature + pinIndex;
      pins.setMatrixAt(index, matrix);
      pins.setColorAt(index, color.setHex(pinIndex === 0 ? 0xfff2b0 : featureColor));
      signatures.push(`terrain-marker:${feature.id}:${feature.kind}:pin-${pinIndex}`);
    }
  });

  [footprints, strata, pins].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.userData.terrainFeatureMarkerPart = mesh === footprints ? "feature-footprint" : mesh === strata ? "feature-strata" : "feature-pin";
    mesh.userData.terrainFeatureMarkerObjectCount = mesh.count;
    mesh.userData.terrainFeatureMarkerProfileIds = [...profileIds];
    mesh.userData.terrainFeatureMarkerSignatures = signatures.slice();
    markers.add(mesh);
  });

  add(markers, "terrain-feature-marker", "terrain-feature-marker:shared-physics-features", "instance-pulse", {
    signatures,
    objectCount: featureCount + featureCount * strataPerFeature + featureCount * pinsPerFeature,
    roleCount: featureCount,
    motionCount: featureCount * (strataPerFeature + 1)
  });
}

function createTerrainHeightfield(mat: THREE.Material) {
  const size = worldSize;
  const segments = 32;
  const half = size / 2;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let minHeight = Number.POSITIVE_INFINITY;
  let maxHeight = Number.NEGATIVE_INFINITY;
  let gradeMax = 0;
  const base = new THREE.Color(0x12342c);
  const high = new THREE.Color(0x2f5b48);
  const low = new THREE.Color(0x0b1d1a);

  for (let zIndex = 0; zIndex <= segments; zIndex += 1) {
    const z = -half + (zIndex / segments) * size;
    for (let xIndex = 0; xIndex <= segments; xIndex += 1) {
      const x = -half + (xIndex / segments) * size;
      const terrain = sampleTerrain(new THREE.Vector3(x, 0, z));
      minHeight = Math.min(minHeight, terrain.height);
      maxHeight = Math.max(maxHeight, terrain.height);
      gradeMax = Math.max(gradeMax, terrain.grade);
      positions.push(x, terrain.height - 0.034, z);
      const color = terrain.height >= 0 ? base.clone().lerp(high, Math.min(1, terrain.height / 0.42)) : base.clone().lerp(low, Math.min(1, Math.abs(terrain.height) / 0.3));
      colors.push(color.r, color.g, color.b);
    }
  }

  for (let zIndex = 0; zIndex < segments; zIndex += 1) {
    for (let xIndex = 0; xIndex < segments; xIndex += 1) {
      const a = zIndex * (segments + 1) + xIndex;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const terrainMat = (mat as THREE.MeshStandardMaterial).clone();
  terrainMat.vertexColors = true;
  terrainMat.opacity = Math.min(0.92, terrainMat.opacity);
  terrainMat.transparent = true;
  const mesh = new THREE.Mesh(geometry, terrainMat);
  mesh.name = "shared-physics-heightfield";
  mesh.renderOrder = -4;
  mesh.receiveShadow = true;
  mesh.userData.terrainHeightfield = true;
  mesh.userData.terrainFeatureCount = terrainConfig.featureCount;
  mesh.userData.terrainVertexCount = positions.length / 3;
  mesh.userData.terrainHeightRange = Number((maxHeight - minHeight).toFixed(3));
  mesh.userData.terrainGradeMax = Number(gradeMax.toFixed(3));

  return {
    mesh,
    minHeight: Number(minHeight.toFixed(3)),
    maxHeight: Number(maxHeight.toFixed(3)),
    heightRange: Number((maxHeight - minHeight).toFixed(3)),
    gradeMax: Number(gradeMax.toFixed(3)),
    vertexCount: positions.length / 3
  };
}

function addWaterBodies(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  waterMat: THREE.Material,
  studioMat: THREE.Material
) {
  const basins = worldMaterialRegions.water.map((region) => [
    region.id,
    region.center[0],
    region.center[1],
    region.radiusX,
    region.radiusZ / region.radiusX,
    region.rotation
  ] as const);
  const water = new THREE.Group();
  water.name = "water-body-instances";
  const surfaces = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 28), waterMat, basins.length);
  const rims = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.022, 6, 36), studioMat, basins.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  basins.forEach(([, x, z, width, depth, rotation], index) => {
    quaternion.setFromEuler(new THREE.Euler(-Math.PI * 0.5, rotation, 0));
    scale.set(width, width * depth, 1);
    matrix.compose(new THREE.Vector3(x, 0.035 + index * 0.004, z), quaternion, scale);
    surfaces.setMatrixAt(index, matrix);

    quaternion.setFromEuler(new THREE.Euler(Math.PI * 0.5, rotation, 0));
    scale.set(width * 0.98, width * depth * 0.98, 1);
    matrix.compose(new THREE.Vector3(x, 0.062 + index * 0.004, z), quaternion, scale);
    rims.setMatrixAt(index, matrix);
  });
  surfaces.instanceMatrix.needsUpdate = true;
  rims.instanceMatrix.needsUpdate = true;
  surfaces.renderOrder = -1;
  surfaces.userData.waterPart = "surface";
  rims.userData.waterPart = "rim";
  water.add(surfaces, rims);
  add(water, "water-body", "water:instanced-basins", "float", {
    signatures: basins.flatMap(([id]) => [`water:${id}:surface`, `water:${id}:rim`]),
    objectCount: basins.length * 2,
    roleCount: basins.length,
    motionCount: basins.length
  });
}

function addReliefRamps(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  techMat: THREE.Material,
  artMat: THREE.Material,
  studioMat: THREE.Material,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const rampGeometry = new THREE.BoxGeometry(1, 1, 1);
  const ramps = worldMaterialRegions.ramps.map((region) => {
    const mat = region.id.startsWith("art") ? artMat : region.id.startsWith("studio") ? studioMat : region.id.startsWith("mail") ? roadMat : techMat;
    return [region.id, region.center[0], region.center[1], region.width, region.height, region.depth, region.rotation, mat] as const;
  });
  const relief = new THREE.Group();
  relief.name = "relief-ramp-instances";
  const shadows = new THREE.InstancedMesh(rampGeometry, inkMat, ramps.length);
  const decks = new THREE.InstancedMesh(rampGeometry, techMat, ramps.length);
  const crests = new THREE.InstancedMesh(rampGeometry, roadMat, ramps.length);
  const deckColors = new THREE.Color();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  ramps.forEach(([, x, z, width, height, depth, rotation, mat], index) => {
    quaternion.setFromEuler(new THREE.Euler(0, rotation, 0));
    scale.set(width * 1.08, 0.035, depth * 1.12);
    matrix.compose(new THREE.Vector3(x, 0.055, z), quaternion, scale);
    shadows.setMatrixAt(index, matrix);

    quaternion.setFromEuler(new THREE.Euler(index % 2 === 0 ? -0.08 : 0.08, rotation, 0));
    scale.set(width, height, depth);
    matrix.compose(new THREE.Vector3(x, 0.12 + height * 0.5, z), quaternion, scale);
    decks.setMatrixAt(index, matrix);
    deckColors.set((mat as THREE.MeshStandardMaterial).color);
    decks.setColorAt(index, deckColors);

    quaternion.setFromEuler(new THREE.Euler(0, rotation, 0));
    scale.set(width * 0.82, 0.05, 0.08);
    const crestOffset = new THREE.Vector3(0, 0, -depth * 0.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    matrix.compose(new THREE.Vector3(x + crestOffset.x, 0.29 + height, z + crestOffset.z), quaternion, scale);
    crests.setMatrixAt(index, matrix);
  });
  shadows.instanceMatrix.needsUpdate = true;
  decks.instanceMatrix.needsUpdate = true;
  if (decks.instanceColor) {
    decks.instanceColor.needsUpdate = true;
  }
  crests.instanceMatrix.needsUpdate = true;
  shadows.userData.reliefPart = "shadow-foot";
  decks.userData.reliefPart = "sloped-deck";
  crests.userData.reliefPart = "crest-marker";
  relief.add(shadows, decks, crests);
  add(relief, "relief-ramp", "relief:instanced-ramps", "pulse", {
    signatures: ramps.flatMap(([id]) => [`relief:${id}:deck`, `relief:${id}:shadow`, `relief:${id}:crest`]),
    objectCount: ramps.length * 3,
    roleCount: ramps.length,
    motionCount: ramps.length
  });
}

function addHeroTexturePads(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  mapTextureByRole: Map<RuntimeMapTextureRole, THREE.Texture>,
  palette: WorldSceneryPalette
) {
  const specs = [
    {
      id: "cloud-dock",
      role: "cloud-dock" as const,
      center: [-11.65, -24.15] as const,
      size: [7.2, 5.8] as const,
      rotation: -0.22,
      color: palette.tech,
      opacity: 0.36
    },
    {
      id: "design-atelier",
      role: "design-atelier" as const,
      center: [21.25, -9.55] as const,
      size: [6.9, 5.6] as const,
      rotation: 0.38,
      color: palette.art,
      opacity: 0.34
    },
    {
      id: "observability-tower",
      role: "observability-tower" as const,
      center: [-22.9, 9.55] as const,
      size: [6.7, 5.7] as const,
      rotation: 0.08,
      color: palette.tech,
      opacity: 0.32
    }
  ];

  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const materials: THREE.MeshStandardMaterial[] = [];
  const signatures: string[] = [];

  specs.forEach((spec, index) => {
    const texture = mapTextureByRole.get(spec.role);
    if (!texture) {
      return;
    }
    materials.push(new THREE.MeshStandardMaterial({
      color: spec.color,
      map: texture,
      roughness: 0.46,
      metalness: 0.12,
      emissive: spec.color,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: spec.opacity,
      depthWrite: false
    }));
    const terrain = sampleTerrain(new THREE.Vector3(spec.center[0], 0, spec.center[1]));
    const baseIndex = positions.length / 3;
    const halfX = spec.size[0] * 0.5;
    const halfZ = spec.size[1] * 0.5;
    const cos = Math.cos(spec.rotation);
    const sin = Math.sin(spec.rotation);
    const y = terrain.height + 0.118 + index * 0.006;
    const corners = [
      [-halfX, -halfZ, 0, 0],
      [halfX, -halfZ, 1, 0],
      [halfX, halfZ, 1, 1],
      [-halfX, halfZ, 0, 1]
    ] as const;
    for (const [localX, localZ, u, v] of corners) {
      const x = spec.center[0] + localX * cos - localZ * sin;
      const z = spec.center[1] + localX * sin + localZ * cos;
      positions.push(x, y, z);
      uvs.push(u, v);
    }
    indices.push(baseIndex, baseIndex + 1, baseIndex + 2, baseIndex, baseIndex + 2, baseIndex + 3);
    geometry.addGroup(index * 6, 6, index);
    signatures.push(`hero-texture-pad:${spec.id}:${spec.role}`);
  });

  if (positions.length === 0) {
    return;
  }

  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const pads = new THREE.Mesh(geometry, materials);
  pads.name = "hero-location-texture-pads";
  pads.renderOrder = -0.5;
  pads.receiveShadow = false;
  pads.userData.mapTextureRole = "hero-location";
  pads.userData.heroLocationTexturePad = true;
  pads.userData.heroLocationTexturePadCount = specs.length;
  pads.userData.heroLocationTexturePadRoles = specs.map((spec) => spec.role);
  add(pads, "surface-detail", "hero-location-texture-pads", undefined, {
    signatures,
    objectCount: specs.length,
    roleCount: specs.length
  });
}

function addSurfaceDetails(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  studioMat: THREE.Material,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const detail = new THREE.Group();
  detail.name = "premium-surface-detail-instances";

  const waterFoamCount = worldMaterialRegions.water.length * 2;
  const shorePinCount = worldMaterialRegions.water.length * 4;
  const waterCrossingCount = worldMaterialRegions.water.length * 4;
  const rampChevronCount = worldMaterialRegions.ramps.length * 3;
  const contourCount = 9;
  const signatures: string[] = [];
  const profileIds = new Set<string>();
  const colorVariants = new Set<number>();

  const waterProfiles: Record<string, { id: string; foam: [number, number]; pinAngle: number; pinLift: number; foamColor: number; pinColor: number }> = {
    "tech-harbor": { id: "harbor-angular", foam: [1.12, 0.62], pinAngle: 0.18, pinLift: 0.06, foamColor: 0x4fdff6, pinColor: 0xfff2b0 },
    "art-lagoon": { id: "lagoon-asymmetric", foam: [0.96, 0.76], pinAngle: 0.68, pinLift: 0.02, foamColor: 0xff6f8e, pinColor: 0xffd166 },
    "studio-canal": { id: "canal-longitudinal", foam: [1.18, 0.58], pinAngle: -0.12, pinLift: 0.08, foamColor: 0xffd85c, pinColor: 0x54d8f2 },
    "foundry-cooling-pool": { id: "cooling-tight-rings", foam: [0.88, 0.55], pinAngle: 0.42, pinLift: 0.04, foamColor: 0x83f4ff, pinColor: 0xff7a97 },
    "north-reflection-cut": { id: "north-reflection", foam: [1.04, 0.6], pinAngle: -0.32, pinLift: 0.05, foamColor: 0x7ef7ff, pinColor: 0xf6c95b },
    "south-postal-basin": { id: "postal-basin", foam: [0.92, 0.64], pinAngle: 0.22, pinLift: 0.035, foamColor: 0x66e6ff, pinColor: 0xfff0b8 },
    "far-north-canal": { id: "far-north-silver-cut", foam: [1.16, 0.54], pinAngle: -0.18, pinLift: 0.045, foamColor: 0x9cf6ff, pinColor: 0xffd85c },
    "far-south-mailwater": { id: "far-south-postal-wash", foam: [0.98, 0.68], pinAngle: 0.28, pinLift: 0.04, foamColor: 0x68e8ff, pinColor: 0xfff2b0 },
    "far-west-cloud-marsh": { id: "far-west-cloud-marsh", foam: [0.86, 0.7], pinAngle: 0.08, pinLift: 0.055, foamColor: 0x54d8f2, pinColor: 0xf6c95b },
    "far-east-art-ponds": { id: "far-east-pigment-ponds", foam: [0.9, 0.74], pinAngle: -0.1, pinLift: 0.035, foamColor: 0xff7a97, pinColor: 0x83f4ff }
  };
  const rampProfiles: Record<string, { id: string; offset: number; scale: number; color: number; lift: number }> = {
    "tech-delta": { id: "delta-blue-steps", offset: 0.04, scale: 1.06, color: 0x42d9ff, lift: 0.02 },
    "obs-rise": { id: "observability-ticks", offset: -0.06, scale: 0.9, color: 0xffe38a, lift: 0.04 },
    "art-sweep": { id: "art-sweep-strokes", offset: 0.12, scale: 1.18, color: 0xff6c87, lift: 0.01 },
    "studio-crossing": { id: "studio-crossbars", offset: -0.1, scale: 1, color: 0xffd45a, lift: 0.03 },
    "mail-bank": { id: "mail-bank-folds", offset: 0.02, scale: 0.96, color: 0xfff2b0, lift: 0.035 },
    "foundry-roll": { id: "foundry-roll-cuts", offset: -0.14, scale: 1.08, color: 0x4fdff6, lift: 0.025 },
    "north-shelf": { id: "north-shelf-strata", offset: 0.08, scale: 1.02, color: 0xffd85c, lift: 0.02 },
    "south-shelf": { id: "south-shelf-folds", offset: -0.04, scale: 0.98, color: 0x7ef7ff, lift: 0.025 },
    "far-north-canal-ramp": { id: "far-north-canal-steps", offset: 0.06, scale: 1.04, color: 0x9cf6ff, lift: 0.02 },
    "far-south-mail-ramp": { id: "far-south-mail-folds", offset: -0.05, scale: 1.0, color: 0xfff2b0, lift: 0.026 },
    "far-west-cloud-ramp": { id: "far-west-cloud-strata", offset: 0.04, scale: 0.96, color: 0x54d8f2, lift: 0.03 },
    "far-east-art-ramp": { id: "far-east-art-steps", offset: -0.06, scale: 1.06, color: 0xff7a97, lift: 0.024 }
  };

  const waterFoam = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.012, 5, 36), instancedColorMaterial(roadMat), waterFoamCount);
  const shorePins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.026, 0.038, 0.34, 6), instancedColorMaterial(studioMat), shorePinCount);
  const waterCrossings = new THREE.InstancedMesh(new THREE.BoxGeometry(0.58, 0.045, 0.14), instancedColorMaterial(roadMat), waterCrossingCount);
  const rampChevrons = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.036, 0.085), instancedColorMaterial(roadMat), rampChevronCount);
  const terrainContours = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.009, 4, 48), instancedColorMaterial(inkMat), contourCount);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();

  worldMaterialRegions.water.forEach((region, regionIndex) => {
    const profile = waterProfiles[region.id] ?? waterProfiles["tech-harbor"];
    profileIds.add(`water:${profile.id}`);
    const depthRatio = region.radiusZ / region.radiusX;
    for (let ringIndex = 0; ringIndex < 2; ringIndex += 1) {
      const index = regionIndex * 2 + ringIndex;
      const ringScale = profile.foam[ringIndex];
      const ringRotation = region.rotation + (ringIndex === 0 ? profile.pinAngle * 0.18 : -profile.pinAngle * 0.28);
      const localOffset = new THREE.Vector3((ringIndex === 0 ? -0.08 : 0.14) * region.radiusX, 0, 0).applyAxisAngle(up, region.rotation);
      quaternion.setFromEuler(new THREE.Euler(Math.PI * 0.5, ringRotation, 0));
      scale.set(region.radiusX * ringScale, region.radiusX * depthRatio * ringScale * (ringIndex === 0 ? 0.98 : 0.86), 1);
      matrix.compose(
        new THREE.Vector3(region.center[0] + localOffset.x, 0.088 + ringIndex * 0.015, region.center[1] + localOffset.z),
        quaternion,
        scale
      );
      waterFoam.setMatrixAt(index, matrix);
      const foamColor = ringIndex === 0 ? profile.foamColor : profile.pinColor;
      waterFoam.setColorAt(index, color.setHex(foamColor));
      colorVariants.add(foamColor);
      signatures.push(`surface-detail:water:${region.id}:${profile.id}:foam-${ringIndex}`);
    }

    for (let pinIndex = 0; pinIndex < 4; pinIndex += 1) {
      const angle = region.rotation + pinIndex * Math.PI * 0.5 + profile.pinAngle;
      const alternating = pinIndex % 2 === 0 ? 1 : 0.82;
      const x = region.center[0] + Math.cos(angle) * region.radiusX * (1.02 + profile.pinLift);
      const z = region.center[1] + Math.sin(angle) * region.radiusZ * (1.02 - profile.pinLift * 0.4);
      quaternion.setFromEuler(new THREE.Euler(0, angle * 0.24, pinIndex % 2 === 0 ? 0.08 : -0.08));
      matrix.compose(
        new THREE.Vector3(x, 0.19 + profile.pinLift + pinIndex * 0.012, z),
        quaternion,
        new THREE.Vector3(alternating, 0.92 + profile.pinLift * 2.8, alternating)
      );
      shorePins.setMatrixAt(regionIndex * 4 + pinIndex, matrix);
      const pinColor = pinIndex % 2 === 0 ? profile.pinColor : profile.foamColor;
      shorePins.setColorAt(regionIndex * 4 + pinIndex, color.setHex(pinColor));
      colorVariants.add(pinColor);
      signatures.push(`surface-detail:water:${region.id}:${profile.id}:shore-pin-${pinIndex}`);
    }

    for (let plankIndex = 0; plankIndex < 4; plankIndex += 1) {
      const index = regionIndex * 4 + plankIndex;
      const localX = (plankIndex - 1.5) * region.radiusX * 0.28;
      const localOffset = new THREE.Vector3(localX, 0, region.radiusZ * (plankIndex % 2 === 0 ? 0.05 : -0.05)).applyAxisAngle(
        up,
        region.rotation
      );
      const crossingRotation = region.rotation + Math.PI * 0.5 + (plankIndex - 1.5) * 0.045;
      quaternion.setFromEuler(new THREE.Euler(0, crossingRotation, 0));
      scale.set(1.08 + plankIndex * 0.04, 1, 1 + depthRatio * 1.8);
      matrix.compose(
        new THREE.Vector3(region.center[0] + localOffset.x, 0.185 + plankIndex * 0.006, region.center[1] + localOffset.z),
        quaternion,
        scale
      );
      waterCrossings.setMatrixAt(index, matrix);
      const crossingColor = plankIndex % 2 === 0 ? profile.pinColor : profile.foamColor;
      waterCrossings.setColorAt(index, color.setHex(crossingColor));
      colorVariants.add(crossingColor);
      signatures.push(`surface-detail:water:${region.id}:${profile.id}:crossing-plank-${plankIndex}`);
    }
  });

  worldMaterialRegions.ramps.forEach((region, regionIndex) => {
    const profile = rampProfiles[region.id] ?? rampProfiles["tech-delta"];
    profileIds.add(`ramp:${profile.id}`);
    const localOffsets = [-0.26, 0, 0.26];
    localOffsets.forEach((localZ, chevronIndex) => {
      const index = regionIndex * localOffsets.length + chevronIndex;
      const lateralOffset = (chevronIndex - 1) * profile.offset;
      const forwardOffset = new THREE.Vector3(lateralOffset * region.width, 0, localZ * region.depth).applyAxisAngle(up, region.rotation);
      quaternion.setFromEuler(new THREE.Euler(0, region.rotation + Math.PI * (0.18 + chevronIndex * 0.035) * region.direction, 0));
      scale.set(profile.scale * (1 - chevronIndex * 0.04), 1, 0.9 + chevronIndex * 0.12);
      matrix.compose(
        new THREE.Vector3(region.center[0] + forwardOffset.x, 0.235 + region.height * 0.8 + profile.lift, region.center[1] + forwardOffset.z),
        quaternion,
        scale
      );
      rampChevrons.setMatrixAt(index, matrix);
      const chevronColor = chevronIndex === 1 ? 0xfff2b0 : profile.color;
      rampChevrons.setColorAt(index, color.setHex(chevronColor));
      colorVariants.add(chevronColor);
      signatures.push(`surface-detail:ramp:${region.id}:${profile.id}:chevron-${chevronIndex}`);
    });
  });

  for (let index = 0; index < contourCount; index += 1) {
    const radius = 3.8 + index * 1.35;
    const height = 0.092 + index * 0.006;
    quaternion.setFromEuler(new THREE.Euler(Math.PI * 0.5, index * 0.09, 0));
    scale.set(radius * (1.18 - index * 0.018), radius * (0.82 + index * 0.012), 1);
    matrix.compose(new THREE.Vector3(0, height, 0.2 - index * 0.04), quaternion, scale);
    terrainContours.setMatrixAt(index, matrix);
    const contourColor = index % 3 === 0 ? 0x7b8371 : index % 3 === 1 ? 0x52645f : 0x9d9875;
    terrainContours.setColorAt(index, color.setHex(contourColor));
    colorVariants.add(contourColor);
    signatures.push(`surface-detail:terrain:contour-${index}`);
  }

  [waterFoam, shorePins, waterCrossings, rampChevrons, terrainContours].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
    mesh.userData.surfaceDetailPart = mesh === waterFoam
      ? "water-foam"
      : mesh === shorePins
        ? "shore-pin"
        : mesh === waterCrossings
          ? "water-crossing"
          : mesh === rampChevrons
            ? "ramp-chevron"
            : "terrain-contour";
    mesh.userData.surfaceDetailProfileIds = [...profileIds];
    mesh.userData.surfaceDetailColorVariantCount = colorVariants.size;
    detail.add(mesh);
  });
  detail.userData.surfaceDetailSignatures = signatures.slice();
  detail.userData.surfaceDetailExpectedWaterProfiles = Object.values(waterProfiles).map((profile) => `water:${profile.id}`);
  detail.userData.surfaceDetailExpectedRampProfiles = Object.values(rampProfiles).map((profile) => `ramp:${profile.id}`);

  add(detail, "surface-detail", "surface-detail:instanced-topography", "instance-pulse", {
    signatures,
    objectCount: waterFoamCount + shorePinCount + waterCrossingCount + rampChevronCount + contourCount,
    roleCount: worldMaterialRegions.water.length * 2 + worldMaterialRegions.ramps.length + contourCount,
    motionCount: waterFoamCount + waterCrossingCount + rampChevronCount + contourCount
  });
}

function addIdentityRibbon(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  palette: WorldSceneryPalette,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const ribbon = new THREE.Group();
  ribbon.name = "it-art-studio-identity-ribbon";
  ribbon.position.set(0, 0, -1.08);
  ribbon.rotation.y = 0.04;

  const tileMaterial = new THREE.MeshStandardMaterial({
    color: palette.road,
    roughness: 0.34,
    metalness: 0.36,
    emissive: palette.studio,
    emissiveIntensity: 0.16,
    vertexColors: true
  });
  const tileGeometry = new THREE.BoxGeometry(0.32, 0.055, 0.42);
  const tileCount = 21;
  const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, tileCount);
  const tileDummy = new THREE.Object3D();
  const tileColor = new THREE.Color();

  for (let index = 0; index < tileCount; index += 1) {
    const t = index / (tileCount - 1);
    const x = -3.15 + t * 6.3;
    const wave = Math.sin(t * Math.PI * 2);
    tileDummy.position.set(x, 1.48 + Math.sin(t * Math.PI) * 0.22, wave * 0.18);
    tileDummy.rotation.set(0.18 * wave, -0.55 + t * 1.1, 0.18 * Math.sin(t * Math.PI * 3));
    tileDummy.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.18);
    tileDummy.updateMatrix();
    tiles.setMatrixAt(index, tileDummy.matrix);
    tileColor.setHex(index < tileCount * 0.38 ? palette.tech : index > tileCount * 0.62 ? palette.art : palette.studio);
    tiles.setColorAt(index, tileColor);
  }
  tiles.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) {
    tiles.instanceColor.needsUpdate = true;
  }
  tiles.userData.identityRibbonPart = "instanced-tiles";
  ribbon.add(tiles);

  const pixelMaterial = new THREE.MeshStandardMaterial({
    color: palette.road,
    roughness: 0.5,
    metalness: 0.2,
    emissive: palette.road,
    emissiveIntensity: 0.14,
    vertexColors: true
  });
  const pixelGeometry = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  const pixelCount = 36;
  const pixels = new THREE.InstancedMesh(pixelGeometry, pixelMaterial, pixelCount);
  const pixelDummy = new THREE.Object3D();
  const pixelColor = new THREE.Color();

  for (let index = 0; index < pixelCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const lane = Math.floor(index / 2);
    const t = lane / Math.max(1, pixelCount / 2 - 1);
    const x = -2.65 + t * 5.3;
    pixelDummy.position.set(x, 1.06 + (index % 3) * 0.11, side * (0.42 + (lane % 4) * 0.055));
    pixelDummy.rotation.set(0.2 * side, t * Math.PI, 0.1 * lane);
    pixelDummy.scale.setScalar(0.82 + (lane % 5) * 0.08);
    pixelDummy.updateMatrix();
    pixels.setMatrixAt(index, pixelDummy.matrix);
    pixelColor.setHex(side < 0 ? palette.tech : lane % 3 === 0 ? palette.studio : palette.art);
    pixels.setColorAt(index, pixelColor);
  }
  pixels.instanceMatrix.needsUpdate = true;
  if (pixels.instanceColor) {
    pixels.instanceColor.needsUpdate = true;
  }
  pixels.userData.identityRibbonPart = "instanced-pixels";
  ribbon.add(pixels);

  const plate = box([5.9, 0.5, 0.08], inkMat, [0, 1.78, 0]);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(5.62, 0.36), createIdentityWordmarkMaterial(palette));
  face.position.set(0, 1.78, 0.046);
  ribbon.add(plate, face, beam([-2.82, 1.48, -0.02], [2.82, 1.48, -0.02], 0.018, roadMat));
  add(ribbon, "identity-ribbon", "identity-ribbon:it-studio-art", "sweep", {
    objectCount: tileCount + pixelCount + 3,
    roleCount: 1,
    motionCount: 1
  });
  return ribbon;
}

function addFashionTerrainWeave(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  artMat: THREE.Material,
  studioMat: THREE.Material,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const center = zones.find((zone) => zone.id === "fashion-room")?.position ?? [10.8, 19.8];
  const bandCount = 26;
  const stitchCount = 64;
  const pinCount = 24;
  const shadowCount = bandCount;
  const aiTraceCount = 28;
  const aiNodeCount = 42;
  const aiShadowCount = 10;
  const weave = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    bandCount + stitchCount + pinCount + shadowCount + aiTraceCount + aiNodeCount + aiShadowCount
  );
  weave.name = "fashion-room-terrain-weave";
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const signatures: string[] = [];
  let instanceIndex = 0;

  for (let index = 0; index < bandCount; index += 1) {
    const lane = index - (bandCount - 1) / 2;
    const row = index % 2 === 0 ? -1 : 1;
    const x = center[0] + lane * 0.36;
    const z = center[1] + row * (2.9 + (index % 5) * 0.24);
    const rotation = -0.68 + (index % 4) * 0.07;
    quaternion.setFromEuler(new THREE.Euler(0, rotation, 0));
    scale.set(2.9 + (index % 5) * 0.42, 0.038, 0.12);
    matrix.compose(new THREE.Vector3(x, 0.154 + (index % 3) * 0.003, z), quaternion, scale);
    weave.setMatrixAt(instanceIndex, matrix);
    weave.setColorAt(instanceIndex, color.setHex((artMat as THREE.MeshStandardMaterial).color?.getHex() ?? 0xff6f7d));
    instanceIndex += 1;
    signatures.push(`fashion-weave:band:${index}`);

    scale.set(1.68 + (index % 5) * 0.22, 0.022, 0.082);
    matrix.compose(new THREE.Vector3(x + 0.08, 0.13, z - 0.08), quaternion, scale);
    weave.setMatrixAt(instanceIndex, matrix);
    weave.setColorAt(instanceIndex, color.setHex(index % 3 === 0 ? 0x5d2336 : ((inkMat as THREE.MeshStandardMaterial).color?.getHex() ?? 0x070a0d)));
    instanceIndex += 1;
    signatures.push(`fashion-weave:shadow:${index}`);
  }

  for (let index = 0; index < stitchCount; index += 1) {
    const t = index / Math.max(1, stitchCount - 1);
    const side = index % 2 === 0 ? -1 : 1;
    const x = center[0] - 5.2 + t * 10.4;
    const z = center[1] + side * (1.86 + Math.sin(t * Math.PI * 3) * 0.34);
    quaternion.setFromEuler(new THREE.Euler(0, -0.68 + side * 0.18, 0));
    scale.set(0.3 + (index % 4) * 0.04, 0.044, 0.082);
    matrix.compose(new THREE.Vector3(x, 0.19 + (index % 4) * 0.002, z), quaternion, scale);
    weave.setMatrixAt(instanceIndex, matrix);
    weave.setColorAt(instanceIndex, color.setHex(index % 4 === 0 ? 0xffe38a : ((roadMat as THREE.MeshStandardMaterial).color?.getHex() ?? 0xdfe6ce)));
    instanceIndex += 1;
    signatures.push(`fashion-weave:stitch:${index}`);
  }

  for (let index = 0; index < pinCount; index += 1) {
    const angle = (index / pinCount) * Math.PI * 2;
    const radius = 3.4 + (index % 3) * 0.56;
    const x = center[0] + Math.cos(angle) * radius;
    const z = center[1] + Math.sin(angle) * radius * 0.62;
    quaternion.setFromEuler(new THREE.Euler(0.18, angle, 0.12));
    scale.set(0.066 + (index % 4) * 0.006, 0.32, 0.066 + (index % 4) * 0.006);
    matrix.compose(new THREE.Vector3(x, 0.32, z), quaternion, scale);
    weave.setMatrixAt(instanceIndex, matrix);
    weave.setColorAt(instanceIndex, color.setHex((studioMat as THREE.MeshStandardMaterial).color?.getHex() ?? 0xffe38a));
    instanceIndex += 1;
    signatures.push(`fashion-weave:pin:${index}`);
  }

  const aiCenter = zones.find((zone) => zone.id === "ai-lab")?.position ?? [-21.4, -8.8];
  for (let index = 0; index < aiTraceCount; index += 1) {
    const lane = index - (aiTraceCount - 1) / 2;
    const side = index % 2 === 0 ? -1 : 1;
    const x = aiCenter[0] + lane * 0.36;
    const z = aiCenter[1] + side * (3.2 + (index % 6) * 0.28);
    const rotation = 0.72 + side * 0.18 + (index % 5) * 0.026;
    quaternion.setFromEuler(new THREE.Euler(0, rotation, 0));
    scale.set(2.5 + (index % 4) * 0.34, 0.044, 0.13);
    matrix.compose(new THREE.Vector3(x, 0.188 + (index % 3) * 0.004, z), quaternion, scale);
    weave.setMatrixAt(instanceIndex, matrix);
    weave.setColorAt(instanceIndex, color.setHex(index % 4 === 0 ? 0xffe38a : index % 2 === 0 ? 0x17d2ff : 0x2d6f7a));
    instanceIndex += 1;
    signatures.push(`ai-lab-circuit:trace:${index}`);
  }

  for (let index = 0; index < aiNodeCount; index += 1) {
    const ring = index % 3;
    const angle = (index / aiNodeCount) * Math.PI * 2.0 + ring * 0.28;
    const radius = 3.25 + ring * 1.04 + (index % 4) * 0.08;
    const x = aiCenter[0] + Math.cos(angle) * radius * 1.34;
    const z = aiCenter[1] + Math.sin(angle) * radius * 0.86;
    quaternion.setFromEuler(new THREE.Euler(0, angle, 0));
    const nodeScale = 0.14 + (index % 5) * 0.018;
    scale.set(nodeScale, 0.075, nodeScale);
    matrix.compose(new THREE.Vector3(x, 0.226 + ring * 0.012, z), quaternion, scale);
    weave.setMatrixAt(instanceIndex, matrix);
    weave.setColorAt(instanceIndex, color.setHex(index % 4 === 0 ? 0xff6f7d : 0x17d2ff));
    instanceIndex += 1;
    signatures.push(`ai-lab-circuit:node:${index}`);
  }

  for (let index = 0; index < aiShadowCount; index += 1) {
    const t = index / Math.max(1, aiShadowCount - 1);
    const side = index % 2 === 0 ? -1 : 1;
    const x = aiCenter[0] - 6.0 + t * 12.0;
    const z = aiCenter[1] + side * (4.55 + Math.sin(t * Math.PI * 2) * 0.42);
    quaternion.setFromEuler(new THREE.Euler(0, 0.74 + side * 0.12, 0));
    scale.set(2.25 + (index % 4) * 0.28, 0.02, 0.11);
    matrix.compose(new THREE.Vector3(x, 0.14, z), quaternion, scale);
    weave.setMatrixAt(instanceIndex, matrix);
    weave.setColorAt(instanceIndex, color.setHex(0x2a4a48));
    instanceIndex += 1;
    signatures.push(`ai-lab-circuit:shadow:${index}`);
  }

  weave.instanceMatrix.needsUpdate = true;
  if (weave.instanceColor) {
    weave.instanceColor.needsUpdate = true;
  }
  weave.userData.surfaceDetailPart = "fashion-terrain-weave";
  weave.userData.surfaceDetailProfileIds = ["fashion-room:terrain-weave", "ai-lab:circuit-weave"];
  weave.userData.surfaceDetailSignatures = signatures.slice();

  add(weave, "surface-detail", "surface-detail:fashion-room-terrain-weave", "instance-pulse", {
    signatures,
    objectCount: bandCount + stitchCount + pinCount + shadowCount + aiTraceCount + aiNodeCount + aiShadowCount,
    roleCount: 6,
    motionCount: bandCount + stitchCount + aiTraceCount + aiNodeCount
  });
}

function createIdentityWordmarkMaterial(palette: WorldSceneryPalette) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 192;
  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "#080b10";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#fff7df";
    context.lineWidth = 12;
    context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "900 78px system-ui, sans-serif";
    context.fillStyle = `#${palette.tech.toString(16).padStart(6, "0")}`;
    context.fillText("IT", 190, canvas.height / 2 + 2);
    context.fillStyle = `#${palette.studio.toString(16).padStart(6, "0")}`;
    context.font = "900 70px system-ui, sans-serif";
    context.fillText("STUDIO", 512, canvas.height / 2 + 2);
    context.fillStyle = `#${palette.art.toString(16).padStart(6, "0")}`;
    context.font = "900 78px system-ui, sans-serif";
    context.fillText("ART", 836, canvas.height / 2 + 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture });
}

function addTechSkyline(
  add: (object: THREE.Object3D, role: SceneRole, signature: string, motionBehavior?: MotionBehavior) => void,
  techMat: THREE.Material,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const anchors = [
    [-14.2, -9.4, 1.25],
    [-13.4, 8.4, 1.08],
    [-6.8, 11.2, 0.92],
    [-2.1, -11.1, 1.02]
  ] as const;

  anchors.forEach(([x, z, height], index) => {
    const stack = new THREE.Group();
    stack.position.set(x, 0, z);
    stack.rotation.y = index * 0.34;
    stack.add(box([0.34, height, 0.34], inkMat, [0, 0.18 + height / 2, 0]));
    stack.add(box([0.42, 0.08, 0.42], techMat, [0, height + 0.36, 0]));
    stack.add(box([0.72, 0.045, 0.08], roadMat, [0, height + 0.56, 0.22]));
    stack.add(sphere(0.09, techMat, [0.32, height + 0.58, 0.22]));
    add(stack, "tech-skyline", `tech-skyline:${index}`, index % 2 === 0 ? "blink" : "pulse");
  });
}

function addArtSculptures(
  add: (object: THREE.Object3D, role: SceneRole, signature: string, motionBehavior?: MotionBehavior) => void,
  artMat: THREE.Material,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const anchors = [
    [14.3, -8.7, 0.2],
    [14.7, 6.6, -0.36],
    [7.4, 11.8, 0.52],
    [3.6, -12.1, 0.08]
  ] as const;

  anchors.forEach(([x, z, rotation], index) => {
    const sculpture = new THREE.Group();
    sculpture.position.set(x, 0, z);
    sculpture.rotation.y = rotation;
    const frame = torus(0.42 + index * 0.035, 0.026, artMat, [0, 0.78, 0]);
    frame.rotation.x = Math.PI * 0.32;
    frame.rotation.z = index * 0.28;
    sculpture.add(frame);
    sculpture.add(box([0.08, 0.86, 0.08], roadMat, [-0.38, 0.54, -0.08]));
    sculpture.add(box([0.08, 0.86, 0.08], inkMat, [0.38, 0.54, 0.08]));
    sculpture.add(sphere(0.14, artMat, [0, 1.06, 0.28]));
    add(sculpture, "art-sculpture", `art-sculpture:${index}`, index % 2 === 0 ? "tilt" : "float");
  });
}

function addStudioThreshold(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  studioMat: THREE.Material,
  techMat: THREE.Material,
  artMat: THREE.Material,
  roadMat: THREE.Material
) {
  const anchors = [
    [-2.1, -2.5, techMat],
    [2.1, -2.5, artMat],
    [-1.9, 3.3, studioMat],
    [1.9, 3.3, studioMat]
  ] as const;
  const threshold = new THREE.Group();
  threshold.name = "studio-threshold-batched-pylons";
  const bodyGeometry = new THREE.BoxGeometry(0.16, 1.18, 0.16);
  const capGeometry = new THREE.BoxGeometry(0.72, 0.08, 0.12);
  const nodeGeometry = new THREE.SphereGeometry(0.12, 12, 8);
  const techBodies = new THREE.InstancedMesh(bodyGeometry, techMat, 1);
  const artBodies = new THREE.InstancedMesh(bodyGeometry, artMat, 1);
  const studioBodies = new THREE.InstancedMesh(bodyGeometry, studioMat, 2);
  const caps = new THREE.InstancedMesh(capGeometry, roadMat, anchors.length);
  const techNodes = new THREE.InstancedMesh(nodeGeometry, techMat, 1);
  const artNodes = new THREE.InstancedMesh(nodeGeometry, artMat, 1);
  const studioNodes = new THREE.InstancedMesh(nodeGeometry, studioMat, 2);
  const dummy = new THREE.Object3D();
  let studioIndex = 0;

  anchors.forEach(([x, z, mat], index) => {
    const rotationY = index < 2 ? 0.48 : -0.32;
    const instanceIndex = mat === studioMat ? studioIndex : 0;
    const bodyMesh = mat === techMat ? techBodies : mat === artMat ? artBodies : studioBodies;
    const nodeMesh = mat === techMat ? techNodes : mat === artMat ? artNodes : studioNodes;

    dummy.position.set(x, 0.68, z);
    dummy.rotation.set(0, rotationY, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    bodyMesh.setMatrixAt(instanceIndex, dummy.matrix);

    dummy.position.set(x, 1.26, z);
    dummy.updateMatrix();
    caps.setMatrixAt(index, dummy.matrix);

    dummy.position.set(x + Math.cos(rotationY) * 0.36, 1.28, z - Math.sin(rotationY) * 0.36);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(instanceIndex, dummy.matrix);

    if (mat === studioMat) {
      studioIndex += 1;
    }
  });
  [techBodies, artBodies, studioBodies, caps, techNodes, artNodes, studioNodes].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    threshold.add(mesh);
  });
  add(threshold, "studio-threshold", "studio-threshold:batched-pylons", "sweep", {
    signatures: anchors.map((_, index) => `studio-threshold:${index}`),
    objectCount: anchors.length * 3,
    roleCount: anchors.length,
    motionCount: anchors.length
  });
}

function addRouteLights(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  routes: WorldRoute[],
  roadMat: THREE.Material
) {
  const markers = sampleRouteMarkers(routes);
  if (markers.length === 0) {
    return;
  }
  const lights = new THREE.Group();
  lights.name = "route-light-instances";
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.078, 0.034, 0.66, 7), roadMat, markers.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();

  markers.forEach((marker, index) => {
    quaternion.setFromEuler(new THREE.Euler(0, marker.angle, 0));
    const pulseScale = 0.82 + (marker.lane % 3) * 0.12;
    matrix.compose(
      new THREE.Vector3(marker.x, 0.43 + marker.lane * 0.052, marker.z),
      quaternion,
      new THREE.Vector3(0.82 + marker.lane * 0.05, pulseScale, 0.82 + marker.lane * 0.05)
    );
    posts.setMatrixAt(index, matrix);
  });
  posts.instanceMatrix.needsUpdate = true;
  posts.userData.worldSceneryPart = "route-light-compressed-post";
  posts.userData.worldSceneryCompressedParts = ["stem", "cap"];
  lights.add(posts);

  add(lights, "route-light", "route-light:instanced", "instance-pulse", {
    signatures: markers.map((marker, index) => `route-light:${marker.route.id}:${index}`),
    objectCount: markers.length * 2,
    roleCount: markers.length,
    motionCount: markers.length
  });
}

function sampleRouteMarkers(routes: WorldRoute[]) {
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  return routes.flatMap((route) => {
    const from = zoneById.get(route.from);
    const to = zoneById.get(route.to);
    if (!from || !to) {
      return [];
    }
    const points = [from.position, ...(route.via ?? []), to.position];
    const needsDenseRouteLights =
      route.from === "architecture-bridge" || route.to === "architecture-bridge" || route.from === "ai-lab" || route.to === "ai-lab";
    const samples = needsDenseRouteLights ? [0.12, 0.24, 0.38, 0.5, 0.62, 0.76, 0.88] : [0.27, 0.5, 0.73];
    return samples.map((sample, lane) => {
      const marker = samplePolyline(points, sample);
      return {
        route,
        x: marker.x,
        z: marker.z,
        angle: marker.angle,
        lane
      };
    });
  });
}

function samplePolyline(points: Array<readonly [number, number]>, t: number) {
  const segments: Array<{ from: readonly [number, number]; to: readonly [number, number]; length: number }> = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    segments.push({ from, to, length });
    totalLength += length;
  }

  let remaining = totalLength * clamp01(t);
  for (const segment of segments) {
    if (remaining <= segment.length || segment === segments[segments.length - 1]) {
      const localT = segment.length > 0 ? remaining / segment.length : 0;
      return {
        x: segment.from[0] + (segment.to[0] - segment.from[0]) * localT,
        z: segment.from[1] + (segment.to[1] - segment.from[1]) * localT,
        angle: Math.atan2(segment.to[0] - segment.from[0], segment.to[1] - segment.from[1])
      };
    }
    remaining -= segment.length;
  }

  const fallback = points[points.length - 1] ?? [0, 0];
  return { x: fallback[0], z: fallback[1], angle: 0 };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function countMeshes(object: THREE.Object3D) {
  let count = 0;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      count += 1;
    }
  });
  return count;
}
