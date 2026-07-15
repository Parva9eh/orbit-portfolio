import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSimSettings } from "../../sim/useSim";
import {
  makeFlareTexture,
  makeRingTexture,
  makeStreakTexture,
} from "./textures/canvasSprites";
import { SUN_RADIUS } from "./shaders/sun";

export default function SolarFlare() {
  const group = useRef<THREE.Group>(null);
  const bloom = useRef<THREE.Sprite>(null);
  const halo = useRef<THREE.Sprite>(null);
  const core = useRef<THREE.Sprite>(null);
  const streakH = useRef<THREE.Sprite>(null);
  const streakV = useRef<THREE.Sprite>(null);
  const ghostA = useRef<THREE.Sprite>(null);
  const ghostB = useRef<THREE.Sprite>(null);
  const ghostC = useRef<THREE.Sprite>(null);
  const { camera } = useThree();
  const { quality, viewScale } = useSimSettings();
  const cinematic = quality === "cinematic";
  const nearEarth = viewScale === "nearEarth";

  const tex = useMemo(
    () => ({
      // Wide soft “bloom” disc — substitute for post-process Bloom
      bloom: makeFlareTexture(256, [
        { t: 0.0, a: 0.42 },
        { t: 0.12, a: 0.28 },
        { t: 0.32, a: 0.12 },
        { t: 0.58, a: 0.04 },
        { t: 0.82, a: 0.01 },
        { t: 1.0, a: 0.0 },
      ]),
      halo: makeFlareTexture(256, [
        { t: 0.0, a: 0.55 },
        { t: 0.16, a: 0.32 },
        { t: 0.38, a: 0.14 },
        { t: 0.68, a: 0.04 },
        { t: 1.0, a: 0.0 },
      ]),
      core: makeFlareTexture(128, [
        { t: 0.0, a: 0.9 },
        { t: 0.18, a: 0.45 },
        { t: 0.45, a: 0.12 },
        { t: 1.0, a: 0.0 },
      ]),
      ghost: makeFlareTexture(128, [
        { t: 0.0, a: 0.0 },
        { t: 0.28, a: 0.32 },
        { t: 0.52, a: 0.16 },
        { t: 0.78, a: 0.05 },
        { t: 1.0, a: 0.0 },
      ]),
      ring: makeRingTexture(128),
      streak: makeStreakTexture(512, 48),
    }),
    []
  );

  useEffect(
    () => () => {
      Object.values(tex).forEach((t) => t.dispose());
    },
    [tex]
  );

  const tmpNdc = useMemo(() => new THREE.Vector3(), []);
  const tmpCam = useMemo(() => new THREE.Vector3(), []);
  const tmpSide = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;

    // Cheap reject: sun behind camera → hide group and skip all scale/opacity work
    tmpNdc.set(0, 0, 0).project(camera);
    if (tmpNdc.z >= 1) {
      g.visible = false;
      return;
    }

    const onScreen =
      Math.abs(tmpNdc.x) < 1.55 && Math.abs(tmpNdc.y) < 1.55;

    // 1 at screen center → 0 near edges (wider falloff in NE so off-axis still glows)
    const center = Math.max(
      0,
      1 - Math.hypot(tmpNdc.x, tmpNdc.y) / (nearEarth ? 1.55 : 1.3)
    );

    const dist = Math.max(1, camera.position.length());
    // Angular size proxy — larger when camera is closer
    const sizeFactor = THREE.MathUtils.clamp(
      (nearEarth ? 38 : 56) / dist,
      0.45,
      nearEarth ? 1.65 : 2.35
    );
    // Pull flare down when the sun is huge (close NE shots) so it stays natural
    const closeness = THREE.MathUtils.smoothstep(
      nearEarth ? 10 : 18,
      nearEarth ? 42 : 75,
      dist
    );
    // Keep a little atmospheric bloom even when very close (halo only)
    const closeBloom = THREE.MathUtils.smoothstep(
      nearEarth ? 6 : 12,
      nearEarth ? 22 : 40,
      dist
    );
    const visibility = onScreen
      ? Math.pow(center, nearEarth ? 0.75 : 0.95) * (0.35 + 0.65 * closeness)
      : 0;
    const bloomVis = onScreen
      ? Math.pow(center, 0.6) * (0.45 + 0.55 * Math.max(closeness, closeBloom * 0.55))
      : 0;

    g.visible = bloomVis > 0.015 || visibility > 0.02;
    if (!g.visible) return;

    // Same effect family; cinematic richer, System a touch brighter, NE softer
    const boost = (cinematic ? 1.28 : 0.92) * (nearEarth ? 0.9 : 1.05);
    const bloomS = SUN_RADIUS * (nearEarth ? 5.2 : 6.4) * sizeFactor;
    const haloS = SUN_RADIUS * (nearEarth ? 3.0 : 3.7) * sizeFactor;
    const coreS = SUN_RADIUS * (nearEarth ? 1.3 : 1.55) * sizeFactor;
    const streakS = SUN_RADIUS * (nearEarth ? 5.2 : 8.4) * sizeFactor;

    if (bloom.current) {
      bloom.current.scale.setScalar(bloomS);
      (bloom.current.material as THREE.SpriteMaterial).opacity =
        0.34 * bloomVis * boost;
    }
    if (halo.current) {
      halo.current.scale.setScalar(haloS);
      (halo.current.material as THREE.SpriteMaterial).opacity =
        0.42 * visibility * boost;
    }
    if (core.current) {
      core.current.scale.setScalar(coreS);
      (core.current.material as THREE.SpriteMaterial).opacity =
        0.52 * visibility * boost;
    }

    // Anamorphic streaks — primary horizontal; cinematic adds a faint cross
    const streakOp = 0.18 * visibility * boost * center;
    if (streakH.current) {
      streakH.current.scale.set(streakS * 2.3, streakS * 0.09, 1);
      (streakH.current.material as THREE.SpriteMaterial).opacity = streakOp;
    }
    if (streakV.current) {
      const showCross = cinematic && !nearEarth;
      streakV.current.visible = showCross;
      if (showCross) {
        streakV.current.scale.set(streakS * 0.09, streakS * 1.55, 1);
        (streakV.current.material as THREE.SpriteMaterial).opacity =
          streakOp * 0.45;
      }
    }

    // Ghosts along camera axis (sun → viewer). Classic scatter: one past midpoint,
    // one closer to camera, one ring “reflection” slightly off-axis.
    tmpCam.copy(camera.position).normalize();
    // Tiny lateral offset from screen offset so ghosts track sun off-center
    tmpSide
      .set(tmpNdc.x, tmpNdc.y, 0)
      .normalize()
      .multiplyScalar(SUN_RADIUS * 0.15 * sizeFactor);

    if (ghostA.current) {
      ghostA.current.position
        .copy(tmpCam)
        .multiplyScalar(dist * 0.18)
        .add(tmpSide);
      ghostA.current.scale.setScalar(SUN_RADIUS * 0.9 * sizeFactor);
      (ghostA.current.material as THREE.SpriteMaterial).opacity =
        0.11 * visibility * boost * center;
    }
    if (ghostB.current) {
      ghostB.current.position
        .copy(tmpCam)
        .multiplyScalar(dist * 0.34)
        .sub(tmpSide);
      ghostB.current.scale.setScalar(SUN_RADIUS * 1.35 * sizeFactor);
      (ghostB.current.material as THREE.SpriteMaterial).opacity =
        0.08 * visibility * boost * center;
    }
    if (ghostC.current) {
      // Ring ghost further along the ray — cinematic only, System preferred
      const showRing = cinematic || !nearEarth;
      ghostC.current.visible = showRing && visibility > 0.08;
      if (ghostC.current.visible) {
        ghostC.current.position.copy(tmpCam).multiplyScalar(dist * 0.48);
        ghostC.current.scale.setScalar(SUN_RADIUS * 1.7 * sizeFactor);
        (ghostC.current.material as THREE.SpriteMaterial).opacity =
          0.06 * visibility * boost * center * (cinematic ? 1.2 : 0.85);
      }
    }
  });

  const mat = (
    map: THREE.Texture,
    color: string,
    depthTest: boolean
  ) => (
    <spriteMaterial
      map={map}
      color={color}
      transparent
      depthWrite={false}
      depthTest={depthTest}
      blending={THREE.AdditiveBlending}
      toneMapped={false}
      opacity={0}
    />
  );

  return (
    <group ref={group} position={[0, 0, 0]} name="SolarFlare">
      {/* Wide soft bloom — replaces full-screen Bloom post */}
      <sprite ref={bloom} renderOrder={-4}>
        {mat(tex.bloom, "#ffb060", false)}
      </sprite>
      <sprite ref={halo} renderOrder={-3}>
        {mat(tex.halo, "#ffc878", true)}
      </sprite>
      <sprite ref={core} renderOrder={-2}>
        {mat(tex.core, "#fff2c8", true)}
      </sprite>
      <sprite ref={streakH} renderOrder={-2}>
        {mat(tex.streak, "#ffe0a0", false)}
      </sprite>
      <sprite ref={streakV} renderOrder={-2} visible={false}>
        {mat(tex.streak, "#ffd090", false)}
      </sprite>
      <sprite ref={ghostA} renderOrder={-1}>
        {mat(tex.ghost, "#a8c8ff", false)}
      </sprite>
      <sprite ref={ghostB} renderOrder={-1}>
        {mat(tex.ghost, "#ffb070", false)}
      </sprite>
      <sprite ref={ghostC} renderOrder={-1} visible={false}>
        {mat(tex.ring, "#c8d8ff", false)}
      </sprite>
    </group>
  );
}


