# Hostinger deploy notes — ypnus.com + app.ypnus.com

## Current production shape

Keep the hosts **separate**, but **link** them so visitors can move both ways:

| Host | Role | Stack |
| --- | --- | --- |
| `https://ypnus.com` | Marketing homepage, signup, Rank Math SEO | WordPress on Hostinger |
| `https://app.ypnus.com` | Live territory / ZIP product app | Next.js on Hostinger Cloud |

### Link the marketing homepage → app

1. Upload and activate `wp-plugins/ypnus-app-bridge.zip` on **ypnus.com** (WP Admin → Plugins).
2. That plugin adds:
   - A front-page bar: **Open app · check ZIP** → `https://app.ypnus.com/#territories`
   - A **Product app** item in primary/header menus
   - Shortcode `[ypnus_open_app path="/#territories"]` for Elementor blocks
3. Optional: in Elementor, point a hero button at `https://app.ypnus.com/` (or the shortcode).

The Next app header/footer already link back to `https://ypnus.com/`.

## Critical live bugs found

1. **`app.ypnus.com/` 301 → `ypnus.com/` (Cloudflare)**  
   Confirmed via response headers (`server: cloudflare`, `Location: https://ypnus.com/`).  
   Territory pages (`/zips/90210/`, etc.) still return 200, but every CTA that points at the app homepage dies on this redirect.  
   **`.htaccess` alone cannot fix this** while the Cloudflare rule remains.

2. **~70k URLs in `app.ypnus.com/sitemap.xml`**  
   Giant programmatic city/ZIP inventory. Matches the GSC “Not indexed” spike on the brand.

3. **WordPress `page-sitemap.xml` includes media URLs**  
   Attachment/image URLs are leaking into the page sitemap via Rank Math — waste crawl budget.

## Restore app homepage (do this first)

1. **Cloudflare** → `ypnus.com` zone → Rules → Redirect Rules / Page Rules:  
   delete any rule that sends `app.ypnus.com` → `ypnus.com`.  
   Or run (with `CLOUDFLARE_API_TOKEN`):
   ```bash
   node scripts/fix-cloudflare-redirect.mjs list
   node scripts/fix-cloudflare-redirect.mjs delete
   ```
2. Upload the contents of `hostinger/app-ypnus/` into the **app.ypnus.com document root**:
   - `index.html` — working ZIP checker against `ypnus.com/wp-json/ypnus/v1/zip-check/{zip}`
   - `.htaccess` — keep the app homepage local
   - `robots.txt` — lean crawl guidance
3. Verify:
   ```bash
   curl -sI https://app.ypnus.com/ | head -5   # expect 200, not 301 to ypnus.com
   curl -s https://ypnus.com/wp-json/ypnus/v1/zip-check/90210 | head -c 200
   curl -sI https://app.ypnus.com/zips/90210/ | head -5
   ```

## WordPress SEO hygiene (ypnus.com)

Upload `wp-plugins/ypnus-seo-hygiene.zip` (or the folder) as a normal plugin and activate it:

- Excludes attachments from Rank Math sitemaps
- noindexes thin utility endpoints that should not compete for indexing
- Documents the marketing vs app host split in `robots.txt`

Then in Rank Math:

- Turn **off** “Attachments” in sitemap settings if still enabled
- Review `/markets/` and near-duplicate city LO pages; noindex or consolidate thin ones
- Keep conversion URLs: `/check-zip.html`, `/lo-signup.html`, `/pricing-plans/`

## Next.js app on Hostinger Cloud (Node.js web app)

This repo is the **product app** for `https://app.ypnus.com` on a Hostinger
**Cloud** plan (Node.js web apps). WordPress stays on `ypnus.com` for marketing/SEO.

| Setting | Value |
| --- | --- |
| Plan | Hostinger Cloud (Startup / Professional / Enterprise) |
| Application type | `next` (auto-detected) |
| Node.js | 22 |
| Build script | `build` |
| Start script | `start` (`next start -H 0.0.0.0 -p $PORT`) |
| Output directory | `.next` |
| `output` in `next.config.ts` | `standalone` |
| `NEXT_PUBLIC_SITE_URL` | `https://app.ypnus.com` |
| `NEXT_PUBLIC_MARKETING_SITE_URL` | `https://ypnus.com` |
| `YPNUS_WP_API_BASE` | `https://ypnus.com/wp-json/ypnus/v1` |
| `LOANPILOT_DATA_DIR` | `/tmp/ypnus-data` |

### Option A — hPanel GitHub deploy (recommended)
1. Remove the Cloudflare redirect (above).
2. If `app.ypnus.com` is still a static/PHP site, remove that website slot first
   (download a backup), then **Websites → Add Website → Node.js web app**.
3. Import `dave4079111/ypnusa`, set the env vars above, deploy branch `main`
   (or this PR branch for a preview).

### Option B — API archive deploy
```bash
export HOSTINGER_API_TOKEN=…   # hPanel → API
npm run deploy:hostinger:list
npm run deploy:hostinger:next          # defaults to app.ypnus.com
npm run deploy:hostinger:status
```

The script uploads a source zip (no `node_modules` / `.next`), starts the Cloud
Node.js build, and streams logs until completion. Set the env vars in hPanel
afterward and **Restart** the Node process.

### Option C — Render blueprint
[`render.yaml`](../render.yaml) still works as a Node host; point DNS for
`app.ypnus.com` at the Render service after the Cloudflare redirect is gone.
