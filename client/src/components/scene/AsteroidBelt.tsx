import { useMemo } from "react";
import * as THREE from "three";
import { makeCircleSprite } from "./textures/canvasSprites";

export default function AsteroidBelt({
  trueScale,
  count = 900,
}: {
  trueScale: boolean;
  count?: number;
}) {
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < count; i++) {
      // Scenic radii: Mars ~17, Jupiter ~35
      let r = 20 + Math.random() * 14;
      if (trueScale) r *= 1.35;
      const a = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 1.2;
      positions[i * 3] = Math.cos(a) * r;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = Math.sin(a) * r;
      const s = 0.35 + Math.random() * 0.35;
      col.setRGB(0.55 * s, 0.48 * s, 0.4 * s);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    return { positions, colors };
  }, [trueScale, count]);

  const sprite = useMemo(() => makeCircleSprite(32, true), []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={sprite}
        size={0.14}
        vertexColors
        transparent
        opacity={0.4}
        depthWrite={false}
        sizeAttenuation
        alphaTest={0.35}
        toneMapped={false}
      />
    </points>
  );
}

/**
 * Outline-only text (no filled panel).
 * Dark rounded chips were the "flashing boxes" when they crossed the sun.
 *
 * Orientation: CanvasTexture for THREE.Sprite must use default flipY=true
 * so line 0 is at the top of the billboard (flipY=false made labels
 * upside-down / hard to read).
 */

