import React, { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Planet } from "@shared";
import { positionOnOrbit, spinAngle } from "@shared";
import { useSimSettings } from "../../sim/useSim";
import { scalePosition, scaleSize, qualitySettings } from "../../sim/simUtils";
import { useT } from "./useSimTime";
import { useLazyTexture } from "./useLazyTexture";
import { PLANET_ALBEDO, EXTRA_MAPS } from "./textureCache";
import { JUPITER_VERT, JUPITER_FRAG } from "./shaders/jupiter";

type RingKind = "saturn" | "jupiter" | "uranus" | "neptune";

function ringKindFor(name: string): RingKind | null {
  if (name === "Saturn") return "saturn";
  if (name === "Jupiter") return "jupiter";
  if (name === "Uranus") return "uranus";
  if (name === "Neptune") return "neptune";
  return null;
}

/**
 * Annulus in XY. Optional UV radial map for SSS Saturn strip.
 * Optional thetaStart/thetaLength for incomplete arcs (Neptune).
 */
function makeRingGeometry(
  inner: number,
  outer: number,
  opts: {
    theta?: number;
    radial?: number;
    thetaStart?: number;
    thetaLength?: number;
    /** Map U from inner→outer for textured Saturn strip */
    sssUvs?: boolean;
  } = {},
): THREE.RingGeometry {
  const {
    theta = 256,
    radial = 8,
    thetaStart = 0,
    thetaLength = Math.PI * 2,
    sssUvs = false,
  } = opts;
  const geo = new THREE.RingGeometry(
    inner,
    outer,
    theta,
    radial,
    thetaStart,
    thetaLength,
  );
  if (sssUvs) {
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    const span = Math.max(outer - inner, 1e-6);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const r = Math.hypot(x, y);
      const u = THREE.MathUtils.clamp((r - inner) / span, 0, 1);
      uv.setXY(i, u, 0.5);
    }
    uv.needsUpdate = true;
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  if (geo.boundingSphere) {
    geo.boundingSphere.center.set(0, 0, 0);
    geo.boundingSphere.radius = outer * 1.25;
  }
  geo.computeBoundingBox();
  if (geo.boundingBox) {
    const pad = outer * 0.2;
    geo.boundingBox.min.set(-outer - pad, -outer - pad, -pad);
    geo.boundingBox.max.set(outer + pad, outer + pad, pad);
  }
  return geo;
}

/** Textured Saturn rings (SSS alpha strip). */
function SaturnRings({
  displaySize,
  ringMap,
}: {
  displaySize: number;
  ringMap: THREE.Texture;
}) {
  const inner = displaySize * 1.18;
  const outer = displaySize * 2.55;
  const ringGeo = useMemo(
    () =>
      makeRingGeometry(inner, outer, {
        // 256×8 looks smooth at system scale; 384×16 was overkill
        theta: 256,
        radial: 8,
        sssUvs: true,
      }),
    [inner, outer],
  );

  useEffect(() => {
    ringMap.colorSpace = THREE.SRGBColorSpace;
    ringMap.anisotropy = 16;
    ringMap.wrapS = THREE.ClampToEdgeWrapping;
    ringMap.wrapT = THREE.ClampToEdgeWrapping;
    ringMap.minFilter = THREE.LinearMipmapLinearFilter;
    ringMap.magFilter = THREE.LinearFilter;
    ringMap.generateMipmaps = true;
    ringMap.needsUpdate = true;
  }, [ringMap]);

  useEffect(
    () => () => {
      ringGeo.dispose();
    },
    [ringGeo],
  );

  const z = displaySize * 0.004;
  const matProps = {
    map: ringMap,
    color: "#f2e8d4" as const,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
    alphaTest: 0.015,
    toneMapped: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  };

  return (
    <group rotation={[Math.PI / 2, 0, 0]} frustumCulled={false}>
      <mesh
        geometry={ringGeo}
        position={[0, 0, z]}
        renderOrder={4}
        frustumCulled={false}
      >
        <meshBasicMaterial {...matProps} />
      </mesh>
      <mesh
        geometry={ringGeo}
        position={[0, 0, -z]}
        renderOrder={4}
        frustumCulled={false}
      >
        <meshBasicMaterial {...matProps} />
      </mesh>
    </group>
  );
}

/**
 * One schematic band (radii in units of planet display radius R).
 * Scales from published ring systems (R_p ≈ planetary equatorial radius):
 * - Jupiter: main ~1.72–1.81 R_J, optical depth ~10⁻⁶ (dust) — barely visible
 * - Uranus: narrow dark rings ~1.6–2.0 R_U, albedo ~0.02, few–tens of km wide
 * - Neptune: Galle/Le Verrier faint full rings; Adams arcs ~2.5 R_N
 */
type RingBand = {
  innerMul: number;
  outerMul: number;
  color: string;
  opacity: number;
  /** Incomplete longitude spans (radians); omit for full circle */
  arcs?: { start: number; length: number }[];
};

/**
 * Keep these much fainter/thinner than Saturn’s textured disk.
 * Values are visualization-tuned from real R_p ratios, not literal km.
 */
const SCHEMATIC: Record<"jupiter" | "uranus" | "neptune", RingBand[]> = {
  jupiter: [
    // Main ring (thin dusty sheet)
    {
      innerMul: 1.72,
      outerMul: 1.81,
      color: "#a89880",
      opacity: 0.045,
    },
    // Inner halo — extremely soft dust
    {
      innerMul: 1.4,
      outerMul: 1.7,
      color: "#9a8c78",
      opacity: 0.022,
    },
    // Amalthea gossamer hint (broader, nearly invisible)
    {
      innerMul: 1.85,
      outerMul: 2.25,
      color: "#8a8070",
      opacity: 0.018,
    },
  ],
  uranus: [
    // Classic narrow dark ringlets (schematic: three hairlines, not a wide band)
    // Real widths are km-scale; we use ~0.03–0.05 R so they stay “thin lines”
    {
      innerMul: 1.64,
      outerMul: 1.67,
      color: "#0c1014",
      opacity: 0.14,
    },
    {
      innerMul: 1.76,
      outerMul: 1.8,
      color: "#10151a",
      opacity: 0.16,
    },
    // ε-like outermost main ring (slightly denser)
    {
      innerMul: 1.94,
      outerMul: 1.99,
      color: "#121820",
      opacity: 0.18,
    },
  ],
  neptune: [
    // Le Verrier — continuous, very faint
    {
      innerMul: 2.12,
      outerMul: 2.16,
      color: "#4a6080",
      opacity: 0.055,
    },
    // Adams — incomplete arcs only (not a full bright ring)
    {
      innerMul: 2.48,
      outerMul: 2.54,
      color: "#5a7098",
      opacity: 0.1,
      arcs: [
        { start: 0.2, length: 1.1 }, // ~63°
        { start: 2.0, length: 0.75 },
        { start: 3.9, length: 0.95 },
        { start: 5.3, length: 0.55 },
      ],
    },
  ],
};

function SchematicRings({
  kind,
  displaySize,
}: {
  kind: "jupiter" | "uranus" | "neptune";
  displaySize: number;
}) {
  const bands = SCHEMATIC[kind];

  const geos = useMemo(() => {
    const out: { geo: THREE.RingGeometry; opacity: number; color: string }[] =
      [];
    for (const band of bands) {
      const inner = displaySize * band.innerMul;
      const outer = displaySize * band.outerMul;
      const thin = outer - inner < displaySize * 0.08;
      if (band.arcs?.length) {
        for (const a of band.arcs) {
          out.push({
            geo: makeRingGeometry(inner, outer, {
              theta: 64,
              radial: thin ? 2 : 3,
              thetaStart: a.start,
              thetaLength: a.length,
            }),
            opacity: band.opacity,
            color: band.color,
          });
        }
      } else {
        out.push({
          geo: makeRingGeometry(inner, outer, {
            theta: kind === "jupiter" ? 96 : 128,
            radial: thin ? 1 : 2,
          }),
          opacity: band.opacity,
          color: band.color,
        });
      }
    }
    return out;
  }, [bands, displaySize, kind]);

  useEffect(
    () => () => {
      geos.forEach((g) => g.geo.dispose());
    },
    [geos],
  );

  // No dual-sheet stack (that doubled brightness). Single plane only.
  return (
    <group rotation={[Math.PI / 2, 0, 0]} frustumCulled={false}>
      {geos.map((item, i) => (
        <mesh
          key={i}
          geometry={item.geo}
          renderOrder={3}
          frustumCulled={false}
        >
          <meshBasicMaterial
            color={item.color}
            transparent
            opacity={item.opacity}
            side={THREE.DoubleSide}
            depthWrite={false}
            depthTest
            toneMapped={false}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-1}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function PlanetBody({
  planet,
  livePos,
  onClick,
  onHover,
  selected,
}: {
  planet: Planet;
  livePos: React.MutableRefObject<Map<string, THREE.Vector3>>;
  onClick: () => void;
  onHover?: (active: boolean) => void;
  selected: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const equatorRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const t = useT();
  const { trueScale, quality } = useSimSettings();
  const displaySize = scaleSize(planet.size, trueScale);
  const segs = qualitySettings(quality).planetSegments;
  const rings = ringKindFor(planet.name);
  const useEquator = rings != null;

  const albedoUrl = PLANET_ALBEDO[planet.name] ?? null;
  const colorMap = useLazyTexture(albedoUrl);
  const cloudMap = useLazyTexture(
    planet.name === "Venus" ? EXTRA_MAPS.venusAtmo : null,
  );
  const ringMap = useLazyTexture(
    rings === "saturn" ? EXTRA_MAPS.saturnRing : null,
  );

  useEffect(() => {
    if (matRef.current) {
      matRef.current.map = colorMap;
      matRef.current.needsUpdate = true;
    }
  }, [colorMap]);

  const atmo: Record<string, string> = {
    Venus: "#e8c878",
    Mars: "#c47850",
    Jupiter: "#d4c4a0",
    Saturn: "#e0d0b0",
    Uranus: "#7fd0e0",
    Neptune: "#4a7ad4",
  };

  const placeholder: Record<string, string> = {
    Mercury: "#9a9088",
    Venus: "#d4b878",
    Mars: "#c06040",
    Jupiter: "#c8b090",
    Saturn: "#e0d0a0",
    Uranus: "#80d0e0",
    Neptune: "#4a70c0",
  };

  const jupUniforms = useMemo(
    () => ({
      map: { value: colorMap as THREE.Texture | null },
      uTime: { value: 0 },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    jupUniforms.map.value = colorMap;
  }, [colorMap, jupUniforms]);

  const isJupiter = planet.name === "Jupiter";
  const isSaturn = planet.name === "Saturn";

  useFrame(() => {
    const time = t();
    jupUniforms.uTime.value = time;
    const raw = positionOnOrbit(planet.orbit, time);
    const p = scalePosition(raw, trueScale);
    if (groupRef.current) {
      groupRef.current.position.set(p.x, p.y, p.z);
      let stored = livePos.current.get(planet.id);
      if (!stored) {
        stored = new THREE.Vector3();
        livePos.current.set(planet.id, stored);
      }
      stored.set(p.x, p.y, p.z);
    }

    if (useEquator) {
      if (equatorRef.current) {
        equatorRef.current.rotation.set(0, 0, planet.axialTilt);
      }
      if (bodyRef.current) {
        bodyRef.current.rotation.order = "XYZ";
        bodyRef.current.rotation.x = 0;
        bodyRef.current.rotation.z = 0;
        bodyRef.current.rotation.y = spinAngle(planet.spinDays, time);
      }
    } else {
      if (bodyRef.current) {
        bodyRef.current.rotation.order = "ZXY";
        bodyRef.current.rotation.z = planet.axialTilt;
        bodyRef.current.rotation.y = spinAngle(planet.spinDays, time);
      }
      if (cloudRef.current) {
        cloudRef.current.rotation.order = "ZXY";
        cloudRef.current.rotation.z = planet.axialTilt;
        cloudRef.current.rotation.y = spinAngle(
          Math.abs(planet.spinDays) * 0.9,
          time,
        );
      }
    }
  });

  const bodyMesh = (
    <mesh ref={bodyRef} scale={displaySize}>
      <sphereGeometry
        args={[1, isSaturn ? segs + 16 : segs, isSaturn ? segs + 16 : segs]}
      />
      {isJupiter && colorMap ? (
        <shaderMaterial
          vertexShader={JUPITER_VERT}
          fragmentShader={JUPITER_FRAG}
          uniforms={jupUniforms}
        />
      ) : (
        <meshStandardMaterial
          ref={matRef}
          map={colorMap}
          roughness={
            planet.name === "Uranus" || planet.name === "Neptune" ? 0.45 : 0.78
          }
          metalness={
            planet.name === "Uranus" || planet.name === "Neptune"
              ? 0.12
              : isSaturn
                ? 0.04
                : 0.05
          }
          color={
            colorMap
              ? planet.name === "Uranus"
                ? "#c8f0f5"
                : planet.name === "Neptune"
                  ? "#a8c4ff"
                  : isSaturn
                    ? "#fff6e8"
                    : "#ffffff"
              : (placeholder[planet.name] ?? "#888888")
          }
        />
      )}
    </mesh>
  );

  const atmoMesh = atmo[planet.name] ? (
    <mesh scale={displaySize * (isSaturn ? 1.04 : 1.05)}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color={atmo[planet.name]}
        transparent
        opacity={
          selected
            ? 0.18
            : isSaturn
              ? 0.08
              : planet.name === "Jupiter"
                ? 0.09
                : 0.1
        }
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  ) : null;

  const ringNode =
    rings === "saturn" && ringMap ? (
      <SaturnRings displaySize={displaySize} ringMap={ringMap} />
    ) : rings === "jupiter" || rings === "uranus" || rings === "neptune" ? (
      <SchematicRings kind={rings} displaySize={displaySize} />
    ) : null;

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        onHover?.(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
        onHover?.(false);
      }}
    >
      {useEquator ? (
        <group ref={equatorRef} frustumCulled={false}>
          {bodyMesh}
          {isSaturn && (
            <mesh
              scale={[
                displaySize * 1.01,
                displaySize * 0.16,
                displaySize * 1.01,
              ]}
            >
              <sphereGeometry args={[1, 48, 16]} />
              <meshBasicMaterial
                color="#0a0806"
                transparent
                opacity={0.35}
                depthWrite={false}
              />
            </mesh>
          )}
          {atmoMesh}
          {ringNode}
        </group>
      ) : (
        <>
          {bodyMesh}
          {cloudMap && (
            <mesh ref={cloudRef} scale={displaySize * 1.02}>
              <sphereGeometry args={[1, 48, 48]} />
              <meshStandardMaterial
                map={cloudMap}
                transparent
                opacity={0.55}
                depthWrite={false}
                roughness={1}
              />
            </mesh>
          )}
          {atmoMesh}
        </>
      )}
    </group>
  );
}
