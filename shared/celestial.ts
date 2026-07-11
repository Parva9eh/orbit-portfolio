/** Shared celestial domain model (client + server). */

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type Asteroid = {
  kind: "asteroid";
  id: string;
  name: string;
  position: Vec3;
  size: number;
  isHazardous: boolean;
};

export type Planet = {
  kind: "planet";
  id: string;
  name: string;
  position: Vec3;
  size: number;
  period: number;
  color?: number;
};

export type CelestialItem = Asteroid | Planet;

export function isAsteroid(item: CelestialItem): item is Asteroid {
  return item.kind === "asteroid";
}

export function isPlanet(item: CelestialItem): item is Planet {
  return item.kind === "planet";
}

/** Normalize legacy mock rows that lack kind/id. */
export function asAsteroid(
  raw: Partial<Asteroid> & { name: string; position: Vec3; size: number }
): Asteroid {
  return {
    kind: "asteroid",
    id: raw.id ?? `asteroid:${raw.name}`,
    name: raw.name,
    position: raw.position,
    size: raw.size,
    isHazardous: Boolean(raw.isHazardous),
  };
}

export function asPlanet(
  raw: Partial<Planet> & {
    name: string;
    position: Vec3;
    size: number;
    period: number;
  }
): Planet {
  return {
    kind: "planet",
    id: raw.id ?? `planet:${raw.name}`,
    name: raw.name,
    position: raw.position,
    size: raw.size,
    period: raw.period,
    color: raw.color,
  };
}
