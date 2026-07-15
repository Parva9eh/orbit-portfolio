/** Earth day/night/specular sphere shaders. */

export const EARTH_VERT = /* glsl */ `
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

export const EARTH_FRAG = /* glsl */ `
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
