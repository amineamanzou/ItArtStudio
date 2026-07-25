import * as THREE from "three";
import type { ZoneKind } from "./zones";
import { worldRoutes, zones } from "./zones";

export type RouteGuidancePalette = Record<ZoneKind | "road" | "ink", number>;

export type RenderedRouteGuidance = {
  group: THREE.Group;
  objectCount: number;
  signatures: Set<string>;
  motionObjects: THREE.Object3D[];
  encounterGates: RouteEncounterGate[];
  roleCounts: Record<string, number>;
  visualizedSegmentCount: number;
};

export type RouteEncounterGate = {
  id: string;
  routeId: string;
  object: THREE.Object3D;
  baseY: number;
};

const material = (color: number, emissive = 0.12, opacity = 0.88) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.18,
    emissive: color,
    emissiveIntensity: emissive,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity
  });

const createChevronGeometry = () => {
  const shape = new THREE.Shape();
  shape.moveTo(-0.29, -0.22);
  shape.lineTo(-0.09, -0.22);
  shape.lineTo(0, 0.03);
  shape.lineTo(0.09, -0.22);
  shape.lineTo(0.29, -0.22);
  shape.lineTo(0.1, 0.24);
  shape.lineTo(-0.1, 0.24);
  shape.lineTo(-0.29, -0.22);
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI * 0.5);
  geometry.computeVertexNormals();
  return geometry;
};

const chevronGeometry = createChevronGeometry();

const tag = (object: THREE.Object3D, role: string, signature: string, routeId: string) => {
  object.userData.routeGuidanceRole = role;
  object.userData.routeGuidanceSignature = signature;
  object.userData.routeGuidanceRouteId = routeId;
  object.userData.localMotionBehavior =
    role === "route-chevron" ? "pulse" : role === "route-encounter-gate" ? "encounter-idle" : "blink";
  object.userData.motionBaseY = object.position.y;
  object.userData.motionBaseRotationY = object.rotation.y;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });
  return object;
};

export function createRouteGuidance(palette: RouteGuidancePalette): RenderedRouteGuidance {
  const group = new THREE.Group();
  group.name = "route-guidance";
  const signatures = new Set<string>();
  const motionObjects: THREE.Object3D[] = [];
  const encounterGates: RouteEncounterGate[] = [];
  const roleCounts: Record<string, number> = {};
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  let objectCount = 0;
  let visualizedSegmentCount = 0;

  const add = (object: THREE.Object3D, role: string, signature: string, routeId: string, animated = true) => {
    tag(object, role, signature, routeId);
    group.add(object);
    objectCount += countMeshes(object);
    signatures.add(signature);
    roleCounts[role] = (roleCounts[role] ?? 0) + 1;
    if (animated) {
      motionObjects.push(object);
    }
  };

  for (const route of worldRoutes) {
    const from = zoneById.get(route.from);
    const to = zoneById.get(route.to);
    if (!from || !to) {
      continue;
    }

    const routeColor = palette[route.kind];
    const chevronMat = material(routeColor, 0.2, 0.9);
    const studMat = material(palette.road, 0.14, 0.82);
    const points = [from.position, ...(route.via ?? []), to.position];

    for (let index = 0; index < points.length - 1; index += 1) {
      const [x1, z1] = points[index];
      const [x2, z2] = points[index + 1];
      const dx = x2 - x1;
      const dz = z2 - z1;
      const length = Math.hypot(dx, dz);
      if (length <= 0.01) {
        continue;
      }

      const midX = x1 + dx * 0.5;
      const midZ = z1 + dz * 0.5;
      const angle = Math.atan2(dx, dz);
      const chevron = new THREE.Mesh(chevronGeometry, chevronMat);
      chevron.position.set(midX, 0.18, midZ);
      chevron.rotation.y = angle;
      add(chevron, "route-chevron", `route-chevron:${route.id}:${index}`, route.id);

      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 8), studMat);
      stud.position.set(x1 + dx * 0.28, 0.16, z1 + dz * 0.28);
      stud.rotation.y = angle;
      add(stud, "route-stud", `route-stud:${route.id}:${index}`, route.id);
      visualizedSegmentCount += 1;
    }

    const routeGate = createEncounterGate(route.id, routeColor, points);
    if (routeGate) {
      add(routeGate.object, "route-encounter-gate", `route-encounter:${route.id}`, route.id);
      encounterGates.push(routeGate);
    }
  }

  return { group, objectCount, signatures, motionObjects, encounterGates, roleCounts, visualizedSegmentCount };
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

function createEncounterGate(routeId: string, color: number, points: Array<[number, number]>): RouteEncounterGate | null {
  const segments = [];
  let totalLength = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, z1] = points[index];
    const [x2, z2] = points[index + 1];
    const length = Math.hypot(x2 - x1, z2 - z1);
    if (length <= 0.01) {
      continue;
    }
    segments.push({ x1, z1, x2, z2, length });
    totalLength += length;
  }
  if (segments.length === 0) {
    return null;
  }

  let remaining = totalLength * 0.52;
  let selected = segments[0];
  for (const segment of segments) {
    selected = segment;
    if (remaining <= segment.length) {
      break;
    }
    remaining -= segment.length;
  }

  const t = THREE.MathUtils.clamp(remaining / selected.length, 0.18, 0.82);
  const x = selected.x1 + (selected.x2 - selected.x1) * t;
  const z = selected.z1 + (selected.z2 - selected.z1) * t;
  const angle = Math.atan2(selected.x2 - selected.x1, selected.z2 - selected.z1);
  const gate = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.018, 8, 32),
    material(color, 0.32, 0.86)
  );
  gate.name = `route-encounter-${routeId}`;
  gate.position.set(x, 0.66, z);
  gate.rotation.y = angle;
  gate.userData.routeEncounterId = `encounter:${routeId}`;
  gate.userData.routeEncounterRouteId = routeId;
  gate.userData.motionBaseY = gate.position.y;
  gate.userData.motionBaseScale = 1;

  return {
    id: `encounter:${routeId}`,
    routeId,
    object: gate,
    baseY: gate.position.y
  };
}
