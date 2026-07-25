import * as THREE from "three";
import type { VisualTone, ZonePropClusterSpec, ZoneVisualSpec } from "./visual-specs";
import type { StudioZone, ZoneKind } from "./zones";

export type ZoneVisualPalette = Record<ZoneKind | "road" | "ink", number>;

export type RenderedZoneVisuals = {
  visualSpecId: string;
  biome: string;
  visualDecals: number;
  propClusters: number;
  propObjects: number;
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

  group.userData.visualSpecId = spec.id;
  group.userData.visualBiome = spec.biome;

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
    materialVariants,
    motionObjects
  };
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

  for (let index = 0; index < cluster.count; index += 1) {
    const angle = (index / cluster.count) * Math.PI * 2 + zone.position[0] * 0.07;
    const distance = cluster.spread * (0.45 + (index % 3) * 0.22);
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const height = cluster.scale * (0.42 + (index % 2) * 0.18);
    const prop = createPropPrimitive(cluster.form, mat, cluster.scale, height);
    prop.position.set(x, 0.34 + height * 0.35, z);
    prop.rotation.y = angle;
    prop.userData.zoneId = zone.id;
    prop.userData.visualSpecId = spec.id;
    prop.userData.visualSpecRole = "prop";
    prop.userData.propCluster = cluster.id;
    prop.userData.motionRole = cluster.form;
    prop.userData.materialVariant = `${spec.id}:${cluster.tone}:${cluster.form}`;
    prop.userData.semanticMaterialVariant = semanticVariant;
    prop.userData.motionBaseY = prop.position.y;
    clusterGroup.add(prop);
    motionObjects.push(prop);
    materialVariants.add(String(prop.userData.materialVariant));
  }

  clusterGroup.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  group.add(clusterGroup);
  motionObjects.push(clusterGroup);

  return { propObjects: cluster.count, materialVariants, motionObjects };
}

function createPropPrimitive(form: ZonePropClusterSpec["form"], mat: THREE.Material, scale: number, height: number) {
  if (form === "stack") {
    return new THREE.Mesh(new THREE.BoxGeometry(scale * 0.26, height, scale * 0.26), mat);
  }
  if (form === "totem") {
    return new THREE.Mesh(new THREE.CylinderGeometry(scale * 0.08, scale * 0.13, height, 7), mat);
  }
  if (form === "pin") {
    return new THREE.Mesh(new THREE.ConeGeometry(scale * 0.13, height, 8), mat);
  }
  return new THREE.Mesh(new THREE.SphereGeometry(scale * 0.14, 10, 6), mat);
}

function createToneMaterial(
  tone: VisualTone,
  accent: number,
  kind: ZoneKind,
  palette: ZoneVisualPalette,
  emissiveIntensity: number
) {
  const secondary = kind === "tech" ? palette.art : palette.tech;
  const color = tone === "accent" ? accent : tone === "secondary" ? secondary : tone === "light" ? palette.road : palette.ink;
  return new THREE.MeshStandardMaterial({
    color,
    roughness: tone === "dark" ? 0.82 : 0.48,
    metalness: tone === "light" ? 0.16 : 0.24,
    emissive: color,
    emissiveIntensity: tone === "dark" ? 0.03 : emissiveIntensity,
    transparent: tone === "dark",
    opacity: tone === "dark" ? 0.8 : 1
  });
}
