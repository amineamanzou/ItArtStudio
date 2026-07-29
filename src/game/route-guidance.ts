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
  profile: RouteEncounterProfile;
  signature: string;
  partCount: number;
  roles: string[];
};

export type RouteEncounterProfile = "studio-threshold" | "tech-checkpoint" | "art-runway" | "contact-mail-gate";

type RouteGeometryPart = {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation?: [number, number, number];
  role: string;
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

const routeEncounterProgressOverrides: Record<string, number> = {
  "art-gate-design": 0.22
};

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
      add(routeGate.object, "route-encounter-gate", routeGate.signature, route.id);
      for (const role of routeGate.roles) {
        signatures.add(`route-encounter-role:${routeGate.profile}:${role}`);
      }
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

  let remaining = totalLength * (routeEncounterProgressOverrides[routeId] ?? 0.52);
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
  const profile = getRouteEncounterProfile(routeId);
  const parts = createEncounterParts(profile);
  const signature = `route-encounter:${profile}:${routeId}:${parts.map((part) => part.role).join("+")}`;
  const gate = new THREE.Mesh(mergeGeometryParts(parts), material(color, 0.36, 0.88));
  gate.name = `route-encounter-${routeId}`;
  gate.position.set(x, 0.66, z);
  gate.rotation.y = angle;
  gate.userData.routeEncounterId = `encounter:${routeId}`;
  gate.userData.routeEncounterRouteId = routeId;
  gate.userData.routeEncounterProfile = profile;
  gate.userData.routeEncounterPartCount = parts.length;
  gate.userData.routeEncounterRoles = parts.map((part) => part.role);
  gate.userData.routeEncounterSignature = signature;
  gate.userData.motionBaseY = gate.position.y;
  gate.userData.motionBaseScale = 1;

  return {
    id: `encounter:${routeId}`,
    routeId,
    object: gate,
    baseY: gate.position.y,
    profile,
    signature,
    partCount: parts.length,
    roles: parts.map((part) => part.role)
  };
}

function getRouteEncounterProfile(routeId: string): RouteEncounterProfile {
  if (routeId.includes("contact")) {
    return "contact-mail-gate";
  }
  if (routeId.startsWith("tech-")) {
    return "tech-checkpoint";
  }
  if (routeId.startsWith("art-")) {
    return "art-runway";
  }
  return "studio-threshold";
}

function createEncounterParts(profile: RouteEncounterProfile): RouteGeometryPart[] {
  const box = (
    size: [number, number, number],
    position: [number, number, number],
    role: string,
    rotation: [number, number, number] = [0, 0, 0]
  ): RouteGeometryPart => ({
    geometry: new THREE.BoxGeometry(size[0], size[1], size[2]),
    position,
    rotation,
    role
  });
  const cylinder = (
    radiusTop: number,
    radiusBottom: number,
    height: number,
    position: [number, number, number],
    role: string,
    rotation: [number, number, number] = [0, 0, 0],
    segments = 10
  ): RouteGeometryPart => ({
    geometry: new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
    position,
    rotation,
    role
  });
  const torus = (
    radius: number,
    tube: number,
    position: [number, number, number],
    role: string,
    rotation: [number, number, number] = [0, 0, 0]
  ): RouteGeometryPart => ({
    geometry: new THREE.TorusGeometry(radius, tube, 8, 36),
    position,
    rotation,
    role
  });

  if (profile === "tech-checkpoint") {
    return [
      box([1.04, 0.06, 0.34], [0, -0.52, 0], "scanner-bed"),
      box([0.18, 0.82, 0.18], [-0.54, -0.08, -0.02], "server-pylon-left"),
      box([0.18, 0.82, 0.18], [0.54, -0.08, -0.02], "server-pylon-right"),
      box([1.24, 0.08, 0.12], [0, 0.34, -0.02], "overhead-bus"),
      box([1.08, 0.035, 0.08], [0, 0.04, -0.2], "scan-line-low"),
      box([1.08, 0.035, 0.08], [0, 0.18, -0.2], "scan-line-mid"),
      box([1.08, 0.035, 0.08], [0, 0.32, -0.2], "scan-line-high"),
      torus(0.46, 0.012, [0, 0.03, 0.02], "checkpoint-field")
    ];
  }

  if (profile === "art-runway") {
    return [
      box([1.28, 0.045, 0.52], [0, -0.54, 0], "runway-deck"),
      box([0.18, 0.74, 0.08], [-0.48, -0.1, 0], "atelier-panel-left", [0, 0, -0.18]),
      box([0.18, 0.74, 0.08], [0.48, -0.1, 0], "atelier-panel-right", [0, 0, 0.18]),
      box([0.92, 0.08, 0.1], [0, 0.27, -0.04], "gallery-header"),
      torus(0.48, 0.014, [0, 0.03, 0.02], "soft-light-ring", [0, 0, Math.PI * 0.08]),
      cylinder(0.055, 0.055, 0.16, [-0.68, -0.44, 0.22], "color-pot-left"),
      cylinder(0.055, 0.055, 0.16, [0.68, -0.44, 0.22], "color-pot-right")
    ];
  }

  if (profile === "contact-mail-gate") {
    return [
      box([1.2, 0.05, 0.36], [0, -0.54, 0], "postal-floor"),
      box([0.2, 0.64, 0.2], [-0.52, -0.18, 0], "mailbox-left"),
      box([0.2, 0.64, 0.2], [0.52, -0.18, 0], "mailbox-right"),
      box([1.1, 0.08, 0.1], [0, 0.22, -0.02], "sorting-rail"),
      box([0.52, 0.035, 0.1], [-0.16, 0.36, -0.02], "mail-flag"),
      cylinder(0.11, 0.11, 0.035, [0.38, 0.36, -0.02], "stamp-disc", [Math.PI * 0.5, 0, 0], 16),
      torus(0.44, 0.014, [0, 0.02, 0.02], "reply-portal")
    ];
  }

  return [
    box([1.18, 0.05, 0.4], [0, -0.54, 0], "threshold-floor"),
    box([0.17, 0.78, 0.16], [-0.52, -0.12, 0], "tech-side-post"),
    box([0.17, 0.78, 0.16], [0.52, -0.12, 0], "art-side-post"),
    box([1.18, 0.08, 0.12], [0, 0.31, 0], "studio-crossbar"),
    box([0.1, 0.62, 0.08], [-0.18, -0.12, 0.16], "inner-border-left"),
    box([0.1, 0.62, 0.08], [0.18, -0.12, 0.16], "inner-border-right"),
    torus(0.46, 0.014, [0, 0.02, 0.02], "shared-threshold-ring")
  ];
}

function mergeGeometryParts(parts: RouteGeometryPart[]) {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const part of parts) {
    const geometry = part.geometry.clone();
    const matrix = new THREE.Matrix4();
    const rotation = new THREE.Euler(...(part.rotation ?? [0, 0, 0]));
    matrix.compose(new THREE.Vector3(...part.position), new THREE.Quaternion().setFromEuler(rotation), new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(matrix);
    const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = nonIndexed.getAttribute("position");
    const normal = nonIndexed.getAttribute("normal");
    const uv = nonIndexed.getAttribute("uv");
    for (let index = 0; index < position.count; index += 1) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      normals.push(normal?.getX(index) ?? 0, normal?.getY(index) ?? 1, normal?.getZ(index) ?? 0);
      uvs.push(uv?.getX(index) ?? 0, uv?.getY(index) ?? 0);
    }
    part.geometry.dispose();
    if (nonIndexed !== geometry) {
      nonIndexed.dispose();
    }
    geometry.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
