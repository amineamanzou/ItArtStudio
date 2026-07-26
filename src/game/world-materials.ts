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
  { id: "tech-harbor", center: [-6.6, -8.7], radiusX: 2.7, radiusZ: 2.21, rotation: -0.18 },
  { id: "art-lagoon", center: [7.3, -7.5], radiusX: 2.4, radiusZ: 1.73, rotation: 0.24 },
  { id: "studio-canal", center: [0, 9.15], radiusX: 3.5, radiusZ: 1.26, rotation: 0.02 }
];

const rampRegions: RampRegion[] = [
  { id: "tech-delta", center: [-4.8, -4.7], width: 2.7, depth: 1.05, rotation: -0.52, height: 0.22, direction: 1 },
  { id: "obs-rise", center: [-7.6, 1.15], width: 2.9, depth: 0.92, rotation: 0.08, height: 0.26, direction: -1 },
  { id: "art-sweep", center: [4.85, -3.95], width: 2.8, depth: 0.9, rotation: 0.72, height: 0.22, direction: 1 },
  { id: "studio-crossing", center: [0.15, 2.9], width: 3.15, depth: 0.78, rotation: -0.18, height: 0.2, direction: -1 },
  { id: "mail-bank", center: [-0.85, -6.35], width: 2.55, depth: 0.82, rotation: 0.04, height: 0.2, direction: 1 }
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
