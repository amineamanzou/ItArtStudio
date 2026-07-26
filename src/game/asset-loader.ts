import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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

type WorldAssetManifest = {
  assets: ManifestAsset[];
};

export type ExternalAssetPreviewTelemetry = {
  enabled: boolean;
  mode: "off" | "preview" | "map";
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
  errors: string[];
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
  terrainRole: string;
  preferredFile: string;
  position: [number, number, number];
  targetSize: number;
  rotationY?: number;
};

type MapPlacementSpec = PreviewSpec & {
  id: string;
  clusterId: string;
  linkedKind: "route" | "water" | "relief" | "vegetation";
  curation: "primary" | "support" | "context";
  promotionCandidate: boolean;
  groundClearance: number;
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
    errors: [],
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

  const jobs = previewSpecs
    .map((spec) => {
      const asset = acceptedAssets.find(
        (item) => item.terrainRole === spec.terrainRole && item.selectedFiles?.includes(spec.preferredFile)
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
      telemetry.collectionFileKb = Number((telemetry.collectionFileKb + (asset.fileKb ?? 0)).toFixed(1));
      telemetry.collectionTriangles += asset.triangles ?? 0;
      telemetry.assetIds.push(asset.id);
      telemetry.terrainRoles.push(asset.terrainRole);
      telemetry.publicPaths.push(url);
    })
  );

  collectRejectedResults(results, telemetry);
  finalizeTelemetry(group, telemetry);

  return { group, telemetry };
}

export async function createExternalAssetMapLayer() {
  const group = new THREE.Group();
  group.name = "external-asset-map-layer";
  group.userData.externalAssetMapLayer = true;

  const telemetry = createExternalAssetTelemetry(true, "map");
  const loader = new GLTFLoader();
  const cache = new Map<string, Promise<THREE.Object3D>>();
  const acceptedAssets = getAcceptedModelCollections();
  const placements = createMapPlacementSpecs();

  const jobs = placements
    .map((spec) => {
      const asset = acceptedAssets.find(
        (item) => item.terrainRole === spec.terrainRole && item.selectedFiles?.includes(spec.preferredFile)
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
  telemetry.minGroundClearance = Number(Math.min(...jobs.map((job) => job.spec.groundClearance)).toFixed(3));
  telemetry.coplanarRiskPlacements = jobs.filter((job) => job.spec.groundClearance < 0.12).length;
  const actualGroundClearances: number[] = [];

  const results = await Promise.allSettled(
    jobs.map(async ({ asset, spec }) => {
      const { object, url } = await loadNormalizedObject(loader, asset, spec, cache);
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
      wrapper.userData.externalAssetId = asset.id;
      wrapper.userData.externalAssetSourceId = asset.sourceId;
      wrapper.userData.externalAssetTerrainRole = asset.terrainRole;
      wrapper.userData.externalAssetFile = spec.preferredFile;
      wrapper.userData.externalAssetUrl = url;
      wrapper.traverse((object) => {
        object.userData.externalAssetId = object.userData.externalAssetId ?? asset.id;
        object.userData.externalAssetMapPlacement = true;
        object.userData.externalAssetCuration = object.userData.externalAssetCuration ?? spec.curation;
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
      telemetry.collectionFileKb = Number((telemetry.collectionFileKb + (asset.fileKb ?? 0)).toFixed(1));
      telemetry.collectionTriangles += asset.triangles ?? 0;
      telemetry.assetIds.push(asset.id);
      telemetry.terrainRoles.push(asset.terrainRole);
      telemetry.publicPaths.push(url);
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

async function loadNormalizedObject(loader: GLTFLoader, asset: ManifestAsset, spec: PreviewSpec, cache?: Map<string, Promise<THREE.Object3D>>) {
  const url = createRuntimeAssetUrl(asset.publicPath ?? "", spec.preferredFile);
  if (!cache?.has(url)) {
    cache?.set(url, loader.loadAsync(url).then((gltf) => gltf.scene));
  }
  const source = cache ? (await cache.get(url))?.clone(true) : (await loader.loadAsync(url)).scene;
  return {
    object: normalizePreviewObject(source ?? new THREE.Group(), spec),
    url
  };
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
    ...createVegetationPlacementSpecs()
  ];
}

function createRoutePlacementSpecs(): MapPlacementSpec[] {
  const roadFiles = ["road-straight.glb", "road-curve.glb", "road-intersection.glb", "road-roundabout.glb", "road-split.glb"];
  const edgeFiles = ["light-square.glb", "light-curved.glb", "construction-cone.glb", "construction-barrier.glb"];
  const bridgeFiles = ["bridge_wood.glb", "path_wood.glb"];

  return worldRoutes.flatMap((route, index) => {
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
  });
}

function createWaterPlacementSpecs(): MapPlacementSpec[] {
  const files = ["ground_riverStraight.glb", "ground_riverBend.glb", "ground_riverRocks.glb", "lily_large.glb"];
  return [
    ...worldMaterialRegions.water.map((region, index) =>
      createPlacement(`water:${region.id}`, `water:${region.id}`, "water", index >= 4 ? "context" : index === 3 ? "support" : "primary", true, "water", files[index % files.length], region.center, index >= 4 ? 1.05 : index === 3 ? 1.12 : 1.74, region.rotation)
    ),
    createPlacement("water:studio-crossing-proof", "water:studio-crossing-proof", "water", "support", true, "water", "ground_riverStraight.glb", [-0.8, 5.9], 1.46, -0.18)
  ];
}

function createReliefPlacementSpecs(): MapPlacementSpec[] {
  return [
    createPlacement("relief:tech-ridge", "relief:tech-ridge", "relief", "primary", true, "relief", "cliff_blockSlope_rock.glb", [-18.7, 2.2], 1.62, -0.2),
    createPlacement("relief:harbor-cut", "relief:harbor-cut", "relief", "primary", true, "relief", "cliff_corner_rock.glb", [-15.4, -21.5], 1.44, 0.42),
    createPlacement("relief:art-mound", "relief:art-mound", "relief", "support", true, "relief", "rock_largeC.glb", [18.4, 6.4], 1.28, -0.32),
    createPlacement("relief:studio-spine", "relief:studio-spine", "relief", "support", true, "relief", "cliff_steps_rock.glb", [-1.8, 18.3], 1.34, 0.08),
    createPlacement("relief:north-field", "relief:north-field", "relief", "context", false, "relief", "rock_largeA.glb", [8.8, 24.6], 1.22, -0.18),
    createPlacement("relief:south-field", "relief:south-field", "relief", "context", false, "relief", "rock_tallA.glb", [-8.5, -25.1], 1.3, 0.26),
    createPlacement("relief:west-cut", "relief:west-cut", "relief", "context", false, "relief", "rock_largeA.glb", [-24.8, 8.5], 1.16, 0.14),
    createPlacement("relief:east-shelf", "relief:east-shelf", "relief", "context", false, "relief", "cliff_half_rock.glb", [24.2, 10.8], 1.18, -0.26),
    createPlacement("relief:studio-crossing-proof", "relief:studio-crossing-proof", "relief", "support", true, "relief", "rock_largeC.glb", [2.8, 6.5], 1.18, -0.12)
  ];
}

function createVegetationPlacementSpecs(): MapPlacementSpec[] {
  return [
    createPlacement("vegetation:tech-tree", "vegetation:tech-west", "vegetation", "support", true, "vegetation", "tree_cone.glb", [-21.4, -8.8], 1.5, 0.1),
    createPlacement("vegetation:tech-bush", "vegetation:tech-west", "vegetation", "context", false, "vegetation", "plant_bush.glb", [-24.4, 4.1], 1.12, -0.24),
    createPlacement("vegetation:studio-oak", "vegetation:studio-north", "vegetation", "support", true, "vegetation", "tree_oak.glb", [4.8, 19.8], 1.65, -0.22),
    createPlacement("vegetation:studio-grass", "vegetation:studio-north", "vegetation", "context", false, "vegetation", "grass.glb", [-4.8, 24.4], 1.08, 0.1),
    createPlacement("vegetation:art-palm", "vegetation:art-east", "vegetation", "support", true, "vegetation", "tree_palm.glb", [22.9, -13.8], 1.55, 0.34),
    createPlacement("vegetation:art-flower", "vegetation:art-east", "vegetation", "context", false, "vegetation", "flower_yellowA.glb", [25.2, -4.2], 1.05, -0.16),
    createPlacement("vegetation:foundry-bush", "vegetation:foundry", "vegetation", "context", false, "vegetation", "plant_bushLarge.glb", [23.1, 5.9], 1.24, -0.38),
    createPlacement("vegetation:foundry-tree", "vegetation:foundry", "vegetation", "support", true, "vegetation", "tree_default.glb", [25.2, 11.6], 1.46, 0.28),
    createPlacement("vegetation:contact-grass", "vegetation:contact-south", "vegetation", "context", false, "vegetation", "grass_large.glb", [-3.8, -23.4], 1.18, 0.16),
    createPlacement("vegetation:contact-bush", "vegetation:contact-south", "vegetation", "context", false, "vegetation", "plant_bush.glb", [4.8, -26.2], 1.1, -0.12),
    createPlacement("vegetation:north-tree", "vegetation:north-field", "vegetation", "context", false, "vegetation", "tree_fat.glb", [-13.6, 25.3], 1.42, 0.24),
    createPlacement("vegetation:south-tree", "vegetation:south-field", "vegetation", "context", false, "vegetation", "tree_default.glb", [13.4, -25.4], 1.42, -0.18),
    createPlacement("vegetation:west-field", "vegetation:west-field", "vegetation", "context", false, "vegetation", "tree_cone.glb", [-25.8, -17.2], 1.36, 0.18),
    createPlacement("vegetation:east-field", "vegetation:east-field", "vegetation", "context", false, "vegetation", "plant_bushLarge.glb", [26.0, 20.8], 1.2, -0.2),
    createPlacement("vegetation:studio-crossing-proof", "vegetation:studio-crossing-proof", "vegetation", "support", true, "vegetation", "tree_oak.glb", [-3.2, 6.8], 1.32, 0.14)
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
  rotationY = 0
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
    rotationY
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
