import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type MilkyWaySkyProps = {
  nearEarth?: boolean;
};

/**
 * Subtle procedural dust ribbon + dark solid sky.
 * Kept thin and dim so it never becomes the muddy blue “clouds” from plate attempts.
 * Camera-locked for system + near-Earth.
 */
export default function MilkyWaySky({ nearEarth = false }: MilkyWaySkyProps) {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    const dark = new THREE.Color("#010308");
    gl.setClearColor(dark, 1);
    scene.background = dark;
  }, [gl, scene]);

  const uniforms = useMemo(
    () => ({ uIntensity: { value: nearEarth ? 0.45 : 0.55 } }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ camera }) => {
    groupRef.current?.position.copy(camera.position);
    if (matRef.current) {
      matRef.current.uniforms.uIntensity.value = nearEarth ? 0.45 : 0.55;
    }
  });

  return (
    <group ref={groupRef} renderOrder={-40}>
      <mesh frustumCulled={false} renderOrder={-40}>
        <sphereGeometry args={[250, 40, 28]} />
        <shaderMaterial
          ref={matRef}
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
          fog={false}
          transparent
          uniforms={uniforms}
          vertexShader={/* glsl */ `
            varying vec3 vDir;
            void main() {
              vDir = normalize(position);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              gl_Position = projectionMatrix * mv;
              gl_Position.z = gl_Position.w * 0.99995;
            }
          `}
          fragmentShader={/* glsl */ `
            varying vec3 vDir;
            uniform float uIntensity;
            void main() {
              vec3 d = normalize(vDir);

              // Mild tilt off ecliptic (Y-up) — thin ribbon, not a face-on disk
              float ct = 0.9397; // cos 20°
              float st = 0.3420;
              vec3 g = vec3(d.x, d.y * ct - d.z * st, d.y * st + d.z * ct);

              // Thin latitude band
              float lat = abs(g.y);
              float band = exp(-pow(lat / 0.032, 2.0));
              band += exp(-pow(lat / 0.08, 2.0)) * 0.18;

              // Slight longitudinal modulation
              float longi = atan(g.z, g.x);
              band *= 0.88 + 0.12 * sin(longi * 2.0 + 0.6);

              // Soft silver — low alpha so it never washes the scene
              vec3 col = vec3(0.4, 0.45, 0.62) * band * uIntensity;
              float alpha = clamp(band * uIntensity * 0.45, 0.0, 0.28);
              if (alpha < 0.03) discard;

              gl_FragColor = vec4(col, alpha);
            }
          `}
        />
      </mesh>
    </group>
  );
}
