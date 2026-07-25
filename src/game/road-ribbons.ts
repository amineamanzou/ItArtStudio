import * as THREE from "three";

export type RoadRibbonGeometry = {
  bed: THREE.BufferGeometry;
  lane: THREE.BufferGeometry;
  bedDetailCount: number;
  laneDetailCount: number;
  vertexCount: number;
  signatures: string[];
};

type RoutePoint = THREE.Vector3;

export function createRoadRibbonGeometry(points: RoutePoint[], routeId: string, routeWidth: number): RoadRibbonGeometry {
  const bedCurve = new THREE.CatmullRomCurve3(points);
  const shoulderOffset = routeWidth * 0.32;
  const signalOffset = routeWidth * 0.15;
  const railA = offsetCurve(points, shoulderOffset);
  const railB = offsetCurve(points, -shoulderOffset);
  const signalA = offsetCurve(points, signalOffset);
  const signalB = offsetCurve(points, -signalOffset);

  const bedParts = [
    new THREE.TubeGeometry(bedCurve, 10, routeWidth * 0.12, 5, false),
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railA), 10, 0.036, 5, false),
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railB), 10, 0.036, 5, false)
  ];
  const laneParts = [
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(signalA), 10, 0.022, 5, false),
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(signalB), 10, 0.022, 5, false),
    ...createPulseDashes(bedCurve, routeWidth)
  ];

  const bed = mergeGeometries(bedParts);
  const lane = mergeGeometries(laneParts);
  bed.computeBoundingBox();
  bed.computeBoundingSphere();
  lane.computeBoundingBox();
  lane.computeBoundingSphere();

  const vertexCount = positionCount(bed) + positionCount(lane);
  return {
    bed,
    lane,
    bedDetailCount: bedParts.length,
    laneDetailCount: laneParts.length,
    vertexCount,
    signatures: [
      `road:${routeId}:bed-spine`,
      `road:${routeId}:left-rail`,
      `road:${routeId}:right-rail`,
      `road:${routeId}:left-signal`,
      `road:${routeId}:right-signal`,
      `road:${routeId}:pulse-dashes:${laneParts.length - 2}`
    ]
  };
}

function offsetCurve(points: RoutePoint[], distance: number) {
  return points.map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const tangent = new THREE.Vector3(next.x - previous.x, 0, next.z - previous.z);
    if (tangent.lengthSq() < 0.0001) {
      tangent.set(0, 0, 1);
    }
    tangent.normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x);
    return point.clone().addScaledVector(normal, distance);
  });
}

function createPulseDashes(curve: THREE.CatmullRomCurve3, routeWidth: number) {
  const parts: THREE.BufferGeometry[] = [];
  const dashCount = 4;
  for (let index = 1; index <= dashCount; index += 1) {
    const t = index / (dashCount + 1);
    const center = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const angle = Math.atan2(tangent.x, tangent.z);
    const dash = new THREE.BoxGeometry(0.1, 0.035, routeWidth * 0.42);
    const matrix = new THREE.Matrix4();
    matrix.compose(
      new THREE.Vector3(center.x, center.y + 0.045, center.z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, angle + Math.PI * 0.5, 0)),
      new THREE.Vector3(1, 1, 1)
    );
    dash.applyMatrix4(matrix);
    parts.push(dash);
  }
  return parts;
}

function mergeGeometries(geometries: THREE.BufferGeometry[]) {
  const positions: number[] = [];
  const normals: number[] = [];

  for (const geometry of geometries) {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    const position = source.getAttribute("position");
    const normal = source.getAttribute("normal");
    for (let index = 0; index < position.count; index += 1) {
      positions.push(position.getX(index), position.getY(index), position.getZ(index));
      if (normal) {
        normals.push(normal.getX(index), normal.getY(index), normal.getZ(index));
      }
    }
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  if (normals.length === positions.length) {
    merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  } else {
    merged.computeVertexNormals();
  }
  return merged;
}

function positionCount(geometry: THREE.BufferGeometry) {
  return geometry.getAttribute("position")?.count ?? 0;
}
