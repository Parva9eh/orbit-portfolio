import type { ReactNode } from "react";
import {
  MISSION_STEPS,
  site,
  type MissionStepId,
} from "../../content/site";
import ContactForm from "./ContactForm";

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
          <h3 className="text-white text-base font-semibold mb-1 flex flex-wrap items-center gap-1">
            <span>{p.title}</span>
            {p.featured && <Chip>Featured</Chip>}
            {p.live && <Chip>Live</Chip>}
          </h3>
          <p className="text-gray-400 text-sm mb-2">{p.blurb}</p>
          <div className="flex flex-wrap">
            {p.stack.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {p.live && (
              <button
                type="button"
                onClick={onEnterLive}
                className="text-sm font-semibold text-sky-300 hover:text-sky-200"
              >
                Enter live system →
              </button>
            )}
            {p.repo && (
              <a
                href={p.repo}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-gray-400 hover:text-sky-300"
              >
                Repo
              </a>
            )}
            {p.href && p.href !== "#" && (
              <a
                href={p.href}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-gray-400 hover:text-sky-300"
              >
                Open
              </a>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

function LiveBody() {
  return (
    <>
      <p className="mb-3">
        Live NEO tools are on the <strong className="text-gray-300">right rail</strong>{" "}
        — catalog, filters, compare, Sentry, ruler, and guided tours. The canvas
        stays full-viewport; Mission Control chrome does not cover the scene.
      </p>
      <p className="text-sm text-gray-500 mb-2">
        <strong className="text-gray-400">Demo path:</strong> Guided tours →
        Closest today → select + Compare → Show ISS / Focus ISS → optional Sentry
        pick. Copy link to share the same briefing.
      </p>
      <p className="text-sm text-gray-500">
        Near-Earth view is honest for miss distances; System view is for planets
        and SBDB heliocentric orbits.
      </p>
    </>
  );
}

function CommsBody() {
  return (
    <>
      <p className="mb-3 text-gray-400">
        Open to roles and collabs in product frontend, creative tech, and
        data-rich 3D experiences. Happy to walk through ORBIT live or dig into
        architecture (API cache, scene split, mission state).
      </p>
      <p className="text-[10px] uppercase tracking-wider text-cyan-300/80 font-semibold mb-1.5">
        Secure channel
      </p>
      <ContactForm />
    </>
  );
}

type MissionDockProps = {
  step: MissionStepId;
  onStepChange: (step: MissionStepId) => void;
  onEnterLive: () => void;
  /** Phone/tablet landscape: dock sits on the left half so tools can slide from the right */
  landscape?: boolean;
};

export default function MissionDock({
  step,
  onStepChange,
  onEnterLive,
  landscape = false,
}: MissionDockProps) {
  const meta = MISSION_STEPS.find((s) => s.id === step) ?? MISSION_STEPS[0];

  let title = site.name;
  let role = site.role;
  let body: ReactNode = <BriefingBody />;
  const showResume = Boolean(site.resumeUrl && site.resumeUrl !== "#");

  let foot: ReactNode = (
    <>
      <button
        type="button"
        onClick={() => onStepChange("projects")}
        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-custom-blue text-white"
      >
        View projects
      </button>
      {showResume && (
        <a
          href={site.resumeUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white hover:border-sky-300 hover:text-sky-300"
        >
          Resume PDF
        </a>
      )}
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
      <a
        href={site.social.github}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-custom-blue text-white"
      >
        GitHub
      </a>
    );
  }

  return (
    <aside
      className={
        landscape
          ? `absolute z-20 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0f1623]/cc backdrop-blur-md shadow-2xl
              left-2 top-14 bottom-12 w-[min(46vw,22rem)] max-h-none safe-pad-x`
          : `absolute z-20 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0f1623]/cc backdrop-blur-md shadow-2xl
              left-3 right-3 bottom-12 max-h-[min(42vh,22rem)]
              max-md:max-h-[min(38dvh,18rem)]
              safe-pad-x
              md:left-4 md:right-auto md:top-16 md:bottom-14 md:w-[min(360px,92vw)] md:max-h-none`
      }
      aria-live="polite"
      data-landscape={landscape ? "true" : "false"}
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
