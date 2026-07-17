import type { ReactNode } from "react";
import {
  MISSION_STEPS,
  site,
  statusLabel,
  type MissionStepId,
} from "../../content/site";
import type { Project, ProjectStatus } from "../../content/projects";
import ContactForm from "./ContactForm";

function Chip({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "live" | "progress" | "soon" | "feature";
}) {
  const tones: Record<string, string> = {
    default: "bg-custom-blue/20 text-sky-300 border-custom-blue/30",
    live: "bg-emerald-500/20 text-emerald-200 border-emerald-400/35",
    progress: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    soon: "bg-violet-500/15 text-violet-200 border-violet-400/30",
    feature: "bg-sky-500/15 text-sky-200 border-sky-400/30",
  };
  return (
    <span
      className={`inline-block text-[0.68rem] px-1.5 py-0.5 rounded border mr-1 mb-1 ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function statusTone(status: ProjectStatus): "live" | "progress" | "soon" {
  if (status === "live") return "live";
  if (status === "in-progress") return "progress";
  return "soon";
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
      <p className="mt-4 text-[10px] text-gray-600 leading-snug">
        Built with care; implementation assisted by AI tools including{" "}
        <span className="text-gray-500">xAI Grok Build</span>. Architecture,
        review, and shipping remain my own.
      </p>
    </>
  );
}

function InactiveLink({ label, reason }: { label: string; reason: string }) {
  return (
    <span
      className="text-sm font-semibold text-gray-600 cursor-not-allowed select-none"
      title={reason}
      aria-disabled="true"
    >
      {label}
    </span>
  );
}

function ProjectMedia({ p }: { p: Project }) {
  const src = p.image?.trim() || null;
  const gradient = p.accent ?? "from-slate-800 via-slate-700 to-slate-900";

  return (
    <div
      className={`relative mb-2 w-full overflow-hidden rounded-lg border border-white/10 aspect-[16/9] bg-gradient-to-br ${gradient}`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-3">
          <span className="text-[11px] font-semibold tracking-wide text-white/70 text-center leading-snug">
            {p.name}
          </span>
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent"
        aria-hidden
      />
    </div>
  );
}

function ProjectCard({
  p,
  onEnterLive,
}: {
  p: Project;
  onEnterLive: () => void;
}) {
  const openUrl = p.liveUrl && p.liveUrl !== "#" ? p.liveUrl : null;
  const repoUrl = p.githubUrl && p.githubUrl !== "#" ? p.githubUrl : null;

  /**
   * Link policy:
   * - live: live + repo active
   * - in-progress: both inactive (WIP — don’t send visitors to half-built URLs)
   * - launching-soon: live inactive; repo active if present (code often public before launch)
   */
  const inProgress = p.status === "in-progress";
  const liveReady = p.status === "live";
  const liveClickable = liveReady && Boolean(openUrl);
  const repoClickable = !inProgress && Boolean(repoUrl);

  return (
    <div className="mb-4 last:mb-0 pb-3 last:pb-0 border-b border-white/5 last:border-0">
      <ProjectMedia p={p} />
      <h3 className="text-white text-base font-semibold mb-1 flex flex-wrap items-center gap-1">
        <span>{p.name}</span>
        {p.featured && <Chip tone="feature">Featured</Chip>}
        <Chip tone={statusTone(p.status)}>{statusLabel[p.status]}</Chip>
      </h3>
      <p className="text-sky-200/80 text-sm font-medium mb-1">{p.tagline}</p>
      <p className="text-gray-400 text-sm mb-2 leading-snug">{p.description}</p>
      <div className="flex flex-wrap mb-1.5">
        {p.stack.slice(0, 8).map((t) => (
          <Chip key={t}>{t}</Chip>
        ))}
      </div>
      {p.highlights && p.highlights.length > 0 && (
        <ul className="mb-2 space-y-0.5 text-[11px] text-gray-500 list-disc list-inside">
          {p.highlights.slice(0, 3).map((h) => (
            <li key={h} className="leading-snug">
              {h}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2 flex flex-wrap gap-3 items-center">
        {p.enterMissionLive && (
          <button
            type="button"
            onClick={onEnterLive}
            className="text-sm font-semibold text-sky-300 hover:text-sky-200"
          >
            Enter live system →
          </button>
        )}

        {/* External live demo */}
        {!p.enterMissionLive && liveClickable && openUrl && (
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-sky-300 hover:text-sky-200"
          >
            Open live →
          </a>
        )}
        {!p.enterMissionLive && !liveClickable && openUrl && (
          <InactiveLink
            label="Open live →"
            reason={
              inProgress
                ? "Demo not public while in progress"
                : "Launching soon — demo not public yet"
            }
          />
        )}
        {!p.enterMissionLive && !openUrl && !liveReady && (
          <InactiveLink label="Live soon" reason="No public demo URL yet" />
        )}

        {/* Repo */}
        {repoClickable && repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-gray-400 hover:text-sky-300"
          >
            Repo
          </a>
        )}
        {!repoClickable && repoUrl && (
          <InactiveLink
            label="Repo"
            reason="Repository stays private while this project is in progress"
          />
        )}
      </div>
    </div>
  );
}

function ProjectsBody({ onEnterLive }: { onEnterLive: () => void }) {
  return (
    <>
      <p className="text-[11px] text-gray-500 mb-3 leading-snug">
        Selected work — status and links from the portfolio catalog.
      </p>
      {site.projects.map((p) => (
        <ProjectCard key={p.id} p={p} onEnterLive={onEnterLive} />
      ))}
    </>
  );
}

function LiveBody() {
  return (
    <>
      <p className="mb-3">
        Live NEO tools are on the{" "}
        <strong className="text-gray-300">right rail</strong> — catalog,
        filters, compare, Sentry, ruler, and guided tours. The canvas stays
        full-viewport; Mission Control chrome does not cover the scene.
      </p>
      <p className="text-sm text-gray-500 mb-2">
        <strong className="text-gray-400">Demo path:</strong> Guided tours →
        Closest today → select + Compare → Show ISS / Focus ISS → optional
        Sentry pick. Copy link to share the same briefing.
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
      <>
        <a
          href={site.social.github}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-custom-blue text-white"
        >
          GitHub
        </a>
      </>
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
