/**
 * Solar system scene — textures: Solar System Scope (CC BY 4.0)
 * https://www.solarsystemscope.com/textures/
 */
import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import type { GLTF } from "three-stdlib";
import type { CelestialItem, Planet } from "@shared";
import {
  isAsteroid,
  positionOnOrbit,
  sampleOrbitPath,
  spinAngle,
  asteroidTumble,
  hashString,
  formatDiameterKm,
  formatMiss,
  type OrbitElements,
} from "@shared";
import { useSimSettings, useSimActions } from "../sim/useSim";
import { scalePosition, scaleSize, qualitySettings } from "../sim/simUtils";
import CameraDirector from "./scene/CameraDirector";
import {
  EARTH_MAPS,
  EXTRA_MAPS,
  PLANET_ALBEDO,
  preloadTextures,
  preloadBootTextures,
  preloadEarthTextures,
} from "./scene/textureCache";
import { useLazyTexture } from "./scene/useLazyTexture";
import IssMarker from "./scene/IssMarker";
import MeasureLine from "./scene/MeasureLine";
import type { IssPosition } from "@shared";

/** Simulation clock (respects pause / speed) — stable actions ref only. */
function useT() {
  const { simTimeRef } = useSimActions();
  return () => simTimeRef.current;
}

function asteroidDisplayScale(sizeKm: number): number {
  return Math.min(Math.max(sizeKm * 2.2, 0.14), 0.9);
}

function toThreePath(points: { x: number; y: number; z: number }[]) {
  return points.map((p) => new THREE.Vector3(p.x, p.y, p.z));
}

function softOrbitColor(hex?: number): string {
  if (hex == null) return "#8aa8c4";
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  // Keep a hint of planet hue but bright enough for System view
  c.setHSL(hsl.h, Math.min(hsl.s * 0.35 + 0.12, 0.4), 0.62);
  return `#${c.getHexString()}`;
}

/* ------------------------------------------------------------------ */
/*  Sky + circular point sprites (avoids WebGL square points)          */
/* ------------------------------------------------------------------ */

/** Soft disc texture so Points render as stars, not squares. */
function makeCircleSprite(size = 64, soft = true): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  if (soft) {
    g.addColorStop(0.0, "rgba(255,255,255,1)");
    g.addColorStop(0.15, "rgba(255,255,255,0.95)");
    g.addColorStop(0.4, "rgba(255,255,255,0.35)");
    g.addColorStop(0.7, "rgba(255,255,255,0.08)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
  } else {
    g.addColorStop(0.0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.9)");
    g.addColorStop(0.85, "rgba(255,255,255,0.15)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft white→transparent radial glow for lens flare.
 * Must never contain opaque black (that reads as the flashing square).
 */
function makeFlareTexture(
  size = 256,
  stops: Array<{ t: number; a: number }>
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  // Clear to fully transparent (not black)
  ctx.clearRect(0, 0, size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const s of stops) {
    g.addColorStop(s.t, `rgba(255,255,255,${s.a})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Soft annular ring for photographic lens ghosts (no opaque fill). */
function makeRingTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, r * 0.28, r, r, r * 0.92);
  g.addColorStop(0.0, "rgba(255,255,255,0)");
  g.addColorStop(0.35, "rgba(255,255,255,0.08)");
  g.addColorStop(0.55, "rgba(255,255,255,0.42)");
  g.addColorStop(0.72, "rgba(255,255,255,0.18)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function makeStreakTexture(w = 512, h = 64): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, h / 2, w, h / 2);
  g.addColorStop(0.0, "rgba(255,255,255,0)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(0.5, "rgba(255,255,255,0.7)");
  g.addColorStop(0.65, "rgba(255,255,255,0.35)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  // Vertical soft falloff
  for (let y = 0; y < h; y++) {
    const v = 1 - Math.abs(y / h - 0.5) * 2;
    const a = Math.pow(Math.max(0, v), 2.2);
    ctx.globalAlpha = a;
    ctx.fillRect(0, y, w, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Photographic milky-way sky: lift only the luminous band, keep empty sky black
 * so Cinematic looks rich without a light-blue wash.
 */
const MW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;
const MW_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uBoost;
varying vec2 vUv;
void main() {
  if (uHasMap < 0.5) {
    gl_FragColor = vec4(0.004, 0.01, 0.02, 1.0);
    return;
  }
  vec3 t = texture2D(uMap, vUv).rgb;
  float lum = dot(t, vec3(0.299, 0.587, 0.114));
  // Keep dark sky black; lift band + faint structure for a natural milky way
  float band = smoothstep(0.02, 0.22, lum);
  float soft = smoothstep(0.0, 0.12, lum) * 0.28;
  vec3 col = t * (band * uBoost + soft);
  col *= vec3(0.9, 0.93, 1.08);
  gl_FragColor = vec4(col, 1.0);
}
`;

function MilkyWaySky() {
  const map = useLazyTexture(EXTRA_MAPS.milkyWay);
  const uniforms = useMemo(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uHasMap: { value: 0 },
      uBoost: { value: 2.15 },
    }),
    [],
  );
  useEffect(() => {
    uniforms.uMap.value = map;
    uniforms.uHasMap.value = map ? 1 : 0;
  }, [map, uniforms]);

  return (
    <mesh scale={[-1, 1, 1]} rotation={[0.4, 1.05, 0.12]}>
      <sphereGeometry args={[580, 96, 64]} />
      <shaderMaterial
        vertexShader={MW_VERT}
        fragmentShader={MW_FRAG}
        uniforms={uniforms}
        side={THREE.BackSide}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

/**
 * Custom starfield: spherical distribution + circular alpha map.
 * drei <Stars> uses raw GL points (squares on many GPUs).
 */
function RealisticStars({
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
function ZodiacalDust() {
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
          float radial = exp(-r * 0.07) * smoothstep(55.0, 10.0, r);
          float a = radial * 0.035;
          if (a < 0.002) discard;
          vec3 col = vec3(0.75, 0.65, 0.42);
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

/* ------------------------------------------------------------------ */
/*  Sun — 3D spherical photosphere (glow stays on the disc)            */
/* ------------------------------------------------------------------ */

const SUN_RADIUS = 5.5;

const SUN_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vObjN;   // object-space normal → seamless sphere noise
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vNormalW;
void main() {
  vUv = uv;
  vObjN = normalize(normal);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const SUN_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform float uHasMap;
varying vec2 vUv;
varying vec3 vObjN;
varying vec3 vNormalV;
varying vec3 vViewV;
varying vec3 vNormalW;

// 3D hash / noise so granulation wraps the sphere (no UV seams / flat disc look)
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
        mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
        mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}
float fbm3(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise3(p);
    p = p * 2.11 + vec3(1.7, 9.2, 3.1);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec3 nObj = normalize(vObjN);
  float t = uTime;

  // Slow spherical convection (domain warp on the unit sphere)
  vec3 flow = vec3(
    fbm3(nObj * 2.2 + vec3(t * 0.04, 0.0, t * 0.02)),
    fbm3(nObj * 2.2 + vec3(2.1, t * 0.035, -1.4)),
    fbm3(nObj * 2.2 + vec3(-t * 0.03, 1.7, 3.3))
  );
  vec3 p = nObj * 4.5 + (flow - 0.5) * 0.55;

  float cells = fbm3(p);
  float cells2 = fbm3(p * 2.4 + t * 0.05);
  float gran = smoothstep(0.32, 0.7, cells * 0.62 + cells2 * 0.38);
  float ridges = pow(1.0 - abs(cells - 0.48) * 2.1, 2.4);
  float cracks = smoothstep(0.58, 0.92, fbm3(p * 3.5 + t * 0.08));
  // Micro bump cue for 3D relief (lighting-like shading of granules)
  float micro = fbm3(p * 8.0) * 0.12;

  // SSS map as large-scale color (still spherical via UV)
  vec3 texCol = vec3(1.0, 0.55, 0.18);
  if (uHasMap > 0.5) {
    texCol = texture2D(uMap, vUv).rgb;
  }

  // Photosphere palette — cooler at edges via limb, hot centers
  vec3 cool = vec3(0.45, 0.1, 0.02);
  vec3 mid  = vec3(0.95, 0.38, 0.06);
  vec3 hot  = vec3(1.0, 0.72, 0.28);
  vec3 core = vec3(1.0, 0.9, 0.65);

  vec3 col = mix(cool, mid, gran);
  col = mix(col, hot, ridges * 0.55);
  col = mix(col, core, cracks * 0.4);
  col = mix(col, texCol * vec3(1.2, 0.7, 0.28), 0.4 * uHasMap + 0.15);
  col *= 0.92 + micro;

  // Strong limb darkening → readable sphere (this is the main "3D" cue)
  vec3 nV = normalize(vNormalV);
  vec3 vV = normalize(vViewV);
  float ndv = max(dot(nV, vV), 0.0);
  // Classic solar limb darkening ~ mu^0.6–0.8 with deep rim falloff
  float limb = pow(ndv, 0.72);
  col *= 0.18 + 0.82 * limb;

  // Hot spots only near disc center (limits Bloom to the face, not the silhouette)
  float faceBoost = smoothstep(0.15, 0.85, ndv);
  col += vec3(1.0, 0.75, 0.35) * cracks * ridges * 0.22 * faceBoost;

  // Thin chromosphere at the geometric limb only (still on the sphere mesh)
  float rim = pow(1.0 - ndv, 4.5);
  col += vec3(1.0, 0.4, 0.08) * rim * 0.45;

  // Hard cap so Bloom cannot spill a system-wide haze
  // Peak ~1.05–1.15 on face → only center exceeds high bloom threshold
  col = min(col * 1.05, vec3(1.15, 1.05, 0.85));

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Tight chromosphere shell — geometric rim only, no billboard haze. */
const CHROMA_VERT = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

const CHROMA_FRAG = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewV;
void main() {
  float ndv = max(dot(normalize(vNormalV), normalize(vViewV)), 0.0);
  // Only a thin ring at the silhouette
  float rim = pow(1.0 - ndv, 5.5);
  if (rim < 0.04) discard;
  vec3 col = vec3(1.0, 0.55, 0.15) * rim;
  gl_FragColor = vec4(col, rim * 0.55);
}
`;

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
function SolarFlare() {
  const group = useRef<THREE.Group>(null);
  const bloom = useRef<THREE.Sprite>(null);
  const halo = useRef<THREE.Sprite>(null);
  const core = useRef<THREE.Sprite>(null);
  const streakH = useRef<THREE.Sprite>(null);
  const streakV = useRef<THREE.Sprite>(null);
  const ghostA = useRef<THREE.Sprite>(null);
  const ghostB = useRef<THREE.Sprite>(null);
  const ghostC = useRef<THREE.Sprite>(null);
  const { camera } = useThree();
  const { quality, viewScale } = useSimSettings();
  const cinematic = quality === "cinematic";
  const nearEarth = viewScale === "nearEarth";

  const tex = useMemo(
    () => ({
      // Wide soft “bloom” disc — substitute for post-process Bloom
      bloom: makeFlareTexture(256, [
        { t: 0.0, a: 0.42 },
        { t: 0.12, a: 0.28 },
        { t: 0.32, a: 0.12 },
        { t: 0.58, a: 0.04 },
        { t: 0.82, a: 0.01 },
        { t: 1.0, a: 0.0 },
      ]),
      halo: makeFlareTexture(256, [
        { t: 0.0, a: 0.55 },
        { t: 0.16, a: 0.32 },
        { t: 0.38, a: 0.14 },
        { t: 0.68, a: 0.04 },
        { t: 1.0, a: 0.0 },
      ]),
      core: makeFlareTexture(128, [
        { t: 0.0, a: 0.9 },
        { t: 0.18, a: 0.45 },
        { t: 0.45, a: 0.12 },
        { t: 1.0, a: 0.0 },
      ]),
      ghost: makeFlareTexture(128, [
        { t: 0.0, a: 0.0 },
        { t: 0.28, a: 0.32 },
        { t: 0.52, a: 0.16 },
        { t: 0.78, a: 0.05 },
        { t: 1.0, a: 0.0 },
      ]),
      ring: makeRingTexture(128),
      streak: makeStreakTexture(512, 48),
    }),
    []
  );

  useEffect(
    () => () => {
      Object.values(tex).forEach((t) => t.dispose());
    },
    [tex]
  );

  const tmpNdc = useMemo(() => new THREE.Vector3(), []);
  const tmpCam = useMemo(() => new THREE.Vector3(), []);
  const tmpSide = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;

    // Cheap reject: sun behind camera → hide group and skip all scale/opacity work
    tmpNdc.set(0, 0, 0).project(camera);
    if (tmpNdc.z >= 1) {
      g.visible = false;
      return;
    }

    const onScreen =
      Math.abs(tmpNdc.x) < 1.55 && Math.abs(tmpNdc.y) < 1.55;

    // 1 at screen center → 0 near edges (wider falloff in NE so off-axis still glows)
    const center = Math.max(
      0,
      1 - Math.hypot(tmpNdc.x, tmpNdc.y) / (nearEarth ? 1.55 : 1.3)
    );

    const dist = Math.max(1, camera.position.length());
    // Angular size proxy — larger when camera is closer
    const sizeFactor = THREE.MathUtils.clamp(
      (nearEarth ? 38 : 56) / dist,
      0.45,
      nearEarth ? 1.65 : 2.35
    );
    // Pull flare down when the sun is huge (close NE shots) so it stays natural
    const closeness = THREE.MathUtils.smoothstep(
      nearEarth ? 10 : 18,
      nearEarth ? 42 : 75,
      dist
    );
    // Keep a little atmospheric bloom even when very close (halo only)
    const closeBloom = THREE.MathUtils.smoothstep(
      nearEarth ? 6 : 12,
      nearEarth ? 22 : 40,
      dist
    );
    const visibility = onScreen
      ? Math.pow(center, nearEarth ? 0.75 : 0.95) * (0.35 + 0.65 * closeness)
      : 0;
    const bloomVis = onScreen
      ? Math.pow(center, 0.6) * (0.45 + 0.55 * Math.max(closeness, closeBloom * 0.55))
      : 0;

    g.visible = bloomVis > 0.015 || visibility > 0.02;
    if (!g.visible) return;

    // Same effect family; cinematic richer, System a touch brighter, NE softer
    const boost = (cinematic ? 1.28 : 0.92) * (nearEarth ? 0.9 : 1.05);
    const bloomS = SUN_RADIUS * (nearEarth ? 5.2 : 6.4) * sizeFactor;
    const haloS = SUN_RADIUS * (nearEarth ? 3.0 : 3.7) * sizeFactor;
    const coreS = SUN_RADIUS * (nearEarth ? 1.3 : 1.55) * sizeFactor;
    const streakS = SUN_RADIUS * (nearEarth ? 5.2 : 8.4) * sizeFactor;

    if (bloom.current) {
      bloom.current.scale.setScalar(bloomS);
      (bloom.current.material as THREE.SpriteMaterial).opacity =
        0.34 * bloomVis * boost;
    }
    if (halo.current) {
      halo.current.scale.setScalar(haloS);
      (halo.current.material as THREE.SpriteMaterial).opacity =
        0.42 * visibility * boost;
    }
    if (core.current) {
      core.current.scale.setScalar(coreS);
      (core.current.material as THREE.SpriteMaterial).opacity =
        0.52 * visibility * boost;
    }

    // Anamorphic streaks — primary horizontal; cinematic adds a faint cross
    const streakOp = 0.18 * visibility * boost * center;
    if (streakH.current) {
      streakH.current.scale.set(streakS * 2.3, streakS * 0.09, 1);
      (streakH.current.material as THREE.SpriteMaterial).opacity = streakOp;
    }
    if (streakV.current) {
      const showCross = cinematic && !nearEarth;
      streakV.current.visible = showCross;
      if (showCross) {
        streakV.current.scale.set(streakS * 0.09, streakS * 1.55, 1);
        (streakV.current.material as THREE.SpriteMaterial).opacity =
          streakOp * 0.45;
      }
    }

    // Ghosts along camera axis (sun → viewer). Classic scatter: one past midpoint,
    // one closer to camera, one ring “reflection” slightly off-axis.
    tmpCam.copy(camera.position).normalize();
    // Tiny lateral offset from screen offset so ghosts track sun off-center
    tmpSide
      .set(tmpNdc.x, tmpNdc.y, 0)
      .normalize()
      .multiplyScalar(SUN_RADIUS * 0.15 * sizeFactor);

    if (ghostA.current) {
      ghostA.current.position
        .copy(tmpCam)
        .multiplyScalar(dist * 0.18)
        .add(tmpSide);
      ghostA.current.scale.setScalar(SUN_RADIUS * 0.9 * sizeFactor);
      (ghostA.current.material as THREE.SpriteMaterial).opacity =
        0.11 * visibility * boost * center;
    }
    if (ghostB.current) {
      ghostB.current.position
        .copy(tmpCam)
        .multiplyScalar(dist * 0.34)
        .sub(tmpSide);
      ghostB.current.scale.setScalar(SUN_RADIUS * 1.35 * sizeFactor);
      (ghostB.current.material as THREE.SpriteMaterial).opacity =
        0.08 * visibility * boost * center;
    }
    if (ghostC.current) {
      // Ring ghost further along the ray — cinematic only, System preferred
      const showRing = cinematic || !nearEarth;
      ghostC.current.visible = showRing && visibility > 0.08;
      if (ghostC.current.visible) {
        ghostC.current.position.copy(tmpCam).multiplyScalar(dist * 0.48);
        ghostC.current.scale.setScalar(SUN_RADIUS * 1.7 * sizeFactor);
        (ghostC.current.material as THREE.SpriteMaterial).opacity =
          0.06 * visibility * boost * center * (cinematic ? 1.2 : 0.85);
      }
    }
  });

  const mat = (
    map: THREE.Texture,
    color: string,
    depthTest: boolean
  ) => (
    <spriteMaterial
      map={map}
      color={color}
      transparent
      depthWrite={false}
      depthTest={depthTest}
      blending={THREE.AdditiveBlending}
      toneMapped={false}
      opacity={0}
    />
  );

  return (
    <group ref={group} position={[0, 0, 0]} name="SolarFlare">
      {/* Wide soft bloom — replaces full-screen Bloom post */}
      <sprite ref={bloom} renderOrder={-4}>
        {mat(tex.bloom, "#ffb060", false)}
      </sprite>
      <sprite ref={halo} renderOrder={-3}>
        {mat(tex.halo, "#ffc878", true)}
      </sprite>
      <sprite ref={core} renderOrder={-2}>
        {mat(tex.core, "#fff2c8", true)}
      </sprite>
      <sprite ref={streakH} renderOrder={-2}>
        {mat(tex.streak, "#ffe0a0", false)}
      </sprite>
      <sprite ref={streakV} renderOrder={-2} visible={false}>
        {mat(tex.streak, "#ffd090", false)}
      </sprite>
      <sprite ref={ghostA} renderOrder={-1}>
        {mat(tex.ghost, "#a8c8ff", false)}
      </sprite>
      <sprite ref={ghostB} renderOrder={-1}>
        {mat(tex.ghost, "#ffb070", false)}
      </sprite>
      <sprite ref={ghostC} renderOrder={-1} visible={false}>
        {mat(tex.ring, "#c8d8ff", false)}
      </sprite>
    </group>
  );
}

function Sun({
  meshRef,
}: {
  meshRef: React.MutableRefObject<THREE.Mesh | null>;
}) {
  const body = useRef<THREE.Mesh>(null);
  const map = useLazyTexture(EXTRA_MAPS.sun);
  const { quality } = useSimSettings();
  const segs = qualitySettings(quality).sunSegments;

  const setBodyRef = (el: THREE.Mesh | null) => {
    body.current = el;
    meshRef.current = el;
  };

  const uniforms = useMemo(
    () => ({
      uMap: { value: null as THREE.Texture | null },
      uTime: { value: 0 },
      uHasMap: { value: 0 },
    }),
    [],
  );

  useEffect(() => {
    uniforms.uMap.value = map;
    uniforms.uHasMap.value = map ? 1 : 0;
  }, [map, uniforms]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    if (body.current) body.current.rotation.y = t * 0.018;
  });

  const coronaSegs = Math.max(32, Math.floor(segs / 2));

  return (
    <group position={[0, 0, 0]} name="Sun">
      <mesh ref={setBodyRef}>
        <sphereGeometry args={[SUN_RADIUS, segs, segs]} />
        <shaderMaterial
          vertexShader={SUN_VERT}
          fragmentShader={SUN_FRAG}
          uniforms={uniforms}
          toneMapped
        />
      </mesh>

      {/* Geometric chromosphere + corona — same family in System + Near-Earth */}
      <mesh scale={1.03} renderOrder={1}>
        <sphereGeometry args={[SUN_RADIUS, coronaSegs, coronaSegs]} />
        <shaderMaterial
          vertexShader={CHROMA_VERT}
          fragmentShader={CHROMA_FRAG}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
          toneMapped
        />
      </mesh>

      {/* Inner corona shell (backside rim) */}
      <mesh scale={1.12} renderOrder={0}>
        <sphereGeometry args={[SUN_RADIUS, coronaSegs, coronaSegs]} />
        <shaderMaterial
          vertexShader={CHROMA_VERT}
          fragmentShader={/* glsl */ `
            varying vec3 vNormalV;
            varying vec3 vViewV;
            void main() {
              float ndv = max(dot(normalize(vNormalV), normalize(vViewV)), 0.0);
              float a = pow(1.0 - ndv, 2.5) * 0.2;
              if (a < 0.004) discard;
              gl_FragColor = vec4(vec3(1.0, 0.85, 0.5) * a, a);
            }
          `}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>

      {/* Soft outer atmosphere — scene bloom without EffectComposer */}
      <mesh scale={1.38} renderOrder={-1}>
        <sphereGeometry args={[SUN_RADIUS, coronaSegs, coronaSegs]} />
        <shaderMaterial
          vertexShader={CHROMA_VERT}
          fragmentShader={/* glsl */ `
            varying vec3 vNormalV;
            varying vec3 vViewV;
            void main() {
              float ndv = max(dot(normalize(vNormalV), normalize(vViewV)), 0.0);
              // Wide soft falloff — reads as natural solar atmosphere
              float a = pow(1.0 - ndv, 1.55) * 0.085;
              if (a < 0.003) discard;
              vec3 col = mix(vec3(1.0, 0.55, 0.15), vec3(1.0, 0.9, 0.55), ndv);
              gl_FragColor = vec4(col * a, a);
            }
          `}
          transparent
          depthWrite={false}
          depthTest
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          toneMapped={false}
        />
      </mesh>

      {/* Shared natural flare / bloom substitute for both views */}
      <SolarFlare />

      <pointLight
        position={[0, 0, 0]}
        color="#fff4dc"
        intensity={190}
        decay={2}
        distance={300}
      />
      <pointLight
        position={[0, 0, 0]}
        color="#ffb060"
        intensity={40}
        decay={2}
        distance={120}
      />
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Earth — day / night / clouds                                       */
/* ------------------------------------------------------------------ */

const EARTH_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D dayMap;
uniform sampler2D nightMap;
uniform sampler2D specularMap;
uniform vec3 sunPosition;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vec3 dayCol = texture2D(dayMap, vUv).rgb;
  vec3 nightCol = texture2D(nightMap, vUv).rgb * 1.35;
  float ocean = texture2D(specularMap, vUv).r;
  vec3 n = normalize(vNormalW);
  vec3 l = normalize(sunPosition - vPosW);
  float ndl = dot(n, l);
  float dayF = smoothstep(-0.12, 0.28, ndl);
  vec3 color = mix(nightCol, dayCol, dayF);
  vec3 viewDir = normalize(cameraPosition - vPosW);
  vec3 halfV = normalize(l + viewDir);
  float spec = pow(max(dot(n, halfV), 0.0), 48.0) * ocean * dayF;
  color += vec3(0.55, 0.7, 1.0) * spec * 0.55;
  // limb atmosphere hint
  float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 2.5);
  color += vec3(0.25, 0.5, 1.0) * fres * 0.18 * dayF;
  gl_FragColor = vec4(color, 1.0);
}
`;

function EarthMoon({
  earthSize,
  showOrbit = true,
}: {
  earthSize: number;
  showOrbit?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const t = useT();
  const moonMap = useLazyTexture(EXTRA_MAPS.moon);
  // Slightly exaggerated for readability at system scale (~real is ~30 Earth radii)
  const orbitR = earthSize * 4.4;
  const period = 9.5;
  const moonSize = Math.max(earthSize * 0.32, 0.18);
  const inc = 0.12;

  const orbitPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    // Dense closed ring (open list; OrbitLine closes) — smooth moon path
    const segs = 384;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(
        new THREE.Vector3(
          Math.cos(a) * orbitR,
          Math.sin(a) * orbitR * Math.sin(inc),
          Math.sin(a) * orbitR * Math.cos(inc),
        ),
      );
    }
    return pts;
  }, [orbitR, inc]);

  useFrame(() => {
    if (!ref.current) return;
    const time = t();
    const a = (time / period) * Math.PI * 2;
    ref.current.position.set(
      Math.cos(a) * orbitR,
      Math.sin(a) * orbitR * Math.sin(inc),
      Math.sin(a) * orbitR * Math.cos(inc),
    );
    // Tidally locked-ish spin
    ref.current.rotation.y = a + Math.PI;
  });

  return (
    <>
      {showOrbit && (
        <OrbitLine points={orbitPoints} color="#b0c4d8" opacity={0.55} lineWidth={0.75} />
      )}
      <group ref={ref}>
        <mesh scale={moonSize}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshStandardMaterial
            map={moonMap}
            color={moonMap ? "#f0f0f0" : "#c8c8c8"}
            roughness={0.92}
            metalness={0.02}
            emissive="#1a1a20"
            emissiveIntensity={0.12}
          />
        </mesh>
        {/* Soft rim so the Moon stays readable against dark space */}
        <mesh scale={moonSize * 1.06}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial
            color="#c0d0e0"
            transparent
            opacity={0.12}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}

function EarthBody({
  planet,
  livePos,
  onClick,
  selected,
}: {
  planet: Planet;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  onClick: () => void;
  selected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const t = useT();
  const { trueScale, quality } = useSimSettings();
  const displaySize = scaleSize(planet.size, trueScale);
  const segs = qualitySettings(quality).planetSegments;

  // Maps preloaded at boot — day alone is enough to leave the solid-sphere placeholder
  const day = useLazyTexture(EARTH_MAPS.day);
  const night = useLazyTexture(EARTH_MAPS.night);
  const specular = useLazyTexture(EARTH_MAPS.specular, false);
  const clouds = useLazyTexture(EARTH_MAPS.clouds);
  const ready = !!day;

  const uniforms = useMemo(
    () => ({
      dayMap: { value: day as THREE.Texture | null },
      nightMap: { value: (night ?? day) as THREE.Texture | null },
      specularMap: { value: (specular ?? day) as THREE.Texture | null },
      sunPosition: { value: new THREE.Vector3(0, 0, 0) },
    }),
    // stable object; values patched below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    uniforms.dayMap.value = day;
    uniforms.nightMap.value = night ?? day;
    uniforms.specularMap.value = specular ?? day;
  }, [day, night, specular, uniforms]);

  useFrame(() => {
    const time = t();
    const raw = positionOnOrbit(planet.orbit, time);
    const p = scalePosition(raw, trueScale);
    if (groupRef.current) {
      groupRef.current.position.set(p.x, p.y, p.z);
      let stored = livePos.current.get(planet.id);
      if (!stored) {
        stored = new THREE.Vector3();
        livePos.current.set(planet.id, stored);
      }
      stored.set(p.x, p.y, p.z);
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.order = "ZXY";
      bodyRef.current.rotation.z = planet.axialTilt;
      bodyRef.current.rotation.y = spinAngle(planet.spinDays, time);
    }
    if (cloudRef.current) {
      cloudRef.current.rotation.order = "ZXY";
      cloudRef.current.rotation.z = planet.axialTilt;
      cloudRef.current.rotation.y =
        spinAngle(planet.spinDays, time) * 1.15 + time * 0.02;
    }
  });

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh ref={bodyRef} scale={displaySize}>
        <sphereGeometry args={[1, segs, segs]} />
        {ready ? (
          <shaderMaterial
            vertexShader={EARTH_VERT}
            fragmentShader={EARTH_FRAG}
            uniforms={uniforms}
          />
        ) : (
          <meshStandardMaterial
            color="#2a5a9a"
            roughness={0.7}
            metalness={0.05}
          />
        )}
      </mesh>
      {clouds && (
        <mesh ref={cloudRef} scale={displaySize * 1.018}>
          <sphereGeometry
            args={[1, Math.max(24, segs / 2), Math.max(24, segs / 2)]}
          />
          <meshStandardMaterial
            map={clouds}
            transparent
            opacity={0.45}
            depthWrite={false}
            roughness={1}
            metalness={0}
            alphaTest={0.02}
          />
        </mesh>
      )}
      <mesh scale={displaySize * 1.055}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial
          color="#5aa8ff"
          transparent
          opacity={selected ? 0.2 : 0.1}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <EarthMoon earthSize={displaySize} showOrbit />
    </group>
  );
}

function OrbitProgressMarker({
  orbit,
  color = "#c8e0ff",
}: {
  orbit: OrbitElements;
  color?: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const t = useT();
  const { trueScale } = useSimSettings();
  useFrame(() => {
    if (!ref.current) return;
    const p = scalePosition(positionOnOrbit(orbit, t()), trueScale);
    ref.current.position.set(p.x, p.y, p.z);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.22, 12, 12]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.9}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Motion trail without React setState (avoids per-frame re-renders).
 * Updates a BufferGeometry position attribute imperatively.
 */
function MotionTrail({
  livePos,
  itemId,
}: {
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  itemId: string;
}) {
  const maxPoints = 48;
  const history = useRef<THREE.Vector3[]>([]);
  const positions = useMemo(() => new Float32Array(maxPoints * 3), []);
  const lineObj = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setDrawRange(0, 0);
    const m = new THREE.LineBasicMaterial({
      // Warm trail — ice-blue read as “selected body turned cyan”
      color: 0xc8b89a,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
      toneMapped: false,
    });
    return new THREE.Line(g, m);
  }, [positions]);

  useEffect(() => {
    history.current = [];
    lineObj.geometry.setDrawRange(0, 0);
  }, [itemId, lineObj]);

  useFrame(() => {
    const p = livePos.current.get(itemId);
    if (!p) return;
    const last = history.current[history.current.length - 1];
    if (!last || last.distanceToSquared(p) > 0.06) {
      history.current.push(p.clone());
      if (history.current.length > maxPoints) history.current.shift();
      const n = history.current.length;
      for (let i = 0; i < n; i++) {
        const v = history.current[i];
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
      }
      const geom = lineObj.geometry;
      const attr = geom.getAttribute("position") as THREE.BufferAttribute;
      attr.needsUpdate = true;
      geom.setDrawRange(0, n);
      geom.computeBoundingSphere();
    }
  });

  return <primitive object={lineObj} />;
}

/** Dust + rocks between Mars–Jupiter scene radii. */
function AsteroidBelt({
  trueScale,
  count = 900,
}: {
  trueScale: boolean;
  count?: number;
}) {
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // Scenic radii: Mars ~17, Jupiter ~35
      let r = 20 + Math.random() * 14;
      if (trueScale) r *= 1.35;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 1.2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * r;
      const s = 0.35 + Math.random() * 0.35;
      col.setRGB(0.55 * s, 0.48 * s, 0.4 * s);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, colors };
  }, [trueScale, count]);

  const sprite = useMemo(() => makeCircleSprite(32, true), []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={0.28}
        vertexColors
        transparent={false}
        opacity={0.55}
        depthWrite={false}
        sizeAttenuation
        alphaTest={0.5}
        toneMapped={false}
      />
    </points>
  );
}

/**
 * Outline-only text (no filled panel).
 * Dark rounded chips were the "flashing boxes" when they crossed the sun.
 *
 * Orientation: CanvasTexture for THREE.Sprite must use default flipY=true
 * so line 0 is at the top of the billboard (flipY=false made labels
 * upside-down / hard to read).
 */
function makeTextSpriteTexture(
  lines: string[],
  opts?: { fontSize?: number },
): { map: THREE.CanvasTexture; aspect: number } {
  const fontSize = opts?.fontSize ?? 22;
  const padX = 10;
  const padY = 8;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fonts = lines.map((_, i) =>
    i === 0
      ? `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`
      : `600 ${Math.round(fontSize * 0.78)}px ui-sans-serif, system-ui, sans-serif`,
  );
  let maxW = 0;
  lines.forEach((line, i) => {
    ctx.font = fonts[i];
    maxW = Math.max(maxW, ctx.measureText(line).width);
  });
  const lineH = fontSize * 1.25;
  const w = Math.ceil(maxW + padX * 2 + 8);
  const h = Math.ceil(lines.length * lineH + padY * 2 + 4);
  // Power-of-two friendly size helps filtering; not required but sharper
  canvas.width = Math.max(16, w);
  canvas.height = Math.max(16, h);
  // Re-apply fonts after resize (canvas clear resets state)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  // Soft dark halo for readability without a hard rectangle
  lines.forEach((line, i) => {
    const y = padY + lineH * (i + 0.5);
    ctx.font = fonts[i];
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.strokeText(line, canvas.width / 2, y);
    ctx.fillStyle =
      i === 0 ? "rgba(245, 250, 255, 0.98)" : "rgba(200, 218, 232, 0.92)";
    ctx.fillText(line, canvas.width / 2, y);
  });
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  // Premultiply off + flipY true = upright, readable sprites in r152+
  map.premultiplyAlpha = false;
  map.flipY = true;
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return { map, aspect: canvas.width / Math.max(canvas.height, 1) };
}

function labelWorldHeight(dist: number, kind: "name" | "detail"): number {
  const base = kind === "detail" ? 1.15 : 0.95;
  return THREE.MathUtils.clamp(
    dist * 0.012 * base,
    0.75,
    kind === "detail" ? 2.1 : 1.7,
  );
}

/** Screen-space test: is world point on/near the sun disc from the camera? */
function isNearSunDisc(
  world: THREE.Vector3,
  camera: THREE.Camera,
  tmpA: THREE.Vector3,
  tmpB: THREE.Vector3,
  labelRadius = 0,
): boolean {
  if (!(camera instanceof THREE.PerspectiveCamera)) {
    // Fallback to crude angular test for non-perspective cameras.
    tmpA.copy(world).sub(camera.position);
    const dist = tmpA.length();
    if (dist < 1e-4) return true;
    tmpA.normalize();
    tmpB.copy(camera.position).multiplyScalar(-1).normalize(); // toward origin
    const cos = tmpA.dot(tmpB);

    const sunDist = camera.position.length();
    if (sunDist <= SUN_RADIUS) return true;
    const sunAngle = Math.asin(Math.min(1, SUN_RADIUS / sunDist));
    const bufferAngle = 0.05;
    return cos > Math.cos(sunAngle + bufferAngle + labelRadius);
  }

  const screenSun = tmpA.set(0, 0, 0).project(camera);
  const cameraRight = tmpB.set(1, 0, 0).applyQuaternion(camera.quaternion);
  const sunWorldEdge = new THREE.Vector3()
    .copy(cameraRight)
    .multiplyScalar(SUN_RADIUS);
  const screenSunEdge = sunWorldEdge.project(camera);
  const sunRadius = Math.abs(screenSunEdge.x - screenSun.x);

  const labelScreen = new THREE.Vector3().copy(world).project(camera);
  const labelDist = camera.position.distanceTo(world);
  const labelWorldRadius = labelDist * Math.tan(labelRadius);
  const labelWorldEdge = new THREE.Vector3()
    .copy(world)
    .addScaledVector(cameraRight, labelWorldRadius);
  const labelScreenEdge = labelWorldEdge.project(camera);
  const labelRadiusScreen = Math.abs(labelScreenEdge.x - labelScreen.x);

  const dist = Math.hypot(
    labelScreen.x - screenSun.x,
    labelScreen.y - screenSun.y,
  );
  return dist < sunRadius + labelRadiusScreen + 0.03;
}

function DistanceLabel({
  itemId,
  name,
  livePos,
  systemView = true,
}: {
  itemId: string;
  name: string;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  systemView?: boolean;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const { camera } = useThree();
  const cullDist = systemView ? 150 : 48;
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);

  const { map, aspect } = useMemo(
    () => makeTextSpriteTexture([name], { fontSize: 20 }),
    [name],
  );

  useEffect(
    () => () => {
      map.dispose();
    },
    [map],
  );

  useFrame(() => {
    const spr = spriteRef.current;
    const mat = matRef.current;
    const p = livePos.current.get(itemId);
    if (!spr || !mat || !p) return;

    const d = camera.position.distanceTo(p);
    const labelPos = new THREE.Vector3(
      p.x,
      p.y + 0.5 + Math.min(d * 0.006, 0.9),
      p.z,
    );
    spr.position.copy(labelPos);

    const h = labelWorldHeight(d, "name");
    const labelWidth = h * aspect;
    const labelRadius = Math.atan2(
      Math.sqrt((labelWidth * 0.5) ** 2 + (h * 0.5) ** 2),
      d,
    );
    const onSun = isNearSunDisc(
      labelPos,
      camera,
      tmpA,
      tmpB,
      labelRadius * 1.25,
    );
    const visible = d < cullDist && d > 3 && !onSun && p.length() > 6.5;
    spr.visible = visible;
    if (!visible) return;

    // Always positive scale — negative Y would mirror text upside-down
    spr.scale.set(Math.abs(h * aspect), Math.abs(h), 1);
    spr.center.set(0.5, 0); // anchor bottom-center above the body
    mat.opacity = THREE.MathUtils.clamp(1.0 - d / cullDist, 0.45, 0.95);
  });

  return (
    <sprite ref={spriteRef} renderOrder={20} frustumCulled={false}>
      <spriteMaterial
        ref={matRef}
        map={map}
        transparent
        alphaTest={0.12}
        depthTest
        depthWrite={false}
        toneMapped={false}
        sizeAttenuation
      />
    </sprite>
  );
}

function SelectionLabel({
  selectedItem,
  livePos,
}: {
  selectedItem: CelestialItem;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const { camera } = useThree();
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  const offsetY = isAsteroid(selectedItem)
    ? 1.0
    : Math.max(1.0, (selectedItem as Planet).size * 0.5 + 0.75);

  const lines = useMemo(() => {
    if (isAsteroid(selectedItem)) {
      const tag = selectedItem.isHazardous ? "PHA" : "NEO";
      const diam = formatDiameterKm(
        selectedItem.diameterKmMin,
        selectedItem.diameterKmMax,
        selectedItem.size,
      );
      const miss = selectedItem.approach
        ? formatMiss(
            selectedItem.approach.missLd,
            selectedItem.approach.missKm,
            { compact: true },
          )
        : null;
      return [
        selectedItem.name,
        miss ? `${tag} · ${miss} · ${diam}` : `${tag} · ${diam}`,
      ];
    }
    return [
      selectedItem.name,
      `${(selectedItem as Planet).earthRadii.toFixed(2)} R⊕ · ${selectedItem.orbit.periodYears.toFixed(2)} yr`,
    ];
  }, [selectedItem]);

  const { map, aspect } = useMemo(
    () => makeTextSpriteTexture(lines, { fontSize: 20 }),
    [lines],
  );

  useEffect(
    () => () => {
      map.dispose();
    },
    [map],
  );

  useFrame(() => {
    const spr = spriteRef.current;
    const mat = matRef.current;
    if (!spr || !mat) return;
    const p = livePos.current.get(selectedItem.id);
    const labelPos = p
      ? new THREE.Vector3(p.x, p.y + offsetY, p.z)
      : new THREE.Vector3(
          selectedItem.position.x,
          selectedItem.position.y + offsetY,
          selectedItem.position.z,
        );
    spr.position.copy(labelPos);
    const d = camera.position.distanceTo(labelPos);
    const h = labelWorldHeight(d, "detail");
    const labelWidth = h * aspect;
    const labelRadius = Math.atan2(
      Math.sqrt((labelWidth * 0.5) ** 2 + (h * 0.5) ** 2),
      d,
    );
    const onSun = isNearSunDisc(
      labelPos,
      camera,
      tmpA,
      tmpB,
      labelRadius * 1.25,
    );
    spr.visible = !onSun;
    if (onSun) return;
    spr.scale.set(Math.abs(h * aspect), Math.abs(h), 1);
    spr.center.set(0.5, 0); // bottom-center so text sits above the body upright
  });

  return (
    <sprite ref={spriteRef} renderOrder={25} frustumCulled={false}>
      <spriteMaterial
        ref={matRef}
        map={map}
        transparent
        alphaTest={0.12}
        depthTest
        depthWrite={false}
        toneMapped={false}
        sizeAttenuation
        opacity={0.95}
      />
    </sprite>
  );
}

/* ------------------------------------------------------------------ */
/*  Generic planet                                                     */
/* ------------------------------------------------------------------ */

const JUPITER_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const JUPITER_FRAG = /* glsl */ `
uniform sampler2D map;
uniform float uTime;
varying vec2 vUv;
varying vec3 vNormalW;
varying vec3 vPosW;
// simple band turbulence
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  float a = hash(i); float b = hash(i+vec2(1.,0.));
  float c = hash(i+vec2(0.,1.)); float d = hash(i+vec2(1.,1.));
  vec2 u = f*f*(3.-2.*f);
  return mix(a,b,u.x)+ (c-a)*u.y*(1.-u.x)+ (d-b)*u.x*u.y;
}
void main() {
  vec2 uv = vUv;
  float bands = sin(uv.y * 48.0 + noise(uv * vec2(6.0, 20.0) + uTime * 0.05) * 1.5);
  vec3 base = texture2D(map, uv).rgb;
  base *= 0.92 + bands * 0.08;
  // great-red-spot-ish warm blotch
  vec2 spot = uv - vec2(0.62, 0.42);
  spot.x *= 1.8;
  float s = exp(-dot(spot, spot) * 90.0);
  base = mix(base, base * vec3(1.15, 0.75, 0.55), s * 0.45);
  vec3 n = normalize(vNormalW);
  vec3 l = normalize(-vPosW);
  float ndl = clamp(dot(n, l) * 0.55 + 0.45, 0.2, 1.0);
  gl_FragColor = vec4(base * ndl, 1.0);
}
`;

/**
 * SSS ring strip is 2048×125 (radial features along width).
 * Three.js RingGeometry UVs are (angle, radius) — swap so width maps radially.
 */
function makeSaturnRingGeometry(
  inner: number,
  outer: number,
  theta = 192,
  radial = 6,
): THREE.RingGeometry {
  const geo = new THREE.RingGeometry(inner, outer, theta, radial);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const angleU = uv.getX(i); // 0..1 around circumference
    const radiusV = uv.getY(i); // 0..1 inner → outer
    // U = radial (Cassini division etc.), V = mild angular sample of the strip
    uv.setXY(i, radiusV, 0.35 + angleU * 0.3);
  }
  uv.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Multi-layer Saturn rings with correct SSS UVs + equatorial tilt. */
function SaturnRings({
  displaySize,
  ringMap,
  axialTilt,
}: {
  displaySize: number;
  ringMap: THREE.Texture;
  axialTilt: number;
}) {
  // Approximate real ratios (R_s): D/C ~1.11–1.5, B ~1.5–1.95, A ~2.02–2.27
  const mainGeo = useMemo(
    () =>
      makeSaturnRingGeometry(displaySize * 1.12, displaySize * 2.32, 256, 8),
    [displaySize],
  );
  // Thin outer F-ring hint
  const outerGeo = useMemo(
    () =>
      makeSaturnRingGeometry(displaySize * 2.34, displaySize * 2.42, 128, 2),
    [displaySize],
  );

  useEffect(() => {
    // Premultiply-friendly sampling for the alpha strip
    ringMap.colorSpace = THREE.SRGBColorSpace;
    ringMap.anisotropy = 8;
    ringMap.wrapS = THREE.ClampToEdgeWrapping;
    ringMap.wrapT = THREE.ClampToEdgeWrapping;
    ringMap.needsUpdate = true;
  }, [ringMap]);

  return (
    // RingGeometry lies in XY; flip to XZ equatorial plane, match planet axial tilt
    <group rotation={[Math.PI / 2, 0, axialTilt]}>
      <mesh geometry={mainGeo} renderOrder={2}>
        <meshStandardMaterial
          map={ringMap}
          color="#f0e6d0"
          transparent
          opacity={0.98}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={0.92}
          metalness={0.08}
          alphaTest={0.04}
          emissive="#1a140c"
          emissiveIntensity={0.12}
        />
      </mesh>
      {/* Soft underside so the ring doesn't vanish when lit from above */}
      <mesh geometry={mainGeo} renderOrder={1} scale={[1, 1, 1]}>
        <meshBasicMaterial
          map={ringMap}
          color="#8a7a60"
          transparent
          opacity={0.35}
          side={THREE.BackSide}
          depthWrite={false}
          alphaTest={0.06}
          toneMapped={false}
        />
      </mesh>
      <mesh geometry={outerGeo} renderOrder={2}>
        <meshBasicMaterial
          map={ringMap}
          color="#d8c8a8"
          transparent
          opacity={0.45}
          side={THREE.DoubleSide}
          depthWrite={false}
          alphaTest={0.08}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function PlanetBody({
  planet,
  livePos,
  onClick,
  selected,
}: {
  planet: Planet;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  onClick: () => void;
  selected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const ringGroupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const t = useT();
  const { trueScale, quality } = useSimSettings();
  const displaySize = scaleSize(planet.size, trueScale);
  const segs = qualitySettings(quality).planetSegments;

  // Preloaded at boot — rarely null after first frames
  const albedoUrl = PLANET_ALBEDO[planet.name] ?? null;
  const colorMap = useLazyTexture(albedoUrl);
  const cloudMap = useLazyTexture(
    planet.name === "Venus" ? EXTRA_MAPS.venusAtmo : null,
  );
  const ringMap = useLazyTexture(
    planet.hasRings || planet.name === "Saturn" ? EXTRA_MAPS.saturnRing : null,
  );

  // Force material map update when texture arrives (avoids stuck solid spheres)
  useEffect(() => {
    if (matRef.current) {
      matRef.current.map = colorMap;
      matRef.current.needsUpdate = true;
    }
  }, [colorMap]);

  const atmo: Record<string, string> = {
    Venus: "#e8c878",
    Mars: "#c47850",
    Jupiter: "#d4c4a0",
    Saturn: "#e0d0b0",
    Uranus: "#7fd0e0",
    Neptune: "#4a7ad4",
  };

  const placeholder: Record<string, string> = {
    Mercury: "#9a9088",
    Venus: "#d4b878",
    Mars: "#c06040",
    Jupiter: "#c8b090",
    Saturn: "#e0d0a0",
    Uranus: "#80d0e0",
    Neptune: "#4a70c0",
  };

  const jupUniforms = useMemo(
    () => ({
      map: { value: colorMap as THREE.Texture | null },
      uTime: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    jupUniforms.map.value = colorMap;
  }, [colorMap, jupUniforms]);

  useFrame(() => {
    const time = t();
    jupUniforms.uTime.value = time;
    const raw = positionOnOrbit(planet.orbit, time);
    const p = scalePosition(raw, trueScale);
    if (groupRef.current) {
      groupRef.current.position.set(p.x, p.y, p.z);
      let stored = livePos.current.get(planet.id);
      if (!stored) {
        stored = new THREE.Vector3();
        livePos.current.set(planet.id, stored);
      }
      stored.set(p.x, p.y, p.z);
    }
    if (bodyRef.current) {
      bodyRef.current.rotation.order = "ZXY";
      bodyRef.current.rotation.z = planet.axialTilt;
      bodyRef.current.rotation.y = spinAngle(planet.spinDays, time);
    }
    if (cloudRef.current) {
      cloudRef.current.rotation.order = "ZXY";
      cloudRef.current.rotation.z = planet.axialTilt;
      cloudRef.current.rotation.y = spinAngle(
        Math.abs(planet.spinDays) * 0.9,
        time,
      );
    }
    // Rings share axial tilt but do not spin with the day
    if (ringGroupRef.current) {
      ringGroupRef.current.rotation.set(0, 0, planet.axialTilt);
    }
  });

  const isJupiter = planet.name === "Jupiter";
  const isSaturn = planet.name === "Saturn";

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh ref={bodyRef} scale={displaySize}>
        <sphereGeometry
          args={[1, isSaturn ? segs + 16 : segs, isSaturn ? segs + 16 : segs]}
        />
        {isJupiter && colorMap ? (
          <shaderMaterial
            vertexShader={JUPITER_VERT}
            fragmentShader={JUPITER_FRAG}
            uniforms={jupUniforms}
          />
        ) : (
          <meshStandardMaterial
            ref={matRef}
            map={colorMap}
            roughness={
              planet.name === "Uranus" || planet.name === "Neptune"
                ? 0.45
                : isSaturn
                  ? 0.78
                  : 0.78
            }
            metalness={
              planet.name === "Uranus" || planet.name === "Neptune"
                ? 0.12
                : isSaturn
                  ? 0.04
                  : 0.05
            }
            color={
              colorMap
                ? planet.name === "Uranus"
                  ? "#c8f0f5"
                  : planet.name === "Neptune"
                    ? "#a8c4ff"
                    : isSaturn
                      ? "#fff6e8"
                      : "#ffffff"
                : placeholder[planet.name] ?? "#888888"
            }
          />
        )}
      </mesh>
      {/* Saturn: soft shadow of rings on the globe */}
      {isSaturn && (
        <mesh
          scale={[displaySize * 1.01, displaySize * 0.18, displaySize * 1.01]}
        >
          <sphereGeometry args={[1, 48, 16]} />
          <meshBasicMaterial
            color="#0a0806"
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      )}
      {cloudMap && (
        <mesh ref={cloudRef} scale={displaySize * 1.02}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshStandardMaterial
            map={cloudMap}
            transparent
            opacity={0.55}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      )}
      {atmo[planet.name] && (
        <mesh scale={displaySize * (isSaturn ? 1.04 : 1.05)}>
          <sphereGeometry args={[1, 32, 32]} />
          <meshBasicMaterial
            color={atmo[planet.name]}
            transparent
            opacity={selected ? 0.18 : isSaturn ? 0.08 : 0.1}
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      {isSaturn && ringMap && (
        <group ref={ringGroupRef}>
          <SaturnRings
            displaySize={displaySize}
            ringMap={ringMap}
            axialTilt={0}
          />
        </group>
      )}
    </group>
  );
}

/**
 * Smooth closed orbit ring via Line2 (screen-space width + built-in AA).
 *
 * Why not native THREE.Line?
 * WebGL line primitives are always ~1px, poorly antialiased, and with few
 * samples look like “tiny broken chords glued together.” Line2 draws a
 * continuous ribbon with proper joins.
 *
 * Why not dashed / fat tubes? Thin continuous ellipse (~0.7–1px screen space).
 */
function OrbitLine({
  points,
  color,
  opacity = 0.62,
  selected = false,
  lineWidth = 0.85,
}: {
  points: THREE.Vector3[];
  color: string | number;
  opacity?: number;
  lineWidth?: number;
  selected?: boolean;
}) {
  const { size } = useThree();

  const { line, geometry, material } = useMemo(() => {
    const geometry = new LineGeometry();
    const material = new LineMaterial({
      color: 0xffffff,
      linewidth: 0.85,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      depthTest: true,
      toneMapped: false,
      // worldUnits: false → linewidth is in CSS pixels (stable under zoom)
      worldUnits: false,
    });
    const line = new Line2(geometry, material);
    line.frustumCulled = false;
    line.renderOrder = -1;
    return { line, geometry, material };
  }, []);

  // Keep resolution in sync so Line2 AA doesn’t shimmer on resize / DPR change
  useEffect(() => {
    material.resolution.set(size.width, size.height);
  }, [material, size.width, size.height]);

  useEffect(() => {
    if (points.length < 2) return;

    // Closed ring: append start so last segment meets first (no gap at periapsis)
    const n = points.length;
    const alreadyClosed =
      n > 2 && points[0].distanceToSquared(points[n - 1]) < 1e-10;
    const ring = alreadyClosed ? points : [...points, points[0]];

    geometry.setFromPoints(ring);
    line.computeLineDistances();

    material.color.set(color as THREE.ColorRepresentation);
    // Selected: slightly brighter, barely thicker — still a fine hairline
    material.opacity = selected ? Math.min(opacity + 0.12, 0.88) : opacity;
    material.linewidth = selected ? lineWidth * 1.15 : lineWidth;
    material.needsUpdate = true;
  }, [points, color, opacity, selected, lineWidth, geometry, material, line]);

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  if (points.length < 2) return null;
  return <primitive object={line} />;
}

/**
 * DepthOfField is intentionally disabled because its mask pass can produce
 * a black rectangle around the sun in Near-Earth view.
 */

/** Immediate dark clear — runs outside Suspense so first paint is never light-blue. */
export function SceneBackdrop() {
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor(new THREE.Color("#010308"), 1);
  }, [gl]);
  return (
    <>
      <color attach="background" args={["#010308"]} />
      <fog attach="fog" args={["#010308", 220, 620]} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export type CompareOrbitSpec = {
  id: string;
  name: string;
  hazardous: boolean;
  /** Accent for dual-orbit compare (P4) */
  color: string;
  points: THREE.Vector3[];
};

export type ThreeDSceneProps = {
  items?: CelestialItem[];
  onItemClick: (item: CelestialItem) => void;
  selectedItem: CelestialItem | null;
  showPlanets: boolean;
  planetsData?: Planet[];
  /** P4 — up to 2 NEO orbits drawn for compare (may include non-selected) */
  compareOrbits?: CompareOrbitSpec[];
  /** P5 — live ISS (Near-Earth schematic) */
  showIss?: boolean;
  iss?: IssPosition | null;
  /** Tight Earth–ISS view: larger station, LEO ring, hide NEO clutter */
  issFocus?: boolean;
  /** P6 — distance ruler endpoints (body id or "sun") */
  measureAId?: string | null;
  measureBId?: string | null;
  onMeasureDistance?: (sceneDist: number | null) => void;
};

const ThreeDScene = React.memo(function ThreeDScene({
  items = [],
  onItemClick,
  selectedItem,
  showPlanets,
  planetsData = [],
  compareOrbits = [],
  showIss = false,
  iss = null,
  issFocus = false,
  measureAId = null,
  measureBId = null,
  onMeasureDistance,
}: ThreeDSceneProps) {
  const { gl } = useThree();
  const asteroidGltf = useGLTF("/models/bennu.glb", true) as GLTF;
  const sunMeshRef = useRef<THREE.Mesh | null>(null);
  const { trueScale, showLabels, quality, cameraMode, viewScale } =
    useSimSettings();
  const t = useT();
  const q = qualitySettings(quality);
  const nearEarth = viewScale === "nearEarth";
  const colorsDirty = useRef(true);
  /** Don't draw NEOs until matrices are written — identity = stacked on the sun. */
  const neoMatricesReady = useRef(false);
  const earthRadiusRef = useRef(1.2);
  const issEarthPos = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    useGLTF.preload("/models/bennu.glb");
    // Boot: only sun + sky (and Earth soon after). Outer planets wait for System view.
    preloadBootTextures();
    preloadEarthTextures();
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = q.exposure;
    const maxDpr = q.dprMax;
    gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  }, [gl, quality, q.dprMax, q.exposure]);

  const asteroidRef = useRef<THREE.InstancedMesh>(null);
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const scaleVec = useMemo(() => new THREE.Vector3(), []);
  const posVec = useMemo(() => new THREE.Vector3(), []);
  const livePos = useRef(new Map<string, THREE.Vector3>());
  const earthPosRef = useRef(new THREE.Vector3(14, 0, 0));

  const INNER_PLANETS = useMemo(
    () => new Set(["Mercury", "Venus", "Earth", "Mars"]),
    [],
  );

  /**
   * Keep planets mounted (visibility only) when switching Near-Earth —
   * unmounting remounts React trees and flashes Bloom/postprocessing.
   * - showPlanets on  → full set (outer hidden via visible in near-Earth)
   * - showPlanets off → Earth (+ Moon) only
   */
  const bodyPlanets = useMemo(() => {
    if (showPlanets) return planetsData;
    return planetsData.filter((p) => p.name === "Earth");
  }, [planetsData, showPlanets]);

  const isBodyVisible = (name: string) =>
    !nearEarth || INNER_PLANETS.has(name) || name === "Earth";

  // Orbits: hide outer in near-Earth; skip all when toggle off
  const orbitPlanets = useMemo(() => {
    if (!showPlanets) return [] as Planet[];
    if (!nearEarth) return planetsData;
    return planetsData.filter((p) => INNER_PLANETS.has(p.name));
  }, [showPlanets, nearEarth, planetsData, INNER_PLANETS]);

  /**
   * Warm textures for **visible** bodies only.
   * Near-Earth → inner + Earth. System → full set.
   * Outer maps stay cold until System view (isBodyVisible flips them on).
   */
  useEffect(() => {
    const srgb: string[] = [EXTRA_MAPS.sun, EXTRA_MAPS.milkyWay];
    let needEarth = false;

    for (const p of bodyPlanets) {
      if (!isBodyVisible(p.name)) continue;

      if (p.name === "Earth") {
        needEarth = true;
        continue;
      }

      const albedo = PLANET_ALBEDO[p.name];
      if (albedo) srgb.push(albedo);
      if (p.name === "Venus") srgb.push(EXTRA_MAPS.venusAtmo);
      if (p.hasRings || p.name === "Saturn") srgb.push(EXTRA_MAPS.saturnRing);
    }

    if (needEarth) preloadEarthTextures();
    preloadTextures(srgb, true);
  }, [bodyPlanets, nearEarth]);

  const asteroids = useMemo(() => {
    const list = items.filter(isAsteroid);
    return list.slice(0, q.maxNeos);
  }, [items, q.maxNeos]);

  // Precompute per-asteroid static data once (avoid hashString every frame)
  const asteroidStatic = useMemo(
    () =>
      asteroids.map((a) => {
        const seed = hashString(a.id);
        const scaleMul = nearEarth ? 2.8 : trueScale ? 1.0 : 1.65;
        const s = Math.max(
          asteroidDisplayScale(a.size) * scaleMul,
          nearEarth ? 0.42 : 0.28,
        );
        // Warm rock tones — avoid pure-black silhouettes on the sun
        const color = a.isHazardous
          ? new THREE.Color("#e89878")
          : new THREE.Color().setRGB(
              0.55 + (seed % 40) / 120,
              0.5 + (seed % 35) / 130,
              0.45 + (seed % 30) / 140,
            );
        // Selection: slight warm lift (not light-blue — that was the old marker)
        const selectedColor = color.clone().lerp(new THREE.Color("#ffe8c8"), 0.35);
        return { seed, scale: s, color, selectedColor, spinRate: a.spinRate };
      }),
    [asteroids, nearEarth, trueScale],
  );

  useEffect(() => {
    colorsDirty.current = true;
  }, [asteroids, nearEarth, trueScale, selectedItem?.id]);

  /**
   * Bennu GLB is ~565 units across (OSIRIS-REx meters). Without normalize,
   * instanced NEOs are planet-sized and look "broken". Center + unit-scale.
   * Also pull albedo map from the GLTF material when present.
   */
  const { bennuGeometry, bennuMap } = useMemo(() => {
    const found: { geo: THREE.BufferGeometry; map: THREE.Texture | null } = {
      geo: null as unknown as THREE.BufferGeometry,
      map: null,
    };
    let hasMesh = false;
    asteroidGltf.scene?.traverse((obj) => {
      if (hasMesh) return;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        hasMesh = true;
        found.geo = mesh.geometry;
        const mat = mesh.material as
          | THREE.MeshStandardMaterial
          | THREE.MeshStandardMaterial[];
        const m = Array.isArray(mat) ? mat[0] : mat;
        found.map = m?.map ?? null;
      }
    });
    if (!hasMesh) {
      return {
        bennuGeometry: null as THREE.BufferGeometry | null,
        bennuMap: null as THREE.Texture | null,
      };
    }

    const geo = found.geo.clone();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    geo.translate(-center.x, -center.y, -center.z);
    geo.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
    geo.computeBoundingSphere();
    geo.computeVertexNormals();
    const map = found.map;
    if (map) {
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
    }
    return { bennuGeometry: geo, bennuMap: map };
  }, [asteroidGltf]);

  const planetOrbits = useMemo(
    () =>
      orbitPlanets.map((p) => ({
        id: p.id,
        color: softOrbitColor(p.color),
        points: toThreePath(
          sampleOrbitPath(p.orbit, q.orbitSegments).map((pt) =>
            scalePosition(pt, trueScale),
          ),
        ),
      })),
    [orbitPlanets, trueScale, q.orbitSegments],
  );

  /** Selected NEO orbit — skipped if already in compare set (compare draws it). */
  const selectedAsteroidOrbit = useMemo(() => {
    if (!selectedItem || !isAsteroid(selectedItem)) return null;
    if (!asteroids.some((a) => a.id === selectedItem.id)) return null;
    if (compareOrbits.some((c) => c.id === selectedItem.id)) return null;
    return {
      id: selectedItem.id,
      hazardous: selectedItem.isHazardous,
      points: toThreePath(
        sampleOrbitPath(selectedItem.orbit, q.orbitSegments).map((pt) =>
          scalePosition(pt, trueScale),
        ),
      ),
    };
  }, [selectedItem, asteroids, trueScale, q.orbitSegments, compareOrbits]);

  const asteroidMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe8d8c0,
      map: bennuMap ?? null,
      roughness: 0.82,
      metalness: 0.04,
      flatShading: false,
      // Lift fills so NEOs don’t become black rectangles against the photosphere
      emissive: 0x3a3228,
      emissiveIntensity: 0.35,
    });
    mat.vertexColors = false;
    return mat;
  }, [bennuMap]);

  const fallbackGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const neoGeometry = bennuGeometry ?? fallbackGeo;

  // Ensure instanced mesh can receive per-instance colors
  useEffect(() => {
    const mesh = asteroidRef.current;
    if (!mesh || asteroids.length === 0) return;
    if (!mesh.instanceColor) {
      const colors = new Float32Array(Math.max(asteroids.length, 32) * 3);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    }
    colorsDirty.current = true;
  }, [asteroids.length, neoGeometry]);

  // When asteroid set/geometry changes, hide until matrices are written (prevents
  // a frame of every instance at the origin = black mass on the sun).
  useEffect(() => {
    neoMatricesReady.current = false;
    if (asteroidRef.current) asteroidRef.current.visible = false;
  }, [asteroids, neoGeometry, nearEarth, trueScale]);

  useFrame(() => {
    const time = t();

    if (asteroidRef.current && asteroids.length > 0) {
      const mesh = asteroidRef.current;
      mesh.count = asteroids.length;
      for (let i = 0; i < asteroids.length; i++) {
        const a = asteroids[i];
        const st = asteroidStatic[i];
        const raw = positionOnOrbit(a.orbit, time);
        const p = scalePosition(raw, trueScale);
        posVec.set(p.x, p.y, p.z);
        let stored = livePos.current.get(a.id);
        if (!stored) {
          stored = new THREE.Vector3();
          livePos.current.set(a.id, stored);
        }
        stored.copy(posVec);

        const tumble = asteroidTumble(st.spinRate, time, st.seed);
        euler.set(tumble.x, tumble.y, tumble.z);
        quat.setFromEuler(euler);
        scaleVec.set(st.scale, st.scale, st.scale);
        matrix.compose(posVec, quat, scaleVec);
        mesh.setMatrixAt(i, matrix);

        // Selection / compare tints (A/B match orbit line colors)
        let col = st.color;
        const cmp = compareOrbits.find((c) => c.id === a.id);
        if (cmp) {
          col = st.color.clone().lerp(new THREE.Color(cmp.color), 0.55);
        } else if (selectedItem?.id === a.id) {
          col = st.selectedColor;
        }
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      colorsDirty.current = false;
      if (!neoMatricesReady.current) {
        neoMatricesReady.current = true;
        mesh.visible = true;
      }
    }

    // Track Earth for near-Earth camera + ISS placement
    const ep = livePos.current.get("planet:Earth");
    if (ep) {
      earthPosRef.current.copy(ep);
      issEarthPos.copy(ep);
    }
    const earthPlanet =
      planetsData.find((p) => p.name === "Earth") ??
      bodyPlanets.find((p) => p.name === "Earth");
    if (earthPlanet) {
      earthRadiusRef.current = scaleSize(earthPlanet.size, trueScale);
    }
  });

  return (
    <group>
      {/* background/fog set by SceneBackdrop (outside Suspense) for dark first paint */}

      <ambientLight intensity={0.14} />
      <hemisphereLight args={["#3a4a68", "#0c0a08", 0.28]} />

      {q.enableMilkyWay && <MilkyWaySky />}
      <RealisticStars count={q.starCount} radius={320} depth={100} />
      {/* Zodiacal — cinematic System only (in Near-Earth it reads as a golden fog wall) */}
      {q.enableShafts && !nearEarth && !issFocus && <ZodiacalDust />}
      {/* Main belt is a different population — hide in Near-Earth NEO view */}
      <group visible={!nearEarth && !issFocus}>
        <AsteroidBelt trueScale={trueScale} count={q.beltCount} />
      </group>
      {/* Dim the sun in ISS focus so Earth + station read clearly */}
      <group visible={!issFocus || !nearEarth}>
        <Sun meshRef={sunMeshRef} />
      </group>
      {issFocus && nearEarth && (
        <ambientLight intensity={0.55} />
      )}

      {!issFocus &&
        planetOrbits.map((o) => (
          <OrbitLine
            key={`p-orbit-${o.id}`}
            points={o.points}
            color={o.color}
            opacity={nearEarth ? 0.58 : 0.52}
            lineWidth={q.orbitLineWidth}
            selected={selectedItem?.id === o.id}
          />
        ))}

      {bodyPlanets.map((p) => {
        const vis = isBodyVisible(p.name);
        if (p.name === "Earth") {
          return (
            <group key={p.id} visible={vis}>
              <EarthBody
                planet={p}
                livePos={livePos}
                selected={selectedItem?.id === p.id}
                onClick={() => onItemClick(p)}
              />
              {/* P5 — ISS schematic LEO marker (Near-Earth only) */}
              {/* Ring + craft as soon as Show ISS is on — do not wait for /api/iss */}
              {showIss && nearEarth && vis && (
                <IssMarker
                  iss={iss}
                  earthPos={issEarthPos}
                  earthDisplayRadius={
                    // Prefer live Earth radius; stable fallback so ring isn't tiny/zero
                    earthRadiusRef.current > 0.2
                      ? earthRadiusRef.current
                      : scaleSize(
                          planetsData.find((p) => p.name === "Earth")?.size ??
                            1.2,
                          trueScale
                        )
                  }
                  focusMode={issFocus}
                />
              )}
            </group>
          );
        }
        // ISS focus: only Earth (and ISS) — hide other planets
        if (issFocus) return null;
        return (
          <group key={p.id} visible={vis}>
            <PlanetBody
              planet={p}
              livePos={livePos}
              selected={selectedItem?.id === p.id}
              onClick={() => onItemClick(p)}
            />
          </group>
        );
      })}

      {/* P4 compare orbits — hide during ISS focus */}
      {!issFocus &&
        compareOrbits.map((c) => (
          <OrbitLine
            key={`cmp-orbit-${c.id}`}
            points={c.points}
            color={c.color}
            opacity={0.85}
            lineWidth={q.orbitLineWidth * 1.25}
            selected
          />
        ))}

      {!issFocus && selectedAsteroidOrbit && (
        <OrbitLine
          points={selectedAsteroidOrbit.points}
          color={selectedAsteroidOrbit.hazardous ? "#d07060" : "#8aa4b8"}
          opacity={0.72}
          lineWidth={q.orbitLineWidth * 1.1}
          selected
        />
      )}

      {/* Progress marker only for planets — for NEOs a solid sphere sat on the
          rock and looked like a light-blue “selected asteroid” (bug). */}
      {selectedItem &&
        !isAsteroid(selectedItem) &&
        bodyPlanets.some((p) => p.id === selectedItem.id) && (
          <OrbitProgressMarker orbit={selectedItem.orbit} color="#d0e8ff" />
        )}

      {selectedItem && isAsteroid(selectedItem) && (
        <MotionTrail livePos={livePos} itemId={selectedItem.id} />
      )}

      {/* Compare labels in Near-Earth / system */}
      {showLabels &&
        compareOrbits.map((c) => (
          <DistanceLabel
            key={`lbl-cmp-${c.id}`}
            itemId={c.id}
            name={c.name}
            livePos={livePos}
            systemView={!nearEarth}
          />
        ))}

      {/*
        Outline-only sprite labels (no dark panels).
        Near-Earth: Earth + selected only — fewer chips near the sun.
      */}
      {showLabels &&
        bodyPlanets
          .filter((p) => isBodyVisible(p.name))
          .filter(
            (p) =>
              !nearEarth || p.name === "Earth" || selectedItem?.id === p.id,
          )
          .map((p) => (
            <DistanceLabel
              key={`lbl-${p.id}`}
              itemId={p.id}
              name={p.name}
              livePos={livePos}
              systemView={!nearEarth}
            />
          ))}

      {showLabels &&
        selectedItem &&
        isAsteroid(selectedItem) &&
        asteroids.some((a) => a.id === selectedItem.id) && (
          <DistanceLabel
            key={`lbl-neo-${selectedItem.id}`}
            itemId={selectedItem.id}
            name={selectedItem.name}
            livePos={livePos}
            systemView={!nearEarth}
          />
        )}

      {/*
        Bennu GLB instanced NEOs.
        Geometry is unit-normalized (~565m OSIRIS-REx mesh → 1 unit).
        Use raw InstancedMesh so useFrame matrices aren't fought by <Instance>.
      */}
      {asteroids.length > 0 && !issFocus && (
        <instancedMesh
          ref={asteroidRef}
          args={[neoGeometry, asteroidMaterial, Math.max(asteroids.length, 1)]}
          frustumCulled={false}
          castShadow={false}
          receiveShadow={false}
          // Hidden until first useFrame writes real orbit matrices (see neoMatricesReady)
          visible={false}
          onClick={(e) => {
            e.stopPropagation();
            const id = e.instanceId;
            if (id == null || id < 0 || id >= asteroids.length) return;
            onItemClick(asteroids[id]);
          }}
        />
      )}

      {/*
        No EffectComposer / Bloom / DOF — full-screen post caused the black
        square on the sun (especially Near-Earth). Glow is scene-based for both
        views: geometric corona shells + SolarFlare (bloom disc, halo, streaks,
        ghosts). Curves only differ by camera distance / viewScale.
      */}

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
        // Keep limits stable across viewScale — changing them mid-flight flashes/clamps
        minDistance={4}
        maxDistance={220}
        maxPolarAngle={Math.PI * 0.48}
        minPolarAngle={0.15}
        // Do NOT pass target={...} every render — it snaps the look-at and flashes
        enabled={cameraMode === "free" && !issFocus}
      />
      <CameraDirector
        selectedItem={selectedItem}
        livePos={livePos}
        controlsRef={controlsRef}
        earthPosRef={earthPosRef}
        issFocus={issFocus && nearEarth}
      />

      {/* P6 distance ruler — dashed segment between two endpoints */}
      {measureAId && measureBId && (
        <MeasureLine
          getA={() => {
            if (measureAId === "sun") return new THREE.Vector3(0, 0, 0);
            return livePos.current.get(measureAId) ?? null;
          }}
          getB={() => {
            if (measureBId === "sun") return new THREE.Vector3(0, 0, 0);
            return livePos.current.get(measureBId) ?? null;
          }}
          onDistance={onMeasureDistance}
        />
      )}

      {selectedItem && (
        <SelectionLabel selectedItem={selectedItem} livePos={livePos} />
      )}
    </group>
  );
});

export default ThreeDScene;
