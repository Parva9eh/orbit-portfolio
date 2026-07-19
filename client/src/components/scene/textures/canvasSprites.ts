import * as THREE from "three";

/** Soft disc texture so Points render as stars, not squares. */
export function makeCircleSprite(size = 64, soft = true): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  if (soft) {
    g.addColorStop(0.0, "rgba(255,255,255,1)");
    g.addColorStop(0.15, "rgba(255,255,255,0.95)");
    g.addColorStop(0.4, "rgba(255,255,255,0.35)");
    g.addColorStop(0.7, "rgba(255,255,255,0.08)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
  } else {
    g.addColorStop(0.0, "rgba(255,255,255,1)");
    g.addColorStop(0.5, "rgba(255,255,255,0.9)");
    g.addColorStop(0.85, "rgba(255,255,255,0.15)");
    g.addColorStop(1.0, "rgba(255,255,255,0)");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Airy-like star kernel: tiny bright core + soft diffraction halo.
 * Avoids the solid-disc look of a wide opaque circle sprite.
 */
export function makeStarSprite(size = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  const r = size / 2;
  // Wide faint halo
  const halo = ctx.createRadialGradient(r, r, 0, r, r, r);
  halo.addColorStop(0.0, "rgba(255,255,255,0.55)");
  halo.addColorStop(0.08, "rgba(255,255,255,0.22)");
  halo.addColorStop(0.22, "rgba(255,255,255,0.06)");
  halo.addColorStop(0.5, "rgba(255,255,255,0.015)");
  halo.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  // Pinprick core
  const core = ctx.createRadialGradient(r, r, 0, r, r, r * 0.12);
  core.addColorStop(0.0, "rgba(255,255,255,1)");
  core.addColorStop(0.35, "rgba(255,255,255,0.85)");
  core.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}


/**
 * Soft white→transparent radial glow for lens flare.
 * Must never contain opaque black (that reads as the flashing square).
 */
export function makeFlareTexture(
  size = 256,
  stops: Array<{ t: number; a: number }>
): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  // Clear to fully transparent (not black)
  ctx.clearRect(0, 0, size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  for (const s of stops) {
    g.addColorStop(s.t, `rgba(255,255,255,${s.a})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}


/** Soft annular ring for photographic lens ghosts (no opaque fill). */
export function makeRingTexture(size = 128): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, r * 0.28, r, r, r * 0.92);
  g.addColorStop(0.0, "rgba(255,255,255,0)");
  g.addColorStop(0.35, "rgba(255,255,255,0.08)");
  g.addColorStop(0.55, "rgba(255,255,255,0.42)");
  g.addColorStop(0.72, "rgba(255,255,255,0.18)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}


export function makeStreakTexture(w = 512, h = 64): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, h / 2, w, h / 2);
  g.addColorStop(0.0, "rgba(255,255,255,0)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(0.5, "rgba(255,255,255,0.7)");
  g.addColorStop(0.65, "rgba(255,255,255,0.35)");
  g.addColorStop(1.0, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  // Vertical soft falloff
  for (let y = 0; y < h; y++) {
    const v = 1 - Math.abs(y / h - 0.5) * 2;
    const a = Math.pow(Math.max(0, v), 2.2);
    ctx.globalAlpha = a;
    ctx.fillRect(0, y, w, 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.flipY = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}


/**
 * Dark rounded chips were the "flashing boxes" when they crossed the sun.
 *
 * Orientation: CanvasTexture for THREE.Sprite must use default flipY=true
 * so line 0 is at the top of the billboard (flipY=false made labels
 * upside-down / hard to read).
 */
export function makeTextSpriteTexture(
  lines: string[],
  opts?: { fontSize?: number },
): { map: THREE.CanvasTexture; aspect: number } {
  const fontSize = opts?.fontSize ?? 22;
  const padX = 10;
  const padY = 8;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fonts = lines.map((_, i) =>
    i === 0
      ? `700 ${fontSize}px ui-sans-serif, system-ui, sans-serif`
      : `600 ${Math.round(fontSize * 0.78)}px ui-sans-serif, system-ui, sans-serif`,
  );
  let maxW = 0;
  lines.forEach((line, i) => {
    ctx.font = fonts[i];
    maxW = Math.max(maxW, ctx.measureText(line).width);
  });
  const lineH = fontSize * 1.25;
  const w = Math.ceil(maxW + padX * 2 + 8);
  const h = Math.ceil(lines.length * lineH + padY * 2 + 4);
  // Power-of-two friendly size helps filtering; not required but sharper
  canvas.width = Math.max(16, w);
  canvas.height = Math.max(16, h);
  // Re-apply fonts after resize (canvas clear resets state)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  // Soft dark halo for readability without a hard rectangle
  lines.forEach((line, i) => {
    const y = padY + lineH * (i + 0.5);
    ctx.font = fonts[i];
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.lineWidth = 5;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.strokeText(line, canvas.width / 2, y);
    ctx.fillStyle =
      i === 0 ? "rgba(245, 250, 255, 0.98)" : "rgba(200, 218, 232, 0.92)";
    ctx.fillText(line, canvas.width / 2, y);
  });
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  // Premultiply off + flipY true = upright, readable sprites in r152+
  map.premultiplyAlpha = false;
  map.flipY = true;
  map.generateMipmaps = false;
  map.minFilter = THREE.LinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.needsUpdate = true;
  return { map, aspect: canvas.width / Math.max(canvas.height, 1) };
}

