/** Photographic milky-way sky shaders (no React). */

export const MW_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const MW_FRAG = /* glsl */ `
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
