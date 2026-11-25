interface Branch {
  x: number;
  y: number;
  size: number;
  depth: number;
}

const facet = (points: number[][]) =>
  points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function projectBranch({ x, y, size, depth }: Branch) {
  const w = size * 0.86;
  const h = size * 0.44;
  const top = [x, y - h];
  const left = [x - w, y];
  const right = [x + w, y];
  const ridge = [x, y + h];
  const leftFoot = [x - w, y + size];
  const rightFoot = [x + w, y + size];
  const foot = [x, y + h + size];

  return {
    depth,
    crown: facet([top, right, ridge, left]),
    west: facet([left, ridge, foot, leftFoot]),
    east: facet([ridge, right, rightFoot, foot]),
    edge: facet([leftFoot, left, top, right, rightFoot, foot, ridge, left, ridge, right])
  };
}

function subdivide(branch: Branch): Branch[] {
  const { x, y, size, depth } = branch;
  if (depth === 3) return [branch];

  const children = [
    { x: x - size * 0.95, y: y - size * 0.77 },
    { x: x + size * 0.97, y: y - size * 0.55 },
    { x: x - size * 0.24, y: y + size * 1.33 }
  ];

  return [...children.flatMap((position) =>
    subdivide({ ...position, size: size * 0.43, depth: depth + 1 })
  ), branch];
}

const branches = subdivide({ x: 244, y: 371, size: 131, depth: 0 });

export const technicalFacets = branches.map(projectBranch);
export const technicalTraces = branches.filter(({ depth }) => depth < 3).flatMap(({ x, y, size }) => {
  const left = `M${x},${y}l${-size * 0.37},${-size * 0.19}v${-size * 0.37}l${-size * 0.58},${-size * 0.21}`;
  const right = `M${x},${y}l${size * 0.58},${size * 0.3}l${size * 0.39},${-size * 0.2}v${-size * 0.65}`;
  const lower = `M${x},${y}v${size * 1.18}l${-size * 0.24},${size * 0.15}`;
  return [left, right, lower];
});
