import * as THREE from "three";

/**
 * Shared texture cache — load once, reuse across mounts.
 * Lazy helpers only fetch when a visible body needs the map.
 */
const cache = new Map<string, THREE.Texture>();
const inflight = new Map<string, Promise<THREE.Texture>>();

const loader = new THREE.TextureLoader();

function configure(tex: THREE.Texture, srgb: boolean): THREE.Texture {
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

export function getCachedTexture(url: string): THREE.Texture | null {
  return cache.get(url) ?? null;
}

export function loadTextureCached(
  url: string,
  srgb = true
): Promise<THREE.Texture> {
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);

  const pending = inflight.get(url);
  if (pending) return pending;

  const p = new Promise<THREE.Texture>((resolve, reject) => {
    loader.load(
      url,
      (tex) => {
        configure(tex, srgb);
        cache.set(url, tex);
        inflight.delete(url);
        resolve(tex);
      },
      undefined,
      (err) => {
        inflight.delete(url);
        reject(err);
      }
    );
  });
  inflight.set(url, p);
  return p;
}

/** Eager preload list (call from idle / view transitions). Dedupes empties. */
export function preloadTextures(urls: string[], srgb = true): void {
  for (const u of urls) {
    if (!u) continue;
    void loadTextureCached(u, srgb).catch(() => {});
  }
}

/**
 * Core maps always needed on first paint (sun disc + sky).
 * Outer planets are deferred until System view / visible bodies warm-up.
 */
export function preloadBootTextures(): void {
  preloadTextures(
    [EXTRA_MAPS.sun, EXTRA_MAPS.milkyWayDisplay, EXTRA_MAPS.milkyWay],
    true
  );
}

/**
 * Warm Earth stack (story + Near-Earth). Specular/normal stay linear.
 */
export function preloadEarthTextures(): void {
  preloadTextures(
    [EARTH_MAPS.day, EARTH_MAPS.night, EARTH_MAPS.clouds, EXTRA_MAPS.moon],
    true
  );
  void loadTextureCached(EARTH_MAPS.specular, false).catch(() => {});
  void loadTextureCached(EARTH_MAPS.normal, false).catch(() => {});
}

/**
 * Full SSS pack — prefer idle / System-view warm-up over boot.
 * Kept for explicit “load everything” (e.g. after System tour starts).
 */
export function preloadAllPlanetTextures(): void {
  preloadBootTextures();
  preloadEarthTextures();
  preloadTextures(
    [
      ...Object.values(PLANET_ALBEDO),
      EXTRA_MAPS.venusAtmo,
      EXTRA_MAPS.saturnRing,
    ],
    true
  );
}

/** Schedule non-critical texture work when the browser is idle. */
export function preloadWhenIdle(urls: string[], srgb = true): void {
  const run = () => preloadTextures(urls, srgb);
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => run(), { timeout: 2500 });
  } else {
    setTimeout(run, 400);
  }
}

export const SSS = "/textures/sss";

export const PLANET_ALBEDO: Record<string, string> = {
  Mercury: `${SSS}/2k_mercury.jpg`,
  Venus: `${SSS}/2k_venus_surface.jpg`,
  Mars: `${SSS}/2k_mars.jpg`,
  Jupiter: `${SSS}/2k_jupiter.jpg`,
  Saturn: `${SSS}/2k_saturn.jpg`,
  Uranus: `${SSS}/2k_uranus.jpg`,
  Neptune: `${SSS}/2k_neptune.jpg`,
};

export const EARTH_MAPS = {
  day: `${SSS}/2k_earth_daymap.jpg`,
  night: `${SSS}/2k_earth_nightmap.jpg`,
  clouds: `${SSS}/2k_earth_clouds.jpg`,
  specular: `${SSS}/2k_earth_specular_map.jpg`,
  normal: `${SSS}/2k_earth_normal_map.jpg`,
};

export const EXTRA_MAPS = {
  venusAtmo: `${SSS}/2k_venus_atmosphere.jpg`,
  saturnRing: `${SSS}/2k_saturn_ring_alpha.png`,
  moon: `${SSS}/2k_moon.jpg`,
  sun: `${SSS}/2k_sun.jpg`,
  /** Raw SSS plate (near-black) — prefer milkyWayDisplay for sky */
  milkyWay: `${SSS}/2k_stars_milky_way.jpg`,
  /**
   * Offline-boosted plate for skydome (mean ~38/255, capped so voids stay dark).
   * Built from 2k_stars_milky_way.jpg — do not use raw plate with mild GPU gain.
   */
  milkyWayDisplay: `${SSS}/2k_stars_milky_way_display.jpg`,
};
