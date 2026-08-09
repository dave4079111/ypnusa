# Core Web Vitals checklist

Targets: LCP under 2.5s, INP under 200ms, CLS under 0.1.

## Changes in this pass

- Serve optimized `next/image` output as AVIF first, then WebP fallback.
- Cache content-hashed Next static assets and versioned public asset buckets for one year.
- Lazy-load the borrower intake assistant with `ssr: false` so the homepage hero can render before the chat bundle hydrates.
- Keep the hero imagery CSS-only; no critical-path raster image conversion is needed.
- Use `next/font` with `display: "swap"` and only the root Geist variable font on the app shell.
- Add route loading skeletons with reserved visual space for app and analytics navigations.
- Keep the generated Open Graph image static and asset-free.

## How to verify

1. Run `npm run lint`, `npm test`, and `npm run build`.
2. Start `npm run dev`, then run Lighthouse against `http://localhost:3000`.
3. Test mobile and desktop profiles, watching LCP for the hero headline, INP for CTA/chat interactions, and CLS during initial load plus navigation to `/analytics`.

Lighthouse scores depend on the runtime and network profile, so this repo tracks build health plus measured CWV results from the deployment environment.
