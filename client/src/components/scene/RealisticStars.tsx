import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Dense, camera-locked star field matching the cinematic mock:
 * more stars along the galactic band, a few bright sparkles, soft twinkle.
 */
export default function RealisticStars({ count = 7000 }: { count?: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const { positions, colors, phases, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const sizes = new Float32Array(count);
    const col = new THREE.Color();

    // Match MilkyWaySky toGalactic inverse: yaw +18°, tilt 48°, roll -28°
    const cy = 0.9511;
    const sy = 0.309;
    const ct = 0.6694;
    const st = 0.7431;
    const cr = 0.8829;
    const sr = -0.4695;

    for (let i = 0; i < count; i++) {
      let gx: number;
      let gy: number;
      let gz: number;
      // ~68% hug the plane for a dense band
      if (Math.random() < 0.68) {
        const lon = Math.random() * Math.PI * 2;
        const lat =
          (Math.random() + Math.random() + Math.random() - 1.5) * 0.2;
        const cl = Math.cos(lat);
        gx = Math.cos(lon) * cl;
        gy = Math.sin(lat);
        gz = Math.sin(lon) * cl;
      } else {
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        gx = Math.sin(phi) * Math.cos(theta);
        gy = Math.sin(phi) * Math.sin(theta);
        gz = Math.cos(phi);
      }

      // Inverse of: yaw → tilt → roll
      // undo roll, then tilt, then yaw
      const bx = gx * cr + gy * sr;
      const by = -gx * sr + gy * cr;
      const bz = gz;
      const ax = bx;
      const ay = by * ct + bz * st;
      const az = -by * st + bz * ct;
      const x = ax * cy - az * sy;
      const y = ay;
      const z = ax * sy + az * cy;
      const len = Math.hypot(x, y, z) || 1;
      positions[i * 3] = x / len;
      positions[i * 3 + 1] = y / len;
      positions[i * 3 + 2] = z / len;

      const roll = Math.random();
      if (roll < 0.05) col.setHSL(0.1, 0.45, 0.95); // warm sparkle
      else if (roll < 0.12) col.setHSL(0.58, 0.35, 0.96); // cool blue
      else if (roll < 0.2) col.setHSL(0.72, 0.2, 0.94); // violet
      else col.setHSL(0.55, 0.04, 0.78 + Math.random() * 0.2);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      // Power curve: many dim + a few bright “mock” sparkles
      const mag = Math.pow(Math.random(), 2.1);
      sizes[i] = mag < 0.92 ? mag : 0.92 + Math.random() * 0.35;
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, colors, phases, sizes };
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      // Camera-locked at infinity — same as MW; no spin (keeps band + stars aligned)
      groupRef.current.position.copy(state.camera.position);
    }
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uPixelRatio.value = Math.min(
        state.gl.getPixelRatio(),
        2,
      );
    }
    state.invalidate();
  });

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uRadius: { value: 220 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vMag;
        uniform float uTime;
        uniform float uPixelRatio;
        uniform float uRadius;
        void main() {
          vColor = color;
          vMag = aSize;

          float rate = 0.55 + fract(aPhase * 1.73) * 1.8;
          float wave = sin(uTime * rate + aPhase);
          float tw = 0.55 + 0.45 * (0.5 + 0.5 * wave);
          float amp = mix(0.4, 1.0, smoothstep(0.0, 0.9, aSize));
          vTwinkle = mix(0.85, tw, amp);

          vec3 pos = normalize(position) * uRadius;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_Position.z = gl_Position.w * 0.9999;

          // Brighter stars read as small crosses/sparkles
          float px = mix(1.35, 4.2, aSize) * vTwinkle;
          gl_PointSize = clamp(px * uPixelRatio, 1.1, 5.5);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vTwinkle;
        varying float vMag;
        void main() {
          vec2 p = gl_PointCoord * 2.0 - 1.0;
          float r2 = dot(p, p);
          if (r2 > 1.0) discard;

          float core = exp(-r2 * 6.5);
          // Soft diffraction spikes on bright stars (mock sparkles)
          float spike = 0.0;
          if (vMag > 0.75) {
            float ax = exp(-abs(p.x) * 14.0) * exp(-abs(p.y) * 2.2);
            float ay = exp(-abs(p.y) * 14.0) * exp(-abs(p.x) * 2.2);
            spike = (ax + ay) * 0.35 * (vMag - 0.75) * 4.0;
          }
          float a = (core + spike) * vTwinkle;
          if (a < 0.06) discard;

          vec3 col = vColor * (0.65 + 0.9 * core) * vTwinkle;
          gl_FragColor = vec4(col, a * mix(0.5, 1.0, vMag));
        }
      `,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      fog: false,
    });
    matRef.current = mat;
    return mat;
  }, []);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <group ref={groupRef} renderOrder={-30}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
          <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        </bufferGeometry>
        <primitive object={material} attach="material" />
      </points>
    </group>
  );
}
