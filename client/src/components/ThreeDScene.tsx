import React, { useRef, useMemo, useEffect, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Html,
  useGLTF,
  Instances,
  Instance,
  Line,
} from "@react-three/drei";
import { Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";
import type { Asteroid, CelestialItem, Planet } from "@shared";
import { isAsteroid } from "@shared";

const MOCK_PLANET_COLORS = [
  { name: "Mercury", color: 0x8c7853 },
  { name: "Venus", color: 0xffc649 },
  { name: "Earth", color: 0x6b93d6 },
  { name: "Mars", color: 0xc1440e },
  { name: "Jupiter", color: 0xd8ca9d },
  { name: "Saturn", color: 0xfad5a5 },
  { name: "Uranus", color: 0x4fd0e3 },
  { name: "Neptune", color: 0x4b70dd },
] as const;

function usePreloadGLTF(path: string) {
  useEffect(() => {
    useGLTF.preload(path);
  }, [path]);
}

function cleanupGltf(gltf: GLTF | undefined) {
  if (!gltf?.scene) return;
  gltf.scene.traverse((o) => {
    const obj = o as THREE.Mesh;
    obj.geometry?.dispose();
    const mat = obj.material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose?.();
  });
}

function ParticleStars({ count = 500 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const pos = useMemo(() => {
    const a = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 200;
      a[i * 3 + 1] = (Math.random() - 0.5) * 200;
      a[i * 3 + 2] = (Math.random() - 0.5) * 200;
    }
    return a;
  }, [count]);
  const u = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame(({ clock }) => {
    u.uTime.value = clock.getElapsedTime();
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[pos, 3]}
        />
      </bufferGeometry>
      <shaderMaterial
        uniforms={u}
        vertexShader={`
          uniform float uTime;
          varying float vDistance;
          void main() {
            vDistance = length(position);
            vec3 pos = position + sin(uTime + position.x) * 0.01;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = 2.0 + 0.5 * sin(vDistance);
          }
        `}
        fragmentShader={`
          varying float vDistance;
          void main() {
            vec3 color = vec3(1.0);
            float strength = 0.9 - 0.4 * length(gl_PointCoord - 0.5);
            gl_FragColor = vec4(color * max(strength, 0.0), strength);
          }
        `}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

export type ThreeDSceneProps = {
  items?: CelestialItem[];
  onItemClick: (item: CelestialItem) => void;
  selectedItem: CelestialItem | null;
  showPlanets: boolean;
  planetsData?: Planet[];
};

const ThreeDScene = React.memo(function ThreeDScene({
  items = [],
  onItemClick,
  selectedItem,
  showPlanets,
  planetsData = [],
}: ThreeDSceneProps) {
  const { camera, gl } = useThree();
  const asteroidGltf = useGLTF("/models/bennu.glb", true) as GLTF;
  const planetGltf = useGLTF("/models/planet.glb", true) as GLTF;
  usePreloadGLTF("/models/bennu.glb");
  usePreloadGLTF("/models/planet.glb");

  const sunTex = useMemo(
    () =>
      new THREE.TextureLoader().load("/textures/sun.jpg", (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
      }),
    []
  );

  const planetTextures = useMemo(
    () => ({
      Mercury: new THREE.TextureLoader().load("/textures/planets/mercury.jpg"),
      Venus: new THREE.TextureLoader().load("/textures/planets/venus.jpg"),
      Earth: new THREE.TextureLoader().load("/textures/planets/earth.jpg"),
      Mars: new THREE.TextureLoader().load("/textures/planets/mars.jpg"),
      Jupiter: new THREE.TextureLoader().load("/textures/planets/jupiter.jpg"),
      Saturn: new THREE.TextureLoader().load("/textures/planets/saturn.jpg"),
      Uranus: new THREE.TextureLoader().load("/textures/planets/uranus.jpg"),
      Neptune: new THREE.TextureLoader().load("/textures/planets/neptune.jpg"),
    }),
    []
  );

  const sunRef = useRef<THREE.Mesh>(null);
  const asteroidRef = useRef<THREE.InstancedMesh>(null);
  const planetRefs = useRef<(THREE.Mesh | null)[]>([]);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const scaleVec = useMemo(() => new THREE.Vector3(), []);
  const colorScratch = useMemo(() => new THREE.Color(), []);
  const camLast = useRef(0);
  const camInt = 250;
  const camTrans = useRef(false);

  const asteroids = useMemo(
    () => items.filter(isAsteroid).slice(0, 20),
    [items]
  );

  const orbits = useMemo(() => {
    return planetsData.map((p) => {
      const d = p.position.x;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
      }
      return pts;
    });
  }, [planetsData]);

  useEffect(() => {
    return () => {
      cleanupGltf(asteroidGltf);
      cleanupGltf(planetGltf);
      gl.renderLists.dispose();
    };
  }, [asteroidGltf, planetGltf, gl]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (sunRef.current) sunRef.current.rotation.y = t * 0.02;

    if (asteroidRef.current) {
      asteroids.forEach((a: Asteroid, i) => {
        matrix.makeRotationY(t * 0.4);
        const s = Math.min(a.size / 25, 0.5);
        matrix.scale(scaleVec.set(s, s, s));
        matrix.setPosition(a.position.x, a.position.y, a.position.z);
        asteroidRef.current!.setMatrixAt(i, matrix);
        asteroidRef.current!.setColorAt(
          i,
          colorScratch.set(a.isHazardous ? 0xff0000 : 0xa2798f)
        );
      });
      asteroidRef.current.instanceMatrix.needsUpdate = true;
      if (asteroidRef.current.instanceColor) {
        asteroidRef.current.instanceColor.needsUpdate = true;
      }
    }

    if (showPlanets && planetRefs.current.length === planetsData.length) {
      planetsData.forEach((p, i) => {
        const ref = planetRefs.current[i];
        if (!ref) return;

        const orbSpeed = 0.02 / p.period;
        const angle = t * orbSpeed;
        const x = Math.cos(angle) * p.position.x;
        const z = Math.sin(angle) * p.position.x;

        ref.rotation.y = t * 0.5;
        ref.scale.set(p.size * 2, p.size * 2, p.size * 2);
        ref.position.set(x, 0, z);

        // Set map once when material is MeshStandardMaterial
        const mat = ref.material as THREE.MeshStandardMaterial;
        const tex =
          planetTextures[p.name as keyof typeof planetTextures] ??
          planetTextures.Earth;
        if (mat.map !== tex) {
          mat.map = tex;
          mat.needsUpdate = true;
        }
      });
    }

    if (selectedItem && !camTrans.current) {
      const target = new THREE.Vector3(
        selectedItem.position.x,
        selectedItem.position.y + 10,
        selectedItem.position.z + 20
      );
      const dist = camera.position.distanceTo(target);
      if (performance.now() - camLast.current > camInt && dist > 0.1) {
        camTrans.current = true;
        camera.position.lerp(target, 0.03);
        camera.lookAt(
          selectedItem.position.x,
          selectedItem.position.y,
          selectedItem.position.z
        );
        if (dist < 0.1) camTrans.current = false;
        camLast.current = performance.now();
      }
    }
  });

  const firstChild = asteroidGltf.scene?.children?.[0] as
    | THREE.Mesh
    | undefined;

  return (
    <group>
      <ambientLight intensity={1.0} />
      <pointLight position={[0, 0, 0]} intensity={2} color="yellow" />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />
      <ParticleStars />

      <mesh ref={sunRef} position={[0, 0, 0]}>
        <sphereGeometry args={[8, 64, 64]} />
        <meshStandardMaterial
          map={sunTex}
          emissive="orange"
          emissiveIntensity={1}
          roughness={0.3}
        />
      </mesh>

      {firstChild?.geometry && (
        <Suspense fallback={null}>
          <Instances
            ref={asteroidRef}
            geometry={firstChild.geometry}
            material={new THREE.MeshStandardMaterial({ color: 0xfce5cd })}
            frustumCulled
          >
            {asteroids.map((a) => (
              <Instance key={a.id} onClick={() => onItemClick(a)}>
                <Html
                  distanceFactor={10}
                  position={[0, 1.5, 0]}
                  transform
                  occlude
                >
                  <div className="bg-white/80 p-1 rounded text-black text-xs">
                    {a.name}
                  </div>
                </Html>
              </Instance>
            ))}
          </Instances>
        </Suspense>
      )}

      {showPlanets && (
        <Suspense fallback={null}>
          <group>
            {planetsData.map((p, i) => {
              const tex =
                planetTextures[p.name as keyof typeof planetTextures] ??
                planetTextures.Earth;
              return (
                <mesh
                  key={p.id}
                  ref={(el) => {
                    planetRefs.current[i] = el;
                  }}
                  onClick={() => onItemClick(p)}
                >
                  <sphereGeometry args={[1, 32, 32]} />
                  <meshStandardMaterial
                    map={tex}
                    roughness={0.8}
                    metalness={0.2}
                  />
                </mesh>
              );
            })}

            {orbits.map((pts, i) => (
              <Line
                key={planetsData[i]?.id ?? i}
                points={pts}
                color={
                  new THREE.Color(
                    MOCK_PLANET_COLORS[i % MOCK_PLANET_COLORS.length].color
                  )
                }
                lineWidth={1}
                opacity={0.5}
                transparent
              />
            ))}
          </group>
        </Suspense>
      )}

      <Bloom
        intensity={1.2}
        luminanceThreshold={0.1}
        luminanceSmoothing={0.9}
      />
      <OrbitControls enableZoom enablePan enableRotate />

      {selectedItem && (
        <Html
          position={[
            selectedItem.position.x,
            selectedItem.position.y + 5,
            selectedItem.position.z,
          ]}
        >
          <div className="bg-gray-900/90 p-4 rounded-lg shadow-lg text-white w-64 animate-fade-in">
            <h4 className="text-lg font-bold">{selectedItem.name}</h4>
            {isAsteroid(selectedItem) && (
              <p>
                Hazardous:{" "}
                {selectedItem.isHazardous ? "Yes [Warning]" : "No"}
              </p>
            )}
            <p>Size: {(selectedItem.size * 1000).toFixed(2)} m</p>
            <p>
              Pos X:{selectedItem.position.x.toFixed(2)} Y:
              {selectedItem.position.y.toFixed(2)} Z:
              {selectedItem.position.z.toFixed(2)}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
});

export default ThreeDScene;
