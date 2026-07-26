import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const root = process.cwd();
const outputDir = path.join(root, "public", "assets", "models", "local", "itart-signature-kit", "hero");

if (!globalThis.FileReader) {
  globalThis.FileReader = class NodeFileReader {
    result = null;
    onloadend = null;
    onerror = null;

    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((buffer) => {
          this.result = buffer;
          this.onloadend?.({ target: this });
        })
        .catch((error) => {
          this.onerror?.(error);
        });
    }
  };
}

const palette = {
  ink: 0x111117,
  graphite: 0x293139,
  warm: 0xffe38a,
  tech: 0x17d2ff,
  techDeep: 0x0b6f8c,
  art: 0xff6f7d,
  artDeep: 0x8b2f49,
  studio: 0xf8f0d4,
  cloth: 0xf19aa5
};

const material = (color, options = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.54,
    metalness: options.metalness ?? 0.08,
    emissive: options.emissive ?? color,
    emissiveIntensity: options.emissiveIntensity ?? 0.04,
    transparent: options.opacity !== undefined && options.opacity < 1,
    opacity: options.opacity ?? 1
  });

const mats = {
  ink: material(palette.ink, { metalness: 0.16 }),
  graphite: material(palette.graphite, { metalness: 0.18 }),
  warm: material(palette.warm, { emissiveIntensity: 0.12 }),
  tech: material(palette.tech, { emissiveIntensity: 0.18 }),
  techGlass: material(palette.tech, { emissiveIntensity: 0.2, opacity: 0.66, roughness: 0.2 }),
  techDeep: material(palette.techDeep, { metalness: 0.2 }),
  art: material(palette.art, { emissiveIntensity: 0.14 }),
  artDeep: material(palette.artDeep, { metalness: 0.08 }),
  studio: material(palette.studio, { emissiveIntensity: 0.07 }),
  cloth: material(palette.cloth, { roughness: 0.78 })
};

const addBox = (group, name, size, position, mat, rotation = [0, 0, 0]) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
};

const addSphere = (group, name, radius, position, mat, scale = [1, 1, 1]) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  group.add(mesh);
  return mesh;
};

const addCylinder = (group, name, radiusTop, radiusBottom, height, position, mat, rotation = [0, 0, 0], segments = 12) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
};

const addTube = (group, name, points, radius, mat) => {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 18, radius, 6), mat);
  mesh.name = name;
  group.add(mesh);
  return mesh;
};

const addTorus = (group, name, radius, tube, position, mat, rotation = [0, 0, 0]) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 48), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  group.add(mesh);
  return mesh;
};

function createServerCloudNode() {
  const group = new THREE.Group();
  group.name = "itart-server-cloud-node";

  addBox(group, "rack-body", [0.86, 1.52, 0.52], [0, 0.76, 0], mats.ink);
  addBox(group, "rack-face", [0.9, 1.2, 0.05], [0, 0.78, -0.285], mats.graphite);
  for (let index = 0; index < 5; index += 1) {
    addBox(group, `server-slice-${index}`, [0.68, 0.055, 0.06], [0, 0.32 + index * 0.18, -0.33], index % 2 ? mats.tech : mats.studio);
  }
  addBox(group, "cloud-dock-base", [1.34, 0.16, 0.88], [0, 0.08, 0.02], mats.techDeep);
  addTube(group, "cable-bus-left", [[-0.5, 0.22, 0.22], [-0.9, 0.42, 0.2], [-1.08, 0.76, -0.12]], 0.024, mats.tech);
  addTube(group, "cable-bus-right", [[0.48, 0.24, 0.2], [0.84, 0.48, 0.26], [1.1, 0.9, -0.06]], 0.024, mats.warm);
  addSphere(group, "cloud-core", 0.31, [0.1, 1.66, -0.03], mats.techGlass, [1.35, 0.76, 0.82]);
  addSphere(group, "cloud-left", 0.24, [-0.28, 1.62, 0.04], mats.techGlass, [1.1, 0.78, 0.8]);
  addSphere(group, "cloud-right", 0.25, [0.48, 1.59, 0.02], mats.techGlass, [1.25, 0.82, 0.78]);
  addBox(group, "status-beacon", [0.12, 0.12, 0.12], [0.48, 1.18, -0.33], mats.warm);

  return group;
}

function createAtelierMannequinRack() {
  const group = new THREE.Group();
  group.name = "itart-atelier-mannequin-rack";

  addBox(group, "atelier-floor-plate", [1.42, 0.08, 0.92], [0, 0.04, 0], mats.studio);
  addCylinder(group, "rack-left", 0.025, 0.025, 1.3, [-0.58, 0.72, 0.18], mats.ink);
  addCylinder(group, "rack-right", 0.025, 0.025, 1.3, [0.58, 0.72, 0.18], mats.ink);
  addCylinder(group, "rack-bar", 0.025, 0.025, 1.22, [0, 1.34, 0.18], mats.ink, [0, 0, Math.PI * 0.5]);
  addBox(group, "hanging-cloth-coral", [0.34, 0.76, 0.035], [-0.28, 0.9, 0.2], mats.cloth, [0, 0, -0.06]);
  addBox(group, "hanging-cloth-cream", [0.28, 0.68, 0.035], [0.13, 0.86, 0.2], mats.studio, [0, 0, 0.08]);
  addBox(group, "hanging-cloth-dark", [0.24, 0.58, 0.035], [0.44, 0.82, 0.2], mats.artDeep, [0, 0, -0.03]);

  addCylinder(group, "mannequin-stand", 0.025, 0.035, 0.48, [0, 0.29, -0.23], mats.ink);
  addCylinder(group, "mannequin-torso", 0.16, 0.24, 0.58, [0, 0.78, -0.23], mats.studio, [0, 0, 0], 16);
  addSphere(group, "mannequin-head", 0.13, [0, 1.18, -0.23], mats.studio, [0.92, 1.08, 0.9]);
  addTube(group, "mannequin-shoulder-line", [[-0.32, 1.0, -0.22], [-0.08, 1.04, -0.24], [0.32, 1.0, -0.22]], 0.023, mats.art);
  addBox(group, "pattern-board", [0.38, 0.42, 0.04], [-0.48, 0.34, -0.22], mats.art, [0, 0.12, 0]);
  addBox(group, "tailor-table-edge", [1.08, 0.09, 0.24], [0.18, 0.2, -0.54], mats.ink);

  return group;
}

function createTelemetryRadarMast() {
  const group = new THREE.Group();
  group.name = "itart-telemetry-radar-mast";

  addBox(group, "radar-base", [0.92, 0.16, 0.92], [0, 0.08, 0], mats.ink);
  addCylinder(group, "mast-core", 0.055, 0.075, 1.78, [0, 0.94, 0], mats.graphite, [0, 0, 0], 12);
  addCylinder(group, "mast-glow", 0.026, 0.026, 1.86, [0.08, 0.98, -0.03], mats.tech, [0, 0, 0], 8);
  addCylinder(group, "radar-dish", 0.34, 0.08, 0.18, [0, 1.74, -0.2], mats.techDeep, [Math.PI * 0.5, 0, 0], 18);
  addSphere(group, "radar-node", 0.105, [0, 1.72, -0.36], mats.warm);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.015, 8, 64), mats.tech);
  ring.name = "scan-ring";
  ring.position.set(0, 1.2, 0);
  ring.rotation.x = Math.PI * 0.5;
  group.add(ring);
  const upperRing = ring.clone();
  upperRing.name = "upper-scan-ring";
  upperRing.position.y = 1.52;
  upperRing.scale.setScalar(0.72);
  group.add(upperRing);
  addTube(group, "trace-beam-a", [[-0.44, 0.34, 0.32], [-0.18, 0.96, 0.1], [0, 1.72, -0.34]], 0.015, mats.tech);
  addTube(group, "trace-beam-b", [[0.48, 0.3, 0.28], [0.18, 1.02, 0.08], [0, 1.72, -0.34]], 0.015, mats.warm);
  addBox(group, "signal-panel-left", [0.28, 0.24, 0.035], [-0.36, 0.46, -0.38], mats.tech, [0, -0.18, 0]);
  addBox(group, "signal-panel-right", [0.28, 0.24, 0.035], [0.36, 0.46, -0.38], mats.studio, [0, 0.18, 0]);

  return group;
}

function createCloudCircuitBridge() {
  const group = new THREE.Group();
  group.name = "itart-cloud-circuit-bridge";

  addBox(group, "skybridge-deck", [1.78, 0.12, 0.36], [0, 0.42, 0], mats.techDeep);
  addBox(group, "deck-light-strip-a", [1.62, 0.035, 0.035], [0, 0.51, -0.17], mats.tech);
  addBox(group, "deck-light-strip-b", [1.62, 0.035, 0.035], [0, 0.51, 0.17], mats.warm);
  addCylinder(group, "bridge-left-pylon", 0.04, 0.055, 1.18, [-0.76, 0.94, 0], mats.graphite);
  addCylinder(group, "bridge-right-pylon", 0.04, 0.055, 1.18, [0.76, 0.94, 0], mats.graphite);
  addSphere(group, "left-cloud-node", 0.22, [-0.94, 1.54, -0.02], mats.techGlass, [1.2, 0.72, 0.78]);
  addSphere(group, "right-cloud-node", 0.22, [0.94, 1.54, -0.02], mats.techGlass, [1.2, 0.72, 0.78]);
  addTube(group, "electric-arc-front", [[-0.78, 1.45, -0.16], [-0.22, 1.68, -0.28], [0.22, 1.34, -0.22], [0.78, 1.52, -0.16]], 0.018, mats.tech);
  addTube(group, "electric-arc-back", [[-0.74, 1.26, 0.18], [-0.18, 1.48, 0.32], [0.28, 1.22, 0.26], [0.74, 1.42, 0.18]], 0.016, mats.warm);
  for (let index = 0; index < 4; index += 1) {
    const x = -0.54 + index * 0.36;
    addBox(group, `circuit-pad-${index}`, [0.16, 0.035, 0.18], [x, 0.6, index % 2 ? 0.08 : -0.08], index % 2 ? mats.studio : mats.tech);
  }

  return group;
}

function createAtelierDrapeFrame() {
  const group = new THREE.Group();
  group.name = "itart-atelier-drape-frame";

  addBox(group, "tailor-platform", [1.54, 0.08, 0.92], [0, 0.04, 0], mats.studio);
  addCylinder(group, "frame-left-post", 0.024, 0.032, 1.32, [-0.62, 0.72, 0.04], mats.ink);
  addCylinder(group, "frame-right-post", 0.024, 0.032, 1.32, [0.62, 0.72, 0.04], mats.ink);
  addCylinder(group, "frame-top-rail", 0.024, 0.024, 1.28, [0, 1.38, 0.04], mats.ink, [0, 0, Math.PI * 0.5]);
  addTube(group, "drape-coral-fold", [[-0.56, 1.28, 0.02], [-0.32, 0.92, 0.12], [-0.1, 1.04, 0.08], [0.1, 0.62, 0.16]], 0.036, mats.cloth);
  addTube(group, "drape-cream-fold", [[-0.06, 1.32, 0.02], [0.18, 1.0, 0.12], [0.34, 1.08, 0.08], [0.52, 0.68, 0.14]], 0.034, mats.studio);
  addBox(group, "pattern-sheet-a", [0.36, 0.44, 0.035], [-0.42, 0.36, -0.26], mats.art, [0.08, 0.18, -0.06]);
  addBox(group, "pattern-sheet-b", [0.3, 0.38, 0.035], [0.0, 0.34, -0.3], mats.studio, [0.04, -0.12, 0.05]);
  addBox(group, "cutting-ruler", [0.82, 0.035, 0.055], [0.22, 0.56, -0.26], mats.ink, [0, 0.22, 0]);
  addSphere(group, "pin-coral", 0.045, [0.48, 0.6, -0.28], mats.art, [1, 1, 1]);
  addSphere(group, "pin-warm", 0.04, [-0.12, 0.58, -0.32], mats.warm, [1, 1, 1]);

  return group;
}

function createTelemetryScreenArray() {
  const group = new THREE.Group();
  group.name = "itart-telemetry-screen-array";

  addBox(group, "screen-array-base", [1.36, 0.1, 0.42], [0, 0.05, 0], mats.ink);
  addBox(group, "screen-array-wall", [1.28, 0.76, 0.08], [0, 0.58, -0.12], mats.graphite);
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const x = -0.42 + column * 0.42;
      const y = 0.42 + row * 0.28;
      addBox(group, `metric-screen-${row}-${column}`, [0.28, 0.16, 0.028], [x, y, -0.18], (row + column) % 2 ? mats.tech : mats.studio);
    }
  }
  addTube(group, "trace-ribbon-main", [[-0.55, 0.94, -0.2], [-0.2, 1.22, -0.28], [0.22, 0.98, -0.22], [0.58, 1.18, -0.3]], 0.015, mats.tech);
  addTube(group, "trace-ribbon-alert", [[-0.5, 0.2, 0.1], [-0.1, 0.42, 0.22], [0.22, 0.3, 0.16], [0.54, 0.52, 0.22]], 0.014, mats.warm);
  addTorus(group, "small-radar-loop", 0.32, 0.012, [0.0, 1.18, -0.08], mats.tech, [Math.PI * 0.5, 0.18, 0]);
  addCylinder(group, "antenna-left", 0.018, 0.026, 0.64, [-0.58, 1.18, -0.08], mats.tech, [0.08, 0, -0.08], 8);
  addCylinder(group, "antenna-right", 0.018, 0.026, 0.58, [0.58, 1.14, -0.08], mats.warm, [0.08, 0, 0.08], 8);

  return group;
}

const assets = [
  ["server-cloud-node.glb", createServerCloudNode()],
  ["atelier-mannequin-rack.glb", createAtelierMannequinRack()],
  ["telemetry-radar-mast.glb", createTelemetryRadarMast()],
  ["cloud-circuit-bridge.glb", createCloudCircuitBridge()],
  ["atelier-drape-frame.glb", createAtelierDrapeFrame()],
  ["telemetry-screen-array.glb", createTelemetryScreenArray()]
];

fs.mkdirSync(outputDir, { recursive: true });
const exporter = new GLTFExporter();
const results = [];

for (const [fileName, scene] of assets) {
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = true;
    }
  });
  const glb = await exporter.parseAsync(scene, { binary: true });
  const outputPath = path.join(outputDir, fileName);
  fs.writeFileSync(outputPath, Buffer.from(glb));
  results.push({
    fileName,
    fileKb: Number((fs.statSync(outputPath).size / 1024).toFixed(1))
  });
}

console.log(JSON.stringify({ outputDir: path.relative(root, outputDir), assets: results }, null, 2));
