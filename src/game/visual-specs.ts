export type VisualTone = "accent" | "light" | "dark" | "secondary";

export type ZoneDecalSpec = {
  id: string;
  offset: [number, number];
  size: [number, number];
  rotation: number;
  tone: VisualTone;
};

export type ZonePropClusterSpec = {
  id: string;
  offset: [number, number];
  count: number;
  spread: number;
  scale: number;
  tone: VisualTone;
  form: "beacon" | "stack" | "pin" | "totem";
};

export type ZoneSurfaceBandSpec = {
  id: string;
  offset: [number, number];
  length: number;
  width: number;
  rotation: number;
  tone: VisualTone;
  role: "trim" | "inlay" | "seam" | "anchor";
};

export type ZoneSurfaceSpec = {
  profileId: string;
  finish: string;
  motif: string;
  bands: ZoneSurfaceBandSpec[];
};

export type ZoneVisualSpec = {
  id: string;
  biome: "threshold" | "lab" | "tower" | "bridge" | "dock" | "atelier" | "foundry" | "runway" | "plaza" | "portal";
  materialVariants: string[];
  animation: { idleSpin: number; activeSpin: number; activeScale: number; pulse: number };
  surface: ZoneSurfaceSpec;
  decals: ZoneDecalSpec[];
  propClusters: ZonePropClusterSpec[];
};

const decals = (zone: string, items: Array<Omit<ZoneDecalSpec, "id">>): ZoneDecalSpec[] =>
  items.map((item, index) => ({ ...item, id: `${zone}-decal-${index + 1}` }));

const clusters = (zone: string, items: Array<Omit<ZonePropClusterSpec, "id">>): ZonePropClusterSpec[] =>
  items.map((item, index) => ({ ...item, id: `${zone}-cluster-${index + 1}` }));

const surface = (
  zone: string,
  finish: string,
  motif: string,
  bands: Array<Omit<ZoneSurfaceBandSpec, "id">>
): ZoneSurfaceSpec => ({
  profileId: `${zone}-surface`,
  finish,
  motif,
  bands: bands.map((band, index) => ({ ...band, id: `${zone}-surface-band-${index + 1}` }))
});

export const zoneVisualSpecs: Record<string, ZoneVisualSpec> = {
  "studio-gate": {
    id: "studio-gate",
    biome: "threshold",
    materialVariants: ["studio-glow", "tech-edge", "art-edge", "warm-stone"],
    animation: { idleSpin: 0.1, activeSpin: 0.36, activeScale: 1.13, pulse: 0.1 },
    surface: surface("studio-gate", "split enamel threshold", "two-tone crossing seam", [
      { offset: [-0.46, 0], length: 1.42, width: 0.08, rotation: -0.42, tone: "secondary", role: "trim" },
      { offset: [0.46, 0], length: 1.42, width: 0.08, rotation: -0.42, tone: "accent", role: "trim" },
      { offset: [0, 0.58], length: 1.16, width: 0.06, rotation: 0.08, tone: "light", role: "seam" },
      { offset: [0, -0.58], length: 0.88, width: 0.05, rotation: 0.08, tone: "dark", role: "anchor" }
    ]),
    decals: decals("studio-gate", [
      { offset: [-0.78, 0.18], size: [0.72, 0.08], rotation: -0.18, tone: "secondary" },
      { offset: [0.78, -0.18], size: [0.72, 0.08], rotation: -0.18, tone: "accent" },
      { offset: [0, 0.72], size: [1.12, 0.08], rotation: 0, tone: "light" }
    ]),
    propClusters: clusters("studio-gate", [
      { offset: [-1.18, 0.72], count: 4, spread: 0.36, scale: 0.72, tone: "secondary", form: "beacon" },
      { offset: [1.18, -0.72], count: 4, spread: 0.36, scale: 0.72, tone: "accent", form: "beacon" },
      { offset: [0, -1.08], count: 3, spread: 0.28, scale: 0.62, tone: "light", form: "pin" }
    ])
  },
  "ai-lab": {
    id: "ai-lab",
    biome: "lab",
    materialVariants: ["cyan-glass", "black-console", "warm-screen", "signal-dot"],
    animation: { idleSpin: 0.16, activeSpin: 0.5, activeScale: 1.14, pulse: 0.18 },
    surface: surface("ai-lab", "glossy circuit glass", "offset neural traces", [
      { offset: [-0.48, -0.46], length: 1.18, width: 0.055, rotation: 0.78, tone: "accent", role: "inlay" },
      { offset: [0.52, 0.42], length: 0.92, width: 0.055, rotation: 0.78, tone: "light", role: "inlay" },
      { offset: [-0.12, 0.76], length: 1.02, width: 0.045, rotation: 0.02, tone: "dark", role: "seam" },
      { offset: [0.74, -0.68], length: 0.5, width: 0.08, rotation: -0.34, tone: "secondary", role: "anchor" }
    ]),
    decals: decals("ai-lab", [
      { offset: [-0.72, -0.62], size: [0.92, 0.07], rotation: 0.42, tone: "light" },
      { offset: [0.66, 0.54], size: [0.74, 0.07], rotation: -0.36, tone: "accent" },
      { offset: [0.04, 1.08], size: [1.04, 0.06], rotation: 0.02, tone: "dark" }
    ]),
    propClusters: clusters("ai-lab", [
      { offset: [-1.08, -0.8], count: 5, spread: 0.42, scale: 0.66, tone: "accent", form: "totem" },
      { offset: [1.08, 0.74], count: 4, spread: 0.36, scale: 0.62, tone: "light", form: "stack" },
      { offset: [-0.08, 1.22], count: 4, spread: 0.34, scale: 0.58, tone: "accent", form: "beacon" }
    ])
  },
  "observability-tower": {
    id: "observability-tower",
    biome: "tower",
    materialVariants: ["radar-cyan", "deep-console", "trace-line", "cream-signal"],
    animation: { idleSpin: 0.12, activeSpin: 0.58, activeScale: 1.12, pulse: 0.22 },
    surface: surface("observability-tower", "radar lacquer", "concentric trace ticks", [
      { offset: [-0.62, 0.1], length: 1, width: 0.05, rotation: 1.36, tone: "accent", role: "trim" },
      { offset: [0.62, -0.1], length: 1, width: 0.05, rotation: 1.36, tone: "light", role: "trim" },
      { offset: [0, 0.66], length: 0.86, width: 0.045, rotation: 0.3, tone: "dark", role: "seam" },
      { offset: [0.02, -0.72], length: 0.62, width: 0.07, rotation: -0.16, tone: "accent", role: "anchor" }
    ]),
    decals: decals("observability-tower", [
      { offset: [-0.82, 0.42], size: [0.88, 0.06], rotation: 1.18, tone: "accent" },
      { offset: [0.74, -0.48], size: [0.82, 0.06], rotation: 1.18, tone: "light" },
      { offset: [0, 1.04], size: [1.18, 0.05], rotation: 0.28, tone: "dark" }
    ]),
    propClusters: clusters("observability-tower", [
      { offset: [-1.16, 0.06], count: 4, spread: 0.34, scale: 0.72, tone: "accent", form: "pin" },
      { offset: [1.1, -0.18], count: 4, spread: 0.34, scale: 0.72, tone: "light", form: "pin" },
      { offset: [0.16, 1.18], count: 3, spread: 0.26, scale: 0.64, tone: "accent", form: "beacon" }
    ])
  },
  "architecture-bridge": {
    id: "architecture-bridge",
    biome: "bridge",
    materialVariants: ["structural-cyan", "cream-truss", "black-span", "cool-shadow"],
    animation: { idleSpin: 0.06, activeSpin: 0.26, activeScale: 1.1, pulse: 0.08 },
    surface: surface("architecture-bridge", "brushed structural deck", "load-bearing diagonals", [
      { offset: [-0.64, -0.32], length: 1.58, width: 0.07, rotation: -0.78, tone: "light", role: "trim" },
      { offset: [0.64, 0.32], length: 1.58, width: 0.07, rotation: -0.78, tone: "accent", role: "trim" },
      { offset: [0, 0.72], length: 1.18, width: 0.055, rotation: 0.12, tone: "dark", role: "seam" },
      { offset: [0, -0.72], length: 1.08, width: 0.075, rotation: 0.12, tone: "secondary", role: "anchor" }
    ]),
    decals: decals("architecture-bridge", [
      { offset: [-1.02, -0.24], size: [1.08, 0.08], rotation: -0.74, tone: "light" },
      { offset: [1.02, 0.24], size: [1.08, 0.08], rotation: -0.74, tone: "accent" },
      { offset: [0, -1.06], size: [1.24, 0.075], rotation: 0.12, tone: "dark" }
    ]),
    propClusters: clusters("architecture-bridge", [
      { offset: [-1.34, -0.82], count: 3, spread: 0.36, scale: 0.78, tone: "light", form: "stack" },
      { offset: [1.34, 0.82], count: 3, spread: 0.36, scale: 0.78, tone: "accent", form: "stack" },
      { offset: [0.1, 1.2], count: 4, spread: 0.38, scale: 0.64, tone: "accent", form: "pin" }
    ])
  },
  "cloud-dock": {
    id: "cloud-dock",
    biome: "dock",
    materialVariants: ["dock-cyan", "cargo-cream", "harbor-black", "cold-signal"],
    animation: { idleSpin: 0.09, activeSpin: 0.34, activeScale: 1.11, pulse: 0.13 },
    surface: surface("cloud-dock", "cold harbor plating", "cargo lane markings", [
      { offset: [-0.62, 0.52], length: 0.92, width: 0.055, rotation: 0.02, tone: "dark", role: "seam" },
      { offset: [0.58, 0.52], length: 0.82, width: 0.055, rotation: 0.02, tone: "light", role: "trim" },
      { offset: [0.02, -0.58], length: 1.1, width: 0.06, rotation: -0.4, tone: "accent", role: "inlay" },
      { offset: [-0.72, -0.18], length: 0.54, width: 0.075, rotation: 0.34, tone: "secondary", role: "anchor" }
    ]),
    decals: decals("cloud-dock", [
      { offset: [-0.9, 0.78], size: [0.8, 0.06], rotation: 0.04, tone: "dark" },
      { offset: [0.85, 0.8], size: [0.7, 0.06], rotation: 0.04, tone: "light" },
      { offset: [0.14, -0.92], size: [1.18, 0.07], rotation: -0.36, tone: "accent" }
    ]),
    propClusters: clusters("cloud-dock", [
      { offset: [-1.1, 0.98], count: 4, spread: 0.34, scale: 0.68, tone: "light", form: "stack" },
      { offset: [1.08, 0.98], count: 4, spread: 0.34, scale: 0.68, tone: "accent", form: "stack" },
      { offset: [0.08, -1.18], count: 4, spread: 0.36, scale: 0.58, tone: "accent", form: "beacon" }
    ])
  },
  "design-atelier": {
    id: "design-atelier",
    biome: "atelier",
    materialVariants: ["coral-canvas", "cream-paper", "cyan-swatch", "ink-table"],
    animation: { idleSpin: 0.13, activeSpin: 0.4, activeScale: 1.14, pulse: 0.2 },
    surface: surface("design-atelier", "matte canvas board", "swatch table diagonals", [
      { offset: [-0.52, -0.42], length: 0.92, width: 0.075, rotation: -0.2, tone: "light", role: "inlay" },
      { offset: [0.52, 0.38], length: 0.92, width: 0.075, rotation: 0.28, tone: "accent", role: "inlay" },
      { offset: [0, 0.72], length: 1.08, width: 0.05, rotation: -0.08, tone: "secondary", role: "trim" },
      { offset: [-0.72, 0.12], length: 0.48, width: 0.08, rotation: 0.62, tone: "dark", role: "anchor" }
    ]),
    decals: decals("design-atelier", [
      { offset: [-0.86, -0.48], size: [0.76, 0.08], rotation: -0.18, tone: "light" },
      { offset: [0.84, 0.46], size: [0.76, 0.08], rotation: 0.26, tone: "accent" },
      { offset: [0, 1.04], size: [1.14, 0.06], rotation: -0.08, tone: "secondary" }
    ]),
    propClusters: clusters("design-atelier", [
      { offset: [-1.16, -0.72], count: 4, spread: 0.36, scale: 0.6, tone: "light", form: "pin" },
      { offset: [1.1, 0.72], count: 5, spread: 0.38, scale: 0.56, tone: "accent", form: "beacon" },
      { offset: [0.16, 1.18], count: 4, spread: 0.3, scale: 0.54, tone: "secondary", form: "stack" }
    ])
  },
  "three-d-foundry": {
    id: "three-d-foundry",
    biome: "foundry",
    materialVariants: ["molten-coral", "cream-form", "cyan-grid", "dark-crane"],
    animation: { idleSpin: 0.11, activeSpin: 0.48, activeScale: 1.13, pulse: 0.18 },
    surface: surface("three-d-foundry", "molten resin grid", "calibration crosshair", [
      { offset: [-0.52, 0.48], length: 1.08, width: 0.055, rotation: 0.78, tone: "accent", role: "trim" },
      { offset: [0.52, -0.48], length: 1.08, width: 0.055, rotation: 0.78, tone: "light", role: "trim" },
      { offset: [0, 0], length: 1.18, width: 0.045, rotation: -0.22, tone: "secondary", role: "seam" },
      { offset: [0.72, 0.58], length: 0.48, width: 0.075, rotation: -0.52, tone: "dark", role: "anchor" }
    ]),
    decals: decals("three-d-foundry", [
      { offset: [-0.76, 0.72], size: [0.92, 0.07], rotation: 0.72, tone: "accent" },
      { offset: [0.76, -0.72], size: [0.92, 0.07], rotation: 0.72, tone: "light" },
      { offset: [0, 0.02], size: [1.24, 0.05], rotation: -0.22, tone: "secondary" }
    ]),
    propClusters: clusters("three-d-foundry", [
      { offset: [-1.12, 0.78], count: 4, spread: 0.34, scale: 0.64, tone: "accent", form: "totem" },
      { offset: [1.12, -0.78], count: 4, spread: 0.34, scale: 0.64, tone: "light", form: "totem" },
      { offset: [0.1, 1.12], count: 4, spread: 0.32, scale: 0.58, tone: "secondary", form: "pin" }
    ])
  },
  "fashion-room": {
    id: "fashion-room",
    biome: "runway",
    materialVariants: ["runway-coral", "cream-fabric", "cyan-stitch", "black-rail"],
    animation: { idleSpin: 0.08, activeSpin: 0.3, activeScale: 1.12, pulse: 0.16 },
    surface: surface("fashion-room", "soft runway laminate", "stitched runway rails", [
      { offset: [-0.68, 0], length: 1.38, width: 0.07, rotation: 1.57, tone: "light", role: "trim" },
      { offset: [0.68, 0], length: 1.38, width: 0.07, rotation: 1.57, tone: "accent", role: "trim" },
      { offset: [0, -0.76], length: 1.24, width: 0.06, rotation: 0, tone: "dark", role: "seam" },
      { offset: [0, 0.76], length: 1.02, width: 0.08, rotation: 0, tone: "secondary", role: "anchor" }
    ]),
    decals: decals("fashion-room", [
      { offset: [-1.06, 0], size: [1.06, 0.075], rotation: 1.57, tone: "light" },
      { offset: [1.06, 0], size: [1.06, 0.075], rotation: 1.57, tone: "accent" },
      { offset: [0, -1.04], size: [1.34, 0.075], rotation: 0, tone: "dark" }
    ]),
    propClusters: clusters("fashion-room", [
      { offset: [-1.32, 0.9], count: 4, spread: 0.4, scale: 0.68, tone: "light", form: "totem" },
      { offset: [1.32, 0.9], count: 4, spread: 0.4, scale: 0.68, tone: "accent", form: "totem" },
      { offset: [0, -1.3], count: 4, spread: 0.34, scale: 0.6, tone: "secondary", form: "pin" }
    ])
  },
  "values-plaza": {
    id: "values-plaza",
    biome: "plaza",
    materialVariants: ["warm-plaza", "cream-ring", "cyan-axis", "coral-axis"],
    animation: { idleSpin: 0.1, activeSpin: 0.38, activeScale: 1.13, pulse: 0.12 },
    surface: surface("values-plaza", "warm civic stone", "crossing value axes", [
      { offset: [-0.52, 0.4], length: 1.04, width: 0.065, rotation: -0.42, tone: "secondary", role: "trim" },
      { offset: [0.52, -0.4], length: 1.04, width: 0.065, rotation: -0.42, tone: "accent", role: "trim" },
      { offset: [0, 0], length: 1.22, width: 0.05, rotation: 0.78, tone: "light", role: "seam" },
      { offset: [0.02, -0.74], length: 0.58, width: 0.075, rotation: -0.18, tone: "dark", role: "anchor" }
    ]),
    decals: decals("values-plaza", [
      { offset: [-0.88, 0.56], size: [0.92, 0.07], rotation: -0.38, tone: "secondary" },
      { offset: [0.88, -0.56], size: [0.92, 0.07], rotation: -0.38, tone: "accent" },
      { offset: [0, 0], size: [1.28, 0.06], rotation: 0.78, tone: "light" }
    ]),
    propClusters: clusters("values-plaza", [
      { offset: [-1.2, 0.12], count: 4, spread: 0.36, scale: 0.64, tone: "secondary", form: "beacon" },
      { offset: [1.2, -0.12], count: 4, spread: 0.36, scale: 0.64, tone: "accent", form: "beacon" },
      { offset: [0, 1.18], count: 4, spread: 0.3, scale: 0.56, tone: "light", form: "pin" }
    ])
  },
  "contact-portal": {
    id: "contact-portal",
    biome: "portal",
    materialVariants: ["portal-gold", "cream-mail", "cyan-entry", "coral-entry"],
    animation: { idleSpin: 0.14, activeSpin: 0.44, activeScale: 1.15, pulse: 0.2 },
    surface: surface("contact-portal", "polished mail portal", "split invitation lanes", [
      { offset: [-0.58, -0.52], length: 0.98, width: 0.06, rotation: 0.36, tone: "secondary", role: "trim" },
      { offset: [0.58, -0.52], length: 0.98, width: 0.06, rotation: -0.36, tone: "accent", role: "trim" },
      { offset: [0, 0.68], length: 1.08, width: 0.05, rotation: 0, tone: "light", role: "seam" },
      { offset: [0, -0.08], length: 0.62, width: 0.08, rotation: 1.57, tone: "dark", role: "anchor" }
    ]),
    decals: decals("contact-portal", [
      { offset: [-0.9, -0.64], size: [0.82, 0.07], rotation: 0.36, tone: "secondary" },
      { offset: [0.9, -0.64], size: [0.82, 0.07], rotation: -0.36, tone: "accent" },
      { offset: [0, 1.02], size: [1.14, 0.06], rotation: 0, tone: "light" }
    ]),
    propClusters: clusters("contact-portal", [
      { offset: [-1.12, -0.96], count: 4, spread: 0.34, scale: 0.62, tone: "secondary", form: "pin" },
      { offset: [1.12, -0.96], count: 4, spread: 0.34, scale: 0.62, tone: "accent", form: "pin" },
      { offset: [0, 1.2], count: 4, spread: 0.28, scale: 0.58, tone: "light", form: "beacon" }
    ])
  }
};
