# Hostinger deploy notes — ypnus.com + app.ypnus.com

## Current production shape

| Host | Role | Stack |
| --- | --- | --- |
| `https://ypnus.com` | Marketing, signup, Cerebro, Rank Math SEO | WordPress on Hostinger |
| `https://app.ypnus.com` | Territory product / ZIP inventory | Static HTML (+ WP REST for lock ledger) |

## Critical live bugs found

1. **`app.ypnus.com/` 301 → `ypnus.com/`**  
   Territory pages (`/zips/`, `/cities/`, `/states/`, `/territories/`) still return 200, but every CTA that points to `/#zip-check` dies on the homepage redirect.

2. **~70k URLs in `app.ypnus.com/sitemap.xml`**  
   Giant programmatic city/ZIP inventory. Matches the GSC “Not indexed” spike on the brand.

3. **WordPress `page-sitemap.xml` includes media URLs**  
   Attachment/image URLs are leaking into the page sitemap via Rank Math — waste crawl budget.

## Restore app homepage (do this first)

1. In Hostinger / Cloudflare, **delete** any redirect rule that sends `app.ypnus.com` → `ypnus.com`.
2. Upload the contents of `hostinger/app-ypnus/` into the **app.ypnus.com document root**:
   - `index.html` — working ZIP checker against `ypnus.com/wp-json/ypnus/v1/zip-check/{zip}`
   - `.htaccess` — stop homepage bounce
   - `robots.txt` — lean crawl guidance
3. Verify:
   - `https://app.ypnus.com/` returns **200** (not 301)
   - ZIP check for `90210` / an open ZIP works
   - `https://app.ypnus.com/zips/90210/` still works

## WordPress SEO hygiene (ypnus.com)

Install / upload `wp-plugins/ypnus-seo-hygiene` as a must-use or normal plugin:

- Excludes attachments from Rank Math sitemaps
- noindexes thin utility endpoints that should not compete for indexing
- Adds clearer canonical guidance for conversion HTML tools

Then in Rank Math:

- Turn **off** “Attachments” in sitemap settings if still enabled
- Review `/markets/` and near-duplicate city LO pages; noindex or consolidate thin ones
- Keep conversion URLs: `/check-zip.html`, `/lo-signup.html`, `/pricing-plans/`

## Next.js app in this repo

The Next.js app is configured as the **product app** for `https://app.ypnus.com`:

- `NEXT_PUBLIC_SITE_URL=https://app.ypnus.com`
- Live territory checks via `YPNUS_WP_API_BASE`
- Small sitemap only (no 40k ZIP regeneration)
- Pricing aligned to Free / $29.99 / $99.99 / $299.99

Deploy it (Render/Node) behind `app.ypnus.com` when you are ready to replace the static territory site — or keep static territory pages and put Next on a path/subdomain later.
