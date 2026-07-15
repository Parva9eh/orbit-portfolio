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
}: {
  itemId: string;
  name: string;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  systemView?: boolean;
}) {
  const spriteRef = useRef<THREE.Sprite>(null);
  const matRef = useRef<THREE.SpriteMaterial>(null);
  const { camera } = useThree();
  const cullDist = systemView ? 150 : 48;
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
    const onSun = isNearSunDisc(
      labelPos,
      camera,
      tmpA,
      tmpB,
      labelRadius * 1.25,
    );
    const visible = d < cullDist && d > 3 && !onSun && p.length() > 6.5;
    spr.visible = visible;
    if (!visible) return;

    // Always positive scale — negative Y would mirror text upside-down
    spr.scale.set(Math.abs(h * aspect), Math.abs(h), 1);
    spr.center.set(0.5, 0); // anchor bottom-center above the body
    mat.opacity = THREE.MathUtils.clamp(1.0 - d / cullDist, 0.45, 0.95);
  });

  return (
    <sprite ref={spriteRef} renderOrder={20} frustumCulled={false}>
      <spriteMaterial
        ref={matRef}
        map={map}
        transparent
        alphaTest={0.12}
        depthTest
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
      labelRadius * 1.25,
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
        depthTest
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

