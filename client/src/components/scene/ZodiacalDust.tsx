import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeCircleSprite } from "./textures/canvasSprites";

export default function ZodiacalDust() {
  const dustRef = useRef<THREE.Points>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const sprite = useMemo(() => makeCircleSprite(32, true), []);

  const glowMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {},
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vPos;
        void main() {
          float r = length(vPos.xz);
          // Tight, soft band — visible near sun, gone by outer planets
          float radial = exp(-r * 0.065) * smoothstep(62.0, 8.0, r);
          float a = radial * 0.055;
          if (a < 0.002) discard;
          vec3 col = vec3(0.82, 0.7, 0.48);
          gl_FragColor = vec4(col, a);
        }
      `,
    });
  }, []);

  const { positions, colors, sizes } = useMemo(() => {
    const n = 2800;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const u = Math.random();
      const r = 10 + Math.pow(u, 0.75) * 75;
      const a = Math.random() * Math.PI * 2;
      const thickness = 0.1 + r * 0.005;
      const y = (Math.random() + Math.random() - 1) * thickness;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * r;
      const near = 1 - THREE.MathUtils.clamp((r - 10) / 70, 0, 1);
      col.setHSL(0.1, 0.28, 0.14 + near * 0.16);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      sizes[i] = 0.08 + near * 0.1;
    }
    return { positions, colors, sizes };
  }, []);

  const dustMat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: sprite },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uScale: { value: 26 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uPixelRatio;
        uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float dist = max(1.0, -mv.z);
          vAlpha = clamp(18.0 / dist, 0.04, 0.32);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(aSize * uPixelRatio * (uScale / dist), 1.8);
          gl_PointSize = max(gl_PointSize, 0.4);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          if (length(c) > 0.5) discard;
          float a = texture2D(uMap, gl_PointCoord).a;
          if (a < 0.12) discard;
          gl_FragColor = vec4(vColor, a * vAlpha * 0.45);
        }
      `,
      transparent: true,
      alphaTest: 0.12,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    });
  }, [sprite]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (dustRef.current) dustRef.current.rotation.y = t * 0.001;
    if (glowRef.current) glowRef.current.rotation.y = t * 0.0006;
  });

  return (
    <group>
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-2}>
        <circleGeometry args={[72, 80]} />
        <primitive object={glowMat} attach="material" />
      </mesh>
      <points ref={dustRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        </bufferGeometry>
        <primitive object={dustMat} attach="material" />
      </points>
    </group>
  );
}

/**
 * Natural solar glow + lens flare — scene-based (no EffectComposer).
 * Same system for System + Near-Earth; only intensity curves differ with distance.
 *
 * Why not full-screen Bloom? It (and DOF) caused the black square when the sun
 * fills the Near-Earth frame. Soft white→alpha sprites never use opaque black.
 *
 * Layers: outer bloom disc → warm halo → hot core → anamorphic streak(s) →
 * photographic ghosts along the sun→camera axis (and mirrored past the viewer
 * for classic scatter).
 */

