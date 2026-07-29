import * as THREE from "three";

export type WorldMaterialKind = "field" | "road" | "water" | "ramp";

export type WorldMaterialSample = {
  kind: WorldMaterialKind;
  id: string;
  intensity: number;
  speedMultiplier: number;
  accelerationMultiplier: number;
  lateralGripMultiplier: number;
  driftGripMultiplier: number;
  dragMultiplier: number;
  rideHeight: number;
  pitch: number;
  roll: number;
};

export type TerrainFeatureKind = "ridge" | "basin" | "mound";

export type TerrainFeature = {
  id: string;
  kind: TerrainFeatureKind;
  center: [number, number];
  radiusX: number;
  radiusZ: number;
  rotation: number;
  height: number;
  linkedRouteIds: string[];
  linkedZoneIds: string[];
};

export type TerrainSample = {
  height: number;
  normal: { x: number; y: number; z: number };
  grade: number;
  roughness: number;
  wetness: number;
  dominantFeatureId: string | null;
};

type WaterRegion = {
  id: string;
  center: [number, number];
  radiusX: number;
  radiusZ: number;
  rotation: number;
};

type RampRegion = {
  id: string;
  center: [number, number];
  width: number;
  depth: number;
  rotation: number;
  height: number;
  direction: 1 | -1;
};

const waterRegions: WaterRegion[] = [
  { id: "tech-harbor", center: [-15.2, -27.2], radiusX: 5.6, radiusZ: 3.45, rotation: -0.24 },
  { id: "art-lagoon", center: [24.2, -21.8], radiusX: 5.05, radiusZ: 2.95, rotation: 0.28 },
  { id: "studio-canal", center: [0, 31.0], radiusX: 7.3, radiusZ: 2.1, rotation: 0.02 },
  { id: "foundry-cooling-pool", center: [28.0, 4.8], radiusX: 3.55, radiusZ: 2.2, rotation: -0.36 },
  { id: "north-reflection-cut", center: [-16.8, 29.0], radiusX: 3.85, radiusZ: 1.72, rotation: 0.2 },
  { id: "south-postal-basin", center: [10.8, -30.2], radiusX: 3.75, radiusZ: 1.9, rotation: -0.08 },
  { id: "west-signal-marsh", center: [-30.0, -3.8], radiusX: 2.35, radiusZ: 5.4, rotation: 0.12 },
  { id: "east-material-pond", center: [30.4, 17.6], radiusX: 2.6, radiusZ: 4.9, rotation: -0.26 },
  { id: "outer-north-mirror", center: [14.8, 35.8], radiusX: 5.4, radiusZ: 1.84, rotation: -0.18 },
  { id: "outer-south-runoff", center: [-18.4, -35.6], radiusX: 5.2, radiusZ: 1.78, rotation: 0.18 },
  { id: "outer-west-wetland", center: [-35.7, -20.6], radiusX: 1.86, radiusZ: 5.1, rotation: 0.08 },
  { id: "outer-east-reflection", center: [35.8, 23.6], radiusX: 1.92, radiusZ: 5.2, rotation: -0.16 },
  { id: "far-north-canal", center: [-4.8, 43.8], radiusX: 8.8, radiusZ: 1.92, rotation: -0.08 },
  { id: "far-south-mailwater", center: [7.8, -43.2], radiusX: 8.2, radiusZ: 1.86, rotation: 0.1 },
  { id: "far-west-cloud-marsh", center: [-43.0, -9.8], radiusX: 1.94, radiusZ: 8.0, rotation: 0.04 },
  { id: "far-east-art-ponds", center: [43.4, 11.6], radiusX: 2.0, radiusZ: 8.2, rotation: -0.06 },
  { id: "edge-west-waterline", center: [-52.2, 1.2], radiusX: 1.86, radiusZ: 6.9, rotation: -0.02 },
  { id: "edge-east-mirror-pond", center: [52.0, -0.8], radiusX: 1.92, radiusZ: 7.1, rotation: 0.04 }
];

const rampRegions: RampRegion[] = [
  { id: "tech-delta", center: [-12.6, -18.4], width: 4.45, depth: 1.45, rotation: -0.48, height: 0.28, direction: 1 },
  { id: "obs-rise", center: [-21.8, 4.2], width: 4.5, depth: 1.28, rotation: 0.07, height: 0.31, direction: -1 },
  { id: "art-sweep", center: [16.2, -11.6], width: 4.42, depth: 1.28, rotation: 0.72, height: 0.27, direction: 1 },
  { id: "studio-crossing", center: [0.3, 7.4], width: 4.72, depth: 1.05, rotation: -0.18, height: 0.24, direction: -1 },
  { id: "mail-bank", center: [-1.4, -24.0], width: 4.1, depth: 1.16, rotation: 0.04, height: 0.24, direction: 1 },
  { id: "foundry-roll", center: [20.7, 3.1], width: 4.05, depth: 1.16, rotation: -0.34, height: 0.25, direction: -1 },
  { id: "north-shelf", center: [-10.8, 27.0], width: 3.9, depth: 1.06, rotation: 0.22, height: 0.22, direction: 1 },
  { id: "south-shelf", center: [8.6, -27.8], width: 3.7, depth: 1.08, rotation: -0.16, height: 0.22, direction: -1 },
  { id: "west-observability-bank", center: [-28.8, 6.4], width: 3.8, depth: 1.05, rotation: 0.24, height: 0.21, direction: -1 },
  { id: "east-atelier-bank", center: [28.4, -6.2], width: 3.8, depth: 1.05, rotation: -0.3, height: 0.21, direction: 1 },
  { id: "outer-north-terrace-ramp", center: [14.4, 32.9], width: 4.2, depth: 1.02, rotation: -0.18, height: 0.19, direction: 1 },
  { id: "outer-south-basin-ramp", center: [-18.2, -32.8], width: 4.1, depth: 1.04, rotation: 0.2, height: 0.19, direction: -1 },
  { id: "outer-west-marsh-ramp", center: [-33.4, -20.0], width: 3.6, depth: 1.02, rotation: 1.45, height: 0.18, direction: 1 },
  { id: "outer-east-gallery-ramp", center: [33.4, 23.0], width: 3.6, depth: 1.02, rotation: -1.42, height: 0.18, direction: -1 },
  { id: "far-north-canal-ramp", center: [-4.6, 40.4], width: 4.4, depth: 1.02, rotation: -0.08, height: 0.17, direction: 1 },
  { id: "far-south-mail-ramp", center: [7.6, -40.2], width: 4.3, depth: 1.02, rotation: 0.12, height: 0.17, direction: -1 },
  { id: "far-west-cloud-ramp", center: [-40.2, -9.6], width: 3.7, depth: 1.02, rotation: 1.5, height: 0.17, direction: 1 },
  { id: "far-east-art-ramp", center: [40.4, 11.2], width: 3.7, depth: 1.02, rotation: -1.5, height: 0.17, direction: -1 }
];

const terrainFeatures: TerrainFeature[] = [
  { id: "tech-ridge", kind: "ridge", center: [-21.6, 1.0], radiusX: 12.8, radiusZ: 5.8, rotation: -0.24, height: 0.39, linkedRouteIds: ["tech-ai-obs"], linkedZoneIds: ["ai-lab", "observability-tower"] },
  { id: "art-mound", kind: "mound", center: [20.6, 3.1], radiusX: 10.8, radiusZ: 6.1, rotation: 0.36, height: 0.34, linkedRouteIds: ["art-design-foundry"], linkedZoneIds: ["design-atelier", "three-d-foundry"] },
  { id: "studio-spine", kind: "ridge", center: [0, 11.8], radiusX: 4.8, radiusZ: 16.2, rotation: -0.06, height: 0.3, linkedRouteIds: ["spine-gate-values"], linkedZoneIds: ["studio-gate", "values-plaza"] },
  { id: "contact-basin", kind: "basin", center: [0.1, -25.6], radiusX: 7.6, radiusZ: 4.05, rotation: 0.02, height: -0.29, linkedRouteIds: ["spine-contact-gate"], linkedZoneIds: ["contact-portal"] },
  { id: "harbor-cut", kind: "basin", center: [-15.0, -26.0], radiusX: 8.0, radiusZ: 4.75, rotation: -0.18, height: -0.25, linkedRouteIds: ["tech-gate-cloud", "tech-cloud-ai"], linkedZoneIds: ["cloud-dock"] },
  { id: "atelier-lift", kind: "mound", center: [19.0, -10.8], radiusX: 7.0, radiusZ: 3.85, rotation: 0.42, height: 0.28, linkedRouteIds: ["art-gate-design"], linkedZoneIds: ["design-atelier"] },
  { id: "outer-field-roll", kind: "ridge", center: [0, -31.8], radiusX: 20.8, radiusZ: 3.2, rotation: 0.04, height: 0.18, linkedRouteIds: ["spine-contact-gate"], linkedZoneIds: ["contact-portal"] },
  { id: "north-reflection-ridge", kind: "ridge", center: [-10.4, 29.0], radiusX: 11.2, radiusZ: 2.8, rotation: 0.18, height: 0.2, linkedRouteIds: ["spine-gate-values", "tech-obs-arch"], linkedZoneIds: ["values-plaza", "architecture-bridge"] },
  { id: "east-foundry-shelf", kind: "mound", center: [29.4, 11.2], radiusX: 4.7, radiusZ: 6.9, rotation: -0.28, height: 0.19, linkedRouteIds: ["art-design-foundry", "art-foundry-fashion"], linkedZoneIds: ["three-d-foundry"] },
  { id: "west-observability-cut", kind: "basin", center: [-30.6, 9.6], radiusX: 4.25, radiusZ: 7.1, rotation: 0.1, height: -0.18, linkedRouteIds: ["tech-ai-obs", "tech-obs-arch"], linkedZoneIds: ["observability-tower"] },
  { id: "north-values-terrace", kind: "ridge", center: [5.6, 31.6], radiusX: 12.4, radiusZ: 2.4, rotation: -0.12, height: 0.16, linkedRouteIds: ["spine-gate-values", "art-fashion-values"], linkedZoneIds: ["values-plaza"] },
  { id: "east-atelier-plain", kind: "mound", center: [31.0, -11.8], radiusX: 3.8, radiusZ: 8.4, rotation: -0.18, height: 0.15, linkedRouteIds: ["art-gate-design", "art-design-foundry"], linkedZoneIds: ["design-atelier"] },
  { id: "west-cloud-basin", kind: "basin", center: [-31.2, -17.2], radiusX: 3.9, radiusZ: 8.2, rotation: 0.16, height: -0.15, linkedRouteIds: ["tech-cloud-ai"], linkedZoneIds: ["cloud-dock", "ai-lab"] },
  { id: "outer-north-gallery", kind: "ridge", center: [14.8, 35.2], radiusX: 13.6, radiusZ: 2.5, rotation: -0.18, height: 0.17, linkedRouteIds: ["art-fashion-values"], linkedZoneIds: ["values-plaza", "fashion-room"] },
  { id: "outer-south-runoff-cut", kind: "basin", center: [-18.4, -35.0], radiusX: 13.4, radiusZ: 2.55, rotation: 0.18, height: -0.17, linkedRouteIds: ["spine-contact-gate", "tech-gate-cloud"], linkedZoneIds: ["contact-portal", "cloud-dock"] },
  { id: "outer-west-cloud-shelf", kind: "basin", center: [-35.0, -20.6], radiusX: 2.6, radiusZ: 12.6, rotation: 0.08, height: -0.16, linkedRouteIds: ["tech-cloud-ai"], linkedZoneIds: ["cloud-dock", "ai-lab"] },
  { id: "outer-east-art-shelf", kind: "mound", center: [35.2, 23.6], radiusX: 2.7, radiusZ: 12.4, rotation: -0.14, height: 0.16, linkedRouteIds: ["art-foundry-fashion"], linkedZoneIds: ["three-d-foundry", "fashion-room"] },
  { id: "outer-northwest-ridge", kind: "ridge", center: [-30.2, 34.6], radiusX: 7.6, radiusZ: 2.1, rotation: 0.32, height: 0.14, linkedRouteIds: ["tech-obs-arch"], linkedZoneIds: ["observability-tower", "architecture-bridge"] },
  { id: "outer-southeast-mound", kind: "mound", center: [30.8, -34.4], radiusX: 7.8, radiusZ: 2.2, rotation: -0.28, height: 0.14, linkedRouteIds: ["art-gate-design"], linkedZoneIds: ["design-atelier", "contact-portal"] },
  { id: "far-north-values-canal", kind: "ridge", center: [-4.8, 43.2], radiusX: 15.0, radiusZ: 2.2, rotation: -0.08, height: 0.13, linkedRouteIds: ["spine-gate-values", "art-fashion-values"], linkedZoneIds: ["values-plaza", "fashion-room"] },
  { id: "far-south-contact-runoff", kind: "basin", center: [7.8, -42.6], radiusX: 14.6, radiusZ: 2.25, rotation: 0.1, height: -0.14, linkedRouteIds: ["spine-contact-gate", "tech-gate-cloud"], linkedZoneIds: ["contact-portal", "cloud-dock"] },
  { id: "far-west-cloud-marsh", kind: "basin", center: [-42.6, -9.6], radiusX: 2.25, radiusZ: 14.4, rotation: 0.04, height: -0.13, linkedRouteIds: ["tech-cloud-ai", "tech-ai-obs"], linkedZoneIds: ["cloud-dock", "ai-lab", "observability-tower"] },
  { id: "far-east-art-gallery", kind: "mound", center: [42.8, 11.4], radiusX: 2.35, radiusZ: 14.8, rotation: -0.06, height: 0.13, linkedRouteIds: ["art-design-foundry", "art-foundry-fashion"], linkedZoneIds: ["design-atelier", "three-d-foundry", "fashion-room"] },
  { id: "far-northwest-observatory", kind: "ridge", center: [-41.6, 35.6], radiusX: 7.8, radiusZ: 2.0, rotation: 0.28, height: 0.12, linkedRouteIds: ["tech-obs-arch"], linkedZoneIds: ["observability-tower", "architecture-bridge"] },
  { id: "far-southeast-atelier-bank", kind: "mound", center: [40.8, -35.2], radiusX: 7.6, radiusZ: 2.05, rotation: -0.26, height: 0.12, linkedRouteIds: ["art-gate-design"], linkedZoneIds: ["design-atelier"] },
  { id: "edge-north-ridge", kind: "ridge", center: [0.8, 51.8], radiusX: 11.8, radiusZ: 2.05, rotation: 0.06, height: 0.12, linkedRouteIds: ["spine-gate-values"], linkedZoneIds: ["values-plaza"] },
  { id: "edge-south-cut", kind: "basin", center: [-1.2, -51.6], radiusX: 11.6, radiusZ: 2.12, rotation: -0.04, height: -0.12, linkedRouteIds: ["spine-contact-gate"], linkedZoneIds: ["contact-portal"] },
  { id: "edge-west-marsh-bank", kind: "basin", center: [-52.0, 1.1], radiusX: 2.08, radiusZ: 11.4, rotation: -0.02, height: -0.12, linkedRouteIds: ["tech-ai-obs"], linkedZoneIds: ["observability-tower"] },
  { id: "edge-east-gallery-bank", kind: "mound", center: [52.0, -0.8], radiusX: 2.12, radiusZ: 11.6, rotation: 0.04, height: 0.12, linkedRouteIds: ["art-design-foundry"], linkedZoneIds: ["design-atelier", "three-d-foundry"] }
];

const fieldSample: WorldMaterialSample = {
  kind: "field",
  id: "open-field",
  intensity: 0,
  speedMultiplier: 0.98,
  accelerationMultiplier: 0.98,
  lateralGripMultiplier: 0.9,
  driftGripMultiplier: 0.82,
  dragMultiplier: 1.04,
  rideHeight: 0,
  pitch: 0,
  roll: 0
};

const roadSample: WorldMaterialSample = {
  kind: "road",
  id: "route-ribbon",
  intensity: 0,
  speedMultiplier: 1,
  accelerationMultiplier: 1,
  lateralGripMultiplier: 1,
  driftGripMultiplier: 1,
  dragMultiplier: 1,
  rideHeight: 0,
  pitch: 0,
  roll: 0
};

const rotatePoint = (x: number, z: number, rotation: number) => {
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  return {
    x: x * cos - z * sin,
    z: x * sin + z * cos
  };
};

const sampleTerrainHeightRaw = (x: number, z: number) => {
  let height = Math.sin(x * 0.22 + z * 0.09) * 0.035 + Math.cos(z * 0.18 - x * 0.04) * 0.028;
  let dominantFeatureId: string | null = null;
  let dominantWeight = 0;

  for (const feature of terrainFeatures) {
    const local = rotatePoint(x - feature.center[0], z - feature.center[1], feature.rotation);
    const distance = (local.x / feature.radiusX) ** 2 + (local.z / feature.radiusZ) ** 2;
    if (distance > 1) {
      continue;
    }
    const falloff = Math.cos(Math.sqrt(distance) * Math.PI * 0.5) ** 2;
    const shape = feature.kind === "ridge" ? falloff * (0.72 + Math.cos(local.x / feature.radiusX * Math.PI) * 0.28) : falloff;
    const contribution = feature.height * shape;
    height += contribution;
    if (Math.abs(contribution) > dominantWeight) {
      dominantWeight = Math.abs(contribution);
      dominantFeatureId = feature.id;
    }
  }

  return { height, dominantFeatureId };
};

export function sampleTerrain(position: THREE.Vector3): TerrainSample {
  const center = sampleTerrainHeightRaw(position.x, position.z);
  const step = 0.32;
  const xPlus = sampleTerrainHeightRaw(position.x + step, position.z).height;
  const xMinus = sampleTerrainHeightRaw(position.x - step, position.z).height;
  const zPlus = sampleTerrainHeightRaw(position.x, position.z + step).height;
  const zMinus = sampleTerrainHeightRaw(position.x, position.z - step).height;
  const dHx = (xPlus - xMinus) / (step * 2);
  const dHz = (zPlus - zMinus) / (step * 2);
  const normal = new THREE.Vector3(-dHx, 1, -dHz).normalize();
  const grade = Math.hypot(dHx, dHz);
  const water = sampleWater(position);

  return {
    height: Number(center.height.toFixed(3)),
    normal: {
      x: Number(normal.x.toFixed(3)),
      y: Number(normal.y.toFixed(3)),
      z: Number(normal.z.toFixed(3))
    },
    grade: Number(grade.toFixed(3)),
    roughness: Number(THREE.MathUtils.clamp(0.35 + grade * 2.8, 0.35, 1).toFixed(3)),
    wetness: Number((water?.intensity ?? 0).toFixed(3)),
    dominantFeatureId: center.dominantFeatureId
  };
}

export const terrainConfig = {
  features: terrainFeatures,
  featureCount: terrainFeatures.length,
  linkedFeatureCount: terrainFeatures.filter((feature) => feature.linkedRouteIds.length > 0 || feature.linkedZoneIds.length > 0).length,
  orphanFeatureIds: terrainFeatures
    .filter((feature) => feature.linkedRouteIds.length === 0 && feature.linkedZoneIds.length === 0)
    .map((feature) => feature.id)
};

function sampleWater(position: THREE.Vector3) {
  let best: { region: WaterRegion; intensity: number } | null = null;
  for (const region of waterRegions) {
    const local = rotatePoint(position.x - region.center[0], position.z - region.center[1], region.rotation);
    const distance = (local.x / region.radiusX) ** 2 + (local.z / region.radiusZ) ** 2;
    const halo = 1.45;
    if (distance <= halo * halo) {
      const intensity = THREE.MathUtils.clamp(1 - Math.sqrt(distance) / halo, 0, 1);
      if (!best || intensity > best.intensity) {
        best = { region, intensity };
      }
    }
  }
  return best;
}

function sampleRamp(position: THREE.Vector3) {
  let best: { region: RampRegion; intensity: number; pitch: number; roll: number; rideHeight: number } | null = null;
  for (const region of rampRegions) {
    const local = rotatePoint(position.x - region.center[0], position.z - region.center[1], region.rotation);
    const halfWidth = region.width * 0.52;
    const halfDepth = region.depth * 0.72;
    if (Math.abs(local.x) > halfWidth || Math.abs(local.z) > halfDepth) {
      continue;
    }
    const lateralFalloff = 1 - Math.abs(local.x) / halfWidth;
    const forwardT = THREE.MathUtils.clamp(local.z / halfDepth, -1, 1);
    const rampT = (forwardT * region.direction + 1) * 0.5;
    const intensity = Math.max(0, lateralFalloff) * (0.45 + rampT * 0.55);
    const pitch = -region.direction * region.height * 1.25;
    const roll = THREE.MathUtils.clamp(-local.x / halfWidth, -1, 1) * region.height * 0.75;
    const rideHeight = region.height * (0.25 + rampT * 0.75) * Math.max(0.35, lateralFalloff);
    if (!best || intensity > best.intensity) {
      best = { region, intensity, pitch, roll, rideHeight };
    }
  }
  return best;
}

export function sampleWorldMaterial(position: THREE.Vector3, onRoute: boolean): WorldMaterialSample {
  const water = sampleWater(position);
  if (water) {
    const intensity = Number(water.intensity.toFixed(3));
    return {
      kind: "water",
      id: water.region.id,
      intensity,
      speedMultiplier: 0.78,
      accelerationMultiplier: 0.82,
      lateralGripMultiplier: 0.66,
      driftGripMultiplier: 0.58,
      dragMultiplier: 1.72,
      rideHeight: -0.035,
      pitch: 0,
      roll: Math.sin(position.x * 1.7 + position.z * 0.9) * 0.035 * intensity
    };
  }

  const ramp = sampleRamp(position);
  if (ramp) {
    return {
      kind: "ramp",
      id: ramp.region.id,
      intensity: Number(ramp.intensity.toFixed(3)),
      speedMultiplier: 1.05,
      accelerationMultiplier: 1,
      lateralGripMultiplier: 0.86,
      driftGripMultiplier: 0.74,
      dragMultiplier: 0.92,
      rideHeight: Number(ramp.rideHeight.toFixed(3)),
      pitch: Number(ramp.pitch.toFixed(3)),
      roll: Number(ramp.roll.toFixed(3))
    };
  }

  return onRoute ? roadSample : fieldSample;
}

export const worldMaterialRegions = {
  water: waterRegions,
  ramps: rampRegions
};
