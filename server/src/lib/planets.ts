import {
  asPlanet,
  auToSceneRadius,
  earthRadiiToDisplaySize,
  positionOnOrbit,
  type OrbitElements,
  type Planet,
} from "../../../shared/index.ts";

const DEG = Math.PI / 180;

type PlanetSeed = {
  name: string;
  au: number;
  earthRadii: number;
  periodYears: number;
  spinDays: number;
  tiltDeg: number;
  color: number;
  eccentricity: number;
  inclinationDeg: number;
  phaseDeg: number;
  hasRings?: boolean;
};

export const PLANET_SEEDS: PlanetSeed[] = [
  {
    name: "Mercury",
    au: 0.387,
    earthRadii: 0.383,
    periodYears: 0.241,
    spinDays: 58.6,
    tiltDeg: 0.03,
    color: 0x8c7853,
    eccentricity: 0.206,
    inclinationDeg: 7.0,
    phaseDeg: 40,
  },
  {
    name: "Venus",
    au: 0.723,
    earthRadii: 0.949,
    periodYears: 0.615,
    spinDays: -243, // retrograde
    tiltDeg: 177.4,
    color: 0xffc649,
    eccentricity: 0.007,
    inclinationDeg: 3.4,
    phaseDeg: 120,
  },
  {
    name: "Earth",
    au: 1.0,
    earthRadii: 1.0,
    periodYears: 1.0,
    spinDays: 1,
    tiltDeg: 23.4,
    color: 0x6b93d6,
    eccentricity: 0.017,
    inclinationDeg: 0,
    phaseDeg: 200,
  },
  {
    name: "Mars",
    au: 1.524,
    earthRadii: 0.532,
    periodYears: 1.881,
    spinDays: 1.03,
    tiltDeg: 25.2,
    color: 0xc1440e,
    eccentricity: 0.093,
    inclinationDeg: 1.85,
    phaseDeg: 280,
  },
  {
    name: "Jupiter",
    au: 5.203,
    earthRadii: 11.21,
    periodYears: 11.86,
    spinDays: 0.41,
    tiltDeg: 3.1,
    color: 0xd8ca9d,
    eccentricity: 0.048,
    inclinationDeg: 1.3,
    phaseDeg: 15,
    /** Faint dust rings (schematic in client) */
    hasRings: true,
  },
  {
    name: "Saturn",
    au: 9.537,
    earthRadii: 9.45,
    periodYears: 29.46,
    spinDays: 0.45,
    tiltDeg: 26.7,
    color: 0xfad5a5,
    eccentricity: 0.054,
    inclinationDeg: 2.5,
    phaseDeg: 90,
    hasRings: true,
  },
  {
    name: "Uranus",
    au: 19.19,
    earthRadii: 4.01,
    periodYears: 84.01,
    spinDays: -0.72, // retrograde rotation sense
    tiltDeg: 97.8,
    color: 0x4fd0e3,
    eccentricity: 0.047,
    inclinationDeg: 0.77,
    phaseDeg: 160,
    /** Dark thin rings (schematic in client); extreme tilt from tiltDeg */
    hasRings: true,
  },
  {
    name: "Neptune",
    au: 30.07,
    earthRadii: 3.88,
    periodYears: 164.8,
    spinDays: 0.67,
    tiltDeg: 28.3,
    color: 0x4b70dd,
    eccentricity: 0.009,
    inclinationDeg: 1.77,
    phaseDeg: 220,
    /** Faint incomplete arcs (schematic in client) */
    hasRings: true,
  },
];

export function buildPlanet(seed: PlanetSeed): Planet {
  const semiMajorAxis = auToSceneRadius(seed.au);
  const orbit: OrbitElements = {
    semiMajorAxis,
    eccentricity: seed.eccentricity,
    inclination: seed.inclinationDeg * DEG,
    phase: seed.phaseDeg * DEG,
    periodYears: seed.periodYears,
  };
  const position = positionOnOrbit(orbit, 0);
  return asPlanet({
    name: seed.name,
    position,
    size: earthRadiiToDisplaySize(seed.earthRadii),
    earthRadii: seed.earthRadii,
    period: seed.periodYears,
    color: seed.color,
    orbit,
    spinDays: seed.spinDays,
    axialTilt: seed.tiltDeg * DEG,
    hasRings: seed.hasRings,
  });
}

export const ALL_PLANETS: Planet[] = PLANET_SEEDS.map(buildPlanet);

export const EPHEMERIS_META = {
  source: "mean-elements",
  frame: "ecliptic-of-date (approx J2000-style)",
  note: "Planet orbits use semi-major axis, eccentricity, inclination, and mean period. Positions are for visualization, not navigation-grade ephemerides.",
  references: [
    "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
    "https://ssd.jpl.nasa.gov/horizons/",
  ],
  bodies: PLANET_SEEDS.map((p) => ({
    name: p.name,
    au: p.au,
    periodYears: p.periodYears,
    eccentricity: p.eccentricity,
    inclinationDeg: p.inclinationDeg,
    spinDays: p.spinDays,
    tiltDeg: p.tiltDeg,
  })),
} as const;

