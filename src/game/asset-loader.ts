import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import worldAssetManifest from "../../assets/world-assets.manifest.json";
import { sampleTerrain, worldMaterialRegions } from "./world-materials";
import { worldRoutes, zones } from "./zones";

type ManifestAsset = {
  id: string;
  status: string;
  sourceId: string;
  kind: string;
  target: string;
  terrainRole: string;
  publicPath?: string;
  fileKb?: number;
  triangles?: number;
  selectedFiles?: string[];
};

type CorePromotionContract = {
  assetId: string;
  requiredFiles?: string[];
  requiredPlacementIds?: string[];
};

type WorldAssetManifest = {
  assets: ManifestAsset[];
  corePromotion?: CorePromotionContract;
};

export type ExternalAssetPreviewTelemetry = {
  enabled: boolean;
  mode: "off" | "preview" | "core" | "map";
  requested: number;
  loaded: number;
  failed: number;
  visible: number;
  collections: number;
  files: number;
  sceneObjects: number;
  collectionFileKb: number;
  collectionTriangles: number;
  uniqueFiles: number;
  assetIds: string[];
  terrainRoles: string[];
  publicPaths: string[];
  placementIds: string[];
  placementFiles: string[];
  placementAssetKeys: string[];
  premiumPromotionFiles: string[];
  premiumPromotionPlacementIds: string[];
  errors: string[];
  heroLocationPlacements: number;
  heroLocationIds: string[];
  heroLocationPlacementCounts: Record<string, number>;
  heroLocationRoles: Record<string, string[]>;
  heroLocationScreenRects: Record<string, { visible: boolean; visibleRatio: number; clippedArea: number; width: number; height: number }>;
  placementScreenRects: Record<string, { visible: boolean; visibleRatio: number; clippedArea: number; width: number; height: number }>;
  fileScreenRects: Record<string, { visible: boolean; visibleRatio: number; clippedArea: number; width: number; height: number }>;
  placements: number;
  clusters: number;
  placementGroups: number;
  routeLinkedPlacements: number;
  waterLinkedPlacements: number;
  reliefLinkedPlacements: number;
  vegetationLinkedPlacements: number;
  primaryPlacements: number;
  supportPlacements: number;
  contextPlacements: number;
  promotionCandidates: number;
  maxClusterDensity: number;
  maxNonHeroClusterDensity: number;
  maxHeroLocationClusterDensity: number;
  minGroundClearance: number;
  coplanarRiskPlacements: number;
  actualMinGroundClearance: number;
  actualCoplanarRiskPlacements: number;
  roleScreenRects: Record<string, { visible: boolean; visibleRatio: number; clippedArea: number; width: number; height: number }>;
  routePlacements: number;
  waterPlacements: number;
  reliefPlacements: number;
  vegetationPlacements: number;
  mapCoverageWidth: number;
  mapCoverageDepth: number;
  mapCoverageArea: number;
  materialStyleRoles: string[];
};

type PreviewSpec = {
  assetId?: string;
  terrainRole: string;
  preferredFile: string;
  position: [number, number, number];
  targetSize: number;
  rotationY?: number;
};

type MapPlacementSpec = PreviewSpec & {
  id: string;
  assetId?: string;
  clusterId: string;
  linkedKind: "route" | "water" | "relief" | "vegetation";
  curation: "primary" | "support" | "context";
  promotionCandidate: boolean;
  groundClearance: number;
  heroLocation?: string;
  heroRole?: string;
};

const manifest = worldAssetManifest as WorldAssetManifest;
const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
const publicWaterEdgeTexturePath = "assets/textures/vendor/polyhaven/low_tide_rocks/low_tide_rocks_diff_1k.jpg";
let publicWaterEdgeTexture: THREE.Texture | null = null;
const introSafeTerrainOffset: [number, number] = [5.8, 6.4];

const previewSpecs: PreviewSpec[] = [
  {
    terrainRole: "road",
    preferredFile: "road-straight.glb",
    position: [-5.6, 0.24, -1.8],
    targetSize: 1.35
  },
  {
    terrainRole: "route-edge",
    preferredFile: "light-square.glb",
    position: [-3.35, 0.32, -1.8],
    targetSize: 1.2
  },
  {
    terrainRole: "bridge",
    preferredFile: "bridge_wood.glb",
    position: [-1.1, 0.3, -1.8],
    targetSize: 1.45,
    rotationY: Math.PI * 0.5
  },
  {
    terrainRole: "relief",
    preferredFile: "cliff_blockSlope_rock.glb",
    position: [1.15, 0.24, -1.8],
    targetSize: 1.4
  },
  {
    terrainRole: "water",
    preferredFile: "ground_riverStraight.glb",
    position: [3.4, 0.22, -1.8],
    targetSize: 1.35,
    rotationY: Math.PI * 0.5
  },
  {
    terrainRole: "vegetation",
    preferredFile: "tree_oak.glb",
    position: [5.65, 0.24, -1.8],
    targetSize: 1.55
  },
  {
    assetId: "accepted-factory-industrial-core",
    terrainRole: "hero-location",
    preferredFile: "machine-fortified.glb",
    position: [-2.7, 0.28, 1.9],
    targetSize: 1.75,
    rotationY: -0.28
  },
  {
    assetId: "accepted-factory-industrial-core",
    terrainRole: "hero-location",
    preferredFile: "top-large-checkerboard.glb",
    position: [0, 0.28, 1.9],
    targetSize: 1.7,
    rotationY: 0.18
  },
  {
    assetId: "accepted-factory-industrial-core",
    terrainRole: "hero-location",
    preferredFile: "screen-wide.glb",
    position: [2.7, 0.28, 1.9],
    targetSize: 1.72,
    rotationY: 0.32
  }
];

export function createExternalAssetTelemetry(enabled: boolean, mode: ExternalAssetPreviewTelemetry["mode"] = enabled ? "preview" : "off"): ExternalAssetPreviewTelemetry {
  return {
    enabled,
    mode,
    requested: 0,
    loaded: 0,
    failed: 0,
    visible: 0,
    collections: 0,
    files: 0,
    sceneObjects: 0,
    collectionFileKb: 0,
    collectionTriangles: 0,
    uniqueFiles: 0,
    assetIds: [],
    terrainRoles: [],
    publicPaths: [],
    placementIds: [],
    placementFiles: [],
    placementAssetKeys: [],
    premiumPromotionFiles: [],
    premiumPromotionPlacementIds: [],
    errors: [],
    heroLocationPlacements: 0,
    heroLocationIds: [],
    heroLocationPlacementCounts: {},
    heroLocationRoles: {},
    heroLocationScreenRects: {},
    placementScreenRects: {},
    fileScreenRects: {},
    placements: 0,
    clusters: 0,
    placementGroups: 0,
    routeLinkedPlacements: 0,
    waterLinkedPlacements: 0,
    reliefLinkedPlacements: 0,
    vegetationLinkedPlacements: 0,
    primaryPlacements: 0,
    supportPlacements: 0,
    contextPlacements: 0,
    promotionCandidates: 0,
    maxClusterDensity: 0,
    maxNonHeroClusterDensity: 0,
    maxHeroLocationClusterDensity: 0,
    minGroundClearance: 0,
    coplanarRiskPlacements: 0,
    actualMinGroundClearance: 0,
    actualCoplanarRiskPlacements: 0,
    roleScreenRects: {},
    routePlacements: 0,
    waterPlacements: 0,
    reliefPlacements: 0,
    vegetationPlacements: 0,
    mapCoverageWidth: 0,
    mapCoverageDepth: 0,
    mapCoverageArea: 0,
    materialStyleRoles: []
  };
}

export async function createExternalAssetPreview() {
  const group = new THREE.Group();
  group.name = "external-asset-preview";
  group.userData.externalAssetPreview = true;

  const telemetry = createExternalAssetTelemetry(true, "preview");
  const loader = new GLTFLoader();
  const acceptedAssets = getAcceptedModelCollections();
  const meteredAssetIds = new Set<string>();

  const jobs = previewSpecs
    .map((spec) => {
      const asset = acceptedAssets.find((item) =>
        spec.assetId
          ? item.id === spec.assetId && item.selectedFiles?.includes(spec.preferredFile)
          : item.terrainRole === spec.terrainRole && item.selectedFiles?.includes(spec.preferredFile)
      );
      return asset ? { asset, spec } : null;
    })
    .filter((job): job is { asset: ManifestAsset; spec: PreviewSpec } => Boolean(job));

  telemetry.requested = jobs.length;
  telemetry.collections = new Set(jobs.map((job) => job.asset.id)).size;

  const results = await Promise.allSettled(
    jobs.map(async ({ asset, spec }) => {
      const { object, url } = await loadNormalizedObject(loader, asset, spec);
      const wrapper = object;
      wrapper.name = `external-asset:${asset.id}:${spec.preferredFile}`;
      wrapper.userData.externalAsset = true;
      wrapper.userData.externalAssetId = asset.id;
      wrapper.userData.externalAssetSourceId = asset.sourceId;
      wrapper.userData.externalAssetTerrainRole = asset.terrainRole;
      wrapper.userData.externalAssetFile = spec.preferredFile;
      wrapper.userData.externalAssetUrl = url;
      wrapper.traverse((object) => {
        object.userData.externalAssetId = object.userData.externalAssetId ?? asset.id;
        if (object instanceof THREE.Mesh) {
          object.castShadow = false;
          object.receiveShadow = false;
          object.frustumCulled = false;
        }
      });

      group.add(wrapper);
      telemetry.loaded += 1;
      telemetry.visible += 1;
      telemetry.files += 1;
      if (!meteredAssetIds.has(asset.id)) {
        meteredAssetIds.add(asset.id);
        telemetry.collectionFileKb = Number((telemetry.collectionFileKb + (asset.fileKb ?? 0)).toFixed(1));
        telemetry.collectionTriangles += asset.triangles ?? 0;
      }
      telemetry.assetIds.push(asset.id);
      telemetry.terrainRoles.push(asset.terrainRole);
      telemetry.publicPaths.push(url);
    })
  );

  collectRejectedResults(results, telemetry);
  finalizeTelemetry(group, telemetry);

  return { group, telemetry };
}

export async function createExternalAssetCoreLayer() {
  return createExternalAssetPlacementLayer("core", createCorePlacementSpecs());
}

export async function createExternalAssetTerrainCoreLayer() {
  return createExternalAssetPlacementLayer("core", createTerrainCorePlacementSpecs());
}

export async function createExternalAssetMapLayer() {
  return createExternalAssetPlacementLayer("map", createMapPlacementSpecs());
}

async function createExternalAssetPlacementLayer(mode: "core" | "map", placements: MapPlacementSpec[]) {
  const group = new THREE.Group();
  group.name = mode === "core" ? "external-asset-core-layer" : "external-asset-map-layer";
  group.userData.externalAssetMapLayer = true;
  group.userData.externalAssetCoreLayer = mode === "core";

  const telemetry = createExternalAssetTelemetry(true, mode);
  const loader = new GLTFLoader();
  const cache = new Map<string, Promise<THREE.Object3D>>();
  const acceptedAssets = getAcceptedModelCollections();
  const meteredAssetIds = new Set<string>();
  const promotedAssetId = manifest.corePromotion?.assetId;
  const promotedFiles = new Set(manifest.corePromotion?.requiredFiles ?? []);
  const promotedPlacementIds = new Set(manifest.corePromotion?.requiredPlacementIds ?? []);

  const jobs = placements
    .map((spec) => {
      const asset = acceptedAssets.find((item) =>
        spec.assetId
          ? item.id === spec.assetId && item.selectedFiles?.includes(spec.preferredFile)
          : item.terrainRole === spec.terrainRole && item.selectedFiles?.includes(spec.preferredFile)
      );
      return asset ? { asset, spec } : null;
    })
    .filter((job): job is { asset: ManifestAsset; spec: MapPlacementSpec } => Boolean(job));

  telemetry.requested = jobs.length;
  telemetry.collections = new Set(jobs.map((job) => job.asset.id)).size;
  telemetry.placements = jobs.length;
  telemetry.clusters = new Set(jobs.map((job) => job.spec.clusterId)).size;
  telemetry.placementGroups = new Set(jobs.map((job) => job.spec.linkedKind)).size;
  telemetry.routeLinkedPlacements = jobs.filter((job) => job.spec.linkedKind === "route").length;
  telemetry.waterLinkedPlacements = jobs.filter((job) => job.spec.linkedKind === "water").length;
  telemetry.reliefLinkedPlacements = jobs.filter((job) => job.spec.linkedKind === "relief").length;
  telemetry.vegetationLinkedPlacements = jobs.filter((job) => job.spec.linkedKind === "vegetation").length;
  telemetry.primaryPlacements = jobs.filter((job) => job.spec.curation === "primary").length;
  telemetry.supportPlacements = jobs.filter((job) => job.spec.curation === "support").length;
  telemetry.contextPlacements = jobs.filter((job) => job.spec.curation === "context").length;
  telemetry.promotionCandidates = jobs.filter((job) => job.spec.promotionCandidate).length;
  telemetry.maxClusterDensity = getMaxClusterDensity(jobs.map((job) => job.spec.clusterId));
  telemetry.maxNonHeroClusterDensity = getMaxClusterDensity(
    jobs.filter((job) => !job.spec.heroLocation).map((job) => job.spec.clusterId)
  );
  telemetry.maxHeroLocationClusterDensity = getMaxClusterDensity(
    jobs.filter((job) => Boolean(job.spec.heroLocation)).map((job) => job.spec.clusterId)
  );
  telemetry.minGroundClearance = Number(Math.min(...jobs.map((job) => job.spec.groundClearance)).toFixed(3));
  telemetry.coplanarRiskPlacements = jobs.filter((job) => job.spec.groundClearance < 0.12).length;
  for (const { spec } of jobs) {
    if (!spec.heroLocation) {
      continue;
    }
    telemetry.heroLocationPlacements += 1;
    telemetry.heroLocationPlacementCounts[spec.heroLocation] = (telemetry.heroLocationPlacementCounts[spec.heroLocation] ?? 0) + 1;
    if (spec.heroRole) {
      telemetry.heroLocationRoles[spec.heroLocation] = [...(telemetry.heroLocationRoles[spec.heroLocation] ?? []), spec.heroRole];
    }
  }
  telemetry.heroLocationIds = Object.keys(telemetry.heroLocationPlacementCounts).sort();
  telemetry.heroLocationRoles = Object.fromEntries(
    Object.entries(telemetry.heroLocationRoles).map(([zoneId, roles]) => [zoneId, [...new Set(roles)].sort()])
  );
  const actualGroundClearances: number[] = [];

  const results = await Promise.allSettled(
    jobs.map(async ({ asset, spec }) => {
      const { object, url } = await loadNormalizedObject(loader, asset, spec, cache, mode === "core");
      const wrapper = object;
      applyMapCurationStyle(wrapper, spec);
      const materialStyleRoles = getObjectMaterialStyleRoles(wrapper);
      const actualGroundClearance = measureActualGroundClearance(wrapper);
      actualGroundClearances.push(actualGroundClearance);
      wrapper.name = `external-map-asset:${spec.id}:${asset.id}:${spec.preferredFile}`;
      wrapper.userData.externalAsset = true;
      wrapper.userData.externalAssetMapPlacement = true;
      wrapper.userData.externalAssetPlacementId = spec.id;
      wrapper.userData.externalAssetClusterId = spec.clusterId;
      wrapper.userData.externalAssetLinkedKind = spec.linkedKind;
      wrapper.userData.externalAssetCuration = spec.curation;
      wrapper.userData.externalAssetPromotionCandidate = spec.promotionCandidate;
      wrapper.userData.externalAssetGroundClearance = spec.groundClearance;
      wrapper.userData.externalAssetHeroLocation = spec.heroLocation ?? null;
      wrapper.userData.externalAssetHeroRole = spec.heroRole ?? null;
      wrapper.userData.externalAssetId = asset.id;
      wrapper.userData.externalAssetSourceId = asset.sourceId;
      wrapper.userData.externalAssetTerrainRole = asset.terrainRole;
      wrapper.userData.externalAssetFile = spec.preferredFile;
      wrapper.userData.externalAssetUrl = url;
      wrapper.traverse((object) => {
        object.userData.externalAssetId = object.userData.externalAssetId ?? asset.id;
        object.userData.externalAssetMapPlacement = true;
        object.userData.externalAssetCuration = object.userData.externalAssetCuration ?? spec.curation;
        object.userData.externalAssetHeroLocation = object.userData.externalAssetHeroLocation ?? spec.heroLocation ?? null;
        object.userData.externalAssetHeroRole = object.userData.externalAssetHeroRole ?? spec.heroRole ?? null;
        if (object instanceof THREE.Mesh) {
          object.castShadow = false;
          object.receiveShadow = true;
          object.frustumCulled = false;
        }
      });

      group.add(wrapper);
      telemetry.loaded += 1;
      telemetry.visible += 1;
      telemetry.files += 1;
      if (!meteredAssetIds.has(asset.id)) {
        meteredAssetIds.add(asset.id);
        telemetry.collectionFileKb = Number((telemetry.collectionFileKb + (asset.fileKb ?? 0)).toFixed(1));
        telemetry.collectionTriangles += asset.triangles ?? 0;
      }
      telemetry.assetIds.push(asset.id);
      telemetry.terrainRoles.push(asset.terrainRole);
      telemetry.publicPaths.push(url);
      telemetry.placementIds.push(spec.id);
      telemetry.placementFiles.push(spec.preferredFile);
      telemetry.placementAssetKeys.push(`${asset.id}::${spec.id}::${spec.preferredFile}`);
      telemetry.materialStyleRoles.push(...materialStyleRoles);
      if (asset.id === promotedAssetId && promotedFiles.has(spec.preferredFile) && promotedPlacementIds.has(spec.id)) {
        telemetry.premiumPromotionFiles.push(spec.preferredFile);
        telemetry.premiumPromotionPlacementIds.push(spec.id);
      }
      if (asset.terrainRole === "road" || asset.terrainRole === "route-edge" || asset.terrainRole === "bridge") {
        telemetry.routePlacements += 1;
      }
      if (asset.terrainRole === "water") {
        telemetry.waterPlacements += 1;
      }
      if (asset.terrainRole === "relief") {
        telemetry.reliefPlacements += 1;
      }
      if (asset.terrainRole === "vegetation") {
        telemetry.vegetationPlacements += 1;
      }
    })
  );

  collectRejectedResults(results, telemetry);
  finalizeTelemetry(group, telemetry);
  telemetry.uniqueFiles = cache.size;
  telemetry.actualMinGroundClearance =
    actualGroundClearances.length > 0 ? Number(Math.min(...actualGroundClearances).toFixed(3)) : 0;
  telemetry.actualCoplanarRiskPlacements = actualGroundClearances.filter((clearance) => clearance < 0.08).length;
  const bounds = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  bounds.getSize(size);
  telemetry.mapCoverageWidth = Number(size.x.toFixed(2));
  telemetry.mapCoverageDepth = Number(size.z.toFixed(2));
  telemetry.mapCoverageArea = Number((size.x * size.z).toFixed(2));


  return { group, telemetry };
}

function getAcceptedModelCollections() {
  return manifest.assets.filter(
    (asset) =>
      (asset.status === "accepted" || asset.status === "integrated") &&
      asset.kind.includes("model") &&
      asset.target === "map" &&
      asset.publicPath &&
      Array.isArray(asset.selectedFiles)
  );
}

async function loadNormalizedObject(
  loader: GLTFLoader,
  asset: ManifestAsset,
  spec: PreviewSpec,
  cache?: Map<string, Promise<THREE.Object3D>>,
  compact = false
) {
  const url = createRuntimeAssetUrl(asset.publicPath ?? "", spec.preferredFile);
  if (!cache?.has(url)) {
    cache?.set(url, loader.loadAsync(url).then((gltf) => gltf.scene));
  }
  const source = cache ? (await cache.get(url))?.clone(true) : (await loader.loadAsync(url)).scene;
  const preparedSource = compact ? compactObjectTree(source ?? new THREE.Group(), spec.preferredFile) : (source ?? new THREE.Group());
  return {
    object: normalizePreviewObject(preparedSource, spec),
    url
  };
}

function compactObjectTree(source: THREE.Object3D, label: string) {
  source.updateWorldMatrix(true, true);
  const materialBuckets = new Map<string, { material: THREE.Material; geometries: THREE.BufferGeometry[] }>();

  source.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !(object.geometry instanceof THREE.BufferGeometry)) {
      return;
    }
    const material = Array.isArray(object.material) ? object.material[0] : object.material;
    if (!material) {
      return;
    }
    let bucket = materialBuckets.get(material.uuid);
    if (!bucket) {
      bucket = { material: material.clone(), geometries: [] };
      materialBuckets.set(material.uuid, bucket);
    }
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    bucket.geometries.push(geometry);
  });

  if (materialBuckets.size === 0) {
    return source;
  }

  const compactGroup = new THREE.Group();
  compactGroup.name = `compact-external-asset:${label}`;
  for (const [index, bucket] of [...materialBuckets.values()].entries()) {
    const merged = mergeGeometries(bucket.geometries, false);
    if (!merged) {
      continue;
    }
    const mesh = new THREE.Mesh(merged, bucket.material);
    mesh.name = `compact-external-asset:${label}:${index}`;
    compactGroup.add(mesh);
  }

  return compactGroup.children.length > 0 ? compactGroup : source;
}

function collectRejectedResults(results: Array<PromiseSettledResult<unknown>>, telemetry: ExternalAssetPreviewTelemetry) {
  for (const result of results) {
    if (result.status === "rejected") {
      telemetry.failed += 1;
      telemetry.errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }
}

function finalizeTelemetry(group: THREE.Object3D, telemetry: ExternalAssetPreviewTelemetry) {
  let sceneObjects = 0;
  group.traverse(() => {
    sceneObjects += 1;
  });
  telemetry.sceneObjects = sceneObjects;
  telemetry.assetIds = [...new Set(telemetry.assetIds)].sort();
  telemetry.terrainRoles = [...new Set(telemetry.terrainRoles)].sort();
  telemetry.publicPaths = [...new Set(telemetry.publicPaths)].sort();
  telemetry.placementIds = [...new Set(telemetry.placementIds)].sort();
  telemetry.placementFiles = [...new Set(telemetry.placementFiles)].sort();
  telemetry.placementAssetKeys = [...new Set(telemetry.placementAssetKeys)].sort();
  telemetry.premiumPromotionFiles = [...new Set(telemetry.premiumPromotionFiles)].sort();
  telemetry.premiumPromotionPlacementIds = [...new Set(telemetry.premiumPromotionPlacementIds)].sort();
  telemetry.materialStyleRoles = [...new Set(telemetry.materialStyleRoles)].sort();
  telemetry.uniqueFiles = telemetry.publicPaths.length;
}

function getMaxClusterDensity(clusterIds: string[]) {
  const counts = new Map<string, number>();
  for (const clusterId of clusterIds) {
    counts.set(clusterId, (counts.get(clusterId) ?? 0) + 1);
  }
  return Math.max(...counts.values(), 0);
}

function applyMapCurationStyle(wrapper: THREE.Object3D, spec: MapPlacementSpec) {
  if (spec.curation === "support") {
    wrapper.scale.multiplyScalar(0.86);
  }
  if (spec.curation === "context") {
    wrapper.scale.multiplyScalar(0.7);
  }
  applyAssetSpecificMaterialStyle(wrapper, spec);
  alignObjectBottomToGroundClearance(wrapper, spec);
}

function applyAssetSpecificMaterialStyle(wrapper: THREE.Object3D, spec: MapPlacementSpec) {
  if (spec.assetId === "accepted-assetquest-pond-water-core") {
    const isPondSurface = spec.preferredFile.startsWith("pond-");
    const isRock = spec.preferredFile.startsWith("rock-");
    const styleRole = isPondSurface ? "water-surface-textured" : isRock ? "water-bank-rock" : "water-plant";
    const materialColor = isPondSurface ? 0x1f5d68 : isRock ? 0x8b806f : 0x4f7f55;
    const emissiveColor = isPondSurface ? 0x0b3139 : 0x000000;

    wrapper.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.material = new THREE.MeshStandardMaterial({
        color: materialColor,
        map: isPondSurface ? getPublicWaterEdgeTexture() : null,
        roughness: isPondSurface ? 0.36 : 0.82,
        metalness: isPondSurface ? 0.06 : 0,
        emissive: emissiveColor,
        emissiveIntensity: isPondSurface ? 0.1 : 0
      });
      object.userData.externalAssetMaterialStyleRole = styleRole;
    });
    tagMaterialStyle(wrapper, styleRole);
    return;
  }

  if (spec.assetId?.startsWith("accepted-polyhaven-")) {
    return;
  }

  if (spec.assetId === "accepted-nature-water-core") {
    const isPlant = spec.preferredFile.startsWith("lily_");
    const materialColor = isPlant ? 0x5e8c52 : 0x827d6d;
    const styleRole = isPlant ? "water-plant" : "waterfall-rock";
    wrapper.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.material = new THREE.MeshStandardMaterial({
        color: materialColor,
        roughness: 0.86,
        metalness: 0
      });
      object.userData.externalAssetMaterialStyleRole = styleRole;
    });
    tagMaterialStyle(wrapper, styleRole);
    return;
  }

  if (spec.assetId === "accepted-nature-stone-bridge-core" || spec.assetId === "accepted-nature-bridge-core") {
    if (spec.assetId === "accepted-nature-bridge-core" && spec.preferredFile.startsWith("path_wood")) {
      wrapper.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }
        object.material = new THREE.MeshStandardMaterial({
          color: 0x7a5a39,
          roughness: 0.8,
          metalness: 0.01
        });
        object.userData.externalAssetMaterialStyleRole = "path-boardwalk";
      });
      tagMaterialStyle(wrapper, "path-boardwalk");
      return;
    }

    const isWood = spec.assetId === "accepted-nature-bridge-core" || spec.preferredFile.includes("wood");
    const styleRole = isWood ? "bridge-wood" : "bridge-stone";
    const materialColor = isWood ? 0x8f6f48 : 0x9a9382;
    wrapper.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.material = new THREE.MeshStandardMaterial({
        color: materialColor,
        roughness: isWood ? 0.74 : 0.82,
        metalness: 0.02
      });
      object.userData.externalAssetMaterialStyleRole = styleRole;
    });
    tagMaterialStyle(wrapper, styleRole);
    return;
  }

  if (spec.assetId === "accepted-train-rail-core") {
    wrapper.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.material = new THREE.MeshStandardMaterial({
        color: 0x8b7a5f,
        roughness: 0.62,
        metalness: 0.18
      });
      object.userData.externalAssetMaterialStyleRole = "rail-track";
    });
    tagMaterialStyle(wrapper, "rail-track");
    return;
  }

  if (spec.assetId === "accepted-nature-path-core") {
    const remapPathMaterial = (material: THREE.Material) => {
      const name = material.name.toLowerCase();
      if (name.includes("grass")) {
        return new THREE.MeshStandardMaterial({
          color: 0x314d37,
          roughness: 1,
          metalness: 0,
          transparent: true,
          opacity: 0,
          depthWrite: false
        });
      }
      const color = name.includes("dark") ? 0x3e342a : 0x755b44;
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.96,
        metalness: 0
      });
    };

    wrapper.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => remapPathMaterial(material))
        : remapPathMaterial(object.material);
      object.userData.externalAssetMaterialStyleRole = "path-earth";
    });
    tagMaterialStyle(wrapper, "path-earth");
    return;
  }

  if (spec.terrainRole !== "vegetation" && spec.terrainRole !== "relief") {
    return;
  }

  const materialColor = spec.terrainRole === "vegetation" ? 0x587f4b : 0x897f70;
  const styleRole = spec.terrainRole === "vegetation" ? "vegetation-natural" : "relief-stone";

  wrapper.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    object.material = new THREE.MeshStandardMaterial({
      color: materialColor,
      roughness: spec.terrainRole === "relief" ? 0.9 : 0.78,
      metalness: 0
    });
    object.userData.externalAssetMaterialStyleRole = styleRole;
  });
  tagMaterialStyle(wrapper, styleRole);
}

function tagMaterialStyle(wrapper: THREE.Object3D, styleRole: string) {
  wrapper.userData.externalAssetMaterialStyleRoles = [
    ...new Set([...(getObjectMaterialStyleRoles(wrapper) ?? []), styleRole])
  ];
}

function getObjectMaterialStyleRoles(object: THREE.Object3D) {
  const roles = new Set<string>();
  const directRoles = object.userData.externalAssetMaterialStyleRoles;
  if (Array.isArray(directRoles)) {
    for (const role of directRoles) {
      if (typeof role === "string") {
        roles.add(role);
      }
    }
  }
  object.traverse((child) => {
    const role = child.userData.externalAssetMaterialStyleRole;
    if (typeof role === "string") {
      roles.add(role);
    }
  });
  return [...roles].sort();
}

function getPublicWaterEdgeTexture() {
  if (publicWaterEdgeTexture) {
    return publicWaterEdgeTexture;
  }
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  publicWaterEdgeTexture = new THREE.TextureLoader().load(`${base}${publicWaterEdgeTexturePath}`);
  publicWaterEdgeTexture.colorSpace = THREE.SRGBColorSpace;
  publicWaterEdgeTexture.wrapS = THREE.RepeatWrapping;
  publicWaterEdgeTexture.wrapT = THREE.RepeatWrapping;
  publicWaterEdgeTexture.repeat.set(3.2, 3.2);
  publicWaterEdgeTexture.anisotropy = 4;
  return publicWaterEdgeTexture;
}

function alignObjectBottomToGroundClearance(wrapper: THREE.Object3D, spec: MapPlacementSpec) {
  wrapper.updateWorldMatrix(true, true);
  const terrain = sampleTerrain(new THREE.Vector3(spec.position[0], 0, spec.position[2]));
  const box = new THREE.Box3().setFromObject(wrapper);
  const actualClearance = box.min.y - terrain.height;
  wrapper.position.y += spec.groundClearance - actualClearance;
  wrapper.updateWorldMatrix(true, true);
}

function measureActualGroundClearance(wrapper: THREE.Object3D) {
  wrapper.updateWorldMatrix(true, true);
  const terrain = sampleTerrain(new THREE.Vector3(wrapper.position.x, 0, wrapper.position.z));
  const box = new THREE.Box3().setFromObject(wrapper);
  return Number((box.min.y - terrain.height).toFixed(3));
}

function createMapPlacementSpecs(): MapPlacementSpec[] {
  return [
    ...createRoutePlacementSpecs(),
    ...createRailPlacementSpecs(),
    ...createWaterPlacementSpecs(),
    ...createReliefPlacementSpecs(),
    ...createVegetationPlacementSpecs(),
    ...createHeroLocationPlacementSpecs()
  ];
}

function createCorePlacementSpecs(): MapPlacementSpec[] {
  const corePlacementIds = new Set([
    "route:studio-crossing-road-proof",
    "route:spine-contact-gate:bridge",
    "route:outer-north-canal-road",
    "route:outer-south-mail-road",
    "route:outer-east-art-edge",
    "water:tech-harbor",
    "water:studio-crossing-proof",
    "water:art-lagoon",
    "water:studio-canal",
    "water:east-material-pond",
    "relief:tech-ridge",
    "relief:studio-crossing-proof",
    "relief:art-mound",
    "relief:harbor-cut",
    "vegetation:studio-oak",
    "vegetation:studio-crossing-proof",
    "vegetation:tech-tree",
    "vegetation:art-palm",
    "vegetation:foundry-tree",
    "vegetation:north-tree",
    "vegetation:outer-east-reflection-palm",
    "hero:cloud-dock:control-machine",
    "hero:cloud-dock:pipe-spine",
    "hero:cloud-dock:rack-core",
    "hero:cloud-dock:cable-trunk",
    "hero:design-atelier:atelier-floor",
    "hero:design-atelier:cloth-line",
    "hero:design-atelier:cutting-table",
    "hero:design-atelier:fabric-crane",
    "hero:design-atelier:reference-screen",
    "hero:observability-tower:structure-window",
    "hero:observability-tower:metric-console",
    "hero:observability-tower:signal-pylon",
    "hero:observability-tower:screen-wall",
    "hero:observability-tower:data-pipe"
  ]);
  for (const placementId of manifest.corePromotion?.requiredPlacementIds ?? []) {
    corePlacementIds.add(placementId);
  }

  return createMapPlacementSpecs()
    .filter((spec) => corePlacementIds.has(spec.id))
    .map((spec) =>
      spec.curation === "context"
        ? {
            ...spec,
            curation: "support",
            promotionCandidate: true
          }
        : spec
    );
}

function createTerrainCorePlacementSpecs(): MapPlacementSpec[] {
  const terrainPlacementIds = new Set([
    "relief:studio-crossing-proof",
    "relief:studio-spine",
    "vegetation:studio-crossing-proof",
    "vegetation:studio-oak",
    "vegetation:studio-grass"
  ]);

  const curatedTerrain = createMapPlacementSpecs()
    .filter((spec) => terrainPlacementIds.has(spec.id))
    .map((spec) => ({
      ...spec,
      curation: spec.curation === "context" ? "support" : spec.curation,
      promotionCandidate: true
    }));

  return [
    ...curatedTerrain,
    createPlacement("terrain-core:rail-spine-a", "terrain-core:rail-spine", "route", "primary", true, "rail", "track-detailed.glb", [5.7, 0.2], 1.38, Math.PI * 0.5, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:rail-spine-b", "terrain-core:rail-spine", "route", "support", true, "rail", "track-single-detailed.glb", [7.15, 0.2], 1.28, Math.PI * 0.5, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:rail-spine-c", "terrain-core:rail-spine", "route", "support", true, "rail", "track-segment.glb", [8.6, 0.2], 1.16, Math.PI * 0.5, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:pond-basin", "terrain-core:central-water", "water", "primary", true, "water", "pond-2.glb", offsetTerrainCoreIntroSafe([-4.85, 3.05]), 3.35, -0.18, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:pond-secondary", "terrain-core:central-water-west", "water", "support", true, "water", "pond-1.glb", offsetTerrainCoreIntroSafe([-8.75, 4.8]), 2.4, 0.24, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:pond-rock-a", "terrain-core:central-water-west", "water", "support", true, "water", "rock-1a.glb", offsetTerrainCoreIntroSafe([-6.6, 6.3]), 0.78, 0.2, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:pond-rock-b", "terrain-core:central-water-east", "water", "support", true, "water", "rock-2a.glb", offsetTerrainCoreIntroSafe([-2.0, 4.0]), 0.72, -0.24, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:pond-cattail", "terrain-core:central-water-plants", "water", "support", true, "water", "cattail-1.glb", offsetTerrainCoreIntroSafe([-1.55, 5.15]), 0.7, -0.2, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:pond-hyacinth", "terrain-core:central-water-plants", "water", "support", true, "water", "water-hyacinth-1.glb", offsetTerrainCoreIntroSafe([-2.35, 4.65]), 0.54, 0.36, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:pond-lily-leaf", "terrain-core:central-water-plants", "water", "support", true, "water", "water-lily-leaf-1.glb", offsetTerrainCoreIntroSafe([-3.1, 5.35]), 0.46, -0.12, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:nature-lily-large", "terrain-core:central-water-plants", "water", "support", true, "water", "lily_large.glb", offsetTerrainCoreIntroSafe([-4.1, 5.95]), 0.48, 0.28, {
      assetId: "accepted-nature-water-core"
    }),
    createPlacement("terrain-core:nature-lily-small-bank", "terrain-core:central-water-east", "water", "support", true, "water", "lily_small.glb", offsetTerrainCoreIntroSafe([-1.15, 4.75]), 0.44, -0.32, {
      assetId: "accepted-nature-water-core"
    }),
    createPlacement("terrain-core:shore-waterfall-rock", "terrain-core:central-water-edge", "water", "support", true, "water", "cliff_waterfall_rock.glb", offsetTerrainCoreIntroSafe([-8.95, 5.95]), 0.74, 0.42, {
      assetId: "accepted-nature-water-core"
    }),
    createPlacement("terrain-core:bridge-crossing", "terrain-core:central-crossing", "route", "primary", true, "bridge", "bridge_stoneRoundNarrow.glb", offsetTerrainCoreIntroSafe([-2.5, 3.6]), 1.62, Math.PI * 0.42, {
      assetId: "accepted-nature-stone-bridge-core"
    }),
    createPlacement("terrain-core:bridge-bank", "terrain-core:central-crossing-bank", "water", "support", true, "bridge", "bridge_side_stone.glb", offsetTerrainCoreIntroSafe([-6.35, 3.4]), 1.08, Math.PI * 0.44, {
      assetId: "accepted-nature-stone-bridge-core"
    }),
    createPlacement("terrain-core:path-boardwalk-pond-a", "terrain-core:path-boardwalk-pond", "route", "support", true, "bridge", "path_wood.glb", [-0.4, 8.4], 1.65, Math.PI * 0.44, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.62
    }),
    createPlacement("terrain-core:path-boardwalk-pond-b", "terrain-core:path-boardwalk-pond", "route", "support", true, "bridge", "path_wood.glb", [1.2, 9.1], 1.55, Math.PI * 0.44, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.62
    }),
    createPlacement("terrain-core:path-boardwalk-pond-corner", "terrain-core:path-boardwalk-corner", "route", "support", true, "bridge", "path_woodCorner.glb", [2.6, 9.55], 1.45, Math.PI * 0.68, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.62
    }),
    createPlacement("terrain-core:path-boardwalk-ridge", "terrain-core:path-boardwalk-ridge", "route", "support", true, "bridge", "path_wood.glb", [4.6, 6.9], 1.45, -0.24, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.62
    }),
    createPlacement("terrain-core:relief-slope", "terrain-core:central-relief", "relief", "primary", true, "relief", "rock_largeE.glb", [4.8, 6.55], 1.2, -0.2),
    createPlacement("terrain-core:polyhaven-rock-shore", "terrain-core:premium-relief-shore", "relief", "support", true, "relief", "rock_09_1k.gltf", [-0.35, 7.85], 1.26, -0.16, {
      assetId: "accepted-polyhaven-rock-09-core"
    }),
    createPlacement("terrain-core:relief-top", "terrain-core:central-relief", "relief", "support", true, "relief", "rock_largeA.glb", [2.3, 7.6], 1.02, 0.16),
    createPlacement("terrain-core:relief-rock", "terrain-core:central-relief", "relief", "support", true, "relief", "rock_largeD.glb", [1.1, 6.6], 1.0, 0.32),
    createPlacement("terrain-core:relief-flat-east", "terrain-core:central-relief-east", "relief", "support", true, "relief", "rock_smallFlatC.glb", [9.65, 6.55], 0.92, 0.18),
    createPlacement("terrain-core:relief-steps-north", "terrain-core:central-relief", "relief", "support", true, "relief", "cliff_steps_rock.glb", [6.55, 8.45], 1.05, -0.34),
    createPlacement("terrain-core:relief-corner-east", "terrain-core:central-relief-east", "relief", "support", true, "relief", "cliff_corner_rock.glb", [12.15, 7.8], 0.94, 0.42),
    createPlacement("terrain-core:grass-left", "terrain-core:central-field-west", "vegetation", "support", true, "vegetation", "grass_leafsLarge.glb", [-8.8, 9.35], 1.08, 0.1),
    createPlacement("terrain-core:tree-left", "terrain-core:central-field", "vegetation", "primary", true, "vegetation", "tree_oak.glb", [-1.4, 11.1], 1.5, -0.16),
    createPlacement("terrain-core:tree-right", "terrain-core:central-field", "vegetation", "support", true, "vegetation", "tree_fat.glb", [7.1, 5.5], 1.34, 0.22),
    createPlacement("terrain-core:pine-right", "terrain-core:central-field-east", "vegetation", "support", true, "vegetation", "tree_pineTallA.glb", [10.35, 4.95], 1.22, -0.3),
    createPlacement("terrain-core:field-log", "terrain-core:central-field-west", "vegetation", "support", true, "vegetation", "log_stack.glb", [-0.2, 11.85], 0.92, -0.34),
    createPlacement("terrain-core:spawn-rock-flat", "terrain-core:spawn-clearing-east", "relief", "support", true, "relief", "rock_smallFlatC.glb", [9.9, 1.8], 0.9, -0.28),
    createPlacement("terrain-core:spawn-bush-west", "terrain-core:spawn-clearing-east", "vegetation", "support", true, "vegetation", "plant_bushDetailed.glb", [5.65, 2.75], 1.02, 0.16),
    createPlacement("terrain-core:spawn-grass-west", "terrain-core:spawn-clearing-west", "vegetation", "support", true, "vegetation", "grass_leafsLarge.glb", [4.85, 1.05], 0.9, 0.42),
    createPlacement("terrain-core:spawn-rock-east", "terrain-core:spawn-clearing-north", "relief", "support", true, "relief", "rock_largeE.glb", [10.9, 4.25], 1.08, 0.24),
    createPlacement("terrain-core:spawn-stump-east", "terrain-core:spawn-clearing-north", "vegetation", "support", true, "vegetation", "stump_roundDetailed.glb", [8.45, 3.9], 0.78, -0.2),
    createPlacement("terrain-core:spawn-grass-east", "terrain-core:spawn-clearing-south", "vegetation", "support", true, "vegetation", "grass_large.glb", [7.75, 1.65], 0.92, 0.08),
    createPlacement("terrain-core:spawn-tree-ground", "terrain-core:spawn-clearing-west", "vegetation", "support", true, "vegetation", "tree_default.glb", [4.95, 5.05], 1.18, 0.22),
    createPlacement("terrain-core:pond-bank-log", "terrain-core:pond-bank", "vegetation", "support", true, "vegetation", "log.glb", offsetTerrainCoreIntroSafe([-8.0, 2.2]), 0.92, Math.PI * 0.34),
    createPlacement("terrain-core:pond-bank-bush", "terrain-core:pond-bank", "vegetation", "support", true, "vegetation", "plant_bushDetailed.glb", offsetTerrainCoreIntroSafe([-7.35, 7.05]), 0.82, -0.18),
    createPlacement("terrain-core:polyhaven-fern-bank", "terrain-core:premium-vegetation-bank", "vegetation", "support", true, "vegetation", "fern_02_1k.gltf", offsetTerrainCoreIntroSafe([-5.85, 8.2]), 0.82, 0.32, {
      assetId: "accepted-polyhaven-fern-core"
    }),
    createPlacement("terrain-core:pond-bank-rock", "terrain-core:pond-bank", "relief", "support", true, "relief", "rock_smallFlatC.glb", offsetTerrainCoreIntroSafe([-2.1, 1.25]), 0.76, 0.22),
    createPlacement("terrain-core:south-tree-detailed", "terrain-core:south-marker", "vegetation", "support", true, "vegetation", "tree_detailed.glb", [2.8, 9.25], 1.18, -0.1),
    createPlacement("terrain-core:south-grass", "terrain-core:south-marker", "vegetation", "support", true, "vegetation", "grass_large.glb", [0.8, 9.8], 0.88, 0.34),
    createPlacement("terrain-core:south-rock", "terrain-core:south-marker", "relief", "support", true, "relief", "rock_largeD.glb", [4.55, 8.85], 0.88, -0.36),
    createPlacement("terrain-core:north-bush", "terrain-core:north-marker", "vegetation", "support", true, "vegetation", "plant_bushLarge.glb", [10.6, 8.35], 0.98, 0.12),
    createPlacement("terrain-core:north-tree-detailed", "terrain-core:north-marker", "vegetation", "support", true, "vegetation", "tree_detailed.glb", [12.35, 6.4], 1.18, -0.22),
    createPlacement("terrain-core:north-rock", "terrain-core:north-marker", "relief", "support", true, "relief", "rock_largeE.glb", [12.1, 10.2], 0.86, 0.24),
    createPlacement("terrain-core:outer-rail-cloud-edge", "terrain-core:outer-rail-cloud", "route", "support", true, "rail", "track-segment.glb", [-28.2, -18.2], 1.1, -0.16, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:outer-rail-art-edge", "terrain-core:outer-rail-art", "route", "support", true, "rail", "track-rail.glb", [28.8, 18.0], 1.08, Math.PI * 0.68, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:outer-rail-north-marker", "terrain-core:outer-rail-north", "route", "support", true, "rail", "track.glb", [1.8, 39.8], 1.06, Math.PI * 0.12, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:outer-water-west-pond", "terrain-core:outer-water-west", "water", "support", true, "water", "pond-3.glb", [-37.2, 30.4], 2.15, 0.22, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:outer-water-west-cattail", "terrain-core:outer-water-west", "water", "support", true, "water", "cattail-1.glb", [-35.8, 32.0], 0.66, -0.34, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:outer-water-west-lily", "terrain-core:outer-water-west", "water", "support", true, "water", "water-lily-leaf-1.glb", [-38.4, 31.35], 0.46, 0.12, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:outer-water-east-pond", "terrain-core:outer-water-east", "water", "support", true, "water", "pond-4.glb", [36.8, -35.2], 2.0, -0.18, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:outer-water-east-hyacinth", "terrain-core:outer-water-east", "water", "support", true, "water", "water-hyacinth-1.glb", [38.2, -33.8], 0.54, 0.28, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:far-west-waterfall-rock", "terrain-core:far-west-water", "water", "support", true, "water", "cliff_waterfall_rock.glb", [-43.6, -7.8], 1.12, Math.PI * 0.5, {
      assetId: "accepted-nature-water-core"
    }),
    createPlacement("terrain-core:far-east-lily-marker", "terrain-core:far-east-water", "water", "support", true, "water", "lily_small.glb", [43.2, 13.5], 0.92, -0.2, {
      assetId: "accepted-nature-water-core"
    }),
    createPlacement("terrain-core:outer-bridge-west-crossing", "terrain-core:outer-bridge-west", "route", "support", true, "bridge", "bridge_wood.glb", [-35.4, 28.4], 1.4, Math.PI * 0.38, {
      assetId: "accepted-nature-bridge-core"
    }),
    createPlacement("terrain-core:outer-bridge-east-crossing", "terrain-core:outer-bridge-east", "route", "support", true, "bridge", "bridge_woodNarrow.glb", [34.6, -33.4], 1.28, Math.PI * 0.6, {
      assetId: "accepted-nature-bridge-core"
    }),
    createPlacement("terrain-core:shoreline-bridge-center", "terrain-core:shoreline-bridge-visible", "route", "support", true, "bridge", "bridge_center_wood.glb", [7.05, 8.25], 1.0, Math.PI * 0.36, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.56
    }),
    createPlacement("terrain-core:shoreline-bridge-side", "terrain-core:shoreline-bridge-visible", "route", "support", true, "bridge", "bridge_side_wood.glb", [8.45, 8.05], 0.92, Math.PI * 0.36, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.56
    }),
    createPlacement("terrain-core:far-north-relief-half", "terrain-core:far-north-relief", "relief", "support", true, "relief", "cliff_half_rock.glb", [-6.6, 44.4], 1.18, -0.1, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:far-south-relief-large", "terrain-core:far-south-relief", "relief", "support", true, "relief", "rock_largeC.glb", [7.8, -44.0], 1.16, 0.14, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:far-west-relief-corner", "terrain-core:far-west-relief", "relief", "support", true, "relief", "cliff_corner_rock.glb", [-44.2, -10.8], 1.14, 0.1, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:far-east-relief-slope", "terrain-core:far-east-relief", "relief", "support", true, "relief", "cliff_blockSlope_rock.glb", [44.2, 12.4], 1.16, -0.18, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:outer-east-relief-tall", "terrain-core:outer-east-relief", "relief", "support", true, "relief", "rock_tallA.glb", [36.4, 23.7], 1.18, -0.16, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:far-north-oak", "terrain-core:far-north-vegetation", "vegetation", "support", true, "vegetation", "tree_oak.glb", [-2.8, 43.6], 1.22, -0.18, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:far-south-grass", "terrain-core:far-south-vegetation", "vegetation", "support", true, "vegetation", "grass_large.glb", [12.4, -43.4], 1.14, 0.12, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-west-bush", "terrain-core:outer-west-vegetation", "vegetation", "support", true, "vegetation", "plant_bushLarge.glb", [-35.8, -24.4], 1.1, -0.1, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-east-palm", "terrain-core:outer-east-vegetation", "vegetation", "support", true, "vegetation", "tree_palm.glb", [35.6, 27.6], 1.22, 0.32, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-south-log", "terrain-core:outer-south-vegetation", "vegetation", "support", true, "vegetation", "log.glb", [-21.4, -35.6], 1.0, Math.PI * 0.24, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-north-tree-detailed", "terrain-core:outer-north-vegetation", "vegetation", "support", true, "vegetation", "tree_detailed.glb", [18.8, 35.7], 1.2, -0.28, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-west-fern", "terrain-core:outer-west-vegetation", "vegetation", "support", true, "vegetation", "fern_02_1k.gltf", [-33.4, -22.4], 0.76, 0.18, {
      assetId: "accepted-polyhaven-fern-core"
    }),
    createPlacement("terrain-core:shore-cliff-top", "terrain-core:shore-relief-east", "relief", "support", true, "relief", "cliff_top_rock.glb", [24.8, 16.4], 1.04, -0.22, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:shore-cave-rock", "terrain-core:shore-relief-west", "relief", "support", true, "relief", "cliff_blockCave_rock.glb", [-25.8, 17.2], 1.0, 0.18, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:shore-waterfall-top", "terrain-core:shore-relief-waterfall", "relief", "support", true, "relief", "cliff_waterfallTop_rock.glb", [30.4, -18.6], 0.98, Math.PI * 0.56, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:ridge-tall-rock", "terrain-core:shore-relief-ridge", "relief", "support", true, "relief", "rock_tallH.glb", [22.2, -26.8], 1.02, -0.12, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:shoreline-boulder-west", "terrain-core:shoreline-relief-visible", "relief", "support", true, "relief", "rock_largeA.glb", [2.85, 6.35], 0.92, -0.22, {
      assetId: "accepted-nature-relief-core",
      groundClearance: 0.32
    }),
    createPlacement("terrain-core:shoreline-boulder-east", "terrain-core:shoreline-relief-visible", "relief", "support", true, "relief", "rock_largeD.glb", [5.25, 6.65], 0.88, 0.34, {
      assetId: "accepted-nature-relief-core",
      groundClearance: 0.32
    }),
    createPlacement("terrain-core:shoreline-flat-stone", "terrain-core:shoreline-relief-visible", "relief", "support", true, "relief", "rock_smallFlatC.glb", [6.75, 7.45], 0.86, -0.28, {
      assetId: "accepted-nature-relief-core",
      groundClearance: 0.32
    }),
    createPlacement("terrain-core:shoreline-boulder-anchor", "terrain-core:shoreline-relief-visible", "relief", "support", true, "relief", "rock_largeA.glb", [8.25, 6.35], 0.82, 0.18, {
      assetId: "accepted-nature-relief-core",
      groundClearance: 0.32
    }),
    createPlacement("terrain-core:pine-ground-south", "terrain-core:pine-vegetation-south", "vegetation", "support", true, "vegetation", "tree_pineGroundA.glb", [18.4, -32.6], 1.12, 0.2, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:pine-round-east", "terrain-core:pine-vegetation-east", "vegetation", "support", true, "vegetation", "tree_pineRoundC.glb", [31.2, 5.8], 1.08, -0.26, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:field-flower-edge", "terrain-core:flower-vegetation-edge", "vegetation", "support", true, "vegetation", "flower_yellowA.glb", [-18.6, 21.8], 0.74, 0.14, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:ridge-hanging-moss", "terrain-core:moss-vegetation-ridge", "vegetation", "support", true, "vegetation", "hanging_moss.glb", [25.8, 24.4], 0.82, -0.18, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-north-oak-secondary", "terrain-core:outer-north-grove-a", "vegetation", "support", true, "vegetation", "tree_oak.glb", [-9.4, 41.2], 1.08, 0.2, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-north-flat-rock", "terrain-core:outer-north-relief-a", "relief", "support", true, "relief", "rock_smallFlatC.glb", [-4.4, 39.2], 0.84, -0.34, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:outer-north-flower-edge", "terrain-core:outer-north-meadow-a", "vegetation", "support", true, "vegetation", "flower_yellowA.glb", [-0.6, 36.7], 0.7, 0.18, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-north-rail-side", "terrain-core:outer-north-rail-side", "route", "support", true, "rail", "track-rail.glb", [5.8, 39.0], 1.0, Math.PI * 0.1, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:outer-south-pine-pair", "terrain-core:outer-south-grove-a", "vegetation", "support", true, "vegetation", "tree_pineGroundA.glb", [15.8, -41.0], 1.02, -0.2, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-south-log-fallen", "terrain-core:outer-south-deadwood-a", "vegetation", "support", true, "vegetation", "log.glb", [9.6, -39.7], 0.92, Math.PI * 0.28, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-south-boulder", "terrain-core:outer-south-relief-a", "relief", "support", true, "relief", "rock_largeD.glb", [5.1, -40.6], 0.88, 0.28, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:outer-south-grass-line", "terrain-core:outer-south-meadow-a", "vegetation", "support", true, "vegetation", "grass_large.glb", [13.2, -38.2], 0.92, -0.12, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-west-bank-rock", "terrain-core:outer-west-bank-a", "relief", "support", true, "relief", "rock_largeA.glb", [-39.6, 28.4], 0.86, -0.2, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:outer-west-bank-tree", "terrain-core:outer-west-grove-a", "vegetation", "support", true, "vegetation", "tree_detailed.glb", [-33.0, 29.2], 1.08, 0.24, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-west-boardwalk-side", "terrain-core:outer-west-boardwalk-a", "route", "support", true, "bridge", "path_wood.glb", [-36.8, 26.8], 1.12, Math.PI * 0.42, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.58
    }),
    createPlacement("terrain-core:outer-west-lily-large", "terrain-core:outer-west-water-a", "water", "support", true, "water", "lily_large.glb", [-38.5, 29.7], 0.5, -0.14, {
      assetId: "accepted-nature-water-core"
    }),
    createPlacement("terrain-core:outer-east-bank-rock", "terrain-core:outer-east-bank-a", "relief", "support", true, "relief", "rock_largeE.glb", [39.0, -36.4], 0.88, 0.18, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:outer-east-bank-palm", "terrain-core:outer-east-grove-a", "vegetation", "support", true, "vegetation", "tree_palm.glb", [33.0, -36.5], 1.08, -0.24, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-east-bridge-side", "terrain-core:outer-east-boardwalk-a", "route", "support", true, "bridge", "bridge_side_wood.glb", [35.8, -31.8], 0.86, Math.PI * 0.6, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.56
    }),
    createPlacement("terrain-core:outer-east-lily-small", "terrain-core:outer-east-water-a", "water", "support", true, "water", "lily_small.glb", [37.2, -36.9], 0.48, 0.24, {
      assetId: "accepted-nature-water-core"
    }),
    createPlacement("terrain-core:corner-northwest-pond", "terrain-core:corner-northwest-water", "water", "support", true, "water", "pond-1.glb", [-43.0, 39.4], 1.62, -0.2, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:corner-northwest-cattail", "terrain-core:corner-northwest-water", "water", "support", true, "water", "cattail-1.glb", [-41.6, 40.5], 0.58, 0.18, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("terrain-core:corner-northeast-pine", "terrain-core:corner-northeast-grove", "vegetation", "support", true, "vegetation", "tree_pineTallA.glb", [41.2, 39.8], 1.08, -0.24, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:corner-northeast-boulder", "terrain-core:corner-northeast-relief", "relief", "support", true, "relief", "rock_largeC.glb", [43.6, 37.5], 0.86, 0.28, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:corner-southwest-grass", "terrain-core:corner-southwest-meadow", "vegetation", "support", true, "vegetation", "grass_leafsLarge.glb", [-42.4, -40.8], 0.92, -0.16, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:corner-southwest-log-stack", "terrain-core:corner-southwest-deadwood", "vegetation", "support", true, "vegetation", "log_stack.glb", [-39.8, -42.6], 0.76, Math.PI * 0.32, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:corner-southeast-tall-rock", "terrain-core:corner-southeast-relief", "relief", "support", true, "relief", "rock_tallH.glb", [42.6, -41.4], 0.86, -0.14, {
      assetId: "accepted-nature-relief-core"
    }),
    createPlacement("terrain-core:corner-southeast-bush", "terrain-core:corner-southeast-shrub", "vegetation", "support", true, "vegetation", "plant_bushDetailed.glb", [39.8, -42.4], 0.84, 0.18, {
      assetId: "accepted-nature-vegetation-core"
    }),
    createPlacement("terrain-core:outer-loop-north-boardwalk-a", "terrain-core:outer-loop-north-boardwalk", "route", "support", true, "bridge", "path_wood.glb", [-17.8, 36.4], 1.08, Math.PI * 0.18, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.58
    }),
    createPlacement("terrain-core:outer-loop-north-boardwalk-b", "terrain-core:outer-loop-north-boardwalk", "route", "support", true, "bridge", "path_wood.glb", [-15.9, 36.9], 1.04, Math.PI * 0.18, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.58
    }),
    createPlacement("terrain-core:outer-loop-west-rail-a", "terrain-core:outer-loop-west-rail", "route", "support", true, "rail", "track-detailed.glb", [-41.2, 5.8], 1.02, Math.PI * 0.54, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:outer-loop-west-rail-b", "terrain-core:outer-loop-west-rail", "route", "support", true, "rail", "track-single-detailed.glb", [-40.2, 7.05], 0.98, Math.PI * 0.54, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:outer-loop-south-boardwalk-a", "terrain-core:outer-loop-south-boardwalk", "route", "support", true, "bridge", "bridge_center_wood.glb", [-25.2, -36.6], 0.98, Math.PI * 0.68, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.56
    }),
    createPlacement("terrain-core:outer-loop-south-boardwalk-b", "terrain-core:outer-loop-south-boardwalk", "route", "support", true, "bridge", "bridge_side_wood.glb", [-23.85, -37.35], 0.88, Math.PI * 0.68, {
      assetId: "accepted-nature-bridge-core",
      groundClearance: 0.56
    }),
    createPlacement("terrain-core:outer-loop-east-rail-a", "terrain-core:outer-loop-east-rail", "route", "support", true, "rail", "track-rail.glb", [40.6, 2.4], 1.0, -0.22, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("terrain-core:outer-loop-east-rail-b", "terrain-core:outer-loop-east-rail", "route", "support", true, "rail", "track-segment.glb", [42.2, 1.95], 0.96, -0.22, {
      assetId: "accepted-train-rail-core"
    })
  ];
}

function createRailPlacementSpecs(): MapPlacementSpec[] {
  return [
    createPlacement("rail:studio-spine:detailed", "rail:studio-spine", "route", "support", true, "rail", "track-detailed.glb", [5.7, 0.2], 1.24, Math.PI * 0.5, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("rail:studio-spine:single", "rail:studio-spine", "route", "support", true, "rail", "track-single-detailed.glb", [7.0, 0.2], 1.18, Math.PI * 0.5, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("rail:cloud-edge:segment", "rail:cloud-edge", "route", "context", false, "rail", "track-segment.glb", [-28.2, -18.2], 1.1, -0.16, {
      assetId: "accepted-train-rail-core"
    }),
    createPlacement("rail:art-edge:curve-proof", "rail:art-edge", "route", "context", false, "rail", "track-rail.glb", [28.8, 18.0], 1.08, Math.PI * 0.68, {
      assetId: "accepted-train-rail-core"
    })
  ];
}

function createRoutePlacementSpecs(): MapPlacementSpec[] {
  const roadFiles = ["road-straight.glb", "road-curve.glb", "road-intersection.glb", "road-roundabout.glb", "road-split.glb"];
  const edgeFiles = ["light-square.glb", "light-curved.glb", "bridge-pillar.glb", "tile-slant.glb"];
  const bridgeFiles = ["bridge_wood.glb", "path_wood.glb"];

  return [
    ...worldRoutes.flatMap((route, index) => {
      const from = zoneById.get(route.from);
      const to = zoneById.get(route.to);
      if (!from || !to) {
        return [];
      }
      const points = [
        new THREE.Vector2(from.position[0], from.position[1]),
        ...(route.via ?? []).map(([x, z]) => new THREE.Vector2(x, z)),
        new THREE.Vector2(to.position[0], to.position[1])
      ];
      const sample = samplePolyline(points, 0.5);
      const side = index % 2 === 0 ? 1 : -1;
      return [
        createPlacement(`route:${route.id}:road`, `route:${route.id}`, "route", "primary", true, "road", roadFiles[index % roadFiles.length], [sample.x, sample.z], 1.36, sample.angle),
        createPlacement(
          `route:${route.id}:edge`,
          `route:${route.id}`,
          "route",
          "support",
          index % 2 === 0,
          "route-edge",
          edgeFiles[index % edgeFiles.length],
          [sample.x + Math.cos(sample.angle) * side * 0.72, sample.z - Math.sin(sample.angle) * side * 0.72],
          0.74,
          sample.angle + Math.PI * 0.5
        ),
        ...(index % 3 === 0
          ? [
              createPlacement(
                `route:${route.id}:bridge`,
                `route:${route.id}`,
                "route",
                "primary",
                true,
                "bridge",
                bridgeFiles[index % bridgeFiles.length],
                [sample.x - Math.cos(sample.angle) * side * 0.52, sample.z + Math.sin(sample.angle) * side * 0.52],
                1.48,
                sample.angle + Math.PI * 0.5
              )
            ]
          : [])
      ];
    }),
    createPlacement(
      "route:studio-crossing-road-proof",
      "route:studio-crossing-road-proof",
      "route",
      "primary",
      true,
      "road",
      "road-straight.glb",
      [0.6, 4.8],
      1.42,
      -0.18
    ),
    createPlacement(
      "route:outer-north-canal-road",
      "route:outer-north-shell",
      "route",
      "support",
      true,
      "road",
      "road-curve.glb",
      [-5.0, 42.8],
      1.38,
      -0.12
    ),
    createPlacement(
      "route:outer-south-mail-road",
      "route:outer-south-shell",
      "route",
      "support",
      true,
      "road",
      "road-split.glb",
      [8.2, -42.2],
      1.36,
      0.16
    ),
    createPlacement(
      "route:outer-west-cloud-edge",
      "route:outer-west-shell",
      "route",
      "support",
      true,
      "route-edge",
      "light-curved.glb",
      [-42.0, -10.4],
      1.16,
      Math.PI * 0.5
    ),
    createPlacement(
      "route:outer-east-art-edge",
      "route:outer-east-shell",
      "route",
      "support",
      true,
      "route-edge",
      "light-square.glb",
      [42.2, 12.2],
      1.12,
      -Math.PI * 0.5
    ),
    createPlacement(
      "route:north-crossroad-utilization",
      "route:north-crossroad-utilization",
      "route",
      "context",
      false,
      "road",
      "road-crossroad.glb",
      [-1.4, 34.8],
      1.24,
      0.06
    ),
    createPlacement(
      "route:south-end-utilization",
      "route:south-end-utilization",
      "route",
      "context",
      false,
      "road",
      "road-end.glb",
      [-2.8, -43.2],
      1.18,
      Math.PI
    ),
    createPlacement(
      "route:east-half-road-utilization",
      "route:east-half-road-utilization",
      "route",
      "context",
      false,
      "road",
      "road-straight-half.glb",
      [42.6, -1.6],
      1.16,
      Math.PI * 0.5
    ),
    createPlacement(
      "bridge:far-north-canal-narrow",
      "bridge:far-north-canal-narrow",
      "water",
      "context",
      false,
      "bridge",
      "bridge_woodNarrow.glb",
      [-5.4, 42.4],
      1.22,
      -0.1
    ),
    createPlacement(
      "bridge:far-west-cloud-side",
      "bridge:far-west-cloud-side",
      "water",
      "context",
      false,
      "bridge",
      "bridge_side_wood.glb",
      [-42.4, -8.6],
      1.16,
      Math.PI * 0.5
    ),
    createPlacement(
      "bridge:far-east-art-center",
      "bridge:far-east-art-center",
      "water",
      "context",
      false,
      "bridge",
      "bridge_center_wood.glb",
      [42.4, 10.4],
      1.16,
      -Math.PI * 0.5
    ),
    createPlacement(
      "terrain:bridge-wood:cloud-harbor",
      "terrain-transition:cloud-harbor",
      "route",
      "support",
      true,
      "bridge",
      "bridge_wood.glb",
      [-9.2, -28.1],
      1.66,
      Math.PI * 0.42,
      { assetId: "accepted-nature-bridge-core" }
    ),
    createPlacement(
      "terrain:bridge-narrow:values-approach",
      "terrain-transition:values-approach",
      "route",
      "support",
      true,
      "bridge",
      "bridge_woodNarrow.glb",
      [3.4, 31.8],
      1.52,
      Math.PI * 0.08,
      { assetId: "accepted-nature-bridge-core" }
    ),
    createPlacement(
      "terrain:path-natural:studio-entry",
      "terrain-transition:natural-path",
      "route",
      "context",
      false,
      "road",
      "ground_pathStraight.glb",
      [11.6, -11.8],
      1.2,
      -0.18,
      { assetId: "accepted-nature-path-core" }
    ),
    createPlacement(
      "terrain:bridge-stone:pond-crossing",
      "terrain-transition:pond-crossing",
      "water",
      "context",
      false,
      "bridge",
      "bridge_stoneNarrow.glb",
      [-8.4, 6.8],
      1.24,
      Math.PI * 0.34,
      { assetId: "accepted-nature-stone-bridge-core" }
    )
  ];
}

function createWaterPlacementSpecs(): MapPlacementSpec[] {
  const files = ["ground_riverStraight.glb", "ground_riverBend.glb", "ground_riverRocks.glb", "lily_large.glb", "ground_riverCorner.glb", "ground_riverSplit.glb"];
  return [
    ...worldMaterialRegions.water.map((region, index) =>
      createPlacement(`water:${region.id}`, `water:${region.id}`, "water", index >= 8 ? "context" : index >= 4 ? "support" : index === 3 ? "support" : "primary", true, "water", files[index % files.length], region.center, index >= 8 ? 1.18 : index >= 4 ? 1.08 : index === 3 ? 1.12 : 1.74, region.rotation)
    ),
    createPlacement("water:assetquest-pond:studio-basin", "water:assetquest-pond", "water", "context", false, "water", "pond-2.glb", [-8.0, 7.4], 2.25, -0.18, {
      assetId: "accepted-assetquest-pond-water-core"
    }),
    createPlacement("water:studio-crossing-proof", "water:studio-crossing-proof", "water", "support", true, "water", "ground_riverStraight.glb", [-0.8, 5.9], 1.46, -0.18),
    createPlacement("water:far-west-waterfall-utilization", "water:far-west-waterfall-utilization", "water", "context", false, "water", "cliff_waterfall_rock.glb", [-43.6, -7.8], 1.12, Math.PI * 0.5),
    createPlacement("water:far-east-lily-utilization", "water:far-east-lily-utilization", "water", "context", false, "water", "lily_small.glb", [43.2, 13.5], 0.92, -0.2),
    createPlacement("terrain:bridge-side:cloud-runoff", "terrain-transition:cloud-runoff", "water", "support", true, "bridge", "bridge_side_wood.glb", [-15.4, -27.6], 1.46, Math.PI * 0.36, {
      assetId: "accepted-nature-bridge-core"
    })
  ];
}

function createReliefPlacementSpecs(): MapPlacementSpec[] {
  return [
    createPlacement("relief:tech-ridge", "relief:tech-ridge", "relief", "primary", true, "relief", "cliff_blockSlope_rock.glb", [-24.6, 2.8], 1.62, -0.2),
    createPlacement("relief:harbor-cut", "relief:harbor-cut", "relief", "primary", true, "relief", "cliff_corner_rock.glb", [-19.2, -29.1], 1.44, 0.42),
    createPlacement("relief:art-mound", "relief:art-mound", "relief", "support", true, "relief", "rock_largeC.glb", [23.8, 8.0], 1.28, -0.32),
    createPlacement("relief:studio-spine", "relief:studio-spine", "relief", "support", true, "relief", "cliff_steps_rock.glb", [-2.2, 24.8], 1.34, 0.08),
    createPlacement("relief:north-field", "relief:north-field", "relief", "context", false, "relief", "rock_largeA.glb", [10.8, 31.8], 1.22, -0.18),
    createPlacement("relief:south-field", "relief:south-field", "relief", "context", false, "relief", "rock_tallA.glb", [-10.5, -31.9], 1.3, 0.26),
    createPlacement("relief:west-cut", "relief:west-cut", "relief", "context", false, "relief", "rock_largeA.glb", [-31.8, 10.2], 1.16, 0.14),
    createPlacement("relief:east-shelf", "relief:east-shelf", "relief", "context", false, "relief", "cliff_half_rock.glb", [31.2, 13.4], 1.18, -0.26),
    createPlacement("relief:north-terrace", "relief:north-terrace", "relief", "context", false, "relief", "cliff_corner_rock.glb", [4.6, 32.2], 1.16, 0.16),
    createPlacement("relief:west-cloud-basin", "relief:west-cloud-basin", "relief", "context", false, "relief", "rock_largeC.glb", [-32.4, -17.8], 1.14, -0.22),
    createPlacement("relief:east-atelier-plain", "relief:east-atelier-plain", "relief", "context", false, "relief", "cliff_blockSlope_rock.glb", [32.0, -11.4], 1.16, 0.34),
    createPlacement("relief:outer-north-gallery", "relief:outer-north-gallery", "relief", "context", false, "relief", "cliff_half_rock.glb", [14.9, 36.4], 1.18, -0.18),
    createPlacement("relief:outer-south-runoff-cut", "relief:outer-south-runoff-cut", "relief", "context", false, "relief", "rock_largeA.glb", [-18.7, -36.2], 1.16, 0.18),
    createPlacement("relief:outer-west-cloud-shelf", "relief:outer-west-cloud-shelf", "relief", "context", false, "relief", "cliff_corner_rock.glb", [-36.6, -20.8], 1.14, 0.08),
    createPlacement("relief:outer-east-art-shelf", "relief:outer-east-art-shelf", "relief", "context", false, "relief", "rock_tallA.glb", [36.4, 23.7], 1.18, -0.16),
    createPlacement("relief:far-north-values-canal", "relief:far-north-shell", "relief", "context", false, "relief", "cliff_half_rock.glb", [-6.6, 44.4], 1.18, -0.1),
    createPlacement("relief:far-south-contact-runoff", "relief:far-south-shell", "relief", "context", false, "relief", "rock_largeC.glb", [7.8, -44.0], 1.16, 0.14),
    createPlacement("relief:far-west-cloud-marsh", "relief:far-west-shell", "relief", "context", false, "relief", "cliff_corner_rock.glb", [-44.2, -10.8], 1.14, 0.1),
    createPlacement("relief:far-east-art-gallery", "relief:far-east-shell", "relief", "context", false, "relief", "cliff_blockSlope_rock.glb", [44.2, 12.4], 1.16, -0.18),
    createPlacement("relief:far-north-block-utilization", "relief:far-north-block-utilization", "relief", "context", false, "relief", "cliff_block_rock.glb", [-2.6, 44.8], 1.12, 0.2),
    createPlacement("relief:studio-crossing-proof", "relief:studio-crossing-proof", "relief", "support", true, "relief", "rock_largeC.glb", [2.8, 6.5], 1.18, -0.12),
    createPlacement("terrain:path-corner:design-shelf", "terrain-transition:design-shelf", "relief", "support", true, "bridge", "path_woodCorner.glb", [25.6, -6.8], 1.34, -0.28, {
      assetId: "accepted-nature-bridge-core"
    })
  ];
}

function createVegetationPlacementSpecs(): MapPlacementSpec[] {
  return [
    createPlacement("vegetation:tech-tree", "vegetation:tech-west", "vegetation", "support", true, "vegetation", "tree_pineTallA.glb", [-27.4, -10.8], 1.36, 0.1),
    createPlacement("vegetation:tech-bush", "vegetation:tech-west", "vegetation", "context", false, "vegetation", "plant_bush.glb", [-31.2, 4.8], 1.12, -0.24),
    createPlacement("vegetation:studio-oak", "vegetation:studio-north", "vegetation", "support", true, "vegetation", "tree_oak.glb", [5.8, 27.4], 1.65, -0.22),
    createPlacement("vegetation:studio-grass", "vegetation:studio-north", "vegetation", "context", false, "vegetation", "grass.glb", [-5.8, 31.4], 1.08, 0.1),
    createPlacement("vegetation:art-palm", "vegetation:art-east", "vegetation", "support", true, "vegetation", "tree_palm.glb", [28.4, -17.8], 1.55, 0.34),
    createPlacement("vegetation:art-flower", "vegetation:art-east", "vegetation", "context", false, "vegetation", "flower_yellowA.glb", [31.2, -5.4], 1.05, -0.16),
    createPlacement("vegetation:foundry-bush", "vegetation:foundry", "vegetation", "context", false, "vegetation", "plant_bushLarge.glb", [29.6, 7.6], 1.24, -0.38),
    createPlacement("vegetation:foundry-tree", "vegetation:foundry", "vegetation", "support", true, "vegetation", "tree_default.glb", [32.0, 14.8], 1.46, 0.28),
    createPlacement("vegetation:contact-grass", "vegetation:contact-south", "vegetation", "context", false, "vegetation", "grass_large.glb", [-4.8, -30.4], 1.18, 0.16),
    createPlacement("vegetation:contact-bush", "vegetation:contact-south", "vegetation", "context", false, "vegetation", "plant_bush.glb", [6.2, -32.2], 1.1, -0.12),
    createPlacement("vegetation:north-tree", "vegetation:north-field", "vegetation", "context", false, "vegetation", "tree_fat.glb", [-16.8, 32.0], 1.42, 0.24),
    createPlacement("vegetation:south-tree", "vegetation:south-field", "vegetation", "context", false, "vegetation", "tree_default.glb", [16.6, -32.0], 1.42, -0.18),
    createPlacement("vegetation:west-field", "vegetation:west-field", "vegetation", "context", false, "vegetation", "tree_detailed.glb", [-32.0, -22.0], 1.26, 0.18),
    createPlacement("vegetation:east-field", "vegetation:east-field", "vegetation", "context", false, "vegetation", "plant_bushLarge.glb", [32.0, 25.6], 1.2, -0.2),
    createPlacement("vegetation:west-marsh", "vegetation:west-marsh", "vegetation", "context", false, "vegetation", "grass_large.glb", [-32.3, -3.4], 1.08, 0.12),
    createPlacement("vegetation:east-pond", "vegetation:east-pond", "vegetation", "context", false, "vegetation", "flower_yellowA.glb", [32.2, 18.4], 1.04, -0.12),
    createPlacement("vegetation:north-terrace", "vegetation:north-terrace", "vegetation", "context", false, "vegetation", "tree_fat.glb", [3.2, 32.4], 1.28, 0.2),
    createPlacement("vegetation:south-mail-edge", "vegetation:south-mail-edge", "vegetation", "context", false, "vegetation", "plant_bushLarge.glb", [-13.8, -32.1], 1.12, -0.18),
    createPlacement("vegetation:outer-north-gallery-oak", "vegetation:outer-north-gallery", "vegetation", "context", false, "vegetation", "tree_oak.glb", [18.8, 35.7], 1.24, -0.28),
    createPlacement("vegetation:outer-south-runoff-grass", "vegetation:outer-south-runoff", "vegetation", "context", false, "vegetation", "grass_large.glb", [-21.4, -35.6], 1.16, 0.16),
    createPlacement("vegetation:outer-west-wetland-bush", "vegetation:outer-west-wetland", "vegetation", "context", false, "vegetation", "plant_bushLarge.glb", [-35.8, -24.4], 1.1, -0.1),
    createPlacement("vegetation:outer-east-reflection-palm", "vegetation:outer-east-reflection", "vegetation", "context", false, "vegetation", "tree_palm.glb", [35.6, 27.6], 1.22, 0.32),
    createPlacement("vegetation:far-north-values-oak", "vegetation:far-north-shell", "vegetation", "context", false, "vegetation", "tree_oak.glb", [-2.8, 43.6], 1.22, -0.18),
    createPlacement("vegetation:far-south-mail-grass", "vegetation:far-south-shell", "vegetation", "context", false, "vegetation", "grass_large.glb", [12.4, -43.4], 1.14, 0.12),
    createPlacement("vegetation:far-west-cloud-tree", "vegetation:far-west-shell", "vegetation", "context", false, "vegetation", "tree_pineGroundA.glb", [-43.4, -14.2], 1.22, 0.2),
    createPlacement("vegetation:far-east-art-palm", "vegetation:far-east-shell", "vegetation", "context", false, "vegetation", "tree_palm.glb", [43.2, 16.4], 1.26, -0.28),
    createPlacement("vegetation:studio-crossing-proof", "vegetation:studio-crossing-proof", "vegetation", "support", true, "vegetation", "tree_oak.glb", [-3.2, 6.8], 1.32, 0.14),
    createPlacement("terrain:bridge-center:design-entry", "terrain-transition:design-entry", "vegetation", "support", true, "bridge", "bridge_center_wood.glb", [14.2, -5.8], 1.66, Math.PI * 0.34, {
      assetId: "accepted-nature-bridge-core"
    }),
    createPlacement("terrain:path-wood:observability-field", "terrain-transition:observability-field", "vegetation", "support", true, "bridge", "path_wood.glb", [-27.6, 12.8], 1.28, 0.18, {
      assetId: "accepted-nature-bridge-core"
    })
  ];
}

function createHeroLocationPlacementSpecs(): MapPlacementSpec[] {
  return [
    createPlacement("hero:cloud-dock:control-machine", "hero:cloud-dock", "route", "primary", true, "hero-location", "machine.glb", [-11.95, -23.12], 1.9, -0.12, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "control-machine"
    }),
    createPlacement("hero:cloud-dock:pipe-spine", "hero:cloud-dock:signature-bridge", "route", "primary", true, "hero-location", "pipe-large-long.glb", [-10.85, -24.45], 1.82, Math.PI * 0.38, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "pipe-spine"
    }),
    createPlacement("hero:cloud-dock:screen-node", "hero:cloud-dock:energy-anchor", "route", "primary", true, "hero-location", "screen-panel-wide.glb", [-12.3, -24.85], 1.46, Math.PI * 0.16, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "screen-node"
    }),
    createPlacement("hero:cloud-dock:dock-floor", "hero:cloud-dock:server-pier", "route", "primary", true, "hero-location", "floor-large.glb", [-10.9, -25.7], 1.8, Math.PI * 0.44, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "dock-floor"
    }),
    createPlacement("hero:cloud-dock:structure-window", "hero:cloud-dock:infra-gateway", "route", "primary", true, "hero-location", "structure-window-wide.glb", [-12.95, -25.25], 1.62, Math.PI * 0.3, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "structure-window"
    }),
    createPlacement("hero:cloud-dock:server-pylon", "hero:cloud-dock", "route", "primary", true, "route-edge", "bridge-pillar.glb", [-11.1, -23.3], 1.8, 0.08, {
      heroLocation: "cloud-dock",
      heroRole: "server-pylon"
    }),
    createPlacement("hero:cloud-dock:electric-mast", "hero:cloud-dock", "route", "support", true, "route-edge", "light-curved.glb", [-9.8, -22.3], 1.25, -0.42, {
      heroLocation: "cloud-dock",
      heroRole: "electric-mast"
    }),
    createPlacement("hero:cloud-dock:platform-span", "hero:cloud-dock", "route", "support", true, "road", "road-bridge.glb", [-11.8, -24.4], 1.8, Math.PI * 0.42, {
      heroLocation: "cloud-dock",
      heroRole: "platform-span"
    }),
    createPlacement("hero:cloud-dock:rack-core", "hero:cloud-dock", "route", "primary", true, "hero-location", "machine-fortified.glb", [-12.6, -22.6], 1.72, -0.08, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "rack-core"
    }),
    createPlacement("hero:cloud-dock:cable-trunk", "hero:cloud-dock", "route", "support", true, "hero-location", "pipe-large-junction.glb", [-13.8, -23.75], 1.38, Math.PI * 0.25, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "cable-trunk"
    }),
    createPlacement("hero:cloud-dock:service-deck", "hero:cloud-dock", "route", "support", true, "hero-location", "catwalk-straight.glb", [-10.3, -25.25], 1.86, Math.PI * 0.42, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "service-deck"
    }),
    createPlacement("hero:cloud-dock:ops-screen", "hero:cloud-dock", "route", "support", true, "hero-location", "screen-panel-wide.glb", [-9.65, -23.58], 1.28, -0.62, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "ops-screen"
    }),
    createPlacement("hero:cloud-dock:data-conveyor", "hero:cloud-dock:data-conveyor", "route", "context", false, "hero-location", "conveyor-long.glb", [-14.55, -24.65], 1.18, Math.PI * 0.32, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "data-conveyor"
    }),
    createPlacement("hero:cloud-dock:connection-pipe", "hero:cloud-dock:connection-pipe", "route", "context", false, "hero-location", "machine-connection-pipe.glb", [-13.95, -25.35], 1.16, Math.PI * 0.2, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "cloud-dock",
      heroRole: "connection-pipe"
    }),
    createPlacement("hero:design-atelier:atelier-floor", "hero:design-atelier", "route", "primary", true, "hero-location", "floor-large.glb", [20.35, -9.05], 1.8, Math.PI * 0.58, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "design-atelier",
      heroRole: "atelier-floor"
    }),
    createPlacement("hero:design-atelier:cloth-line", "hero:design-atelier:drape-frame", "route", "primary", true, "hero-location", "conveyor-long-sides.glb", [21.95, -9.95], 1.42, Math.PI * 0.42, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "design-atelier",
      heroRole: "cloth-line"
    }),
    createPlacement("hero:design-atelier:sample-light", "hero:design-atelier:pattern-wall", "route", "primary", true, "route-edge", "light-square.glb", [22.35, -8.85], 1.24, Math.PI * 0.28, {
      heroLocation: "design-atelier",
      heroRole: "sample-light"
    }),
    createPlacement("hero:design-atelier:tool-bench", "hero:design-atelier:cutting-island", "route", "primary", true, "hero-location", "top-large.glb", [20.2, -10.25], 1.52, Math.PI * 0.46, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "design-atelier",
      heroRole: "tool-bench"
    }),
    createPlacement("hero:design-atelier:material-box", "hero:design-atelier:garment-loom", "route", "primary", true, "hero-location", "box-long.glb", [21.45, -10.95], 1.42, Math.PI * 0.52, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "design-atelier",
      heroRole: "material-box"
    }),
    createPlacement("hero:design-atelier:cutting-table", "hero:design-atelier", "route", "primary", true, "hero-location", "top-large-checkerboard.glb", [20.8, -9.4], 1.85, Math.PI * 0.5, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "design-atelier",
      heroRole: "cutting-table"
    }),
    createPlacement("hero:design-atelier:worktop", "hero:design-atelier", "route", "support", true, "hero-location", "top-large.glb", [19.35, -8.75], 1.5, Math.PI * 0.5, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "design-atelier",
      heroRole: "worktop"
    }),
    createPlacement("hero:design-atelier:pattern-corner", "hero:design-atelier", "route", "support", true, "bridge", "path_woodCorner.glb", [22.1, -8.4], 1.3, -0.14, {
      heroLocation: "design-atelier",
      heroRole: "pattern-corner"
    }),
    createPlacement("hero:design-atelier:swatch-marker", "hero:design-atelier", "vegetation", "support", true, "vegetation", "flower_yellowA.glb", [22.7, -10.0], 1.2, 0.28, {
      heroLocation: "design-atelier",
      heroRole: "swatch-marker"
    }),
    createPlacement("hero:design-atelier:swatch-crate", "hero:design-atelier", "route", "support", true, "hero-location", "box-wide.glb", [23.15, -8.95], 1.16, 0.12, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "design-atelier",
      heroRole: "swatch-crate"
    }),
    createPlacement("hero:design-atelier:reference-screen", "hero:design-atelier", "route", "support", true, "hero-location", "screen-flat.glb", [19.85, -10.55], 1.08, -0.7, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "design-atelier",
      heroRole: "reference-screen"
    }),
    createPlacement("hero:design-atelier:fabric-crane", "hero:design-atelier:fabric-crane", "route", "context", false, "hero-location", "crane.glb", [23.5, -10.65], 1.08, Math.PI * 0.44, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "design-atelier",
      heroRole: "fabric-crane"
    }),
    createPlacement("hero:observability-tower:structure-window", "hero:observability-tower", "route", "primary", true, "hero-location", "structure-window-wide.glb", [-22.95, 9.25], 1.68, 0.16, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "observability-tower",
      heroRole: "structure-window"
    }),
    createPlacement("hero:observability-tower:metric-console", "hero:observability-tower:screen-array", "route", "primary", true, "hero-location", "screen-panel-wide.glb", [-21.55, 8.35], 1.28, 0.36, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "observability-tower",
      heroRole: "metric-console"
    }),
    createPlacement("hero:observability-tower:tower-floor", "hero:observability-tower:trace-beacon", "route", "primary", true, "hero-location", "floor-large.glb", [-23.6, 10.45], 1.42, -0.28, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "observability-tower",
      heroRole: "tower-floor"
    }),
    createPlacement("hero:observability-tower:signal-pylon", "hero:observability-tower", "route", "primary", true, "route-edge", "bridge-pillar.glb", [-22.8, 9.8], 2.2, 0, {
      heroLocation: "observability-tower",
      heroRole: "signal-pylon"
    }),
    createPlacement("hero:observability-tower:beacon-light", "hero:observability-tower", "route", "support", true, "route-edge", "light-square.glb", [-21.6, 10.8], 1.0, 0.24, {
      heroLocation: "observability-tower",
      heroRole: "beacon-light"
    }),
    createPlacement("hero:observability-tower:radar-ring", "hero:observability-tower", "route", "support", true, "road", "road-roundabout.glb", [-23.9, 8.9], 1.7, 0.2, {
      heroLocation: "observability-tower",
      heroRole: "radar-ring"
    }),
    createPlacement("hero:observability-tower:screen-wall", "hero:observability-tower", "route", "primary", true, "hero-location", "screen-wide.glb", [-21.45, 9.25], 1.38, 0.44, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "observability-tower",
      heroRole: "screen-wall"
    }),
    createPlacement("hero:observability-tower:trace-panel", "hero:observability-tower", "route", "support", true, "hero-location", "screen-hanging-wide.glb", [-24.35, 10.15], 1.18, -0.18, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "observability-tower",
      heroRole: "trace-panel"
    }),
    createPlacement("hero:observability-tower:data-pipe", "hero:observability-tower", "route", "support", true, "hero-location", "pipe-glass-large-long.glb", [-23.25, 7.75], 1.42, Math.PI * 0.5, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "observability-tower",
      heroRole: "data-pipe"
    }),
    createPlacement("hero:observability-tower:service-platform", "hero:observability-tower", "route", "support", true, "hero-location", "catwalk-corner.glb", [-24.75, 8.35], 1.5, 0.2, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "observability-tower",
      heroRole: "service-platform"
    }),
    createPlacement("hero:observability-tower:machine-window", "hero:observability-tower:machine-window", "route", "context", false, "hero-location", "machine-window.glb", [-20.75, 10.05], 1.05, 0.42, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "observability-tower",
      heroRole: "machine-window"
    }),
    createPlacement("hero:observability-tower:structure-tall", "hero:observability-tower:structure-tall", "route", "context", false, "hero-location", "structure-tall.glb", [-24.95, 11.15], 1.12, -0.16, {
      assetId: "accepted-factory-industrial-core",
      heroLocation: "observability-tower",
      heroRole: "structure-tall"
    })
  ];
}

function createPlacement(
  id: string,
  clusterId: string,
  linkedKind: MapPlacementSpec["linkedKind"],
  curation: MapPlacementSpec["curation"],
  promotionCandidate: boolean,
  terrainRole: string,
  preferredFile: string,
  center: readonly [number, number],
  targetSize: number,
  rotationY = 0,
  options: Pick<MapPlacementSpec, "assetId" | "heroLocation" | "heroRole"> & { groundClearance?: number } = {}
): MapPlacementSpec {
  const terrain = sampleTerrain(new THREE.Vector3(center[0], 0, center[1]));
  const groundClearance = options.groundClearance ?? getRoleGroundClearance(terrainRole, curation);
  const { groundClearance: _groundClearance, ...placementOptions } = options;
  return {
    id,
    clusterId,
    linkedKind,
    curation,
    promotionCandidate,
    groundClearance,
    terrainRole,
    preferredFile,
    position: [center[0], terrain.height + groundClearance, center[1]],
    targetSize,
    rotationY,
    ...placementOptions
  };
}

function offsetTerrainCoreIntroSafe(center: readonly [number, number]): [number, number] {
  return [center[0] + introSafeTerrainOffset[0], center[1] + introSafeTerrainOffset[1]];
}

function getRoleGroundClearance(terrainRole: string, curation: MapPlacementSpec["curation"]) {
  const roleClearance: Record<string, number> = {
    road: 0.32,
    "route-edge": 0.36,
    bridge: 0.48,
    rail: 0.34,
    water: 0.22,
    relief: 0.3,
    vegetation: 0.34
  };
  const curationNudge = curation === "primary" ? 0.03 : curation === "support" ? 0.015 : 0;
  return Number(((roleClearance[terrainRole] ?? 0.28) + curationNudge).toFixed(3));
}

function samplePolyline(points: THREE.Vector2[], t: number) {
  const lengths = [];
  let total = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = points[index].distanceTo(points[index + 1]);
    lengths.push(length);
    total += length;
  }
  let remaining = total * t;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    if (remaining <= length || index === lengths.length - 1) {
      const from = points[index];
      const to = points[index + 1];
      const localT = length > 0 ? remaining / length : 0;
      const x = THREE.MathUtils.lerp(from.x, to.x, localT);
      const z = THREE.MathUtils.lerp(from.y, to.y, localT);
      const angle = Math.atan2(to.x - from.x, to.y - from.y);
      return { x, z, angle };
    }
    remaining -= length;
  }
  const fallback = points[0] ?? new THREE.Vector2();
  return { x: fallback.x, z: fallback.y, angle: 0 };
}

function createRuntimeAssetUrl(publicPath: string, fileName: string) {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return `${base}${publicPath.replace(/^\/+|\/+$/gu, "")}/${fileName}`;
}

function normalizePreviewObject(source: THREE.Object3D, spec: PreviewSpec) {
  const wrapper = new THREE.Group();
  const box = new THREE.Box3().setFromObject(source);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);

  const maxSize = Math.max(size.x, size.y, size.z, 0.001);
  const scale = spec.targetSize / maxSize;
  source.position.sub(center);

  wrapper.add(source);
  wrapper.scale.setScalar(scale);
  wrapper.rotation.y = spec.rotationY ?? 0;
  wrapper.position.set(spec.position[0], spec.position[1], spec.position[2]);
  return wrapper;
}
