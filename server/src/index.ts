import express from "express";
import cors from "cors";
import compression from "compression";
import dotenv from "dotenv";
import astroRoutes from "./routes/astro.ts";

dotenv.config();

const app = express();
// Reduce fingerprinting surface
app.disable("x-powered-by");

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
