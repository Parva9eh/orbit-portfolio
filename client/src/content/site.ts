/**
 * Portfolio content for the Mission Control shell.
 * UI reads only from this module so copy stays out of the 3D layer.
 *
 * Contact: use the Comms form (Web3Forms) — do not put a personal email here.
 * Set VITE_WEB3FORMS_ACCESS_KEY in the client env (see client/.env.example).
 */

export type MissionStepId = "briefing" | "projects" | "live" | "comms";

export type MissionStep = {
  id: MissionStepId;
  label: string;
  section: string;
};

export type Project = {
  id: string;
  title: string;
  blurb: string;
  stack: string[];
  featured: boolean;
  live: boolean;
  href: string | null;
  repo: string | null;
};

export type SiteContent = {
  brand: string;
  name: string;
  role: string;
  tagline: string;
  summary: string;
  location: string;
  openToWork: boolean;
  /** Public resume link, or `#` to hide the Resume control */
  resumeUrl: string;
  social: {
    github: string;
    linkedin: string;
  };
  skills: string[];
  projects: Project[];
};

export const site: SiteContent = {
  brand: "ORBIT",
  name: "Parvaneh",
  role: "Frontend · Creative Tech",
  tagline:
    "Immersive web experiences — data-driven APIs, mission-control UI, and interactive 3D.",
  summary:
    "I design and ship portfolio-grade product UIs: TypeScript full-stack, real science APIs, and React Three Fiber scenes that stay readable under load. ORBIT is the live demo — NeoWs close approaches, SBDB orbits, ISS, and Sentry briefing in one Mission Control shell.",
  location: "Earth · remote-friendly",
  openToWork: true,
  resumeUrl: "#",
  social: {
    github: "https://github.com/Parva9eh",
    linkedin: "https://www.linkedin.com/in/",
  },
  skills: [
    "React",
    "TypeScript",
    "Three.js / R3F",
    "Node / Express",
    "Tailwind",
    "Vite",
    "API design",
  ],
  projects: [
    {
      id: "orbit",
      title: "ORBIT — NEO Mission Control",
      blurb:
        "Interactive 3D near-Earth object explorer: paginated NeoWs catalog, JPL SBDB orbits, compare A/B, schematic ISS LEO, educational Sentry briefing, distance ruler, and guided tours — Express proxy with cache + mock fallback.",
      stack: ["React", "TypeScript", "R3F", "Express", "NASA / CNEOS"],
      featured: true,
      live: true,
      href: null,
      repo: "https://github.com/Parva9eh/orbit-portfolio",
    },
  ],
};

export const MISSION_STEPS: MissionStep[] = [
  { id: "briefing", label: "01 Briefing", section: "Sec 01 · Briefing" },
  { id: "projects", label: "02 Projects", section: "Sec 02 · Projects" },
  { id: "live", label: "03 Live system", section: "Sec 03 · Live system" },
  { id: "comms", label: "04 Comms", section: "Sec 04 · Comms" },
];
