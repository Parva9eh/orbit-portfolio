import { useEffect, useState } from "react";
import type * as THREE from "three";
import { getCachedTexture, loadTextureCached } from "./textureCache";

/**
 * Load a texture only when `url` is set.
 * Keeps the last good texture while a new URL loads (avoids solid-sphere flash).
 */
export function useLazyTexture(
  url: string | null | undefined,
  srgb = true
): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(() =>
    url ? getCachedTexture(url) : null
  );

  useEffect(() => {
    if (!url) {
      setTex(null);
      return;
    }
    const cached = getCachedTexture(url);
    if (cached) {
      setTex(cached);
      return;
    }
    let alive = true;
    void loadTextureCached(url, srgb)
      .then((t) => {
        if (alive) setTex(t);
      })
      .catch(() => {
        // Keep previous tex if any; only clear when nothing was shown
        if (alive) {
          setTex((prev) => prev ?? null);
        }
      });
    return () => {
      alive = false;
    };
  }, [url, srgb]);

  return tex;
}

export function useLazyTextures(
  urls: (string | null | undefined)[],
  srgb = true
): (THREE.Texture | null)[] {
  // Fixed-length hooks: max 6 maps per body is enough for Earth
  const u0 = useLazyTexture(urls[0], srgb);
  const u1 = useLazyTexture(urls[1], srgb);
  const u2 = useLazyTexture(urls[2], srgb);
  const u3 = useLazyTexture(urls[3], srgb);
  const u4 = useLazyTexture(urls[4], srgb);
  const u5 = useLazyTexture(urls[5], srgb);
  return [u0, u1, u2, u3, u4, u5].slice(0, urls.length);
}
