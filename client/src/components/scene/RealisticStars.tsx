import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { makeCircleSprite } from "./textures/canvasSprites";

export default function RealisticStars({
  count = 4200,
  radius = 320,
  depth = 90,
}: {
  count?: number;
  radius?: number;
  depth?: number;
}) {
  const ref = useRef<THREE.Points>(null);
  const sprite = useMemo(() => makeCircleSprite(64, true), []);

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const col = new THREE.Color();

    for (let i = 0; i < count; i++) {
      // Uniform-ish shell with some depth variation
      const r = radius - Math.random() * depth;
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Mostly cool white; a few warm/blue stars
      const roll = Math.random();
      if (roll < 0.08)
        col.setHSL(0.08, 0.45, 0.85); // warm
      else if (roll < 0.18)
        col.setHSL(0.6, 0.35, 0.9); // blue
      else col.setHSL(0.6, 0.05, 0.75 + Math.random() * 0.2);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      // Magnitude distribution: many dim, few bright (bright ones get diffraction spikes)
      sizes[i] = Math.pow(Math.random(), 3.2) * 2.8 + 0.35;
    }
    return { positions, colors, sizes };
  }, [count, radius, depth]);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.004;
    }
  });

  // Circular sprites + optical diffraction spikes on bright stars
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: sprite },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uScale: { value: 190 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vBright;
        uniform float uPixelRatio;
        uniform float uScale;
        void main() {
          vColor = color;
          vBright = aSize; // used to drive spike strength
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = max(1.0, -mv.z);
          // Brighter stars get a larger point so spikes have room
          float boost = aSize > 2.0 ? 1.35 : 1.0;
          gl_PointSize = aSize * boost * uPixelRatio * (uScale / dist);
          gl_PointSize = clamp(gl_PointSize, 0.9, 10.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vBright;
        void main() {
          vec2 uv = gl_PointCoord;
          vec2 c = uv - 0.5;
          vec4 tex = texture2D(uMap, uv);
          float alpha = tex.a;

          // Cross diffraction spikes (only for brighter stars)
          float spikeAmt = smoothstep(1.6, 2.6, vBright);
          if (length(c) > 0.5) discard;
          if (spikeAmt > 0.01) {
            float arm =
              max(
                (1.0 - smoothstep(0.0, 0.018, abs(c.x))) *
                  (1.0 - smoothstep(0.0, 0.48, abs(c.y))),
                (1.0 - smoothstep(0.0, 0.018, abs(c.y))) *
                  (1.0 - smoothstep(0.0, 0.48, abs(c.x)))
              );
            // Soft diagonal secondary spikes
            vec2 d1 = vec2(c.x + c.y, c.x - c.y) * 0.7071;
            float diag =
              max(
                (1.0 - smoothstep(0.0, 0.014, abs(d1.x))) *
                  (1.0 - smoothstep(0.0, 0.42, abs(d1.y))),
                (1.0 - smoothstep(0.0, 0.014, abs(d1.y))) *
                  (1.0 - smoothstep(0.0, 0.42, abs(d1.x)))
              ) * 0.45;
            alpha = max(alpha, (arm + diag) * spikeAmt * 0.85);
          }

          if (alpha < 0.12) discard;
          // Keep stars pinpricks, not a bright wash over the sky
          vec3 col = vColor * (0.45 + tex.r * 0.7 + spikeAmt * 0.12);
          gl_FragColor = vec4(col, alpha * 0.82);
        }
      `,
      transparent: true,
      alphaTest: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
  }, [sprite]);

  useEffect(() => {
    const onResize = () => {
      material.uniforms.uPixelRatio.value = Math.min(
        window.devicePixelRatio,
        2,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [material]);

  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      <primitive object={material} attach="material" />
    </points>
  );
}

/**
 * Zodiacal light: subtle ecliptic haze + fine motes.
 * Previous glow disc was a golden fog wall covering the whole system.
 */

