# YPN USA App (`app.ypnus.com`)

Product app for mortgage loan officers (MLOs): exclusive ZIP-code territories and an
always-on AI agent that captures, qualifies, routes, and nurtures every borrower.

| Host | Role |
| --- | --- |
| [`ypnus.com`](https://ypnus.com) | WordPress marketing, LO signup, Cerebro, SEO content |
| [`app.ypnus.com`](https://app.ypnus.com) | **This Next.js app** (territory checker, intake demo, analytics) |

Built with **Next.js 16 (App Router, Turbopack)**, **React 19**, and **Tailwind CSS v4**.

Hostinger restore files for the currently-broken app homepage live in [`hostinger/`](./hostinger/).

## What's inside

**Marketing site (`/`)** — a full conversion-focused landing page:
- Hero with a live **ZIP territory availability checker** (real scarcity → real reason to subscribe)
- Autonomous-agent capabilities + a 3-step "ZIP code → pipeline" explainer
- **Exclusive territory** reservation flow (checks availability, then captures the officer)
- **Ownership / portability** section — keep your leads and site if you switch brokerages
- **Predictive life-event intelligence** (probate / divorce / marriage signals)
- An interactive **mortgage payment calculator**
- Freemium **pricing** (Free → Pro MLO → Brokerage), FAQ, and CTAs

**Working product demo:**
- `/embed/intake` — the borrower intake assistant in an iframe-friendly surface (embed on any MLO site)
- The same assistant runs inline in the homepage "Live demo" section

**Backend (App Router route handlers):**
- `POST /api/intake/tick` — conversational intake engine (adaptive FHA/VA/DSCR/HELOC/REFI/JUMBO flows, scoring, CRM mirroring, officer routing, nurture scheduling)
- `GET  /api/territory/check?zip=NNNNN` — ZIP territory availability
- `POST /api/demo-request` — officer territory reservation / waitlist capture
- `GET  /api/calendar/slots`, `POST /api/calendar/book` — consultation booking
- `POST /api/automation/process` — processes due nurture follow-ups
- `GET  /api/analytics/summary` — intake telemetry (also rendered at `/analytics`)

## Getting started

```bash
npm install
cp .env.example .env.local   # optional; sensible defaults work out of the box
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build
npm run start
```

## Configuration

All environment variables are optional — see `.env.example`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Product app URL for SEO/canonical/sitemap. Defaults to `https://app.ypnus.com`. |
| `NEXT_PUBLIC_MARKETING_SITE_URL` | WordPress marketing host. Defaults to `https://ypnus.com`. |
| `YPNUS_WP_API_BASE` | Live territory/signup REST base. Defaults to `https://ypnus.com/wp-json/ypnus/v1`. |
| `LOANPILOT_DATA_DIR` | Directory for the JSON data snapshot. Defaults to `./data`. Point at a writable path (e.g. `/tmp/ypnus`) on read-only hosts. |
| `INTAKE_EXTERNAL_WEBHOOK_URL` | If set, completed intakes are POSTed here (Zapier/CRM). |
| `LOANPILOT_DEMO_MODE` / `LOANPILOT_DEMO_DAY_MINUTES` | Compress the multi-day nurture ladder for live demos. |

## Data & persistence

State (sessions, leads, CRM notes, territory reservations, analytics) is held in an
**in-memory store** that is hydrated from and written through to a JSON snapshot on a
best-effort basis. This means:

- **Persistent Node host** (`next start` on Hostinger Cloud, a VPS, Docker, Render) → the
  JSON snapshot survives restarts. This is the supported production path.
- For durable multi-instance production data, swap the storage layer in `src/lib/db.ts` for
  a database (Supabase, Postgres, etc.); a starter schema is in `supabase-leads-schema.sql`.

## Deploy

### Hostinger Cloud (recommended)
Production shape: WordPress marketing on `ypnus.com`, this Next.js product app on
`app.ypnus.com` as a Hostinger **Cloud Node.js web app**. Full checklist:
[`hostinger/README.md`](./hostinger/README.md).

```bash
export HOSTINGER_API_TOKEN=…   # hPanel → API
npm run deploy:hostinger:list
npm run deploy:hostinger:next  # builds on app.ypnus.com
```

Or in hPanel: **Websites → Add Website → Node.js web app → Import GitHub**
(`dave4079111/ypnusa`). Set `NEXT_PUBLIC_SITE_URL=https://app.ypnus.com` and the
other vars from `.env.example`. Remove the Cloudflare redirect that currently
sends `app.ypnus.com/` → `ypnus.com/` first.

### Render
A [`render.yaml`](./render.yaml) blueprint is included for a persistent Node host:
1. At [dashboard.render.com](https://dashboard.render.com): **New +  → Blueprint**.
2. Connect the `dave4079111/ypnusa` repo and click **Apply**.
3. Set `NEXT_PUBLIC_SITE_URL` in the service's Environment tab.

### Any Node host (VPS / Docker)
```bash
npm ci
npm run build
NEXT_PUBLIC_SITE_URL=https://your-domain npm run start   # honors $PORT
```
Put it behind a reverse proxy (nginx/Caddy) and process manager (PM2/systemd). The default
`./data` directory is writable here, so lead data persists across restarts.

## Project layout

```text
src/
  app/                     App Router pages, API routes, sitemap.ts, robots.ts
    page.tsx               Marketing homepage
    analytics/             Intake telemetry dashboard
    embed/intake/          Iframe-friendly borrower assistant
    api/                   Route handlers (intake, territory, demo-request, calendar, …)
  components/              Marketing sections, territory checker, calculator, chat assistant
  lib/                     Intake engine, qualification, CRM, automation, territory, storage
```
