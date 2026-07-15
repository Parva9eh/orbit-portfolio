/** Sun photosphere + chromosphere shell shaders. */

export const SUN_RADIUS = 5.5;

export const SUN_VERT = /* glsl */ `
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

export const SUN_FRAG = /* glsl */ `
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
export const CHROMA_VERT = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vViewV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

export const CHROMA_FRAG = /* glsl */ `
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
