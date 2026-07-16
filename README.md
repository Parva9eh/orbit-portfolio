# ORBIT

**Interactive near-Earth object (NEO) mission control** — a portfolio-grade 3D explorer that turns free NASA / CNEOS / ISS data into a cinematic, useful visualization.

Browse daily close approaches, inspect real orbital elements, compare two asteroids, track the ISS in schematic LEO, and walk through guided missions without leaving the browser.

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

The UI is a full-viewport **Mission Control** shell: 3D canvas, left mission dock, and right rail (Live NEO tools above visualization controls).

---

## Demo walkthrough

About two minutes with both servers running (`http://localhost:5173`):

1. **Briefing → Projects → Enter live system** (left dock).
2. Open **Guided tours** on the right → **Closest today**.
3. **+ Compare** a second NEO; confirm tinted orbits in the scene.
4. **Show ISS** → **Focus ISS** (Earth LEO framing).
5. Optional: **Sentry watchlist** → pick a designation (educational briefing only).
6. **Copy link** and reopen the URL — Live state should restore.

Deep links:

```
http://localhost:5173/?mode=live
http://localhost:5173/?mode=live&view=nearEarth&issFocus=1
```

Personal portfolio copy (name, email, LinkedIn, resume) lives in `client/src/content/site.ts`.

---

## Architecture

```
astro-app/
├── client/     React 19 + Vite + R3F/Three.js (Mission Control UI + scene)
├── server/     Express 5 API — NASA/CNEOS/ISS proxy, cache, mock fallback
├── shared/     Domain types + pure helpers (orbit math, format, SBDB merge)
└── scripts/    Hygiene scan + API/client smoke
```

### Data flow

1. The browser calls `/api/*` (Vite proxies to `:8000` in development).
2. The server fetches upstream feeds (NeoWs, SBDB, Sentry, DONKI, ISS) with NodeCache TTLs and inflight coalescing.
3. Shared modules normalize positions, orbit elements, and display strings.
4. `ThreeDScene` renders planets, NEOs, and ISS with System vs Near-Earth scale.

### API routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/asteroids` | Paginated NeoWs (or mock) for a `start_date` |
| `GET` | `/api/planets` | Major planets for the system view |
| `GET` | `/api/sbdb?sstr=` | JPL SBDB orbital elements |
| `GET` | `/api/iss` | Current ISS lat/lon/alt |
| `GET` | `/api/sentry` | Sentry watchlist (offline sample if upstream fails) |
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
- Free [NASA API key](https://api.nasa.gov/) (or `DEMO_KEY` with rate limits)

### 1. Server

```bash
cd server
cp .env.example .env
# Set NASA_API_KEY=your_key  (DEMO_KEY works with limits)
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

### 3. Smoke check

With both servers running, from the repo root:

```bash
bash scripts/smoke.sh
```

Optional: API-only (`SKIP_VITE=1`), or override bases with `API_BASE` / `VITE_BASE`.

### Production build (client)

```bash
cd client
npm run build
npm run preview
```

Set `VITE_API_URL` at build time if the SPA is not served from the same host as the API.

---

## Deploy

| Piece | Guidance |
| --- | --- |
| **API** | Node 20+ with `NASA_API_KEY`, `PORT`, and production `CORS_ORIGIN` |
| **SPA** | Host `client/dist` as static files |
| **Same origin** | Proxy `/api` and `/health` to Express; leave `VITE_API_URL` unset so the client uses `/api` |
| **Split origin** | Build with `VITE_API_URL=https://api.example.com/api`; set `CORS_ORIGIN` to the SPA origin |
| **Health** | Point load balancers at `GET /health` |

Example production server env:

```bash
NASA_API_KEY=your_key
PORT=8000
HOST=0.0.0.0
NODE_ENV=production
CORS_ORIGIN=https://your-spa.example
```

Before a public deploy: use a real NASA key (rotate if it was ever shared), lock CORS, serve HTTPS, and re-run hygiene + smoke against the target stack.

---

## Configuration

### Server

| Variable | Default | Notes |
| --- | --- | --- |
| `NASA_API_KEY` | — | Live NeoWs + DONKI; mock NEOs if missing |
| `PORT` | `8000` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address |
| `CORS_ORIGIN` | *(unset = allow all)* | Comma-separated origins for public deploys |
| `NODE_ENV` | — | Warns if production + open CORS |

### Client

| Variable | Notes |
| --- | --- |
| `VITE_API_URL` | Absolute API base including `/api` (e.g. `https://api.example.com/api`). Dev default: `http://localhost:8000/api` |

---

## Security

Read-only proxy for public science APIs:

- `NASA_API_KEY` stays on the server — never sent to the browser
- `.env` is gitignored; only `.env.example` is committed
- Designation / SBDB queries validated (charset + length)
- Pagination and date params bounded
- JSON body limit `32kb`; API is GET-oriented
- Production CORS allowlist via `CORS_ORIGIN`
- `X-Powered-By` disabled; generic 500 responses
- Upstream hosts are fixed (no user-controlled fetch URLs)

```bash
bash scripts/hygiene-check.sh
```

---

## Scripts

| Where | Command | Purpose |
| --- | --- | --- |
| `client` | `npm run dev` | Vite HMR |
| `client` | `npm run typecheck` | TypeScript check |
| `client` | `npm run build` | Typecheck + production bundle |
| `server` | `npm run dev` | API with reload |
| `server` | `npm run typecheck` | TypeScript check |
| root | `bash scripts/hygiene-check.sh` | Ignore rules + secret scan |
| root | `bash scripts/smoke.sh` | API + Vite smoke (servers up) |

### Live QA (for UI changes)

When changing the scene, mission model, Live Neo panel, or data hooks:

1. Live list loads and selecting a NEO shows the inspector (SBDB may be soft-fallback).
2. Compare A/B draws two orbits.
3. ISS show + focus behave as labeled.
4. Sentry pick shows educational briefing (not raw HTTP error text).
5. Ruler or a guided tour works.
6. Copy link restores Live state when reopened.

---

## Design notes

- **Near-Earth** is the honest scale for NeoWs miss distances; **System** is for planets and SBDB heliocentric orbits.
- Thin orbit paths and selection highlights avoid full-screen postprocessing artifacts on the sun.
- Live Neo uses a sticky pagination footer and a desktop right rail so chrome does not cover the 3D scene.
- Sentry is educational only; degraded mode can serve a static sample if CNEOS is down.
- Portfolio bio and project cards are centralized in `client/src/content/site.ts`.

---

## Attribution

- Planetary textures: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0), under `client/public/textures/sss/`
- Data: NASA NeoWs, JPL SBDB / CNEOS Sentry, DONKI, Where The ISS At — use per their terms
- Code: portfolio work by the project author

---

## Disclaimer

ORBIT is a **visualization and learning tool**. Close-approach numbers and Sentry scores come from public feeds and may be simplified for display. Do not use this app for hazard assessment, navigation, or emergency decisions.
