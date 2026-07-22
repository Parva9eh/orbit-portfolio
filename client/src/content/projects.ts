/**
 * Portfolio project catalog for the Mission Control Projects dock.
 * Update status, links, and highlights here — site.ts imports getProjects().
 */

export type ProjectStatus = "live" | "in-progress" | "launching-soon";

export type Project = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  /** Folder name under FullStackDeveloper/ (docs only; not used at runtime) */
  localPath?: string;
  status: ProjectStatus;
  featured: boolean;
  order: number;
  liveUrl?: string | null;
  githubUrl?: string | null;
  /** Optional local screenshot under /public/images/projects/ */
  image?: string;
  /** Tailwind gradient classes for card accent when no image */
  accent?: string;
  stack: string[];
  highlights?: string[];
  /**
   * When true, show “Enter live system →” (this Mission Control Live NEO mode).
   * Only ORBIT should set this.
   */
  enterMissionLive?: boolean;
};

export const projects: Project[] = [
  {
    id: "orbit",
    name: "ORBIT — NEO Mission Control",
    tagline: "This app — live NEO explorer in a mission-control shell",
    description:
      "Interactive 3D near-Earth object explorer: paginated NeoWs catalog, JPL SBDB orbits, compare A/B, schematic ISS LEO, educational Sentry briefing, distance ruler, and guided tours — Express proxy with cache + mock fallback.",
    localPath: "orbit-portfolio",
    status: "live",
    featured: true,
    order: 0,
    liveUrl: "https://parva9eh.com",
    githubUrl: "https://github.com/Parva9eh/orbit-portfolio",
    image: "/images/projects/orbit.png",
    accent: "from-sky-700 via-cyan-700 to-indigo-900",
    stack: ["React", "TypeScript", "R3F", "Express", "NASA / CNEOS"],
    highlights: [
      "Mission Control shell: story steps + Live NEO tools + viz rail",
      "NeoWs / SBDB / ISS / Sentry / DONKI via cached Express API",
      "Compare orbits, distance ruler, guided tours, deep-link share",
      "AI-assisted implementation (xAI Grok Build); architecture, review, and shipping owned by me",
    ],
    enterMissionLive: true,
  },
  {
    id: "texdio",
    name: "TexDio",
    tagline: "Image → text → speech for accessibility",
    description:
      "Full-stack accessibility app that extracts text from photos (OCR), lets you edit and translate it, then generates natural speech and downloadable exports (audio, SRT, EPUB, ZIP).",
    localPath: "texdio",
    status: "live",
    featured: false,
    order: 1,
    liveUrl: "https://texdio.vercel.app",
    githubUrl: "https://github.com/Parva9eh/TexDio",
    image: "/images/projects/texdio.png",
    accent: "from-indigo-600 via-blue-600 to-violet-700",
    stack: ["React", "Vite", "Node.js", "Express", "Azure AI", "OCR", "TTS"],
    highlights: [
      "Azure Image Analysis OCR + text-to-speech pipeline",
      "Job-based sessions with owner tokens and short-lived storage",
      "Exports: WAV/MP3, plain text, SRT captions, EPUB, ZIP bundle",
      "Public demo mode with rate limits for free-tier safety",
    ],
  },
  {
    id: "crwn-clothing",
    name: "Crwn Clothing",
    tagline: "Modern full-stack e-commerce demo",
    description:
      "Shop collections, cart, Firebase auth, and Stripe test-mode checkout. Modernized from a React course capstone to Next.js 15 + TypeScript + Vercel.",
    localPath: "e-commerce-app",
    status: "live",
    featured: false,
    order: 2,
    liveUrl: "https://e-commerce-crwn-clothing.vercel.app",
    githubUrl: "https://github.com/Parva9eh/e-commerce-app",
    image: "/images/projects/crwn-clothing.png",
    accent: "from-zinc-800 via-neutral-700 to-stone-600",
    stack: [
      "Next.js",
      "TypeScript",
      "Redux",
      "Firebase",
      "Stripe",
      "Vitest",
      "Playwright",
    ],
    highlights: [
      "Category shop, cart persistence, and responsive UI",
      "Email/password + Google sign-in with Firebase Auth",
      "Stripe PaymentIntent checkout via Next.js API routes",
      "Unit tests (Vitest) and Playwright e2e coverage",
    ],
  },
  {
    id: "integrated-neuro",
    name: "Integrated Neuro",
    tagline: "Clinic website for neurological & mental health care",
    description:
      "Real client project for a Vancouver neuropsychology and counselling practice. Content-rich marketing site with service pages, team profiles, and contact — launching soon.",
    localPath: "neuro",
    status: "in-progress",
    featured: false,
    order: 3,
    liveUrl: "https://integrated-neuro.pages.dev",
    githubUrl: "https://github.com/Parva9eh/integrated-neuro",
    image: "/images/projects/integrated-neuro.png",
    accent: "from-teal-700 via-cyan-700 to-emerald-800",
    stack: ["Next.js", "TypeScript", "Tailwind CSS", "Cloudflare Pages"],
    highlights: [
      "Production site for a real healthcare practice",
      "Service lines: neuropsychology + counselling (IN-Sight)",
      "Static export, optimized images, and Cloudflare deploy",
      "Accessible, calm UI aligned with clinical branding",
    ],
  },
  {
    id: "soccer-analytics",
    name: "Soccer Analytics",
    tagline: "Event-level match analytics for coaches & fans",
    description:
      "Latest full-stack platform: Next.js front end, FastAPI backend, Supabase/PostgreSQL, StatsBomb open data ETL, and interactive SVG pitch visualizations. Actively in development.",
    localPath: "soccer-analytics",
    status: "live",
    featured: false,
    order: 4,
    liveUrl: "https://soccer-a9alytics-web.vercel.app",
    githubUrl: "https://github.com/Parva9eh/soccer-analytics",
    image: "/images/projects/soccer-analytics.png",
    accent: "from-emerald-600 via-green-700 to-lime-800",
    stack: [
      "Next.js",
      "React",
      "TypeScript",
      "FastAPI",
      "Python",
      "Supabase",
      "PostgreSQL",
      "Docker",
    ],
    highlights: [
      "Monorepo: apps/web (Next.js) + apps/api (FastAPI)",
      "StatsBomb open-data ETL into Supabase/PostgreSQL",
      "Interactive pitch with event filtering",
      "Docker Compose + production deploy docs",
    ],
  },
];

export const statusLabel: Record<ProjectStatus, string> = {
  live: "Live",
  "in-progress": "In progress",
  "launching-soon": "Launching soon",
};

export function getProjects(): Project[] {
  return [...projects].sort((a, b) => a.order - b.order);
}

export function getFeaturedProjects(): Project[] {
  return getProjects().filter((p) => p.featured);
}
