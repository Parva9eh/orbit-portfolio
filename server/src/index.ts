import express from "express";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import astroRoutes from "./routes/index.ts";

dotenv.config();

const app = express();
// Behind Render/Cloudflare — required for correct client IPs in rate limiting
app.set("trust proxy", 1);
// Reduce fingerprinting surface
app.disable("x-powered-by");

/**
 * Baseline API security headers (JSON API — no browser CSP here).
 * SPA CSP is enforced on Vercel.
 */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    referrerPolicy: { policy: "no-referrer" },
  })
);

/**
 * CORS:
 * - Unset CORS_ORIGIN → allow all (local dev convenience).
 * - Set CORS_ORIGIN=https://your.app,http://localhost:5173 → allowlist only.
 *   Never use a wildcard with credentials.
 */
const corsOriginEnv = process.env.CORS_ORIGIN?.trim();
if (corsOriginEnv) {
  const allowlist = corsOriginEnv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin(origin, callback) {
        // Non-browser clients (curl, server-to-server) send no Origin
        if (!origin || allowlist.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`CORS blocked origin: ${origin}`));
      },
      methods: ["GET", "HEAD", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Accept"],
      maxAge: 600,
    })
  );
} else {
  app.use(
    cors({
      methods: ["GET", "HEAD", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Accept"],
    })
  );
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[security] CORS_ORIGIN is unset in production — all origins allowed. Set CORS_ORIGIN before public deploy."
    );
  }
}

// Gzip JSON responses (NEO pages, planets) — cheap win behind any host
app.use(compression());
// Read-mostly API; keep body tiny if anything POSTs later
app.use(express.json({ limit: "32kb" }));

/**
 * Rate limit NASA-proxied routes. Health stays unrestricted for uptime probes.
 * Override with RATE_LIMIT_WINDOW_MS / RATE_LIMIT_MAX if needed.
 */
const rateWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const rateMax = Number(process.env.RATE_LIMIT_MAX) || 120;
const apiLimiter = rateLimit({
  windowMs: rateWindowMs,
  max: rateMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — try again shortly" },
});
app.use("/api", apiLimiter);
app.use("/api", astroRoutes);

// Lightweight health for uptime checks (no cache / no NASA)
app.get("/health", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({ ok: true, uptime: process.uptime() });
});

// Avoid leaking stack traces from CORS / express errors
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    const msg = err.message ?? "Request failed";
    if (msg.startsWith("CORS blocked")) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    console.error("Unhandled error:", msg);
    res.status(500).json({ error: "Internal server error" });
  }
);

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || "0.0.0.0";
app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT}`);
});
