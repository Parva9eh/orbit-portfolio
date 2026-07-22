import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

type Meteor = {
  /** Unit direction of streak start (on sky sphere) */
  origin: THREE.Vector3;
  /** Unit travel direction (tangent on sphere) */
  dir: THREE.Vector3;
  /** Seconds since spawn */
  age: number;
  /** Total lifetime seconds */
  life: number;
  /** Angular length of trail (radians-ish scale on sphere) */
  length: number;
  /** Brightness 0–1 */
  bright: number;
  /** Speed along path (units / s on radius sphere) */
  speed: number;
};

const SKY_R = 190;
/** Fewer segments still look smooth; cuts CPU write cost */
const SEGMENTS = 6;
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _bitan = new THREE.Vector3();
const _xAxis = new THREE.Vector3(1, 0, 0);

function randomOnSphere(out: THREE.Vector3) {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  out.set(
    Math.sin(phi) * Math.cos(theta),
    Math.sin(phi) * Math.sin(theta),
    Math.cos(phi),
  );
  return out;
}

function spawnMeteor(pool: Meteor[], maxActive: number) {
  if (pool.length >= maxActive) return;
  const origin = randomOnSphere(_origin).clone();
  _dir.crossVectors(origin, _up);
  if (_dir.lengthSq() < 1e-6) _dir.crossVectors(origin, _xAxis);
  _dir.normalize();
  const angle = Math.random() * Math.PI * 2;
  _bitan.crossVectors(origin, _dir).normalize();
  const dir = _dir
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(_bitan, Math.sin(angle))
    .normalize();

  pool.push({
    origin,
    dir,
    age: 0,
    life: 0.35 + Math.random() * 0.75,
    length: 0.04 + Math.random() * 0.1,
    bright: 0.55 + Math.random() * 0.45,
    speed: 0.35 + Math.random() * 0.55,
  });
}

type MeteorsProps = {
  /** Max simultaneous streaks */
  maxActive?: number;
  /** Mean seconds between spawn attempts */
  spawnInterval?: number;
};

/**
 * Occasional shooting-star streaks on the camera-locked sky sphere.
 * Atmospheric metaphor for ambience — not physical meteoroid orbits.
 */
export default function Meteors({
  maxActive = 5,
  spawnInterval = 2.2,
}: MeteorsProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.LineSegments>(null);
  const pool = useRef<Meteor[]>([]);
  const spawnTimer = useRef(0.4 + Math.random() * 1.2);

  const { positions, colors } = useMemo(() => {
    // maxActive * SEGMENTS * 2 verts per segment
    const maxVerts = maxActive * SEGMENTS * 2;
    return {
      positions: new Float32Array(maxVerts * 3),
      colors: new Float32Array(maxVerts * 4),
    };
  }, [maxActive]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 4));
    g.setDrawRange(0, 0);
    return g;
  }, [positions, colors]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        vertexShader: /* glsl */ `
          attribute vec4 color;
          varying vec4 vColor;
          void main() {
            vColor = color;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_Position.z = gl_Position.w * 0.9999;
          }
        `,
        fragmentShader: /* glsl */ `
          varying vec4 vColor;
          void main() {
            if (vColor.a < 0.02) discard;
            gl_FragColor = vec4(vColor.rgb * vColor.a, vColor.a);
          }
        `,
      }),
    [],
  );

  useEffect(
    () => () => {
      geom.dispose();
      mat.dispose();
    },
    [geom, mat],
  );

  useFrame((state, dt) => {
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position);
    }

    const list = pool.current;
    const hadAny = list.length > 0;

    // Spawn (occasionally two close together for a denser feel)
    spawnTimer.current -= dt;
    if (spawnTimer.current <= 0) {
      spawnMeteor(list, maxActive);
      if (Math.random() < 0.35) spawnMeteor(list, maxActive);
      spawnTimer.current = spawnInterval * (0.4 + Math.random() * 0.95);
    }

    // Age & cull
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].age += dt;
      if (list[i].age >= list[i].life) list.splice(i, 1);
    }

    // Idle: skip buffer uploads (orbit sim may still drive frames)
    if (list.length === 0) {
      if (hadAny) {
        geom.setDrawRange(0, 0);
        geom.attributes.color.needsUpdate = true;
      }
      return;
    }

    // Write line segments: each meteor = SEGMENTS short edges along path
    let vi = 0;
    for (const m of list) {
      const t = m.age / m.life;
      const envelope = Math.sin(Math.min(1, Math.max(0, t)) * Math.PI);
      const headDist = m.speed * m.age;
      const trail = m.length * (0.35 + 0.65 * envelope);

      for (let s = 0; s < SEGMENTS; s++) {
        const u0 = s / SEGMENTS;
        const u1 = (s + 1) / SEGMENTS;
        const d0 = headDist - trail * (1 - u0);
        const d1 = headDist - trail * (1 - u1);

        _tmp
          .copy(m.origin)
          .addScaledVector(m.dir, d0)
          .normalize()
          .multiplyScalar(SKY_R);
        _tmp2
          .copy(m.origin)
          .addScaledVector(m.dir, d1)
          .normalize()
          .multiplyScalar(SKY_R);

        const i0 = vi * 3;
        positions[i0] = _tmp.x;
        positions[i0 + 1] = _tmp.y;
        positions[i0 + 2] = _tmp.z;
        positions[i0 + 3] = _tmp2.x;
        positions[i0 + 4] = _tmp2.y;
        positions[i0 + 5] = _tmp2.z;

        const a0 = envelope * m.bright * (0.15 + 0.85 * u0);
        const a1 = envelope * m.bright * (0.15 + 0.85 * u1);
        const c0 = vi * 4;
        colors[c0] = 0.75 + 0.25 * u0;
        colors[c0 + 1] = 0.82 + 0.12 * u0;
        colors[c0 + 2] = 1.0;
        colors[c0 + 3] = a0;
        colors[c0 + 4] = 0.85 + 0.15 * u1;
        colors[c0 + 5] = 0.9 + 0.1 * u1;
        colors[c0 + 6] = 1.0;
        colors[c0 + 7] = a1;

        vi += 2;
      }
    }

    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    geom.setDrawRange(0, vi);
  });

  return (
    <group ref={groupRef} renderOrder={-25} raycast={() => null}>
      <lineSegments
        ref={lineRef}
        geometry={geom}
        material={mat}
        frustumCulled={false}
        raycast={() => null}
      />
    </group>
  );
}
