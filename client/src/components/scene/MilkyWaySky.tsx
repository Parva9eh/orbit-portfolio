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
        {/* 64×48 is enough once noise is seamless; denser = more frag overdraw cost */}
        <sphereGeometry args={[300, 64, 48]} />
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

            // --- Seamless 3D value noise (no longitude wrap seam) ---
            float hash3(vec3 p) {
              p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
              p *= 17.0;
              return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
            }

            float noise3(vec3 p) {
              vec3 i = floor(p);
              vec3 f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              return mix(
                mix(
                  mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
                  mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x),
                  f.y
                ),
                mix(
                  mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                  mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x),
                  f.y
                ),
                f.z
              );
            }

            float fbm3(vec3 p) {
              // 4 octaves: enough cloudy structure without 5× full-screen cost
              float v = 0.0;
              float a = 0.5;
              for (int i = 0; i < 4; i++) {
                v += a * noise3(p);
                p = p * 2.05 + vec3(1.7, 3.1, 2.3);
                a *= 0.5;
              }
              return v;
            }

            /**
             * Map view dir → galactic coords so the bright band crosses
             * the default system camera as a centered diagonal.
             * Euler: yaw → tilt → roll.
             */
            vec3 toGalactic(vec3 d) {
              float cy = 0.9511;
              float sy = 0.3090;
              vec3 a = vec3(d.x * cy + d.z * sy, d.y, -d.x * sy + d.z * cy);

              float ct = 0.6694;
              float st = 0.7431;
              vec3 b = vec3(a.x, a.y * ct - a.z * st, a.y * st + a.z * ct);

              float cr = 0.8829;
              float sr = -0.4695;
              return vec3(b.x * cr - b.y * sr, b.x * sr + b.y * cr, b.z);
            }

            void main() {
              vec3 d = normalize(vDir);
              vec3 g = toGalactic(d);
              float lat = g.y;
              float absLat = abs(lat);

              // Dust clouds: sample on the sphere (continuous everywhere)
              float n1 = fbm3(g * 3.4 + vec3(1.4, 0.2, -0.7));
              float n2 = fbm3(g * 7.8 + vec3(-0.9, 1.1, 0.4));
              float n3 = fbm3(g * 15.0 + n1);
              float clouds = n1 * 0.55 + n2 * 0.3 + n3 * 0.15;

              // Wide band
              float ridge = exp(-pow(absLat / 0.07, 2.0));
              float mid   = exp(-pow(absLat / 0.175, 2.0)) * 0.7;
              float halo  = exp(-pow(absLat / 0.4, 2.0)) * 0.26;
              float band  = (ridge + mid + halo) * (0.48 + 0.72 * clouds);

              float lane = exp(-pow(absLat / 0.028, 2.0)) * (0.45 + 0.4 * n2);
              band = max(band - lane * 0.28, 0.0);

              // Bulge / far arm via direction dots (no atan branch cut)
              // Fixed axes in galactic frame (unit-ish directions in XZ)
              vec3 bulgeAxis = normalize(vec3(0.94, 0.0, 0.34));
              vec3 farAxis   = normalize(vec3(-0.72, 0.0, 0.69));
              float alongBulge = max(dot(normalize(vec3(g.x, 0.0, g.z)), bulgeAxis), 0.0);
              float alongFar   = max(dot(normalize(vec3(g.x, 0.0, g.z)), farAxis), 0.0);

              float bulge = pow(alongBulge, 3.2) * exp(-pow(absLat / 0.16, 2.0));
              bulge *= 0.55 + 0.45 * clouds;

              float farArm = pow(alongFar, 2.4) * mid * 0.4;

              // Integer harmonics of azimuth are continuous on the circle
              // (sin(k*atan) for integer k = Im((x+iz)^k) / r^k)
              float r2 = max(g.x * g.x + g.z * g.z, 1e-6);
              float c2 = (g.x * g.x - g.z * g.z) / r2; // cos(2*lon)
              float s2 = (2.0 * g.x * g.z) / r2;       // sin(2*lon)
              float structure = 0.86 + 0.10 * s2 + 0.04 * c2 * clouds;
              band = band * structure + farArm;

              vec3 deepBlue = vec3(0.16, 0.26, 0.58);
              vec3 silver   = vec3(0.52, 0.6, 0.9);
              vec3 amber    = vec3(0.95, 0.6, 0.32);
              vec3 gold     = vec3(1.0, 0.76, 0.45);
              vec3 laneCol  = vec3(0.07, 0.06, 0.1);

              float warmMix = clamp(bulge * 1.05 + clouds * 0.08, 0.0, 0.72);
              vec3 dustCol = mix(deepBlue, silver, clamp(band * 0.85, 0.0, 1.0));
              dustCol = mix(dustCol, mix(amber, gold, clouds), warmMix);
              dustCol = mix(dustCol, laneCol, lane * 0.28);

              float glow = (band * 0.7 + bulge * 0.72) * uIntensity;
              glow *= smoothstep(0.92, 0.22, absLat);

              vec3 col = dustCol * glow;
              float a = clamp(glow * 0.78, 0.0, 0.62);
              // Soft fade instead of hard discard (avoids speckled edges while orbiting)
              if (a < 0.008) discard;

              gl_FragColor = vec4(col, a);
            }
          `}
        />
      </mesh>
    </group>
  );
}
