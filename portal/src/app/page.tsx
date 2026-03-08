'use client';

import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import TopBar from '@/components/TopBar';
import { useAuth } from '@/lib/auth';

type BuildingType = 'STEEL_FULL' | 'RC_COL_STEEL_ROOF' | 'RC_FULL_PRECAST';
type Vec3 = [number, number, number];

type Row = {
  key: string;
  label: string;
  qty: number;
  unit: string;
  unitPrice: number;
};

const UNIT_PRICES = {
  concreteM3: 3200,
  steelTon: 42000,
  panelM2: 950,
  roofM2: 1150,
  doorUnit: 55000,
  rampUnit: 28000,
  craneBeamTon: 42000,
} as const;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3000';

type ProjectItem = {
  id: number;
  name: string | null;
  buildingType: BuildingType;
  lengthM: number;
  widthM: number;
  heightM: number;
  createdAt: string;
};

function formatTry(value: number) {
  return new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNum(value: number) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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
    <mesh position={[x, eaveY, zMid]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow geometry={geometry}>
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
  const hallEdges = Array.from(
    { length: clearHallCount + 1 },
    (_, i) => -halfW + hallWidth * i,
  );
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
                <Beam start={[x, eaveY * 0.95, z0 + (zMid - z0) * 0.6]} end={[x, ridgeY * 0.98, zMid]} thickness={0.07} color="#64748b" />
                <Beam start={[x, ridgeY * 0.98, zMid]} end={[x, eaveY * 0.95, zMid + (z1 - zMid) * 0.6]} thickness={0.07} color="#64748b" />
                <Beam start={[x, eaveY * 0.94, z0]} end={[x, ridgeY * 0.9, z0 + (zMid - z0) * 0.35]} thickness={0.06} color="#475569" />
                <Beam start={[x, ridgeY * 0.9, z0 + (zMid - z0) * 0.35]} end={[x, eaveY * 0.94, zMid]} thickness={0.06} color="#475569" />
                <Beam start={[x, eaveY * 0.94, zMid]} end={[x, ridgeY * 0.9, zMid + (z1 - zMid) * 0.35]} thickness={0.06} color="#475569" />
                <Beam start={[x, ridgeY * 0.9, zMid + (z1 - zMid) * 0.35]} end={[x, eaveY * 0.94, z1]} thickness={0.06} color="#475569" />
              </group>
            ) : (
              <group key={`truss-precast-${x}-${hallIdx}`}>
                <PrecastFilledTruss x={x} zMid={zMid} span={z1 - z0} eaveY={eaveY} ridgeY={ridgeY} />
                <Beam start={[x, eaveY * 0.98, z0]} end={[x, eaveY * 0.98, z1]} thickness={0.14} color="#374151" />
                <Beam start={[x, ridgeY, zMid]} end={[x, eaveY * 0.98, zMid]} thickness={0.1} color="#4b5563" />
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

export default function HomePage() {
  const { token, user } = useAuth();
  const [buildingType, setBuildingType] = useState<BuildingType>('STEEL_FULL');
  const [lengthM, setLengthM] = useState(60);
  const [widthM, setWidthM] = useState(30);
  const [heightM, setHeightM] = useState(10);
  const [hallCount, setHallCount] = useState(2);
  const [baySpacingM, setBaySpacingM] = useState(6);
  const [doorCount, setDoorCount] = useState(2);
  const [hasCraneBeam, setHasCraneBeam] = useState(false);
  const [hasLoadingRamp, setHasLoadingRamp] = useState(false);
  const [rampCount, setRampCount] = useState(1);
  const [constraintMsg, setConstraintMsg] = useState<string | null>(null);
  const [popupMsg, setPopupMsg] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [savingProject, setSavingProject] = useState(false);

  const minHallCount = 1;
  const maxHallCount = Math.max(1, Math.floor(lengthM / 10));
  const hallCountSafe = clamp(hallCount, minHallCount, maxHallCount);
  const mhg = widthM / Math.max(1, hallCountSafe);
  const isMhgOverLimit = mhg > 50;
  const overLimitPopupText =
    "Hol Genişliğini 50 m'den fazla yapmaya çalışıyorsunuz. Max Hol Genişliği 50 m olabilir";

  function onWidthChange(nextRaw: number) {
    const next = clamp(nextRaw, 10, 200);
    const maxAllowed = Math.min(200, hallCountSafe * 50);
    if (next > maxAllowed) {
      setConstraintMsg("Maksimum Hol Genişliği 50 m'ye aşamaz");
      setPopupMsg(overLimitPopupText);
      return;
    }
    setConstraintMsg(null);
    setWidthM(next);
  }

  function onHallCountChange(nextRaw: number) {
    const next = clamp(nextRaw, minHallCount, maxHallCount);
    if (widthM / Math.max(1, next) > 50) {
      setConstraintMsg("Maksimum Hol Genişliği 50 m'ye aşamaz");
      setPopupMsg(overLimitPopupText);
      return;
    }
    setConstraintMsg(null);
    setHallCount(next);
  }

  const isInvestor = user?.role === 'investor';

  useEffect(() => {
    if (!token || !isInvestor) return;

    let cancelled = false;
    const fetchProjects = async () => {
      setProjectsLoading(true);
      setProjectsError(null);
      try {
        const res = await fetch(`${API_BASE}/projects`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Projeler getirilemedi');
        const data = (await res.json()) as ProjectItem[];
        if (!cancelled) setProjects(data);
      } catch (e: unknown) {
        if (!cancelled) setProjectsError(e instanceof Error ? e.message : 'Projeler getirilemedi');
      } finally {
        if (!cancelled) setProjectsLoading(false);
      }
    };

    fetchProjects();
    return () => {
      cancelled = true;
    };
  }, [isInvestor, token]);

  async function saveCurrentProject() {
    if (!token || !isInvestor) return;

    setSavingProject(true);
    setProjectsError(null);
    try {
      const maxProjectNo = projects.reduce((max, p) => {
        const m = (p.name ?? '').match(/^Proje\s+(\d+)$/i);
        return m ? Math.max(max, Number(m[1])) : max;
      }, 0);
      const nextName = `Proje ${maxProjectNo + 1}`;

      const payload = {
        name: nextName,
        buildingType,
        lengthM,
        widthM,
        heightM,
        hasCraneBeam,
        hasLoadingRamp,
        rampCount: hasLoadingRamp ? rampCount : 0,
        doorCount,
        baySpacingM,
        hallCount: hallCountSafe,
      };

      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message ?? 'Proje kaydedilemedi');
      }

      const created = (await res.json()) as ProjectItem;
      setProjects((prev) => [created, ...prev]);
    } catch (e: unknown) {
      setProjectsError(e instanceof Error ? e.message : 'Proje kaydedilemedi');
    } finally {
      setSavingProject(false);
    }
  }

  const calc = useMemo(() => {
    const areaM2 = lengthM * widthM;
    const perimeterM = 2 * (lengthM + widthM);
    const roofM2 = areaM2 * 1.08;
    const panelM2 = perimeterM * heightM;
    const hallWidthM = widthM / Math.max(1, hallCountSafe);

    const steelFactorByType: Record<BuildingType, number> = {
      STEEL_FULL: 0.041,
      RC_COL_STEEL_ROOF: 0.028,
      RC_FULL_PRECAST: 0.016,
    };

    const concreteFactorByType: Record<BuildingType, number> = {
      STEEL_FULL: 1,
      RC_COL_STEEL_ROOF: 1.45,
      RC_FULL_PRECAST: 1.7,
    };

    const concreteM3 = perimeterM * 0.6 * 0.5 * concreteFactorByType[buildingType];
    const steelTon = areaM2 * steelFactorByType[buildingType];
    const craneBeamTon = hasCraneBeam ? lengthM * 0.018 : 0;
    const effectiveRampCount = hasLoadingRamp ? Math.max(1, rampCount) : 0;

    const rows: Row[] = [
      { key: 'concrete', label: 'Temel betonu', qty: concreteM3, unit: 'm3', unitPrice: UNIT_PRICES.concreteM3 },
      { key: 'steel', label: 'Tasiyici celik', qty: steelTon, unit: 'ton', unitPrice: UNIT_PRICES.steelTon },
      { key: 'roof', label: 'Cati paneli', qty: roofM2, unit: 'm2', unitPrice: UNIT_PRICES.roofM2 },
      { key: 'wall', label: 'Cephe paneli', qty: panelM2, unit: 'm2', unitPrice: UNIT_PRICES.panelM2 },
      { key: 'doors', label: 'Seksiyonel kapi', qty: doorCount, unit: 'adet', unitPrice: UNIT_PRICES.doorUnit },
      { key: 'ramps', label: 'Yukleme rampasi', qty: effectiveRampCount, unit: 'adet', unitPrice: UNIT_PRICES.rampUnit },
    ];

    if (hasCraneBeam) {
      rows.push({
        key: 'crane',
        label: 'Kren kirisi',
        qty: craneBeamTon,
        unit: 'ton',
        unitPrice: UNIT_PRICES.craneBeamTon,
      });
    }

    const withCost = rows.map((r) => ({ ...r, total: r.qty * r.unitPrice }));
    const totalCost = withCost.reduce((sum, r) => sum + r.total, 0);

    return { areaM2, hallWidthM, withCost, totalCost };
  }, [
    buildingType,
    doorCount,
    hallCountSafe,
    hasCraneBeam,
    hasLoadingRamp,
    heightM,
    lengthM,
    rampCount,
    widthM,
  ]);

  return (
    <div className="min-h-screen bg-gray-100">
      {popupMsg && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setPopupMsg(null)}
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-lg font-semibold text-red-700">Uyarı</div>
            <p className="mt-2 text-sm text-gray-700">{popupMsg}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                className="rounded-md bg-black px-4 py-2 text-sm text-white"
                onClick={() => setPopupMsg(null)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
      <TopBar />
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <section className="rounded-2xl border bg-white p-4 shadow-sm md:p-6">
          <div className="mb-4">
            <h1 className="text-xl font-semibold md:text-2xl">3D Configurator</h1>
            <p className="text-sm text-gray-600">
              Cati makasi, kolonlar, seffaf cati kaplamasi ve opsiyonel kren kirisi ile canli model.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="rounded-xl border p-4 lg:col-span-3">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
                <label className="text-sm">
                  <div className="mb-1 font-medium">Bina tipi</div>
                  <select
                    className="w-full rounded-md border px-2 py-1.5"
                    value={buildingType}
                    onChange={(e) => setBuildingType(e.target.value as BuildingType)}
                  >
                    <option value="STEEL_FULL">1) Tam celik (HEA300 benzeri kolon)</option>
                    <option value="RC_COL_STEEL_ROOF">2) Beton kolon + celik cati</option>
                    <option value="RC_FULL_PRECAST">3) Tam prekast</option>
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Uzunluk (m)</div>
                  <input
                    className="w-full"
                    type="range"
                    min={10}
                    max={200}
                    step={1}
                    value={lengthM}
                    onChange={(e) => setLengthM(clamp(Number(e.target.value), 10, 200))}
                  />
                  <div className="text-xs text-gray-600">{formatNum(lengthM)} m</div>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Genislik (m)</div>
                  <input
                    className="w-full"
                    type="range"
                    min={10}
                    max={200}
                    step={1}
                    value={widthM}
                    onChange={(e) => onWidthChange(Number(e.target.value))}
                  />
                  <div className="text-xs text-gray-600">
                    {formatNum(widthM)} m (max 200 m)
                  </div>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Yukseklik (m)</div>
                  <input
                    className="w-full"
                    type="range"
                    min={4}
                    max={20}
                    step={1}
                    value={heightM}
                    onChange={(e) => setHeightM(clamp(Number(e.target.value), 4, 20))}
                  />
                  <div className="text-xs text-gray-600">{formatNum(heightM)} m</div>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Hol sayisi</div>
                  <input
                    className="w-full"
                    type="range"
                    min={minHallCount}
                    max={maxHallCount}
                    step={1}
                    value={hallCountSafe}
                    onChange={(e) => onHallCountChange(Number(e.target.value))}
                  />
                  <div className="text-xs text-gray-600">
                    {hallCountSafe} (min {minHallCount} - max {maxHallCount})
                  </div>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Aks araligi (m)</div>
                  <input
                    className="w-full"
                    type="range"
                    min={4}
                    max={10}
                    step={0.5}
                    value={baySpacingM}
                    onChange={(e) => setBaySpacingM(clamp(Number(e.target.value), 4, 10))}
                  />
                  <div className="text-xs text-gray-600">{formatNum(baySpacingM)} m</div>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Kapi adedi</div>
                  <input
                    className="w-full"
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={doorCount}
                    onChange={(e) => setDoorCount(clamp(Number(e.target.value), 1, 10))}
                  />
                  <div className="text-xs text-gray-600">{doorCount} adet</div>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-medium">Rampa adedi</div>
                  <input
                    className="w-full"
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={rampCount}
                    onChange={(e) => setRampCount(clamp(Number(e.target.value), 1, 8))}
                    disabled={!hasLoadingRamp}
                  />
                  <div className="text-xs text-gray-600">{rampCount} adet</div>
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasCraneBeam}
                    onChange={(e) => setHasCraneBeam(e.target.checked)}
                  />
                  Kren kirisi ekle
                </label>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hasLoadingRamp}
                    onChange={(e) => setHasLoadingRamp(e.target.checked)}
                  />
                  Yukleme rampasi
                </label>
              </div>

              <div className="mt-4 rounded-md bg-gray-50 p-3 text-sm">
                <div>Alan: {formatNum(calc.areaM2)} m2</div>
                <div>MHG (L / Hol Sayisi): {formatNum(mhg)} m</div>
                <div>Hol genisligi (En / Hol): {formatNum(calc.hallWidthM)} m</div>
                <div>Aks araligi: {formatNum(baySpacingM)} m</div>
                {(isMhgOverLimit || constraintMsg) && (
                  <div className="mt-1 rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                    {constraintMsg ?? "Maksimum Hol Genişliği 50 m'ye aşamaz"}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-gray-50 lg:col-span-5">
              <div className="h-[500px] w-full">
                <Canvas shadows>
                  <PerspectiveCamera makeDefault position={[38, 24, 42]} />
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[30, 40, 20]} intensity={0.85} castShadow />
                  <BuildingModel
                    buildingType={buildingType}
                    length={Math.max(10, lengthM) / 2}
                    width={Math.max(10, widthM) / 2}
                    height={Math.max(4, heightM) / 2}
                    baySpacing={Math.max(4, baySpacingM) / 2}
                    hallCount={Math.max(1, hallCountSafe)}
                    hasCraneBeam={hasCraneBeam}
                  />
                  <gridHelper args={[90, 45, '#94a3b8', '#cbd5e1']} />
                  <OrbitControls enablePan enableZoom enableRotate />
                </Canvas>
              </div>
            </div>

            <div className="rounded-xl border p-4 lg:col-span-4">
              <h2 className="mb-3 text-lg font-semibold">Maliyet Tablosu</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="py-2 pr-2">Kalem</th>
                      <th className="py-2 pr-2">Miktar</th>
                      <th className="py-2 pr-2">Birim</th>
                      <th className="py-2 pr-2">Tutar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.withCost.map((row) => (
                      <tr key={row.key} className="border-b last:border-b-0">
                        <td className="py-2 pr-2">{row.label}</td>
                        <td className="py-2 pr-2">{formatNum(row.qty)}</td>
                        <td className="py-2 pr-2">{row.unit}</td>
                        <td className="py-2 pr-2">{formatTry(row.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 rounded-md bg-black px-3 py-2 text-right text-sm font-semibold text-white">
                Toplam: {formatTry(calc.totalCost)}
              </div>

              {isInvestor && (
                <div className="mt-4 rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold">Projelerim</div>
                    <button
                      type="button"
                      disabled={savingProject || isMhgOverLimit}
                      onClick={saveCurrentProject}
                      className="rounded-md bg-black px-3 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      {savingProject ? 'Kaydediliyor...' : 'Bu Konfigurasyonu Kaydet'}
                    </button>
                  </div>

                  {projectsLoading && <div className="text-xs text-gray-500">Projeler yukleniyor...</div>}
                  {projectsError && <div className="text-xs text-red-600">{projectsError}</div>}
                  {!projectsLoading && projects.length === 0 && (
                    <div className="text-xs text-gray-500">Henuz kayitli proje yok.</div>
                  )}
                  {projects.length > 0 && (
                    <ul className="space-y-1 text-xs">
                      {projects.slice(0, 8).map((p) => (
                        <li key={p.id} className="rounded border px-2 py-1">
                          <span className="font-medium">{p.name ?? `Proje ${p.id}`}</span>
                          <span className="ml-2 text-gray-500">
                            {formatNum(p.lengthM)}x{formatNum(p.widthM)}x{formatNum(p.heightM)} m
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
