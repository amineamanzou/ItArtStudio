/**
 * Build-time geometry for the abstract hero.
 *
 * One signal, two readings: every stratum is the same periodic waveform on both
 * sides of the axis. ART draws it as a continuous curve; IT samples and holds it
 * on a quantized grid. Each SVG track spans three periods so a CSS translation
 * of exactly one period loops without a visible seam.
 */

export const heroBeatSeconds = 1.2;

const period = 200;
const trackWidth = period * 3;
const viewHeight = 1000;

interface StratumSpec {
  kind: "ghost" | "body";
  center: number;
  amplitude: number;
  samples: number;
  phase: number;
  swell: number;
}

/*
 * Back to front: two outline-only echoes carry the rhythm behind the signature,
 * then four filled strata. Back layers are finer and slower, front layers
 * coarser and faster.
 */
const strata: StratumSpec[] = [
  { kind: "ghost", center: 255, amplitude: 30, samples: 24, phase: 4.4, swell: 1.4 },
  { kind: "ghost", center: 400, amplitude: 38, samples: 16, phase: 1.3, swell: 1.3 },
  { kind: "body", center: 585, amplitude: 34, samples: 16, phase: 0.4, swell: 1.05 },
  { kind: "body", center: 665, amplitude: 40, samples: 12, phase: 2.1, swell: 1.04 },
  { kind: "body", center: 752, amplitude: 30, samples: 8, phase: 3.7, swell: 1.035 },
  { kind: "body", center: 848, amplitude: 22, samples: 6, phase: 5.2, swell: 1.03 }
];

const round = (value: number) => Math.round(value * 10) / 10;

function wave(x: number, phase: number): number {
  const angle = (2 * Math.PI * x) / period;
  const value =
    Math.sin(angle + phase) +
    0.42 * Math.sin(2 * angle + phase * 1.7 + 0.8) +
    0.18 * Math.sin(3 * angle - phase * 0.6 + 2.1);
  return value / 1.6;
}

function organicPoints(spec: StratumSpec): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (let x = 0; x <= trackWidth; x += 3) {
    points.push([x, round(spec.center - spec.amplitude * wave(x, spec.phase))]);
  }
  return points;
}

function sampledPoints(spec: StratumSpec): Array<[number, number]> {
  const step = period / spec.samples;
  const points: Array<[number, number]> = [];
  for (let sample = 0; sample < spec.samples * 3; sample += 1) {
    const x = sample * step;
    /* Sample-and-hold on five levels: -1, -0.5, 0, 0.5, 1. */
    const held = Math.round(wave(x, spec.phase) * 2) / 2;
    const y = round(spec.center - spec.amplitude * held);
    points.push([round(x), y], [round(x + step), y]);
  }
  return points;
}

function toPaths(points: Array<[number, number]>) {
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`)
    .join("");
  return {
    crest: line,
    body: `${line}L${trackWidth} ${viewHeight}L0 ${viewHeight}Z`
  };
}

export interface HeroStratum {
  index: number;
  kind: "ghost" | "body";
  samples: number;
  flowSeconds: number;
  swell: number;
  crestTop: number;
  /** Band edges, as percentages of the stage height from the top and bottom. */
  bandTop: number;
  bandBottom: number;
  viewBox: string;
  art: { crest: string; body: string };
  it: { crest: string; body: string };
}

const bandMargin = 24;

export const heroStrata: HeroStratum[] = strata.map((spec, index) => {
  const viewTop = spec.center - spec.amplitude - bandMargin;
  /* An echo is only a line: its band stops just below its lowest trough. */
  const viewBottom = spec.kind === "ghost"
    ? spec.center + spec.amplitude + bandMargin
    : viewHeight;
  return {
    index,
    kind: spec.kind,
    samples: spec.samples,
    /* One period per `samples` beats: each IT tick moves exactly one sample. */
    flowSeconds: spec.samples * heroBeatSeconds,
    swell: spec.swell,
    crestTop: spec.center - spec.amplitude,
    bandTop: viewTop / (viewHeight / 100),
    bandBottom: (viewHeight - viewBottom) / (viewHeight / 100),
    viewBox: `0 ${viewTop} ${trackWidth} ${viewBottom - viewTop}`,
    art: toPaths(organicPoints(spec)),
    it: toPaths(sampledPoints(spec))
  };
});
