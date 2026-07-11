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

/*  MOCK_PLANETS – colour only (backend supplies size/period)     */
const MOCK_PLANETS = [
  { name: "Mercury", color: 0x8c7853 },
  { name: "Venus", color: 0xffc649 },
  { name: "Earth", color: 0x6b93d6 },
  { name: "Mars", color: 0xc1440e },
  { name: "Jupiter", color: 0xd8ca9d },
  { name: "Saturn", color: 0xfad5a5 },
  { name: "Uranus", color: 0x4fd0e3 },
  { name: "Neptune", color: 0x4b70dd },
];
/* --------------------------------------------------------------- */

function usePreloadGLTF(path) {
  useEffect(() => useGLTF.preload(path), [path]);
}

const cleanup = (gltf) => {
  if (gltf?.scene) {
    gltf.scene.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose?.();
    });
  }
};

function ParticleStars({ count = 500 }) {
  const ref = useRef();
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
    if (ref.current) u.uTime.value = clock.getElapsedTime();
  });
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={pos}
          itemSize={3}
          count={count}
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

/* --------------------------------------------------------------- */
const ThreeDScene = React.memo(function ThreeDScene({
  items = [],
  onItemClick,
  selectedItem,
  showPlanets,
  planetsData = [],
}) {
  const { camera, gl } = useThree();
  const asteroidGltf = useGLTF("/models/bennu.glb", true);
  const planetGltf = useGLTF("/models/planet.glb", true);
  usePreloadGLTF("/models/bennu.glb");
  usePreloadGLTF("/models/planet.glb");

  const sunTex = useMemo(
    () =>
      new THREE.TextureLoader().load("/textures/sun.jpg", (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
      }),
    []
  );

  // Individual planet textures
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

  const sunRef = useRef();
  const asteroidRef = useRef();
  const planetRefs = useRef([]); // one ref per planet
  const matrix = new THREE.Matrix4();
  let camLast = 0;
  const camInt = 250;
  let camTrans = false;

  // Orbital paths – match planet positions
  const orbits = useMemo(() => {
    return planetsData.map((p) => {
      const d = p.position.x; // already scaled
      const pts = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
      }
      return pts;
    });
  }, [planetsData]);

  useEffect(() => {
    return () => {
      cleanup(asteroidGltf);
      cleanup(planetGltf);
      gl.renderLists.dispose();
    };
  }, [asteroidGltf, planetGltf, gl]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Sun rotation
    if (sunRef.current) sunRef.current.rotation.y = t * 0.02;

    // Asteroids self-rotation
    if (asteroidRef.current) {
      const asteroids = items.filter((i) => i.isHazardous !== undefined);
      asteroids.forEach((a, i) => {
        matrix.makeRotationY(t * 0.4);
        const s = Math.min(a.size / 25, 0.5);
        matrix.scale(new THREE.Vector3(s, s, s));
        matrix.setPosition(a.position.x, a.position.y, a.position.z);
        asteroidRef.current.setMatrixAt(i, matrix);
        asteroidRef.current.setColorAt(
          i,
          new THREE.Color(a.isHazardous ? 0xff0000 : 0xa2798f)
        );
      });
      asteroidRef.current.instanceMatrix.needsUpdate = true;
      asteroidRef.current.instanceColor.needsUpdate = true;
    }

    // Planets: orbit + self-rotation + texture
    if (showPlanets && planetRefs.current.length === planetsData.length) {
      planetsData.forEach((p, i) => {
        const ref = planetRefs.current[i];
        if (!ref) return;

        const orbSpeed = 0.02 / p.period;
        const angle = t * orbSpeed;
        const x = Math.cos(angle) * p.position.x;
        const z = Math.sin(angle) * p.position.x;

        ref.rotation.y = t * 0.5; // self-rotation
        ref.scale.set(p.size * 2, p.size * 2, p.size * 2);
        ref.position.set(x, 0, z);

        // Apply texture
        const tex = planetTextures[p.name] || planetTextures.Earth;
        ref.material.map = tex;
        ref.material.needsUpdate = true;
      });
    }

    // Camera focus
    if (selectedItem && !camTrans) {
      const target = new THREE.Vector3(
        selectedItem.position.x,
        selectedItem.position.y + 10,
        selectedItem.position.z + 20
      );
      const dist = camera.position.distanceTo(target);
      if (performance.now() - camLast > camInt && dist > 0.1) {
        camTrans = true;
        camera.position.lerp(target, 0.03);
        camera.lookAt(
          selectedItem.position.x,
          selectedItem.position.y,
          selectedItem.position.z
        );
        if (dist < 0.1) camTrans = false;
        camLast = performance.now();
      }
    }
  });

  return (
    <group>
      <ambientLight intensity={1.0} />
      <pointLight position={[0, 0, 0]} intensity={2} color="yellow" />
      <directionalLight position={[10, 10, 10]} intensity={1.5} />
      <ParticleStars />

      {/* Sun – centered */}
      <mesh ref={sunRef} position={[0, 0, 0]}>
        <sphereGeometry args={[8, 64, 64]} />
        <meshStandardMaterial
          map={sunTex}
          emissive="orange"
          emissiveIntensity={1}
          roughness={0.3}
        />
      </mesh>

      {/* Asteroids */}
      {asteroidGltf.scene?.children?.[0] && (
        <Suspense fallback={null}>
          <Instances
            ref={asteroidRef}
            geometry={asteroidGltf.scene.children[0].geometry}
            material={new THREE.MeshStandardMaterial({ color: 0xfce5cd })}
            frustumCulled
          >
            {items
              .filter((i) => i.isHazardous !== undefined)
              .slice(0, 20)
              .map((a, i) => (
                <Instance key={i} onClick={() => onItemClick(a)}>
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

      {/* Planets + Orbits */}
      {showPlanets && planetGltf.scene?.children?.[0] && (
        <Suspense fallback={null}>
          <group>
            {planetsData.map((p, i) => {
              const tex = planetTextures[p.name] || planetTextures.Earth;
              return (
                <mesh
                  key={i}
                  ref={(el) => (planetRefs.current[i] = el)}
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

            {/* Orbital paths */}
            {orbits.map((pts, i) => (
              <Line
                key={i}
                points={pts}
                color={new THREE.Color(MOCK_PLANETS[i].color)}
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

      {/* Selected item HUD */}
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
            {selectedItem.isHazardous !== undefined && (
              <p>
                Hazardous: {selectedItem.isHazardous ? "Yes [Warning]" : "No"}
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
