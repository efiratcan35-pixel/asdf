'use client';

import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';

export type BuildingType = 'STEEL_FULL' | 'RC_COL_STEEL_ROOF' | 'RC_FULL_PRECAST';
type Vec3 = [number, number, number];

function Beam({
  start,
  end,
  thickness = 0.18,
  color = '#475569',
}: {
  start: Vec3;
  end: Vec3;
  thickness?: number;
  color?: string;
}) {
  const { length, position, quaternion } = useMemo(() => {
    const s = new THREE.Vector3(start[0], start[1], start[2]);
    const e = new THREE.Vector3(end[0], end[1], end[2]);
    const dir = e.clone().sub(s);
    const len = Math.max(0.001, dir.length());
    const mid = s.clone().add(e).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      dir.clone().normalize(),
    );

    return {
      length: len,
      position: [mid.x, mid.y, mid.z] as Vec3,
      quaternion: q,
    };
  }, [end, start]);

  return (
    <mesh position={position} quaternion={quaternion} castShadow>
      <boxGeometry args={[length, thickness, thickness]} />
      <meshStandardMaterial color={color} metalness={0.8} roughness={0.25} />
    </mesh>
  );
}

function SteelColumnHEA({
  x,
  z,
  height,
  color = '#334155',
}: {
  x: number;
  z: number;
  height: number;
  color?: string;
}) {
  const flangeWidth = 0.38;
  const flangeThickness = 0.045;
  const webThickness = 0.02;
  const webDepth = 0.3;

  return (
    <group position={[x, height / 2, z]}>
      <mesh castShadow>
        <boxGeometry args={[webThickness, height, webDepth]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0, webDepth / 2 - flangeThickness / 2]}>
        <boxGeometry args={[flangeWidth, height, flangeThickness]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh castShadow position={[0, 0, -webDepth / 2 + flangeThickness / 2]}>
        <boxGeometry args={[flangeWidth, height, flangeThickness]} />
        <meshStandardMaterial color={color} metalness={0.85} roughness={0.3} />
      </mesh>
    </group>
  );
}

function ConcreteColumn({ x, z, height }: { x: number; z: number; height: number }) {
  return (
    <mesh position={[x, height / 2, z]} castShadow>
      <boxGeometry args={[0.45, height, 0.45]} />
      <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
    </mesh>
  );
}

function PrecastFilledTruss({
  x,
  zMid,
  span,
  eaveY,
  ridgeY,
}: {
  x: number;
  zMid: number;
  span: number;
  eaveY: number;
  ridgeY: number;
}) {
  const rise = Math.max(0.2, ridgeY - eaveY);
  const depth = 0.24;
  const geometry = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-span / 2, 0);
    s.lineTo(0, rise);
    s.lineTo(span / 2, 0);
    s.lineTo(-span / 2, 0);

    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, -depth / 2);
    return g;
  }, [depth, rise, span]);

  return (
    <mesh
      position={[x, eaveY, zMid]}
      rotation={[0, Math.PI / 2, 0]}
      castShadow
      receiveShadow
      geometry={geometry}
    >
      <meshStandardMaterial color="#374151" roughness={0.82} metalness={0.05} />
    </mesh>
  );
}

function RoofCladding({
  length,
  width,
  hallCount,
  eaveY,
  ridgeY,
  transparent,
}: {
  length: number;
  width: number;
  hallCount: number;
  eaveY: number;
  ridgeY: number;
  transparent: boolean;
}) {
  const safeHallCount = Math.max(1, Math.floor(hallCount));
  const halfW = width / 2;
  const hallWidth = width / safeHallCount;
  const halfHall = hallWidth / 2;
  const slopeAngle = Math.atan2(ridgeY - eaveY, halfHall);
  const roofDepth = Math.sqrt(halfHall * halfHall + (ridgeY - eaveY) * (ridgeY - eaveY));
  const hallCenters = Array.from(
    { length: safeHallCount },
    (_, i) => -halfW + hallWidth * i + hallWidth / 2,
  );

  return (
    <>
      {hallCenters.map((zMid) => (
        <group key={`roof-${zMid}`}>
          <mesh
            position={[0, (eaveY + ridgeY) / 2 + 0.05, zMid - halfHall / 2]}
            rotation={[-slopeAngle, 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[length, 0.06, roofDepth]} />
            <meshStandardMaterial
              color={transparent ? '#9ec9ff' : '#94a3b8'}
              transparent={transparent}
              opacity={transparent ? 0.4 : 1}
              metalness={0.2}
              roughness={0.55}
            />
          </mesh>

          <mesh
            position={[0, (eaveY + ridgeY) / 2 + 0.05, zMid + halfHall / 2]}
            rotation={[slopeAngle, 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[length, 0.06, roofDepth]} />
            <meshStandardMaterial
              color={transparent ? '#9ec9ff' : '#94a3b8'}
              transparent={transparent}
              opacity={transparent ? 0.4 : 1}
              metalness={0.2}
              roughness={0.55}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

function BuildingModel({
  buildingType,
  length,
  width,
  height,
  baySpacing,
  hallCount,
  hasCraneBeam,
}: {
  buildingType: BuildingType;
  length: number;
  width: number;
  height: number;
  baySpacing: number;
  hallCount: number;
  hasCraneBeam: boolean;
}) {
  const frameCount = Math.max(2, Math.floor(length / baySpacing) + 1);
  const frameXs = Array.from({ length: frameCount }, (_, i) =>
    -length / 2 + (i * length) / Math.max(1, frameCount - 1),
  );

  const halfW = width / 2;
  const eaveY = height;
  const clearHallCount = Math.max(1, Math.floor(hallCount));
  const hallWidth = width / clearHallCount;
  const roofSlopeDeg = 10;
  const roofSlopeRad = (roofSlopeDeg * Math.PI) / 180;
  const ridgeRise = (hallWidth / 2) * Math.tan(roofSlopeRad);
  const ridgeY = eaveY + ridgeRise;
  const hallEdges = Array.from({ length: clearHallCount + 1 }, (_, i) => -halfW + hallWidth * i);
  const hallCenters = Array.from(
    { length: clearHallCount },
    (_, i) => -halfW + hallWidth * i + hallWidth / 2,
  );

  const interiorZs = hallEdges.slice(1, -1);

  return (
    <group>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[length + 10, 0.2, width + 10]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      {frameXs.map((x) => (
        <group key={`frame-${x}`}>
          {buildingType === 'STEEL_FULL' ? (
            <>
              <SteelColumnHEA x={x} z={-halfW} height={eaveY} color="#2563eb" />
              <SteelColumnHEA x={x} z={halfW} height={eaveY} color="#2563eb" />
            </>
          ) : (
            <>
              <ConcreteColumn x={x} z={-halfW} height={eaveY} />
              <ConcreteColumn x={x} z={halfW} height={eaveY} />
            </>
          )}

          {interiorZs.map((zVal) =>
            buildingType === 'STEEL_FULL' ? (
              <SteelColumnHEA
                key={`int-steel-${x}-${zVal}`}
                x={x}
                z={zVal}
                height={eaveY * 0.92}
                color="#2563eb"
              />
            ) : (
              <ConcreteColumn key={`int-conc-${x}-${zVal}`} x={x} z={zVal} height={eaveY * 0.92} />
            ),
          )}

          {hallEdges.slice(0, -1).map((z0, hallIdx) => {
            const z1 = hallEdges[hallIdx + 1];
            const zMid = (z0 + z1) / 2;

            return buildingType !== 'RC_FULL_PRECAST' ? (
              <group key={`truss-${x}-${hallIdx}`}>
                <Beam start={[x, eaveY, z0]} end={[x, ridgeY, zMid]} thickness={0.14} color="#475569" />
                <Beam start={[x, ridgeY, zMid]} end={[x, eaveY, z1]} thickness={0.14} color="#475569" />
                <Beam start={[x, eaveY * 0.94, z0]} end={[x, eaveY * 0.94, z1]} thickness={0.11} color="#64748b" />
              </group>
            ) : (
              <group key={`truss-precast-${x}-${hallIdx}`}>
                <PrecastFilledTruss x={x} zMid={zMid} span={z1 - z0} eaveY={eaveY} ridgeY={ridgeY} />
                <Beam start={[x, eaveY * 0.98, z0]} end={[x, eaveY * 0.98, z1]} thickness={0.14} color="#374151" />
              </group>
            );
          })}
        </group>
      ))}

      {frameXs.length > 1 &&
        frameXs.slice(0, -1).map((x, i) => {
          const x2 = frameXs[i + 1];
          return (
            <group key={`long-${x}`}>
              {hallEdges.map((zEdge) => (
                <Beam key={`long-eave-${x}-${zEdge}`} start={[x, eaveY, zEdge]} end={[x2, eaveY, zEdge]} thickness={0.1} color="#52525b" />
              ))}

              {hallCenters.map((zMid) => (
                <Beam
                  key={`long-ridge-${x}-${zMid}`}
                  start={[x, ridgeY, zMid]}
                  end={[x2, ridgeY, zMid]}
                  thickness={buildingType === 'RC_FULL_PRECAST' ? 0.16 : 0.1}
                  color={buildingType === 'RC_FULL_PRECAST' ? '#374151' : '#334155'}
                />
              ))}
            </group>
          );
        })}

      <RoofCladding
        length={length}
        width={width}
        hallCount={clearHallCount}
        eaveY={eaveY}
        ridgeY={ridgeY}
        transparent
      />

      {hasCraneBeam && (
        <>
          <Beam
            start={[-length / 2, eaveY * 0.72, -halfW * 0.9]}
            end={[length / 2, eaveY * 0.72, -halfW * 0.9]}
            thickness={0.2}
            color="#ca8a04"
          />
          <Beam
            start={[-length / 2, eaveY * 0.72, halfW * 0.9]}
            end={[length / 2, eaveY * 0.72, halfW * 0.9]}
            thickness={0.2}
            color="#ca8a04"
          />
          <mesh position={[0, eaveY * 0.72, 0]} castShadow>
            <boxGeometry args={[0.4, 0.4, width * 1.75]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.3} />
          </mesh>
        </>
      )}
    </group>
  );
}

export default function ConfiguratorCanvas({
  buildingType,
  lengthM,
  widthM,
  heightM,
  baySpacingM,
  hallCount,
  hasCraneBeam,
}: {
  buildingType: BuildingType;
  lengthM: number;
  widthM: number;
  heightM: number;
  baySpacingM: number;
  hallCount: number;
  hasCraneBeam: boolean;
}) {
  return (
    <Canvas shadows dpr={[1, 2]}>
      <color attach="background" args={['#f8fafc']} />
      <ambientLight intensity={0.65} />
      <directionalLight
        position={[28, 36, 20]}
        intensity={1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <PerspectiveCamera makeDefault position={[55, 34, 46]} fov={45} />
      <OrbitControls enableDamping dampingFactor={0.08} target={[0, heightM / 2, 0]} />
      <BuildingModel
        buildingType={buildingType}
        length={Math.max(10, lengthM) / 2}
        width={Math.max(10, widthM) / 2}
        height={Math.max(4, heightM) / 2}
        baySpacing={Math.max(4, baySpacingM) / 2}
        hallCount={Math.max(1, hallCount)}
        hasCraneBeam={hasCraneBeam}
      />
      <gridHelper args={[300, 60, '#94a3b8', '#e2e8f0']} position={[0, -0.09, 0]} />
    </Canvas>
  );
}
