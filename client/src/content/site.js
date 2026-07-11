/**
 * Portfolio content — fill these placeholders later.
 * UI reads only from this module so copy stays out of the 3D layer.
 */
export const site = {
  brand: "ORBIT",
  name: "Your Name",
  role: "Frontend · Creative Tech",
  tagline:
    "I build immersive web experiences — from data-driven APIs to interactive 3D scenes.",
  summary:
    "Short bio — who you are, what you build, and why space, data, or creative tech shows up in your work. Replace this with 2–4 real sentences.",
  location: "City, Country",
  openToWork: true,
  email: "you@example.com",
  resumeUrl: "#",
  social: {
    github: "https://github.com/",
    linkedin: "https://linkedin.com/in/",
  },
  skills: ["React", "Three.js / R3F", "Node", "Express", "Tailwind", "Vite"],
  projects: [
    {
      id: "astro-explorer",
      title: "Astro Explorer",
      blurb:
        "Interactive 3D near-Earth object visualizer with React Three Fiber, Express caching, and hazard filters — powered by NASA NEO data.",
      stack: ["React", "R3F", "Express", "NASA API"],
      featured: true,
      live: true,
      href: null,
      repo: null,
    },
    {
      id: "project-two",
      title: "Project Two",
      blurb: "One-line blurb for another project you want to highlight.",
      stack: ["Stack", "Tags"],
      featured: false,
      live: false,
      href: "#",
      repo: null,
    },
    {
      id: "project-three",
      title: "Project Three",
      blurb: "Another project card — replace with real work when ready.",
      stack: ["Stack", "Tags"],
      featured: false,
      live: false,
      href: "#",
      repo: null,
    },
  ],
};

export const MISSION_STEPS = [
  { id: "briefing", label: "01 Briefing", section: "Sec 01 · Briefing" },
  { id: "projects", label: "02 Projects", section: "Sec 02 · Projects" },
  { id: "live", label: "03 Live system", section: "Sec 03 · Live system" },
  { id: "comms", label: "04 Comms", section: "Sec 04 · Comms" },
];
