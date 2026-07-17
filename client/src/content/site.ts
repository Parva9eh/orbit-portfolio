/**
 * Portfolio content for the Mission Control shell.
 * UI reads only from this module (plus projects.ts for the catalog).
 *
 * Contact: use the Comms form (Web3Forms) — do not put a personal email here.
 * Set VITE_WEB3FORMS_ACCESS_KEY in the client env (see client/.env.example).
 */

import { getProjects, type Project } from "./projects";

export type { Project } from "./projects";
export { statusLabel, getProjects, getFeaturedProjects } from "./projects";
export type { ProjectStatus } from "./projects";

export type MissionStepId = "briefing" | "projects" | "live" | "comms";

export type MissionStep = {
  id: MissionStepId;
  label: string;
  section: string;
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
    /** Public portfolio domain */
    portfolio: string;
  };
  skills: string[];
  /** Sorted portfolio catalog from projects.ts */
  projects: Project[];
};

export const site: SiteContent = {
  brand: "ORBIT",
  name: "Parvaneh",
  role: "Full-Stack Software Developer · Creative Tech",
  tagline:
    "End-to-end web products — React/Next UIs, Node & Python APIs, real data, and interactive 3D.",
  summary:
    "I build full-stack applications from polished client interfaces to production APIs and data pipelines: TypeScript/React and Next.js on the front, Express/Node and FastAPI on the back, plus cloud services (Firebase, Supabase, Azure AI, Stripe). Work spans accessibility (TexDio OCR/TTS), e-commerce, clinical marketing sites, sports analytics, and ORBIT — this live NEO Mission Control demo with science APIs and React Three Fiber. I use modern AI pair-programming tools (including xAI Grok Build) for speed while owning architecture, review, and shipping. Comfortable owning features across the stack, not only the pixels.",
  location: "Vancouver, BC · remote-friendly",
  openToWork: true,
  resumeUrl: "/resume.pdf",
  social: {
    github: "https://github.com/Parva9eh",
    portfolio: "https://parva9eh.com",
  },
  skills: [
    "React",
    "TypeScript",
    "JavaScript",
    "Next.js",
    "Node / Express",
    "Python / FastAPI",
    "Three.js / R3F",
    "PostgreSQL / Supabase",
    "Firebase",
    "Tailwind",
    "AI-assisted dev (Grok Build, Copilot)",
  ],
  projects: getProjects(),
};

export const MISSION_STEPS: MissionStep[] = [
  { id: "briefing", label: "01 Briefing", section: "Sec 01 · Briefing" },
  { id: "projects", label: "02 Projects", section: "Sec 02 · Projects" },
  { id: "live", label: "03 Live system", section: "Sec 03 · Live system" },
  { id: "comms", label: "04 Comms", section: "Sec 04 · Comms" },
];
