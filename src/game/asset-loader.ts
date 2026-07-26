import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import worldAssetManifest from "../../assets/world-assets.manifest.json";

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
  requested: number;
  loaded: number;
  failed: number;
  visible: number;
  collections: number;
  files: number;
  sceneObjects: number;
  collectionFileKb: number;
  collectionTriangles: number;
  assetIds: string[];
  terrainRoles: string[];
  publicPaths: string[];
  errors: string[];
};

type PreviewSpec = {
  terrainRole: string;
  preferredFile: string;
  position: [number, number, number];
  targetSize: number;
  rotationY?: number;
};

const manifest = worldAssetManifest as WorldAssetManifest;

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

export function createExternalAssetTelemetry(enabled: boolean): ExternalAssetPreviewTelemetry {
  return {
    enabled,
    requested: 0,
    loaded: 0,
    failed: 0,
    visible: 0,
    collections: 0,
    files: 0,
    sceneObjects: 0,
    collectionFileKb: 0,
    collectionTriangles: 0,
    assetIds: [],
    terrainRoles: [],
    publicPaths: [],
    errors: []
  };
}

export async function createExternalAssetPreview() {
  const group = new THREE.Group();
  group.name = "external-asset-preview";
  group.userData.externalAssetPreview = true;

  const telemetry = createExternalAssetTelemetry(true);
  const loader = new GLTFLoader();
  const acceptedAssets = manifest.assets.filter(
    (asset) =>
      (asset.status === "accepted" || asset.status === "integrated") &&
      asset.kind.includes("model") &&
      asset.publicPath &&
      Array.isArray(asset.selectedFiles)
  );

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
      const url = createRuntimeAssetUrl(asset.publicPath ?? "", spec.preferredFile);
      const gltf = await loader.loadAsync(url);
      const wrapper = normalizePreviewObject(gltf.scene, spec);
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

  for (const result of results) {
    if (result.status === "rejected") {
      telemetry.failed += 1;
      telemetry.errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  let sceneObjects = 0;
  group.traverse(() => {
    sceneObjects += 1;
  });
  telemetry.sceneObjects = sceneObjects;
  telemetry.assetIds = [...new Set(telemetry.assetIds)].sort();
  telemetry.terrainRoles = [...new Set(telemetry.terrainRoles)].sort();
  telemetry.publicPaths = telemetry.publicPaths.sort();

  return { group, telemetry };
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
