import { useState, type FormEvent } from "react";

type Status = "idle" | "sending" | "sent" | "error";

/**
 * Portfolio contact form — delivers via Web3Forms so your email never appears
 * in the SPA. Set `VITE_WEB3FORMS_ACCESS_KEY` (from https://web3forms.com).
 * Without a key, the form stays disabled and social links remain the path.
 */
export default function ContactForm() {
  const accessKey = (import.meta.env.VITE_WEB3FORMS_ACCESS_KEY as string | undefined)?.trim() ?? "";
  const configured = accessKey.length > 0;

  const [status, setStatus] = useState<Status>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!configured || status === "sending") return;

    const form = e.currentTarget;
    const data = new FormData(form);
    // Honeypot — bots fill this; real users leave it empty
    if (String(data.get("botcheck") ?? "")) {
      setStatus("sent");
      return;
    }

    setStatus("sending");
    setErrorDetail(null);

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject: data.get("subject") || "ORBIT portfolio — transmission",
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          from_name: "ORBIT Mission Control",
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Submit failed (${res.status})`);
      }
      setStatus("sent");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorDetail(err instanceof Error ? err.message : "Send failed");
    }
  }

  if (!configured) {
    return (
      <p className="text-[11px] text-gray-500 leading-snug border border-white/10 rounded-lg px-2.5 py-2 bg-black/20">
        Contact form offline in this build. Use GitHub or LinkedIn below, or set{" "}
        <code className="text-gray-400">VITE_WEB3FORMS_ACCESS_KEY</code> at build
        time (Web3Forms — your inbox address stays off the page).
      </p>
    );
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-2.5 py-2 space-y-2">
        <p className="text-sm text-emerald-200/90">
          Transmission received — thanks for reaching out.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="text-xs font-semibold text-sky-300 hover:text-sky-200"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      {/* Honeypot */}
      <input
        type="text"
        name="botcheck"
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-500">
          Name
        </span>
        <input
          name="name"
          required
          maxLength={120}
          disabled={status === "sending"}
          className="mt-0.5 w-full px-2.5 py-1.5 rounded-md border border-white/10 bg-[#0c121c] text-white text-sm placeholder:text-gray-600"
          placeholder="Your name"
          autoComplete="name"
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-500">
          Reply-to
        </span>
        <input
          name="email"
          type="email"
          required
          maxLength={200}
          disabled={status === "sending"}
          className="mt-0.5 w-full px-2.5 py-1.5 rounded-md border border-white/10 bg-[#0c121c] text-white text-sm placeholder:text-gray-600"
          placeholder="you@domain.com"
          autoComplete="email"
        />
      </label>
      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-gray-500">
          Message
        </span>
        <textarea
          name="message"
          required
          rows={3}
          maxLength={4000}
          disabled={status === "sending"}
          className="mt-0.5 w-full px-2.5 py-1.5 rounded-md border border-white/10 bg-[#0c121c] text-white text-sm placeholder:text-gray-600 resize-y min-h-[4.5rem]"
          placeholder="Roles, collabs, architecture questions…"
        />
      </label>
      <input type="hidden" name="subject" value="ORBIT portfolio — transmission" />
      <button
        type="submit"
        disabled={status === "sending"}
        className="w-full px-3 py-1.5 rounded-md text-xs font-semibold bg-custom-blue text-white disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send transmission"}
      </button>
      {status === "error" && (
        <p className="text-[11px] text-amber-300/90 leading-snug">
          Could not send{errorDetail ? ` — ${errorDetail}` : ""}. Try again or
          use GitHub / LinkedIn.
        </p>
      )}
    </form>
  );
}
