import * as THREE from "three";
import { createZoneLandmark } from "./procedural-assets";
import {
  createDriveSurfaceTelemetry,
  driveSurfaceConfig,
  recordDriveSurfaceSample,
  sampleDriveSurface,
  type DriveSurfaceTelemetry
} from "./drive-surfaces";
import { createRouteGuidance, type RouteEncounterGate } from "./route-guidance";
import { createRoadRibbonGeometry, roadRibbonVisualConfig } from "./road-ribbons";
import { createZoneSignatureArtifacts } from "./zone-signature-artifacts";
import { createZoneProjectArtifacts } from "./zone-project-artifacts";
import { createZonePlaceArchitecture } from "./zone-place-architecture";
import { createWorldScenery } from "./world-scenery";
import {
  sampleTerrain,
  sampleWorldMaterial,
  terrainConfig,
  worldMaterialRegions,
  type TerrainSample,
  type WorldMaterialKind,
  type WorldMaterialSample
} from "./world-materials";
import { worldGroundRadius, worldHalfExtent, worldSize } from "./world-config";
import { createZoneSetDressing } from "./zone-set-dressing";
import { zoneVisualSpecs, type ZoneVisualSpec } from "./visual-specs";
import { renderZoneVisuals } from "./zone-visual-renderer";
import { defaultZone, worldRoutes, zones, type StudioZone, type ZoneKind } from "./zones";

const mapRange = worldSize;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const searchParams = new URLSearchParams(window.location.search);
const qaMode = searchParams.has("qa");
const realKeyboardQaMode = searchParams.has("realKeys");
const playerMaxForwardSpeed = qaMode ? 12.8 : 10.5;
const playerMaxReverseSpeed = qaMode ? 6.4 : 4.2;
const playerAcceleration = qaMode ? 38 : 24;
const playerBrakeAcceleration = qaMode ? 58 : 28;
const playerRollingDrag = qaMode ? 1.9 : 1.35;
const playerLateralGrip = qaMode ? 6.2 : 5.4;
const playerDriftGrip = qaMode ? 1.18 : 1.28;
const playerTurnSpeed = qaMode ? 4.15 : 2.65;
const playerSteerReferenceSpeed = qaMode ? 6.4 : 6.2;

const colors: Record<ZoneKind | "ground" | "road" | "ink", number> = {
  tech: 0x17d2ff,
  art: 0xff6f7d,
  studio: 0xffe38a,
  ground: 0x12342c,
  road: 0xf8f0d4,
  ink: 0x101015
};

const surfaceFxProfiles: Record<
  SurfaceFxProfile,
  {
    kind: "water" | "ramp";
    color: number;
    baseOpacity: number;
    maxAge: number;
    widthScale: number;
    lengthScale: number;
    liftSpeed: number;
    spinSpeed: number;
  }
> = {
  "water-ripple": {
    kind: "water",
    color: 0x54d8f2,
    baseOpacity: 0.32,
    maxAge: 1.12,
    widthScale: 1.05,
    lengthScale: 0.7,
    liftSpeed: 0.004,
    spinSpeed: 0.18
  },
  "water-foam": {
    kind: "water",
    color: 0xfff2b0,
    baseOpacity: 0.38,
    maxAge: 0.92,
    widthScale: 1.32,
    lengthScale: 0.48,
    liftSpeed: 0.006,
    spinSpeed: -0.24
  },
  "water-wake": {
    kind: "water",
    color: 0x83f4ff,
    baseOpacity: 0.42,
    maxAge: 0.82,
    widthScale: 0.72,
    lengthScale: 1.82,
    liftSpeed: 0.008,
    spinSpeed: 0.1
  },
  "ramp-skid": {
    kind: "ramp",
    color: 0xffe38a,
    baseOpacity: 0.3,
    maxAge: 0.72,
    widthScale: 0.72,
    lengthScale: 1.34,
    liftSpeed: 0.026,
    spinSpeed: -0.08
  },
  "ramp-chevron": {
    kind: "ramp",
    color: 0xffb35c,
    baseOpacity: 0.34,
    maxAge: 0.64,
    widthScale: 1.42,
    lengthScale: 0.58,
    liftSpeed: 0.036,
    spinSpeed: 0.28
  },
  "ramp-spark": {
    kind: "ramp",
    color: 0x17d2ff,
    baseOpacity: 0.36,
    maxAge: 0.52,
    widthScale: 0.46,
    lengthScale: 0.46,
    liftSpeed: 0.064,
    spinSpeed: 0.62
  }
};

const worldTexture = createWorldTexture(colors.ground, 9);

type DriveKey = "up" | "down" | "left" | "right";

function createWorldTexture(baseColor: number, repeat = 9) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const base = new THREE.Color(baseColor);
  const light = base.clone().lerp(new THREE.Color(0xffffff), 0.34);
  const dark = base.clone().lerp(new THREE.Color(0x050807), 0.46);
  const warm = new THREE.Color(colors.studio);

  context.fillStyle = `#${light.getHexString()}`;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.globalAlpha = 0.42;
  context.strokeStyle = `#${dark.getHexString()}`;
  context.lineWidth = 1.4;
  for (let y = 10; y < canvas.height; y += 24) {
    context.beginPath();
    for (let x = -16; x <= canvas.width + 16; x += 16) {
      const wave = Math.sin((x + y) * 0.036) * 5 + Math.cos((x - y) * 0.021) * 3;
      if (x === -16) {
        context.moveTo(x, y + wave);
      } else {
        context.lineTo(x, y + wave);
      }
    }
    context.stroke();
  }

  context.globalAlpha = 0.34;
  context.strokeStyle = "#ffffff";
  context.lineWidth = 1;
  for (let x = 8; x < canvas.width; x += 32) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x + 28, canvas.height);
    context.stroke();
  }

  context.globalAlpha = 0.32;
  context.strokeStyle = `#${dark.getHexString()}`;
  for (let index = 0; index < 44; index += 1) {
    const x = (index * 61) % canvas.width;
    const y = (index * 29) % canvas.height;
    const width = 10 + (index % 5) * 5;
    const height = 7 + (index % 4) * 4;
    context.strokeRect(x, y, width, height);
    context.beginPath();
    context.moveTo(x + width, y + height * 0.5);
    context.lineTo(x + width + 12, y + height * 0.5);
    context.stroke();
  }

  context.globalAlpha = 0.38;
  for (let index = 0; index < 260; index += 1) {
    const x = (index * 47) % canvas.width;
    const y = (index * 83) % canvas.height;
    const radius = 0.9 + ((index * 13) % 5) * 0.22;
    context.fillStyle = index % 3 === 0 ? `#${dark.getHexString()}` : `#${warm.getHexString()}`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

type BoundsQa = { width: number; height: number; depth: number };
type AssetEnvelopeQa = BoundsQa & {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  center: { x: number; y: number; z: number };
  offset: { x: number; z: number };
  offsetDistance: number;
  footprintRadius: number;
  zoneRadius: number;
  allowedFootprintRadius: number;
  overflow: number;
};
type Vec3Qa = { x: number; y: number; z: number };
type ScreenPointQa = { x: number; y: number; ndcX: number; ndcY: number; visible: boolean };
type DriveDynamicsQa = {
  currentSpeed: number;
  peakSpeed: number;
  lastAcceleration: number;
  peakAcceleration: number;
  averageAcceleration: number;
  forwardSpeed: number;
  lateralSpeed: number;
  driftAngle: number;
  steeringInput: number;
  throttleInput: number;
  offRouteSamples: number;
  freeRoamRatio: number;
  movingSamples: number;
  inputSamples: number;
  coastingSamples: number;
  turnRate: number;
  peakTurnRate: number;
  averageTurnRate: number;
};
type VehicleFeelQa = {
  frontWheelSteer: number;
  peakFrontWheelSteer: number;
  visualSteeringSamples: number;
  chassisPitch: number;
  chassisRoll: number;
  peakChassisRoll: number;
  brakeFxSamples: number;
  driftFxSamples: number;
  skidIntensity: number;
  maxSkidIntensity: number;
  driftTrailMarks: number;
  brakeTrailMarks: number;
};
type DrivePhysicsSampleQa = {
  frame: number;
  tMs: number;
  x: number;
  z: number;
  rotationY: number;
  velocityX: number;
  velocityZ: number;
  speed: number;
  acceleration: number;
  turnRate: number;
  forwardSpeed: number;
  lateralSpeed: number;
  driftAngle: number;
  steeringInput: number;
  throttleInput: number;
  onRoute: boolean;
  routeDistance: number;
  boundaryDistance: number;
  materialKind: WorldMaterialKind;
  materialId: string;
  materialIntensity: number;
  rideHeight: number;
  pitch: number;
  roll: number;
  terrainHeight: number;
  terrainGrade: number;
  terrainNormalY: number;
  terrainFeatureId: string | null;
  terrainGroundDelta: number;
  hasInput: boolean;
};
type SurfaceMaterialQa = {
  currentKind: WorldMaterialKind;
  currentId: string;
  currentIntensity: number;
  rideHeight: number;
  pitch: number;
  roll: number;
  terrainHeight: number;
  terrainGrade: number;
  terrainNormalY: number;
  terrainFeatureId: string | null;
  waterSamples: number;
  rampSamples: number;
  fieldSamples: number;
  roadSamples: number;
  terrainSamples: number;
  minTerrainHeight: number;
  maxTerrainHeight: number;
  maxTerrainGrade: number;
  materialTransitions: number;
  maxWaterIntensity: number;
  maxRampRideHeight: number;
  activeFxMarks: number;
  emittedFxMarks: number;
  surfaceFxProfiles: string[];
  surfaceFxWaterProfiles: number;
  surfaceFxRampProfiles: number;
  surfaceFxProfileCounts: Record<string, number>;
  surfaceFxSignatures: number;
  surfaceFxColorVariants: number;
  surfaceFxObjectCapacity: number;
  surfaceFxActiveWaterMarks: number;
  surfaceFxActiveRampMarks: number;
  maxSurfaceFxScaleVariance: number;
  waterRegionCount: number;
  rampRegionCount: number;
  terrainFeatureCount: number;
};
type BoundaryQa = {
  worldHalfExtent: number;
  contactCount: number;
  contactAxes: Record<string, number>;
  lastContactAxis: string | null;
  lastContactSpeed: number;
  distanceToEdge: number;
  minDistanceToEdge: number;
  hardStopAwayFromEdgeCount: number;
};
type ScreenRectQa = {
  x: number;
  y: number;
  width: number;
  height: number;
  area: number;
  clippedX: number;
  clippedY: number;
  clippedWidth: number;
  clippedHeight: number;
  clippedArea: number;
  visibleRatio: number;
  cornerDepthCount: number;
  visible: boolean;
  center: ScreenPointQa;
};
type ZoneCompositionQa = {
  zoneId: string;
  visibleLayerCount: number;
  union: ScreenRectQa;
  centerSpreadPx: number;
  pairDistancesPx: {
    landmarkToPlace: number;
    landmarkToSignature: number;
    placeToSignature: number;
  };
  pairOverlapRatios: {
    landmarkPlace: number;
    landmarkSignature: number;
    placeSignature: number;
  };
  largestLayerAreaRatio: number;
};
type TrailMarkKind = "roll" | "drift" | "brake";
type TrailMark = {
  mesh: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  age: number;
  maxAge: number;
  kind: TrailMarkKind;
  baseOpacity: number;
};
type SurfaceFxProfile = "water-ripple" | "water-foam" | "water-wake" | "ramp-skid" | "ramp-chevron" | "ramp-spark";
type WheelPart = {
  mesh: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>;
  front: boolean;
  side: -1 | 1;
};
type SurfaceFxMark = {
  age: number;
  maxAge: number;
  kind: WorldMaterialKind;
  profile: SurfaceFxProfile;
  position: THREE.Vector3;
  rotationZ: number;
  scale: number;
  widthScale: number;
  lengthScale: number;
  color: number;
  liftSpeed: number;
  spinSpeed: number;
  signature: string;
  opacity: number;
  baseOpacity: number;
};
type ActivationFeedback = {
  group: THREE.Group;
  halo: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  rings: Array<THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>>;
  sparks: Array<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>;
  age: number;
  intensity: number;
  triggerCount: number;
};
type LightingQa = {
  poolCount: number;
  poolObjects: number;
  activePoolVisible: boolean;
  activePoolOpacity: number;
  activePoolScale: number;
  routePoolVisible: boolean;
  routePoolOpacity: number;
  routePoolScale: number;
  nearestRouteId: string | null;
  realLightCount: number;
  shadowCastingLightCount: number;
};

type RouteEncountersQa = {
  gateCount: number;
  objectCount: number;
  activeId: string | null;
  activeRouteId: string | null;
  activeDistance: number;
  activeIntensity: number;
  activeCount: number;
  visitedIds: string[];
  visitedCount: number;
  maxIntensity: number;
};

type AudioQa = {
  supported: boolean;
  initialized: boolean;
  muted: boolean;
  contextState: AudioContextState | "unsupported" | "uninitialized";
  engineGain: number;
  driftGain: number;
  ambienceGain: number;
  accelerationGain: number;
  waterGain: number;
  rampGain: number;
  brakeGain: number;
  engineFrequency: number;
  surfaceFrequency: number;
  toggleVisible: boolean;
  togglePressed: boolean;
};

type ZoneAssetQa = {
  id: string;
  zonePosition: { x: number; z: number };
  zoneRadius: number;
  meshCount: number;
  landmarkObjects: number;
  visualSpecId: string | null;
  biome: string | null;
  visualDecals: number;
  propClusters: number;
  propObjects: number;
  instancedPropClusters: number;
  instancedPropObjects: number;
  setDressingObjects: number;
  setDressingRoles: string[];
  setDressingSignatures: string[];
  placeArchitectureObjects: number;
  placeArchitectureFamily: string | null;
  placeArchitectureRoles: string[];
  placeArchitectureSignatures: string[];
  placeArchitectureBounds: BoundsQa;
  placeArchitectureEnvelope: AssetEnvelopeQa;
  signatureArtifactObjects: number;
  signatureArtifactSceneObjects: number;
  signatureArtifactFamilies: string[];
  signatureArtifactRoles: string[];
  signatureArtifactSignatures: string[];
  signatureArtifactMaterials: string[];
  signatureArtifactBounds: BoundsQa;
  signatureArtifactEnvelope: AssetEnvelopeQa;
  signatureArtifactScreen: ScreenRectQa;
  projectArtifactObjects: number;
  projectArtifactSceneObjects: number;
  projectArtifactActivityTypes: string[];
  projectArtifactSignatures: string[];
  projectArtifactMaterials: string[];
  projectArtifactManifests: string[];
  projectArtifactThemeRoles: string[];
  projectArtifactRoleReliefSignatures: Record<string, string[]>;
  projectArtifactSpecimenFamilies: string[];
  projectArtifactDetailProfiles: string[];
  projectArtifactReliefSignatures: string[];
  projectArtifactPartCount: number;
  projectArtifactVertexCount: number;
  projectArtifactBounds: BoundsQa;
  projectArtifactEnvelope: AssetEnvelopeQa;
  materialVariants: number;
  surfaceProfileId: string | null;
  surfaceFinish: string | null;
  surfaceMotif: string | null;
  surfaceObjects: number;
  surfaceRoles: string[];
  surfaceSignatures: string[];
  surfaceFingerprint: string;
  declaredMaterialVariants: string[];
  renderedMaterialVariants: string[];
  missingMaterialVariants: string[];
  expectedVisuals: {
    decals: number;
    propClusters: number;
    propObjects: number;
    surfaceObjects: number;
    surfaceSignatures: number;
    materialVariants: number;
  };
  expectedAnimation: { idleSpin: number; activeSpin: number; activeScale: number; pulse: number } | null;
  appliedAnimation: { idleSpin: number; activeSpin: number; activeScale: number; pulse: number } | null;
  animationMatchesSpec: boolean;
  motionObjectCount: number;
  motionRoleCounts: Record<string, number>;
  localMotionBehaviors: Record<string, number>;
  visualFingerprint: string;
  setDressingFingerprint: string;
  setDressingEnvelope: AssetEnvelopeQa;
  placeArchitectureFingerprint: string;
  signatureArtifactFingerprint: string;
  projectArtifactFingerprint: string;
  hasLabel: boolean;
  bounds: BoundsQa;
  envelope: AssetEnvelopeQa;
};

type QaSnapshot = {
  ready: boolean;
  activeZoneId: string;
  activeZoneLabel: string;
  zoneCount: number;
  world: {
    sceneObjects: number;
    decorativeObjects: number;
    roadSegments: number;
    routeSurfaceObjects: number;
    routeSurfaceDetailSignatures: number;
    routeSurfaceDetailParts: number;
    routeSurfaceVertexCount: number;
    routeSurfaceStyle: {
      bedRadiusRatio: number;
      shoulderOffsetRatio: number;
      shoulderRadius: number;
      signalRadius: number;
      dashDepthRatio: number;
      dashChevronAngle: number;
      underlayOpacity: number;
      laneOpacity: number;
      laneEmissiveIntensity: number;
      polygonOffsetFactor: number;
      polygonOffsetUnits: number;
      underlayColor: number;
      castsShadow: boolean;
    };
    landmarkObjects: number;
    playerParts: number;
    visualSpecs: number;
    visualDecals: number;
    propClusters: number;
    propObjects: number;
    instancedPropClusters: number;
    instancedPropObjects: number;
    surfaceObjects: number;
    surfaceSignatures: number;
    setDressingObjects: number;
    setDressingSignatures: number;
    placeArchitectureObjects: number;
    placeArchitectureFamilies: number;
    placeArchitectureSignatures: number;
    signatureArtifactObjects: number;
    signatureArtifactSceneObjects: number;
    signatureArtifactSignatures: number;
    projectArtifactObjects: number;
    projectArtifactSceneObjects: number;
    projectArtifactZones: number;
    projectArtifactActivityTypes: number;
    projectArtifactSignatures: number;
    projectArtifactMaterials: number;
    projectArtifactManifests: number;
    projectArtifactThemeRoles: number;
    projectArtifactSpecimenFamilies: number;
    projectArtifactDetailProfiles: number;
    projectArtifactReliefSignatures: number;
    projectArtifactPartCount: number;
    projectArtifactVertexCount: number;
    sceneryObjects: number;
    scenerySignatures: number;
    sceneryMotionObjects: number;
    sceneryRoleCounts: Record<string, number>;
    surfaceDetailPartCounts: Record<string, number>;
    surfaceDetailProfiles: number;
    surfaceDetailWaterProfiles: number;
    surfaceDetailRampProfiles: number;
    surfaceDetailColorVariants: number;
    surfaceDetailSignatures: string[];
    missingSurfaceDetailProfiles: string[];
    duplicateSurfaceDetailSignatures: string[];
    visibleBoundaryObjects: number;
    worldBeaconObjects: number;
    worldBeaconSceneObjects: number;
    identityRibbonObjects: number;
    identityRibbonSignatures: number;
    terrainLayers: number;
    terrainHeightRange: number;
    terrainMinHeight: number;
    terrainMaxHeight: number;
    terrainVertexCount: number;
    terrainGradeMax: number;
    terrainFeatureCount: number;
    terrainFeatureMarkerObjects: number;
    terrainFeatureMarkerSceneObjects: number;
    terrainFeatureMarkerSignatures: number;
    terrainFeatureMarkerProfiles: number;
    routeGuidanceObjects: number;
    routeGuidanceSignatures: number;
    routeGuidanceMotionObjects: number;
    routeGuidanceRoleCounts: Record<string, number>;
    routeGuidanceVisualizedSegments: number;
    routeEncounterObjects: number;
    routeEncounterGates: number;
    materialVariants: number;
    motionRoles: number;
    motionRolesByType: Record<string, number>;
    zones: ZoneAssetQa[];
  };
  player: {
    x: number;
    y: number;
    z: number;
    groundY: number;
    groundDelta: number;
    rotationY: number;
    meshCount: number;
    wheelCount: number;
    bounds: BoundsQa;
  };
  trail: { totalMarks: number; activeMarks: number; maxOpacity: number };
  drive: {
    totalDistance: number;
    positionSamples: Array<{ frame: number; x: number; z: number }>;
    averageSpeed: number;
    rotationChange: number;
    cameraDistance: number;
    surface: DriveSurfaceTelemetry & {
      routeWidth: number;
      routeCount: number;
      segmentCount: number;
      zonePadExtraRadius: number;
      totalSegmentLength: number;
      visualizedSegmentCount: number;
      guidanceMarkerCount: number;
    };
    dynamics: DriveDynamicsQa;
    vehicleFeel: VehicleFeelQa;
    material: SurfaceMaterialQa;
    boundary: BoundaryQa;
    physicsSamples: DrivePhysicsSampleQa[];
  };
  camera: {
    position: Vec3Qa;
    target: Vec3Qa;
    desired: Vec3Qa;
    lag: number;
    distanceToPlayer: number;
  };
  screen: {
    player: ScreenPointQa;
    playerRect: ScreenRectQa;
    activeZone: ScreenPointQa & { zoneId: string };
    activeLandmark: ScreenRectQa & { zoneId: string };
    activeSetDressing: ScreenRectQa & { zoneId: string };
    activePlaceArchitecture: ScreenRectQa & { zoneId: string; family: string | null };
    activeSignatureArtifact: ScreenRectQa & { zoneId: string };
    activeProjectArtifact: ScreenRectQa & { zoneId: string };
    identityRibbon: ScreenRectQa;
    activeZoneComposition: ZoneCompositionQa;
    activeRouteEncounter: ScreenRectQa & { id: string | null; routeId: string | null; intensity: number; distance: number };
  };
  input: {
    activeKeys: DriveKey[];
    keyboardDownCount: number;
    keyboardUpCount: number;
    lastKeyboardCode: string | null;
    qaStepHookCalls: number;
  };
  activeFeedback: {
    zoneId: string;
    sequence: number;
    lastTriggeredFrame: number;
    visibleObjects: number;
    ringCount: number;
    sparkCount: number;
    intensity: number;
    maxOpacity: number;
    maxScale: number;
    cameraImpulse: number;
  };
  lighting: LightingQa;
  routeEncounters: RouteEncountersQa;
  audio: AudioQa;
  canvas: { width: number; height: number; dpr: number };
  renderer: { calls: number; triangles: number; geometries: number; textures: number };
  frameCount: number;
  averageFrameMs: number;
  visitedZoneIds: string[];
  reducedMotion: boolean;
  lastInputMode: "keyboard" | "pointer" | "touch" | "programmatic" | "none";
  errors: string[];
};

declare global {
  interface Window {
    __IT_ART_STUDIO_QA__?: QaSnapshot;
    __IT_ART_STUDIO_QA_STEP__?: (direction: DriveKey) => void;
    __IT_ART_STUDIO_QA_REFRESH__?: () => void;
  }
}

class StudioGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly zoneMeshes = new Map<string, THREE.Object3D>();
  private readonly keys = new Set<DriveKey>();
  private readonly player = new THREE.Group();
  private readonly playerVelocity = new THREE.Vector3();
  private readonly trailGroup = new THREE.Group();
  private readonly surfaceFxGroup = new THREE.Group();
  private readonly errors: string[] = [];
  private readonly playerPosition = new THREE.Vector3(0, 0.28, 0);
  private readonly targetPosition = new THREE.Vector3(0, 0.28, 0);
  private readonly cameraTarget = new THREE.Vector3(0, 0, 0);
  private readonly cameraDesired = new THREE.Vector3(8, 9.4, 8);
  private activeZoneId = defaultZone.id;
  private frameId = 0;
  private lastFrameTime = performance.now();
  private lastQaSyncTime = 0;
  private elapsedTime = 0;
  private frameCount = 0;
  private decorativeObjectCount = 0;
  private roadSegmentCount = 0;
  private routeSurfaceObjectCount = 0;
  private routeSurfaceDetailPartCount = 0;
  private routeSurfaceVertexCount = 0;
  private visualDecalCount = 0;
  private propClusterCount = 0;
  private surfaceObjectCount = 0;
  private setDressingObjectCount = 0;
  private placeArchitectureObjectCount = 0;
  private signatureArtifactObjectCount = 0;
  private projectArtifactObjectCount = 0;
  private projectArtifactSceneObjectCount = 0;
  private sceneryObjectCount = 0;
  private worldSceneryMotionObjectCount = 0;
  private terrainLayerCount = 0;
  private terrainHeightRange = 0;
  private terrainMinHeight = 0;
  private terrainMaxHeight = 0;
  private terrainVertexCount = 0;
  private terrainGradeMax = 0;
  private terrainFeatureCount = 0;
  private routeGuidanceObjectCount = 0;
  private routeGuidanceVisualizedSegments = 0;
  private routeEncounterObjectCount = 0;
  private motionRoleCount = 0;
  private playerPartCount = 0;
  private readonly renderedVisualSpecIds = new Set<string>();
  private readonly materialVariantIds = new Set<string>();
  private readonly surfaceSignatureIds = new Set<string>();
  private readonly setDressingSignatureIds = new Set<string>();
  private readonly placeArchitectureFamilyIds = new Set<string>();
  private readonly placeArchitectureSignatureIds = new Set<string>();
  private readonly signatureArtifactSignatureIds = new Set<string>();
  private readonly projectArtifactSignatureIds = new Set<string>();
  private readonly projectArtifactZoneIds = new Set<string>();
  private readonly projectArtifactActivityIds = new Set<string>();
  private readonly projectArtifactMaterialIds = new Set<string>();
  private readonly scenerySignatureIds = new Set<string>();
  private readonly routeSurfaceSignatureIds = new Set<string>();
  private readonly routeGuidanceSignatureIds = new Set<string>();
  private readonly routeGuidanceRoleCounts: Record<string, number> = {};
  private readonly zoneMotionObjects = new Map<string, THREE.Object3D[]>();
  private readonly activationFeedbackByZone = new Map<string, ActivationFeedback>();
  private readonly landmarkMeshes = new Map<string, THREE.Object3D>();
  private readonly setDressingGroups = new Map<string, THREE.Object3D>();
  private readonly placeArchitectureGroups = new Map<string, THREE.Object3D>();
  private readonly signatureArtifactGroups = new Map<string, THREE.Object3D>();
  private readonly projectArtifactGroups = new Map<string, THREE.Object3D>();
  private identityRibbonGroup: THREE.Object3D | null = null;
  private readonly worldSceneryMotionObjects: THREE.Object3D[] = [];
  private readonly routeGuidanceMotionObjects: THREE.Object3D[] = [];
  private readonly routeEncounterGates: RouteEncounterGate[] = [];
  private readonly visitedRouteEncounterIds = new Set<string>();
  private activeLightPool!: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private routeLightPool!: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private waterSurfaceFxMesh: THREE.InstancedMesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null = null;
  private rampSurfaceFxMesh: THREE.InstancedMesh<THREE.TorusGeometry, THREE.MeshBasicMaterial> | null = null;
  private lightPoolObjectCount = 0;
  private currentNearestRouteId: string | null = null;
  private currentRouteEncounterId: string | null = null;
  private currentRouteEncounterRouteId: string | null = null;
  private currentRouteEncounterGate: RouteEncounterGate | null = null;
  private currentRouteEncounterDistance = 0;
  private currentRouteEncounterIntensity = 0;
  private currentRouteEncounterActiveCount = 0;
  private maxRouteEncounterIntensity = 0;
  private readonly wheelParts: WheelPart[] = [];
  private readonly trailMarks: TrailMark[] = [];
  private readonly surfaceFxMarks: SurfaceFxMark[] = [];
  private readonly frameDeltas: number[] = [];
  private readonly visitedZoneIds = new Set<string>([defaultZone.id]);
  private trailCursor = 0;
  private trailDistance = 0;
  private totalDriveDistance = 0;
  private driveElapsedTime = 0;
  private totalRotationChange = 0;
  private driveSurfaceTelemetry = createDriveSurfaceTelemetry();
  private lastDriveSpeed = 0;
  private peakDriveSpeed = 0;
  private lastDriveAcceleration = 0;
  private peakDriveAcceleration = 0;
  private totalDriveAcceleration = 0;
  private driveDynamicsSamples = 0;
  private driveMovingSamples = 0;
  private driveInputSamples = 0;
  private driveCoastingSamples = 0;
  private driveOffRouteSamples = 0;
  private lastDriveTurnRate = 0;
  private peakDriveTurnRate = 0;
  private totalDriveTurnRate = 0;
  private driveTurnSamples = 0;
  private currentForwardSpeed = 0;
  private currentLateralSpeed = 0;
  private currentDriftAngle = 0;
  private currentSteeringInput = 0;
  private currentThrottleInput = 0;
  private currentWorldMaterial: WorldMaterialSample = sampleWorldMaterial(this.playerPosition, true);
  private currentTerrain: TerrainSample = sampleTerrain(this.playerPosition);
  private currentRideHeight = 0;
  private currentRidePitch = 0;
  private currentRideRoll = 0;
  private currentFrontWheelSteer = 0;
  private peakFrontWheelSteer = 0;
  private visualSteeringSamples = 0;
  private peakChassisRoll = 0;
  private brakeFxSamples = 0;
  private driftFxSamples = 0;
  private currentSkidIntensity = 0;
  private maxSkidIntensity = 0;
  private driftTrailMarks = 0;
  private brakeTrailMarks = 0;
  private terrainSamples = 0;
  private minSampledTerrainHeight = Number.POSITIVE_INFINITY;
  private maxSampledTerrainHeight = Number.NEGATIVE_INFINITY;
  private maxSampledTerrainGrade = 0;
  private waterMaterialSamples = 0;
  private rampMaterialSamples = 0;
  private fieldMaterialSamples = 0;
  private roadMaterialSamples = 0;
  private materialTransitionCount = 0;
  private emittedSurfaceFxMarks = 0;
  private readonly surfaceFxProfileCounts: Partial<Record<SurfaceFxProfile, number>> = {};
  private readonly surfaceFxSignatures = new Set<string>();
  private readonly surfaceFxColorVariants = new Set<number>();
  private maxSurfaceFxScaleVariance = 0;
  private maxWaterIntensity = 0;
  private maxRampRideHeight = 0;
  private lastMaterialKind: WorldMaterialKind = "road";
  private surfaceFxDistance = 0;
  private boundaryContactCount = 0;
  private readonly boundaryContactAxes: Record<string, number> = {};
  private lastBoundaryContactAxis: string | null = null;
  private lastBoundaryContactSpeed = 0;
  private boundaryDistanceToEdge = worldHalfExtent;
  private minBoundaryDistanceToEdge = worldHalfExtent;
  private hardStopAwayFromEdgeCount = 0;
  private hardStopAwayFromEdgeStreak = 0;
  private audioContext: AudioContext | null = null;
  private audioMasterGain: GainNode | null = null;
  private engineOscillator: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private driftOscillator: OscillatorNode | null = null;
  private driftGain: GainNode | null = null;
  private ambienceOscillator: OscillatorNode | null = null;
  private ambienceGain: GainNode | null = null;
  private accelerationOscillator: OscillatorNode | null = null;
  private accelerationGain: GainNode | null = null;
  private waterOscillator: OscillatorNode | null = null;
  private waterGain: GainNode | null = null;
  private rampOscillator: OscillatorNode | null = null;
  private rampGain: GainNode | null = null;
  private brakeOscillator: OscillatorNode | null = null;
  private brakeGain: GainNode | null = null;
  private audioMuted = true;
  private audioInitialized = false;
  private currentEngineFrequency = 0;
  private currentSurfaceFrequency = 0;
  private currentEngineGain = 0;
  private currentDriftGain = 0;
  private currentAmbienceGain = 0;
  private currentAccelerationGain = 0;
  private currentWaterGain = 0;
  private currentRampGain = 0;
  private currentBrakeGain = 0;
  private audioToggleButton: HTMLButtonElement | null = null;
  private readonly drivePositionSamples: Array<{ frame: number; x: number; z: number }> = [];
  private readonly drivePhysicsSamples: DrivePhysicsSampleQa[] = [];
  private keyboardDownCount = 0;
  private keyboardUpCount = 0;
  private lastKeyboardCode: string | null = null;
  private qaStepHookCallCount = 0;
  private activationSequence = 0;
  private lastActivationFrame = 0;
  private cameraImpulse = 0;
  private readonly qaSnapshot: QaSnapshot = {
    ready: false,
    activeZoneId: defaultZone.id,
    activeZoneLabel: defaultZone.label,
    zoneCount: zones.length,
    world: {
      sceneObjects: 0,
      decorativeObjects: 0,
      roadSegments: 0,
      routeSurfaceObjects: 0,
      routeSurfaceDetailSignatures: 0,
      routeSurfaceDetailParts: 0,
      routeSurfaceVertexCount: 0,
      routeSurfaceStyle: {
        bedRadiusRatio: roadRibbonVisualConfig.bedRadiusRatio,
        shoulderOffsetRatio: roadRibbonVisualConfig.shoulderOffsetRatio,
        shoulderRadius: roadRibbonVisualConfig.shoulderRadius,
        signalRadius: roadRibbonVisualConfig.signalRadius,
        dashDepthRatio: roadRibbonVisualConfig.dashDepthRatio,
        dashChevronAngle: roadRibbonVisualConfig.dashChevronAngle,
        underlayOpacity: 0.14,
        laneOpacity: 0.78,
        laneEmissiveIntensity: 0.22,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
        underlayColor: 0x6a766d,
        castsShadow: false
      },
      landmarkObjects: 0,
      playerParts: 0,
      visualSpecs: 0,
      visualDecals: 0,
      propClusters: 0,
      propObjects: 0,
      instancedPropClusters: 0,
      instancedPropObjects: 0,
      surfaceObjects: 0,
      surfaceSignatures: 0,
      setDressingObjects: 0,
      setDressingSignatures: 0,
      placeArchitectureObjects: 0,
      placeArchitectureFamilies: 0,
      placeArchitectureSignatures: 0,
      signatureArtifactObjects: 0,
      signatureArtifactSceneObjects: 0,
      signatureArtifactSignatures: 0,
      projectArtifactObjects: 0,
      projectArtifactSceneObjects: 0,
      projectArtifactZones: 0,
      projectArtifactActivityTypes: 0,
      projectArtifactSignatures: 0,
      projectArtifactMaterials: 0,
      projectArtifactManifests: 0,
      projectArtifactThemeRoles: 0,
      projectArtifactSpecimenFamilies: 0,
      projectArtifactDetailProfiles: 0,
      projectArtifactReliefSignatures: 0,
      projectArtifactPartCount: 0,
      projectArtifactVertexCount: 0,
      sceneryObjects: 0,
      scenerySignatures: 0,
      sceneryMotionObjects: 0,
      sceneryRoleCounts: {},
      surfaceDetailPartCounts: {},
      surfaceDetailProfiles: 0,
      surfaceDetailWaterProfiles: 0,
      surfaceDetailRampProfiles: 0,
      surfaceDetailColorVariants: 0,
      surfaceDetailSignatures: [],
      missingSurfaceDetailProfiles: [],
      duplicateSurfaceDetailSignatures: [],
      visibleBoundaryObjects: 0,
      worldBeaconObjects: 0,
      worldBeaconSceneObjects: 0,
      identityRibbonObjects: 0,
      identityRibbonSignatures: 0,
      terrainLayers: 0,
      terrainHeightRange: 0,
      terrainMinHeight: 0,
      terrainMaxHeight: 0,
      terrainVertexCount: 0,
      terrainGradeMax: 0,
      terrainFeatureCount: 0,
      terrainFeatureMarkerObjects: 0,
      terrainFeatureMarkerSceneObjects: 0,
      terrainFeatureMarkerSignatures: 0,
      terrainFeatureMarkerProfiles: 0,
      routeGuidanceObjects: 0,
      routeGuidanceSignatures: 0,
      routeGuidanceMotionObjects: 0,
      routeGuidanceRoleCounts: {},
      routeGuidanceVisualizedSegments: 0,
      routeEncounterObjects: 0,
      routeEncounterGates: 0,
      materialVariants: 0,
      motionRoles: 0,
      motionRolesByType: {},
      zones: []
    },
    player: {
      x: 0,
      y: 0.28,
      z: 0,
      groundY: 0,
      groundDelta: 0.28,
      rotationY: 0,
      meshCount: 0,
      wheelCount: 0,
      bounds: { width: 0, height: 0, depth: 0 }
    },
    trail: { totalMarks: 0, activeMarks: 0, maxOpacity: 0 },
    drive: {
      totalDistance: 0,
      positionSamples: [],
      averageSpeed: 0,
      rotationChange: 0,
      cameraDistance: 0,
      surface: {
        ...createDriveSurfaceTelemetry(),
        routeWidth: driveSurfaceConfig.routeWidth,
        routeCount: driveSurfaceConfig.routeCount,
        segmentCount: driveSurfaceConfig.segmentCount,
        zonePadExtraRadius: driveSurfaceConfig.zonePadExtraRadius,
        totalSegmentLength: driveSurfaceConfig.totalSegmentLength,
        visualizedSegmentCount: 0,
        guidanceMarkerCount: 0
      },
      dynamics: {
        currentSpeed: 0,
        peakSpeed: 0,
        lastAcceleration: 0,
        peakAcceleration: 0,
        averageAcceleration: 0,
        forwardSpeed: 0,
        lateralSpeed: 0,
        driftAngle: 0,
        steeringInput: 0,
        throttleInput: 0,
        offRouteSamples: 0,
        freeRoamRatio: 0,
        movingSamples: 0,
        inputSamples: 0,
        coastingSamples: 0,
        turnRate: 0,
        peakTurnRate: 0,
        averageTurnRate: 0
      },
      vehicleFeel: {
        frontWheelSteer: 0,
        peakFrontWheelSteer: 0,
        visualSteeringSamples: 0,
        chassisPitch: 0,
        chassisRoll: 0,
        peakChassisRoll: 0,
        brakeFxSamples: 0,
        driftFxSamples: 0,
        skidIntensity: 0,
        maxSkidIntensity: 0,
        driftTrailMarks: 0,
        brakeTrailMarks: 0
      },
      material: {
        currentKind: "road",
        currentId: "route-ribbon",
        currentIntensity: 0,
        rideHeight: 0,
        pitch: 0,
        roll: 0,
        terrainHeight: 0,
        terrainGrade: 0,
        terrainNormalY: 1,
        terrainFeatureId: null,
        waterSamples: 0,
        rampSamples: 0,
        fieldSamples: 0,
        roadSamples: 0,
        terrainSamples: 0,
        minTerrainHeight: 0,
        maxTerrainHeight: 0,
        maxTerrainGrade: 0,
        materialTransitions: 0,
        maxWaterIntensity: 0,
        maxRampRideHeight: 0,
        activeFxMarks: 0,
        emittedFxMarks: 0,
        surfaceFxProfiles: [],
        surfaceFxWaterProfiles: 0,
        surfaceFxRampProfiles: 0,
        surfaceFxProfileCounts: {},
        surfaceFxSignatures: 0,
        surfaceFxColorVariants: 0,
        surfaceFxObjectCapacity: 0,
        surfaceFxActiveWaterMarks: 0,
        surfaceFxActiveRampMarks: 0,
        maxSurfaceFxScaleVariance: 0,
        waterRegionCount: worldMaterialRegions.water.length,
        rampRegionCount: worldMaterialRegions.ramps.length,
        terrainFeatureCount: terrainConfig.featureCount
      },
      boundary: {
        worldHalfExtent,
        contactCount: 0,
        contactAxes: {},
        lastContactAxis: null,
        lastContactSpeed: 0,
        distanceToEdge: worldHalfExtent,
        minDistanceToEdge: worldHalfExtent,
        hardStopAwayFromEdgeCount: 0
      },
      physicsSamples: []
    },
    camera: {
      position: { x: 8, y: 9, z: 8 },
      target: { x: 0, y: 0, z: 0 },
      desired: { x: 8, y: 9.4, z: 8 },
      lag: 0,
      distanceToPlayer: 0
    },
    screen: {
      player: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false },
      playerRect: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        area: 0,
        clippedX: 0,
        clippedY: 0,
        clippedWidth: 0,
        clippedHeight: 0,
        clippedArea: 0,
        visibleRatio: 0,
        cornerDepthCount: 0,
        visible: false,
        center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false }
      },
      activeZone: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false, zoneId: defaultZone.id },
      activeLandmark: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        area: 0,
        clippedX: 0,
        clippedY: 0,
        clippedWidth: 0,
        clippedHeight: 0,
        clippedArea: 0,
        visibleRatio: 0,
        cornerDepthCount: 0,
        visible: false,
        center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false },
        zoneId: defaultZone.id
      },
      activeSetDressing: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        area: 0,
        clippedX: 0,
        clippedY: 0,
        clippedWidth: 0,
        clippedHeight: 0,
        clippedArea: 0,
        visibleRatio: 0,
        cornerDepthCount: 0,
        visible: false,
        center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false },
        zoneId: defaultZone.id
      },
      activePlaceArchitecture: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        area: 0,
        clippedX: 0,
        clippedY: 0,
        clippedWidth: 0,
        clippedHeight: 0,
        clippedArea: 0,
        visibleRatio: 0,
        cornerDepthCount: 0,
        visible: false,
        center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false },
        zoneId: defaultZone.id,
        family: null
      },
      activeSignatureArtifact: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        area: 0,
        clippedX: 0,
        clippedY: 0,
        clippedWidth: 0,
        clippedHeight: 0,
        clippedArea: 0,
        visibleRatio: 0,
        cornerDepthCount: 0,
        visible: false,
        center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false },
        zoneId: defaultZone.id
      },
      activeProjectArtifact: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        area: 0,
        clippedX: 0,
        clippedY: 0,
        clippedWidth: 0,
        clippedHeight: 0,
        clippedArea: 0,
        visibleRatio: 0,
        cornerDepthCount: 0,
        visible: false,
        center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false },
        zoneId: defaultZone.id
      },
      identityRibbon: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        area: 0,
        clippedX: 0,
        clippedY: 0,
        clippedWidth: 0,
        clippedHeight: 0,
        clippedArea: 0,
        visibleRatio: 0,
        cornerDepthCount: 0,
        visible: false,
        center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false }
      },
      activeZoneComposition: {
        zoneId: defaultZone.id,
        visibleLayerCount: 0,
        union: {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          area: 0,
          clippedX: 0,
          clippedY: 0,
          clippedWidth: 0,
          clippedHeight: 0,
          clippedArea: 0,
          visibleRatio: 0,
          cornerDepthCount: 0,
          visible: false,
          center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false }
        },
        centerSpreadPx: 0,
        pairDistancesPx: {
          landmarkToPlace: 0,
          landmarkToSignature: 0,
          placeToSignature: 0
        },
        pairOverlapRatios: {
          landmarkPlace: 0,
          landmarkSignature: 0,
          placeSignature: 0
        },
        largestLayerAreaRatio: 0
      },
      activeRouteEncounter: {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        area: 0,
        clippedX: 0,
        clippedY: 0,
        clippedWidth: 0,
        clippedHeight: 0,
        clippedArea: 0,
        visibleRatio: 0,
        cornerDepthCount: 0,
        visible: false,
        center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false },
        id: null,
        routeId: null,
        intensity: 0,
        distance: 0
      }
    },
    input: { activeKeys: [], keyboardDownCount: 0, keyboardUpCount: 0, lastKeyboardCode: null, qaStepHookCalls: 0 },
    activeFeedback: {
      zoneId: defaultZone.id,
      sequence: 0,
      lastTriggeredFrame: 0,
      visibleObjects: 0,
      ringCount: 0,
      sparkCount: 0,
      intensity: 0,
      maxOpacity: 0,
      maxScale: 1,
      cameraImpulse: 0
    },
    lighting: {
      poolCount: 0,
      poolObjects: 0,
      activePoolVisible: false,
      activePoolOpacity: 0,
      activePoolScale: 0,
      routePoolVisible: false,
      routePoolOpacity: 0,
      routePoolScale: 0,
      nearestRouteId: null,
      realLightCount: 0,
      shadowCastingLightCount: 0
    },
    routeEncounters: {
      gateCount: 0,
      objectCount: 0,
      activeId: null,
      activeRouteId: null,
      activeDistance: 0,
      activeIntensity: 0,
      activeCount: 0,
      visitedIds: [],
      visitedCount: 0,
      maxIntensity: 0
    },
    audio: {
      supported:
        typeof window.AudioContext !== "undefined" ||
        typeof (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext !== "undefined",
      initialized: false,
      muted: true,
      contextState: "uninitialized",
      engineGain: 0,
      driftGain: 0,
      ambienceGain: 0,
      accelerationGain: 0,
      waterGain: 0,
      rampGain: 0,
      brakeGain: 0,
      engineFrequency: 0,
      surfaceFrequency: 0,
      toggleVisible: false,
      togglePressed: false
    },
    canvas: { width: 0, height: 0, dpr: 1 },
    renderer: { calls: 0, triangles: 0, geometries: 0, textures: 0 },
    frameCount: 0,
    averageFrameMs: 0,
    visitedZoneIds: [defaultZone.id],
    reducedMotion: motionQuery.matches,
    lastInputMode: "none",
    errors: []
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !qaMode && window.devicePixelRatio < 2,
      alpha: false,
      preserveDrawingBuffer: qaMode,
      powerPreference: "high-performance"
    });
    this.renderer.shadowMap.enabled = false;
  }

  start() {
    this.setScene();
    this.setWorld();
    this.setPlayer();
    this.setPlayerTrail();
    this.setSurfaceFx();
    this.setEvents();
    this.resize();
    this.updatePanel(defaultZone);
    if (qaMode) {
      this.exposeQaSnapshot();
      this.exposeQaRefresh();
    }
    this.exposeQaControls();
    this.animate();
  }

  private setScene() {
    this.scene.background = new THREE.Color(0x07100e);
    this.scene.fog = new THREE.Fog(0x07100e, 18, 52);

    const hemi = new THREE.HemisphereLight(0xfff0d0, 0x0b1624, 2.2);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(-6, 11, 8);
    key.castShadow = false;
    this.scene.add(key);

    this.camera.position.set(8, 9, 8);
    this.cameraTarget.set(0, 0, 0);
    this.cameraDesired.set(8, 9.4, 8);
    this.camera.lookAt(this.cameraTarget);
  }

  private setWorld() {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(worldGroundRadius, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: worldTexture,
        roughness: 0.86,
        metalness: 0.05
      })
    );
    ground.rotation.x = -Math.PI * 0.5;
    ground.rotation.z = Math.PI * 0.06;
    ground.scale.set(1.12, 1, 0.88);
    ground.renderOrder = -4;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.addDistrictPlates();
    this.addVisibleWorldBoundary();
    this.addWorldScenery();
    this.addRoads();
    this.addRouteGuidance();
    this.addLightingPools();
    this.addWorldProps();

    for (const zone of zones) {
      this.addZone(zone);
    }
  }

  private addVisibleWorldBoundary() {
    const boundary = new THREE.Group();
    boundary.name = "visible-world-boundary";
    boundary.userData.visibleBoundaryRole = "world-edge";

    const railMaterial = new THREE.MeshStandardMaterial({
      color: colors.studio,
      roughness: 0.42,
      metalness: 0.2,
      emissive: colors.studio,
      emissiveIntensity: 0.28,
      transparent: true,
      opacity: 0.86
    });
    const cornerMaterial = new THREE.MeshStandardMaterial({
      color: colors.road,
      roughness: 0.48,
      metalness: 0.18,
      emissive: colors.road,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.88
    });
    const railGeometry = new THREE.BoxGeometry(worldSize, 0.08, 0.16);
    const cornerGeometry = new THREE.CylinderGeometry(0.2, 0.28, 0.55, 8);
    const rails = new THREE.InstancedMesh(railGeometry, railMaterial, 4);
    const corners = new THREE.InstancedMesh(cornerGeometry, cornerMaterial, 4);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    const railSpecs = [
      [0, -worldHalfExtent, 0],
      [0, worldHalfExtent, 0],
      [-worldHalfExtent, 0, Math.PI * 0.5],
      [worldHalfExtent, 0, Math.PI * 0.5]
    ] as const;
    const cornerSpecs = [
      [-worldHalfExtent, -worldHalfExtent],
      [worldHalfExtent, -worldHalfExtent],
      [worldHalfExtent, worldHalfExtent],
      [-worldHalfExtent, worldHalfExtent]
    ] as const;

    railSpecs.forEach(([x, z, rotation], index) => {
      quaternion.setFromEuler(new THREE.Euler(0, rotation, 0));
      matrix.compose(new THREE.Vector3(x, 0.14, z), quaternion, scale);
      rails.setMatrixAt(index, matrix);
    });
    cornerSpecs.forEach(([x, z], index) => {
      quaternion.setFromEuler(new THREE.Euler(0, index * Math.PI * 0.5, 0));
      matrix.compose(new THREE.Vector3(x, 0.29, z), quaternion, scale);
      corners.setMatrixAt(index, matrix);
    });
    rails.instanceMatrix.needsUpdate = true;
    corners.instanceMatrix.needsUpdate = true;
    rails.userData.visibleBoundaryPart = "edge-rail";
    rails.userData.visibleBoundaryObjectCount = 4;
    corners.userData.visibleBoundaryPart = "corner-pylon";
    corners.userData.visibleBoundaryObjectCount = 4;
    boundary.add(rails, corners);
    this.scene.add(boundary);
    this.decorativeObjectCount += 8;
  }

  private createLightPool(role: string, opacity: number) {
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(1, 64),
      new THREE.MeshBasicMaterial({
        color: colors.studio,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    mesh.rotation.x = -Math.PI * 0.5;
    mesh.position.y = 0.052;
    mesh.renderOrder = 2;
    mesh.userData.worldLightingRole = role;
    return mesh;
  }

  private addLightingPools() {
    this.activeLightPool = this.createLightPool("active-zone-pool", motionQuery.matches ? 0.08 : 0.14);
    this.routeLightPool = this.createLightPool("nearest-route-pool", motionQuery.matches ? 0.05 : 0.1);
    this.routeLightPool.scale.setScalar(1.35);
    this.scene.add(this.activeLightPool);
    this.scene.add(this.routeLightPool);
    this.decorativeObjectCount += 2;
    this.lightPoolObjectCount = 2;
    this.updateLightingPools(0);
  }

  private addWorldScenery() {
    const rendered = createWorldScenery(colors);
    this.scene.add(rendered.group);
    this.sceneryObjectCount += rendered.objectCount;
    this.worldSceneryMotionObjectCount += rendered.motionObjectCount;
    this.identityRibbonGroup = rendered.identityRibbon;
    this.terrainLayerCount += rendered.terrainLayers;
    this.terrainHeightRange = rendered.terrainHeightRange;
    this.terrainMinHeight = rendered.terrainMinHeight;
    this.terrainMaxHeight = rendered.terrainMaxHeight;
    this.terrainVertexCount = rendered.terrainVertexCount;
    this.terrainGradeMax = rendered.terrainGradeMax;
    this.terrainFeatureCount = rendered.terrainFeatureCount;
    this.decorativeObjectCount += rendered.objectCount;
    this.motionRoleCount += rendered.motionObjectCount;
    this.worldSceneryMotionObjects.push(...rendered.motionObjects);
    for (const signature of rendered.signatures) {
      this.scenerySignatureIds.add(signature);
    }
  }

  private addRouteGuidance() {
    const rendered = createRouteGuidance(colors);
    this.scene.add(rendered.group);
    this.routeGuidanceObjectCount += rendered.objectCount;
    this.routeGuidanceVisualizedSegments += rendered.visualizedSegmentCount;
    this.routeEncounterObjectCount += rendered.encounterGates.length;
    this.decorativeObjectCount += rendered.objectCount;
    this.motionRoleCount += rendered.motionObjects.length;
    this.routeGuidanceMotionObjects.push(...rendered.motionObjects);
    this.routeEncounterGates.push(...rendered.encounterGates);
    for (const signature of rendered.signatures) {
      this.routeGuidanceSignatureIds.add(signature);
    }
    for (const [role, count] of Object.entries(rendered.roleCounts)) {
      this.routeGuidanceRoleCounts[role] = (this.routeGuidanceRoleCounts[role] ?? 0) + count;
    }
  }

  private createDistrictPlate(points: Array<readonly [number, number]>, color: number, opacity: number) {
    const shape = new THREE.Shape();
    points.forEach(([x, z], index) => {
      if (index === 0) {
        shape.moveTo(x, -z);
      } else {
        shape.lineTo(x, -z);
      }
    });
    shape.closePath();

    const plate = new THREE.Mesh(
      new THREE.ShapeGeometry(shape),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: createWorldTexture(color, 7),
        roughness: 0.92,
        metalness: 0.02,
        transparent: true,
        opacity: Math.min(0.18, opacity + 0.035),
        depthWrite: false
      })
    );
    plate.rotation.x = -Math.PI * 0.5;
    plate.position.y = 0.012;
    plate.renderOrder = -2;
    plate.receiveShadow = true;
    this.scene.add(plate);
    this.decorativeObjectCount += 1;
  }

  private addDistrictPlates() {
    this.createDistrictPlate(
      [
        [-16.3, -10.8],
        [-8.1, -14.8],
        [-1.6, -8.1],
        [-3.4, 10.9],
        [-13.6, 11],
        [-17.1, 2.1]
      ],
      colors.tech,
      0.11
    );
    this.createDistrictPlate(
      [
        [3.2, -13.6],
        [16.7, -11.4],
        [17.3, 7.8],
        [8.6, 13.2],
        [1.9, 7.8],
        [1.4, -7.4]
      ],
      colors.art,
      0.1
    );
    this.createDistrictPlate(
      [
        [-4.9, -5.9],
        [4.2, -6.6],
        [6.3, 2.9],
        [1.3, 14.2],
        [-5.6, 10.2],
        [-6.9, 0.7]
      ],
      colors.studio,
      0.16
    );
  }

  private addRoads() {
    const routeSurfaceStyle = {
      underlayOpacity: 0.14,
      laneOpacity: 0.78,
      laneEmissiveIntensity: 0.22,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      underlayColor: 0x6a766d,
      castsShadow: false
    };
    const underlay = new THREE.MeshBasicMaterial({
      color: routeSurfaceStyle.underlayColor,
      transparent: true,
      opacity: routeSurfaceStyle.underlayOpacity,
      depthWrite: false
    });
    const routeMaterial = new THREE.MeshStandardMaterial({
      color: colors.road,
      roughness: 0.44,
      metalness: 0.18,
      emissive: colors.road,
      emissiveIntensity: 0.12,
      transparent: true,
      opacity: 0.82
    });

    const zoneById = new Map(zones.map((zone) => [zone.id, zone]));

    for (const routeInfo of worldRoutes) {
      const from = zoneById.get(routeInfo.from);
      const to = zoneById.get(routeInfo.to);
      if (!from || !to) {
        continue;
      }

      const accent = colors[routeInfo.kind];
      const accentMaterial = new THREE.MeshStandardMaterial({
        color: accent,
        roughness: 0.52,
        metalness: 0.24,
        emissive: accent,
        emissiveIntensity: routeSurfaceStyle.laneEmissiveIntensity,
        transparent: true,
        opacity: routeSurfaceStyle.laneOpacity,
        polygonOffset: true,
        polygonOffsetFactor: routeSurfaceStyle.polygonOffsetFactor,
        polygonOffsetUnits: routeSurfaceStyle.polygonOffsetUnits
      });
      const points = [
        new THREE.Vector3(from.position[0], 0.075, from.position[1]),
        ...(routeInfo.via ?? []).map(([x, z]) => new THREE.Vector3(x, 0.08, z)),
        new THREE.Vector3(to.position[0], 0.075, to.position[1])
      ];
      const ribbon = createRoadRibbonGeometry(points, routeInfo.id, driveSurfaceConfig.routeWidth);
      const base = new THREE.Mesh(ribbon.bed, underlay);
      const route = new THREE.Mesh(ribbon.lane, accentMaterial);
      base.userData.routeSurfaceRole = "route-bed";
      base.userData.routeSurfaceRouteId = routeInfo.id;
      base.userData.routeSurfaceDetailParts = ribbon.bedDetailCount;
      base.userData.routeSurfaceVertexCount = ribbon.bed.getAttribute("position").count;
      base.userData.routeSurfaceSignatures = ribbon.signatures.slice(0, 3);
      route.userData.routeSurfaceRole = "route-lane";
      route.userData.routeSurfaceRouteId = routeInfo.id;
      route.userData.routeSurfaceDetailParts = ribbon.laneDetailCount;
      route.userData.routeSurfaceVertexCount = ribbon.lane.getAttribute("position").count;
      route.userData.routeSurfaceSignatures = ribbon.signatures.slice(3);
      base.receiveShadow = false;
      route.castShadow = routeSurfaceStyle.castsShadow;
      route.receiveShadow = false;
      this.scene.add(base, route);
      this.roadSegmentCount += 2;
      this.routeSurfaceObjectCount += 2;
      this.routeSurfaceDetailPartCount += ribbon.bedDetailCount + ribbon.laneDetailCount;
      this.routeSurfaceVertexCount += ribbon.vertexCount;
      for (const signature of ribbon.signatures) {
        this.routeSurfaceSignatureIds.add(signature);
      }
      this.decorativeObjectCount += 2;

      const node = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 0.12, 12),
        routeMaterial
      );
      node.position.set(to.position[0], 0.24, to.position[1]);
      node.userData.routeSurfaceRole = "route-node";
      node.userData.routeSurfaceRouteId = routeInfo.id;
      node.userData.routeSurfaceDetailParts = 1;
      node.userData.routeSurfaceVertexCount = node.geometry.getAttribute("position").count;
      node.userData.routeSurfaceSignatures = [`road:${routeInfo.id}:destination-node`];
      node.castShadow = routeSurfaceStyle.castsShadow;
      this.scene.add(node);
      this.routeSurfaceObjectCount += 1;
      this.routeSurfaceDetailPartCount += 1;
      this.routeSurfaceVertexCount += node.geometry.getAttribute("position").count;
      this.routeSurfaceSignatureIds.add(`road:${routeInfo.id}:destination-node`);
      this.decorativeObjectCount += 1;
    }
  }

  private addWorldProps() {
    const props = [
      [-8.4, -1.7, colors.tech],
      [-10.4, 2.1, colors.tech],
      [-5.9, 5.2, colors.tech],
      [-2.2, -7.1, colors.tech],
      [8.2, -1.8, colors.art],
      [10.8, 1.2, colors.art],
      [7.2, 5.5, colors.art],
      [3.8, 7.8, colors.art],
      [-1.8, 2.4, colors.studio],
      [1.7, 2.1, colors.studio],
      [-1.4, -3.1, colors.studio],
      [2.2, -3.5, colors.studio]
    ] as const;

    const propMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.44,
      metalness: 0.22,
      emissive: 0xffffff,
      emissiveIntensity: 0.08,
      vertexColors: true
    });
    const propGroup = new THREE.Group();
    propGroup.name = "instanced-world-beacon-posts";
    const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 8), propMaterial, props.length);
    const caps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 12, 8), propMaterial, props.length);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    props.forEach(([x, z, hex], index) => {
      dummy.position.set(x, 0.48, z);
      dummy.rotation.set(0, index * 0.17, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      stems.setMatrixAt(index, dummy.matrix);
      stems.setColorAt(index, color.setHex(hex));

      dummy.position.set(x, 0.9, z);
      dummy.rotation.set(0, index * 0.17, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      caps.setMatrixAt(index, dummy.matrix);
      caps.setColorAt(index, color.setHex(hex));
    });

    [stems, caps].forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.userData.worldBeaconPart = mesh === stems ? "beacon-stem" : "beacon-cap";
      mesh.userData.worldBeaconObjectCount = props.length;
      propGroup.add(mesh);
    });

    this.scene.add(propGroup);
    this.decorativeObjectCount += props.length * 2;
  }

  private addZone(zone: StudioZone) {
    const group = new THREE.Group();
    group.name = zone.id;
    group.position.set(zone.position[0], 0, zone.position[1]);
    group.userData.zoneId = zone.id;

    const accent = colors[zone.kind];
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(zone.radius, zone.radius * 1.08, 0.22, zone.kind === "studio" ? 10 : 7),
      new THREE.MeshStandardMaterial({
        color: accent,
        roughness: 0.72,
        metalness: 0.08,
        emissive: accent,
        emissiveIntensity: 0.08
      })
    );
    base.position.y = 0.11;
    base.userData.zoneId = zone.id;
    group.add(base);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(zone.radius * 1.09, 0.045, 8, 72),
      new THREE.MeshStandardMaterial({
        color: accent,
        roughness: 0.36,
        metalness: 0.2,
        emissive: accent,
        emissiveIntensity: 0.22,
        transparent: true,
        opacity: 0.82
      })
    );
    rim.rotation.x = Math.PI * 0.5;
    rim.position.y = 0.26;
    rim.userData.zoneId = zone.id;
    group.add(rim);

    const activationFeedback = this.createZoneActivationFeedback(zone, accent);
    group.add(activationFeedback.group);
    this.activationFeedbackByZone.set(zone.id, activationFeedback);
    this.decorativeObjectCount += 1 + activationFeedback.rings.length + activationFeedback.sparks.length;
    this.motionRoleCount += activationFeedback.rings.length + activationFeedback.sparks.length;

    const visualSpec = zoneVisualSpecs[zone.id];
    if (visualSpec) {
      this.addZoneVisualSpec(group, zone, visualSpec);
    }

    this.addZoneSetDressing(group, zone);
    this.addZonePlaceArchitecture(group, zone);
    this.addZoneSignatureArtifacts(group, zone);
    this.addZoneProjectArtifacts(group, zone);

    const marker = createZoneLandmark(zone, colors);
    marker.userData.zoneId = zone.id;
    marker.traverse((child) => {
      child.userData.zoneId = zone.id;
      child.userData.landmarkZone = zone.id;
    });
    this.landmarkMeshes.set(zone.id, marker);
    group.add(marker);

    const label = this.createLabel(zone.shortLabel, accent);
    label.position.set(0, 1.78, 0);
    group.add(label);

    this.zoneMeshes.set(zone.id, group);
    this.scene.add(group);
  }

  private createZoneActivationFeedback(zone: StudioZone, accent: number): ActivationFeedback {
    const group = new THREE.Group();
    group.name = `${zone.id}-activation-feedback`;
    group.userData.zoneId = zone.id;
    group.userData.activationFeedbackZone = zone.id;

    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(zone.radius * 1.28, 36),
      new THREE.MeshBasicMaterial({
        color: accent,
        transparent: true,
        opacity: 0.05,
        depthWrite: false
      })
    );
    halo.rotation.x = -Math.PI * 0.5;
    halo.position.y = 0.31;
    halo.userData.zoneId = zone.id;
    halo.userData.activationFeedbackPart = "halo";
    group.add(halo);

    const rings: ActivationFeedback["rings"] = [];
    for (let index = 0; index < 3; index += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(zone.radius * (1.16 + index * 0.16), 0.018 + index * 0.004, 8, 72),
        new THREE.MeshBasicMaterial({
          color: index === 1 ? colors.studio : accent,
          transparent: true,
          opacity: 0.08,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI * 0.5;
      ring.position.y = 0.42 + index * 0.06;
      ring.userData.zoneId = zone.id;
      ring.userData.activationFeedbackPart = "ring";
      ring.userData.motionRole = "activation-ring";
      ring.userData.localMotionBehavior = "sweep";
      group.add(ring);
      rings.push(ring);
    }

    const sparks: ActivationFeedback["sparks"] = [];
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      const radius = zone.radius * (1.05 + (index % 2) * 0.18);
      const spark = new THREE.Mesh(
        new THREE.SphereGeometry(0.07 + (index % 3) * 0.012, 10, 6),
        new THREE.MeshBasicMaterial({
          color: index % 2 === 0 ? accent : colors.studio,
          transparent: true,
          opacity: 0.06,
          depthWrite: false
        })
      );
      spark.position.set(Math.cos(angle) * radius, 0.62 + (index % 3) * 0.08, Math.sin(angle) * radius);
      spark.userData.zoneId = zone.id;
      spark.userData.activationFeedbackPart = "spark";
      spark.userData.motionRole = "activation-spark";
      spark.userData.localMotionBehavior = index % 2 === 0 ? "float" : "pulse";
      spark.userData.motionBaseX = spark.position.x;
      spark.userData.motionBaseY = spark.position.y;
      spark.userData.motionBaseZ = spark.position.z;
      group.add(spark);
      sparks.push(spark);
    }

    return { group, halo, rings, sparks, age: 99, intensity: 0, triggerCount: 0 };
  }

  private addZoneVisualSpec(group: THREE.Group, zone: StudioZone, spec: ZoneVisualSpec) {
    const rendered = renderZoneVisuals(group, zone, spec, colors);
    group.userData.expectedAnimation = spec.animation;
    this.renderedVisualSpecIds.add(rendered.visualSpecId);
    this.visualDecalCount += rendered.visualDecals;
    this.propClusterCount += rendered.propClusters;
    this.surfaceObjectCount += rendered.surfaceObjects;
    this.decorativeObjectCount += rendered.surfaceObjects + rendered.visualDecals + rendered.propObjects;
    this.motionRoleCount += rendered.motionObjects.length;
    this.zoneMotionObjects.set(zone.id, rendered.motionObjects);
    for (const signature of rendered.surfaceSignatures) {
      this.surfaceSignatureIds.add(signature);
    }
    for (const variant of rendered.materialVariants) {
      this.materialVariantIds.add(variant);
    }
  }

  private addZoneSetDressing(group: THREE.Group, zone: StudioZone) {
    const rendered = createZoneSetDressing(zone, colors);
    group.add(rendered.group);
    this.setDressingGroups.set(zone.id, rendered.group);
    this.setDressingObjectCount += rendered.objectCount;
    this.decorativeObjectCount += rendered.objectCount;
    this.motionRoleCount += rendered.motionObjects.length;
    for (const signature of rendered.signatures) {
      this.setDressingSignatureIds.add(signature);
    }
    const existingMotionObjects = this.zoneMotionObjects.get(zone.id) ?? [];
    this.zoneMotionObjects.set(zone.id, [...existingMotionObjects, ...rendered.motionObjects]);
  }

  private addZonePlaceArchitecture(group: THREE.Group, zone: StudioZone) {
    const rendered = createZonePlaceArchitecture(zone, colors);
    group.add(rendered.group);
    this.placeArchitectureGroups.set(zone.id, rendered.group);
    this.placeArchitectureObjectCount += rendered.objectCount;
    this.placeArchitectureFamilyIds.add(rendered.family);
    this.decorativeObjectCount += rendered.objectCount;
    this.motionRoleCount += rendered.motionObjects.length;
    for (const signature of rendered.signatures) {
      this.placeArchitectureSignatureIds.add(signature);
    }
    const existingMotionObjects = this.zoneMotionObjects.get(zone.id) ?? [];
    this.zoneMotionObjects.set(zone.id, [...existingMotionObjects, ...rendered.motionObjects]);
  }

  private addZoneSignatureArtifacts(group: THREE.Group, zone: StudioZone) {
    const rendered = createZoneSignatureArtifacts(zone, colors);
    group.add(rendered.group);
    this.signatureArtifactGroups.set(zone.id, rendered.group);
    this.signatureArtifactObjectCount += rendered.objectCount;
    this.decorativeObjectCount += rendered.objectCount;
    this.motionRoleCount += rendered.motionObjects.length;
    for (const signature of rendered.signatures) {
      this.signatureArtifactSignatureIds.add(signature);
    }
    for (const variant of rendered.materialVariants) {
      this.materialVariantIds.add(variant);
    }
    const existingMotionObjects = this.zoneMotionObjects.get(zone.id) ?? [];
    this.zoneMotionObjects.set(zone.id, [...existingMotionObjects, ...rendered.motionObjects]);
  }

  private addZoneProjectArtifacts(group: THREE.Group, zone: StudioZone) {
    const rendered = createZoneProjectArtifacts(zone, colors);
    if (rendered.objectCount === 0) {
      return;
    }
    group.add(rendered.group);
    this.projectArtifactGroups.set(zone.id, rendered.group);
    this.projectArtifactObjectCount += rendered.objectCount;
    this.projectArtifactSceneObjectCount += rendered.sceneObjectCount;
    this.projectArtifactZoneIds.add(zone.id);
    this.decorativeObjectCount += rendered.objectCount;
    this.motionRoleCount += rendered.motionObjects.length;
    for (const activityType of rendered.activityTypes) {
      this.projectArtifactActivityIds.add(activityType);
    }
    for (const signature of rendered.signatures) {
      this.projectArtifactSignatureIds.add(signature);
    }
    for (const variant of rendered.materialVariants) {
      this.projectArtifactMaterialIds.add(variant);
      this.materialVariantIds.add(variant);
    }
    const existingMotionObjects = this.zoneMotionObjects.get(zone.id) ?? [];
    this.zoneMotionObjects.set(zone.id, [...existingMotionObjects, ...rendered.motionObjects]);
  }

  private createLabel(text: string, accent: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 160;
    const context = canvas.getContext("2d");

    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "rgba(5, 8, 9, 0.78)";
      context.fillRect(0, 36, canvas.width, 88);
      context.strokeStyle = `#${accent.toString(16).padStart(6, "0")}`;
      context.lineWidth = 6;
      context.strokeRect(5, 41, canvas.width - 10, 78);
      context.fillStyle = "#fff7de";
      context.font = "700 62px system-ui, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, canvas.width / 2, 82);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      })
    );
    sprite.scale.set(1.72, 0.54, 1);
    return sprite;
  }

  private setPlayer() {
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff2b0,
      roughness: 0.45,
      metalness: 0.16,
      emissive: 0xffc847,
      emissiveIntensity: 0.18
    });
    const techMaterial = new THREE.MeshStandardMaterial({
      color: colors.tech,
      roughness: 0.42,
      metalness: 0.24,
      emissive: colors.tech,
      emissiveIntensity: 0.2
    });
    const artMaterial = new THREE.MeshStandardMaterial({
      color: colors.art,
      roughness: 0.5,
      metalness: 0.14,
      emissive: colors.art,
      emissiveIntensity: 0.18
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xfff7df,
      roughness: 0.22,
      metalness: 0.08,
      transparent: true,
      opacity: 0.86,
      emissive: 0xffe38a,
      emissiveIntensity: 0.12
    });
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x121217, roughness: 0.8 });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.28, 1.16), bodyMaterial);
    chassis.position.y = 0.4;
    this.player.add(chassis);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.42), bodyMaterial);
    nose.position.set(0, 0.52, -0.48);
    this.player.add(nose);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.3, 0.44), glassMaterial);
    cabin.position.set(0, 0.72, -0.02);
    cabin.rotation.x = -0.08;
    this.player.add(cabin);

    const techFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.62), techMaterial);
    techFin.position.set(-0.48, 0.58, 0.06);
    techFin.rotation.z = -0.16;
    this.player.add(techFin);

    const artFin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.62), artMaterial);
    artFin.position.set(0.48, 0.58, 0.06);
    artFin.rotation.z = 0.16;
    this.player.add(artFin);

    const brush = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 12), artMaterial);
    brush.position.set(0.32, 0.92, 0.3);
    brush.rotation.x = Math.PI * 0.58;
    this.player.add(brush);

    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.54, 8), techMaterial);
    antenna.position.set(-0.28, 0.98, 0.24);
    antenna.rotation.z = -0.24;
    this.player.add(antenna);

    const antennaCap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 6), techMaterial);
    antennaCap.position.set(-0.34, 1.24, 0.24);
    this.player.add(antennaCap);

    for (const x of [-0.22, 0.22]) {
      const headlight = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 6), glassMaterial);
      headlight.position.set(x, 0.54, -0.72);
      this.player.add(headlight);
    }

    for (const x of [-0.48, 0.48]) {
      for (const z of [-0.42, 0.42]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.16, 16), wheelMaterial);
        wheel.rotation.z = Math.PI * 0.5;
        wheel.position.set(x, 0.22, z);
        this.player.add(wheel);
        this.wheelParts.push({ mesh: wheel, front: z < 0, side: x < 0 ? -1 : 1 });
      }
    }

    this.player.traverse((child) => {
      child.userData.playerPart = true;
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        this.playerPartCount += 1;
      }
    });
    this.player.rotation.y = Math.PI;
    this.player.position.copy(this.playerPosition);
    this.scene.add(this.player);
  }

  private setPlayerTrail() {
    this.trailGroup.name = "studio-rover-trail";
    this.trailGroup.userData.trailGroup = true;
    const geometry = new THREE.CircleGeometry(0.18, 18);

    for (let index = 0; index < 18; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: colors.studio,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const mark = new THREE.Mesh(geometry, material);
      mark.rotation.x = -Math.PI * 0.5;
      mark.position.y = 0.04;
      mark.visible = false;
      mark.userData.trailMark = true;
      this.trailGroup.add(mark);
      this.trailMarks.push({ mesh: mark, age: 12, maxAge: 12, kind: "roll", baseOpacity: 0.38 });
    }

    this.decorativeObjectCount += this.trailMarks.length;
    this.scene.add(this.trailGroup);
  }

  private setSurfaceFx() {
    this.surfaceFxGroup.name = "studio-rover-surface-fx";
    const geometry = new THREE.TorusGeometry(0.22, 0.012, 6, 32);
    const waterMaterial = new THREE.MeshBasicMaterial({
      color: colors.tech,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });
    const rampMaterial = new THREE.MeshBasicMaterial({
      color: colors.studio,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true
    });
    this.waterSurfaceFxMesh = new THREE.InstancedMesh(geometry, waterMaterial, 14);
    this.rampSurfaceFxMesh = new THREE.InstancedMesh(geometry, rampMaterial, 14);
    this.waterSurfaceFxMesh.userData.surfaceFxPart = "water-ripple";
    this.rampSurfaceFxMesh.userData.surfaceFxPart = "ramp-skid";
    this.waterSurfaceFxMesh.userData.surfaceFxSupportsInstanceColor = true;
    this.rampSurfaceFxMesh.userData.surfaceFxSupportsInstanceColor = true;

    for (let index = 0; index < 14; index += 1) {
      this.surfaceFxMarks.push({
        age: 4,
        maxAge: 4,
        kind: "field",
        profile: "water-ripple",
        position: new THREE.Vector3(0, -20, 0),
        rotationZ: 0,
        scale: 0.001,
        widthScale: 1,
        lengthScale: 1,
        color: colors.tech,
        liftSpeed: 0,
        spinSpeed: 0,
        signature: "surface-fx:hidden",
        opacity: 0,
        baseOpacity: 0
      });
    }
    this.writeSurfaceFxInstances();

    this.surfaceFxGroup.add(this.waterSurfaceFxMesh, this.rampSurfaceFxMesh);
    this.decorativeObjectCount += 2;
    this.scene.add(this.surfaceFxGroup);
  }

  private writeSurfaceFxInstances() {
    if (!this.waterSurfaceFxMesh || !this.rampSurfaceFxMesh) {
      return;
    }
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const hiddenPosition = new THREE.Vector3(0, -20, 0);
    const hiddenScale = new THREE.Vector3(0.001, 0.001, 0.001);
    const color = new THREE.Color();
    let waterIndex = 0;
    let rampIndex = 0;
    const hide = (mesh: THREE.InstancedMesh, index: number) => {
      matrix.compose(hiddenPosition, quaternion, hiddenScale);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, color.setHex(colors.ink));
    };

    this.surfaceFxMarks.forEach((mark) => {
      if (mark.opacity <= 0.02 || (mark.kind !== "water" && mark.kind !== "ramp")) {
        return;
      }
      quaternion.setFromEuler(new THREE.Euler(-Math.PI * 0.5, 0, mark.rotationZ + mark.spinSpeed * mark.age));
      scale.set(mark.scale * mark.widthScale, mark.scale * mark.lengthScale, mark.scale);
      matrix.compose(mark.position, quaternion, scale);
      if (mark.kind === "water" && waterIndex < this.waterSurfaceFxMesh!.count) {
        this.waterSurfaceFxMesh!.setMatrixAt(waterIndex, matrix);
        this.waterSurfaceFxMesh!.setColorAt(waterIndex, color.setHex(mark.color));
        waterIndex += 1;
      } else if (mark.kind === "ramp" && rampIndex < this.rampSurfaceFxMesh!.count) {
        this.rampSurfaceFxMesh!.setMatrixAt(rampIndex, matrix);
        this.rampSurfaceFxMesh!.setColorAt(rampIndex, color.setHex(mark.color));
        rampIndex += 1;
      }
    });

    for (let index = waterIndex; index < this.waterSurfaceFxMesh.count; index += 1) {
      hide(this.waterSurfaceFxMesh, index);
    }
    for (let index = rampIndex; index < this.rampSurfaceFxMesh.count; index += 1) {
      hide(this.rampSurfaceFxMesh, index);
    }
    this.waterSurfaceFxMesh.instanceMatrix.needsUpdate = true;
    this.rampSurfaceFxMesh.instanceMatrix.needsUpdate = true;
    if (this.waterSurfaceFxMesh.instanceColor) {
      this.waterSurfaceFxMesh.instanceColor.needsUpdate = true;
    }
    if (this.rampSurfaceFxMesh.instanceColor) {
      this.rampSurfaceFxMesh.instanceColor.needsUpdate = true;
    }
  }

  private setEvents() {
    window.addEventListener("resize", () => this.resize());

    window.addEventListener("keydown", (event) => {
      const key = this.keyFromEvent(event);
      if (key) {
        event.preventDefault();
        this.qaSnapshot.lastInputMode = "keyboard";
        if (!event.repeat) {
          this.keyboardDownCount += 1;
        }
        this.lastKeyboardCode = event.code;
        this.keys.add(key);
        if (qaMode && !realKeyboardQaMode && !event.repeat) {
          this.applyQaKeyboardStep(key);
        }
      }
    });

    window.addEventListener("keyup", (event) => {
      const key = this.keyFromEvent(event);
      if (key) {
        this.keyboardUpCount += 1;
        this.lastKeyboardCode = event.code;
        this.keys.delete(key);
      }
    });

    this.canvas.addEventListener("pointerdown", (event) => {
      this.qaSnapshot.lastInputMode = event.pointerType === "touch" ? "touch" : "pointer";
      this.handleCanvasPointer(event);
    });

    document.querySelectorAll<HTMLButtonElement>("[data-zone-jump]").forEach((button) => {
      button.addEventListener("click", () => {
        const zone = zones.find((item) => item.id === button.dataset.zoneJump);
        if (zone) {
          this.qaSnapshot.lastInputMode = "pointer";
          this.moveToZone(zone);
        }
      });
    });

    this.audioToggleButton = document.querySelector<HTMLButtonElement>("[data-audio-toggle]");
    this.syncAudioToggle();
    this.audioToggleButton?.addEventListener("click", () => {
      void this.toggleAudio();
    });

    document.querySelectorAll<HTMLButtonElement>("[data-drive]").forEach((button) => {
      const direction = button.dataset.drive as DriveKey | undefined;
      if (!direction) {
        return;
      }
      const start = () => {
        this.qaSnapshot.lastInputMode = "touch";
        this.keys.add(direction);
      };
      const end = () => this.keys.delete(direction);
      button.addEventListener("pointerdown", start);
      button.addEventListener("pointerup", end);
      button.addEventListener("pointerleave", end);
      button.addEventListener("pointercancel", end);
      button.addEventListener("blur", end);
    });
  }

  private audioSupported() {
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    return Boolean(window.AudioContext || audioWindow.webkitAudioContext);
  }

  private createAudioContext() {
    const audioWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = window.AudioContext ?? audioWindow.webkitAudioContext;
    if (!AudioContextCtor) {
      return null;
    }
    return new AudioContextCtor();
  }

  private ensureAudio() {
    if (this.audioContext || !this.audioSupported()) {
      return this.audioContext;
    }

    const context = this.createAudioContext();
    if (!context) {
      return null;
    }

    const master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    const engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineGain.connect(master);
    const engine = context.createOscillator();
    engine.type = "sawtooth";
    engine.frequency.value = 72;
    engine.connect(engineGain);
    engine.start();

    const driftGain = context.createGain();
    driftGain.gain.value = 0;
    driftGain.connect(master);
    const drift = context.createOscillator();
    drift.type = "triangle";
    drift.frequency.value = 240;
    drift.connect(driftGain);
    drift.start();

    const ambienceGain = context.createGain();
    ambienceGain.gain.value = 0.035;
    ambienceGain.connect(master);
    const ambience = context.createOscillator();
    ambience.type = "sine";
    ambience.frequency.value = 48;
    ambience.connect(ambienceGain);
    ambience.start();

    const accelerationGain = context.createGain();
    accelerationGain.gain.value = 0;
    accelerationGain.connect(master);
    const acceleration = context.createOscillator();
    acceleration.type = "triangle";
    acceleration.frequency.value = 360;
    acceleration.connect(accelerationGain);
    acceleration.start();

    const waterGain = context.createGain();
    waterGain.gain.value = 0;
    waterGain.connect(master);
    const water = context.createOscillator();
    water.type = "sine";
    water.frequency.value = 92;
    water.connect(waterGain);
    water.start();

    const rampGain = context.createGain();
    rampGain.gain.value = 0;
    rampGain.connect(master);
    const ramp = context.createOscillator();
    ramp.type = "square";
    ramp.frequency.value = 138;
    ramp.connect(rampGain);
    ramp.start();

    const brakeGain = context.createGain();
    brakeGain.gain.value = 0;
    brakeGain.connect(master);
    const brake = context.createOscillator();
    brake.type = "sawtooth";
    brake.frequency.value = 170;
    brake.connect(brakeGain);
    brake.start();

    this.audioContext = context;
    this.audioMasterGain = master;
    this.engineOscillator = engine;
    this.engineGain = engineGain;
    this.driftOscillator = drift;
    this.driftGain = driftGain;
    this.ambienceOscillator = ambience;
    this.ambienceGain = ambienceGain;
    this.accelerationOscillator = acceleration;
    this.accelerationGain = accelerationGain;
    this.waterOscillator = water;
    this.waterGain = waterGain;
    this.rampOscillator = ramp;
    this.rampGain = rampGain;
    this.brakeOscillator = brake;
    this.brakeGain = brakeGain;
    this.audioInitialized = true;
    return context;
  }

  private async toggleAudio() {
    const context = this.ensureAudio();
    if (!context || !this.audioMasterGain) {
      this.syncAudioToggle();
      return;
    }

    this.audioMuted = !this.audioMuted;
    if (!this.audioMuted && context.state === "suspended") {
      await context.resume().catch(() => {});
    }
    const now = context.currentTime;
    this.audioMasterGain.gain.cancelScheduledValues(now);
    this.audioMasterGain.gain.setTargetAtTime(this.audioMuted ? 0 : 0.56, now, 0.08);
    if (this.audioMuted) {
      this.currentEngineGain = 0;
      this.currentDriftGain = 0;
      this.currentAmbienceGain = 0;
      this.currentAccelerationGain = 0;
      this.currentWaterGain = 0;
      this.currentRampGain = 0;
      this.currentBrakeGain = 0;
    }
    this.syncAudioToggle();
  }

  private syncAudioToggle() {
    if (!this.audioToggleButton) {
      return;
    }
    const active = this.audioInitialized && !this.audioMuted;
    this.audioToggleButton.setAttribute("aria-pressed", String(active));
    this.audioToggleButton.setAttribute("aria-label", active ? "Couper le son" : "Activer le son");
    this.audioToggleButton.textContent = active ? "Mute" : "Son";
  }

  private keyFromEvent(event: KeyboardEvent): DriveKey | null {
    if (event.code === "ArrowUp" || event.code === "KeyW") return "up";
    if (event.code === "ArrowDown" || event.code === "KeyS") return "down";
    if (event.code === "ArrowLeft" || event.code === "KeyA") return "left";
    if (event.code === "ArrowRight" || event.code === "KeyD") return "right";
    return null;
  }

  private applyQaKeyboardStep(direction: DriveKey) {
    const step = 1.2;
    const turnStep = 0.34;
    const previousPosition = this.playerPosition.clone();
    const previousRotationY = this.player.rotation.y;
    if (direction === "left") this.player.rotation.y -= turnStep;
    if (direction === "right") this.player.rotation.y += turnStep;
    this.normalizePlayerRotation();
    const throttle = direction === "up" ? 1 : direction === "down" ? -1 : 0;
    if (throttle !== 0) {
      this.playerPosition.add(this.forwardVector().multiplyScalar(step * throttle));
    }

    this.applyWorldBoundary(0.08);
    this.currentTerrain = sampleTerrain(this.playerPosition);
    this.currentRideHeight = this.currentTerrain.height;
    this.targetPosition.copy(this.playerPosition);
    this.player.position.set(this.playerPosition.x, this.playerPosition.y + this.currentRideHeight, this.playerPosition.z);
    const travel = this.playerPosition.clone().sub(previousPosition);
    if (travel.lengthSq() > 0.0001 || direction === "left" || direction === "right") {
      this.playerVelocity.copy(travel).divideScalar(0.08);
      for (const wheel of this.wheelParts) {
        wheel.mesh.rotation.x += travel.length() * 3.8;
      }
    }
    this.recordDriveTelemetry(
      travel,
      0.08,
      previousRotationY,
      true,
      direction === "up" ? 1 : direction === "down" ? -1 : 0,
      direction === "right" ? 1 : direction === "left" ? -1 : 0
    );
    this.emitTrail(previousPosition, travel);
    this.updateTrail(0.08);
    this.updateActiveZone();
    this.updateMiniMap();
    this.updateCamera(0.08);
    if (qaMode) {
      this.syncQaSnapshot();
    }
  }

  private handleCanvasPointer(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const intersects = this.raycaster.intersectObjects([...this.zoneMeshes.values()], true);
    const zoneId = intersects.find((item) => typeof item.object.userData.zoneId === "string")?.object.userData.zoneId;
    const zone = zones.find((item) => item.id === zoneId);

    if (zone) {
      this.moveToZone(zone);
    }
  }

  private moveToZone(zone: StudioZone) {
    if (this.qaSnapshot.lastInputMode === "none") {
      this.qaSnapshot.lastInputMode = "programmatic";
    }
    this.playerVelocity.set(0, 0, 0);
    this.lastDriveSpeed = 0;
    this.lastDriveAcceleration = 0;
    this.lastDriveTurnRate = 0;
    this.targetPosition.set(zone.position[0], 0.28, zone.position[1]);
    this.playerPosition.copy(this.targetPosition);
    this.currentTerrain = sampleTerrain(this.playerPosition);
    this.currentRideHeight = this.currentTerrain.height;
    this.player.position.set(this.playerPosition.x, this.playerPosition.y + this.currentRideHeight, this.playerPosition.z);
    this.updateMiniMap();
    this.updatePanel(zone);
  }

  private resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;
    const frustum = aspect > 1 ? 12.5 : 15.5;

    this.camera.left = (-frustum * aspect) / 2;
    this.camera.right = (frustum * aspect) / 2;
    this.camera.top = frustum / 2;
    this.camera.bottom = -frustum / 2;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(width, height);
    if (qaMode) {
      this.syncQaSnapshot();
    }
  }

  private animate = () => {
    this.frameId = window.requestAnimationFrame(this.animate);
    const now = performance.now();
    const rawDeltaMs = now - this.lastFrameTime;
    const delta = Math.min(rawDeltaMs / 1000, qaMode ? 0.18 : 0.05);
    this.elapsedTime += delta;
    this.lastFrameTime = now;
    this.frameCount += 1;
    this.frameDeltas.push(rawDeltaMs);
    if (this.frameDeltas.length > 90) {
      this.frameDeltas.shift();
    }

    this.updatePlayer(delta);
    this.updateAudio(delta);
    this.updateActiveZone();
    this.updateWorldMotion(delta);
    this.updateActivationFeedback(delta);
    this.updateLightingPools(delta);
    this.updateWorldSceneryMotion(delta);
    this.updateRouteGuidanceMotion(delta);
    this.updateRouteEncounterFeedback(delta);
    this.updateCamera(delta);
    this.updateMiniMap();
    this.renderer.render(this.scene, this.camera);
    const shouldSyncQa = qaMode && (!this.qaSnapshot.ready || now - this.lastQaSyncTime > 250);
    this.markReady();
    if (shouldSyncQa) {
      this.syncQaSnapshot({ full: false });
    }
  };

  private updateAudio(_delta: number) {
    if (
      !this.audioInitialized ||
      !this.audioContext ||
      !this.engineOscillator ||
      !this.engineGain ||
      !this.driftOscillator ||
      !this.driftGain ||
      !this.ambienceOscillator ||
      !this.ambienceGain ||
      !this.accelerationOscillator ||
      !this.accelerationGain ||
      !this.waterOscillator ||
      !this.waterGain ||
      !this.rampOscillator ||
      !this.rampGain ||
      !this.brakeOscillator ||
      !this.brakeGain
    ) {
      return;
    }

    const now = this.audioContext.currentTime;
    const speedRatio = clamp(this.lastDriveSpeed / playerMaxForwardSpeed, 0, 1);
    const driftRatio = clamp(Math.abs(this.currentLateralSpeed) / 3.2 + this.currentDriftAngle * 0.32, 0, 1);
    const throttleEnergy = Math.abs(this.currentThrottleInput);
    const accelerationRatio = clamp(this.lastDriveAcceleration / 14, 0, 1);
    const brakeRatio =
      this.currentThrottleInput < 0 && this.currentForwardSpeed > 0.35
        ? clamp(this.currentForwardSpeed / playerMaxForwardSpeed + this.lastDriveAcceleration / 70, 0, 1)
        : 0;
    const waterRatio =
      this.currentWorldMaterial.kind === "water"
        ? clamp(this.currentWorldMaterial.intensity * 0.9 + speedRatio * 0.28, 0, 1)
        : 0;
    const rampRatio =
      this.currentWorldMaterial.kind === "ramp"
        ? clamp(this.currentWorldMaterial.intensity * 0.78 + Math.abs(this.currentRideHeight) * 3.4 + speedRatio * 0.18, 0, 1)
        : 0;
    const targetFrequency = 62 + speedRatio * 145 + throttleEnergy * 18;
    const targetSurfaceFrequency = 86 + waterRatio * 46 + rampRatio * 118;
    const targetEngineGain = this.audioMuted ? 0 : 0.045 + speedRatio * 0.13 + throttleEnergy * 0.025;
    const targetDriftGain = this.audioMuted ? 0 : driftRatio * 0.095;
    const targetAmbienceGain = this.audioMuted ? 0 : 0.032;
    const targetAccelerationGain = this.audioMuted ? 0 : throttleEnergy * (0.012 + accelerationRatio * 0.058);
    const targetWaterGain = this.audioMuted ? 0 : waterRatio * 0.078;
    const targetRampGain = this.audioMuted ? 0 : rampRatio * 0.058;
    const targetBrakeGain = this.audioMuted ? 0 : brakeRatio * 0.074;

    this.engineOscillator.frequency.setTargetAtTime(targetFrequency, now, 0.07);
    this.engineGain.gain.setTargetAtTime(targetEngineGain, now, 0.08);
    this.driftOscillator.frequency.setTargetAtTime(190 + driftRatio * 330, now, 0.05);
    this.driftGain.gain.setTargetAtTime(targetDriftGain, now, 0.06);
    this.ambienceOscillator.frequency.setTargetAtTime(42 + speedRatio * 18, now, 0.4);
    this.ambienceGain.gain.setTargetAtTime(targetAmbienceGain, now, 0.2);
    this.accelerationOscillator.frequency.setTargetAtTime(280 + accelerationRatio * 420 + speedRatio * 80, now, 0.04);
    this.accelerationGain.gain.setTargetAtTime(targetAccelerationGain, now, 0.05);
    this.waterOscillator.frequency.setTargetAtTime(targetSurfaceFrequency, now, 0.12);
    this.waterGain.gain.setTargetAtTime(targetWaterGain, now, 0.09);
    this.rampOscillator.frequency.setTargetAtTime(targetSurfaceFrequency + 54, now, 0.06);
    this.rampGain.gain.setTargetAtTime(targetRampGain, now, 0.05);
    this.brakeOscillator.frequency.setTargetAtTime(150 + brakeRatio * 210, now, 0.05);
    this.brakeGain.gain.setTargetAtTime(targetBrakeGain, now, 0.04);

    this.currentEngineFrequency = targetFrequency;
    this.currentSurfaceFrequency = targetSurfaceFrequency;
    this.currentEngineGain = targetEngineGain;
    this.currentDriftGain = targetDriftGain;
    this.currentAmbienceGain = targetAmbienceGain;
    this.currentAccelerationGain = targetAccelerationGain;
    this.currentWaterGain = targetWaterGain;
    this.currentRampGain = targetRampGain;
    this.currentBrakeGain = targetBrakeGain;
  }

  private updatePlayer(delta: number) {
    const throttle = (this.keys.has("up") ? 1 : 0) - (this.keys.has("down") ? 1 : 0);
    const turn = (this.keys.has("right") ? 1 : 0) - (this.keys.has("left") ? 1 : 0);

    const previousPosition = this.playerPosition.clone();
    const previousRotationY = this.player.rotation.y;
    let guidedMove = false;
    const hasManualInput = throttle !== 0 || turn !== 0;
    const routeSurfaceBefore = sampleDriveSurface(this.playerPosition);
    const materialBefore = sampleWorldMaterial(this.playerPosition, routeSurfaceBefore.onRoute);

    if (hasManualInput || this.playerVelocity.lengthSq() > 0.0001) {
      const forward = this.forwardVector();
      const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
      let forwardSpeed = this.playerVelocity.dot(forward);
      let lateralSpeed = this.playerVelocity.dot(right);

      if (throttle > 0) {
        forwardSpeed += playerAcceleration * materialBefore.accelerationMultiplier * delta;
      } else if (throttle < 0) {
        const braking =
          forwardSpeed > 0.25
            ? playerBrakeAcceleration * materialBefore.accelerationMultiplier
            : playerAcceleration * materialBefore.accelerationMultiplier * 0.72;
        forwardSpeed -= braking * delta;
      }

      forwardSpeed = clamp(
        forwardSpeed,
        -playerMaxReverseSpeed * materialBefore.speedMultiplier,
        playerMaxForwardSpeed * materialBefore.speedMultiplier
      );

      const speedForSteering = Math.abs(forwardSpeed) + Math.abs(lateralSpeed) * 0.35;
      const steerAuthority = clamp(speedForSteering / playerSteerReferenceSpeed, 0, 1);
      if (turn !== 0 && steerAuthority > 0.02) {
        const reverseSteer = forwardSpeed < -0.2 ? -0.68 : 1;
        const slipBoost = clamp(Math.abs(lateralSpeed) / Math.max(1, Math.abs(forwardSpeed)), 0, 1) * 0.26;
        this.player.rotation.y += turn * playerTurnSpeed * steerAuthority * reverseSteer * (1 + slipBoost) * delta;
        this.normalizePlayerRotation();
      }

      const grip =
        turn !== 0 && Math.abs(forwardSpeed) > 1.1
          ? playerDriftGrip * materialBefore.driftGripMultiplier
          : playerLateralGrip * materialBefore.lateralGripMultiplier;
      lateralSpeed *= Math.exp(-grip * delta);
      if (turn !== 0 && Math.abs(forwardSpeed) > 2.2) {
        const surfaceSlip = materialBefore.kind === "water" ? 1.08 : materialBefore.kind === "field" ? 0.94 : 0.88;
        lateralSpeed += turn * Math.abs(forwardSpeed) * surfaceSlip * delta;
      }
      const lateralLimit =
        materialBefore.kind === "water" ? 1.18 : materialBefore.kind === "field" ? 1.08 : 1;
      lateralSpeed = clamp(lateralSpeed, -lateralLimit, lateralLimit);

      const rollingDrag = Math.exp(-playerRollingDrag * materialBefore.dragMultiplier * delta);
      if (throttle === 0) {
        forwardSpeed *= rollingDrag;
      }
      if (Math.abs(forwardSpeed) < 0.025) {
        forwardSpeed = 0;
      }
      if (Math.abs(lateralSpeed) < 0.025) {
        lateralSpeed = 0;
      }

      this.playerVelocity.copy(forward.multiplyScalar(forwardSpeed).add(right.multiplyScalar(lateralSpeed)));
      this.playerPosition.add(this.playerVelocity.clone().multiplyScalar(delta));
      this.targetPosition.copy(this.playerPosition);
    } else if (this.playerPosition.distanceToSquared(this.targetPosition) > 0.04) {
      guidedMove = true;
      this.playerVelocity.multiplyScalar(0.35);
      this.playerPosition.lerp(this.targetPosition, 1 - Math.pow(0.0008, delta));
      if (this.playerPosition.distanceToSquared(this.targetPosition) <= 0.04) {
        this.playerPosition.copy(this.targetPosition);
      }
    }

    this.applyWorldBoundary(delta);
    if (!guidedMove || this.playerPosition.distanceToSquared(this.targetPosition) <= 0.04) {
      this.targetPosition.copy(this.playerPosition);
    }

    const travel = this.playerPosition.clone().sub(previousPosition);
    if (!guidedMove) {
      this.recordHardStopAwayFromEdge(travel, hasManualInput, throttle, turn);
    }
    const routeSurfaceAfter = sampleDriveSurface(this.playerPosition);
    const materialAfter = sampleWorldMaterial(this.playerPosition, routeSurfaceAfter.onRoute);
    const terrainAfter = sampleTerrain(this.playerPosition);
    this.currentWorldMaterial = materialAfter;
    this.currentTerrain = terrainAfter;
    const poseForward = this.forwardVector();
    const poseRight = new THREE.Vector3(poseForward.z, 0, -poseForward.x).normalize();
    this.currentForwardSpeed = this.playerVelocity.dot(poseForward);
    this.currentLateralSpeed = this.playerVelocity.dot(poseRight);
    const currentSpeed = this.playerVelocity.length();
    this.currentDriftAngle =
      currentSpeed > 0.01
        ? Math.atan2(Math.abs(this.currentLateralSpeed), Math.max(0.001, Math.abs(this.currentForwardSpeed)))
        : 0;
    this.currentSteeringInput = turn;
    this.currentThrottleInput = throttle;
    this.updateRidePose(materialAfter, terrainAfter, delta);
    this.updateVehicleVisualDynamics(delta, turn, throttle, travel);
    this.player.position.set(this.playerPosition.x, this.playerPosition.y + this.currentRideHeight, this.playerPosition.z);
    this.player.rotation.x = this.currentRidePitch;
    this.player.rotation.z = this.currentRideRoll;
    if (!guidedMove) {
      this.emitTrail(previousPosition, travel);
    }

    if (!guidedMove) {
      this.recordDriveTelemetry(travel, delta, previousRotationY, hasManualInput, throttle, turn, materialAfter, terrainAfter);
    }
    this.updateTrail(delta);
    this.updateSurfaceFx(delta);
  }

  private forwardVector() {
    return new THREE.Vector3(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y)).normalize();
  }

  private updateVehicleVisualDynamics(delta: number, steeringInput: number, throttleInput: number, travel: THREE.Vector3) {
    const smoothing = 1 - Math.pow(0.0005, delta);
    const speedForSteering = Math.abs(this.currentForwardSpeed) + Math.abs(this.currentLateralSpeed) * 0.35;
    const steerAuthority = clamp(speedForSteering / playerSteerReferenceSpeed, 0, 1);
    const counterSteer = clamp(this.currentLateralSpeed / 2.8, -0.18, 0.18);
    const targetWheelSteer =
      speedForSteering > 0.18 ? clamp(steeringInput * steerAuthority * 0.44 - counterSteer * 0.42, -0.5, 0.5) : 0;
    this.currentFrontWheelSteer += (targetWheelSteer - this.currentFrontWheelSteer) * smoothing;
    this.peakFrontWheelSteer = Math.max(this.peakFrontWheelSteer, Math.abs(this.currentFrontWheelSteer));
    if (Math.abs(this.currentFrontWheelSteer) > 0.035) {
      this.visualSteeringSamples += 1;
    }

    const travelDistance = travel.length();
    if (travelDistance > 0.0001) {
      const spinDirection = this.currentForwardSpeed < -0.08 ? -1 : 1;
      for (const wheel of this.wheelParts) {
        wheel.mesh.rotation.x += travelDistance * 3.8 * spinDirection;
      }
    }
    for (const wheel of this.wheelParts) {
      wheel.mesh.rotation.y = wheel.front ? this.currentFrontWheelSteer : -this.currentFrontWheelSteer * 0.07;
    }

    const driftIntensity = clamp(Math.abs(this.currentLateralSpeed) / 1.05 + this.currentDriftAngle * 0.82, 0, 1);
    const brakeIntent = throttleInput < 0 && this.currentForwardSpeed > 0.35;
    const brakeIntensity = brakeIntent ? clamp(this.currentForwardSpeed / playerMaxForwardSpeed + this.lastDriveAcceleration / 70, 0, 1) : 0;
    this.currentSkidIntensity = Math.max(driftIntensity, brakeIntensity * 0.88);
    this.maxSkidIntensity = Math.max(this.maxSkidIntensity, this.currentSkidIntensity);
    if (driftIntensity > 0.18) {
      this.driftFxSamples += 1;
    }
    if (brakeIntensity > 0.12) {
      this.brakeFxSamples += 1;
    }
    this.peakChassisRoll = Math.max(this.peakChassisRoll, Math.abs(this.currentRideRoll));
  }

  private updateRidePose(material: WorldMaterialSample, terrain: TerrainSample, delta: number) {
    const smoothing = 1 - Math.pow(0.0008, delta);
    const speedLean = clamp(this.currentLateralSpeed / 6, -0.22, 0.22);
    const throttleLean = clamp(this.currentForwardSpeed / playerMaxForwardSpeed, -0.18, 0.18);
    const driftLean = clamp(this.currentLateralSpeed * 0.045 + Math.sign(this.currentLateralSpeed) * this.currentDriftAngle * 0.055, -0.18, 0.18);
    const brakeDive =
      this.currentThrottleInput < 0 && this.currentForwardSpeed > 0.4
        ? clamp(this.currentForwardSpeed / playerMaxForwardSpeed, 0, 1) * 0.12
        : 0;
    const forward = this.forwardVector();
    const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
    const normalY = Math.max(0.2, terrain.normal.y);
    const gradient = new THREE.Vector3(-terrain.normal.x / normalY, 0, -terrain.normal.z / normalY);
    const terrainPitch = clamp(-gradient.dot(forward) * 0.68, -0.24, 0.24);
    const terrainRoll = clamp(gradient.dot(right) * 0.62, -0.24, 0.24);
    const targetRideHeight = material.rideHeight + terrain.height;
    this.currentRideHeight += (targetRideHeight - this.currentRideHeight) * smoothing;
    this.currentRidePitch += (material.pitch + terrainPitch - throttleLean * 0.08 + brakeDive - this.currentRidePitch) * smoothing;
    this.currentRideRoll += (material.roll + terrainRoll - speedLean * 0.16 - driftLean - this.currentRideRoll) * smoothing;
  }

  private normalizePlayerRotation() {
    this.player.rotation.y = angleDelta(0, this.player.rotation.y);
  }

  private applyWorldBoundary(_delta: number) {
    const beforeX = this.playerPosition.x;
    const beforeZ = this.playerPosition.z;
    const impactSpeed = this.playerVelocity.length();
    this.playerPosition.x = clamp(this.playerPosition.x, -worldHalfExtent, worldHalfExtent);
    this.playerPosition.z = clamp(this.playerPosition.z, -worldHalfExtent, worldHalfExtent);
    const xClamped = this.playerPosition.x !== beforeX;
    const zClamped = this.playerPosition.z !== beforeZ;
    this.boundaryDistanceToEdge = worldHalfExtent - Math.max(Math.abs(this.playerPosition.x), Math.abs(this.playerPosition.z));
    this.minBoundaryDistanceToEdge = Math.min(this.minBoundaryDistanceToEdge, this.boundaryDistanceToEdge);

    if (xClamped || zClamped) {
      this.boundaryContactCount += 1;
      const axes: string[] = [];
      if (xClamped) {
        axes.push(this.playerPosition.x < 0 ? "x-min" : "x-max");
      }
      if (zClamped) {
        axes.push(this.playerPosition.z < 0 ? "z-min" : "z-max");
      }
      this.lastBoundaryContactAxis = axes.join("+");
      this.lastBoundaryContactSpeed = impactSpeed;
      for (const axis of axes) {
        this.boundaryContactAxes[axis] = (this.boundaryContactAxes[axis] ?? 0) + 1;
      }
    }

    if (this.playerPosition.x !== beforeX && Math.sign(this.playerVelocity.x) === Math.sign(beforeX - this.playerPosition.x)) {
      this.playerVelocity.x *= -0.18;
    }
    if (this.playerPosition.z !== beforeZ && Math.sign(this.playerVelocity.z) === Math.sign(beforeZ - this.playerPosition.z)) {
      this.playerVelocity.z *= -0.18;
    }
  }

  private recordHardStopAwayFromEdge(
    travel: THREE.Vector3,
    hasManualInput: boolean,
    throttleInput: number,
    steeringInput: number
  ) {
    const hardStopCandidate =
      hasManualInput &&
      Math.abs(throttleInput) > 0 &&
      Math.abs(steeringInput) < 0.35 &&
      this.driveMovingSamples > 8 &&
      this.peakDriveSpeed > 1.5 &&
      travel.length() < 0.006 &&
      this.playerVelocity.length() < 0.08 &&
      this.boundaryDistanceToEdge > 1.2;

    if (hardStopCandidate) {
      this.hardStopAwayFromEdgeStreak += 1;
    } else {
      this.hardStopAwayFromEdgeStreak = 0;
    }

    if (this.hardStopAwayFromEdgeStreak === 8) {
      this.hardStopAwayFromEdgeCount += 1;
    }
  }

  private recordDriveTelemetry(
    travel: THREE.Vector3,
    delta: number,
    previousRotationY: number,
    hasInput = false,
    throttleInput = 0,
    steeringInput = 0,
    material: WorldMaterialSample = this.currentWorldMaterial,
    terrain: TerrainSample = this.currentTerrain
  ) {
    const distance = travel.length();
    if (distance <= 0.001) {
      return;
    }

    const forward = this.forwardVector();
    const right = new THREE.Vector3(forward.z, 0, -forward.x).normalize();
    const speed = this.playerVelocity.length();
    const forwardSpeed = this.playerVelocity.dot(forward);
    const lateralSpeed = this.playerVelocity.dot(right);
    const driftAngle = speed > 0.01 ? Math.atan2(Math.abs(lateralSpeed), Math.max(0.001, Math.abs(forwardSpeed))) : 0;
    const surface = sampleDriveSurface(this.playerPosition);
    const acceleration = delta > 0 ? Math.abs(speed - this.lastDriveSpeed) / delta : 0;
    const turnDelta = Math.abs(angleDelta(previousRotationY, this.player.rotation.y));
    this.currentForwardSpeed = forwardSpeed;
    this.currentLateralSpeed = lateralSpeed;
    this.currentDriftAngle = driftAngle;
    this.currentSteeringInput = steeringInput;
    this.currentThrottleInput = throttleInput;
    this.totalDriveDistance += distance;
    this.driveElapsedTime += delta;
    this.totalRotationChange += turnDelta;
    this.lastDriveSpeed = speed;
    this.peakDriveSpeed = Math.max(this.peakDriveSpeed, speed);
    this.lastDriveAcceleration = acceleration;
    this.peakDriveAcceleration = Math.max(this.peakDriveAcceleration, acceleration);
    this.totalDriveAcceleration += acceleration;
    this.driveDynamicsSamples += 1;
    this.driveMovingSamples += speed > 0.2 ? 1 : 0;
    this.driveInputSamples += hasInput ? 1 : 0;
    this.driveCoastingSamples += !hasInput && speed > 0.2 ? 1 : 0;
    this.driveOffRouteSamples += surface.onRoute ? 0 : 1;
    if (material.kind !== this.lastMaterialKind) {
      this.materialTransitionCount += 1;
      this.lastMaterialKind = material.kind;
    }
    if (material.kind === "water") {
      this.waterMaterialSamples += 1;
      this.maxWaterIntensity = Math.max(this.maxWaterIntensity, material.intensity);
    } else if (material.kind === "ramp") {
      this.rampMaterialSamples += 1;
      this.maxRampRideHeight = Math.max(this.maxRampRideHeight, material.rideHeight);
    } else if (material.kind === "field") {
      this.fieldMaterialSamples += 1;
    } else {
      this.roadMaterialSamples += 1;
    }
    this.terrainSamples += 1;
    this.minSampledTerrainHeight = Math.min(this.minSampledTerrainHeight, terrain.height);
    this.maxSampledTerrainHeight = Math.max(this.maxSampledTerrainHeight, terrain.height);
    this.maxSampledTerrainGrade = Math.max(this.maxSampledTerrainGrade, terrain.grade);
    this.lastDriveTurnRate = delta > 0 ? turnDelta / delta : 0;
    this.peakDriveTurnRate = Math.max(this.peakDriveTurnRate, this.lastDriveTurnRate);
    this.totalDriveTurnRate += this.lastDriveTurnRate;
    this.driveTurnSamples += this.lastDriveTurnRate > 0.001 ? 1 : 0;
    this.drivePhysicsSamples.push({
      frame: this.frameCount,
      tMs: Number((this.elapsedTime * 1000).toFixed(1)),
      x: Number(this.playerPosition.x.toFixed(3)),
      z: Number(this.playerPosition.z.toFixed(3)),
      rotationY: Number(this.player.rotation.y.toFixed(3)),
      velocityX: Number(this.playerVelocity.x.toFixed(3)),
      velocityZ: Number(this.playerVelocity.z.toFixed(3)),
      speed: Number(speed.toFixed(3)),
      acceleration: Number(acceleration.toFixed(3)),
      turnRate: Number(this.lastDriveTurnRate.toFixed(3)),
      forwardSpeed: Number(forwardSpeed.toFixed(3)),
      lateralSpeed: Number(lateralSpeed.toFixed(3)),
      driftAngle: Number(driftAngle.toFixed(3)),
      steeringInput,
      throttleInput,
      onRoute: surface.onRoute,
      routeDistance: surface.distance,
      boundaryDistance: Number(this.boundaryDistanceToEdge.toFixed(3)),
      materialKind: material.kind,
      materialId: material.id,
      materialIntensity: material.intensity,
      rideHeight: Number(this.currentRideHeight.toFixed(3)),
      pitch: Number(this.currentRidePitch.toFixed(3)),
      roll: Number(this.currentRideRoll.toFixed(3)),
      terrainHeight: terrain.height,
      terrainGrade: terrain.grade,
      terrainNormalY: terrain.normal.y,
      terrainFeatureId: terrain.dominantFeatureId,
      terrainGroundDelta: Number((this.player.position.y - terrain.height).toFixed(3)),
      hasInput
    });
    if (this.drivePhysicsSamples.length > 720) {
      this.drivePhysicsSamples.shift();
    }
    this.driveSurfaceTelemetry = recordDriveSurfaceSample(this.driveSurfaceTelemetry, surface);
    this.drivePositionSamples.push({
      frame: this.frameCount,
      x: Number(this.playerPosition.x.toFixed(3)),
      z: Number(this.playerPosition.z.toFixed(3))
    });
    if (this.drivePositionSamples.length > 80) {
      this.drivePositionSamples.shift();
    }
    this.surfaceFxDistance += distance;
    if ((material.kind === "water" || material.kind === "ramp") && this.surfaceFxDistance >= 0.36) {
      this.surfaceFxDistance = 0;
      this.emitSurfaceFx(this.playerPosition, material, speed);
    }
  }

  private emitTrail(previousPosition: THREE.Vector3, travel: THREE.Vector3) {
    const distance = travel.length();
    if (distance <= 0.001) {
      return;
    }

    this.trailDistance += distance;
    const brakeIntent = this.currentThrottleInput < 0 && this.currentForwardSpeed > 0.35;
    const driftIntensity = clamp(Math.abs(this.currentLateralSpeed) / 1.05 + this.currentDriftAngle * 0.82, 0, 1);
    const brakeIntensity = brakeIntent ? clamp(this.currentForwardSpeed / playerMaxForwardSpeed + this.lastDriveAcceleration / 70, 0, 1) : 0;
    const markKind: TrailMarkKind = brakeIntensity > 0.16 ? "brake" : driftIntensity > 0.2 ? "drift" : "roll";
    const interval = markKind === "roll" ? 0.26 : 0.14;
    if (this.trailDistance < interval) {
      return;
    }
    this.trailDistance = 0;

    const activeZone = zones.find((zone) => zone.id === this.activeZoneId) ?? defaultZone;
    const mark = this.trailMarks[this.trailCursor];
    this.trailCursor = (this.trailCursor + 1) % this.trailMarks.length;
    mark.age = 0;
    mark.kind = markKind;
    mark.maxAge = markKind === "roll" ? 12 : markKind === "drift" ? 9.5 : 7;
    mark.baseOpacity = markKind === "roll" ? 0.38 : markKind === "drift" ? 0.5 : 0.46;
    mark.mesh.visible = true;
    mark.mesh.position.set(previousPosition.x, 0.04, previousPosition.z);
    mark.mesh.rotation.z = this.player.rotation.y + clamp(this.currentLateralSpeed * 0.08, -0.18, 0.18);
    const skidWidth = markKind === "drift" ? 0.42 + driftIntensity * 0.42 : markKind === "brake" ? 0.3 + brakeIntensity * 0.2 : 0.28;
    const skidLength = markKind === "roll" ? 0.64 + Math.min(distance, 0.8) * 0.5 : 0.72 + this.currentSkidIntensity * 0.62;
    mark.mesh.scale.set(skidWidth, skidLength, 1);
    mark.mesh.material.color.setHex(markKind === "brake" ? 0xffb35c : markKind === "drift" ? colors.studio : colors[activeZone.kind]);
    mark.mesh.material.opacity = mark.baseOpacity;
    if (markKind === "drift") {
      this.driftTrailMarks += 1;
    } else if (markKind === "brake") {
      this.brakeTrailMarks += 1;
    }
  }

  private emitSurfaceFx(position: THREE.Vector3, material: WorldMaterialSample, speed: number) {
    if (material.kind !== "water" && material.kind !== "ramp") {
      return;
    }
    const sequenceIndex = this.emittedSurfaceFxMarks;
    const mark = this.surfaceFxMarks[sequenceIndex % this.surfaceFxMarks.length];
    this.emittedSurfaceFxMarks += 1;
    const profile = material.kind === "water"
      ? ([
          "water-ripple",
          material.intensity >= 0.32 ? "water-foam" : "water-ripple",
          speed >= 3.4 || material.id === "studio-canal" ? "water-wake" : "water-ripple"
        ] as const)[sequenceIndex % 3]
      : ([
          "ramp-skid",
          material.rideHeight >= 0.08 ? "ramp-chevron" : "ramp-skid",
          speed >= 3.2 || Math.abs(this.currentLateralSpeed) >= 0.42 ? "ramp-spark" : "ramp-skid"
        ] as const)[sequenceIndex % 3];
    const profileSpec = surfaceFxProfiles[profile];
    const lateralSign = this.currentLateralSpeed >= 0 ? 1 : -1;
    const speedStretch = material.kind === "water" ? clamp(speed / 9, 0, 0.42) : clamp(speed / 11, 0, 0.34);
    const intensityStretch = clamp(material.intensity * 0.22 + material.rideHeight * 0.6, 0, 0.32);
    mark.age = 0;
    mark.maxAge = profileSpec.maxAge;
    mark.kind = material.kind;
    mark.profile = profile;
    mark.position.set(position.x, material.kind === "water" ? 0.082 : 0.14 + material.rideHeight, position.z);
    mark.rotationZ = this.player.rotation.y + (sequenceIndex % 2 === 0 ? 0.08 : -0.08) * lateralSign;
    mark.scale = material.kind === "water" ? 0.68 + material.intensity * 0.42 : 0.38 + speed * 0.032;
    mark.widthScale = profileSpec.widthScale + intensityStretch;
    mark.lengthScale = profileSpec.lengthScale + speedStretch;
    mark.color = profileSpec.color;
    mark.liftSpeed = profileSpec.liftSpeed;
    mark.spinSpeed = profileSpec.spinSpeed * lateralSign;
    mark.signature = `surface-fx:${material.id}:${profile}`;
    mark.baseOpacity = clamp(profileSpec.baseOpacity + material.intensity * 0.1 + speed * 0.006, 0.24, 0.5);
    mark.opacity = mark.baseOpacity;
    this.surfaceFxProfileCounts[profile] = (this.surfaceFxProfileCounts[profile] ?? 0) + 1;
    this.surfaceFxSignatures.add(mark.signature);
    this.surfaceFxColorVariants.add(mark.color);
    this.maxSurfaceFxScaleVariance = Math.max(this.maxSurfaceFxScaleVariance, Math.abs(mark.widthScale - mark.lengthScale));
  }

  private updateTrail(delta: number) {
    for (const mark of this.trailMarks) {
      if (!mark.mesh.visible) {
        continue;
      }
      mark.age += delta;
      const life = clamp(1 - mark.age / mark.maxAge, 0, 1);
      mark.mesh.material.opacity = life * mark.baseOpacity;
      const growth = mark.kind === "roll" ? 0.08 : 0.035;
      mark.mesh.scale.multiplyScalar(1 + delta * growth);
      if (life <= 0.02) {
        mark.mesh.visible = false;
      }
    }
  }

  private updateSurfaceFx(delta: number) {
    let dirty = false;
    for (const mark of this.surfaceFxMarks) {
      if (mark.opacity <= 0.02) {
        continue;
      }
      dirty = true;
      mark.age += delta;
      const life = clamp(1 - mark.age / mark.maxAge, 0, 1);
      mark.opacity = life * mark.baseOpacity;
      mark.scale *= 1 + delta * (mark.kind === "water" ? 0.95 : 0.58);
      mark.position.y += delta * mark.liftSpeed;
      if (life <= 0.02) {
        mark.kind = "field";
        mark.opacity = 0;
      }
    }
    if (dirty) {
      this.writeSurfaceFxInstances();
    }
  }

  private updateWorldMotion(delta: number) {
    if (motionQuery.matches) {
      return;
    }

    for (const zone of zones) {
      const mesh = this.zoneMeshes.get(zone.id);
      if (!mesh) {
        continue;
      }
      const active = zone.id === this.activeZoneId;
      const spec = zoneVisualSpecs[zone.id];
      const animation = spec?.animation ?? { idleSpin: 0.12, activeSpin: 0.45, activeScale: 1.12, pulse: 0.1 };
      mesh.rotation.y += delta * (active ? animation.activeSpin * 0.08 : animation.idleSpin * 0.04);
      const targetScale = active ? animation.activeScale : 1;
      mesh.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 1 - Math.pow(0.002, delta));
      mesh.userData.appliedAnimation = animation;
      this.updateZoneMotionRoles(zone.id, animation.pulse, active, delta);
    }
  }

  private updateZoneMotionRoles(zoneId: string, pulse: number, active: boolean, delta: number) {
    const objects = this.zoneMotionObjects.get(zoneId) ?? [];
    const amplitude = active ? pulse : pulse * 0.28;
    objects.forEach((object, index) => {
      const role = object.userData.motionRole;
      const baseY = typeof object.userData.motionBaseY === "number" ? object.userData.motionBaseY : object.position.y;
      const baseX = typeof object.userData.motionBaseX === "number" ? object.userData.motionBaseX : object.position.x;
      const baseZ = typeof object.userData.motionBaseZ === "number" ? object.userData.motionBaseZ : object.position.z;
      const baseRotationX =
        typeof object.userData.motionBaseRotationX === "number" ? object.userData.motionBaseRotationX : object.rotation.x;
      const baseRotationY =
        typeof object.userData.motionBaseRotationY === "number" ? object.userData.motionBaseRotationY : object.rotation.y;
      const baseRotationZ =
        typeof object.userData.motionBaseRotationZ === "number" ? object.userData.motionBaseRotationZ : object.rotation.z;
      const phase = this.elapsedTime * (1.6 + (index % 5) * 0.08) + index * 0.7;
      const behavior = object.userData.localMotionBehavior;
      if (behavior === "sweep") {
        object.rotation.y += (active ? 1.25 : 0.42) * delta;
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.06;
      } else if (behavior === "pulse") {
        const pulseScale = 1 + Math.sin(phase) * amplitude * (active ? 0.16 : 0.05);
        object.scale.setScalar(Math.max(0.82, pulseScale));
        object.position.y = baseY + Math.sin(phase * 0.8) * amplitude * 0.05;
      } else if (behavior === "tilt") {
        object.rotation.x = baseRotationX + Math.sin(phase) * amplitude * 0.42;
        object.rotation.y = baseRotationY + Math.cos(phase * 0.7) * amplitude * 0.28;
        object.rotation.z = baseRotationZ + Math.sin(phase * 0.9) * amplitude * 0.18;
      } else if (behavior === "float") {
        object.position.x = baseX + Math.cos(phase * 0.7) * amplitude * 0.1;
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.2;
        object.position.z = baseZ + Math.sin(phase * 0.55) * amplitude * 0.1;
      } else if (behavior === "blink") {
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.08;
        object.rotation.y = baseRotationY + Math.sin(phase * 0.75) * amplitude * 0.28;
      } else if (role === "surface-detail") {
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.03;
      } else if (role === "cluster") {
        object.rotation.y += (active ? 0.72 : 0.24) * delta * (1 + (index % 2) * 0.4);
      } else {
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.16;
        object.rotation.y += (active ? 1.08 : 0.36) * delta;
      }
    });
  }

  private updateWorldSceneryMotion(delta: number) {
    if (motionQuery.matches) {
      return;
    }

    this.worldSceneryMotionObjects.forEach((object, index) => {
      const baseY = typeof object.userData.motionBaseY === "number" ? object.userData.motionBaseY : object.position.y;
      const baseX = typeof object.userData.motionBaseX === "number" ? object.userData.motionBaseX : object.position.x;
      const baseZ = typeof object.userData.motionBaseZ === "number" ? object.userData.motionBaseZ : object.position.z;
      const baseRotationX =
        typeof object.userData.motionBaseRotationX === "number" ? object.userData.motionBaseRotationX : object.rotation.x;
      const baseRotationY =
        typeof object.userData.motionBaseRotationY === "number" ? object.userData.motionBaseRotationY : object.rotation.y;
      const baseRotationZ =
        typeof object.userData.motionBaseRotationZ === "number" ? object.userData.motionBaseRotationZ : object.rotation.z;
      const behavior = object.userData.localMotionBehavior;
      const phase = this.elapsedTime * (0.9 + (index % 6) * 0.07) + index * 0.41;
      const amplitude = 0.12;

      if (behavior === "sweep") {
        object.rotation.y += delta * 0.38;
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.08;
      } else if (behavior === "instance-pulse") {
        const pulse = Math.sin(phase * 1.35) * 0.5 + 0.5;
        object.position.y = baseY + pulse * amplitude * 0.08;
        object.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
            child.material.emissiveIntensity = 0.12 + pulse * 0.14;
          }
        });
      } else if (behavior === "pulse") {
        const pulseScale = 1 + Math.sin(phase * 1.2) * 0.045;
        object.scale.setScalar(pulseScale);
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.06;
      } else if (behavior === "tilt") {
        object.rotation.x = baseRotationX + Math.sin(phase) * amplitude * 0.8;
        object.rotation.z = baseRotationZ + Math.cos(phase * 0.72) * amplitude * 0.46;
      } else if (behavior === "float") {
        object.position.x = baseX + Math.cos(phase * 0.6) * amplitude * 0.3;
        object.position.y = baseY + Math.sin(phase) * amplitude * 0.52;
        object.position.z = baseZ + Math.sin(phase * 0.5) * amplitude * 0.28;
      } else if (behavior === "blink") {
        object.position.y = baseY + Math.sin(phase * 1.4) * amplitude * 0.16;
        object.rotation.y = baseRotationY + Math.sin(phase * 0.9) * amplitude * 0.7;
      } else {
        object.rotation.x = baseRotationX;
        object.rotation.y = baseRotationY;
        object.rotation.z = baseRotationZ;
      }
    });
  }

  private updateRouteGuidanceMotion(delta: number) {
    if (motionQuery.matches) {
      return;
    }

    this.routeGuidanceMotionObjects.forEach((object, index) => {
      const baseY = typeof object.userData.motionBaseY === "number" ? object.userData.motionBaseY : object.position.y;
      const baseRotationY =
        typeof object.userData.motionBaseRotationY === "number" ? object.userData.motionBaseRotationY : object.rotation.y;
      const behavior = object.userData.localMotionBehavior;
      const phase = this.elapsedTime * (1.15 + (index % 5) * 0.08) + index * 0.37;
      if (behavior === "pulse") {
        object.position.y = baseY + Math.sin(phase) * 0.018;
        object.scale.setScalar(1 + Math.sin(phase * 1.2) * 0.035);
      } else if (behavior === "encounter-idle") {
        object.position.y = baseY + Math.sin(phase * 1.1) * 0.02;
      } else {
        object.position.y = baseY + Math.sin(phase * 1.4) * 0.012;
        object.rotation.y = baseRotationY + Math.sin(phase * 0.8) * 0.035 + delta * 0.02;
      }
    });
  }

  private updateRouteEncounterFeedback(delta: number) {
    let nearest: { gate: RouteEncounterGate; distance: number; intensity: number } | null = null;
    let activeCount = 0;
    const phaseBase = motionQuery.matches ? 0 : this.elapsedTime * 2.4;

    for (const gate of this.routeEncounterGates) {
      const distance = Math.hypot(this.playerPosition.x - gate.object.position.x, this.playerPosition.z - gate.object.position.z);
      const intensity = clamp(1 - distance / 1.75, 0, 1);
      const pulse = motionQuery.matches ? 0 : (Math.sin(phaseBase + gate.object.id * 0.17) * 0.5 + 0.5) * 0.05;
      const targetScale = 1 + intensity * 0.22 + pulse;
      const targetY = gate.baseY + (motionQuery.matches ? 0 : Math.sin(phaseBase + gate.object.id * 0.23) * 0.018) + intensity * 0.13;
      const smoothing = 1 - Math.pow(0.0015, delta);

      gate.object.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), smoothing);
      gate.object.position.y += (targetY - gate.object.position.y) * smoothing;
      gate.object.userData.routeEncounterIntensity = Number(intensity.toFixed(3));
      gate.object.userData.routeEncounterDistance = Number(distance.toFixed(3));

      if (gate.object instanceof THREE.Mesh && gate.object.material instanceof THREE.MeshStandardMaterial) {
        gate.object.material.emissiveIntensity = 0.22 + intensity * 0.62 + pulse;
        gate.object.material.opacity = 0.68 + intensity * 0.28;
      }

      if (intensity >= 0.18) {
        activeCount += 1;
        this.visitedRouteEncounterIds.add(gate.id);
      }
      if (!nearest || distance < nearest.distance) {
        nearest = { gate, distance, intensity };
      }
    }

    this.currentRouteEncounterActiveCount = activeCount;
    this.currentRouteEncounterId = nearest?.gate.id ?? null;
    this.currentRouteEncounterRouteId = nearest?.gate.routeId ?? null;
    this.currentRouteEncounterGate = nearest?.gate ?? null;
    this.currentRouteEncounterDistance = Number((nearest?.distance ?? 0).toFixed(3));
    this.currentRouteEncounterIntensity = Number((nearest?.intensity ?? 0).toFixed(3));
    this.maxRouteEncounterIntensity = Math.max(this.maxRouteEncounterIntensity, this.currentRouteEncounterIntensity);
  }

  private updateLightingPools(delta: number) {
    if (!this.activeLightPool || !this.routeLightPool) {
      return;
    }

    const activeZone = zones.find((zone) => zone.id === this.activeZoneId) ?? defaultZone;
    const surface = sampleDriveSurface(this.playerPosition);
    const route = worldRoutes.find((item) => item.id === surface.routeId);
    const activePhase = motionQuery.matches ? 0 : Math.sin(this.elapsedTime * 1.6) * 0.5 + 0.5;
    const routePhase = motionQuery.matches ? 0 : Math.sin(this.elapsedTime * 2.2 + 1.3) * 0.5 + 0.5;
    const activeOpacity = motionQuery.matches ? 0.075 : 0.085 + activePhase * 0.055;
    const routeOpacity = motionQuery.matches ? 0.045 : (surface.onRoute ? 0.065 : 0.035) + routePhase * 0.035;
    const activeScale = activeZone.radius * (1.18 + activePhase * 0.1);
    const routeScale = 0.95 + clamp(1 - surface.distance / 3, 0, 1) * 0.34 + routePhase * 0.07;

    this.currentNearestRouteId = surface.routeId;
    this.activeLightPool.visible = true;
    this.activeLightPool.position.set(activeZone.position[0], 0.056, activeZone.position[1]);
    this.activeLightPool.scale.lerp(new THREE.Vector3(activeScale, activeScale, activeScale), 1 - Math.pow(0.002, delta));
    this.activeLightPool.material.color.setHex(colors[activeZone.kind]);
    this.activeLightPool.material.opacity = activeOpacity;

    this.routeLightPool.visible = Boolean(surface.routeId);
    this.routeLightPool.position.set(surface.nearest.x, 0.058, surface.nearest.z);
    this.routeLightPool.scale.lerp(new THREE.Vector3(routeScale, routeScale, routeScale), 1 - Math.pow(0.004, delta));
    this.routeLightPool.material.color.setHex(colors[route?.kind ?? activeZone.kind]);
    this.routeLightPool.material.opacity = routeOpacity;
  }

  private triggerZoneActivation(zone: StudioZone) {
    const feedback = this.activationFeedbackByZone.get(zone.id);
    if (!feedback) {
      return;
    }

    this.activationSequence += 1;
    this.lastActivationFrame = this.frameCount;
    feedback.age = 0;
    feedback.intensity = motionQuery.matches ? 0.42 : 1;
    feedback.triggerCount += 1;
    feedback.group.visible = true;
    feedback.halo.material.opacity = motionQuery.matches ? 0.12 : 0.28;
    feedback.halo.scale.setScalar(1);

    feedback.rings.forEach((ring, index) => {
      ring.visible = true;
      ring.scale.setScalar(0.9 + index * 0.05);
      ring.material.opacity = motionQuery.matches ? 0.16 : 0.62 - index * 0.1;
    });
    feedback.sparks.forEach((spark, index) => {
      spark.visible = true;
      spark.scale.setScalar(0.92 + (index % 3) * 0.08);
      spark.material.opacity = motionQuery.matches ? 0.14 : 0.48 - (index % 3) * 0.04;
    });

    if (!motionQuery.matches) {
      this.cameraImpulse = Math.max(this.cameraImpulse, 1);
    }
  }

  private updateActivationFeedback(delta: number) {
    this.activationFeedbackByZone.forEach((feedback, zoneId) => {
      const active = zoneId === this.activeZoneId;
      feedback.age += delta;
      const burst = clamp(1 - feedback.age / (motionQuery.matches ? 1.4 : 2.2), 0, 1);
      feedback.intensity = active ? (motionQuery.matches ? 0.2 + burst * 0.22 : 0.22 + burst * 0.78) : 0;
      feedback.group.visible = active || feedback.intensity > 0.02;

      feedback.halo.visible = feedback.group.visible;
      feedback.halo.material.opacity = active ? (motionQuery.matches ? 0.08 + burst * 0.08 : 0.06 + burst * 0.22) : 0;
      feedback.halo.scale.setScalar(1 + burst * (motionQuery.matches ? 0.08 : 0.2));

      feedback.rings.forEach((ring, index) => {
        const phase = this.elapsedTime * (0.9 + index * 0.16);
        const spread = active ? 1 + (1 - burst) * (motionQuery.matches ? 0.12 : 0.34) + index * 0.05 : 1;
        ring.visible = feedback.group.visible;
        ring.rotation.z += delta * (active && !motionQuery.matches ? 0.35 + index * 0.1 : 0.08);
        ring.scale.setScalar(spread + Math.sin(phase) * feedback.intensity * 0.025);
        ring.material.opacity = active
          ? (motionQuery.matches ? 0.1 : 0.12) + burst * (motionQuery.matches ? 0.12 : 0.42) - index * 0.035
          : 0;
      });

      feedback.sparks.forEach((spark, index) => {
        const baseX = typeof spark.userData.motionBaseX === "number" ? spark.userData.motionBaseX : spark.position.x;
        const baseY = typeof spark.userData.motionBaseY === "number" ? spark.userData.motionBaseY : spark.position.y;
        const baseZ = typeof spark.userData.motionBaseZ === "number" ? spark.userData.motionBaseZ : spark.position.z;
        const phase = this.elapsedTime * (1.2 + (index % 4) * 0.11) + index * 0.7;
        spark.visible = feedback.group.visible;
        spark.position.x = baseX + Math.cos(phase) * feedback.intensity * 0.12;
        spark.position.y = baseY + Math.sin(phase * 1.1) * feedback.intensity * (motionQuery.matches ? 0.04 : 0.18);
        spark.position.z = baseZ + Math.sin(phase * 0.7) * feedback.intensity * 0.12;
        spark.scale.setScalar(0.9 + burst * (motionQuery.matches ? 0.08 : 0.42) + (index % 3) * 0.04);
        spark.material.opacity = active ? (motionQuery.matches ? 0.08 : 0.1) + burst * (motionQuery.matches ? 0.1 : 0.34) : 0;
      });

      const landmark = this.landmarkMeshes.get(zoneId);
      if (landmark) {
        const landmarkPulse = active && !motionQuery.matches ? 1 + burst * 0.14 : 1;
        landmark.scale.lerp(new THREE.Vector3(landmarkPulse, landmarkPulse, landmarkPulse), 1 - Math.pow(0.0004, delta));
      }
    });
  }

  private updateCamera(delta: number) {
    const target = this.playerPosition;
    const impulse = motionQuery.matches ? 0 : this.cameraImpulse;
    this.cameraDesired.set(
      target.x + 8 + impulse * 0.24,
      9.4 + impulse * 0.42,
      target.z + 8 + impulse * 0.24
    );
    this.camera.position.lerp(this.cameraDesired, 1 - Math.pow(0.001, delta));
    this.cameraTarget.set(target.x, impulse * 0.12, target.z);
    this.camera.lookAt(this.cameraTarget);
    this.cameraImpulse = Math.max(0, this.cameraImpulse - delta * 2.2);
  }

  private updateActiveZone() {
    let closest: StudioZone | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const zone of zones) {
      const distance = Math.hypot(this.playerPosition.x - zone.position[0], this.playerPosition.z - zone.position[1]);
      if (distance < zone.radius && distance < closestDistance) {
        closest = zone;
        closestDistance = distance;
      }
    }

    if (closest && closest.id !== this.activeZoneId) {
      this.updatePanel(closest);
    }
  }

  private updatePanel(zone: StudioZone) {
    const shouldTriggerActivation = this.activeZoneId !== zone.id;
    this.activeZoneId = zone.id;
    this.visitedZoneIds.add(zone.id);
    document.querySelector("[data-game-root]")?.setAttribute("data-active-zone", zone.id);
    document.querySelector("[data-active-kind]")?.replaceChildren(zone.kind);
    document.querySelector("[data-active-label]")?.replaceChildren(zone.label);
    document.querySelector("[data-zone-kind]")?.replaceChildren(zone.kind);
    document.querySelector("[data-zone-title]")?.replaceChildren(zone.title);
    document.querySelector("[data-zone-summary]")?.replaceChildren(zone.summary);
    document.querySelector("[data-zone-details]")?.replaceChildren(zone.details);

    const signalList = document.querySelector("[data-zone-signals]");
    if (signalList) {
      signalList.replaceChildren(
        ...zone.signals.map((signal) => {
          const item = document.createElement("li");
          item.textContent = signal;
          return item;
        })
      );
    }

    const cta = document.querySelector<HTMLAnchorElement>("[data-zone-cta]");
    if (cta) {
      const hasCta = Boolean(zone.cta);
      cta.href = zone.cta ?? "#";
      cta.setAttribute("aria-hidden", String(!hasCta));
      cta.tabIndex = hasCta ? 0 : -1;
    }

    document.querySelectorAll<HTMLButtonElement>("[data-zone-jump]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.zoneJump === zone.id));
    });

    if (shouldTriggerActivation) {
      this.triggerZoneActivation(zone);
    }
  }

  private markReady() {
    if (this.qaSnapshot.ready) {
      return;
    }

    this.qaSnapshot.ready = true;
    document.documentElement.classList.add("game-ready");
    document.documentElement.dataset.gameState = "ready";
    document.querySelector("[data-game-loader]")?.remove();
  }

  private exposeQaSnapshot() {
    window.__IT_ART_STUDIO_QA__ = this.qaSnapshot;
  }

  private exposeQaRefresh() {
    window.__IT_ART_STUDIO_QA_REFRESH__ = () => this.syncQaSnapshot({ full: true });
  }

  private exposeQaControls() {
    if (!qaMode || realKeyboardQaMode) {
      return;
    }
    window.__IT_ART_STUDIO_QA_STEP__ = (direction: DriveKey) => {
      this.qaStepHookCallCount += 1;
      this.qaSnapshot.lastInputMode = "keyboard";
      this.applyQaKeyboardStep(direction);
    };
  }

  private syncQaSnapshot(options: { full?: boolean } = {}) {
    const full = options.full ?? true;
    this.lastQaSyncTime = performance.now();
    const stableFrameDeltas = this.frameDeltas.filter((item) => item > 0 && item < 120);
    const averageFrameMs =
      stableFrameDeltas.length > 0
        ? stableFrameDeltas.reduce((sum, item) => sum + item, 0) / stableFrameDeltas.length
        : 0;
    const activeZone = zones.find((zone) => zone.id === this.activeZoneId) ?? defaultZone;

    this.qaSnapshot.activeZoneId = activeZone.id;
    this.qaSnapshot.activeZoneLabel = activeZone.label;
    if (full) {
      let sceneObjects = 0;
      let landmarkObjects = 0;
      this.scene.traverse((object) => {
        sceneObjects += 1;
        if (typeof object.userData.landmarkZone === "string") {
          landmarkObjects += 1;
        }
      });
      const zoneAssets = zones.map((zone) => this.inspectZoneAsset(zone));
      const motionRolesByType = zoneAssets.reduce<Record<string, number>>((summary, zone) => {
        Object.entries(zone.motionRoleCounts).forEach(([role, count]) => {
          summary[role] = (summary[role] ?? 0) + count;
        });
        return summary;
      }, {});
      const semanticMotionRoles = Object.values(motionRolesByType).reduce((sum, count) => sum + count, 0);
      const propObjects = zoneAssets.reduce((sum, zone) => sum + zone.propObjects, 0);
      const instancedPropClusters = zoneAssets.reduce((sum, zone) => sum + zone.instancedPropClusters, 0);
      const instancedPropObjects = zoneAssets.reduce((sum, zone) => sum + zone.instancedPropObjects, 0);
      const projectArtifactSpecimenFamilies = new Set(zoneAssets.flatMap((zone) => zone.projectArtifactSpecimenFamilies));
      const projectArtifactDetailProfiles = new Set(zoneAssets.flatMap((zone) => zone.projectArtifactDetailProfiles));
      const projectArtifactReliefSignatures = new Set(zoneAssets.flatMap((zone) => zone.projectArtifactReliefSignatures));
      const projectArtifactManifests = new Set(zoneAssets.flatMap((zone) => zone.projectArtifactManifests));
      const projectArtifactThemeRoles = new Set(zoneAssets.flatMap((zone) => zone.projectArtifactThemeRoles));
      const sceneryRoleCounts: Record<string, number> = {};
      const surfaceDetailPartCounts: Record<string, number> = {};
      const surfaceDetailProfiles = new Set<string>();
      const expectedSurfaceDetailProfiles = new Set<string>();
      const surfaceDetailSignatures: string[] = [];
      let surfaceDetailColorVariants = 0;
      let visibleBoundaryObjects = 0;
      let identityRibbonObjects = 0;
      let worldBeaconObjects = 0;
      let worldBeaconSceneObjects = 0;
      let terrainFeatureMarkerObjects = 0;
      let terrainFeatureMarkerSceneObjects = 0;
      const terrainFeatureMarkerSignatures = new Set<string>();
      const terrainFeatureMarkerProfiles = new Set<string>();
      const identityRibbonSignatures = new Set<string>();
      this.scene.traverse((object) => {
        const role = object.userData.worldSceneryRole;
        if (typeof role === "string") {
          const roleCount =
            typeof object.userData.worldSceneryRoleCount === "number" ? object.userData.worldSceneryRoleCount : 1;
          sceneryRoleCounts[role] = (sceneryRoleCounts[role] ?? 0) + roleCount;
          if (role === "identity-ribbon") {
            identityRibbonObjects +=
              typeof object.userData.worldSceneryObjectCount === "number" ? object.userData.worldSceneryObjectCount : roleCount;
            if (typeof object.userData.worldScenerySignature === "string") {
              identityRibbonSignatures.add(object.userData.worldScenerySignature);
            }
          }
        }
        const surfaceDetailPart = object.userData.surfaceDetailPart;
        if (typeof surfaceDetailPart === "string") {
          const detailCount = object instanceof THREE.InstancedMesh ? object.count : 1;
          surfaceDetailPartCounts[surfaceDetailPart] = (surfaceDetailPartCounts[surfaceDetailPart] ?? 0) + detailCount;
        }
        const detailProfileIds = object.userData.surfaceDetailProfileIds;
        if (Array.isArray(detailProfileIds)) {
          for (const profileId of detailProfileIds) {
            if (typeof profileId === "string") {
              surfaceDetailProfiles.add(profileId);
            }
          }
        }
        if (typeof object.userData.surfaceDetailColorVariantCount === "number") {
          surfaceDetailColorVariants = Math.max(surfaceDetailColorVariants, object.userData.surfaceDetailColorVariantCount);
        }
        const expectedWaterProfiles = object.userData.surfaceDetailExpectedWaterProfiles;
        if (Array.isArray(expectedWaterProfiles)) {
          for (const profileId of expectedWaterProfiles) {
            if (typeof profileId === "string") {
              expectedSurfaceDetailProfiles.add(profileId);
            }
          }
        }
        const expectedRampProfiles = object.userData.surfaceDetailExpectedRampProfiles;
        if (Array.isArray(expectedRampProfiles)) {
          for (const profileId of expectedRampProfiles) {
            if (typeof profileId === "string") {
              expectedSurfaceDetailProfiles.add(profileId);
            }
          }
        }
        const detailSignatures = object.userData.surfaceDetailSignatures;
        if (Array.isArray(detailSignatures)) {
          for (const signature of detailSignatures) {
            if (typeof signature === "string") {
              surfaceDetailSignatures.push(signature);
            }
          }
        }
        if (typeof object.userData.visibleBoundaryPart === "string") {
          visibleBoundaryObjects +=
            typeof object.userData.visibleBoundaryObjectCount === "number"
              ? object.userData.visibleBoundaryObjectCount
              : object instanceof THREE.InstancedMesh
                ? object.count
                : 1;
        }
        if (typeof object.userData.worldBeaconPart === "string") {
          worldBeaconSceneObjects += 1;
          worldBeaconObjects +=
            typeof object.userData.worldBeaconObjectCount === "number"
              ? object.userData.worldBeaconObjectCount
              : object instanceof THREE.InstancedMesh
                ? object.count
                : 1;
        }
        if (typeof object.userData.terrainFeatureMarkerPart === "string") {
          terrainFeatureMarkerSceneObjects += 1;
          terrainFeatureMarkerObjects +=
            typeof object.userData.terrainFeatureMarkerObjectCount === "number"
              ? object.userData.terrainFeatureMarkerObjectCount
              : object instanceof THREE.InstancedMesh
                ? object.count
                : 1;
          const markerSignatures = object.userData.terrainFeatureMarkerSignatures;
          if (Array.isArray(markerSignatures)) {
            for (const signature of markerSignatures) {
              if (typeof signature === "string") {
                terrainFeatureMarkerSignatures.add(signature);
              }
            }
          }
          const markerProfiles = object.userData.terrainFeatureMarkerProfileIds;
          if (Array.isArray(markerProfiles)) {
            for (const profile of markerProfiles) {
              if (typeof profile === "string") {
                terrainFeatureMarkerProfiles.add(profile);
              }
            }
          }
        }
      });

      this.qaSnapshot.world = {
        sceneObjects,
        decorativeObjects: this.decorativeObjectCount,
        roadSegments: this.roadSegmentCount,
        routeSurfaceObjects: this.routeSurfaceObjectCount,
        routeSurfaceDetailSignatures: this.routeSurfaceSignatureIds.size,
        routeSurfaceDetailParts: this.routeSurfaceDetailPartCount,
        routeSurfaceVertexCount: this.routeSurfaceVertexCount,
        routeSurfaceStyle: {
          bedRadiusRatio: roadRibbonVisualConfig.bedRadiusRatio,
          shoulderOffsetRatio: roadRibbonVisualConfig.shoulderOffsetRatio,
          shoulderRadius: roadRibbonVisualConfig.shoulderRadius,
          signalRadius: roadRibbonVisualConfig.signalRadius,
          dashDepthRatio: roadRibbonVisualConfig.dashDepthRatio,
          dashChevronAngle: roadRibbonVisualConfig.dashChevronAngle,
          underlayOpacity: 0.14,
          laneOpacity: 0.78,
          laneEmissiveIntensity: 0.22,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          underlayColor: 0x6a766d,
          castsShadow: false
        },
        landmarkObjects,
        playerParts: this.playerPartCount,
        visualSpecs: this.renderedVisualSpecIds.size,
        visualDecals: this.visualDecalCount,
        propClusters: this.propClusterCount,
        propObjects,
        instancedPropClusters,
        instancedPropObjects,
        surfaceObjects: this.surfaceObjectCount,
        surfaceSignatures: this.surfaceSignatureIds.size,
        setDressingObjects: this.setDressingObjectCount,
        setDressingSignatures: this.setDressingSignatureIds.size,
        placeArchitectureObjects: this.placeArchitectureObjectCount,
        placeArchitectureFamilies: this.placeArchitectureFamilyIds.size,
        placeArchitectureSignatures: this.placeArchitectureSignatureIds.size,
        signatureArtifactObjects: this.signatureArtifactObjectCount,
        signatureArtifactSceneObjects: zoneAssets.reduce((sum, zone) => sum + zone.signatureArtifactSceneObjects, 0),
        signatureArtifactSignatures: this.signatureArtifactSignatureIds.size,
        projectArtifactObjects: this.projectArtifactObjectCount,
        projectArtifactSceneObjects: this.projectArtifactSceneObjectCount,
        projectArtifactZones: this.projectArtifactZoneIds.size,
        projectArtifactActivityTypes: this.projectArtifactActivityIds.size,
        projectArtifactSignatures: this.projectArtifactSignatureIds.size,
        projectArtifactMaterials: this.projectArtifactMaterialIds.size,
        projectArtifactManifests: projectArtifactManifests.size,
        projectArtifactThemeRoles: projectArtifactThemeRoles.size,
        projectArtifactSpecimenFamilies: projectArtifactSpecimenFamilies.size,
        projectArtifactDetailProfiles: projectArtifactDetailProfiles.size,
        projectArtifactReliefSignatures: projectArtifactReliefSignatures.size,
        projectArtifactPartCount: zoneAssets.reduce((sum, zone) => sum + zone.projectArtifactPartCount, 0),
        projectArtifactVertexCount: zoneAssets.reduce((sum, zone) => sum + zone.projectArtifactVertexCount, 0),
        sceneryObjects: this.sceneryObjectCount,
        scenerySignatures: this.scenerySignatureIds.size,
        sceneryMotionObjects: this.worldSceneryMotionObjectCount,
        sceneryRoleCounts,
        surfaceDetailPartCounts,
        surfaceDetailProfiles: surfaceDetailProfiles.size,
        surfaceDetailWaterProfiles: [...surfaceDetailProfiles].filter((profileId) => profileId.startsWith("water:")).length,
        surfaceDetailRampProfiles: [...surfaceDetailProfiles].filter((profileId) => profileId.startsWith("ramp:")).length,
        surfaceDetailColorVariants,
        surfaceDetailSignatures: [...new Set(surfaceDetailSignatures)].sort(),
        missingSurfaceDetailProfiles: [...expectedSurfaceDetailProfiles].filter((profileId) => !surfaceDetailProfiles.has(profileId)).sort(),
        duplicateSurfaceDetailSignatures: surfaceDetailSignatures
          .filter((signature, index, signatures) => signatures.indexOf(signature) !== index)
          .sort(),
        visibleBoundaryObjects,
        worldBeaconObjects,
        worldBeaconSceneObjects,
        identityRibbonObjects,
        identityRibbonSignatures: identityRibbonSignatures.size,
        terrainLayers: this.terrainLayerCount,
        terrainHeightRange: this.terrainHeightRange,
        terrainMinHeight: this.terrainMinHeight,
        terrainMaxHeight: this.terrainMaxHeight,
        terrainVertexCount: this.terrainVertexCount,
        terrainGradeMax: this.terrainGradeMax,
        terrainFeatureCount: this.terrainFeatureCount,
        terrainFeatureMarkerObjects,
        terrainFeatureMarkerSceneObjects,
        terrainFeatureMarkerSignatures: terrainFeatureMarkerSignatures.size,
        terrainFeatureMarkerProfiles: terrainFeatureMarkerProfiles.size,
        routeGuidanceObjects: this.routeGuidanceObjectCount,
        routeGuidanceSignatures: this.routeGuidanceSignatureIds.size,
        routeGuidanceMotionObjects: this.routeGuidanceMotionObjects.length,
        routeGuidanceRoleCounts: { ...this.routeGuidanceRoleCounts },
        routeGuidanceVisualizedSegments: this.routeGuidanceVisualizedSegments,
        routeEncounterObjects: this.routeEncounterObjectCount,
        routeEncounterGates: this.routeEncounterGates.length,
        materialVariants: this.materialVariantIds.size,
        motionRoles: semanticMotionRoles,
        motionRolesByType,
        zones: zoneAssets
      };
    }
    const playerBounds = this.measureObject(this.player);
    this.qaSnapshot.player = {
      x: Number(this.playerPosition.x.toFixed(3)),
      y: Number(this.player.position.y.toFixed(3)),
      z: Number(this.playerPosition.z.toFixed(3)),
      groundY: this.currentTerrain.height,
      groundDelta: Number((this.player.position.y - this.currentTerrain.height).toFixed(3)),
      rotationY: Number(this.player.rotation.y.toFixed(3)),
      meshCount: this.playerPartCount,
      wheelCount: this.wheelParts.length,
      bounds: playerBounds
    };
    const activeTrailMarks = this.trailMarks.filter((mark) => mark.mesh.visible && mark.mesh.material.opacity > 0.02);
    this.qaSnapshot.trail = {
      totalMarks: this.trailMarks.length,
      activeMarks: activeTrailMarks.length,
      maxOpacity: Number(
        activeTrailMarks.reduce((max, mark) => Math.max(max, mark.mesh.material.opacity), 0).toFixed(3)
      )
    };
    const activeSurfaceFxMarks = this.surfaceFxMarks.filter((mark) => mark.opacity > 0.02);
    const surfaceFxProfiles = Object.keys(this.surfaceFxProfileCounts).sort();
    this.qaSnapshot.drive = {
      totalDistance: Number(this.totalDriveDistance.toFixed(3)),
      positionSamples: [...this.drivePositionSamples],
      averageSpeed: Number((this.driveElapsedTime > 0 ? this.totalDriveDistance / this.driveElapsedTime : 0).toFixed(3)),
      rotationChange: Number(this.totalRotationChange.toFixed(3)),
      cameraDistance: Number(this.camera.position.distanceTo(this.playerPosition).toFixed(3)),
      surface: {
        ...this.driveSurfaceTelemetry,
        routeWidth: driveSurfaceConfig.routeWidth,
        routeCount: driveSurfaceConfig.routeCount,
        segmentCount: driveSurfaceConfig.segmentCount,
        zonePadExtraRadius: driveSurfaceConfig.zonePadExtraRadius,
        totalSegmentLength: driveSurfaceConfig.totalSegmentLength,
        visualizedSegmentCount: this.routeGuidanceVisualizedSegments,
        guidanceMarkerCount: this.routeGuidanceObjectCount
      },
      dynamics: {
        currentSpeed: Number(this.lastDriveSpeed.toFixed(3)),
        peakSpeed: Number(this.peakDriveSpeed.toFixed(3)),
        lastAcceleration: Number(this.lastDriveAcceleration.toFixed(3)),
        peakAcceleration: Number(this.peakDriveAcceleration.toFixed(3)),
        averageAcceleration: Number(
          (this.driveDynamicsSamples > 0 ? this.totalDriveAcceleration / this.driveDynamicsSamples : 0).toFixed(3)
        ),
        forwardSpeed: Number(this.currentForwardSpeed.toFixed(3)),
        lateralSpeed: Number(this.currentLateralSpeed.toFixed(3)),
        driftAngle: Number(this.currentDriftAngle.toFixed(3)),
        steeringInput: this.currentSteeringInput,
        throttleInput: this.currentThrottleInput,
        offRouteSamples: this.driveOffRouteSamples,
        freeRoamRatio: Number((this.driveDynamicsSamples > 0 ? this.driveOffRouteSamples / this.driveDynamicsSamples : 0).toFixed(3)),
        movingSamples: this.driveMovingSamples,
        inputSamples: this.driveInputSamples,
        coastingSamples: this.driveCoastingSamples,
        turnRate: Number(this.lastDriveTurnRate.toFixed(3)),
        peakTurnRate: Number(this.peakDriveTurnRate.toFixed(3)),
        averageTurnRate: Number(
          (this.driveTurnSamples > 0 ? this.totalDriveTurnRate / this.driveTurnSamples : 0).toFixed(3)
        )
      },
      vehicleFeel: {
        frontWheelSteer: Number(this.currentFrontWheelSteer.toFixed(3)),
        peakFrontWheelSteer: Number(this.peakFrontWheelSteer.toFixed(3)),
        visualSteeringSamples: this.visualSteeringSamples,
        chassisPitch: Number(this.currentRidePitch.toFixed(3)),
        chassisRoll: Number(this.currentRideRoll.toFixed(3)),
        peakChassisRoll: Number(this.peakChassisRoll.toFixed(3)),
        brakeFxSamples: this.brakeFxSamples,
        driftFxSamples: this.driftFxSamples,
        skidIntensity: Number(this.currentSkidIntensity.toFixed(3)),
        maxSkidIntensity: Number(this.maxSkidIntensity.toFixed(3)),
        driftTrailMarks: this.driftTrailMarks,
        brakeTrailMarks: this.brakeTrailMarks
      },
      material: {
        currentKind: this.currentWorldMaterial.kind,
        currentId: this.currentWorldMaterial.id,
        currentIntensity: Number(this.currentWorldMaterial.intensity.toFixed(3)),
        rideHeight: Number(this.currentRideHeight.toFixed(3)),
        pitch: Number(this.currentRidePitch.toFixed(3)),
        roll: Number(this.currentRideRoll.toFixed(3)),
        terrainHeight: this.currentTerrain.height,
        terrainGrade: this.currentTerrain.grade,
        terrainNormalY: this.currentTerrain.normal.y,
        terrainFeatureId: this.currentTerrain.dominantFeatureId,
        waterSamples: this.waterMaterialSamples,
        rampSamples: this.rampMaterialSamples,
        fieldSamples: this.fieldMaterialSamples,
        roadSamples: this.roadMaterialSamples,
        terrainSamples: this.terrainSamples,
        minTerrainHeight: Number((Number.isFinite(this.minSampledTerrainHeight) ? this.minSampledTerrainHeight : 0).toFixed(3)),
        maxTerrainHeight: Number((Number.isFinite(this.maxSampledTerrainHeight) ? this.maxSampledTerrainHeight : 0).toFixed(3)),
        maxTerrainGrade: Number(this.maxSampledTerrainGrade.toFixed(3)),
        materialTransitions: this.materialTransitionCount,
        maxWaterIntensity: Number(this.maxWaterIntensity.toFixed(3)),
        maxRampRideHeight: Number(this.maxRampRideHeight.toFixed(3)),
        activeFxMarks: activeSurfaceFxMarks.length,
        emittedFxMarks: this.emittedSurfaceFxMarks,
        surfaceFxProfiles,
        surfaceFxWaterProfiles: surfaceFxProfiles.filter((profile) => profile.startsWith("water-")).length,
        surfaceFxRampProfiles: surfaceFxProfiles.filter((profile) => profile.startsWith("ramp-")).length,
        surfaceFxProfileCounts: { ...this.surfaceFxProfileCounts },
        surfaceFxSignatures: this.surfaceFxSignatures.size,
        surfaceFxColorVariants: this.surfaceFxColorVariants.size,
        surfaceFxObjectCapacity: (this.waterSurfaceFxMesh?.count ?? 0) + (this.rampSurfaceFxMesh?.count ?? 0),
        surfaceFxActiveWaterMarks: activeSurfaceFxMarks.filter((mark) => mark.kind === "water").length,
        surfaceFxActiveRampMarks: activeSurfaceFxMarks.filter((mark) => mark.kind === "ramp").length,
        maxSurfaceFxScaleVariance: Number(this.maxSurfaceFxScaleVariance.toFixed(3)),
        waterRegionCount: worldMaterialRegions.water.length,
        rampRegionCount: worldMaterialRegions.ramps.length,
        terrainFeatureCount: terrainConfig.featureCount
      },
      boundary: {
        worldHalfExtent,
        contactCount: this.boundaryContactCount,
        contactAxes: { ...this.boundaryContactAxes },
        lastContactAxis: this.lastBoundaryContactAxis,
        lastContactSpeed: Number(this.lastBoundaryContactSpeed.toFixed(3)),
        distanceToEdge: Number(this.boundaryDistanceToEdge.toFixed(3)),
        minDistanceToEdge: Number(this.minBoundaryDistanceToEdge.toFixed(3)),
        hardStopAwayFromEdgeCount: this.hardStopAwayFromEdgeCount
      },
      physicsSamples: [...this.drivePhysicsSamples]
    };
    const activeZonePoint = new THREE.Vector3(activeZone.position[0], 0.28, activeZone.position[1]);
    const activeLandmark = this.landmarkMeshes.get(activeZone.id);
    const activeSetDressing = this.setDressingGroups.get(activeZone.id);
    const activePlaceArchitecture = this.placeArchitectureGroups.get(activeZone.id);
    const activeSignatureArtifact = this.signatureArtifactGroups.get(activeZone.id);
    const activeProjectArtifact = this.projectArtifactGroups.get(activeZone.id);
    const identityRibbon = this.identityRibbonGroup;
    const previousScreen = this.qaSnapshot.screen;
    const activeLandmarkScreen = full && qaMode && activeLandmark
      ? this.projectObjectToScreenRect(activeLandmark)
      : previousScreen.activeLandmark.zoneId === activeZone.id
        ? previousScreen.activeLandmark
        : this.emptyScreenRect();
    const activeSetDressingScreen = full && qaMode && activeSetDressing
      ? this.projectObjectToScreenRect(activeSetDressing)
      : previousScreen.activeSetDressing.zoneId === activeZone.id
        ? previousScreen.activeSetDressing
        : this.emptyScreenRect();
    const activePlaceArchitectureScreen = full && qaMode && activePlaceArchitecture
      ? this.projectObjectToScreenRect(activePlaceArchitecture)
      : previousScreen.activePlaceArchitecture.zoneId === activeZone.id
        ? previousScreen.activePlaceArchitecture
        : this.emptyScreenRect();
    const activeSignatureArtifactScreen = full && qaMode && activeSignatureArtifact
      ? this.projectObjectToScreenRect(activeSignatureArtifact)
      : previousScreen.activeSignatureArtifact.zoneId === activeZone.id
        ? previousScreen.activeSignatureArtifact
        : this.emptyScreenRect();
    const activeProjectArtifactScreen = full && qaMode && activeProjectArtifact
      ? this.projectObjectToScreenRect(activeProjectArtifact)
      : previousScreen.activeProjectArtifact.zoneId === activeZone.id
        ? previousScreen.activeProjectArtifact
        : this.emptyScreenRect();
    const identityRibbonScreen = full && qaMode && identityRibbon
      ? this.projectObjectToScreenRect(identityRibbon)
      : previousScreen.identityRibbon.visible
        ? previousScreen.identityRibbon
        : this.emptyScreenRect();
    const activePlaceArchitectureFamily =
      typeof activePlaceArchitecture?.userData.placeArchitectureFamily === "string"
        ? activePlaceArchitecture.userData.placeArchitectureFamily
        : null;
    const playerRectScreen =
      full && qaMode
        ? this.projectObjectToScreenRect(this.player)
        : previousScreen.playerRect.visible
          ? previousScreen.playerRect
          : this.emptyScreenRect();
    const activeRouteEncounterScreen =
      full && qaMode && this.currentRouteEncounterGate
        ? this.projectObjectToScreenRect(this.currentRouteEncounterGate.object)
        : previousScreen.activeRouteEncounter.id === this.currentRouteEncounterId
          ? previousScreen.activeRouteEncounter
          : this.emptyScreenRect();
    this.qaSnapshot.camera = {
      position: this.toVec3Qa(this.camera.position),
      target: this.toVec3Qa(this.cameraTarget),
      desired: this.toVec3Qa(this.cameraDesired),
      lag: Number(this.camera.position.distanceTo(this.cameraDesired).toFixed(3)),
      distanceToPlayer: Number(this.camera.position.distanceTo(this.playerPosition).toFixed(3))
    };
    this.qaSnapshot.screen = {
      player: this.projectToScreen(this.playerPosition),
      playerRect: playerRectScreen,
      activeZone: {
        ...this.projectToScreen(activeZonePoint),
        zoneId: activeZone.id
      },
      activeLandmark: {
        ...activeLandmarkScreen,
        zoneId: activeZone.id
      },
      activeSetDressing: {
        ...activeSetDressingScreen,
        zoneId: activeZone.id
      },
      activePlaceArchitecture: {
        ...activePlaceArchitectureScreen,
        zoneId: activeZone.id,
        family: activePlaceArchitectureFamily
      },
      activeSignatureArtifact: {
        ...activeSignatureArtifactScreen,
        zoneId: activeZone.id
      },
      activeProjectArtifact: {
        ...activeProjectArtifactScreen,
        zoneId: activeZone.id
      },
      identityRibbon: identityRibbonScreen,
      activeZoneComposition: full
        ? this.createZoneComposition(activeZone.id, [
            activeLandmarkScreen,
            activePlaceArchitectureScreen,
            activeSignatureArtifactScreen
          ])
        : previousScreen.activeZoneComposition.zoneId === activeZone.id
          ? previousScreen.activeZoneComposition
          : this.createZoneComposition(activeZone.id, [
              activeLandmarkScreen,
              activePlaceArchitectureScreen,
              activeSignatureArtifactScreen
            ]),
      activeRouteEncounter: {
        ...activeRouteEncounterScreen,
        id: this.currentRouteEncounterId,
        routeId: this.currentRouteEncounterRouteId,
        intensity: this.currentRouteEncounterIntensity,
        distance: this.currentRouteEncounterDistance
      }
    };
    this.qaSnapshot.input = {
      activeKeys: [...this.keys],
      keyboardDownCount: this.keyboardDownCount,
      keyboardUpCount: this.keyboardUpCount,
      lastKeyboardCode: this.lastKeyboardCode,
      qaStepHookCalls: this.qaStepHookCallCount
    };
    const activeFeedback = this.activationFeedbackByZone.get(activeZone.id);
    const feedbackMeshes = activeFeedback
      ? [activeFeedback.halo, ...activeFeedback.rings, ...activeFeedback.sparks].filter((mesh) => mesh.visible)
      : [];
    this.qaSnapshot.activeFeedback = {
      zoneId: activeZone.id,
      sequence: this.activationSequence,
      lastTriggeredFrame: this.lastActivationFrame,
      visibleObjects: feedbackMeshes.filter((mesh) => mesh.material.opacity > 0.08).length,
      ringCount: activeFeedback?.rings.length ?? 0,
      sparkCount: activeFeedback?.sparks.length ?? 0,
      intensity: Number((activeFeedback?.intensity ?? 0).toFixed(3)),
      maxOpacity: Number(feedbackMeshes.reduce((max, mesh) => Math.max(max, mesh.material.opacity), 0).toFixed(3)),
      maxScale: Number(feedbackMeshes.reduce((max, mesh) => Math.max(max, mesh.scale.x), 1).toFixed(3)),
      cameraImpulse: Number(this.cameraImpulse.toFixed(3))
    };
    let realLightCount = 0;
    let shadowCastingLightCount = 0;
    let poolObjects = 0;
    this.scene.traverse((object) => {
      if (object instanceof THREE.Light) {
        realLightCount += 1;
        if (object.castShadow) {
          shadowCastingLightCount += 1;
        }
      }
      if (typeof object.userData.worldLightingRole === "string") {
        poolObjects += 1;
      }
    });
    this.qaSnapshot.lighting = {
      poolCount: this.lightPoolObjectCount,
      poolObjects,
      activePoolVisible: this.activeLightPool?.visible ?? false,
      activePoolOpacity: Number((this.activeLightPool?.material.opacity ?? 0).toFixed(3)),
      activePoolScale: Number((this.activeLightPool?.scale.x ?? 0).toFixed(3)),
      routePoolVisible: this.routeLightPool?.visible ?? false,
      routePoolOpacity: Number((this.routeLightPool?.material.opacity ?? 0).toFixed(3)),
      routePoolScale: Number((this.routeLightPool?.scale.x ?? 0).toFixed(3)),
      nearestRouteId: this.currentNearestRouteId,
      realLightCount,
      shadowCastingLightCount
    };
    this.qaSnapshot.routeEncounters = {
      gateCount: this.routeEncounterGates.length,
      objectCount: this.routeEncounterObjectCount,
      activeId: this.currentRouteEncounterId,
      activeRouteId: this.currentRouteEncounterRouteId,
      activeDistance: this.currentRouteEncounterDistance,
      activeIntensity: this.currentRouteEncounterIntensity,
      activeCount: this.currentRouteEncounterActiveCount,
      visitedIds: [...this.visitedRouteEncounterIds],
      visitedCount: this.visitedRouteEncounterIds.size,
      maxIntensity: Number(this.maxRouteEncounterIntensity.toFixed(3))
    };
    const audioToggleRect = this.audioToggleButton?.getBoundingClientRect();
    this.qaSnapshot.audio = {
      supported: this.audioSupported(),
      initialized: this.audioInitialized,
      muted: this.audioMuted,
      contextState: this.audioContext?.state ?? (this.audioSupported() ? "uninitialized" : "unsupported"),
      engineGain: Number(this.currentEngineGain.toFixed(3)),
      driftGain: Number(this.currentDriftGain.toFixed(3)),
      ambienceGain: Number(this.currentAmbienceGain.toFixed(3)),
      accelerationGain: Number(this.currentAccelerationGain.toFixed(3)),
      waterGain: Number(this.currentWaterGain.toFixed(3)),
      rampGain: Number(this.currentRampGain.toFixed(3)),
      brakeGain: Number(this.currentBrakeGain.toFixed(3)),
      engineFrequency: Number(this.currentEngineFrequency.toFixed(1)),
      surfaceFrequency: Number(this.currentSurfaceFrequency.toFixed(1)),
      toggleVisible: Boolean(
        this.audioToggleButton &&
          audioToggleRect &&
          audioToggleRect.width > 0 &&
          audioToggleRect.height > 0 &&
          getComputedStyle(this.audioToggleButton).display !== "none" &&
          getComputedStyle(this.audioToggleButton).visibility !== "hidden"
      ),
      togglePressed: this.audioToggleButton?.getAttribute("aria-pressed") === "true"
    };
    this.qaSnapshot.canvas = {
      width: this.canvas.width,
      height: this.canvas.height,
      dpr: this.renderer.getPixelRatio()
    };
    this.qaSnapshot.renderer = {
      calls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      geometries: this.renderer.info.memory.geometries,
      textures: this.renderer.info.memory.textures
    };
    this.qaSnapshot.frameCount = this.frameCount;
    this.qaSnapshot.averageFrameMs = Number(averageFrameMs.toFixed(2));
    this.qaSnapshot.visitedZoneIds = [...this.visitedZoneIds];
    this.qaSnapshot.reducedMotion = motionQuery.matches;
    this.qaSnapshot.errors = [...this.errors];
  }

  private toVec3Qa(value: THREE.Vector3): Vec3Qa {
    return {
      x: Number(value.x.toFixed(3)),
      y: Number(value.y.toFixed(3)),
      z: Number(value.z.toFixed(3))
    };
  }

  private projectToScreen(point: THREE.Vector3): ScreenPointQa {
    const rect = this.canvas.getBoundingClientRect();
    const projected = point.clone().project(this.camera);
    const x = rect.left + ((projected.x + 1) / 2) * rect.width;
    const y = rect.top + ((1 - projected.y) / 2) * rect.height;

    return {
      x: Number(x.toFixed(1)),
      y: Number(y.toFixed(1)),
      ndcX: Number(projected.x.toFixed(3)),
      ndcY: Number(projected.y.toFixed(3)),
      visible:
        projected.z >= -1 &&
        projected.z <= 1 &&
        x >= rect.left &&
        x <= rect.right &&
        y >= rect.top &&
        y <= rect.bottom
    };
  }

  private inspectZoneAsset(zone: StudioZone): ZoneAssetQa {
    const group = this.zoneMeshes.get(zone.id);
    if (!group) {
      const emptyEnvelope = this.emptyAssetEnvelope(zone);
      return {
        id: zone.id,
        zonePosition: { x: zone.position[0], z: zone.position[1] },
        zoneRadius: zone.radius,
        meshCount: 0,
        landmarkObjects: 0,
        visualSpecId: null,
        biome: null,
        visualDecals: 0,
        propClusters: 0,
        propObjects: 0,
        instancedPropClusters: 0,
        instancedPropObjects: 0,
        setDressingObjects: 0,
        setDressingRoles: [],
        setDressingSignatures: [],
        placeArchitectureObjects: 0,
        placeArchitectureFamily: null,
        placeArchitectureRoles: [],
        placeArchitectureSignatures: [],
        placeArchitectureBounds: { width: 0, height: 0, depth: 0 },
        placeArchitectureEnvelope: emptyEnvelope,
        signatureArtifactObjects: 0,
        signatureArtifactSceneObjects: 0,
        signatureArtifactFamilies: [],
        signatureArtifactRoles: [],
        signatureArtifactSignatures: [],
        signatureArtifactMaterials: [],
        signatureArtifactBounds: { width: 0, height: 0, depth: 0 },
        signatureArtifactEnvelope: emptyEnvelope,
        signatureArtifactScreen: this.emptyScreenRect(),
        projectArtifactObjects: 0,
        projectArtifactSceneObjects: 0,
        projectArtifactActivityTypes: [],
        projectArtifactSignatures: [],
        projectArtifactMaterials: [],
        projectArtifactManifests: [],
        projectArtifactThemeRoles: [],
        projectArtifactRoleReliefSignatures: {},
        projectArtifactSpecimenFamilies: [],
        projectArtifactDetailProfiles: [],
        projectArtifactReliefSignatures: [],
        projectArtifactPartCount: 0,
        projectArtifactVertexCount: 0,
        projectArtifactBounds: { width: 0, height: 0, depth: 0 },
        projectArtifactEnvelope: emptyEnvelope,
        materialVariants: 0,
        surfaceProfileId: null,
        surfaceFinish: null,
        surfaceMotif: null,
        surfaceObjects: 0,
        surfaceRoles: [],
        surfaceSignatures: [],
        surfaceFingerprint: "",
        declaredMaterialVariants: [],
        renderedMaterialVariants: [],
        missingMaterialVariants: [],
        expectedVisuals: {
          decals: 0,
          propClusters: 0,
          propObjects: 0,
          surfaceObjects: 0,
          surfaceSignatures: 0,
          materialVariants: 0
        },
        expectedAnimation: null,
        appliedAnimation: null,
        animationMatchesSpec: false,
        motionObjectCount: 0,
        motionRoleCounts: {},
        localMotionBehaviors: {},
        visualFingerprint: "",
        setDressingFingerprint: "",
        setDressingEnvelope: emptyEnvelope,
        placeArchitectureFingerprint: "",
        signatureArtifactFingerprint: "",
        projectArtifactFingerprint: "",
        hasLabel: false,
        bounds: { width: 0, height: 0, depth: 0 },
        envelope: emptyEnvelope
      };
    }

    let meshCount = 0;
    let landmarkObjects = 0;
    let visualDecals = 0;
    let propObjects = 0;
    const decalIds = new Set<string>();
    const propClusters = new Set<string>();
    const instancedPropClusters = new Set<string>();
    let instancedPropObjects = 0;
    const setDressingRoles = new Set<string>();
    const setDressingSignatures = new Set<string>();
    const placeArchitectureFamilies = new Set<string>();
    const placeArchitectureRoles = new Set<string>();
    const placeArchitectureSignatures = new Set<string>();
    const signatureArtifactRoles = new Set<string>();
    const signatureArtifactFamilies = new Set<string>();
    const signatureArtifactSignatures = new Set<string>();
    const signatureArtifactMaterials = new Set<string>();
    const projectArtifactActivityTypes = new Set<string>();
    const projectArtifactSignatures = new Set<string>();
    const projectArtifactMaterials = new Set<string>();
    const projectArtifactManifests = new Set<string>();
    const projectArtifactThemeRoles = new Set<string>();
    const projectArtifactRoleReliefSignatures: Record<string, Set<string>> = {};
    const projectArtifactSpecimenFamilies = new Set<string>();
    const projectArtifactDetailProfiles = new Set<string>();
    const projectArtifactReliefSignatures = new Set<string>();
    const surfaceRoles = new Set<string>();
    const surfaceSignatures = new Set<string>();
    let setDressingObjects = 0;
    let placeArchitectureObjects = 0;
    let signatureArtifactObjects = 0;
    let signatureArtifactSceneObjects = 0;
    let projectArtifactObjects = 0;
    let projectArtifactSceneObjects = 0;
    let projectArtifactPartCount = 0;
    let projectArtifactVertexCount = 0;
    let surfaceObjects = 0;
    const materialVariants = new Set<string>();
    const semanticMaterialVariants = new Set<string>();
    const motionRoleCounts: Record<string, number> = {};
    const localMotionBehaviors: Record<string, number> = {};
    const spec = zoneVisualSpecs[zone.id];
    const expectedMaterialVariants = new Set<string>();
    if (spec) {
      for (const decal of spec.decals) {
        expectedMaterialVariants.add(`${spec.id}:${decal.tone}:decal`);
      }
      for (const cluster of spec.propClusters) {
        expectedMaterialVariants.add(`${spec.id}:${cluster.tone}:${cluster.form}`);
      }
    }
    let hasLabel = false;
    group.traverse((child) => {
      const visualMeshCount =
        child instanceof THREE.InstancedMesh
          ? typeof child.userData.propObjectCount === "number"
            ? child.userData.propObjectCount
            : child.count
          : child instanceof THREE.Mesh
            ? 1
            : 0;
      if (visualMeshCount > 0) {
        meshCount += visualMeshCount;
      }
      if (typeof child.userData.landmarkZone === "string") {
        landmarkObjects += 1;
      }
      if (typeof child.userData.visualDecal === "string") {
        visualDecals += 1;
        decalIds.add(child.userData.visualDecal);
      }
      if (typeof child.userData.propCluster === "string") {
        propClusters.add(child.userData.propCluster);
        if (child.userData.visualSpecRole === "prop") {
          if (child instanceof THREE.InstancedMesh) {
            const instanceCount = typeof child.userData.propObjectCount === "number" ? child.userData.propObjectCount : child.count;
            propObjects += instanceCount;
            instancedPropObjects += instanceCount;
            instancedPropClusters.add(child.userData.propCluster);
          } else if (child instanceof THREE.Mesh) {
            propObjects += 1;
          }
        }
      }
      if (typeof child.userData.setDressingRole === "string") {
        setDressingRoles.add(child.userData.setDressingRole);
        if (child instanceof THREE.InstancedMesh) {
          setDressingObjects += child.count;
          if (typeof child.userData.setDressingSignature === "string") {
            setDressingSignatures.add(child.userData.setDressingSignature);
          }
        } else if (child instanceof THREE.Mesh) {
          setDressingObjects += 1;
          if (typeof child.userData.setDressingSignature === "string") {
            setDressingSignatures.add(child.userData.setDressingSignature);
          }
        }
      }
      if (typeof child.userData.placeArchitectureRole === "string") {
        placeArchitectureRoles.add(child.userData.placeArchitectureRole);
        if (typeof child.userData.placeArchitectureFamily === "string") {
          placeArchitectureFamilies.add(child.userData.placeArchitectureFamily);
        }
        if (child instanceof THREE.InstancedMesh) {
          placeArchitectureObjects += child.count;
          if (typeof child.userData.placeArchitectureSignature === "string") {
            placeArchitectureSignatures.add(child.userData.placeArchitectureSignature);
          }
        } else if (child instanceof THREE.Mesh) {
          placeArchitectureObjects += 1;
          if (typeof child.userData.placeArchitectureSignature === "string") {
            placeArchitectureSignatures.add(child.userData.placeArchitectureSignature);
          }
        }
      }
      if (typeof child.userData.signatureArtifactRole === "string") {
        signatureArtifactRoles.add(child.userData.signatureArtifactRole);
        if (Array.isArray(child.userData.signatureArtifactRoles)) {
          child.userData.signatureArtifactRoles.forEach((role) => {
            if (typeof role === "string") {
              signatureArtifactRoles.add(role);
            }
          });
        }
        if (typeof child.userData.signatureArtifactFamily === "string") {
          signatureArtifactFamilies.add(child.userData.signatureArtifactFamily);
        }
        if (child instanceof THREE.InstancedMesh) {
          signatureArtifactSceneObjects += 1;
          signatureArtifactObjects +=
            typeof child.userData.signatureArtifactObjectCount === "number"
              ? child.userData.signatureArtifactObjectCount
              : child.count;
          if (Array.isArray(child.userData.signatureArtifactSignatures)) {
            child.userData.signatureArtifactSignatures.forEach((signature) => {
              if (typeof signature === "string") {
                signatureArtifactSignatures.add(signature);
              }
            });
          } else if (typeof child.userData.signatureArtifactSignature === "string") {
            signatureArtifactSignatures.add(child.userData.signatureArtifactSignature);
          }
          if (Array.isArray(child.userData.signatureArtifactMaterials)) {
            child.userData.signatureArtifactMaterials.forEach((material) => {
              if (typeof material === "string") {
                signatureArtifactMaterials.add(material);
              }
            });
          } else if (typeof child.userData.signatureArtifactMaterial === "string") {
            signatureArtifactMaterials.add(child.userData.signatureArtifactMaterial);
          }
        } else if (child instanceof THREE.Mesh) {
          signatureArtifactSceneObjects += 1;
          signatureArtifactObjects +=
            typeof child.userData.signatureArtifactObjectCount === "number" ? child.userData.signatureArtifactObjectCount : 1;
          if (Array.isArray(child.userData.signatureArtifactSignatures)) {
            child.userData.signatureArtifactSignatures.forEach((signature) => {
              if (typeof signature === "string") {
                signatureArtifactSignatures.add(signature);
              }
            });
          } else if (typeof child.userData.signatureArtifactSignature === "string") {
            signatureArtifactSignatures.add(child.userData.signatureArtifactSignature);
          }
          if (Array.isArray(child.userData.signatureArtifactMaterials)) {
            child.userData.signatureArtifactMaterials.forEach((material) => {
              if (typeof material === "string") {
                signatureArtifactMaterials.add(material);
              }
            });
          } else if (typeof child.userData.signatureArtifactMaterial === "string") {
            signatureArtifactMaterials.add(child.userData.signatureArtifactMaterial);
          }
        }
      }
      if (typeof child.userData.projectArtifactRole === "string") {
        if (typeof child.userData.projectArtifactActivity === "string") {
          projectArtifactActivityTypes.add(child.userData.projectArtifactActivity);
        }
        if (typeof child.userData.projectArtifactSpecimenFamily === "string") {
          projectArtifactSpecimenFamilies.add(child.userData.projectArtifactSpecimenFamily);
        }
        if (typeof child.userData.projectArtifactManifest === "string") {
          projectArtifactManifests.add(child.userData.projectArtifactManifest);
        }
        if (Array.isArray(child.userData.projectArtifactThemeRoles)) {
          for (const role of child.userData.projectArtifactThemeRoles) {
            if (typeof role === "string") {
              projectArtifactThemeRoles.add(role);
            }
          }
        }
        if (child.userData.projectArtifactRoleReliefSignatures && typeof child.userData.projectArtifactRoleReliefSignatures === "object") {
          Object.entries(child.userData.projectArtifactRoleReliefSignatures).forEach(([role, signatures]) => {
            if (!Array.isArray(signatures)) {
              return;
            }
            const roleSignatures = projectArtifactRoleReliefSignatures[role] ?? new Set<string>();
            signatures.forEach((signature) => {
              if (typeof signature === "string") {
                roleSignatures.add(signature);
              }
            });
            projectArtifactRoleReliefSignatures[role] = roleSignatures;
          });
        }
        if (typeof child.userData.projectArtifactDetailProfile === "string") {
          projectArtifactDetailProfiles.add(child.userData.projectArtifactDetailProfile);
        }
        if (Array.isArray(child.userData.projectArtifactReliefSignatures)) {
          for (const signature of child.userData.projectArtifactReliefSignatures) {
            if (typeof signature === "string") {
              projectArtifactReliefSignatures.add(signature);
            }
          }
        }
        const specimenPartCount =
          typeof child.userData.projectArtifactPartCount === "number" ? child.userData.projectArtifactPartCount : 0;
        const specimenVertexCount =
          typeof child.userData.projectArtifactVertexCount === "number" ? child.userData.projectArtifactVertexCount : 0;
        if (child instanceof THREE.InstancedMesh) {
          projectArtifactSceneObjects += 1;
          const instanceCount =
            typeof child.userData.projectArtifactObjectCount === "number"
              ? child.userData.projectArtifactObjectCount
              : child.count;
          projectArtifactObjects += instanceCount;
          projectArtifactPartCount += specimenPartCount * instanceCount;
          projectArtifactVertexCount += specimenVertexCount;
          if (Array.isArray(child.userData.projectArtifactActivities)) {
            for (const activityType of child.userData.projectArtifactActivities) {
              if (typeof activityType === "string") {
                projectArtifactActivityTypes.add(activityType);
              }
            }
          }
          if (Array.isArray(child.userData.projectArtifactSignatures)) {
            for (const signature of child.userData.projectArtifactSignatures) {
              if (typeof signature === "string") {
                projectArtifactSignatures.add(signature);
              }
            }
          } else if (typeof child.userData.projectArtifactSignature === "string") {
            projectArtifactSignatures.add(child.userData.projectArtifactSignature);
          }
          if (Array.isArray(child.userData.projectArtifactMaterials)) {
            for (const material of child.userData.projectArtifactMaterials) {
              if (typeof material === "string") {
                projectArtifactMaterials.add(material);
              }
            }
          } else if (typeof child.userData.projectArtifactMaterial === "string") {
            projectArtifactMaterials.add(child.userData.projectArtifactMaterial);
          }
        } else if (child instanceof THREE.Mesh) {
          projectArtifactSceneObjects += 1;
          projectArtifactObjects += 1;
          projectArtifactPartCount += Math.max(1, specimenPartCount);
          projectArtifactVertexCount += specimenVertexCount || child.geometry.getAttribute("position")?.count || 0;
          if (typeof child.userData.projectArtifactSignature === "string") {
            projectArtifactSignatures.add(child.userData.projectArtifactSignature);
          }
          if (typeof child.userData.projectArtifactMaterial === "string") {
            projectArtifactMaterials.add(child.userData.projectArtifactMaterial);
          }
        }
      }
      if (typeof child.userData.surfaceRole === "string") {
        surfaceRoles.add(child.userData.surfaceRole);
        if (child instanceof THREE.InstancedMesh) {
          surfaceObjects += child.count;
          if (typeof child.userData.surfaceSignature === "string") {
            surfaceSignatures.add(child.userData.surfaceSignature);
          }
        } else if (child instanceof THREE.Mesh) {
          surfaceObjects += 1;
          if (typeof child.userData.surfaceSignature === "string") {
            surfaceSignatures.add(child.userData.surfaceSignature);
          }
        }
      }
      if (typeof child.userData.materialVariant === "string") {
        materialVariants.add(child.userData.materialVariant);
      }
      if (typeof child.userData.semanticMaterialVariant === "string") {
        semanticMaterialVariants.add(child.userData.semanticMaterialVariant);
      }
      if (typeof child.userData.motionRole === "string") {
        const motionCount =
          child instanceof THREE.InstancedMesh && child.userData.visualSpecRole === "prop"
            ? typeof child.userData.propObjectCount === "number"
              ? child.userData.propObjectCount
              : child.count
            : 1;
        motionRoleCounts[child.userData.motionRole] = (motionRoleCounts[child.userData.motionRole] ?? 0) + motionCount;
      }
      if (typeof child.userData.localMotionBehavior === "string") {
        localMotionBehaviors[child.userData.localMotionBehavior] =
          (localMotionBehaviors[child.userData.localMotionBehavior] ?? 0) + 1;
      }
      if (child instanceof THREE.Sprite) {
        hasLabel = true;
      }
    });
    const declaredMaterialVariants = spec?.materialVariants ?? [];
    const renderedMaterialVariants = [...semanticMaterialVariants].sort();
    const missingMaterialVariants = declaredMaterialVariants.filter((variant) => !semanticMaterialVariants.has(variant));
    const expectedAnimation = spec?.animation ?? null;
    const appliedAnimation =
      typeof group.userData.appliedAnimation === "object" && group.userData.appliedAnimation
        ? group.userData.appliedAnimation
        : null;
    const animationMatchesSpec =
      Boolean(expectedAnimation && appliedAnimation) &&
      JSON.stringify(expectedAnimation) === JSON.stringify(appliedAnimation);

    const setDressingGroup = this.setDressingGroups.get(zone.id);
    const signatureArtifactGroup = this.signatureArtifactGroups.get(zone.id);
    const placeArchitectureGroup = this.placeArchitectureGroups.get(zone.id);
    const projectArtifactGroup = this.projectArtifactGroups.get(zone.id);
    const setDressingEnvelope = setDressingGroup
      ? this.measureObjectEnvelope(setDressingGroup, zone)
      : this.emptyAssetEnvelope(zone);
    const placeArchitectureEnvelope = placeArchitectureGroup
      ? this.measureObjectEnvelope(placeArchitectureGroup, zone)
      : this.emptyAssetEnvelope(zone);
    const signatureArtifactEnvelope = signatureArtifactGroup
      ? this.measureObjectEnvelope(signatureArtifactGroup, zone)
      : this.emptyAssetEnvelope(zone);
    const projectArtifactEnvelope = projectArtifactGroup
      ? this.measureObjectEnvelope(projectArtifactGroup, zone)
      : this.emptyAssetEnvelope(zone);

    return {
      id: zone.id,
      zonePosition: { x: zone.position[0], z: zone.position[1] },
      zoneRadius: zone.radius,
      meshCount,
      landmarkObjects,
      visualSpecId: typeof group.userData.visualSpecId === "string" ? group.userData.visualSpecId : null,
      biome: typeof group.userData.visualBiome === "string" ? group.userData.visualBiome : null,
      visualDecals,
      propClusters: propClusters.size,
      propObjects,
      instancedPropClusters: instancedPropClusters.size,
      instancedPropObjects,
      setDressingObjects,
      setDressingRoles: [...setDressingRoles].sort(),
      setDressingSignatures: [...setDressingSignatures].sort(),
      placeArchitectureObjects,
      placeArchitectureFamily: [...placeArchitectureFamilies].sort()[0] ?? null,
      placeArchitectureRoles: [...placeArchitectureRoles].sort(),
      placeArchitectureSignatures: [...placeArchitectureSignatures].sort(),
      placeArchitectureBounds: placeArchitectureGroup ? this.measureObject(placeArchitectureGroup) : { width: 0, height: 0, depth: 0 },
      placeArchitectureEnvelope,
      signatureArtifactObjects,
      signatureArtifactSceneObjects,
      signatureArtifactFamilies: [...signatureArtifactFamilies].sort(),
      signatureArtifactRoles: [...signatureArtifactRoles].sort(),
      signatureArtifactSignatures: [...signatureArtifactSignatures].sort(),
      signatureArtifactMaterials: [...signatureArtifactMaterials].sort(),
      signatureArtifactBounds: signatureArtifactGroup ? this.measureObject(signatureArtifactGroup) : { width: 0, height: 0, depth: 0 },
      signatureArtifactEnvelope,
      signatureArtifactScreen:
        qaMode && signatureArtifactGroup ? this.projectObjectToScreenRect(signatureArtifactGroup) : this.emptyScreenRect(),
      projectArtifactObjects,
      projectArtifactSceneObjects,
      projectArtifactActivityTypes: [...projectArtifactActivityTypes].sort(),
      projectArtifactSignatures: [...projectArtifactSignatures].sort(),
      projectArtifactMaterials: [...projectArtifactMaterials].sort(),
      projectArtifactManifests: [...projectArtifactManifests].sort(),
      projectArtifactThemeRoles: [...projectArtifactThemeRoles].sort(),
      projectArtifactRoleReliefSignatures: Object.fromEntries(
        Object.entries(projectArtifactRoleReliefSignatures).map(([role, signatures]) => [role, [...signatures].sort()])
      ),
      projectArtifactSpecimenFamilies: [...projectArtifactSpecimenFamilies].sort(),
      projectArtifactDetailProfiles: [...projectArtifactDetailProfiles].sort(),
      projectArtifactReliefSignatures: [...projectArtifactReliefSignatures].sort(),
      projectArtifactPartCount,
      projectArtifactVertexCount,
      projectArtifactBounds: projectArtifactGroup ? this.measureObject(projectArtifactGroup) : { width: 0, height: 0, depth: 0 },
      projectArtifactEnvelope,
      materialVariants: materialVariants.size,
      surfaceProfileId: typeof group.userData.surfaceProfileId === "string" ? group.userData.surfaceProfileId : null,
      surfaceFinish: typeof group.userData.surfaceFinish === "string" ? group.userData.surfaceFinish : null,
      surfaceMotif: typeof group.userData.surfaceMotif === "string" ? group.userData.surfaceMotif : null,
      surfaceObjects,
      surfaceRoles: [...surfaceRoles].sort(),
      surfaceSignatures: [...surfaceSignatures].sort(),
      surfaceFingerprint: [
        group.userData.surfaceProfileId ?? "missing-surface",
        group.userData.surfaceFinish ?? "missing-finish",
        group.userData.surfaceMotif ?? "missing-motif",
        [...surfaceRoles].sort().join("+"),
        [...surfaceSignatures].sort().join("+")
      ].join("|"),
      declaredMaterialVariants,
      renderedMaterialVariants,
      missingMaterialVariants,
      expectedVisuals: {
        decals: spec?.decals.length ?? 0,
        propClusters: spec?.propClusters.length ?? 0,
        propObjects: spec?.propClusters.reduce((sum, cluster) => sum + cluster.count, 0) ?? 0,
        surfaceObjects: spec ? 1 + spec.surface.bands.length : 0,
        surfaceSignatures: spec ? 1 + spec.surface.bands.length : 0,
        materialVariants: expectedMaterialVariants.size
      },
      expectedAnimation,
      appliedAnimation,
      animationMatchesSpec,
      motionObjectCount: Object.values(motionRoleCounts).reduce((sum, count) => sum + count, 0),
      motionRoleCounts,
      localMotionBehaviors,
      visualFingerprint: [
        group.userData.visualSpecId ?? "missing",
        group.userData.visualBiome ?? "missing-biome",
        [...decalIds].sort().join("+"),
        [...propClusters].sort().join("+"),
        [...materialVariants].sort().join("+")
      ].join("|"),
      setDressingFingerprint: [...setDressingSignatures].sort().join("|"),
      setDressingEnvelope,
      placeArchitectureFingerprint: [...placeArchitectureSignatures].sort().join("|"),
      signatureArtifactFingerprint: [...signatureArtifactSignatures].sort().join("|"),
      projectArtifactFingerprint: [...projectArtifactSignatures].sort().join("|"),
      hasLabel,
      bounds: this.measureObject(group),
      envelope: this.measureObjectEnvelope(group, zone)
    };
  }

  private measureObject(object: THREE.Object3D): BoundsQa {
    const box = this.computeObjectBounds(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    return {
      width: Number(size.x.toFixed(3)),
      height: Number(size.y.toFixed(3)),
      depth: Number(size.z.toFixed(3))
    };
  }

  private emptyAssetEnvelope(zone: StudioZone): AssetEnvelopeQa {
    return {
      width: 0,
      height: 0,
      depth: 0,
      min: { x: zone.position[0], y: 0, z: zone.position[1] },
      max: { x: zone.position[0], y: 0, z: zone.position[1] },
      center: { x: zone.position[0], y: 0, z: zone.position[1] },
      offset: { x: 0, z: 0 },
      offsetDistance: 0,
      footprintRadius: 0,
      zoneRadius: zone.radius,
      allowedFootprintRadius: Number((zone.radius + 1.25).toFixed(3)),
      overflow: 0
    };
  }

  private measureObjectEnvelope(object: THREE.Object3D, zone: StudioZone): AssetEnvelopeQa {
    const box = this.computeObjectBounds(object);
    if (box.isEmpty()) {
      return this.emptyAssetEnvelope(zone);
    }

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const zoneX = zone.position[0];
    const zoneZ = zone.position[1];
    const corners = [
      [box.min.x, box.min.z],
      [box.min.x, box.max.z],
      [box.max.x, box.min.z],
      [box.max.x, box.max.z]
    ] as const;
    const footprintRadius = Math.max(...corners.map(([x, z]) => Math.hypot(x - zoneX, z - zoneZ)));
    const allowedFootprintRadius = zone.radius + 1.25;

    return {
      width: Number(size.x.toFixed(3)),
      height: Number(size.y.toFixed(3)),
      depth: Number(size.z.toFixed(3)),
      min: {
        x: Number(box.min.x.toFixed(3)),
        y: Number(box.min.y.toFixed(3)),
        z: Number(box.min.z.toFixed(3))
      },
      max: {
        x: Number(box.max.x.toFixed(3)),
        y: Number(box.max.y.toFixed(3)),
        z: Number(box.max.z.toFixed(3))
      },
      center: {
        x: Number(center.x.toFixed(3)),
        y: Number(center.y.toFixed(3)),
        z: Number(center.z.toFixed(3))
      },
      offset: {
        x: Number((center.x - zoneX).toFixed(3)),
        z: Number((center.z - zoneZ).toFixed(3))
      },
      offsetDistance: Number(Math.hypot(center.x - zoneX, center.z - zoneZ).toFixed(3)),
      footprintRadius: Number(footprintRadius.toFixed(3)),
      zoneRadius: zone.radius,
      allowedFootprintRadius: Number(allowedFootprintRadius.toFixed(3)),
      overflow: Number(Math.max(0, footprintRadius - allowedFootprintRadius).toFixed(3))
    };
  }

  private computeObjectBounds(object: THREE.Object3D) {
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    const childBox = new THREE.Box3();
    const instanceMatrix = new THREE.Matrix4();
    const worldInstanceMatrix = new THREE.Matrix4();
    let hasBounds = false;

    object.traverse((child) => {
      if (child instanceof THREE.InstancedMesh && child.geometry) {
        child.geometry.computeBoundingBox();
        const geometryBounds = child.geometry.boundingBox;
        if (!geometryBounds) {
          return;
        }
        for (let index = 0; index < child.count; index += 1) {
          child.getMatrixAt(index, instanceMatrix);
          worldInstanceMatrix.multiplyMatrices(child.matrixWorld, instanceMatrix);
          childBox.copy(geometryBounds).applyMatrix4(worldInstanceMatrix);
          box.union(childBox);
          hasBounds = true;
        }
        return;
      }

      if (child instanceof THREE.Mesh || child instanceof THREE.Sprite) {
        childBox.setFromObject(child);
        if (!childBox.isEmpty()) {
          box.union(childBox);
          hasBounds = true;
        }
      }
    });

    if (!hasBounds) {
      box.setFromObject(object);
    }

    return box;
  }

  private createZoneComposition(zoneId: string, layers: ScreenRectQa[]): ZoneCompositionQa {
    const visibleLayers = layers.filter((layer) => layer.visible && layer.clippedArea > 0);
    if (visibleLayers.length === 0) {
      return {
        zoneId,
        visibleLayerCount: 0,
        union: this.emptyScreenRect(),
        centerSpreadPx: 0,
        pairDistancesPx: {
          landmarkToPlace: 0,
          landmarkToSignature: 0,
          placeToSignature: 0
        },
        pairOverlapRatios: {
          landmarkPlace: 0,
          landmarkSignature: 0,
          placeSignature: 0
        },
        largestLayerAreaRatio: 0
      };
    }

    const rawLeft = Math.min(...visibleLayers.map((layer) => layer.x));
    const rawTop = Math.min(...visibleLayers.map((layer) => layer.y));
    const rawRight = Math.max(...visibleLayers.map((layer) => layer.x + layer.width));
    const rawBottom = Math.max(...visibleLayers.map((layer) => layer.y + layer.height));
    const clippedLeft = Math.min(...visibleLayers.map((layer) => layer.clippedX));
    const clippedTop = Math.min(...visibleLayers.map((layer) => layer.clippedY));
    const clippedRight = Math.max(...visibleLayers.map((layer) => layer.clippedX + layer.clippedWidth));
    const clippedBottom = Math.max(...visibleLayers.map((layer) => layer.clippedY + layer.clippedHeight));
    const rawWidth = Math.max(0, rawRight - rawLeft);
    const rawHeight = Math.max(0, rawBottom - rawTop);
    const clippedWidth = Math.max(0, clippedRight - clippedLeft);
    const clippedHeight = Math.max(0, clippedBottom - clippedTop);
    const rawArea = rawWidth * rawHeight;
    const clippedArea = clippedWidth * clippedHeight;
    const centerX = clippedLeft + clippedWidth / 2;
    const centerY = clippedTop + clippedHeight / 2;
    const canvasRect = this.canvas.getBoundingClientRect();
    const center = {
      x: Number(centerX.toFixed(1)),
      y: Number(centerY.toFixed(1)),
      ndcX: Number((((centerX - canvasRect.left) / canvasRect.width) * 2 - 1).toFixed(3)),
      ndcY: Number((1 - ((centerY - canvasRect.top) / canvasRect.height) * 2).toFixed(3)),
      visible:
        centerX >= canvasRect.left &&
        centerX <= canvasRect.right &&
        centerY >= canvasRect.top &&
        centerY <= canvasRect.bottom
    };
    const distance = (left: ScreenRectQa | undefined, right: ScreenRectQa | undefined) =>
      left && right && left.visible && right.visible
        ? Number(Math.hypot(left.center.x - right.center.x, left.center.y - right.center.y).toFixed(1))
        : 0;
    const overlapRatio = (left: ScreenRectQa | undefined, right: ScreenRectQa | undefined) => {
      if (!left || !right || left.clippedArea <= 0 || right.clippedArea <= 0) {
        return 0;
      }
      const overlapLeft = Math.max(left.clippedX, right.clippedX);
      const overlapTop = Math.max(left.clippedY, right.clippedY);
      const overlapRight = Math.min(left.clippedX + left.clippedWidth, right.clippedX + right.clippedWidth);
      const overlapBottom = Math.min(left.clippedY + left.clippedHeight, right.clippedY + right.clippedHeight);
      const overlapArea = Math.max(0, overlapRight - overlapLeft) * Math.max(0, overlapBottom - overlapTop);
      return Number((overlapArea / Math.min(left.clippedArea, right.clippedArea)).toFixed(3));
    };
    const centerDistances = visibleLayers.flatMap((left, leftIndex) =>
      visibleLayers
        .slice(leftIndex + 1)
        .map((right) => Math.hypot(left.center.x - right.center.x, left.center.y - right.center.y))
    );
    const largestLayerArea = visibleLayers.reduce((max, layer) => Math.max(max, layer.clippedArea), 0);

    return {
      zoneId,
      visibleLayerCount: visibleLayers.length,
      union: {
        x: Number(rawLeft.toFixed(1)),
        y: Number(rawTop.toFixed(1)),
        width: Number(rawWidth.toFixed(1)),
        height: Number(rawHeight.toFixed(1)),
        area: Number(rawArea.toFixed(1)),
        clippedX: Number(clippedLeft.toFixed(1)),
        clippedY: Number(clippedTop.toFixed(1)),
        clippedWidth: Number(clippedWidth.toFixed(1)),
        clippedHeight: Number(clippedHeight.toFixed(1)),
        clippedArea: Number(clippedArea.toFixed(1)),
        visibleRatio: Number((rawArea > 0 ? clippedArea / rawArea : 0).toFixed(3)),
        cornerDepthCount: visibleLayers.reduce((sum, layer) => sum + layer.cornerDepthCount, 0),
        visible: visibleLayers.length === layers.length && clippedArea > 0,
        center
      },
      centerSpreadPx: Number((centerDistances.length > 0 ? Math.max(...centerDistances) : 0).toFixed(1)),
      pairDistancesPx: {
        landmarkToPlace: distance(layers[0], layers[1]),
        landmarkToSignature: distance(layers[0], layers[2]),
        placeToSignature: distance(layers[1], layers[2])
      },
      pairOverlapRatios: {
        landmarkPlace: overlapRatio(layers[0], layers[1]),
        landmarkSignature: overlapRatio(layers[0], layers[2]),
        placeSignature: overlapRatio(layers[1], layers[2])
      },
      largestLayerAreaRatio: Number((clippedArea > 0 ? largestLayerArea / clippedArea : 0).toFixed(3))
    };
  }

  private emptyScreenRect(): ScreenRectQa {
    return {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      area: 0,
      clippedX: 0,
      clippedY: 0,
      clippedWidth: 0,
      clippedHeight: 0,
      clippedArea: 0,
      visibleRatio: 0,
      cornerDepthCount: 0,
      visible: false,
      center: { x: 0, y: 0, ndcX: 0, ndcY: 0, visible: false }
    };
  }

  private projectObjectToScreenRect(object: THREE.Object3D): ScreenRectQa {
    const bounds = this.computeObjectBounds(object);
    if (bounds.isEmpty()) {
      return this.emptyScreenRect();
    }

    const rect = this.canvas.getBoundingClientRect();
    const corners = [
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z)
    ];
    const projected = corners.map((corner) => corner.project(this.camera));
    const screenPoints = projected.map((point) => ({
      x: rect.left + ((point.x + 1) / 2) * rect.width,
      y: rect.top + ((1 - point.y) / 2) * rect.height,
      z: point.z
    }));
    const minX = Math.min(...screenPoints.map((point) => point.x));
    const maxX = Math.max(...screenPoints.map((point) => point.x));
    const minY = Math.min(...screenPoints.map((point) => point.y));
    const maxY = Math.max(...screenPoints.map((point) => point.y));
    const width = Math.max(0, maxX - minX);
    const height = Math.max(0, maxY - minY);
    const area = width * height;
    const clippedMinX = clamp(minX, rect.left, rect.right);
    const clippedMaxX = clamp(maxX, rect.left, rect.right);
    const clippedMinY = clamp(minY, rect.top, rect.bottom);
    const clippedMaxY = clamp(maxY, rect.top, rect.bottom);
    const clippedWidth = Math.max(0, clippedMaxX - clippedMinX);
    const clippedHeight = Math.max(0, clippedMaxY - clippedMinY);
    const clippedArea = clippedWidth * clippedHeight;
    const center = new THREE.Vector3();
    bounds.getCenter(center);
    const centerScreen = this.projectToScreen(center);
    const intersectsCanvas = maxX >= rect.left && minX <= rect.right && maxY >= rect.top && minY <= rect.bottom;
    const cornerDepthCount = projected.filter((point) => point.z >= -1 && point.z <= 1).length;
    const visibleRatio = area > 0 ? clippedArea / area : 0;

    return {
      x: Number(minX.toFixed(1)),
      y: Number(minY.toFixed(1)),
      width: Number(width.toFixed(1)),
      height: Number(height.toFixed(1)),
      area: Number(area.toFixed(1)),
      clippedX: Number(clippedMinX.toFixed(1)),
      clippedY: Number(clippedMinY.toFixed(1)),
      clippedWidth: Number(clippedWidth.toFixed(1)),
      clippedHeight: Number(clippedHeight.toFixed(1)),
      clippedArea: Number(clippedArea.toFixed(1)),
      visibleRatio: Number(visibleRatio.toFixed(3)),
      cornerDepthCount,
      visible: intersectsCanvas && cornerDepthCount >= 2 && visibleRatio > 0 && width > 0 && height > 0,
      center: centerScreen
    };
  }

  private updateMiniMap() {
    const marker = document.querySelector<HTMLElement>("[data-map-player]");
    if (!marker) {
      return;
    }

    marker.style.left = `${((this.playerPosition.x + mapRange / 2) / mapRange) * 100}%`;
    marker.style.top = `${((this.playerPosition.z + mapRange / 2) / mapRange) * 100}%`;
  }

  destroy() {
    window.cancelAnimationFrame(this.frameId);
    this.renderer.dispose();
  }
}

const boot = () => {
  const canvas = document.querySelector<HTMLCanvasElement>("#studio-map-canvas");
  if (!canvas) {
    return;
  }

  try {
    const game = new StudioGame(canvas);
    game.start();
    window.addEventListener("pagehide", () => game.destroy(), { once: true });
  } catch (error) {
    console.error(error);
    document.documentElement.classList.add("game-fallback");
    document.documentElement.dataset.gameState = "fallback";
    document.querySelector("[data-game-loader]")?.replaceChildren("Mode carte statique");
  }
};

boot();
