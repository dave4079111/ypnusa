# Bugbot review rules

Treat violations of these rules as blocking errors:

1. Async handlers that execute network calls such as `fetch()` must wrap those
   calls in `try`/`catch` error boundaries. Flag unhandled network failures.
2. Image elements must reserve layout space to prevent Cumulative Layout Shift
   (CLS). Flag `<img>` elements without explicit `width` and `height`
   attributes, and Next.js image components without explicit dimensions or a
   fill layout.

The repository must pass its required lint, test, and production build checks
before merging.
