import { useState, type FocusEvent, type FormEvent } from "react";

type Status = "idle" | "sending" | "sent" | "error";

type FieldErrors = {
  name?: string;
  email?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldLabel({
  htmlFor,
  children,
  required: isRequired,
}: {
  htmlFor: string;
  children: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-[10px] uppercase tracking-wider text-gray-500">
        {children}
        {isRequired && (
          <span className="text-sky-400/90 normal-case tracking-normal ml-1" aria-hidden>
            *
          </span>
        )}
      </span>
    </label>
  );
}

const inputClass =
  "mt-0.5 w-full px-2.5 py-1.5 rounded-md border bg-[#0c121c] text-white text-sm placeholder:text-gray-600 disabled:opacity-50";
const inputOk = "border-white/10";
const inputErr = "border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/40";

/**
 * Portfolio contact form — Web3Forms delivery (your inbox never appears in the SPA).
 * Set `VITE_WEB3FORMS_ACCESS_KEY` (https://web3forms.com).
 */
export default function ContactForm() {
  const accessKey =
    (import.meta.env.VITE_WEB3FORMS_ACCESS_KEY as string | undefined)?.trim() ??
    "";
  const configured = accessKey.length > 0;

  const [status, setStatus] = useState<Status>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function validate(data: FormData): FieldErrors {
    const errors: FieldErrors = {};
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    if (!name) errors.name = "Name is required";
    if (!email) errors.email = "Your email is required so we can reply";
    else if (!EMAIL_RE.test(email)) errors.email = "Enter a valid email address";
    if (!message) errors.message = "Message is required";
    else if (message.length < 10)
      errors.message = "Please write a bit more (at least a sentence)";

    return errors;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;

    const form = e.currentTarget;
    const data = new FormData(form);

    // Honeypot — bots fill this; real users leave it empty
    if (String(data.get("botcheck") ?? "")) {
      setStatus("sent");
      return;
    }

    const errors = validate(data);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setStatus("idle");
      setErrorDetail(null);
      return;
    }

    if (!configured) {
      setErrorDetail(
        "Form is offline in this build — set VITE_WEB3FORMS_ACCESS_KEY, or use GitHub."
      );
      setStatus("error");
      return;
    }

    setStatus("sending");
    setErrorDetail(null);

    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    try {
      const res = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          subject: "ORBIT portfolio — transmission",
          name,
          email,
          // Web3Forms uses this for Reply-To on the message you receive
          replyto: email,
          message,
          from_name: "ORBIT Mission Control",
        }),
      });
      const json = (await res.json()) as { success?: boolean; message?: string };
      if (!res.ok || !json.success) {
        throw new Error(json.message || `Submit failed (${res.status})`);
      }
      setStatus("sent");
      setFieldErrors({});
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorDetail(err instanceof Error ? err.message : "Send failed");
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-2.5 py-2 space-y-2">
        <p className="text-sm text-emerald-200/90">
          Transmission received — thanks for reaching out. I’ll reply to the
          email you provided.
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

  const busy = status === "sending";

  /** Keep focused field visible when the mobile keyboard opens */
  function scrollFieldIntoView(e: FocusEvent<HTMLElement>) {
    const el = e.currentTarget;
    // Delay so the visual viewport has resized after the keyboard
    window.setTimeout(() => {
      el.scrollIntoView({
        block: "center",
        behavior: "smooth",
        inline: "nearest",
      });
    }, 120);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2.5" noValidate>
      {!configured && (
        <p className="text-[11px] text-amber-200/80 leading-snug border border-amber-500/20 rounded-lg px-2.5 py-2 bg-amber-950/15">
          Delivery offline until{" "}
          <code className="text-amber-100/90">VITE_WEB3FORMS_ACCESS_KEY</code>{" "}
          is set. You can still fill the form to preview; use GitHub to reach me
          for now.
        </p>
      )}

      {/* Honeypot */}
      <input
        type="text"
        name="botcheck"
        className="absolute opacity-0 pointer-events-none h-0 w-0"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
      />

      <div>
        <FieldLabel htmlFor="orbit-contact-name" required>
          Name
        </FieldLabel>
        <input
          id="orbit-contact-name"
          name="name"
          type="text"
          required
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "orbit-contact-name-err" : undefined}
          maxLength={120}
          disabled={busy}
          className={`${inputClass} ${fieldErrors.name ? inputErr : inputOk}`}
          placeholder="Your name"
          autoComplete="name"
          onFocus={scrollFieldIntoView}
          onChange={() =>
            setFieldErrors((e) => ({ ...e, name: undefined }))
          }
        />
        {fieldErrors.name && (
          <p id="orbit-contact-name-err" className="mt-0.5 text-[11px] text-amber-300/90">
            {fieldErrors.name}
          </p>
        )}
      </div>

      <div>
        <FieldLabel htmlFor="orbit-contact-email" required>
          Your email
        </FieldLabel>
        <input
          id="orbit-contact-email"
          name="email"
          type="email"
          required
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={
            fieldErrors.email
              ? "orbit-contact-email-err"
              : "orbit-contact-email-hint"
          }
          maxLength={200}
          disabled={busy}
          className={`${inputClass} ${fieldErrors.email ? inputErr : inputOk}`}
          placeholder="name@example.com"
          autoComplete="email"
          inputMode="email"
          onFocus={scrollFieldIntoView}
          onChange={() =>
            setFieldErrors((e) => ({ ...e, email: undefined }))
          }
        />
        {fieldErrors.email ? (
          <p id="orbit-contact-email-err" className="mt-0.5 text-[11px] text-amber-300/90">
            {fieldErrors.email}
          </p>
        ) : (
          <p id="orbit-contact-email-hint" className="mt-0.5 text-[10px] text-gray-600">
            Required — used only so I can reply (not shown publicly).
          </p>
        )}
      </div>

      <div>
        <FieldLabel htmlFor="orbit-contact-message" required>
          Message
        </FieldLabel>
        <textarea
          id="orbit-contact-message"
          name="message"
          required
          aria-required="true"
          aria-invalid={Boolean(fieldErrors.message)}
          aria-describedby={
            fieldErrors.message ? "orbit-contact-message-err" : undefined
          }
          rows={3}
          maxLength={4000}
          disabled={busy}
          className={`${inputClass} resize-y min-h-[4.5rem] ${
            fieldErrors.message ? inputErr : inputOk
          }`}
          placeholder="Roles, collabs, architecture questions…"
          onFocus={scrollFieldIntoView}
          onChange={() =>
            setFieldErrors((e) => ({ ...e, message: undefined }))
          }
        />
        {fieldErrors.message && (
          <p
            id="orbit-contact-message-err"
            className="mt-0.5 text-[11px] text-amber-300/90"
          >
            {fieldErrors.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full px-3 py-1.5 rounded-md text-xs font-semibold bg-custom-blue text-white disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send transmission"}
      </button>

      {status === "error" && (
        <p className="text-[11px] text-amber-300/90 leading-snug" role="alert">
          Could not send{errorDetail ? ` — ${errorDetail}` : ""}. Try again or
          use GitHub.
        </p>
      )}
    </form>
  );
}
