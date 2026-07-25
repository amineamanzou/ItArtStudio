import * as THREE from "three";
import type { WorldRoute, ZoneKind } from "./zones";
import { worldRoutes, zones } from "./zones";

export type WorldSceneryPalette = Record<ZoneKind | "ground" | "road" | "ink", number>;

export type RenderedWorldScenery = {
  group: THREE.Group;
  objectCount: number;
  terrainLayers: number;
  signatures: Set<string>;
  motionObjects: THREE.Object3D[];
};

type SceneRole = "terrain-edge" | "tech-skyline" | "art-sculpture" | "studio-threshold" | "route-light";
type MotionBehavior = "pulse" | "sweep" | "tilt" | "float" | "blink";

const material = (color: number, emissive = 0.06, metalness = 0.14, opacity = 1) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.62,
    metalness,
    emissive: color,
    emissiveIntensity: emissive,
    transparent: opacity < 1,
    opacity
  });

const box = (size: readonly [number, number, number], mat: THREE.Material, position: readonly [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const cylinder = (
  radiusTop: number,
  radiusBottom: number,
  height: number,
  mat: THREE.Material,
  position: readonly [number, number, number],
  segments = 10
) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const sphere = (radius: number, mat: THREE.Material, position: readonly [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const torus = (radius: number, tube: number, mat: THREE.Material, position: readonly [number, number, number]) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 56), mat);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.x = Math.PI * 0.5;
  return mesh;
};

const tag = (
  object: THREE.Object3D,
  role: SceneRole,
  signature: string,
  motionBehavior?: MotionBehavior
) => {
  object.userData.worldSceneryRole = role;
  object.userData.worldScenerySignature = signature;
  if (motionBehavior) {
    object.userData.localMotionBehavior = motionBehavior;
  }
  object.userData.motionBaseX = object.position.x;
  object.userData.motionBaseY = object.position.y;
  object.userData.motionBaseZ = object.position.z;
  object.userData.motionBaseRotationX = object.rotation.x;
  object.userData.motionBaseRotationY = object.rotation.y;
  object.userData.motionBaseRotationZ = object.rotation.z;
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = false;
      child.receiveShadow = true;
    }
  });
  return object;
};

export function createWorldScenery(palette: WorldSceneryPalette): RenderedWorldScenery {
  const group = new THREE.Group();
  group.name = "studio-world-scenery";

  const signatures = new Set<string>();
  const motionObjects: THREE.Object3D[] = [];
  let objectCount = 0;
  let terrainLayers = 0;

  const add = (object: THREE.Object3D, role: SceneRole, signature: string, motionBehavior?: MotionBehavior) => {
    tag(object, role, signature, motionBehavior);
    group.add(object);
    objectCount += countMeshes(object);
    signatures.add(signature);
    if (motionBehavior) {
      motionObjects.push(object);
    }
  };

  const terrainMat = material(palette.ground, 0.02, 0.04, 0.74);
  const terrainShade = material(palette.ink, 0.01, 0.02, 0.62);
  const roadMat = material(palette.road, 0.14, 0.12, 0.92);
  const techMat = material(palette.tech, 0.2, 0.24, 0.94);
  const artMat = material(palette.art, 0.2, 0.12, 0.94);
  const studioMat = material(palette.studio, 0.2, 0.14, 0.94);
  const inkMat = material(palette.ink, 0.02, 0.1, 0.9);

  const terrainSpecs = [
    ["outer-cut", 13.35, 1.2, 0.92, 0.0, terrainShade, -0.18],
    ["field-shelf", 12.5, 1.12, 0.88, 0.018, terrainMat, 0.14],
    ["tech-ledge", 4.2, 1.7, 0.8, 0.045, techMat, -0.16, -6.9, -0.6],
    ["art-ledge", 4.35, 1.62, 0.86, 0.05, artMat, 0.18, 6.9, -0.4],
    ["studio-ledge", 4.25, 1.03, 1.12, 0.058, studioMat, 0.06, 0, 1.2]
  ] as const;

  for (const [id, radius, scaleX, scaleZ, y, mat, rotation, x = 0, z = 0] of terrainSpecs) {
    const shelf = new THREE.Mesh(new THREE.CircleGeometry(radius, 7), mat);
    shelf.rotation.x = -Math.PI * 0.5;
    shelf.rotation.z = rotation;
    shelf.position.set(x, y, z);
    shelf.scale.set(scaleX, 1, scaleZ);
    shelf.receiveShadow = true;
    add(shelf, "terrain-edge", `terrain:${id}`);
    terrainLayers += 1;
  }

  addTechSkyline(add, techMat, roadMat, inkMat);
  addArtSculptures(add, artMat, roadMat, inkMat);
  addStudioThreshold(add, studioMat, techMat, artMat, roadMat);
  addRouteLights(add, worldRoutes, roadMat);

  return { group, objectCount, terrainLayers, signatures, motionObjects };
}

function addTechSkyline(
  add: (object: THREE.Object3D, role: SceneRole, signature: string, motionBehavior?: MotionBehavior) => void,
  techMat: THREE.Material,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const anchors = [
    [-9.1, -5.7, 1.2],
    [-8.7, 5.1, 1.0],
    [-4.4, 6.7, 0.82],
    [-1.3, -6.8, 0.96]
  ] as const;

  anchors.forEach(([x, z, height], index) => {
    const stack = new THREE.Group();
    stack.position.set(x, 0, z);
    stack.rotation.y = index * 0.34;
    stack.add(box([0.34, height, 0.34], inkMat, [0, 0.18 + height / 2, 0]));
    stack.add(box([0.42, 0.08, 0.42], techMat, [0, height + 0.36, 0]));
    stack.add(box([0.72, 0.045, 0.08], roadMat, [0, height + 0.56, 0.22]));
    stack.add(sphere(0.09, techMat, [0.32, height + 0.58, 0.22]));
    add(stack, "tech-skyline", `tech-skyline:${index}`, index % 2 === 0 ? "blink" : "pulse");
  });
}

function addArtSculptures(
  add: (object: THREE.Object3D, role: SceneRole, signature: string, motionBehavior?: MotionBehavior) => void,
  artMat: THREE.Material,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const anchors = [
    [9.1, -5.4, 0.2],
    [9.3, 3.9, -0.36],
    [4.6, 7.2, 0.52],
    [2.3, -7.5, 0.08]
  ] as const;

  anchors.forEach(([x, z, rotation], index) => {
    const sculpture = new THREE.Group();
    sculpture.position.set(x, 0, z);
    sculpture.rotation.y = rotation;
    const frame = torus(0.42 + index * 0.035, 0.026, artMat, [0, 0.78, 0]);
    frame.rotation.x = Math.PI * 0.32;
    frame.rotation.z = index * 0.28;
    sculpture.add(frame);
    sculpture.add(box([0.08, 0.86, 0.08], roadMat, [-0.38, 0.54, -0.08]));
    sculpture.add(box([0.08, 0.86, 0.08], inkMat, [0.38, 0.54, 0.08]));
    sculpture.add(sphere(0.14, artMat, [0, 1.06, 0.28]));
    add(sculpture, "art-sculpture", `art-sculpture:${index}`, index % 2 === 0 ? "tilt" : "float");
  });
}

function addStudioThreshold(
  add: (object: THREE.Object3D, role: SceneRole, signature: string, motionBehavior?: MotionBehavior) => void,
  studioMat: THREE.Material,
  techMat: THREE.Material,
  artMat: THREE.Material,
  roadMat: THREE.Material
) {
  const anchors = [
    [-2.1, -2.5, techMat],
    [2.1, -2.5, artMat],
    [-1.9, 3.3, studioMat],
    [1.9, 3.3, studioMat]
  ] as const;

  anchors.forEach(([x, z, mat], index) => {
    const pylon = new THREE.Group();
    pylon.position.set(x, 0, z);
    pylon.rotation.y = index < 2 ? 0.48 : -0.32;
    pylon.add(box([0.16, 1.18, 0.16], mat, [0, 0.68, 0]));
    pylon.add(box([0.72, 0.08, 0.12], roadMat, [0, 1.26, 0]));
    pylon.add(sphere(0.12, mat, [0.36, 1.28, 0]));
    add(pylon, "studio-threshold", `studio-threshold:${index}`, "sweep");
  });
}

function addRouteLights(
  add: (object: THREE.Object3D, role: SceneRole, signature: string, motionBehavior?: MotionBehavior) => void,
  routes: WorldRoute[],
  roadMat: THREE.Material
) {
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  routes.forEach((route, index) => {
    const from = zoneById.get(route.from);
    const to = zoneById.get(route.to);
    if (!from || !to) {
      return;
    }
    const points = [from.position, ...(route.via ?? []), to.position];
    const middle = points[Math.floor(points.length / 2)];
    const light = new THREE.Group();
    light.position.set(middle[0], 0, middle[1]);
    light.add(cylinder(0.026, 0.036, 0.5, roadMat, [0, 0.34, 0], 8));
    light.add(sphere(0.09, roadMat, [0, 0.64, 0]));
    add(light, "route-light", `route-light:${route.id}:${index}`, "pulse");
  });
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
