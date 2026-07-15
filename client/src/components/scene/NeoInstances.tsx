import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { GLTF } from "three-stdlib";
import type { Asteroid } from "@shared";
import {
  asteroidTumble,
  hashString,
  positionOnOrbit,
} from "@shared";
import { useSimSettings } from "../../sim/useSim";
import { scalePosition, qualitySettings } from "../../sim/simUtils";
import { asteroidDisplayScale } from "./math/sceneHelpers";
import { useT } from "./useSimTime";
import type { CompareOrbitSpec } from "./types";

type NeoInstancesProps = {
  asteroids: Asteroid[];
  selectedId: string | null;
  compareOrbits: CompareOrbitSpec[];
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  onItemClick: (item: Asteroid) => void;
  /** Hide NEO field during ISS focus */
  hidden?: boolean;
};

/**
 * Unit-normalized Bennu GLB instanced for the current NEO page.
 * Matrices are written in useFrame; mesh stays hidden until ready (avoids sun-stack).
 */
export default function NeoInstances({
  asteroids,
  selectedId,
  compareOrbits,
  livePos,
  onItemClick,
  hidden = false,
}: NeoInstancesProps) {
  const asteroidGltf = useGLTF("/models/bennu.glb", true) as GLTF;
  const { trueScale, quality, viewScale } = useSimSettings();
  const t = useT();
  const q = qualitySettings(quality);
  const nearEarth = viewScale === "nearEarth";
  const colorsDirty = useRef(true);
  const neoMatricesReady = useRef(false);
  const asteroidRef = useRef<THREE.InstancedMesh>(null);
  const matrix = useMemo(() => new THREE.Matrix4(), []);
  const quat = useMemo(() => new THREE.Quaternion(), []);
  const euler = useMemo(() => new THREE.Euler(), []);
  const scaleVec = useMemo(() => new THREE.Vector3(), []);
  const posVec = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    useGLTF.preload("/models/bennu.glb");
  }, []);

  const list = useMemo(
    () => asteroids.slice(0, q.maxNeos),
    [asteroids, q.maxNeos]
  );

  const asteroidStatic = useMemo(
    () =>
      list.map((a) => {
        const seed = hashString(a.id);
        const scaleMul = nearEarth ? 2.8 : trueScale ? 1.0 : 1.65;
        const s = Math.max(
          asteroidDisplayScale(a.size) * scaleMul,
          nearEarth ? 0.42 : 0.28
        );
        const color = a.isHazardous
          ? new THREE.Color("#e89878")
          : new THREE.Color().setRGB(
              0.55 + (seed % 40) / 120,
              0.5 + (seed % 35) / 130,
              0.45 + (seed % 30) / 140
            );
        const selectedColor = color
          .clone()
          .lerp(new THREE.Color("#ffe8c8"), 0.35);
        return { seed, scale: s, color, selectedColor, spinRate: a.spinRate };
      }),
    [list, nearEarth, trueScale]
  );

  useEffect(() => {
    colorsDirty.current = true;
  }, [list, nearEarth, trueScale, selectedId]);

  const { bennuGeometry, bennuMap } = useMemo(() => {
    const found: { geo: THREE.BufferGeometry; map: THREE.Texture | null } = {
      geo: null as unknown as THREE.BufferGeometry,
      map: null,
    };
    let hasMesh = false;
    asteroidGltf.scene?.traverse((obj) => {
      if (hasMesh) return;
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        hasMesh = true;
        found.geo = mesh.geometry;
        const mat = mesh.material as
          | THREE.MeshStandardMaterial
          | THREE.MeshStandardMaterial[];
        const m = Array.isArray(mat) ? mat[0] : mat;
        found.map = m?.map ?? null;
      }
    });
    if (!hasMesh) {
      return {
        bennuGeometry: null as THREE.BufferGeometry | null,
        bennuMap: null as THREE.Texture | null,
      };
    }

    const geo = found.geo.clone();
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    geo.translate(-center.x, -center.y, -center.z);
    geo.scale(1 / maxDim, 1 / maxDim, 1 / maxDim);
    geo.computeBoundingSphere();
    geo.computeVertexNormals();
    const map = found.map;
    if (map) {
      map.colorSpace = THREE.SRGBColorSpace;
      map.anisotropy = 4;
    }
    return { bennuGeometry: geo, bennuMap: map };
  }, [asteroidGltf]);

  const asteroidMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xe8d8c0,
      map: bennuMap ?? null,
      roughness: 0.82,
      metalness: 0.04,
      flatShading: false,
      emissive: 0x3a3228,
      emissiveIntensity: 0.35,
    });
    mat.vertexColors = false;
    return mat;
  }, [bennuMap]);

  const fallbackGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 1), []);
  const neoGeometry = bennuGeometry ?? fallbackGeo;

  useEffect(() => {
    const mesh = asteroidRef.current;
    if (!mesh || list.length === 0) return;
    if (!mesh.instanceColor) {
      const colors = new Float32Array(Math.max(list.length, 32) * 3);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    }
    colorsDirty.current = true;
  }, [list.length, neoGeometry]);

  useEffect(() => {
    neoMatricesReady.current = false;
    if (asteroidRef.current) asteroidRef.current.visible = false;
  }, [list, neoGeometry, nearEarth, trueScale]);

  useFrame(() => {
    if (hidden) return;
    const time = t();
    if (!asteroidRef.current || list.length === 0) return;

    const mesh = asteroidRef.current;
    mesh.count = list.length;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const st = asteroidStatic[i];
      const raw = positionOnOrbit(a.orbit, time);
      const p = scalePosition(raw, trueScale);
      posVec.set(p.x, p.y, p.z);
      let stored = livePos.current.get(a.id);
      if (!stored) {
        stored = new THREE.Vector3();
        livePos.current.set(a.id, stored);
      }
      stored.copy(posVec);

      const tumble = asteroidTumble(st.spinRate, time, st.seed);
      euler.set(tumble.x, tumble.y, tumble.z);
      quat.setFromEuler(euler);
      scaleVec.set(st.scale, st.scale, st.scale);
      matrix.compose(posVec, quat, scaleVec);
      mesh.setMatrixAt(i, matrix);

      let col = st.color;
      const cmp = compareOrbits.find((c) => c.id === a.id);
      if (cmp) {
        col = st.color.clone().lerp(new THREE.Color(cmp.color), 0.55);
      } else if (selectedId === a.id) {
        col = st.selectedColor;
      }
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    colorsDirty.current = false;
    if (!neoMatricesReady.current) {
      neoMatricesReady.current = true;
      mesh.visible = true;
    }
  });

  if (list.length === 0 || hidden) return null;

  return (
    <instancedMesh
      ref={asteroidRef}
      args={[neoGeometry, asteroidMaterial, Math.max(list.length, 1)]}
      frustumCulled={false}
      castShadow={false}
      receiveShadow={false}
      visible={false}
      onClick={(e) => {
        e.stopPropagation();
        const id = e.instanceId;
        if (id == null || id < 0 || id >= list.length) return;
        onItemClick(list[id]);
      }}
    />
  );
}
