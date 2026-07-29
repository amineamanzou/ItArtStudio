import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

const root = process.cwd();
const heroOutputDir = path.join(root, "public", "assets", "models", "local", "itart-signature-kit", "hero");
const environmentOutputDir = path.join(root, "public", "assets", "models", "local", "itart-signature-kit", "environment");
const premiumOutputDir = path.join(root, "public", "assets", "models", "local", "itart-signature-kit", "premium");
const detailOutputDir = path.join(root, "public", "assets", "models", "local", "itart-signature-kit", "detail");
const terrainOutputDir = path.join(root, "public", "assets", "models", "local", "itart-signature-kit", "terrain");

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

function createCloudEnergyAnchor() {
  const group = new THREE.Group();
  group.name = "itart-cloud-energy-anchor";

  addBox(group, "anchor-service-pad", [1.54, 0.12, 1.02], [0, 0.06, 0], mats.techDeep);
  addBox(group, "anchor-rack-left", [0.34, 1.08, 0.34], [-0.46, 0.62, 0.05], mats.ink);
  addBox(group, "anchor-rack-right", [0.34, 1.08, 0.34], [0.46, 0.62, 0.05], mats.ink);
  for (let index = 0; index < 4; index += 1) {
    addBox(group, `anchor-server-slot-left-${index}`, [0.25, 0.035, 0.035], [-0.46, 0.28 + index * 0.18, -0.14], index % 2 ? mats.tech : mats.studio);
    addBox(group, `anchor-server-slot-right-${index}`, [0.25, 0.035, 0.035], [0.46, 0.28 + index * 0.18, -0.14], index % 2 ? mats.studio : mats.tech);
  }
  addCylinder(group, "left-energy-coil", 0.2, 0.2, 0.16, [-0.46, 1.22, 0.05], mats.tech, [Math.PI * 0.5, 0, 0], 18);
  addCylinder(group, "right-energy-coil", 0.2, 0.2, 0.16, [0.46, 1.22, 0.05], mats.warm, [Math.PI * 0.5, 0, 0], 18);
  addTorus(group, "left-coil-ring", 0.28, 0.016, [-0.46, 1.22, 0.05], mats.tech, [Math.PI * 0.5, 0, 0]);
  addTorus(group, "right-coil-ring", 0.28, 0.016, [0.46, 1.22, 0.05], mats.warm, [Math.PI * 0.5, 0, 0]);
  addSphere(group, "anchor-cloud-core", 0.28, [0, 1.48, 0.02], mats.techGlass, [1.35, 0.74, 0.82]);
  addSphere(group, "anchor-cloud-left", 0.2, [-0.34, 1.44, 0.04], mats.techGlass, [1.1, 0.7, 0.78]);
  addSphere(group, "anchor-cloud-right", 0.2, [0.34, 1.44, 0.04], mats.techGlass, [1.1, 0.7, 0.78]);
  addTube(group, "primary-electric-arc", [[-0.46, 1.28, -0.12], [-0.16, 1.62, -0.24], [0.16, 1.28, -0.2], [0.46, 1.56, -0.12]], 0.017, mats.tech);
  addTube(group, "warm-electric-return", [[-0.36, 1.08, 0.22], [-0.08, 1.34, 0.28], [0.2, 1.1, 0.26], [0.5, 1.32, 0.22]], 0.014, mats.warm);
  addCylinder(group, "ground-cable-a", 0.025, 0.025, 1.05, [-0.08, 0.18, 0.42], mats.graphite, [Math.PI * 0.5, 0, Math.PI * 0.5], 8);
  addCylinder(group, "ground-cable-b", 0.022, 0.022, 0.92, [0.12, 0.18, -0.42], mats.graphite, [Math.PI * 0.5, 0, Math.PI * 0.5], 8);

  return group;
}

function createAtelierPatternWall() {
  const group = new THREE.Group();
  group.name = "itart-atelier-pattern-wall";

  addBox(group, "pattern-wall-base", [1.48, 0.1, 0.64], [0, 0.05, 0], mats.studio);
  addBox(group, "pattern-wall-back", [1.34, 1.1, 0.08], [0, 0.68, 0.16], mats.artDeep);
  addBox(group, "paper-sheet-left", [0.36, 0.68, 0.035], [-0.42, 0.74, 0.1], mats.studio, [0, -0.08, -0.03]);
  addBox(group, "paper-sheet-center", [0.36, 0.82, 0.035], [0, 0.78, 0.09], mats.cloth, [0, 0.04, 0.02]);
  addBox(group, "paper-sheet-right", [0.3, 0.62, 0.035], [0.43, 0.68, 0.1], mats.studio, [0, 0.1, 0.04]);
  addTube(group, "pattern-curve-left", [[-0.55, 1.06, 0.045], [-0.38, 0.82, 0.025], [-0.52, 0.48, 0.04]], 0.012, mats.art);
  addTube(group, "pattern-curve-center", [[-0.1, 1.14, 0.04], [0.08, 0.88, 0.02], [-0.02, 0.5, 0.04]], 0.012, mats.ink);
  addTube(group, "pattern-curve-right", [[0.34, 1.0, 0.045], [0.5, 0.76, 0.025], [0.38, 0.42, 0.04]], 0.012, mats.warm);
  addCylinder(group, "fabric-roll-coral", 0.075, 0.075, 0.96, [-0.32, 0.24, -0.22], mats.cloth, [0, 0, Math.PI * 0.5], 12);
  addCylinder(group, "fabric-roll-cream", 0.065, 0.065, 0.82, [0.34, 0.23, -0.23], mats.studio, [0, 0, Math.PI * 0.5], 12);
  addBox(group, "tailor-ruler-wall", [0.72, 0.035, 0.035], [0.1, 1.18, 0.07], mats.warm, [0, 0, -0.12]);
  addSphere(group, "pin-left", 0.036, [-0.54, 1.16, 0.06], mats.warm);
  addSphere(group, "pin-right", 0.034, [0.58, 1.02, 0.06], mats.art);

  return group;
}

function createTelemetryTraceBeacon() {
  const group = new THREE.Group();
  group.name = "itart-telemetry-trace-beacon";

  addBox(group, "trace-beacon-base", [1.02, 0.14, 0.88], [0, 0.07, 0], mats.ink);
  addCylinder(group, "trace-beacon-spine", 0.045, 0.06, 1.74, [0, 0.94, 0], mats.graphite, [0, 0, 0], 12);
  addBox(group, "log-panel-left", [0.34, 0.86, 0.05], [-0.36, 0.8, -0.18], mats.graphite, [0, -0.18, 0]);
  addBox(group, "log-panel-right", [0.34, 0.86, 0.05], [0.36, 0.8, -0.18], mats.graphite, [0, 0.18, 0]);
  for (let index = 0; index < 5; index += 1) {
    addBox(group, `log-line-left-${index}`, [0.22, 0.024, 0.02], [-0.36, 0.48 + index * 0.12, -0.22], index % 2 ? mats.tech : mats.studio);
    addBox(group, `log-line-right-${index}`, [0.22, 0.024, 0.02], [0.36, 0.5 + index * 0.12, -0.22], index % 2 ? mats.warm : mats.tech);
  }
  addTorus(group, "trace-scan-loop-low", 0.42, 0.012, [0, 0.82, 0.02], mats.tech, [Math.PI * 0.5, 0, 0]);
  addTorus(group, "trace-scan-loop-high", 0.34, 0.012, [0, 1.34, 0.02], mats.warm, [Math.PI * 0.5, 0.2, 0]);
  addTube(group, "trace-beam-main", [[-0.48, 0.32, 0.28], [-0.18, 0.86, 0.16], [0.08, 1.3, -0.06], [0.42, 1.68, -0.22]], 0.015, mats.tech);
  addTube(group, "trace-beam-secondary", [[0.48, 0.34, 0.24], [0.12, 0.82, 0.2], [-0.08, 1.2, -0.06], [-0.38, 1.54, -0.2]], 0.013, mats.warm);
  addSphere(group, "trace-beacon-head", 0.14, [0, 1.78, -0.12], mats.techGlass, [1, 0.8, 1]);
  addBox(group, "metric-stack-bottom", [0.72, 0.08, 0.16], [0, 0.22, 0.28], mats.techDeep);

  return group;
}

function createCloudServerPier() {
  const group = new THREE.Group();
  group.name = "itart-cloud-server-pier";

  addBox(group, "pier-deck", [2.1, 0.14, 0.74], [0, 0.07, 0], mats.techDeep);
  addBox(group, "pier-edge-light-left", [1.92, 0.035, 0.035], [0, 0.18, -0.39], mats.tech);
  addBox(group, "pier-edge-light-right", [1.92, 0.035, 0.035], [0, 0.18, 0.39], mats.warm);
  for (let index = 0; index < 4; index += 1) {
    const x = -0.72 + index * 0.48;
    addBox(group, `micro-rack-${index}`, [0.26, 0.72 + (index % 2) * 0.18, 0.28], [x, 0.5 + (index % 2) * 0.09, -0.08], index % 2 ? mats.graphite : mats.ink);
    addBox(group, `micro-rack-screen-${index}`, [0.19, 0.035, 0.035], [x, 0.58, -0.24], index % 2 ? mats.tech : mats.studio);
  }
  addTube(group, "pier-cable-a", [[-0.92, 0.22, 0.32], [-0.54, 0.38, 0.56], [0.08, 0.3, 0.48], [0.78, 0.48, 0.3]], 0.02, mats.tech);
  addTube(group, "pier-cable-b", [[-0.78, 0.24, -0.28], [-0.24, 0.44, -0.54], [0.42, 0.34, -0.46], [0.94, 0.52, -0.24]], 0.018, mats.warm);
  addSphere(group, "low-cloud-left", 0.22, [-0.82, 1.12, 0.1], mats.techGlass, [1.35, 0.7, 0.78]);
  addSphere(group, "low-cloud-mid", 0.28, [-0.16, 1.2, 0.12], mats.techGlass, [1.5, 0.72, 0.82]);
  addSphere(group, "low-cloud-right", 0.22, [0.56, 1.12, 0.08], mats.techGlass, [1.2, 0.68, 0.76]);
  addCylinder(group, "pier-beacon", 0.035, 0.052, 0.86, [0.94, 0.58, 0.28], mats.graphite, [0, 0, 0], 10);
  addSphere(group, "pier-beacon-head", 0.09, [0.94, 1.06, 0.28], mats.tech);

  return group;
}

function createAtelierCuttingIsland() {
  const group = new THREE.Group();
  group.name = "itart-atelier-cutting-island";

  addBox(group, "cutting-island-top", [1.86, 0.12, 1.04], [0, 0.64, 0], mats.studio);
  addBox(group, "cutting-island-frame", [1.74, 0.12, 0.92], [0, 0.52, 0], mats.ink);
  for (const x of [-0.72, 0.72]) {
    for (const z of [-0.36, 0.36]) {
      addCylinder(group, `table-leg-${x}-${z}`, 0.025, 0.032, 0.56, [x, 0.28, z], mats.ink, [0, 0, 0], 8);
    }
  }
  addBox(group, "coral-fabric-yardage", [1.36, 0.06, 0.28], [-0.12, 0.74, -0.2], mats.cloth, [0, 0.08, -0.02]);
  addBox(group, "cream-pattern-yardage", [1.1, 0.052, 0.24], [0.18, 0.8, 0.18], mats.studio, [0, -0.14, 0.02]);
  addTube(group, "chalk-pattern-curve-a", [[-0.62, 0.86, -0.34], [-0.24, 0.91, -0.12], [0.2, 0.86, -0.28], [0.62, 0.92, -0.08]], 0.01, mats.art);
  addTube(group, "chalk-pattern-curve-b", [[-0.58, 0.88, 0.28], [-0.18, 0.94, 0.08], [0.28, 0.9, 0.24], [0.66, 0.96, 0.02]], 0.01, mats.warm);
  addBox(group, "long-tailor-ruler", [1.52, 0.035, 0.052], [0, 0.9, 0.42], mats.ink, [0, 0.18, 0]);
  addCylinder(group, "fabric-roll-one", 0.072, 0.072, 0.72, [-0.62, 0.84, 0.12], mats.cloth, [0, 0, Math.PI * 0.5], 12);
  addCylinder(group, "fabric-roll-two", 0.062, 0.062, 0.66, [0.58, 0.84, -0.36], mats.artDeep, [0, 0, Math.PI * 0.5], 12);
  addSphere(group, "pin-cluster-a", 0.035, [0.58, 0.94, 0.34], mats.art);
  addSphere(group, "pin-cluster-b", 0.03, [0.7, 0.92, 0.2], mats.warm);

  return group;
}

function createObservabilityTraceStation() {
  const group = new THREE.Group();
  group.name = "itart-observability-trace-station";

  addBox(group, "trace-station-pad", [1.74, 0.12, 0.96], [0, 0.06, 0], mats.ink);
  addBox(group, "trace-console-base", [1.32, 0.36, 0.48], [0, 0.3, -0.08], mats.graphite);
  addBox(group, "trace-console-screen", [1.14, 0.48, 0.06], [0, 0.74, -0.32], mats.techDeep, [-0.18, 0, 0]);
  for (let index = 0; index < 5; index += 1) {
    addBox(group, `trace-line-${index}`, [0.16 + index * 0.07, 0.024, 0.024], [-0.42 + index * 0.2, 0.76 + (index % 2) * 0.1, -0.37], index % 2 ? mats.warm : mats.tech);
  }
  addCylinder(group, "trace-station-antenna-left", 0.018, 0.026, 0.94, [-0.7, 0.88, 0.18], mats.tech, [0.16, 0, -0.1], 8);
  addCylinder(group, "trace-station-antenna-right", 0.018, 0.026, 0.78, [0.7, 0.8, 0.18], mats.warm, [0.14, 0, 0.12], 8);
  addTorus(group, "station-scan-ring", 0.46, 0.014, [0, 1.28, 0.08], mats.tech, [Math.PI * 0.5, 0.2, 0]);
  addTorus(group, "station-alert-ring", 0.32, 0.012, [0, 1.02, 0.08], mats.warm, [Math.PI * 0.5, -0.18, 0]);
  addTube(group, "station-trace-beam-a", [[-0.62, 0.32, 0.34], [-0.26, 0.82, 0.2], [0.12, 1.22, 0.04], [0.58, 1.5, -0.16]], 0.014, mats.tech);
  addTube(group, "station-trace-beam-b", [[0.64, 0.28, 0.32], [0.24, 0.74, 0.24], [-0.08, 1.06, 0.02], [-0.46, 1.36, -0.14]], 0.012, mats.warm);
  addSphere(group, "station-router-node-a", 0.085, [-0.54, 0.54, 0.32], mats.tech);
  addSphere(group, "station-router-node-b", 0.075, [0.58, 0.48, 0.3], mats.warm);

  return group;
}

function createCloudInfraGateway() {
  const group = new THREE.Group();
  group.name = "itart-cloud-infra-gateway";

  addBox(group, "network-arch-service-pad", [1.92, 0.12, 0.94], [0, 0.06, 0], mats.techDeep);
  addCylinder(group, "arch-left-server-leg", 0.07, 0.09, 1.22, [-0.72, 0.67, 0], mats.ink, [0, 0, 0], 10);
  addCylinder(group, "arch-right-server-leg", 0.07, 0.09, 1.22, [0.72, 0.67, 0], mats.ink, [0, 0, 0], 10);
  addBox(group, "arch-left-rack-face", [0.3, 0.92, 0.05], [-0.72, 0.68, -0.11], mats.graphite);
  addBox(group, "arch-right-rack-face", [0.3, 0.92, 0.05], [0.72, 0.68, -0.11], mats.graphite);
  for (let index = 0; index < 4; index += 1) {
    addBox(group, `arch-left-server-light-${index}`, [0.2, 0.026, 0.024], [-0.72, 0.36 + index * 0.16, -0.15], index % 2 ? mats.tech : mats.studio);
    addBox(group, `arch-right-server-light-${index}`, [0.2, 0.026, 0.024], [0.72, 0.36 + index * 0.16, -0.15], index % 2 ? mats.warm : mats.tech);
  }
  addTube(group, "fiber-arch-primary", [[-0.72, 1.2, -0.03], [-0.34, 1.58, -0.16], [0.0, 1.72, -0.18], [0.34, 1.58, -0.16], [0.72, 1.2, -0.03]], 0.025, mats.tech);
  addTube(group, "fiber-arch-return", [[-0.64, 1.02, 0.18], [-0.26, 1.34, 0.34], [0.1, 1.2, 0.3], [0.52, 1.42, 0.2], [0.8, 1.08, 0.1]], 0.018, mats.warm);
  addSphere(group, "arch-cloud-left", 0.22, [-0.4, 1.64, -0.05], mats.techGlass, [1.3, 0.72, 0.8]);
  addSphere(group, "arch-cloud-center", 0.28, [0.06, 1.74, -0.08], mats.techGlass, [1.45, 0.74, 0.82]);
  addSphere(group, "arch-cloud-right", 0.2, [0.5, 1.62, -0.04], mats.techGlass, [1.15, 0.7, 0.78]);
  addSphere(group, "arch-routing-node-a", 0.075, [-0.28, 1.35, -0.24], mats.tech);
  addSphere(group, "arch-routing-node-b", 0.07, [0.22, 1.48, -0.26], mats.warm);
  addBox(group, "dock-direction-strip", [1.36, 0.035, 0.045], [0, 0.2, -0.48], mats.tech);

  return group;
}

function createAtelierGarmentLoom() {
  const group = new THREE.Group();
  group.name = "itart-atelier-garment-loom";

  addBox(group, "loom-floor-runner", [1.86, 0.1, 0.84], [0, 0.05, 0], mats.studio);
  addCylinder(group, "loom-left-post", 0.028, 0.038, 1.18, [-0.72, 0.68, 0.02], mats.ink, [0, 0, 0], 8);
  addCylinder(group, "loom-right-post", 0.028, 0.038, 1.18, [0.72, 0.68, 0.02], mats.ink, [0, 0, 0], 8);
  addCylinder(group, "loom-top-bar", 0.026, 0.026, 1.52, [0, 1.26, 0.02], mats.ink, [0, 0, Math.PI * 0.5], 8);
  addCylinder(group, "loom-bottom-bar", 0.026, 0.026, 1.48, [0, 0.44, 0.02], mats.ink, [0, 0, Math.PI * 0.5], 8);
  for (let index = 0; index < 7; index += 1) {
    const x = -0.48 + index * 0.16;
    addBox(group, `vertical-warp-thread-${index}`, [0.018, 0.78, 0.018], [x, 0.84, -0.08], index % 3 === 0 ? mats.art : index % 3 === 1 ? mats.studio : mats.cloth);
  }
  addTube(group, "woven-thread-coral", [[-0.62, 0.98, -0.12], [-0.24, 0.86, -0.18], [0.18, 1.02, -0.12], [0.62, 0.88, -0.16]], 0.019, mats.cloth);
  addTube(group, "woven-thread-cream", [[-0.6, 0.72, -0.08], [-0.18, 0.84, -0.14], [0.2, 0.68, -0.08], [0.64, 0.8, -0.14]], 0.017, mats.studio);
  addCylinder(group, "fabric-roll-back", 0.09, 0.09, 1.34, [0, 1.4, 0.16], mats.artDeep, [0, 0, Math.PI * 0.5], 14);
  addCylinder(group, "fabric-roll-front", 0.075, 0.075, 1.16, [0, 0.28, -0.24], mats.cloth, [0, 0, Math.PI * 0.5], 14);
  addBox(group, "loom-shuttle", [0.38, 0.052, 0.11], [0.32, 0.62, -0.22], mats.warm, [0, 0.18, 0.03]);
  addBox(group, "pedal-left", [0.34, 0.035, 0.18], [-0.28, 0.16, 0.28], mats.ink, [0, 0.14, 0]);
  addBox(group, "pedal-right", [0.34, 0.035, 0.18], [0.28, 0.16, 0.28], mats.ink, [0, -0.14, 0]);

  return group;
}

function createObservabilitySignalSpire() {
  const group = new THREE.Group();
  group.name = "itart-observability-signal-spire";

  addBox(group, "relay-service-pad", [1.58, 0.12, 0.92], [0, 0.06, 0], mats.ink);
  addCylinder(group, "relay-left-uplink", 0.036, 0.052, 1.34, [-0.52, 0.76, 0.02], mats.graphite, [0, 0, -0.08], 10);
  addCylinder(group, "relay-right-uplink", 0.036, 0.052, 1.24, [0.52, 0.72, 0.02], mats.graphite, [0, 0, 0.08], 10);
  addBox(group, "relay-trace-wall", [1.08, 0.72, 0.07], [0, 0.68, -0.24], mats.techDeep, [-0.08, 0, 0]);
  for (let index = 0; index < 6; index += 1) {
    const y = 0.42 + index * 0.095;
    addBox(group, `relay-log-line-${index}`, [0.18 + (index % 3) * 0.14, 0.022, 0.026], [-0.34 + index * 0.13, y, -0.3], index % 2 ? mats.warm : mats.tech);
  }
  addTube(group, "relay-trace-primary", [[-0.62, 0.24, 0.28], [-0.28, 0.7, 0.12], [0.06, 1.08, -0.12], [0.48, 1.38, -0.24]], 0.016, mats.tech);
  addTube(group, "relay-trace-secondary", [[0.62, 0.24, 0.26], [0.22, 0.62, 0.16], [-0.06, 0.98, -0.08], [-0.44, 1.28, -0.22]], 0.014, mats.warm);
  addTorus(group, "relay-scan-orbit-low", 0.42, 0.012, [0, 0.94, 0.02], mats.tech, [Math.PI * 0.5, 0.32, 0]);
  addTorus(group, "relay-scan-orbit-high", 0.3, 0.011, [0, 1.32, 0.0], mats.warm, [Math.PI * 0.5, -0.2, 0]);
  addSphere(group, "relay-correlation-node", 0.1, [0, 1.48, -0.18], mats.techGlass, [1.12, 0.88, 1]);
  addSphere(group, "relay-alert-node-left", 0.055, [-0.46, 0.96, -0.26], mats.warm);
  addSphere(group, "relay-alert-node-right", 0.052, [0.42, 0.84, -0.26], mats.tech);
  addBox(group, "relay-metric-stack", [0.72, 0.08, 0.16], [0, 0.22, 0.3], mats.graphite);

  return group;
}

function createCloudCableManifold() {
  const group = new THREE.Group();
  group.name = "itart-cloud-cable-manifold";

  addBox(group, "manifold-service-slab", [1.72, 0.1, 1.04], [0, 0.05, 0], mats.techDeep);
  addBox(group, "manifold-rack-left", [0.36, 0.78, 0.32], [-0.54, 0.48, -0.08], mats.ink);
  addBox(group, "manifold-rack-right", [0.36, 0.78, 0.32], [0.54, 0.48, -0.08], mats.ink);
  addBox(group, "manifold-switch-core", [0.62, 0.28, 0.38], [0, 0.38, -0.08], mats.graphite);
  for (let index = 0; index < 5; index += 1) {
    const x = -0.26 + index * 0.13;
    addBox(group, `switch-port-${index}`, [0.055, 0.038, 0.03], [x, 0.44, -0.29], index % 2 ? mats.studio : mats.tech);
  }
  addTube(group, "fiber-bundle-main", [[-0.62, 0.34, 0.14], [-0.38, 0.72, 0.42], [0.0, 0.48, 0.56], [0.48, 0.86, 0.28]], 0.022, mats.tech);
  addTube(group, "fiber-bundle-return", [[0.62, 0.3, 0.16], [0.26, 0.62, 0.48], [-0.12, 0.5, 0.5], [-0.52, 0.78, 0.22]], 0.018, mats.warm);
  addTube(group, "fiber-bundle-low", [[-0.68, 0.2, -0.34], [-0.2, 0.3, -0.54], [0.22, 0.22, -0.48], [0.68, 0.38, -0.34]], 0.017, mats.tech);
  addSphere(group, "manifold-cloud-left", 0.18, [-0.46, 1.02, 0.2], mats.techGlass, [1.3, 0.72, 0.78]);
  addSphere(group, "manifold-cloud-mid", 0.24, [0.0, 1.1, 0.24], mats.techGlass, [1.48, 0.74, 0.82]);
  addSphere(group, "manifold-cloud-right", 0.18, [0.46, 1.02, 0.2], mats.techGlass, [1.18, 0.7, 0.76]);
  addCylinder(group, "manifold-uplink-pin", 0.035, 0.048, 0.7, [0, 0.76, -0.34], mats.graphite, [0, 0, 0], 10);
  addSphere(group, "manifold-uplink-glow", 0.075, [0, 1.14, -0.34], mats.tech);

  return group;
}

function createAtelierSwatchStand() {
  const group = new THREE.Group();
  group.name = "itart-atelier-swatch-stand";

  addBox(group, "swatch-stand-base", [1.52, 0.08, 0.88], [0, 0.04, 0], mats.studio);
  addCylinder(group, "stand-left-post", 0.026, 0.034, 1.06, [-0.58, 0.6, 0.04], mats.ink, [0, 0, 0], 8);
  addCylinder(group, "stand-right-post", 0.026, 0.034, 1.06, [0.58, 0.6, 0.04], mats.ink, [0, 0, 0], 8);
  addCylinder(group, "stand-top-bar", 0.024, 0.024, 1.2, [0, 1.13, 0.04], mats.ink, [0, 0, Math.PI * 0.5], 8);
  const swatches = [
    { name: "coral", x: -0.42, mat: mats.cloth, angle: -0.08, height: 0.54 },
    { name: "cream", x: -0.14, mat: mats.studio, angle: 0.04, height: 0.62 },
    { name: "deep", x: 0.14, mat: mats.artDeep, angle: -0.03, height: 0.5 },
    { name: "signal", x: 0.42, mat: mats.art, angle: 0.08, height: 0.58 }
  ];
  for (const swatch of swatches) {
    addBox(group, `hanging-swatch-${swatch.name}`, [0.22, swatch.height, 0.035], [swatch.x, 0.82, 0.05], swatch.mat, [0, 0, swatch.angle]);
    addCylinder(group, `swatch-pin-${swatch.name}`, 0.022, 0.022, 0.3, [swatch.x, 1.13, 0.02], mats.warm, [Math.PI * 0.5, 0, 0], 8);
  }
  addBox(group, "sample-ledger-board", [0.76, 0.38, 0.045], [0, 0.34, -0.28], mats.ink, [0, 0.08, 0]);
  for (let index = 0; index < 4; index += 1) {
    addBox(group, `sample-ledger-line-${index}`, [0.18 + index * 0.08, 0.022, 0.018], [-0.22 + index * 0.12, 0.28 + index * 0.055, -0.315], index % 2 ? mats.warm : mats.art);
  }
  addCylinder(group, "rolled-cloth-low", 0.07, 0.07, 0.92, [0.0, 0.2, 0.34], mats.cloth, [0, 0, Math.PI * 0.5], 12);
  addTube(group, "chalk-silhouette-thread", [[-0.56, 0.24, -0.16], [-0.24, 0.42, -0.22], [0.18, 0.3, -0.18], [0.56, 0.5, -0.22]], 0.011, mats.studio);

  return group;
}

function createObservabilityLogTotem() {
  const group = new THREE.Group();
  group.name = "itart-observability-log-totem";

  addBox(group, "log-totem-pad", [1.22, 0.1, 0.92], [0, 0.05, 0], mats.ink);
  addBox(group, "log-totem-spine", [0.24, 1.42, 0.24], [0, 0.78, 0], mats.graphite);
  for (let index = 0; index < 4; index += 1) {
    const y = 0.38 + index * 0.28;
    const side = index % 2 === 0 ? -1 : 1;
    addBox(group, `log-screen-${index}`, [0.58, 0.18, 0.045], [side * 0.38, y, -0.18], index % 2 ? mats.techDeep : mats.graphite, [0, side * 0.18, 0]);
    addBox(group, `log-screen-line-${index}-a`, [0.3, 0.022, 0.018], [side * 0.38, y + 0.03, -0.215], index % 2 ? mats.warm : mats.tech, [0, side * 0.18, 0]);
    addBox(group, `log-screen-line-${index}-b`, [0.2, 0.018, 0.018], [side * 0.34, y - 0.04, -0.215], index % 2 ? mats.tech : mats.studio, [0, side * 0.18, 0]);
  }
  addTorus(group, "totem-low-orbit", 0.48, 0.012, [0, 0.68, 0.02], mats.tech, [Math.PI * 0.5, 0.12, 0]);
  addTorus(group, "totem-high-orbit", 0.34, 0.011, [0, 1.32, 0.02], mats.warm, [Math.PI * 0.5, -0.18, 0]);
  addTube(group, "totem-trace-ladder-a", [[-0.48, 0.22, 0.28], [-0.22, 0.72, 0.12], [0.08, 1.12, -0.08], [0.38, 1.54, -0.24]], 0.014, mats.tech);
  addTube(group, "totem-trace-ladder-b", [[0.5, 0.22, 0.24], [0.18, 0.68, 0.18], [-0.06, 1.04, -0.06], [-0.32, 1.42, -0.2]], 0.012, mats.warm);
  addCylinder(group, "totem-alert-pin", 0.026, 0.04, 0.46, [0, 1.62, -0.08], mats.graphite, [0, 0, 0], 8);
  addSphere(group, "totem-alert-node", 0.09, [0, 1.9, -0.08], mats.warm);
  addSphere(group, "totem-correlation-node", 0.07, [0.42, 1.02, 0.18], mats.tech);

  return group;
}

function createRoadWaterCauseway() {
  const group = new THREE.Group();
  group.name = "itart-road-water-causeway";

  addBox(group, "causeway-road-slab", [2.18, 0.12, 0.78], [0, 0.08, 0], mats.graphite);
  addBox(group, "causeway-road-core", [1.94, 0.04, 0.54], [0, 0.18, 0], mats.studio);
  addBox(group, "causeway-lane-line-a", [0.58, 0.025, 0.035], [-0.54, 0.22, 0], mats.warm);
  addBox(group, "causeway-lane-line-b", [0.58, 0.025, 0.035], [0.54, 0.22, 0], mats.warm);
  addBox(group, "water-plane-left", [2.08, 0.035, 0.42], [0, 0.045, -0.58], mats.techGlass);
  addBox(group, "water-plane-right", [2.08, 0.035, 0.42], [0, 0.045, 0.58], mats.techGlass);
  addBox(group, "foam-edge-left", [1.9, 0.024, 0.035], [0, 0.085, -0.35], mats.tech);
  addBox(group, "foam-edge-right", [1.9, 0.024, 0.035], [0, 0.085, 0.35], mats.tech);
  addTube(group, "shore-cable-left", [[-0.94, 0.2, -0.4], [-0.32, 0.28, -0.52], [0.36, 0.2, -0.44], [0.98, 0.3, -0.56]], 0.016, mats.tech);
  addTube(group, "shore-cable-right", [[-1.0, 0.2, 0.4], [-0.38, 0.3, 0.54], [0.3, 0.22, 0.45], [0.92, 0.3, 0.55]], 0.014, mats.warm);
  addCylinder(group, "left-bollard-a", 0.035, 0.048, 0.36, [-0.84, 0.28, -0.31], mats.ink, [0, 0, 0], 8);
  addCylinder(group, "left-bollard-b", 0.035, 0.048, 0.36, [0.84, 0.28, -0.31], mats.ink, [0, 0, 0], 8);
  addCylinder(group, "right-bollard-a", 0.035, 0.048, 0.36, [-0.84, 0.28, 0.31], mats.ink, [0, 0, 0], 8);
  addCylinder(group, "right-bollard-b", 0.035, 0.048, 0.36, [0.84, 0.28, 0.31], mats.ink, [0, 0, 0], 8);

  return group;
}

function createReliefRoadTerrace() {
  const group = new THREE.Group();
  group.name = "itart-relief-road-terrace";

  addBox(group, "lower-road-cut", [1.86, 0.11, 0.62], [-0.08, 0.08, -0.08], mats.graphite, [0, 0.08, 0]);
  addBox(group, "upper-terrace-plate", [1.44, 0.14, 0.82], [0.22, 0.36, 0.22], mats.techDeep, [0, -0.12, 0]);
  addBox(group, "terrace-road-cap", [1.16, 0.04, 0.54], [0.22, 0.46, 0.22], mats.studio, [0, -0.12, 0]);
  addCylinder(group, "retaining-rock-a", 0.18, 0.28, 0.36, [-0.74, 0.26, 0.36], mats.graphite, [0, 0.2, 0.08], 7);
  addCylinder(group, "retaining-rock-b", 0.16, 0.24, 0.42, [-0.36, 0.24, 0.46], mats.ink, [0.08, -0.1, -0.08], 7);
  addCylinder(group, "retaining-rock-c", 0.14, 0.22, 0.36, [0.62, 0.22, -0.42], mats.graphite, [-0.08, 0.18, 0], 7);
  addBox(group, "ramp-chevron-a", [0.32, 0.026, 0.045], [-0.4, 0.2, -0.1], mats.tech, [0, 0.68, 0]);
  addBox(group, "ramp-chevron-b", [0.32, 0.026, 0.045], [0.0, 0.27, 0.03], mats.warm, [0, 0.68, 0]);
  addBox(group, "ramp-chevron-c", [0.32, 0.026, 0.045], [0.4, 0.34, 0.14], mats.tech, [0, 0.68, 0]);
  addTube(group, "contour-line-low", [[-0.92, 0.18, 0.18], [-0.42, 0.24, 0.34], [0.16, 0.28, 0.18], [0.82, 0.24, 0.3]], 0.012, mats.warm);
  addTube(group, "contour-line-high", [[-0.72, 0.42, -0.34], [-0.2, 0.52, -0.18], [0.34, 0.5, -0.28], [0.82, 0.58, -0.12]], 0.011, mats.tech);

  return group;
}

function createFieldMarkerGrove() {
  const group = new THREE.Group();
  group.name = "itart-field-marker-grove";

  addBox(group, "field-shadow-pad", [1.74, 0.035, 1.18], [0, 0.025, 0], mats.techDeep, [0, 0.22, 0]);
  const stems = [
    [-0.56, 0.32, -0.18, 0.42, mats.tech],
    [-0.24, 0.42, 0.22, 0.56, mats.warm],
    [0.12, 0.36, -0.28, 0.48, mats.art],
    [0.48, 0.46, 0.18, 0.62, mats.studio]
  ];
  stems.forEach(([x, y, z, height, mat], index) => {
    addCylinder(group, `marker-stem-${index}`, 0.018, 0.026, height, [x, y, z], mats.ink, [0, 0, 0], 7);
    addSphere(group, `marker-canopy-${index}`, 0.16, [x, y + height * 0.5, z], mat, [1.1, 0.72, 0.9]);
  });
  addBox(group, "field-ribbon-a", [1.22, 0.026, 0.045], [-0.08, 0.1, -0.42], mats.tech, [0, 0.2, 0]);
  addBox(group, "field-ribbon-b", [0.96, 0.026, 0.045], [0.12, 0.11, 0.42], mats.warm, [0, -0.18, 0]);
  addTube(group, "field-path-curve", [[-0.72, 0.08, 0.1], [-0.36, 0.1, -0.18], [0.08, 0.08, 0.16], [0.62, 0.1, -0.06]], 0.012, mats.studio);

  return group;
}

const assets = [
  { outputDir: heroOutputDir, fileName: "server-cloud-node.glb", scene: createServerCloudNode() },
  { outputDir: heroOutputDir, fileName: "atelier-mannequin-rack.glb", scene: createAtelierMannequinRack() },
  { outputDir: heroOutputDir, fileName: "telemetry-radar-mast.glb", scene: createTelemetryRadarMast() },
  { outputDir: heroOutputDir, fileName: "cloud-circuit-bridge.glb", scene: createCloudCircuitBridge() },
  { outputDir: heroOutputDir, fileName: "atelier-drape-frame.glb", scene: createAtelierDrapeFrame() },
  { outputDir: heroOutputDir, fileName: "telemetry-screen-array.glb", scene: createTelemetryScreenArray() },
  { outputDir: heroOutputDir, fileName: "cloud-energy-anchor.glb", scene: createCloudEnergyAnchor() },
  { outputDir: heroOutputDir, fileName: "atelier-pattern-wall.glb", scene: createAtelierPatternWall() },
  { outputDir: heroOutputDir, fileName: "telemetry-trace-beacon.glb", scene: createTelemetryTraceBeacon() },
  { outputDir: environmentOutputDir, fileName: "cloud-server-pier.glb", scene: createCloudServerPier() },
  { outputDir: environmentOutputDir, fileName: "atelier-cutting-island.glb", scene: createAtelierCuttingIsland() },
  { outputDir: environmentOutputDir, fileName: "observability-trace-station.glb", scene: createObservabilityTraceStation() },
  { outputDir: premiumOutputDir, fileName: "cloud-infra-gateway.glb", scene: createCloudInfraGateway() },
  { outputDir: premiumOutputDir, fileName: "atelier-garment-loom.glb", scene: createAtelierGarmentLoom() },
  { outputDir: premiumOutputDir, fileName: "observability-signal-spire.glb", scene: createObservabilitySignalSpire() },
  { outputDir: detailOutputDir, fileName: "cloud-cable-manifold.glb", scene: createCloudCableManifold() },
  { outputDir: detailOutputDir, fileName: "atelier-swatch-stand.glb", scene: createAtelierSwatchStand() },
  { outputDir: detailOutputDir, fileName: "observability-log-totem.glb", scene: createObservabilityLogTotem() },
  { outputDir: terrainOutputDir, fileName: "road-water-causeway.glb", scene: createRoadWaterCauseway() },
  { outputDir: terrainOutputDir, fileName: "relief-road-terrace.glb", scene: createReliefRoadTerrace() },
  { outputDir: terrainOutputDir, fileName: "field-marker-grove.glb", scene: createFieldMarkerGrove() }
];

fs.mkdirSync(heroOutputDir, { recursive: true });
fs.mkdirSync(environmentOutputDir, { recursive: true });
fs.mkdirSync(premiumOutputDir, { recursive: true });
fs.mkdirSync(detailOutputDir, { recursive: true });
fs.mkdirSync(terrainOutputDir, { recursive: true });
const exporter = new GLTFExporter();
const results = [];

for (const { outputDir, fileName, scene } of assets) {
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
    outputDir: path.relative(root, outputDir),
    fileName,
    fileKb: Number((fs.statSync(outputPath).size / 1024).toFixed(1))
  });
}

console.log(JSON.stringify({ assets: results }, null, 2));
