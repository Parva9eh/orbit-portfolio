import type { ReactNode } from "react";
import {
  MISSION_STEPS,
  site,
  type MissionStepId,
} from "../../content/site";

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block text-[0.68rem] px-1.5 py-0.5 rounded bg-custom-blue/20 text-sky-300 border border-custom-blue/30 mr-1 mb-1">
      {children}
    </span>
  );
}

function BriefingBody() {
  return (
    <>
      <p className="mb-3 text-gray-400 italic opacity-80">{site.summary}</p>
      <p className="text-gray-400 text-sm">
        {site.location}
        {site.openToWork && (
          <span className="ml-2 not-italic text-emerald-400">
            · Open to opportunities
          </span>
        )}
      </p>
      {site.skills.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1">
          {site.skills.map((s) => (
            <Chip key={s}>{s}</Chip>
          ))}
        </div>
      )}
    </>
  );
}

function ProjectsBody({ onEnterLive }: { onEnterLive: () => void }) {
  return (
    <>
      {site.projects.map((p) => (
        <div key={p.id} className="mb-4 last:mb-0">
          <h3 className="text-white text-base font-semibold mb-1">
            {p.title}
            {p.featured && <Chip>Featured</Chip>}
            {p.live && <Chip>Live</Chip>}
          </h3>
          <p className="text-gray-400 text-sm mb-2">{p.blurb}</p>
          <div className="flex flex-wrap">
            {p.stack.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
          {p.live && (
            <button
              type="button"
              onClick={onEnterLive}
              className="mt-2 text-sm font-semibold text-sky-300 hover:text-sky-200"
            >
              Enter live system →
            </button>
          )}
        </div>
      ))}
    </>
  );
}

function LiveBody() {
  return (
    <>
      <p className="mb-3">
        Same canvas, denser data. Use the right panel for search, hazard filter,
        planets, and the NEO list — Astro Explorer docked into the portfolio.
      </p>
      <p className="text-sm text-gray-500">
        Toggle <strong className="text-gray-300">Live NEO</strong> anytime to
        show or hide mission tools without leaving this page.
      </p>
    </>
  );
}

function CommsBody() {
  return (
    <>
      <p className="mb-3 text-gray-400 italic opacity-80">
        Short invite for roles, collabs, or chats about creative frontends.
      </p>
      <p className="text-sm text-gray-400">{site.email}</p>
    </>
  );
}

type MissionDockProps = {
  step: MissionStepId;
  onStepChange: (step: MissionStepId) => void;
  onEnterLive: () => void;
};

export default function MissionDock({
  step,
  onStepChange,
  onEnterLive,
}: MissionDockProps) {
  const meta = MISSION_STEPS.find((s) => s.id === step) ?? MISSION_STEPS[0];

  let title = site.name;
  let role = site.role;
  let body: ReactNode = <BriefingBody />;
  let foot: ReactNode = (
    <>
      <button
        type="button"
        onClick={() => onStepChange("projects")}
        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-custom-blue text-white"
      >
        View projects
      </button>
      <a
        href={site.resumeUrl}
        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white hover:border-sky-300 hover:text-sky-300"
      >
        Resume PDF
      </a>
    </>
  );

  if (step === "projects") {
    title = "Constellation";
    role = "Selected work in orbit";
    body = <ProjectsBody onEnterLive={onEnterLive} />;
    foot = (
      <>
        <button
          type="button"
          onClick={onEnterLive}
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-custom-blue text-white"
        >
          Enter live system
        </button>
        <button
          type="button"
          onClick={() => onStepChange("comms")}
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white hover:border-sky-300"
        >
          Contact
        </button>
      </>
    );
  } else if (step === "live") {
    title = "Astro Explorer";
    role = "NEO mission tools online";
    body = <LiveBody />;
    foot = (
      <>
        <button
          type="button"
          onClick={() => onStepChange("projects")}
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white hover:border-sky-300"
        >
          Back to projects
        </button>
        <button
          type="button"
          onClick={() => onStepChange("comms")}
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-custom-blue text-white"
        >
          Open comms
        </button>
      </>
    );
  } else if (step === "comms") {
    title = "Transmission";
    role = "Let's connect";
    body = <CommsBody />;
    foot = (
      <>
        <a
          href={`mailto:${site.email}`}
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-custom-blue text-white"
        >
          Email
        </a>
        <a
          href={site.social.github}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white hover:border-sky-300"
        >
          GitHub
        </a>
        <a
          href={site.social.linkedin}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white hover:border-sky-300"
        >
          LinkedIn
        </a>
      </>
    );
  }

  return (
    <aside
      className="absolute z-20 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0f1623]/cc backdrop-blur-md shadow-2xl
        left-3 right-3 bottom-12 max-h-[42vh]
        md:left-4 md:right-auto md:top-16 md:bottom-14 md:w-[min(360px,92vw)] md:max-h-none"
      aria-live="polite"
    >
      <div className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
        <p className="text-[0.65rem] tracking-[0.14em] uppercase text-cyan-300 font-semibold mb-1">
          {meta.section}
        </p>
        <h2 className="text-xl font-bold leading-tight text-white">{title}</h2>
        <p className="text-sm font-semibold text-sky-300 mt-1">{role}</p>
      </div>
      <div className="px-4 py-3 overflow-y-auto flex-1 text-sm text-gray-400">
        {body}
      </div>
      <div className="px-4 py-3 border-t border-white/10 flex flex-wrap gap-2 shrink-0">
        {foot}
      </div>
    </aside>
  );
}
