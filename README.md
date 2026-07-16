# ORBIT

**Interactive near-Earth object (NEO) mission control** — a portfolio-grade 3D explorer that turns free NASA / CNEOS / ISS data into a cinematic, useful visualization.

Browse daily close approaches, inspect real orbital elements, compare two asteroids, track the ISS in schematic LEO, and walk through guided “missions” without leaving the browser.

> Educational visualization. Not an impact alarm or operational flight tool.

---

## What you can do

| Capability | Description |
| --- | --- |
| **Approach timeline** | Jump across a 7-day window of NeoWs close approaches |
| **Live NEO tools** | Filter by hazard, miss distance, size; paginate the catalog |
| **Body inspector** | Miss distance, velocity, diameter, SBDB orbit provenance |
| **Compare A/B** | Side-by-side NEOs with deep-linkable state |
| **SBDB orbits** | JPL Small-Body Database elements for selected objects |
| **Sentry watchlist** | Educational CNEOS risk list + soft briefing (no browser alerts) |
| **ISS** | Live position (Where The ISS At), schematic LEO ring, focus mode |
| **Distance ruler** | Measure body-to-body scene distance (approx AU) |
| **Guided tours** | One-click demos (closest NEO, Earth neighborhood, ISS, system…) |
| **Viz controls** | Time scale, camera director, System vs Near-Earth view, quality, labels |

The UI is a full-viewport **Mission Control** shell: 3D canvas + left mission dock + right rail (Live NEO tools stacked above visualization controls).

---

## Demo walkthrough (portfolio / interview)

~2 minutes with both servers running (`localhost:5173`):

1. **Briefing → Projects → Enter live system** (left dock).
2. Open **Guided tours** on the right → **Closest today** (selects nearest NEO).
3. **+ Compare** a second NEO; note tinted orbits.
4. **Show ISS** → **Focus ISS** (Earth LEO framing).
5. Optional: **Sentry watchlist** → pick a designation (educational briefing).
6. **Copy link** and reopen the URL — state restores.

Deep links:

```
http://localhost:5173/?mode=live
http://localhost:5173/?mode=live&view=nearEarth&issFocus=1
```

Fill personal copy in `client/src/content/site.ts` (name, email, LinkedIn, resume).

---

## Architecture

```
astro-app/
├── client/          React 19 + Vite + R3F/Three.js (Mission Control UI + scene)
├── server/          Express 5 API — NASA/CNEOS/ISS proxy, cache, mock fallback
├── shared/          Domain types + pure helpers (orbit math, format, SBDB merge)
├── scripts/         Hygiene + smoke checks
└── docs/            Local notes (gitignored): Live QA, PR checklist, plans
```

### Data flow

1. **Browser** calls `/api/*` (Vite proxies to `:8000` in dev).
2. **Server** fetches upstream (NeoWs, SBDB, Sentry, DONKI, ISS) with **NodeCache** TTLs and **inflight coalescing** (no stampede on cold misses).
3. **Shared** modules normalize positions, orbit elements, and display strings used by both ends.
4. **ThreeDScene** renders planets / NEOs / ISS with scale-aware orbits (System vs Near-Earth).

### Key API routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/asteroids` | Paginated NeoWs (or mock) for a `start_date` |
| `GET` | `/api/planets` | Major planets for the system view |
| `GET` | `/api/sbdb?sstr=` | JPL SBDB orbital elements |
| `GET` | `/api/iss` | Current ISS lat/lon/alt |
| `GET` | `/api/sentry` | Sentry watchlist (with offline fallback sample) |
| `GET` | `/api/sentry/:des` | Sentry object detail |
| `GET` | `/api/donki/solar` | DONKI flare / GST badge (needs NASA key) |
| `GET` | `/health` | Liveness (no NASA dependency) |

---

## Stack

| Layer | Tech |
| --- | --- |
| UI | React 19, React Router, Tailwind CSS |
| 3D | Three.js, React Three Fiber, Drei |
| API | Express 5, Axios, `node-cache`, compression |
| Language | TypeScript (strict) across `client`, `server`, `shared` |
| Tooling | Vite 7, `tsx` for the server, ESLint |

---

## Quick start

### Prerequisites

- Node.js 20+ (recommended)
- npm
- Free [NASA API key](https://api.nasa.gov/) (or use `DEMO_KEY` with rate limits)

### 1. Server

```bash
cd server
cp .env.example .env
# Edit .env → set NASA_API_KEY=your_key  (DEMO_KEY works with limits)
npm install
npm run dev
# → http://localhost:8000  (health: /health)
```

### 2. Client

```bash
cd client
npm install
npm run dev
# → http://localhost:5173  (proxies /api → :8000)
```

### 3. Smoke + Live QA

```bash
# From repo root, with both servers running:
bash scripts/smoke.sh

# Full manual UI pass (local workspace):
# open docs/LIVE_QA_CHECKLIST.md
# PR body template: docs/pull_request_template.md
```

### Production build (client)

```bash
cd client
npm run build
npm run preview
```

Point `VITE_API_URL` at your deployed API if the SPA is not served from the same host.

---

## Deploy notes

| Piece | Guidance |
| --- | --- |
| **API** | Run `server` on Node 20+ with `NASA_API_KEY`, `PORT`, and production `CORS_ORIGIN` |
| **SPA** | Static host for `client/dist` (Netlify, Vercel, S3, nginx…) |
| **Same origin** | Proxy `/api` and `/health` to the Express app; leave `VITE_API_URL` unset so the client uses `/api` |
| **Split origin** | Set `VITE_API_URL=https://api.example.com/api` at **build** time; set `CORS_ORIGIN` to the SPA origin |
| **Health** | Load balancer should hit `GET /health` (no NASA dependency) |

Minimal production env (server):

```bash
NASA_API_KEY=your_key
PORT=8000
HOST=0.0.0.0
NODE_ENV=production
CORS_ORIGIN=https://your-spa.example
```

---

## Configuration

### Server (`.env`)

| Variable | Default | Notes |
| --- | --- | --- |
| `NASA_API_KEY` | — | Required for live NeoWs + DONKI. Falls back to mock NEOs if missing |
| `PORT` | `8000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `CORS_ORIGIN` | *(unset = allow all)* | Comma-separated origins for public deploys |
| `NODE_ENV` | — | Warns if production + open CORS |

### Client

| Variable | Notes |
| --- | --- |
| `VITE_API_URL` | Absolute API base (e.g. `https://api.example.com/api`). Dev defaults to `http://localhost:8000/api` |

---

## Security notes

This is a **read-only proxy** for public science APIs. Practical controls in place:

- **Secrets stay on the server** — `NASA_API_KEY` is never sent to the browser
- **`.env` is gitignored**; only `.env.example` is committed
- **Designation / SBDB query validation** — restricted charset + length before upstream calls
- **Pagination / date parsing** — bounds on `page`, `limit`, ISO dates
- **JSON body limit** `32kb`; API is GET-oriented
- **CORS allowlist** via `CORS_ORIGIN` for production
- **`X-Powered-By` disabled**; generic 500s (no stack traces to clients)
- **Upstream hosts are fixed** (no user-controlled fetch URLs / SSRF surface)
- **Dependency audit** — keep `npm audit` clean after install

Before a public deploy:

1. Set a real `NASA_API_KEY` and rotate if it was ever shared.
2. Set `CORS_ORIGIN` to your SPA origin(s).
3. Serve the SPA over HTTPS and put the API behind a reverse proxy if needed.
4. Re-run hygiene + smoke:

```bash
bash scripts/hygiene-check.sh
bash scripts/smoke.sh   # against the target stack if reachable
```

---

## Development scripts

| Package | Command | Purpose |
| --- | --- | --- |
| `client` | `npm run dev` | Vite HMR |
| `client` | `npm run typecheck` | `tsc --noEmit` |
| `client` | `npm run build` | Typecheck + production bundle |
| `server` | `npm run dev` | `tsx watch` API |
| `server` | `npm run typecheck` | `tsc --noEmit` |
| root | `bash scripts/hygiene-check.sh` | Ignore rules + secret scan |
| root | `bash scripts/smoke.sh` | API + Vite module smoke (servers up) |

**PR checklist (local):** `docs/pull_request_template.md` · **Live QA:** `docs/LIVE_QA_CHECKLIST.md`  
*(both live under `docs/`, which is gitignored — keep them in your private workspace)*

### Short Live QA (also in README for public repos)

For PRs that touch scene, mission model, Live Neo, or data hooks:

- [ ] Live list loads + select NEO (SBDB soft path OK)
- [ ] Compare A/B orbits
- [ ] ISS show + focus
- [ ] Sentry pick (educational briefing, no raw 502)
- [ ] Ruler or guided tour
- [ ] Copy link / deep-link restore (if URL state touched)

---

## Design notes (portfolio)

- **Near-Earth view** is the honest scale for NeoWs miss distances; System view is for planets and SBDB heliocentric orbits.
- Orbits use thin paths and selection highlighting without EffectComposer black-square artifacts.
- Live Neo panel uses a **sticky pagination footer** and a **desktop right rail** shared with viz controls so chrome does not cover the 3D scene.
- Sentry is labeled as **educational** — degraded mode serves a static sample if CNEOS is down.
- Mission copy and project cards live in **`client/src/content/site.ts`** only (no hard-coded bio in the 3D layer).

---

## License & attribution

- Code: project author’s portfolio work (add a license file if you open-source).
- Planetary textures: Solar System Scope (CC BY 4.0) — see `client/public/textures/sss/` notes.
- Data: NASA NeoWs, JPL SBDB / CNEOS Sentry, DONKI, Where The ISS At — use per their respective terms.

---

## Disclaimer

ORBIT is a **visualization and learning tool**. Close-approach numbers and Sentry scores come from public feeds and may be simplified for display. Do not use this app for hazard assessment, navigation, or emergency decisions.
