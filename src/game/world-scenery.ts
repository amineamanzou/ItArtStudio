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
  motionObjectCount: number;
  identityRibbon: THREE.Object3D | null;
};

type SceneRole =
  | "terrain-edge"
  | "tech-skyline"
  | "art-sculpture"
  | "studio-threshold"
  | "identity-ribbon"
  | "route-light";
type MotionBehavior = "pulse" | "sweep" | "tilt" | "float" | "blink" | "instance-pulse";

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

const beam = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  radius: number,
  mat: THREE.Material
) => {
  const curve = new THREE.LineCurve3(new THREE.Vector3(...from), new THREE.Vector3(...to));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 1, radius, 6), mat);
};

const tag = (
  object: THREE.Object3D,
  role: SceneRole,
  signature: string,
  motionBehavior?: MotionBehavior,
  semanticRoleCount = 1,
  semanticObjectCount = 1,
  semanticMotionCount = motionBehavior ? 1 : 0
) => {
  object.userData.worldSceneryRole = role;
  object.userData.worldScenerySignature = signature;
  object.userData.worldSceneryRoleCount = semanticRoleCount;
  object.userData.worldSceneryObjectCount = semanticObjectCount;
  if (motionBehavior) {
    object.userData.localMotionBehavior = motionBehavior;
    object.userData.worldSceneryMotionCount = semanticMotionCount;
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
  let motionObjectCount = 0;
  let terrainLayers = 0;

  const add = (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number } = {}
  ) => {
    const semanticObjectCount = options.objectCount ?? countMeshes(object);
    const semanticRoleCount = options.roleCount ?? 1;
    const semanticMotionCount = options.motionCount ?? (motionBehavior ? 1 : 0);
    tag(object, role, signature, motionBehavior, semanticRoleCount, semanticObjectCount, semanticMotionCount);
    group.add(object);
    objectCount += semanticObjectCount;
    for (const item of options.signatures ?? [signature]) {
      signatures.add(item);
    }
    if (motionBehavior) {
      motionObjects.push(object);
      motionObjectCount += semanticMotionCount;
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
    ["outer-cut", 17.8, 1.18, 0.92, -0.012, terrainShade, -0.18],
    ["field-shelf", 16.7, 1.12, 0.88, 0.0, terrainMat, 0.14],
    ["tech-ledge", 4.2, 1.7, 0.8, 0.05, techMat, -0.16, -6.9, -0.6],
    ["art-ledge", 4.35, 1.62, 0.86, 0.065, artMat, 0.18, 6.9, -0.4],
    ["studio-ledge", 4.25, 1.03, 1.12, 0.08, studioMat, 0.06, 0, 1.2]
  ] as const;

  for (const [id, radius, scaleX, scaleZ, y, mat, rotation, x = 0, z = 0] of terrainSpecs) {
    const shelf = new THREE.Mesh(new THREE.CircleGeometry(radius, 7), mat);
    shelf.rotation.x = -Math.PI * 0.5;
    shelf.rotation.z = rotation;
    shelf.position.set(x, y, z);
    shelf.scale.set(scaleX, 1, scaleZ);
    shelf.renderOrder = -3;
    shelf.receiveShadow = true;
    add(shelf, "terrain-edge", `terrain:${id}`);
    terrainLayers += 1;
  }

  addTechSkyline(add, techMat, roadMat, inkMat);
  addArtSculptures(add, artMat, roadMat, inkMat);
  addStudioThreshold(add, studioMat, techMat, artMat, roadMat);
  const identityRibbon = addIdentityRibbon(add, palette, roadMat, inkMat);
  addRouteLights(add, worldRoutes, roadMat);

  return { group, objectCount, terrainLayers, signatures, motionObjects, motionObjectCount, identityRibbon };
}

function addIdentityRibbon(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  palette: WorldSceneryPalette,
  roadMat: THREE.Material,
  inkMat: THREE.Material
) {
  const ribbon = new THREE.Group();
  ribbon.name = "it-art-studio-identity-ribbon";
  ribbon.position.set(0, 0, -1.08);
  ribbon.rotation.y = 0.04;

  const tileMaterial = new THREE.MeshStandardMaterial({
    color: palette.road,
    roughness: 0.34,
    metalness: 0.36,
    emissive: palette.studio,
    emissiveIntensity: 0.16,
    vertexColors: true
  });
  const tileGeometry = new THREE.BoxGeometry(0.32, 0.055, 0.42);
  const tileCount = 21;
  const tiles = new THREE.InstancedMesh(tileGeometry, tileMaterial, tileCount);
  const tileDummy = new THREE.Object3D();
  const tileColor = new THREE.Color();

  for (let index = 0; index < tileCount; index += 1) {
    const t = index / (tileCount - 1);
    const x = -3.15 + t * 6.3;
    const wave = Math.sin(t * Math.PI * 2);
    tileDummy.position.set(x, 1.48 + Math.sin(t * Math.PI) * 0.22, wave * 0.18);
    tileDummy.rotation.set(0.18 * wave, -0.55 + t * 1.1, 0.18 * Math.sin(t * Math.PI * 3));
    tileDummy.scale.setScalar(1 + Math.sin(t * Math.PI) * 0.18);
    tileDummy.updateMatrix();
    tiles.setMatrixAt(index, tileDummy.matrix);
    tileColor.setHex(index < tileCount * 0.38 ? palette.tech : index > tileCount * 0.62 ? palette.art : palette.studio);
    tiles.setColorAt(index, tileColor);
  }
  tiles.instanceMatrix.needsUpdate = true;
  if (tiles.instanceColor) {
    tiles.instanceColor.needsUpdate = true;
  }
  tiles.userData.identityRibbonPart = "instanced-tiles";
  ribbon.add(tiles);

  const pixelMaterial = new THREE.MeshStandardMaterial({
    color: palette.road,
    roughness: 0.5,
    metalness: 0.2,
    emissive: palette.road,
    emissiveIntensity: 0.14,
    vertexColors: true
  });
  const pixelGeometry = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  const pixelCount = 36;
  const pixels = new THREE.InstancedMesh(pixelGeometry, pixelMaterial, pixelCount);
  const pixelDummy = new THREE.Object3D();
  const pixelColor = new THREE.Color();

  for (let index = 0; index < pixelCount; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const lane = Math.floor(index / 2);
    const t = lane / Math.max(1, pixelCount / 2 - 1);
    const x = -2.65 + t * 5.3;
    pixelDummy.position.set(x, 1.06 + (index % 3) * 0.11, side * (0.42 + (lane % 4) * 0.055));
    pixelDummy.rotation.set(0.2 * side, t * Math.PI, 0.1 * lane);
    pixelDummy.scale.setScalar(0.82 + (lane % 5) * 0.08);
    pixelDummy.updateMatrix();
    pixels.setMatrixAt(index, pixelDummy.matrix);
    pixelColor.setHex(side < 0 ? palette.tech : lane % 3 === 0 ? palette.studio : palette.art);
    pixels.setColorAt(index, pixelColor);
  }
  pixels.instanceMatrix.needsUpdate = true;
  if (pixels.instanceColor) {
    pixels.instanceColor.needsUpdate = true;
  }
  pixels.userData.identityRibbonPart = "instanced-pixels";
  ribbon.add(pixels);

  const plate = box([5.9, 0.5, 0.08], inkMat, [0, 1.78, 0]);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(5.62, 0.36), createIdentityWordmarkMaterial(palette));
  face.position.set(0, 1.78, 0.046);
  ribbon.add(plate, face, beam([-2.82, 1.48, -0.02], [2.82, 1.48, -0.02], 0.018, roadMat));
  add(ribbon, "identity-ribbon", "identity-ribbon:it-studio-art", "sweep", {
    objectCount: tileCount + pixelCount + 3,
    roleCount: 1,
    motionCount: 1
  });
  return ribbon;
}

function createIdentityWordmarkMaterial(palette: WorldSceneryPalette) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 192;
  const context = canvas.getContext("2d");

  if (context) {
    context.fillStyle = "#080b10";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#fff7df";
    context.lineWidth = 12;
    context.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.font = "900 78px system-ui, sans-serif";
    context.fillStyle = `#${palette.tech.toString(16).padStart(6, "0")}`;
    context.fillText("IT", 190, canvas.height / 2 + 2);
    context.fillStyle = `#${palette.studio.toString(16).padStart(6, "0")}`;
    context.font = "900 70px system-ui, sans-serif";
    context.fillText("STUDIO", 512, canvas.height / 2 + 2);
    context.fillStyle = `#${palette.art.toString(16).padStart(6, "0")}`;
    context.font = "900 78px system-ui, sans-serif";
    context.fillText("ART", 836, canvas.height / 2 + 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: texture });
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
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
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
  const threshold = new THREE.Group();
  threshold.name = "studio-threshold-batched-pylons";
  const bodyGeometry = new THREE.BoxGeometry(0.16, 1.18, 0.16);
  const capGeometry = new THREE.BoxGeometry(0.72, 0.08, 0.12);
  const nodeGeometry = new THREE.SphereGeometry(0.12, 12, 8);
  const techBodies = new THREE.InstancedMesh(bodyGeometry, techMat, 1);
  const artBodies = new THREE.InstancedMesh(bodyGeometry, artMat, 1);
  const studioBodies = new THREE.InstancedMesh(bodyGeometry, studioMat, 2);
  const caps = new THREE.InstancedMesh(capGeometry, roadMat, anchors.length);
  const techNodes = new THREE.InstancedMesh(nodeGeometry, techMat, 1);
  const artNodes = new THREE.InstancedMesh(nodeGeometry, artMat, 1);
  const studioNodes = new THREE.InstancedMesh(nodeGeometry, studioMat, 2);
  const dummy = new THREE.Object3D();
  let studioIndex = 0;

  anchors.forEach(([x, z, mat], index) => {
    const rotationY = index < 2 ? 0.48 : -0.32;
    const instanceIndex = mat === studioMat ? studioIndex : 0;
    const bodyMesh = mat === techMat ? techBodies : mat === artMat ? artBodies : studioBodies;
    const nodeMesh = mat === techMat ? techNodes : mat === artMat ? artNodes : studioNodes;

    dummy.position.set(x, 0.68, z);
    dummy.rotation.set(0, rotationY, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    bodyMesh.setMatrixAt(instanceIndex, dummy.matrix);

    dummy.position.set(x, 1.26, z);
    dummy.updateMatrix();
    caps.setMatrixAt(index, dummy.matrix);

    dummy.position.set(x + Math.cos(rotationY) * 0.36, 1.28, z - Math.sin(rotationY) * 0.36);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(instanceIndex, dummy.matrix);

    if (mat === studioMat) {
      studioIndex += 1;
    }
  });
  [techBodies, artBodies, studioBodies, caps, techNodes, artNodes, studioNodes].forEach((mesh) => {
    mesh.instanceMatrix.needsUpdate = true;
    threshold.add(mesh);
  });
  add(threshold, "studio-threshold", "studio-threshold:batched-pylons", "sweep", {
    signatures: anchors.map((_, index) => `studio-threshold:${index}`),
    objectCount: anchors.length * 3,
    roleCount: anchors.length,
    motionCount: anchors.length
  });
}

function addRouteLights(
  add: (
    object: THREE.Object3D,
    role: SceneRole,
    signature: string,
    motionBehavior?: MotionBehavior,
    options?: { signatures?: string[]; objectCount?: number; roleCount?: number; motionCount?: number }
  ) => void,
  routes: WorldRoute[],
  roadMat: THREE.Material
) {
  const markers = sampleRouteMarkers(routes);
  if (markers.length === 0) {
    return;
  }
  const lights = new THREE.Group();
  lights.name = "route-light-instances";
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.026, 0.036, 0.5, 8), roadMat, markers.length);
  const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 12, 8), roadMat, markers.length);
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();

  markers.forEach((marker, index) => {
    quaternion.setFromEuler(new THREE.Euler(0, marker.angle, 0));
    matrix.compose(new THREE.Vector3(marker.x, 0.34, marker.z), quaternion, new THREE.Vector3(1, 1, 1));
    stems.setMatrixAt(index, matrix);
    matrix.compose(new THREE.Vector3(marker.x, 0.64, marker.z), quaternion, new THREE.Vector3(1, 1, 1));
    caps.setMatrixAt(index, matrix);
  });
  stems.instanceMatrix.needsUpdate = true;
  caps.instanceMatrix.needsUpdate = true;
  stems.userData.worldSceneryPart = "route-light-stem";
  caps.userData.worldSceneryPart = "route-light-cap";
  lights.add(stems, caps);

  add(lights, "route-light", "route-light:instanced", "instance-pulse", {
    signatures: markers.map((marker, index) => `route-light:${marker.route.id}:${index}`),
    objectCount: markers.length * 2,
    roleCount: markers.length,
    motionCount: markers.length
  });
}

function sampleRouteMarkers(routes: WorldRoute[]) {
  const zoneById = new Map(zones.map((zone) => [zone.id, zone]));
  return routes.flatMap((route) => {
    const from = zoneById.get(route.from);
    const to = zoneById.get(route.to);
    if (!from || !to) {
      return [];
    }
    const points = [from.position, ...(route.via ?? []), to.position];
    const middle = points[Math.floor(points.length / 2)];
    const next = points[Math.min(points.length - 1, Math.floor(points.length / 2) + 1)];
    return [
      {
        route,
        x: middle[0],
        z: middle[1],
        angle: Math.atan2(next[0] - middle[0], next[1] - middle[1])
      }
    ];
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
