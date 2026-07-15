import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DEFAULT_ISS, type IssPosition } from "@shared";
import { useSimActions } from "../../sim/useSim";

/** Re-export for any UI that still imported the seed from the marker. */
export { DEFAULT_ISS };

const DEG = Math.PI / 180;
/** Real ISS inclination (schematic). */
const ISS_INCLINATION = 51.6 * DEG;
/**
 * Sim-seconds per LEO revolution at 1× time scale.
 * Compressed so motion is readable like planet paths on their rings.
 */
const ISS_PERIOD_SIM = 9.5;

/**
 * Point on a circular LEO in Earth-local frame.
 * Same idea as planet true-anomaly sampling: fixed plane + angle.
 */
export function issOrbitLocal(
  angle: number,
  radius: number,
  inclination = ISS_INCLINATION
): THREE.Vector3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const x = radius * c;
  const zOrb = radius * s;
  const y = -zOrb * Math.sin(inclination);
  const z = zOrb * Math.cos(inclination);
  return new THREE.Vector3(x, y, z);
}

/** Seed phase from live longitude so craft starts near telemetry. */
export function phaseFromIssTelemetry(iss: IssPosition): number {
  return ((iss.lon + 180) * DEG + Math.PI * 2) % (Math.PI * 2);
}

/**
 * LEO path as native THREE.Line — visible on the first frame (no Line2 resolution wait).
 */
function LeoOrbitRing({
  radius,
  inclination,
  focusMode,
}: {
  radius: number;
  inclination: number;
  focusMode: boolean;
}) {
  const line = useMemo(() => {
    const segs = 192;
    const positions = new Float32Array((segs + 1) * 3);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const p = issOrbitLocal(a, radius, inclination);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: focusMode ? 0.95 : 0.8,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      linewidth: 1, // WebGL max 1 on most GPUs; brightness via color/opacity
    });
    const obj = new THREE.Line(geo, mat);
    obj.frustumCulled = false;
    obj.renderOrder = 6;
    return obj;
  }, [radius, inclination, focusMode]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );

  return <primitive object={line} />;
}

/** Second faint ring for “thickness” (native lines are 1px). */
function LeoOrbitRingGlow({
  radius,
  inclination,
  focusMode,
}: {
  radius: number;
  inclination: number;
  focusMode: boolean;
}) {
  const line = useMemo(() => {
    const segs = 128;
    const positions = new Float32Array((segs + 1) * 3);
    // Slightly larger radius for halo
    const r = radius * 1.008;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const p = issOrbitLocal(a, r, inclination);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: focusMode ? 0.35 : 0.22,
      depthWrite: false,
      toneMapped: false,
    });
    const obj = new THREE.Line(geo, mat);
    obj.frustumCulled = false;
    obj.renderOrder = 5;
    return obj;
  }, [radius, inclination, focusMode]);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line]
  );

  return <primitive object={line} />;
}

type IssMarkerProps = {
  /** Live telemetry when available; omit to use DEFAULT_ISS for immediate ring */
  iss?: IssPosition | null;
  earthPos: THREE.Vector3;
  earthDisplayRadius: number;
  focusMode?: boolean;
};

/**
 * ISS rides a fixed LEO path like planets on their orbits.
 * Ring mounts immediately (does not wait for /api/iss).
 */
export default function IssMarker({
  iss,
  earthPos,
  earthDisplayRadius,
  focusMode = false,
}: IssMarkerProps) {
  const root = useRef<THREE.Group>(null);
  const craft = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Mesh>(null);
  const { simTimeRef } = useSimActions();

  const telemetry = iss ?? DEFAULT_ISS;
  const altFrac = focusMode ? 0.16 : 0.11;
  const orbitR = Math.max(earthDisplayRadius * (1 + altFrac), 0.5);
  const s = earthDisplayRadius * (focusMode ? 0.2 : 0.11);

  const phase0 = useRef(phaseFromIssTelemetry(telemetry));
  const phaseSim0 = useRef(simTimeRef.current);
  const seeded = useRef(false);
  const lastLon = useRef(telemetry.lon);

  useEffect(() => {
    if (!iss) return; // keep default phase until live data
    if (!seeded.current) {
      phase0.current = phaseFromIssTelemetry(iss);
      phaseSim0.current = simTimeRef.current;
      seeded.current = true;
      lastLon.current = iss.lon;
      return;
    }
    if (Math.abs(iss.lon - lastLon.current) > 2) {
      phase0.current = phaseFromIssTelemetry(iss);
      phaseSim0.current = simTimeRef.current;
      lastLon.current = iss.lon;
    }
  }, [iss, simTimeRef]);

  const tmpOut = useMemo(() => new THREE.Vector3(), []);
  const tmpTan = useMemo(() => new THREE.Vector3(), []);
  const tmpBin = useMemo(() => new THREE.Vector3(), []);
  const tmpMat = useMemo(() => new THREE.Matrix4(), []);
  const tmpLocal = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }) => {
    if (!root.current || !craft.current) return;

    root.current.position.copy(earthPos);

    const angle =
      phase0.current +
      ((simTimeRef.current - phaseSim0.current) / ISS_PERIOD_SIM) * Math.PI * 2;

    tmpLocal.copy(issOrbitLocal(angle, orbitR, ISS_INCLINATION));
    craft.current.position.copy(tmpLocal);

    const next = issOrbitLocal(angle + 0.03, orbitR, ISS_INCLINATION);
    tmpTan.copy(next).sub(tmpLocal).normalize();
    tmpOut.copy(tmpLocal).normalize();
    tmpBin.crossVectors(tmpOut, tmpTan);
    if (tmpBin.lengthSq() < 1e-8) tmpBin.set(0, 1, 0);
    tmpBin.normalize();
    tmpTan.crossVectors(tmpBin, tmpOut).normalize();
    tmpMat.makeBasis(tmpTan, tmpOut, tmpBin);
    craft.current.quaternion.setFromRotationMatrix(tmpMat);

    if (glow.current) {
      glow.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.8) * 0.12);
    }
  });

  return (
    <group ref={root} name="ISS-system">
      {/* Path first — native lines, no API wait, no Line2 resolution lag */}
      <LeoOrbitRing
        radius={orbitR}
        inclination={ISS_INCLINATION}
        focusMode={focusMode}
      />
      <LeoOrbitRingGlow
        radius={orbitR}
        inclination={ISS_INCLINATION}
        focusMode={focusMode}
      />

      <group ref={craft} name="ISS">
        <mesh ref={glow} renderOrder={4}>
          <sphereGeometry args={[s * 0.75, 16, 16]} />
          <meshBasicMaterial
            color="#7dd3fc"
            transparent
            opacity={focusMode ? 0.32 : 0.22}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh>
          <boxGeometry args={[s * 2.4, s * 0.12, s * 0.12]} />
          <meshStandardMaterial
            color="#cbd5e1"
            metalness={0.65}
            roughness={0.35}
            emissive="#94a3b8"
            emissiveIntensity={0.2}
          />
        </mesh>

        <mesh position={[0, s * 0.08, 0]}>
          <cylinderGeometry args={[s * 0.22, s * 0.22, s * 0.7, 12]} />
          <meshStandardMaterial
            color="#f1f5f9"
            metalness={0.4}
            roughness={0.4}
            emissive="#e2e8f0"
            emissiveIntensity={0.25}
          />
        </mesh>
        <mesh position={[s * 0.35, s * 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[s * 0.16, s * 0.16, s * 0.45, 10]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.35} roughness={0.45} />
        </mesh>
        <mesh position={[-s * 0.35, s * 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[s * 0.14, s * 0.14, s * 0.4, 10]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.35} roughness={0.45} />
        </mesh>

        <mesh position={[0, s * 0.42, 0]}>
          <sphereGeometry
            args={[s * 0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0ea5e9"
            emissiveIntensity={focusMode ? 0.75 : 0.45}
            metalness={0.2}
            roughness={0.25}
            transparent
            opacity={0.92}
          />
        </mesh>

        {(
          [
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ] as const
        ).map(([sx, sz], i) => (
          <mesh
            key={i}
            position={[sx * s * 1.55, 0, sz * s * 0.35]}
            rotation={[0, 0, sx > 0 ? 0.05 : -0.05]}
          >
            <boxGeometry args={[s * 1.35, s * 0.035, s * 0.55]} />
            <meshStandardMaterial
              color="#1e3a8a"
              emissive="#1d4ed8"
              emissiveIntensity={focusMode ? 0.6 : 0.4}
              metalness={0.55}
              roughness={0.3}
            />
          </mesh>
        ))}

        <mesh position={[0, -s * 0.15, s * 0.35]}>
          <boxGeometry args={[s * 0.9, s * 0.02, s * 0.35]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.2} roughness={0.5} />
        </mesh>

        <mesh position={[0, s * 0.55, 0]}>
          <sphereGeometry args={[s * 0.09, 10, 10]} />
          <meshBasicMaterial color="#f0f9ff" toneMapped={false} />
        </mesh>
        <pointLight
          color="#7dd3fc"
          intensity={focusMode ? 2.4 : 1.1}
          distance={earthDisplayRadius * (focusMode ? 4.5 : 2.2)}
          decay={2}
        />
      </group>
    </group>
  );
}
