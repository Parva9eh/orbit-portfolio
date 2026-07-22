import { useState, type ReactNode } from "react";
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

function statusBorder(status: ProjectStatus): string {
  if (status === "live") return "border-l-emerald-400/70";
  if (status === "in-progress") return "border-l-amber-400/60";
  return "border-l-violet-400/50";
}

function BriefingBody() {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <p className="mb-2 text-sky-100/90 text-sm font-medium leading-snug">
        {site.tagline}
      </p>
      <p
        className={`mb-2 text-gray-400 text-sm leading-relaxed ${
          expanded ? "" : "line-clamp-3"
        }`}
      >
        {site.summary}
      </p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="text-[11px] text-sky-300/90 hover:text-sky-200 mb-3 font-semibold"
      >
        {expanded ? "Show less" : "Read more"}
      </button>
      <p className="text-gray-400 text-sm mb-2">
        {site.location}
        {site.openToWork && (
          <span className="ml-2 not-italic text-emerald-400">
            · Open to opportunities
          </span>
        )}
      </p>
      <p className="text-[11px] text-cyan-200/85 mb-3 leading-snug">
        Live NEO catalog, real APIs, and interactive 3D under load —{" "}
        <span className="text-sky-300 font-semibold">Enter live system</span>{" "}
        to see it.
      </p>

      {site.skills.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
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
      className={`relative mb-2 w-full overflow-hidden rounded-lg border border-white/10 aspect-[16/9] bg-gradient-to-br ${gradient} group`}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.04]"
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

  const inProgress = p.status === "in-progress";
  const liveReady = p.status === "live";
  const liveClickable = liveReady && Boolean(openUrl);
  const repoClickable = !inProgress && Boolean(repoUrl);

  return (
    <div
      className={
        p.featured
          ? "mb-4 last:mb-0 rounded-lg border border-sky-400/25 bg-sky-950/30 border-l-[3px] border-l-sky-400/80 pl-2.5 pr-2.5 pt-2.5 pb-2.5"
          : `mb-4 last:mb-0 pb-3 last:pb-0 border-b border-white/5 last:border-0 border-l-2 pl-2.5 -ml-0.5 ${statusBorder(p.status)}`
      }
    >
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
            className="text-sm font-semibold text-sky-300 hover:text-sky-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-400 rounded"
          >
            Open Live demo →
          </button>
        )}

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
  const list = site.projects;
  const featured = list.filter((p) => p.featured);
  const rest = list.filter((p) => !p.featured);
  const ordered = [...featured, ...rest];

  return (
    <>
      <p className="text-[11px] text-gray-500 mb-3 leading-snug">
        Featured first — ORBIT is this Live demo; other work below.
      </p>
      {ordered.map((p) => (
        <ProjectCard key={p.id} p={p} onEnterLive={onEnterLive} />
      ))}
    </>
  );
}

/** Desktop Live panel body — short, no scroll needed in the rail. */
function LiveBody() {
  return (
    <>
      <p className="mb-2 text-sm text-gray-300 leading-snug">
        Catalog, filters, compare, ISS, and tours are on the{" "}
        <strong className="text-white">right rail</strong>
        <span className="text-gray-500"> (mobile: NEO tools)</span>.
      </p>
      <p className="text-sm text-amber-200/85 mb-2 leading-snug rounded-md border border-amber-400/20 bg-amber-950/30 px-2 py-1.5">
        First Live request after idle may take ~20–60s while the free API
        wakes up.
      </p>
      <p className="text-[11px] text-gray-500 leading-snug mb-1.5">
        Tip: Guided tours → Closest today → select + Compare. Free cam to
        explore; Focus after you pick a body.
      </p>
      <p className="text-[11px] text-sky-200/80 leading-snug">
        We&apos;re inside the galactic disk — the band is our Milky Way. The
        Sun&apos;s ~230 Myr galactic orbit isn&apos;t animated here (planetary
        mission control only).{" "}
        <span className="text-gray-500">Viz ⓘ · tours: Inside the disk.</span>
      </p>
    </>
  );
}

/**
 * Mobile Live: single non-scrolling tip card (top).
 * Avoids the old bottom dock that forced awkward nested scroll.
 */
function LiveMobileBanner({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div
      className="absolute z-20 left-3 right-3 top-[6.4rem]
        rounded-xl border border-white/12 bg-[#080d16] backdrop-blur-md shadow-xl
        px-3 py-2.5 safe-pad-x pointer-events-auto"
      role="region"
      aria-label="Live guide"
      data-step="live"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[0.65rem] tracking-[0.12em] uppercase text-cyan-300 font-semibold">
            Sec 03 · Live system
          </p>
          <p className="text-[12px] text-gray-200 leading-snug mt-1">
            <span className="text-sky-200 font-semibold">NEO tools</span> for
            catalog &amp; tours ·{" "}
            <span className="text-cyan-200 font-semibold">Viz</span> for camera
            &amp; quality.
          </p>
          <p className="text-[11px] text-amber-200/85 leading-snug mt-1.5">
            First load after idle may take ~20–60s (free API wake).
          </p>
          <p className="text-[10px] text-sky-200/75 leading-snug mt-1">
            Inside the galactic disk — Sun&apos;s galactic orbit not animated
            (see Viz ⓘ · tour: Inside the disk).
          </p>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border border-white/15
              text-gray-300 hover:text-white hover:border-sky-400/40"
            aria-label="Dismiss live guide"
          >
            Got it
          </button>
        )}
      </div>
    </div>
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
  /**
   * Live guide presentation:
   * - panel: desktop/left rail (or landscape)
   * - banner: mobile top tip card, no scroll
   */
  liveLayout?: "panel" | "banner";
  /** Collapse / dismiss Live guide */
  onRequestClose?: () => void;
};

export default function MissionDock({
  step,
  onStepChange,
  onEnterLive,
  landscape = false,
  liveLayout = "panel",
  onRequestClose,
}: MissionDockProps) {
  const meta = MISSION_STEPS.find((s) => s.id === step) ?? MISSION_STEPS[0];

  // Mobile Live: non-scrolling top banner instead of bottom dock
  if (step === "live" && liveLayout === "banner") {
    return <LiveMobileBanner onDismiss={onRequestClose} />;
  }

  let title = site.name;
  let role = site.role;
  let body: ReactNode = <BriefingBody />;

  let foot: ReactNode = (
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
        onClick={() => onStepChange("projects")}
        className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-white hover:border-sky-300"
      >
        View projects
      </button>
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
        {onRequestClose && (
          <button
            type="button"
            onClick={onRequestClose}
            className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border border-white/15 text-gray-300 hover:border-sky-300 hover:text-sky-200"
          >
            Hide guide
          </button>
        )}
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

  /**
   * 01/02/04: tall content dock.
   * 03 Live (panel): left rail on desktop / landscape — auto height, no nested scroll fight.
   */
  const isLive = step === "live";

  return (
    <aside
      className={
        landscape
          ? `absolute z-20 flex flex-col overflow-hidden rounded-xl border border-white/12 bg-[#080d16] backdrop-blur-md shadow-2xl
              left-2 top-14 bottom-12 w-[min(46vw,22rem)] max-h-none safe-pad-x`
          : isLive
            ? `absolute z-20 flex flex-col overflow-hidden rounded-xl border border-white/12 bg-[#080d16] backdrop-blur-md shadow-2xl
                left-4 top-16 w-[min(320px,90vw)] max-h-[min(48vh,26rem)]
                safe-pad-x`
            : `absolute z-20 flex flex-col overflow-hidden rounded-xl border border-white/12 bg-[#080d16] backdrop-blur-md shadow-2xl
                left-3 right-3 top-14 bottom-12
                max-md:top-[3.5rem] max-md:bottom-11
                safe-pad-x
                md:left-4 md:right-auto md:top-16 md:bottom-14 md:w-[min(360px,92vw)]`
      }
      aria-live="polite"
      data-landscape={landscape ? "true" : "false"}
      data-step={step}
    >
      <div className="px-4 pt-4 pb-3 border-b border-white/10 shrink-0">
        <p className="text-[0.65rem] tracking-[0.14em] uppercase text-cyan-300 font-semibold mb-1">
          {meta.section}
        </p>
        <h2 className="text-xl font-bold leading-tight text-white">{title}</h2>
        <p className="text-sm font-semibold text-sky-300 mt-1">{role}</p>
      </div>
      <div
        className={`px-4 py-3 text-sm text-gray-400 animate-fade-in ${
          isLive ? "overflow-hidden" : "overflow-y-auto flex-1"
        }`}
      >
        {body}
      </div>
      <div className="px-4 py-3 border-t border-white/10 flex flex-wrap gap-2 shrink-0">
        {foot}
      </div>
    </aside>
  );
}
