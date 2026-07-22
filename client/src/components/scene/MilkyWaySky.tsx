import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type MilkyWaySkyProps = {
  nearEarth?: boolean;
};

/**
 * Cinematic skybox at infinity (camera-locked):
 * - Zoom does NOT enlarge/shrink the MW — correct for true background
 * - Orbit only changes which part of the band you see
 * - Orientation tuned so the band crosses the default system/tablet view
 *   (not bunched in one corner)
 */
export default function MilkyWaySky({ nearEarth = false }: MilkyWaySkyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    const dark = new THREE.Color("#020612");
    gl.setClearColor(dark, 1);
    scene.background = dark;
  }, [gl, scene]);

  const uniforms = useMemo(
    () => ({
      uIntensity: { value: nearEarth ? 0.68 : 0.95 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ camera }) => {
    // Lock to camera position only — never scale with zoom (angular size fixed)
    groupRef.current?.position.copy(camera.position);
    if (matRef.current) {
      matRef.current.uniforms.uIntensity.value = nearEarth ? 0.68 : 0.95;
    }
  });

  return (
    <group ref={groupRef} renderOrder={-40}>
      <mesh frustumCulled={false} renderOrder={-40}>
        <sphereGeometry args={[300, 64, 40]} />
        <shaderMaterial
          ref={matRef}
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          fog={false}
          transparent
          blending={THREE.AdditiveBlending}
          uniforms={uniforms}
          vertexShader={/* glsl */ `
            varying vec3 vDir;
            void main() {
              // Direction in world space (group is camera-translated, not rotated)
              vDir = normalize(position);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mv;
              gl_Position.z = gl_Position.w * 0.99995;
            }
          `}
          fragmentShader={/* glsl */ `
            varying vec3 vDir;
            uniform float uIntensity;

            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }

            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              float a = hash(i);
              float b = hash(i + vec2(1.0, 0.0));
              float c = hash(i + vec2(0.0, 1.0));
              float d = hash(i + vec2(1.0, 1.0));
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            float fbm(vec2 p) {
              float v = 0.0;
              float a = 0.5;
              for (int i = 0; i < 5; i++) {
                v += a * noise(p);
                p *= 2.05;
                a *= 0.5;
              }
              return v;
            }

            /**
             * Map view dir → galactic coords so the bright band crosses
             * the default system camera (looking from ~+X+Y+Z toward origin)
             * as a centered diagonal — not a right-corner blob.
             *
             * Euler order: yaw → tilt → roll (tuned for tablet/desktop FOV).
             */
            vec3 toGalactic(vec3 d) {
              // Yaw ~ +18° (was -40° — that parked the bulge on the right)
              float cy = 0.9511;
              float sy = 0.3090;
              vec3 a = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);

              // Tilt ~48° from ecliptic (readable band without extreme cornering)
              float ct = 0.6694; // cos 48°
              float st = 0.7431;
              vec3 b = vec3(a.x, a.y * ct - a.z * st, a.y * st + a.z * ct);

              // Roll ~ -28° — diagonal sweep across the frame
              float cr = 0.8829; // cos 28°
              float sr = -0.4695;
              return vec3(b.x * cr - b.y * sr, b.x * sr + b.y * cr, b.z);
            }

            void main() {
              vec3 d = normalize(vDir);
              vec3 g = toGalactic(d);
              float lat = g.y;
              float absLat = abs(lat);
              float lon = atan(g.z, g.x);

              vec2 uv = vec2(lon * 1.2, lat * 3.8);
              float n1 = fbm(uv * 1.7 + 1.4);
              float n2 = fbm(uv * 4.2 - 0.9);
              float n3 = fbm(uv * 8.5 + n1);
              float clouds = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;

              // Wide band that reads across the frame
              float ridge = exp(-pow(absLat / 0.07, 2.0));
              float mid   = exp(-pow(absLat / 0.175, 2.0)) * 0.7;
              float halo  = exp(-pow(absLat / 0.4, 2.0)) * 0.26;
              float band  = (ridge + mid + halo) * (0.48 + 0.72 * clouds);

              // Soft dust lane (less harsh so it doesn't create a dark corner)
              float lane = exp(-pow(absLat / 0.028, 2.0)) * (0.45 + 0.4 * n2);
              band = max(band - lane * 0.28, 0.0);

              // Warm center — wider along the plane so it isn't a corner hotspot
              // lon offset shifts the brightest stretch toward mid-band
              float lonC = lon - 0.35;
              float bulge = exp(-pow(lonC / 1.15, 2.0)) * exp(-pow(absLat / 0.16, 2.0));
              bulge *= 0.55 + 0.45 * clouds;

              // Secondary cooler stretch opposite side (balances left/right)
              float farArm = exp(-pow((lon + 2.4) / 1.2, 2.0)) * mid * 0.4;

              float structure = 0.86 + 0.14 * sin(lon * 2.2 + clouds * 1.6);
              band = band * structure + farArm;

              vec3 deepBlue = vec3(0.16, 0.26, 0.58);
              vec3 silver   = vec3(0.52, 0.6, 0.9);
              vec3 amber    = vec3(0.95, 0.6, 0.32);
              vec3 gold     = vec3(1.0, 0.76, 0.45);
              vec3 laneCol  = vec3(0.07, 0.06, 0.1);

              // Cap warm mix so amber doesn't dominate one corner
              float warmMix = clamp(bulge * 1.05 + clouds * 0.08, 0.0, 0.72);
              vec3 dustCol = mix(deepBlue, silver, clamp(band * 0.85, 0.0, 1.0));
              dustCol = mix(dustCol, mix(amber, gold, clouds), warmMix);
              dustCol = mix(dustCol, laneCol, lane * 0.28);

              float glow = (band * 0.7 + bulge * 0.72) * uIntensity;
              // Soft falloff off-plane — keeps void dark
              glow *= smoothstep(0.92, 0.22, absLat);

              vec3 col = dustCol * glow;
              float a = clamp(glow * 0.78, 0.0, 0.62);
              if (a < 0.016) discard;

              gl_FragColor = vec4(col, a);
            }
          `}
        />
      </mesh>
    </group>
  );
}
