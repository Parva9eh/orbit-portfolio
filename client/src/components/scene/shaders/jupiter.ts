/** Jupiter band-turbulence shaders. */

export const JUPITER_VERT = /* glsl */ `
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

export const JUPITER_FRAG = /* glsl */ `
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
