import * as THREE from "three";
import type { ZoneKind } from "./zones";
import { worldRoutes, zones } from "./zones";

export type RouteGuidancePalette = Record<ZoneKind | "road" | "ink", number>;

export type RenderedRouteGuidance = {
  group: THREE.Group;
  objectCount: number;
  signatures: Set<string>;
  motionObjects: THREE.Object3D[];
  roleCounts: Record<string, number>;
  visualizedSegmentCount: number;
};

const material = (color: number, emissive = 0.12, opacity = 0.88) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.5,
    metalness: 0.18,
    emissive: color,
    emissiveIntensity: emissive,
    transparent: opacity < 1,
    opacity
  });

const tag = (object: THREE.Object3D, role: string, signature: string, routeId: string) => {
  object.userData.routeGuidanceRole = role;
  object.userData.routeGuidanceSignature = signature;
  object.userData.routeGuidanceRouteId = routeId;
  object.userData.localMotionBehavior = role === "route-chevron" ? "pulse" : "blink";
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
      const chevron = new THREE.Group();
      chevron.position.set(midX, 0.18, midZ);
      chevron.rotation.y = angle;
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.034, 0.46), chevronMat);
      const right = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.034, 0.46), chevronMat);
      left.position.set(-0.13, 0, 0);
      right.position.set(0.13, 0, 0);
      left.rotation.y = 0.48;
      right.rotation.y = -0.48;
      chevron.add(left, right);
      add(chevron, "route-chevron", `route-chevron:${route.id}:${index}`, route.id);

      const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 8), studMat);
      stud.position.set(x1 + dx * 0.28, 0.16, z1 + dz * 0.28);
      stud.rotation.y = angle;
      add(stud, "route-stud", `route-stud:${route.id}:${index}`, route.id);
      visualizedSegmentCount += 1;
    }
  }

  return { group, objectCount, signatures, motionObjects, roleCounts, visualizedSegmentCount };
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
