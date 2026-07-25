import * as THREE from "three";
import type { VisualTone, ZonePropClusterSpec, ZoneSurfaceSpec, ZoneVisualSpec } from "./visual-specs";
import type { StudioZone, ZoneKind } from "./zones";

export type ZoneVisualPalette = Record<ZoneKind | "road" | "ink", number>;

export type RenderedZoneVisuals = {
  visualSpecId: string;
  biome: string;
  visualDecals: number;
  propClusters: number;
  propObjects: number;
  surfaceObjects: number;
  surfaceRoles: Set<string>;
  surfaceSignatures: Set<string>;
  materialVariants: Set<string>;
  motionObjects: THREE.Object3D[];
};

export function renderZoneVisuals(
  group: THREE.Group,
  zone: StudioZone,
  spec: ZoneVisualSpec,
  palette: ZoneVisualPalette
): RenderedZoneVisuals {
  const accent = palette[zone.kind];
  const materialVariants = new Set<string>();
  const motionObjects: THREE.Object3D[] = [];
  let visualDecals = 0;
  let propClusters = 0;
  let propObjects = 0;
  let surfaceObjects = 0;
  const surfaceRoles = new Set<string>();
  const surfaceSignatures = new Set<string>();

  group.userData.visualSpecId = spec.id;
  group.userData.visualBiome = spec.biome;
  group.userData.surfaceProfileId = spec.surface.profileId;
  group.userData.surfaceFinish = spec.surface.finish;
  group.userData.surfaceMotif = spec.surface.motif;

  const surfaceKit = addZoneSurfaceKit(group, zone, spec, spec.surface, palette, accent);
  surfaceObjects += surfaceKit.surfaceObjects;
  for (const role of surfaceKit.surfaceRoles) {
    surfaceRoles.add(role);
  }
  for (const signature of surfaceKit.surfaceSignatures) {
    surfaceSignatures.add(signature);
  }
  for (const variant of surfaceKit.materialVariants) {
    materialVariants.add(variant);
  }
  motionObjects.push(...surfaceKit.motionObjects);

  for (const [index, decal] of spec.decals.entries()) {
    const mat = createToneMaterial(decal.tone, accent, zone.kind, palette, 0.2);
    const semanticVariant = spec.materialVariants[index % spec.materialVariants.length] ?? `${spec.id}-decal`;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(decal.size[0], 0.035, decal.size[1]), mat);
    mesh.position.set(decal.offset[0], 0.285, decal.offset[1]);
    mesh.rotation.y = decal.rotation;
    mesh.userData.zoneId = zone.id;
    mesh.userData.visualSpecId = spec.id;
    mesh.userData.visualSpecRole = "decal";
    mesh.userData.visualDecal = decal.id;
    mesh.userData.materialVariant = `${spec.id}:${decal.tone}:decal`;
    mesh.userData.semanticMaterialVariant = semanticVariant;
    mesh.userData.motionRole = "surface-detail";
    mesh.userData.motionBaseY = mesh.position.y;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    motionObjects.push(mesh);
    visualDecals += 1;
    materialVariants.add(String(mesh.userData.materialVariant));
  }

  for (const [index, cluster] of spec.propClusters.entries()) {
    const rendered = addZonePropCluster(group, zone, spec, cluster, palette, accent, index + spec.decals.length);
    propClusters += 1;
    propObjects += rendered.propObjects;
    for (const variant of rendered.materialVariants) {
      materialVariants.add(variant);
    }
    motionObjects.push(...rendered.motionObjects);
  }

  return {
    visualSpecId: spec.id,
    biome: spec.biome,
    visualDecals,
    propClusters,
    propObjects,
    surfaceObjects,
    surfaceRoles,
    surfaceSignatures,
    materialVariants,
    motionObjects
  };
}

function addZoneSurfaceKit(
  group: THREE.Group,
  zone: StudioZone,
  spec: ZoneVisualSpec,
  surface: ZoneSurfaceSpec,
  palette: ZoneVisualPalette,
  accent: number
) {
  const surfaceObjects = 1 + surface.bands.length;
  const surfaceRoles = new Set<string>(["surface-base"]);
  const surfaceSignatures = new Set<string>();
  const materialVariants = new Set<string>();
  const motionObjects: THREE.Object3D[] = [];
  const baseMaterial = createToneMaterial("dark", accent, zone.kind, palette, 0.08, 0.58);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(zone.radius * 0.9, zone.radius * 0.96, 0.018, zone.kind === "studio" ? 10 : 7),
    baseMaterial
  );
  base.position.y = 0.235;
  base.userData.zoneId = zone.id;
  base.userData.visualSpecId = spec.id;
  base.userData.visualSpecRole = "surface";
  base.userData.surfaceProfileId = surface.profileId;
  base.userData.surfaceRole = "surface-base";
  base.userData.surfaceFinish = surface.finish;
  base.userData.surfaceMotif = surface.motif;
  base.userData.surfaceSignature = `${surface.profileId}:base:${surface.finish}:${surface.motif}`;
  base.userData.materialVariant = `${spec.id}:surface:base:${surface.finish}`;
  base.userData.semanticMaterialVariant = `${spec.id}:surface:${surface.finish}`;
  base.receiveShadow = true;
  group.add(base);
  surfaceSignatures.add(String(base.userData.surfaceSignature));
  materialVariants.add(String(base.userData.materialVariant));

  for (const [index, band] of surface.bands.entries()) {
    const mat = createToneMaterial(band.tone, accent, zone.kind, palette, 0.18, band.tone === "dark" ? 0.72 : 0.9);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(band.length, 0.028, band.width), mat);
    mesh.position.set(band.offset[0], 0.27 + index * 0.004, band.offset[1]);
    mesh.rotation.y = band.rotation;
    mesh.userData.zoneId = zone.id;
    mesh.userData.visualSpecId = spec.id;
    mesh.userData.visualSpecRole = "surface";
    mesh.userData.surfaceProfileId = surface.profileId;
    mesh.userData.surfaceRole = band.role;
    mesh.userData.surfaceBand = band.id;
    mesh.userData.surfaceFinish = surface.finish;
    mesh.userData.surfaceMotif = surface.motif;
    mesh.userData.surfaceSignature = `${surface.profileId}:${band.role}:${band.id}:${surface.motif}`;
    mesh.userData.materialVariant = `${spec.id}:surface:${band.role}:${band.tone}`;
    mesh.userData.semanticMaterialVariant = `${spec.id}:surface:${surface.finish}:${band.role}`;
    mesh.userData.motionRole = "surface-detail";
    mesh.userData.localMotionBehavior = band.role === "anchor" ? "pulse" : "blink";
    mesh.userData.motionBaseY = mesh.position.y;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh);
    surfaceRoles.add(band.role);
    surfaceSignatures.add(String(mesh.userData.surfaceSignature));
    materialVariants.add(String(mesh.userData.materialVariant));
    motionObjects.push(mesh);
  }

  return { surfaceObjects, surfaceRoles, surfaceSignatures, materialVariants, motionObjects };
}

function addZonePropCluster(
  group: THREE.Group,
  zone: StudioZone,
  spec: ZoneVisualSpec,
  cluster: ZonePropClusterSpec,
  palette: ZoneVisualPalette,
  accent: number,
  variantOffset: number
) {
  const mat = createToneMaterial(cluster.tone, accent, zone.kind, palette, 0.16);
  const semanticVariant = spec.materialVariants[variantOffset % spec.materialVariants.length] ?? `${spec.id}-cluster`;
  const materialVariants = new Set<string>();
  const motionObjects: THREE.Object3D[] = [];
  const clusterGroup = new THREE.Group();
  clusterGroup.position.set(cluster.offset[0], 0, cluster.offset[1]);
  clusterGroup.userData.zoneId = zone.id;
  clusterGroup.userData.visualSpecId = spec.id;
  clusterGroup.userData.visualSpecRole = "cluster";
  clusterGroup.userData.propCluster = cluster.id;
  clusterGroup.userData.motionRole = "cluster";
  clusterGroup.userData.motionBaseY = clusterGroup.position.y;

  const geometry = createPropGeometry(cluster.form, cluster.scale, cluster.scale);
  const propBatch = new THREE.InstancedMesh(geometry, mat, cluster.count);
  propBatch.userData.zoneId = zone.id;
  propBatch.userData.visualSpecId = spec.id;
  propBatch.userData.visualSpecRole = "prop";
  propBatch.userData.propCluster = cluster.id;
  propBatch.userData.propObjectCount = cluster.count;
  propBatch.userData.motionRole = cluster.form;
  propBatch.userData.motionInstanceCount = cluster.count;
  propBatch.userData.materialVariant = `${spec.id}:${cluster.tone}:${cluster.form}`;
  propBatch.userData.semanticMaterialVariant = semanticVariant;
  propBatch.userData.motionBaseY = propBatch.position.y;
  propBatch.castShadow = false;
  propBatch.receiveShadow = true;

  const transform = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const euler = new THREE.Euler();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  for (let index = 0; index < cluster.count; index += 1) {
    const angle = (index / cluster.count) * Math.PI * 2 + zone.position[0] * 0.07;
    const distance = cluster.spread * (0.45 + (index % 3) * 0.22);
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const height = cluster.scale * (0.42 + (index % 2) * 0.18);
    euler.set(0, angle, 0);
    rotation.setFromEuler(euler);
    scale.set(1, cluster.form === "beacon" ? 1 : height / cluster.scale, 1);
    position.set(x, 0.34 + height * 0.35, z);
    transform.compose(position, rotation, scale);
    propBatch.setMatrixAt(index, transform);
  }

  propBatch.instanceMatrix.needsUpdate = true;
  propBatch.computeBoundingBox();
  propBatch.computeBoundingSphere();
  clusterGroup.add(propBatch);
  group.add(clusterGroup);
  motionObjects.push(propBatch);
  motionObjects.push(clusterGroup);
  materialVariants.add(String(propBatch.userData.materialVariant));

  return { propObjects: cluster.count, materialVariants, motionObjects };
}

function createPropGeometry(form: ZonePropClusterSpec["form"], scale: number, baseHeight: number) {
  if (form === "stack") {
    return new THREE.BoxGeometry(scale * 0.26, baseHeight, scale * 0.26);
  }
  if (form === "totem") {
    return new THREE.CylinderGeometry(scale * 0.08, scale * 0.13, baseHeight, 7);
  }
  if (form === "pin") {
    return new THREE.ConeGeometry(scale * 0.13, baseHeight, 8);
  }
  return new THREE.SphereGeometry(scale * 0.14, 10, 6);
}

function createToneMaterial(
  tone: VisualTone,
  accent: number,
  kind: ZoneKind,
  palette: ZoneVisualPalette,
  emissiveIntensity: number,
  opacityOverride?: number
) {
  const secondary = kind === "tech" ? palette.art : palette.tech;
  const color = tone === "accent" ? accent : tone === "secondary" ? secondary : tone === "light" ? palette.road : palette.ink;
  const opacity = opacityOverride ?? (tone === "dark" ? 0.8 : 1);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: tone === "dark" ? 0.82 : 0.48,
    metalness: tone === "light" ? 0.16 : 0.24,
    emissive: color,
    emissiveIntensity: tone === "dark" ? 0.03 : emissiveIntensity,
    transparent: tone === "dark" || opacity < 1,
    opacity
  });
}
