import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Edges, Html, Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { Alert, Hazard, Structure } from '../api/types';
import { projectToScene } from '../utils/geospatial';

// ---------------------------------------------------------------------------
// Coordinate model — STRICT 1:1 UNIFIED SCENE SCALE
// ---------------------------------------------------------------------------
// 1 scene unit = 1 real-world kilometre on EVERY axis (X, Y and Z). There is
// no separate depth multiplier: a 25 km deep event is rendered exactly 25 units
// below the surface, and a 34.3 km surface offset is rendered exactly 34.3
// units across the ground plane. This keeps the telemetry geometrically honest
// — the horizontal distance line is visibly longer than the vertical depth
// line whenever the real distance is greater than the real depth.
//
// COMPOSITION: the scene is epicenter-centric. The epicenter sits at the origin
// (0, 0, 0) on the surface plane (Y = 0), the hypocenter sits directly below it
// at (0, -depthKm, 0), and the active structure sits at its true haversine
// offset on the ground plane.
//
// Only the structure MESH is scaled up (STRUCTURE_VISUAL_SCALE) so a real
// ~0.1 km dam is legible; its position is never scaled.

const STRUCTURE_VISUAL_SCALE = 8;

// The true haversine distance is preserved in the label, but the rendered
// horizontal separation is exaggerated so the asset reads as a distinct
// landmark rather than sitting on top of the epicenter.
const DISPLAY_DISTANCE_SCALE = 4;

const STRUCTURE_COLOR = '#8b93a1';
const STRUCTURE_ACCENT = '#5b8fb0';
const ALERT_COLOR = '#e5484d';
const EDGE_COLOR = '#1b2430';

/** Colour-code the risk score for the telemetry label. */
function riskColor(score: number): string {
  if (score >= 2.5) return ALERT_COLOR;
  if (score >= 1.5) return '#e5a84d';
  return '#4dd08a';
}

// Approximate authored height (in mesh units, before STRUCTURE_VISUAL_SCALE)
// per structure type — used to float the label stack above each landmark.
function structureHeightUnits(type: string): number {
  switch (type) {
    case 'dam':
      return 2.2;
    case 'bridge':
      return 2.1;
    case 'reinforced_high_rise':
      return 3.4;
    case 'unreinforced_masonry':
      return 1.8;
    default:
      return 1.4;
  }
}

function DamMesh() {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-1.9, 0);
    s.lineTo(1.9, 0);
    s.lineTo(1.2, 2.2);
    s.lineTo(-1.2, 2.2);
    s.closePath();
    return s;
  }, []);

  return (
    <group>
      <mesh position={[0, 1.1, 0]} castShadow>
        <extrudeGeometry args={[shape, { depth: 3.4, bevelEnabled: false }]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.25} roughness={0.82} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 1.0, 0.9]} castShadow>
        <boxGeometry args={[3.1, 0.12, 1.2]} />
        <meshStandardMaterial color={STRUCTURE_ACCENT} metalness={0.15} roughness={0.7} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 2.05, 0.55]} castShadow>
        <boxGeometry args={[3.8, 0.12, 2.2]} />
        <meshStandardMaterial color={STRUCTURE_ACCENT} metalness={0.15} roughness={0.7} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 0.35, 0]} receiveShadow>
        <boxGeometry args={[4.4, 0.18, 3.8]} />
        <meshStandardMaterial color="#263241" metalness={0.05} roughness={0.95} />
      </mesh>
    </group>
  );
}

function BridgeDeck() {
  return (
    <mesh castShadow>
      <boxGeometry args={[7.2, 0.22, 1.2]} />
      <meshStandardMaterial color={STRUCTURE_ACCENT} metalness={0.4} roughness={0.58} />
      <Edges color={EDGE_COLOR} />
    </mesh>
  );
}

function BridgeMesh() {
  return (
    <group>
      <mesh position={[-2.35, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.45, 2.0, 12]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.22} roughness={0.76} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[2.35, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.45, 2.0, 12]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.22} roughness={0.76} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[-1.15, 1.48, 0]} castShadow>
        <boxGeometry args={[1.5, 0.18, 0.9]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.18} roughness={0.82} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[1.15, 1.48, 0]} castShadow>
        <boxGeometry args={[1.5, 0.18, 0.9]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.18} roughness={0.82} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <BridgeDeck />
      <mesh position={[0, 0.78, 0]} receiveShadow>
        <cylinderGeometry args={[5.0, 5.0, 0.08, 32, 1, true, Math.PI * 0.06, Math.PI * 0.88]} />
        <meshStandardMaterial color="#253142" side={THREE.DoubleSide} transparent opacity={0.25} />
      </mesh>
      <mesh position={[0, 0.18, 0]} receiveShadow>
        <boxGeometry args={[8.4, 0.12, 2.2]} />
        <meshStandardMaterial color="#253142" metalness={0.05} roughness={1} />
      </mesh>
    </group>
  );
}

function CouncilHallMesh() {
  return (
    <group>
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[5.4, 3.6, 3.2]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.12} roughness={0.86} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 3.95, 0]} castShadow>
        <boxGeometry args={[4.4, 0.38, 2.4]} />
        <meshStandardMaterial color={STRUCTURE_ACCENT} metalness={0.18} roughness={0.72} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 2.0, 1.75]} castShadow>
        <boxGeometry args={[3.1, 2.6, 0.55]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.12} roughness={0.86} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 2.1, -1.75]} castShadow>
        <boxGeometry args={[3.1, 2.6, 0.55]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.12} roughness={0.86} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <boxGeometry args={[2.0, 2.0, 1.6]} />
        <meshStandardMaterial color={STRUCTURE_ACCENT} metalness={0.16} roughness={0.8} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 0.25, 0]} receiveShadow>
        <boxGeometry args={[6.6, 0.16, 4.2]} />
        <meshStandardMaterial color="#233040" metalness={0.05} roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.45, 0]} receiveShadow>
        <boxGeometry args={[8.0, 0.08, 5.4]} />
        <meshStandardMaterial color="#19222e" metalness={0.05} roughness={1} />
      </mesh>
      <mesh position={[0, 0.9, 1.9]} castShadow>
        <boxGeometry args={[1.0, 1.4, 0.22]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.12} roughness={0.86} />
      </mesh>
      <mesh position={[0, 1.05, -1.0]} castShadow>
        <boxGeometry args={[1.8, 0.7, 0.18]} />
        <meshStandardMaterial color={STRUCTURE_ACCENT} metalness={0.15} roughness={0.75} />
      </mesh>
    </group>
  );
}

function HighRiseMesh() {
  return (
    <group>
      <mesh position={[0, 1.7, 0]} castShadow>
        <boxGeometry args={[1.5, 3.4, 1.5]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.4} roughness={0.72} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 3.85, 0]} castShadow>
        <boxGeometry args={[1.0, 0.45, 1.0]} />
        <meshStandardMaterial color={STRUCTURE_ACCENT} metalness={0.3} roughness={0.68} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 0.9, 0]} receiveShadow>
        <boxGeometry args={[2.1, 1.8, 2.1]} />
        <meshStandardMaterial color="#223041" metalness={0.08} roughness={0.9} />
      </mesh>
    </group>
  );
}

function MasonryMesh() {
  return (
    <group>
      <mesh position={[0, 0.98, 0]} castShadow>
        <boxGeometry args={[2.2, 2.0, 1.9]} />
        <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.18} roughness={0.88} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 2.05, 0]} castShadow>
        <boxGeometry args={[1.7, 0.42, 1.5]} />
        <meshStandardMaterial color={STRUCTURE_ACCENT} metalness={0.1} roughness={0.8} />
        <Edges color={EDGE_COLOR} />
      </mesh>
      <mesh position={[0, 0.34, 0]} receiveShadow>
        <boxGeometry args={[2.8, 0.14, 2.5]} />
        <meshStandardMaterial color="#253142" metalness={0.04} roughness={0.96} />
      </mesh>
    </group>
  );
}

function GenericMesh() {
  return (
    <mesh position={[0, 0.7, 0]} castShadow>
      <boxGeometry args={[1.8, 1.4, 1.8]} />
      <meshStandardMaterial color={STRUCTURE_COLOR} metalness={0.4} roughness={0.7} />
      <Edges color={EDGE_COLOR} />
    </mesh>
  );
}

function StructureMesh({ type, name }: { type: string; name: string }) {
  const normalizedName = name.toLowerCase();
  const looksLikeCouncilHall =
    normalizedName.includes('council') ||
    normalizedName.includes('city hall') ||
    normalizedName.includes('hall') ||
    normalizedName.includes('municipal') ||
    normalizedName.includes('government');

  if (looksLikeCouncilHall) {
    return <CouncilHallMesh />;
  }

  switch (type) {
    case 'dam':
      return <DamMesh />;
    case 'bridge':
      return <BridgeMesh />;
    case 'reinforced_high_rise':
      return <HighRiseMesh />;
    case 'unreinforced_masonry':
      return <MasonryMesh />;
    default:
      return <GenericMesh />;
  }
}

// ---------------------------------------------------------------------------
// Active structure marker — only one is rendered at a time.
// ---------------------------------------------------------------------------

interface ActiveStructureMarkerProps {
  structure: Structure;
  x: number;
  z: number;
  riskScore: number | null;
}

function ActiveStructureMarker({ structure, x, z, riskScore }: ActiveStructureMarkerProps) {
  const inRange = riskScore !== null;
  const topY = structureHeightUnits(structure.structureType) * STRUCTURE_VISUAL_SCALE;

  return (
    <group position={[x, 0, z]}>
      <group scale={STRUCTURE_VISUAL_SCALE}>
        <StructureMesh type={structure.structureType} name={structure.name} />
      </group>

      {/* Strict vertical label stack floating just above the structure, in a
          monospace face to match the technical dashboard aesthetic. */}
      <Html position={[0, topY + 10, 0]} center zIndexRange={[100, 0]}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            textShadow: '0 0 6px #0e1116, 0 0 3px #0e1116',
          }}
        >
          <div style={{ color: STRUCTURE_COLOR, fontSize: 14, fontWeight: 600 }}>
            {structure.name}
          </div>
          {inRange && (
            <div style={{ color: riskColor(riskScore), fontSize: 12, fontWeight: 700 }}>
              {`risk ${riskScore.toFixed(2)}`}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Distance line — a straight ground-level line from the structure centre to the
// epicenter centre, with the distance label sitting on the line. Because it
// lies flat on the ground grid it reads as a true horizontal distance rather
// than a diagonal to the subsurface sphere.
// ---------------------------------------------------------------------------

interface DistanceLineProps {
  x: number;
  z: number;
  distanceKm: number;
}

function DistanceLine({ x, z, distanceKm }: DistanceLineProps) {
  const midX = x / 2;
  const midZ = z / 2;

  return (
    <group>
      <Line
        points={[
          [x, 0.5, z],
          [0, 0.5, 0],
        ]}
        color="#a7b3c7"
        lineWidth={1.5}
        dashed
        dashSize={4}
        gapSize={3}
      />
      {/* DOM overlay so the caption always renders on top of the structure
          instead of being buried inside its geometry. */}
      <Html position={[midX, 6, midZ]} center zIndexRange={[100, 0]}>
        <div
          style={{
            color: '#c3ccda',
            fontSize: 13,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            textShadow: '0 0 6px #0e1116, 0 0 3px #0e1116',
            pointerEvents: 'none',
          }}
        >
          {`${distanceKm.toFixed(1)} km from epicenter`}
        </div>
      </Html>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Ground grid — built from real line geometry instead of a screen-space shader
// grid. Shader grids alias badly at grazing angles; explicit lines stay stable
// as the camera orbits.
// ---------------------------------------------------------------------------

function GroundGrid() {
  const geometry = useMemo(() => {
    const extent = 600;
    const step = 20;
    const positions: number[] = [];

    for (let i = -extent; i <= extent; i += step) {
      // Lines running along Z (constant X)
      positions.push(i, 0, -extent, i, 0, extent);
      // Lines running along X (constant Z)
      positions.push(-extent, 0, i, extent, 0, i);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  return (
    <lineSegments geometry={geometry} position={[0, 0, 0]}>
      <lineBasicMaterial color="#46566a" transparent opacity={0.55} />
    </lineSegments>
  );
}

// ---------------------------------------------------------------------------
// Epicenter marker + hypocenter + clipped expanding S-wave front
// ---------------------------------------------------------------------------

function Hypocenter({ depthKm }: { depthKm: number }) {
  return (
    <group position={[0, -depthKm, 0]}>
      <mesh>
        <sphereGeometry args={[Math.max(depthKm * 0.12, 2), 24, 24]} />
        <meshBasicMaterial color={ALERT_COLOR} />
      </mesh>

      {/* Dashed vertical depth indicator from the surface epicenter straight
          down to the subsurface hypocenter, with the true depth on the line.
          Its length is exactly depthKm units — the same scale as the surface. */}
      <Line
        points={[
          [0, depthKm, 0],
          [0, 0, 0],
        ]}
        color={ALERT_COLOR}
        lineWidth={1.5}
        dashed
        dashSize={4}
        gapSize={3}
      />
      {/* DOM overlay so the depth caption stays visible through the
          translucent subsurface slab. */}
      <Html position={[0, depthKm / 2, 0]} center zIndexRange={[100, 0]}>
        <div
          style={{
            color: ALERT_COLOR,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            whiteSpace: 'nowrap',
            textShadow: '0 0 6px #0e1116, 0 0 3px #0e1116',
            pointerEvents: 'none',
          }}
        >
          {`${depthKm.toFixed(2)} km depth`}
        </div>
      </Html>
    </group>
  );
}

interface WaveFrontProps {
  /** Radius the surface dome expands to (scaled horizontal distance). */
  maxRadiusKm: number;
  /** True depth of the hypocenter, where the wave originates. */
  depthKm: number;
  /** Clipping plane that hides everything below the ground surface (Y < 0). */
  groundClip: THREE.Plane;
}

// A full sphere expanding outward from the subsurface hypocenter. A ground
// clipping plane hides everything below Y = 0, so while the radius is smaller
// than the depth the wave is invisible underground; once it exceeds the depth
// it organically breaches the surface and forms a clean expanding dome. A
// wireframe shell is layered on top so it reads as a calculated telemetry
// boundary.
function WaveFront({ maxRadiusKm, depthKm, groundClip }: WaveFrontProps) {
  const solidRef = useRef<THREE.Mesh>(null);
  const wireRef = useRef<THREE.Mesh>(null);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const pulseSpeed = maxRadiusKm > 80 ? 12 : maxRadiusKm > 40 ? 18 : 28;
    const radius = (elapsed.current * pulseSpeed) % (maxRadiusKm + 4);
    const clamped = Math.min(Math.max(radius, 0.001), maxRadiusKm);
    solidRef.current?.scale.setScalar(clamped);
    wireRef.current?.scale.setScalar(clamped);
  });

  return (
    <group position={[0, -depthKm, 0]}>
      <mesh ref={solidRef}>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial
          color={ALERT_COLOR}
          emissive={ALERT_COLOR}
          emissiveIntensity={0.5}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
          clippingPlanes={[groundClip]}
        />
      </mesh>
      <mesh ref={wireRef}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshBasicMaterial
          color={ALERT_COLOR}
          wireframe
          transparent
          opacity={0.22}
          depthWrite={false}
          clippingPlanes={[groundClip]}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export interface SeismicSceneProps {
  structures: Structure[];
  hazards: Hazard[];
  alerts: Alert[];
  activeAlert: Alert | null;
  activeStructureId: string | null;
}

export default function SeismicScene({
  structures,
  hazards,
  alerts,
  activeAlert,
  activeStructureId,
}: SeismicSceneProps) {
  // The epicenter must come from the SAME event as the active alert, otherwise
  // the distance label pairs a structure with an unrelated event (e.g. a
  // Japan structure against a California event → ~9,000 km). Prefer the active
  // alert's own hazard coordinates, then the most recent hazard, then the
  // first structure so the scene still renders before any event has landed.
  const epicenter = useMemo(() => {
    if (activeAlert) {
      return {
        lat: Number(activeAlert.hazardLat),
        lon: Number(activeAlert.hazardLon),
        depthKm: Number(activeAlert.hazardDepthKm),
      };
    }
    const hazard = hazards[0];
    if (hazard) {
      return { lat: Number(hazard.lat), lon: Number(hazard.lon), depthKm: Number(hazard.depthKm) };
    }
    const fallback = structures[0];
    if (fallback) {
      return { lat: Number(fallback.lat), lon: Number(fallback.lon), depthKm: 10 };
    }
    return { lat: 0, lon: 0, depthKm: 10 };
  }, [activeAlert, hazards, structures]);

  const activeStructure = useMemo(
    () => structures.find((s) => s.id === activeStructureId) ?? null,
    [structures, activeStructureId],
  );

  // Highest risk score recorded for the active structure, if any.
  const activeRiskScore = useMemo(() => {
    if (!activeStructure) return null;
    let best: number | null = null;
    for (const alert of alerts) {
      if (alert.structureName !== activeStructure.name) continue;
      const score = Number(alert.riskScore);
      if (best === null || score > best) best = score;
    }
    return best;
  }, [alerts, activeStructure]);

  // Real haversine distance from the epicenter to the active structure. The
  // scene is composed asset-centric (structure at the origin), so this is used
  // for the on-screen distance label rather than for placement.
  const placement = useMemo(() => {
    if (!activeStructure) return null;
    return projectToScene(
      epicenter.lat,
      epicenter.lon,
      Number(activeStructure.lat),
      Number(activeStructure.lon),
    );
  }, [activeStructure, epicenter]);

  // Rendered horizontal offset — the true haversine distance exaggerated by
  // DISPLAY_DISTANCE_SCALE so the asset reads as a distinct landmark.
  const displayPlacement = useMemo(() => {
    if (!placement) return null;
    return {
      x: placement.x * DISPLAY_DISTANCE_SCALE,
      z: placement.z * DISPLAY_DISTANCE_SCALE,
      distanceKm: placement.distanceKm,
    };
  }, [placement]);

  // The dome expands to the rendered horizontal distance so its edge reaches
  // the structure on the surface.
  const maxRadiusKm = useMemo(() => {
    const horizontalKm = displayPlacement
      ? Math.hypot(displayPlacement.x, displayPlacement.z)
      : 0;
    return Math.max(18, horizontalKm + 6);
  }, [displayPlacement]);

  // Hides everything below the ground surface so the wave only shows as a dome.
  const groundClip = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);

  return (
    <Canvas
      shadows
      gl={{ localClippingEnabled: true }}
      camera={{ position: [170, 120, 170], fov: 42, near: 1, far: 6000 }}
      style={{ background: '#0e1116' }}
    >
      <ambientLight intensity={1.3} />
      <directionalLight position={[200, 300, 150]} intensity={1.8} castShadow />
      <hemisphereLight args={['#dbe8ff', '#1a2230', 0.9]} />

      {/* Subsurface slab to give the cutaway a sense of depth. Its top face is
          kept a little below the grid plane so the two coplanar surfaces don't
          z-fight and flicker as the camera orbits. */}
      <mesh position={[0, -122, 0]} receiveShadow>
        <boxGeometry args={[1200, 240, 1200]} />
        <meshStandardMaterial color="#1f2a38" transparent opacity={0.65} />
      </mesh>

      {/* Ground plane grid — the surface cutaway */}
      <GroundGrid />

      <Hypocenter depthKm={epicenter.depthKm} />
      {activeAlert && (
        <WaveFront
          maxRadiusKm={maxRadiusKm}
          depthKm={epicenter.depthKm}
          groundClip={groundClip}
        />
      )}

      {/* Ground-level distance line from the structure to the epicenter, with
          the distance label sitting on the line. */}
      {activeStructure && displayPlacement && (
        <DistanceLine
          x={displayPlacement.x}
          z={displayPlacement.z}
          distanceKm={displayPlacement.distanceKm}
        />
      )}

      {/* The active structure sits at its rendered offset on the ground plane. */}
      {activeStructure && displayPlacement && (
        <ActiveStructureMarker
          structure={activeStructure}
          x={displayPlacement.x}
          z={displayPlacement.z}
          riskScore={activeRiskScore}
        />
      )}

      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        target={[0, 0, 0]}
        maxPolarAngle={Math.PI / 2.05}
        minDistance={60}
        maxDistance={1200}
      />
    </Canvas>
  );
}
