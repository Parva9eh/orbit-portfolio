import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Camera-locked twinkling pinpricks.
 * Always invalidates so Free+demand frameloop still animates scintillation.
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

    for (let i = 0; i < count; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions[i * 3] = Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = Math.cos(phi);

      const roll = Math.random();
      if (roll < 0.06) col.setHSL(0.08, 0.28, 0.92);
      else if (roll < 0.14) col.setHSL(0.58, 0.22, 0.95);
      else col.setHSL(0.55, 0.02, 0.82 + Math.random() * 0.16);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      // More mid-bright stars so twinkle is obvious (not power-4 sparse)
      sizes[i] = Math.pow(Math.random(), 1.6);
      phases[i] = Math.random() * Math.PI * 2;
    }
    return { positions, colors, phases, sizes };
  }, [count]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position);
      groupRef.current.rotation.y = t * 0.0008;
    }
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uPixelRatio.value = Math.min(
        state.gl.getPixelRatio(),
        2,
      );
    }
    // Twinkle must run even if FrameloopController is in demand mode
    state.invalidate();
  });

  const material = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uRadius: { value: 200 },
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

          // Visible scintillation: amplitude high enough to read as on/off
          float rate = 0.7 + fract(aPhase * 1.73) * 2.2;
          float wave = sin(uTime * rate + aPhase);
          // 0.35 .. 1.0 range
          float tw = 0.35 + 0.65 * (0.5 + 0.5 * wave);
          // Dim stars twinkle less; brighter ones more
          float amp = mix(0.55, 1.0, smoothstep(0.0, 0.85, aSize));
          vTwinkle = mix(0.75, tw, amp);

          vec3 pos = normalize(position) * uRadius;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_Position.z = gl_Position.w * 0.9999;

          // Readable pinpricks; size pulses with twinkle (clear on/off feel)
          float px = mix(1.6, 3.2, aSize) * vTwinkle;
          gl_PointSize = clamp(px * uPixelRatio, 1.2, 4.0);
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

          float core = exp(-r2 * 7.0);
          float a = core * vTwinkle;
          if (a < 0.08) discard;

          vec3 col = vColor * (0.55 + 0.75 * core) * vTwinkle;
          gl_FragColor = vec4(col, a * mix(0.55, 1.0, vMag));
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
