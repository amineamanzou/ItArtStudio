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
const shadowMaterial = new THREE.MeshStandardMaterial({ color: 0x07090d, roughness: 0.88, metalness: 0.04 });
const wireMaterial = new THREE.MeshStandardMaterial({
  color: 0xf8f0d4,
  roughness: 0.42,
  metalness: 0.22,
  emissive: 0xf8f0d4,
  emissiveIntensity: 0.08
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

const beam = (
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  radius: number,
  mat: THREE.Material
) => {
  const curve = new THREE.LineCurve3(new THREE.Vector3(...from), new THREE.Vector3(...to));
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 1, radius, 6), mat);
};

const addPedestal = (group: THREE.Group, mat: THREE.Material, width = 1.52) => {
  group.add(box([width, 0.12, 1.06], shadowMaterial, [0, 0.22, 0]));
  group.add(box([width * 0.72, 0.08, 0.78], mat, [0, 0.34, 0]));
};

const addTinySteps = (group: THREE.Group, mat: THREE.Material, z = 0.68) => {
  group.add(box([0.9, 0.05, 0.16], mat, [0, 0.32, z]));
  group.add(box([0.68, 0.05, 0.16], mat, [0, 0.39, z + 0.18]));
  group.add(box([0.46, 0.05, 0.16], mat, [0, 0.46, z + 0.34]));
};

const addMicroLights = (group: THREE.Group, mat: THREE.Material, points: Array<readonly [number, number, number]>) => {
  for (const point of points) {
    group.add(sphere(0.055, mat, point, 8, 6));
  }
};

const createStudioGate = (accent: number, colors: Palette) => {
  const group = new THREE.Group();
  const studioMat = material(accent, 0.18, 0.16);
  const techMat = material(colors.tech, 0.18, 0.28);
  const artMat = material(colors.art, 0.18, 0.1);

  addPedestal(group, studioMat, 1.74);
  group.add(box([0.3, 1.4, 0.42], techMat, [-0.62, 0.8, 0]));
  group.add(box([0.3, 1.4, 0.42], artMat, [0.62, 0.8, 0]));
  group.add(box([1.54, 0.24, 0.42], studioMat, [0, 1.48, 0]));
  group.add(box([0.1, 1.06, 0.18], wireMaterial, [-0.2, 0.92, 0.22]));
  group.add(box([0.1, 1.06, 0.18], wireMaterial, [0.2, 0.92, 0.22]));
  addRing(group, 0.92, 0.045, studioMat, 0.72);
  addRing(group, 0.58, 0.022, wireMaterial, 0.86, 0.28);
  group.add(sphere(0.34, lightMaterial, [0, 0.84, 0], 18, 12));
  addTinySteps(group, studioMat);
  addMicroLights(group, studioMat, [
    [-0.88, 1.52, 0.26],
    [0.88, 1.52, 0.26],
    [-0.34, 0.52, 0.42],
    [0.34, 0.52, 0.42]
  ]);
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

  addPedestal(group, mat);
  group.add(box([1.2, 0.16, 0.9], darkMaterial, [0, 0.36, 0]));
  group.add(box([0.22, 0.74, 0.22], darkMaterial, [-0.52, 0.78, -0.24]));
  group.add(box([0.22, 0.62, 0.22], darkMaterial, [0.52, 0.72, -0.24]));
  group.add(box([0.16, 0.08, 0.24], mat, [-0.52, 1.03, -0.08]));
  group.add(box([0.16, 0.08, 0.24], mat, [0.52, 0.93, -0.08]));
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
  group.add(box([0.48, 0.08, 0.06], lightMaterial, [0, 0.78, 0.51]));
  addMicroLights(group, mat, [
    [-0.62, 0.62, 0.4],
    [-0.44, 0.62, 0.4],
    [0.44, 0.62, 0.4],
    [0.62, 0.62, 0.4]
  ]);
  return group;
};

const createObservabilityTower = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.22, 0.32);

  addPedestal(group, mat, 1.36);
  group.add(cylinder(0.18, 0.28, 1.35, mat, [0, 0.92, 0], 10));
  group.add(cylinder(0.54, 0.54, 0.08, darkMaterial, [0, 1.62, 0], 24));
  group.add(box([0.08, 0.58, 0.08], lightMaterial, [0, 1.62, 0]));
  group.add(box([0.76, 0.06, 0.08], mat, [0.26, 1.86, 0]));
  group.add(cylinder(0.08, 0.18, 0.32, wireMaterial, [0.68, 1.86, 0], 18));
  group.add(beam([-0.22, 0.54, -0.24], [0.22, 1.36, 0.24], 0.018, wireMaterial));
  group.add(beam([0.22, 0.54, -0.24], [-0.22, 1.36, 0.24], 0.018, wireMaterial));
  addRing(group, 0.74, 0.028, mat, 1.68, 0.2);
  addRing(group, 1.02, 0.018, mat, 1.75, -0.14);
  addMicroLights(group, mat, [
    [-0.42, 0.52, 0.36],
    [0.42, 0.52, 0.36],
    [0, 1.46, 0.38]
  ]);
  return group;
};

const createArchitectureBridge = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.14, 0.28);

  addPedestal(group, mat, 1.9);
  group.add(box([1.72, 0.18, 0.42], mat, [0, 0.58, 0]));
  group.add(box([0.16, 0.82, 0.32], mat, [-0.68, 0.96, 0]));
  group.add(box([0.16, 0.82, 0.32], mat, [0.68, 0.96, 0]));
  for (const x of [-0.34, 0, 0.34]) {
    const truss = box([0.08, 0.92, 0.08], lightMaterial, [x, 0.98, 0]);
    truss.rotation.z = x <= 0 ? -0.64 : 0.64;
    group.add(truss);
  }
  for (const z of [-0.22, 0.22]) {
    group.add(beam([-0.76, 1.38, z], [0.76, 0.64, z], 0.018, wireMaterial));
    group.add(beam([-0.76, 0.64, z], [0.76, 1.38, z], 0.018, wireMaterial));
  }
  group.add(box([0.42, 0.08, 0.56], lightMaterial, [0, 0.72, 0]));
  return group;
};

const createCloudDock = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.16, 0.28);

  addPedestal(group, mat, 1.72);
  group.add(box([1.56, 0.18, 0.86], darkMaterial, [0, 0.42, 0]));
  for (const x of [-0.58, -0.18, 0.22, 0.58]) {
    group.add(box([0.14, 0.62, 0.16], mat, [x, 0.8, 0.34]));
  }
  group.add(box([0.12, 0.86, 0.12], mat, [-0.68, 0.92, -0.3]));
  group.add(box([0.72, 0.1, 0.1], mat, [-0.28, 1.34, -0.3]));
  group.add(beam([-0.62, 1.26, -0.28], [-0.04, 0.98, -0.28], 0.016, wireMaterial));
  group.add(box([0.52, 0.2, 0.34], lightMaterial, [0.2, 0.58, -0.26]));
  group.add(box([0.42, 0.18, 0.3], mat, [0.58, 0.56, -0.22]));
  group.add(sphere(0.32, mat, [-0.34, 1.2, -0.04], 16, 8));
  group.add(sphere(0.44, mat, [0.02, 1.3, -0.02], 16, 8));
  group.add(sphere(0.3, mat, [0.4, 1.17, -0.02], 16, 8));
  addRing(group, 0.6, 0.018, wireMaterial, 1.16, 0.12);
  return group;
};

const createDesignAtelier = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.2, 0.1);
  const blueMat = material(0x17d2ff, 0.12, 0.1);
  const goldMat = material(0xffe38a, 0.12, 0.08);

  addPedestal(group, mat, 1.52);
  const canvas = box([0.92, 0.68, 0.08], lightMaterial, [0, 1.08, 0]);
  canvas.rotation.y = -0.18;
  group.add(canvas);
  group.add(box([0.1, 1.08, 0.08], mat, [-0.48, 0.78, 0.08]));
  group.add(box([0.1, 1.08, 0.08], mat, [0.48, 0.78, 0.08]));
  group.add(box([1.2, 0.08, 0.08], mat, [0, 0.42, 0.08]));
  group.add(beam([-0.4, 0.42, 0.08], [-0.66, 0.16, 0.48], 0.016, wireMaterial));
  group.add(beam([0.4, 0.42, 0.08], [0.66, 0.16, 0.48], 0.016, wireMaterial));
  group.add(sphere(0.13, lightMaterial, [-0.46, 1.46, -0.12], 12, 8));
  const torso = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.56, 5), mat);
  torso.position.set(-0.46, 1.1, -0.12);
  torso.rotation.y = Math.PI * 0.2;
  group.add(torso);
  group.add(box([0.18, 0.06, 0.18], blueMat, [-0.44, 0.54, 0.52]));
  group.add(box([0.18, 0.06, 0.18], mat, [-0.18, 0.54, 0.52]));
  group.add(box([0.18, 0.06, 0.18], goldMat, [0.08, 0.54, 0.52]));
  group.add(box([0.18, 0.06, 0.18], lightMaterial, [0.34, 0.54, 0.52]));
  return group;
};

const createFoundry = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.2, 0.12);

  addPedestal(group, mat, 1.58);
  group.add(box([0.12, 1.2, 0.12], mat, [-0.58, 0.94, 0]));
  group.add(box([1.12, 0.12, 0.12], mat, [0, 1.48, 0]));
  group.add(box([0.12, 0.48, 0.12], mat, [0.48, 1.22, 0]));
  group.add(beam([-0.56, 1.4, 0], [0.42, 0.96, 0], 0.018, wireMaterial));
  const gem = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32, 0), lightMaterial);
  gem.position.set(0.48, 0.88, 0);
  gem.rotation.set(0.2, 0.45, 0.15);
  group.add(gem);
  group.add(box([0.5, 0.18, 0.28], darkMaterial, [-0.12, 0.56, 0.34]));
  group.add(cylinder(0.12, 0.12, 0.48, mat, [-0.12, 0.64, 0.34], 14));
  addRing(group, 0.56, 0.06, mat, 0.62, 0.44);
  return group;
};

const createFashionRoom = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.18, 0.08);

  addPedestal(group, mat, 1.54);
  group.add(box([1.16, 0.08, 0.36], lightMaterial, [0, 0.42, 0.42]));
  group.add(box([0.1, 0.9, 0.1], mat, [-0.58, 0.9, -0.36]));
  group.add(box([0.1, 0.9, 0.1], mat, [0.58, 0.9, -0.36]));
  group.add(box([1.28, 0.08, 0.08], mat, [0, 1.32, -0.36]));
  group.add(cylinder(0.06, 0.06, 1.28, darkMaterial, [0, 0.96, 0], 12));
  group.add(sphere(0.17, lightMaterial, [0, 1.72, 0], 14, 8));
  const torso = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.86, 4), mat);
  torso.position.y = 1.1;
  torso.rotation.y = Math.PI * 0.25;
  group.add(torso);
  group.add(cylinder(0.55, 0.22, 0.18, mat, [0, 0.64, 0], 18));
  group.add(beam([-0.42, 1.28, -0.34], [-0.24, 1.1, -0.34], 0.014, wireMaterial));
  group.add(beam([0.42, 1.28, -0.34], [0.24, 1.1, -0.34], 0.014, wireMaterial));
  group.add(box([0.22, 0.42, 0.06], material(0x17d2ff, 0.08, 0.06), [-0.24, 0.9, -0.32]));
  group.add(box([0.22, 0.42, 0.06], lightMaterial, [0.24, 0.9, -0.32]));
  return group;
};

const createValuesPlaza = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.16, 0.12);

  addPedestal(group, mat, 1.7);
  for (let index = 0; index < 4; index += 1) {
    const angle = index * Math.PI * 0.5 + Math.PI * 0.25;
    group.add(cylinder(0.11, 0.14, 0.88, mat, [Math.cos(angle) * 0.58, 0.74, Math.sin(angle) * 0.58], 8));
  }
  addRing(group, 0.82, 0.04, lightMaterial, 1.22);
  addRing(group, 0.48, 0.022, mat, 0.78, 0.32);
  group.add(sphere(0.24, mat, [0, 1.34, 0], 14, 10));
  group.add(beam([-0.62, 0.58, 0], [0.62, 1.08, 0], 0.018, wireMaterial));
  group.add(beam([0, 0.58, -0.62], [0, 1.08, 0.62], 0.018, wireMaterial));
  return group;
};

const createContactPortal = (accent: number) => {
  const group = new THREE.Group();
  const mat = material(accent, 0.22, 0.14);

  addPedestal(group, mat, 1.62);
  group.add(box([0.18, 1.3, 0.18], mat, [-0.58, 0.92, 0]));
  group.add(box([0.18, 1.3, 0.18], mat, [0.58, 0.92, 0]));
  group.add(box([1.34, 0.18, 0.18], mat, [0, 1.52, 0]));
  group.add(box([0.74, 0.1, 0.14], wireMaterial, [0, 1.26, 0.02]));
  const envelope = box([0.78, 0.48, 0.08], lightMaterial, [0, 0.94, 0.08]);
  group.add(envelope);
  const flap = box([0.5, 0.04, 0.06], mat, [0, 0.98, 0.14]);
  flap.rotation.z = 0.62;
  group.add(flap);
  addRing(group, 0.78, 0.035, mat, 0.82, 0.12);
  addRing(group, 0.48, 0.018, wireMaterial, 1.04, -0.18);
  addMicroLights(group, mat, [
    [-0.72, 1.56, 0.16],
    [0.72, 1.56, 0.16],
    [0, 0.58, 0.46]
  ]);
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
