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
  { id: "tech-harbor", center: [-11.8, -20.2], radiusX: 4.8, radiusZ: 3.2, rotation: -0.24 },
  { id: "art-lagoon", center: [18.8, -16.8], radiusX: 4.35, radiusZ: 2.7, rotation: 0.28 },
  { id: "studio-canal", center: [0, 23.6], radiusX: 6.45, radiusZ: 1.9, rotation: 0.02 },
  { id: "foundry-cooling-pool", center: [21.4, 3.6], radiusX: 3.15, radiusZ: 2.05, rotation: -0.36 },
  { id: "north-reflection-cut", center: [-12.4, 21.8], radiusX: 3.4, radiusZ: 1.55, rotation: 0.2 },
  { id: "south-postal-basin", center: [8.6, -23.4], radiusX: 3.2, radiusZ: 1.7, rotation: -0.08 }
];

const rampRegions: RampRegion[] = [
  { id: "tech-delta", center: [-9.8, -13.6], width: 4.05, depth: 1.38, rotation: -0.48, height: 0.28, direction: 1 },
  { id: "obs-rise", center: [-16.6, 3.2], width: 4.15, depth: 1.2, rotation: 0.07, height: 0.31, direction: -1 },
  { id: "art-sweep", center: [12.1, -9.1], width: 4.08, depth: 1.22, rotation: 0.72, height: 0.27, direction: 1 },
  { id: "studio-crossing", center: [0.3, 7.4], width: 4.72, depth: 1.05, rotation: -0.18, height: 0.24, direction: -1 },
  { id: "mail-bank", center: [-1.3, -17.2], width: 3.8, depth: 1.1, rotation: 0.04, height: 0.24, direction: 1 },
  { id: "foundry-roll", center: [15.8, 2.25], width: 3.7, depth: 1.12, rotation: -0.34, height: 0.25, direction: -1 },
  { id: "north-shelf", center: [-8.4, 20.2], width: 3.6, depth: 1.02, rotation: 0.22, height: 0.22, direction: 1 },
  { id: "south-shelf", center: [6.8, -20.9], width: 3.4, depth: 1.04, rotation: -0.16, height: 0.22, direction: -1 }
];

const terrainFeatures: TerrainFeature[] = [
  { id: "tech-ridge", kind: "ridge", center: [-16.2, 0.8], radiusX: 11.2, radiusZ: 5.2, rotation: -0.24, height: 0.39 },
  { id: "art-mound", kind: "mound", center: [15.4, 2.4], radiusX: 9.4, radiusZ: 5.6, rotation: 0.36, height: 0.34 },
  { id: "studio-spine", kind: "ridge", center: [0, 8.8], radiusX: 4.3, radiusZ: 13.2, rotation: -0.06, height: 0.3 },
  { id: "contact-basin", kind: "basin", center: [0.1, -18.6], radiusX: 6.9, radiusZ: 3.75, rotation: 0.02, height: -0.29 },
  { id: "harbor-cut", kind: "basin", center: [-11.6, -19.0], radiusX: 7.2, radiusZ: 4.45, rotation: -0.18, height: -0.25 },
  { id: "atelier-lift", kind: "mound", center: [14.4, -8.4], radiusX: 6.25, radiusZ: 3.5, rotation: 0.42, height: 0.28 },
  { id: "outer-field-roll", kind: "ridge", center: [0, -25.0], radiusX: 17.2, radiusZ: 3.05, rotation: 0.04, height: 0.18 },
  { id: "north-reflection-ridge", kind: "ridge", center: [-8.2, 21.6], radiusX: 9.4, radiusZ: 2.65, rotation: 0.18, height: 0.2 },
  { id: "east-foundry-shelf", kind: "mound", center: [22.4, 8.6], radiusX: 4.2, radiusZ: 6.2, rotation: -0.28, height: 0.19 },
  { id: "west-observability-cut", kind: "basin", center: [-23.2, 7.8], radiusX: 3.8, radiusZ: 6.4, rotation: 0.1, height: -0.18 }
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
  featureCount: terrainFeatures.length
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
