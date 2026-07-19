/**
 * Milky-way skydome — camera-locked unit/scaled sphere.
 * Raw SSS plate is very dark; apply moderate exposure without crushing to white.
 */

export const MW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  vUv.x = 1.0 - vUv.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  // Draw as far background
  gl_Position.z = gl_Position.w * 0.9999;
}
`;

export const MW_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform float uHasMap;
uniform float uBoost;
varying vec2 vUv;

void main() {
  // Always dark fallback — never white
  if (uHasMap < 0.5) {
    gl_FragColor = vec4(0.004, 0.008, 0.02, 1.0);
    return;
  }

  vec3 t = texture2D(uMap, vUv).rgb;
  float lum = max(dot(t, vec3(0.299, 0.587, 0.114)), 1e-6);

  // Moderate exposure (uBoost ~12–14). Do NOT go into HDR white.
  vec3 col = t * uBoost;

  // Lift structure only
  float structure = smoothstep(0.0015, 0.04, lum);
  col = mix(col, pow(max(col, vec3(0.0)), vec3(0.72)), structure * 0.45);

  float band = smoothstep(0.003, 0.05, lum);
  col *= 1.0 + band * 0.9;
  col *= vec3(0.9, 0.93, 1.08);

  // Hard clamp — prevents white-out sky
  col = min(col, vec3(0.55));

  // Keep true voids dark
  float voidness = 1.0 - smoothstep(0.0, 0.002, lum);
  col *= 1.0 - voidness * 0.85;

  gl_FragColor = vec4(col, 1.0);
}
`;
