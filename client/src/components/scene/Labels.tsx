import React, { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { CelestialItem, Planet } from "@shared";
import { isAsteroid, formatDiameterKm, formatMiss } from "@shared";
import { makeTextSpriteTexture } from "./textures/canvasSprites";
import { labelWorldHeight, isNearSunDisc } from "./math/sceneHelpers";

export function DistanceLabel({
  itemId,
  name,
  livePos,
  systemView = true,
  /** Softer cull for major bodies (planets); NEOs stay stricter */
  priority = "body",
}: {
  itemId: string;
  name: string;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  systemView?: boolean;
  priority?: "body" | "neo";
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const { camera } = useThree();
  // Outer planets stay labeled at free-cam distances; near-Earth is tighter
  const cullDist = systemView
    ? priority === "body"
      ? 220
      : 180
    : priority === "body"
      ? 64
      : 52;
  const minCamDist = priority === "body" ? 1.6 : 2.2;
  // Was 6.5 — blocked Mercury much of the time
  const minHelioR = priority === "body" ? 3.0 : 5.0;
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);

  const { map, aspect } = useMemo(
    () => makeTextSpriteTexture([name], { fontSize: 20 }),
    [name],
  );

  useEffect(
    () => () => {
      map.dispose();
    },
    [map],
  );

  useFrame(() => {
    const spr = spriteRef.current;
    const mat = matRef.current;
    const p = livePos.current.get(itemId);
    if (!spr || !mat || !p) return;

    const d = camera.position.distanceTo(p);
    const labelPos = new THREE.Vector3(
      p.x,
      p.y + 0.5 + Math.min(d * 0.006, 0.9),
      p.z,
    );
    spr.position.copy(labelPos);

    const h = labelWorldHeight(d, "name");
    const labelWidth = h * aspect;
    const labelRadius = Math.atan2(
      Math.sqrt((labelWidth * 0.5) ** 2 + (h * 0.5) ** 2),
      d,
    );
    // Gentler sun glare cull so labels don't blink off while orbiting past the limb
    const onSun = isNearSunDisc(
      labelPos,
      camera,
      tmpA,
      tmpB,
      labelRadius * (priority === "body" ? 0.75 : 1.0),
      priority === "body" ? 0.012 : 0.02,
    );
    const visible =
      d < cullDist && d > minCamDist && !onSun && p.length() > minHelioR;
    spr.visible = visible;
    if (!visible) return;

    // Always positive scale — negative Y would mirror text upside-down
    spr.scale.set(Math.abs(h * aspect), Math.abs(h), 1);
    spr.center.set(0.5, 0); // anchor bottom-center above the body
    mat.opacity = THREE.MathUtils.clamp(1.05 - d / cullDist, 0.55, 0.98);
  });

  return (
    <sprite ref={spriteRef} renderOrder={20} frustumCulled={false}>
      <spriteMaterial
        ref={matRef}
        map={map}
        transparent
        alphaTest={0.12}
        // Labels read above the scene; depthTest hid names behind rings/limbs
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        sizeAttenuation
      />
    </sprite>
  );
}



export function SelectionLabel({
  selectedItem,
  livePos,
}: {
  selectedItem: CelestialItem;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const { camera } = useThree();
  const tmpA = useMemo(() => new THREE.Vector3(), []);
  const tmpB = useMemo(() => new THREE.Vector3(), []);
  const offsetY = isAsteroid(selectedItem)
    ? 1.0
    : Math.max(1.0, (selectedItem as Planet).size * 0.5 + 0.75);

  const lines = useMemo(() => {
    if (isAsteroid(selectedItem)) {
      const tag = selectedItem.isHazardous ? "PHA" : "NEO";
      const diam = formatDiameterKm(
        selectedItem.diameterKmMin,
        selectedItem.diameterKmMax,
        selectedItem.size,
      );
      const miss = selectedItem.approach
        ? formatMiss(
            selectedItem.approach.missLd,
            selectedItem.approach.missKm,
            { compact: true },
          )
        : null;
      return [
        selectedItem.name,
        miss ? `${tag} · ${miss} · ${diam}` : `${tag} · ${diam}`,
      ];
    }
    return [
      selectedItem.name,
      `${(selectedItem as Planet).earthRadii.toFixed(2)} R⊕ · ${selectedItem.orbit.periodYears.toFixed(2)} yr`,
    ];
  }, [selectedItem]);

  const { map, aspect } = useMemo(
    () => makeTextSpriteTexture(lines, { fontSize: 20 }),
    [lines],
  );

  useEffect(
    () => () => {
      map.dispose();
    },
    [map],
  );

  useFrame(() => {
    const spr = spriteRef.current;
    const mat = matRef.current;
    if (!spr || !mat) return;
    const p = livePos.current.get(selectedItem.id);
    const labelPos = p
      ? new THREE.Vector3(p.x, p.y + offsetY, p.z)
      : new THREE.Vector3(
          selectedItem.position.x,
          selectedItem.position.y + offsetY,
          selectedItem.position.z,
        );
    spr.position.copy(labelPos);
    const d = camera.position.distanceTo(labelPos);
    const h = labelWorldHeight(d, "detail");
    const labelWidth = h * aspect;
    const labelRadius = Math.atan2(
      Math.sqrt((labelWidth * 0.5) ** 2 + (h * 0.5) ** 2),
      d,
    );
    const onSun = isNearSunDisc(
      labelPos,
      camera,
      tmpA,
      tmpB,
      labelRadius * 0.85,
      0.014,
    );
    spr.visible = !onSun;
    if (onSun) return;
    spr.scale.set(Math.abs(h * aspect), Math.abs(h), 1);
    spr.center.set(0.5, 0); // bottom-center so text sits above the body upright
  });

  return (
    <sprite ref={spriteRef} renderOrder={25} frustumCulled={false}>
      <spriteMaterial
        ref={matRef}
        map={map}
        transparent
        alphaTest={0.12}
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        sizeAttenuation
        opacity={0.95}
      />
    </sprite>
  );
}

/**
 * SSS ring strip is 2048×125 (radial features along width).
 * Three.js RingGeometry UVs are (angle, radius) — swap so width maps radially.
 */

