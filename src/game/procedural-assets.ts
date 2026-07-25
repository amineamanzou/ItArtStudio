import * as THREE from "three";
import type { StudioZone, ZoneKind } from "./zones";

type Palette = Record<ZoneKind | "ground" | "road" | "ink", number>;

const material = (color: number, emissive = 0.12, metalness = 0.12) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: 0.58,
    metalness,
    emissive: color,
    emissiveIntensity: emissive
  });

const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x101015, roughness: 0.74, metalness: 0.18 });
const lightMaterial = new THREE.MeshStandardMaterial({
  color: 0xfff7df,
  roughness: 0.62,
  metalness: 0.08,
  emissive: 0xffe38a,
  emissiveIntensity: 0.05
});

const setShadow = (object: THREE.Object3D) => {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  return object;
};

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
  segments = 16
) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const sphere = (
  radius: number,
  mat: THREE.Material,
  position: readonly [number, number, number],
  width = 16,
  height = 10
) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, width, height), mat);
  mesh.position.set(position[0], position[1], position[2]);
  return mesh;
};

const addRing = (group: THREE.Group, radius: number, tube: number, mat: THREE.Material, y: number, tilt = 0) => {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 48), mat);
  ring.position.y = y;
  ring.rotation.x = Math.PI * 0.5 + tilt;
  group.add(ring);
};

const createStudioGate = (accent: number, colors: Palette) => {
  const group = new THREE.Group();
  const studioMat = material(accent, 0.18, 0.16);
  const techMat = material(colors.tech, 0.18, 0.28);
  const artMat = material(colors.art, 0.18, 0.1);

  group.add(box([0.3, 1.4, 0.42], techMat, [-0.62, 0.8, 0]));
  group.add(box([0.3, 1.4, 0.42], artMat, [0.62, 0.8, 0]));
  group.add(box([1.54, 0.24, 0.42], studioMat, [0, 1.48, 0]));
  addRing(group, 0.92, 0.045, studioMat, 0.72);
  group.add(sphere(0.34, lightMaterial, [0, 0.84, 0], 18, 12));
  return group;
};

const createAiLab = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.2, 0.32);
  const nodes = [
    [-0.42, 0.92, -0.1],
    [0.02, 1.22, 0.22],
    [0.45, 0.88, -0.06],
    [-0.05, 0.68, -0.38]
  ] as const;

  group.add(box([1.2, 0.16, 0.9], darkMaterial, [0, 0.36, 0]));
  for (const node of nodes) {
    group.add(sphere(0.14, mat, node, 14, 8));
  }
  for (let index = 0; index < nodes.length; index += 1) {
    const a = new THREE.Vector3(...nodes[index]);
    const b = new THREE.Vector3(...nodes[(index + 1) % nodes.length]);
    const curve = new THREE.CatmullRomCurve3([a, b]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 1, 0.018, 6), mat));
  }
  group.add(box([0.72, 0.52, 0.08], mat, [0, 0.72, 0.44]));
  return group;
};

const createObservabilityTower = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.22, 0.32);

  group.add(cylinder(0.18, 0.28, 1.35, mat, [0, 0.92, 0], 10));
  group.add(cylinder(0.54, 0.54, 0.08, darkMaterial, [0, 1.62, 0], 24));
  group.add(box([0.08, 0.58, 0.08], lightMaterial, [0, 1.62, 0]));
  addRing(group, 0.74, 0.028, mat, 1.68, 0.2);
  addRing(group, 1.02, 0.018, mat, 1.75, -0.14);
  return group;
};

const createArchitectureBridge = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.14, 0.28);

  group.add(box([1.72, 0.18, 0.42], mat, [0, 0.58, 0]));
  group.add(box([0.16, 0.82, 0.32], mat, [-0.68, 0.96, 0]));
  group.add(box([0.16, 0.82, 0.32], mat, [0.68, 0.96, 0]));
  for (const x of [-0.34, 0, 0.34]) {
    const truss = box([0.08, 0.92, 0.08], lightMaterial, [x, 0.98, 0]);
    truss.rotation.z = x <= 0 ? -0.64 : 0.64;
    group.add(truss);
  }
  return group;
};

const createCloudDock = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.16, 0.28);

  group.add(box([1.56, 0.18, 0.86], darkMaterial, [0, 0.42, 0]));
  for (const x of [-0.58, -0.18, 0.22, 0.58]) {
    group.add(box([0.08, 0.56, 0.08], mat, [x, 0.78, 0.34]));
  }
  group.add(sphere(0.28, mat, [-0.34, 1.2, -0.04], 16, 8));
  group.add(sphere(0.38, mat, [0.02, 1.28, -0.02], 16, 8));
  group.add(sphere(0.25, mat, [0.38, 1.16, -0.02], 16, 8));
  return group;
};

const createDesignAtelier = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.2, 0.1);
  const canvas = box([0.92, 0.68, 0.08], lightMaterial, [0, 1.08, 0]);
  canvas.rotation.y = -0.18;
  group.add(canvas);
  group.add(box([0.1, 1.08, 0.08], mat, [-0.48, 0.78, 0.08]));
  group.add(box([0.1, 1.08, 0.08], mat, [0.48, 0.78, 0.08]));
  group.add(box([1.2, 0.08, 0.08], mat, [0, 0.42, 0.08]));
  group.add(sphere(0.13, mat, [-0.2, 1.16, 0.08], 12, 8));
  group.add(sphere(0.13, material(0xffe38a, 0.12, 0.08), [0.18, 1.04, 0.08], 12, 8));
  return group;
};

const createFoundry = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.2, 0.12);

  group.add(box([0.12, 1.2, 0.12], mat, [-0.58, 0.94, 0]));
  group.add(box([1.12, 0.12, 0.12], mat, [0, 1.48, 0]));
  group.add(box([0.12, 0.48, 0.12], mat, [0.48, 1.22, 0]));
  const cube = box([0.42, 0.42, 0.42], lightMaterial, [0.48, 0.88, 0]);
  cube.rotation.set(0.2, 0.45, 0.15);
  group.add(cube);
  addRing(group, 0.56, 0.06, mat, 0.62, 0.44);
  return group;
};

const createFashionRoom = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.18, 0.08);

  group.add(cylinder(0.06, 0.06, 1.28, darkMaterial, [0, 0.96, 0], 12));
  group.add(sphere(0.17, lightMaterial, [0, 1.72, 0], 14, 8));
  const torso = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.86, 4), mat);
  torso.position.y = 1.1;
  torso.rotation.y = Math.PI * 0.25;
  group.add(torso);
  group.add(cylinder(0.55, 0.22, 0.18, mat, [0, 0.64, 0], 18));
  return group;
};

const createValuesPlaza = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.16, 0.12);

  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI * 0.5 + Math.PI * 0.25;
    group.add(cylinder(0.11, 0.14, 0.88, mat, [Math.cos(angle) * 0.58, 0.74, Math.sin(angle) * 0.58], 8));
  }
  addRing(group, 0.82, 0.04, lightMaterial, 1.22);
  group.add(sphere(0.24, mat, [0, 1.34, 0], 14, 10));
  return group;
};

const createContactPortal = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.22, 0.14);

  group.add(box([0.18, 1.3, 0.18], mat, [-0.58, 0.92, 0]));
  group.add(box([0.18, 1.3, 0.18], mat, [0.58, 0.92, 0]));
  group.add(box([1.34, 0.18, 0.18], mat, [0, 1.52, 0]));
  const envelope = box([0.78, 0.48, 0.08], lightMaterial, [0, 0.94, 0.08]);
  group.add(envelope);
  const flap = box([0.5, 0.04, 0.06], mat, [0, 0.98, 0.14]);
  flap.rotation.z = 0.62;
  group.add(flap);
  addRing(group, 0.78, 0.035, mat, 0.82, 0.12);
  return group;
};

export function createZoneLandmark(zone: StudioZone, colors: Palette) {
  const accent = colors[zone.kind];
  const landmark =
    zone.id === "studio-gate"
      ? createStudioGate(accent, colors)
      : zone.id === "ai-lab"
        ? createAiLab(accent)
        : zone.id === "observability-tower"
          ? createObservabilityTower(accent)
          : zone.id === "architecture-bridge"
            ? createArchitectureBridge(accent)
            : zone.id === "cloud-dock"
              ? createCloudDock(accent)
              : zone.id === "design-atelier"
                ? createDesignAtelier(accent)
                : zone.id === "three-d-foundry"
                  ? createFoundry(accent)
                  : zone.id === "fashion-room"
                    ? createFashionRoom(accent)
                    : zone.id === "values-plaza"
                      ? createValuesPlaza(accent)
                      : createContactPortal(accent);

  landmark.userData.zoneId = zone.id;
  landmark.position.y = 0.12;
  return setShadow(landmark);
}
