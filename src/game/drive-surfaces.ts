import * as THREE from "three";
import { worldRoutes, zones } from "./zones";

export type DriveSurfaceSample = {
  routeId: string | null;
  distance: number;
  onRoute: boolean;
  nearest: { x: number; z: number };
};

export type DriveSurfaceTelemetry = {
  samples: number;
  onRouteSamples: number;
  offRouteSamples: number;
  maxOffRouteDistance: number;
  routeAdherenceRatio: number;
  nearestRouteId: string | null;
  nearestRouteDistance: number;
  visitedRouteIds: string[];
};

type DriveRouteSegment = {
  routeId: string;
  start: THREE.Vector2;
  end: THREE.Vector2;
};

export type DriveSurfaceRouteSegmentQa = {
  routeId: string;
  start: { x: number; z: number };
  end: { x: number; z: number };
  length: number;
};

const routeWidth = 1.45;
const zonePadExtraRadius = 0.55;

const zoneById = new Map(zones.map((zone) => [zone.id, zone]));

const routeSegments: DriveRouteSegment[] = worldRoutes.flatMap((route) => {
  const from = zoneById.get(route.from);
  const to = zoneById.get(route.to);
  if (!from || !to) {
    return [];
  }

  const points = [
    new THREE.Vector2(from.position[0], from.position[1]),
    ...(route.via ?? []).map(([x, z]) => new THREE.Vector2(x, z)),
    new THREE.Vector2(to.position[0], to.position[1])
  ];

  return points.slice(0, -1).map((point, index) => ({
    routeId: route.id,
    start: point,
    end: points[index + 1]
  }));
});

export const driveSurfaceSegments: DriveSurfaceRouteSegmentQa[] = routeSegments.map((segment) => ({
  routeId: segment.routeId,
  start: { x: Number(segment.start.x.toFixed(3)), z: Number(segment.start.y.toFixed(3)) },
  end: { x: Number(segment.end.x.toFixed(3)), z: Number(segment.end.y.toFixed(3)) },
  length: Number(segment.start.distanceTo(segment.end).toFixed(3))
}));

const totalSegmentLength = Number(driveSurfaceSegments.reduce((sum, segment) => sum + segment.length, 0).toFixed(3));

const nearestPointOnSegment = (point: THREE.Vector2, segment: DriveRouteSegment) => {
  const edge = segment.end.clone().sub(segment.start);
  const lengthSq = edge.lengthSq();
  if (lengthSq === 0) {
    return segment.start.clone();
  }
  const t = THREE.MathUtils.clamp(point.clone().sub(segment.start).dot(edge) / lengthSq, 0, 1);
  return segment.start.clone().add(edge.multiplyScalar(t));
};

const isInsideZonePad = (point: THREE.Vector2) =>
  zones.some((zone) => point.distanceTo(new THREE.Vector2(zone.position[0], zone.position[1])) <= zone.radius + zonePadExtraRadius);

export function sampleDriveSurface(position: THREE.Vector3): DriveSurfaceSample {
  const point = new THREE.Vector2(position.x, position.z);
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestRouteId: string | null = null;
  let bestNearest = point.clone();

  for (const segment of routeSegments) {
    const nearest = nearestPointOnSegment(point, segment);
    const distance = point.distanceTo(nearest);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRouteId = segment.routeId;
      bestNearest = nearest;
    }
  }

  const insidePad = isInsideZonePad(point);
  const onRoute = insidePad || bestDistance <= routeWidth;

  return {
    routeId: bestRouteId,
    distance: Number((insidePad ? 0 : bestDistance).toFixed(3)),
    onRoute,
    nearest: { x: Number(bestNearest.x.toFixed(3)), z: Number(bestNearest.y.toFixed(3)) }
  };
}

export function createDriveSurfaceTelemetry(): DriveSurfaceTelemetry {
  return {
    samples: 0,
    onRouteSamples: 0,
    offRouteSamples: 0,
    maxOffRouteDistance: 0,
    routeAdherenceRatio: 1,
    nearestRouteId: null,
    nearestRouteDistance: 0,
    visitedRouteIds: []
  };
}

export function recordDriveSurfaceSample(
  telemetry: DriveSurfaceTelemetry,
  sample: DriveSurfaceSample
): DriveSurfaceTelemetry {
  const samples = telemetry.samples + 1;
  const onRouteSamples = telemetry.onRouteSamples + (sample.onRoute ? 1 : 0);
  const offRouteSamples = telemetry.offRouteSamples + (sample.onRoute ? 0 : 1);
  const visitedRouteIds =
    sample.routeId && sample.onRoute && !telemetry.visitedRouteIds.includes(sample.routeId)
      ? [...telemetry.visitedRouteIds, sample.routeId]
      : telemetry.visitedRouteIds;
  return {
    samples,
    onRouteSamples,
    offRouteSamples,
    maxOffRouteDistance: Math.max(telemetry.maxOffRouteDistance, sample.distance),
    routeAdherenceRatio: Number((onRouteSamples / samples).toFixed(3)),
    nearestRouteId: sample.routeId,
    nearestRouteDistance: sample.distance,
    visitedRouteIds
  };
}

export const driveSurfaceConfig = {
  routeWidth,
  zonePadExtraRadius,
  routeCount: worldRoutes.length,
  segmentCount: routeSegments.length,
  totalSegmentLength
};
