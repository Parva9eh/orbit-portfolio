/**
 * Portfolio content — fill personal placeholders (name, email, social).
 * UI reads only from this module so copy stays out of the 3D layer.
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
  email: string;
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
  name: "Your Name",
  role: "Frontend · Creative Tech",
  tagline:
    "Immersive web experiences — data-driven APIs, mission-control UI, and interactive 3D.",
  summary:
    "I design and ship portfolio-grade product UIs: TypeScript full-stack, real science APIs, and React Three Fiber scenes that stay readable under load. ORBIT is the live demo — NeoWs close approaches, SBDB orbits, ISS, and Sentry briefing in one Mission Control shell.",
  location: "City, Country",
  openToWork: true,
  email: "you@example.com",
  resumeUrl: "#",
  social: {
    github: "https://github.com/Parva9eh/orbit-portfolio",
    linkedin: "https://linkedin.com/in/",
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
    {
      id: "project-two",
      title: "Project Two",
      blurb: "Replace with another shipped project — one line on problem + outcome.",
      stack: ["Stack", "Tags"],
      featured: false,
      live: false,
      href: "#",
      repo: null,
    },
    {
      id: "project-three",
      title: "Project Three",
      blurb: "Replace with a third card when ready (or remove from the list).",
      stack: ["Stack", "Tags"],
      featured: false,
      live: false,
      href: "#",
      repo: null,
    },
  ],
};

export const MISSION_STEPS: MissionStep[] = [
  { id: "briefing", label: "01 Briefing", section: "Sec 01 · Briefing" },
  { id: "projects", label: "02 Projects", section: "Sec 02 · Projects" },
  { id: "live", label: "03 Live system", section: "Sec 03 · Live system" },
  { id: "comms", label: "04 Comms", section: "Sec 04 · Comms" },
];
