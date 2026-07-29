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
    assetId: "accepted-itart-signature-premium-v93",
    terrainRole: "hero-location",
    preferredFile: "cloud-infra-gateway.glb",
    position: [-2.7, 0.28, 1.9],
    targetSize: 1.75,
    rotationY: -0.28
  },
  {
    assetId: "accepted-itart-signature-premium-v93",
    terrainRole: "hero-location",
    preferredFile: "atelier-garment-loom.glb",
    position: [0, 0.28, 1.9],
    targetSize: 1.7,
    rotationY: 0.18
  },
  {
    assetId: "accepted-itart-signature-premium-v93",
    terrainRole: "hero-location",
    preferredFile: "observability-signal-spire.glb",
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
    mapCoverageArea: 0
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
  telemetry.premiumPromotionFiles = [...new Set(telemetry.premiumPromotionFiles)].sort();
  telemetry.premiumPromotionPlacementIds = [...new Set(telemetry.premiumPromotionPlacementIds)].sort();
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
  alignObjectBottomToGroundClearance(wrapper, spec);
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
    "water:tech-harbor",
    "relief:tech-ridge",
    "vegetation:studio-oak",
    "hero:cloud-dock:server-cloud-node",
    "hero:cloud-dock:cloud-circuit-bridge",
    "hero:cloud-dock:rack-core",
    "hero:design-atelier:mannequin-fabric-rack",
    "hero:design-atelier:atelier-drape-frame",
    "hero:design-atelier:cutting-table",
    "hero:observability-tower:telemetry-radar-mast",
    "hero:observability-tower:telemetry-screen-array",
    "hero:observability-tower:signal-pylon",
    "hero:observability-tower:screen-wall"
  ]);
  for (const placementId of manifest.corePromotion?.requiredPlacementIds ?? []) {
    corePlacementIds.add(placementId);
  }

  return createMapPlacementSpecs().filter((spec) => corePlacementIds.has(spec.id));
}

function createRoutePlacementSpecs(): MapPlacementSpec[] {
  const roadFiles = ["road-straight.glb", "road-curve.glb", "road-intersection.glb", "road-roundabout.glb", "road-split.glb"];
  const edgeFiles = ["light-square.glb", "light-curved.glb", "construction-cone.glb", "construction-barrier.glb"];
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
    )
  ];
}

function createWaterPlacementSpecs(): MapPlacementSpec[] {
  const files = ["ground_riverStraight.glb", "ground_riverBend.glb", "ground_riverRocks.glb", "lily_large.glb", "ground_riverCorner.glb", "ground_riverSplit.glb"];
  return [
    ...worldMaterialRegions.water.map((region, index) =>
      createPlacement(`water:${region.id}`, `water:${region.id}`, "water", index >= 8 ? "context" : index >= 4 ? "support" : index === 3 ? "support" : "primary", true, "water", files[index % files.length], region.center, index >= 8 ? 1.18 : index >= 4 ? 1.08 : index === 3 ? 1.12 : 1.74, region.rotation)
    ),
    createPlacement("water:studio-crossing-proof", "water:studio-crossing-proof", "water", "support", true, "water", "ground_riverStraight.glb", [-0.8, 5.9], 1.46, -0.18)
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
    createPlacement("relief:studio-crossing-proof", "relief:studio-crossing-proof", "relief", "support", true, "relief", "rock_largeC.glb", [2.8, 6.5], 1.18, -0.12)
  ];
}

function createVegetationPlacementSpecs(): MapPlacementSpec[] {
  return [
    createPlacement("vegetation:tech-tree", "vegetation:tech-west", "vegetation", "support", true, "vegetation", "tree_cone.glb", [-27.4, -10.8], 1.5, 0.1),
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
    createPlacement("vegetation:west-field", "vegetation:west-field", "vegetation", "context", false, "vegetation", "tree_cone.glb", [-32.0, -22.0], 1.36, 0.18),
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
    createPlacement("vegetation:far-west-cloud-tree", "vegetation:far-west-shell", "vegetation", "context", false, "vegetation", "tree_cone.glb", [-43.4, -14.2], 1.28, 0.2),
    createPlacement("vegetation:far-east-art-palm", "vegetation:far-east-shell", "vegetation", "context", false, "vegetation", "tree_palm.glb", [43.2, 16.4], 1.26, -0.28),
    createPlacement("vegetation:studio-crossing-proof", "vegetation:studio-crossing-proof", "vegetation", "support", true, "vegetation", "tree_oak.glb", [-3.2, 6.8], 1.32, 0.14)
  ];
}

function createHeroLocationPlacementSpecs(): MapPlacementSpec[] {
  return [
    createPlacement("hero:cloud-dock:server-cloud-node", "hero:cloud-dock", "route", "primary", true, "hero-location", "server-cloud-node.glb", [-11.95, -23.12], 2.1, -0.12, {
      assetId: "accepted-itart-signature-hero-core",
      heroLocation: "cloud-dock",
      heroRole: "server-cloud-node"
    }),
    createPlacement("hero:cloud-dock:cloud-circuit-bridge", "hero:cloud-dock:signature-bridge", "route", "primary", true, "hero-location", "cloud-circuit-bridge.glb", [-10.85, -24.45], 1.82, Math.PI * 0.38, {
      assetId: "accepted-itart-signature-hero-core",
      heroLocation: "cloud-dock",
      heroRole: "cloud-circuit-bridge"
    }),
    createPlacement("hero:cloud-dock:cloud-energy-anchor", "hero:cloud-dock:energy-anchor", "route", "primary", true, "hero-location", "cloud-energy-anchor.glb", [-12.3, -24.85], 1.78, Math.PI * 0.16, {
      assetId: "accepted-itart-signature-hero-core",
      heroLocation: "cloud-dock",
      heroRole: "cloud-energy-anchor"
    }),
    createPlacement("hero:cloud-dock:cloud-server-pier", "hero:cloud-dock:server-pier", "route", "primary", true, "hero-location", "cloud-server-pier.glb", [-10.9, -25.7], 2.1, Math.PI * 0.44, {
      assetId: "accepted-itart-signature-environment-core",
      heroLocation: "cloud-dock",
      heroRole: "cloud-server-pier"
    }),
    createPlacement("hero:cloud-dock:cloud-infra-gateway", "hero:cloud-dock:infra-gateway", "route", "primary", true, "hero-location", "cloud-infra-gateway.glb", [-12.95, -25.25], 1.88, Math.PI * 0.3, {
      assetId: "accepted-itart-signature-premium-v93",
      heroLocation: "cloud-dock",
      heroRole: "cloud-infra-gateway"
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
    createPlacement("hero:design-atelier:mannequin-fabric-rack", "hero:design-atelier", "route", "primary", true, "hero-location", "atelier-mannequin-rack.glb", [20.35, -9.05], 2.0, Math.PI * 0.58, {
      assetId: "accepted-itart-signature-hero-core",
      heroLocation: "design-atelier",
      heroRole: "mannequin-fabric-rack"
    }),
    createPlacement("hero:design-atelier:atelier-drape-frame", "hero:design-atelier:drape-frame", "route", "primary", true, "hero-location", "atelier-drape-frame.glb", [21.95, -9.95], 1.7, Math.PI * 0.42, {
      assetId: "accepted-itart-signature-hero-core",
      heroLocation: "design-atelier",
      heroRole: "atelier-drape-frame"
    }),
    createPlacement("hero:design-atelier:atelier-pattern-wall", "hero:design-atelier:pattern-wall", "route", "primary", true, "hero-location", "atelier-pattern-wall.glb", [22.35, -8.85], 1.58, Math.PI * 0.28, {
      assetId: "accepted-itart-signature-hero-core",
      heroLocation: "design-atelier",
      heroRole: "atelier-pattern-wall"
    }),
    createPlacement("hero:design-atelier:atelier-cutting-island", "hero:design-atelier:cutting-island", "route", "primary", true, "hero-location", "atelier-cutting-island.glb", [20.2, -10.25], 1.9, Math.PI * 0.46, {
      assetId: "accepted-itart-signature-environment-core",
      heroLocation: "design-atelier",
      heroRole: "atelier-cutting-island"
    }),
    createPlacement("hero:design-atelier:atelier-garment-loom", "hero:design-atelier:garment-loom", "route", "primary", true, "hero-location", "atelier-garment-loom.glb", [21.45, -10.95], 1.72, Math.PI * 0.52, {
      assetId: "accepted-itart-signature-premium-v93",
      heroLocation: "design-atelier",
      heroRole: "atelier-garment-loom"
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
    createPlacement("hero:observability-tower:telemetry-radar-mast", "hero:observability-tower", "route", "primary", true, "hero-location", "telemetry-radar-mast.glb", [-22.95, 9.25], 2.35, 0.16, {
      assetId: "accepted-itart-signature-hero-core",
      heroLocation: "observability-tower",
      heroRole: "telemetry-radar-mast"
    }),
    createPlacement("hero:observability-tower:telemetry-screen-array", "hero:observability-tower:screen-array", "route", "primary", true, "hero-location", "telemetry-screen-array.glb", [-21.55, 8.35], 1.65, 0.36, {
      assetId: "accepted-itart-signature-hero-core",
      heroLocation: "observability-tower",
      heroRole: "telemetry-screen-array"
    }),
    createPlacement("hero:observability-tower:telemetry-trace-beacon", "hero:observability-tower:trace-beacon", "route", "primary", true, "hero-location", "telemetry-trace-beacon.glb", [-23.6, 10.45], 1.78, -0.28, {
      assetId: "accepted-itart-signature-hero-core",
      heroLocation: "observability-tower",
      heroRole: "telemetry-trace-beacon"
    }),
    createPlacement("hero:observability-tower:observability-trace-station", "hero:observability-tower:trace-station", "route", "primary", true, "hero-location", "observability-trace-station.glb", [-21.95, 10.65], 1.76, 0.38, {
      assetId: "accepted-itart-signature-environment-core",
      heroLocation: "observability-tower",
      heroRole: "observability-trace-station"
    }),
    createPlacement("hero:observability-tower:observability-signal-spire", "hero:observability-tower:signal-spire", "route", "primary", true, "hero-location", "observability-signal-spire.glb", [-23.1, 11.15], 1.68, -0.12, {
      assetId: "accepted-itart-signature-premium-v93",
      heroLocation: "observability-tower",
      heroRole: "observability-signal-spire"
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
  options: Pick<MapPlacementSpec, "assetId" | "heroLocation" | "heroRole"> = {}
): MapPlacementSpec {
  const terrain = sampleTerrain(new THREE.Vector3(center[0], 0, center[1]));
  const groundClearance = getRoleGroundClearance(terrainRole, curation);
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
    ...options
  };
}

function getRoleGroundClearance(terrainRole: string, curation: MapPlacementSpec["curation"]) {
  const roleClearance: Record<string, number> = {
    road: 0.32,
    "route-edge": 0.36,
    bridge: 0.48,
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
