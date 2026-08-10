<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

### Project overview

YPN USA product app (Next.js 16 App Router) for exclusive ZIP territories + AI borrower intake.

| Host | Role |
| --- | --- |
| `https://ypnus.com` | WordPress marketing, signup, Cerebro, Rank Math |
| `https://app.ypnus.com` | Product app target for this Next.js repo |

Local demo state persists to `data/store.json`. Live ZIP availability is read from `https://ypnus.com/wp-json/ypnus/v1/zip-check/{zip}` when reachable. See `hostinger/README.md` for production Hostinger fixes.

### Running services

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run lint` | ESLint (flat config, no args needed) |
| `npm run build` | Production build (uses Turbopack) |

### Key caveats

- The project uses **Next.js 16.3.0** with React 19 and Tailwind CSS 4. Consult `node_modules/next/dist/docs/` for API guidance rather than relying on training-data assumptions.
- No `.env` file is required; the app runs fully without environment variables. `INTAKE_EXTERNAL_WEBHOOK_URL` is optional for Zapier-style integrations.
- The file-based DB at `data/store.json` is auto-created on first write. It can be deleted to reset state.
- The `package-lock.json` is the lockfile; use `npm install` (not yarn/pnpm/bun).
