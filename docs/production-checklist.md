# YPN USA production checklist

This repository is a Next.js 16 Node application, not Express. Next.js Route
Handlers provide the API layer, `next.config.ts` provides Helmet-equivalent
response headers, and route-level controls provide authentication and rate
limiting.

## Secrets and environment

- [ ] Generate `SSO_JWT_SECRET` with at least 32 random bytes and install the
      same value in the `ypnus.com` WordPress token issuer. Never expose it to
      browser JavaScript or use a `NEXT_PUBLIC_` name.
- [ ] Set `SSO_JWT_ISSUER=https://ypnus.com`.
- [ ] Set `SSO_JWT_AUDIENCE=https://app.ypnus.com`.
- [ ] Keep `SSO_JWT_MAX_TTL_SECONDS` at 300 or lower. WordPress should issue
      tokens for 60 seconds and include unique `jti`, `iat`, `exp`, `sub`, and
      the active subscriber profile under `mlo`.
- [ ] Set `SSO_ALLOWED_ORIGIN=https://ypnus.com` and
      `NEXT_PUBLIC_SITE_URL=https://app.ypnus.com`.
- [ ] Set `MLO_SESSION_TTL_SECONDS` to the approved session lifetime (the
      default is 15 minutes so cancelled entitlements age out quickly).
- [ ] Set a separate `ENTITLEMENT_SYNC_SECRET` in the app and
      `YPNUS_ENTITLEMENT_SYNC_SECRET` in WordPress so billing changes update MRR
      and revoke sessions immediately.
- [ ] Generate a separate 32+ byte `MLO_LEAD_WEBHOOK_SECRET` and configure it
      as the MLO webform's Bearer credential.
- [ ] Generate `BOOKING_TOKEN_SECRET` with 32+ random bytes. Borrower booking
      requests require a 30-minute capability bound to the completed lead and
      assigned MLO.
- [ ] Set unique `ADMIN_TOKEN`, `CRON_SECRET`, and
      `REVIEW_REQUEST_API_SECRET` values. Do not reuse any SSO/webhook secret.
- [ ] Configure `OUTREACH_WEBHOOK_URL`, Twilio, or SendGrid credentials before
      enabling real nurture delivery; otherwise delivery uses demo mode.
- [ ] Store all secrets in Hostinger environment settings, rotate them through
      a documented procedure, and ensure they are absent from logs and source.

## WordPress SSO issuer

- [ ] Install the updated Stripe/SSO WordPress plugin, place
      `[ypnus_app_login]` on the account page, and mint HS256 JWTs only after checking the current WordPress user and
      `ypnus_paid_access === "1"` at issuance time.
- [ ] Put the profile in `mlo` with `id`, `name`, `email`, `paidAccess`,
      `subscriptionTier`, `nmlsId`, and `claimedZips`.
- [ ] Generate a cryptographically random, unique `jti` per login.
- [ ] Prefer an auto-submitted HTTPS `POST` to
      `https://app.ypnus.com/api/auth/sso/callback`. Query-string tokens are
      rejected so JWTs do not enter browser history or intermediary logs.
- [ ] Do not place the shared secret or a reusable app credential in the
      browser.

## Origins, cookies, and CORS

- [ ] Allow only the exact `https://ypnus.com` origin on the SSO callback.
      Never use `Access-Control-Allow-Origin: *` with credentials.
- [ ] For a cross-origin `fetch`, use `credentials: "include"` and verify the
      response includes the exact origin plus
      `Access-Control-Allow-Credentials: true`. A top-level form/navigation does
      not require CORS.
- [ ] Confirm production session cookies use the `__Host-` prefix with
      `Secure`, `HttpOnly`, `SameSite=Lax`, and `Path=/`, with no `Domain`.
- [ ] Confirm Cloudflare and Hostinger preserve `Set-Cookie`, `Origin`,
      `X-Forwarded-For`, and HTTPS scheme information.
- [ ] Keep logout as same-origin `POST`; reject cross-site origins.

## Security middleware and abuse controls

- [ ] Keep the global `X-Content-Type-Options`, `Referrer-Policy`, and
      `Permissions-Policy` headers in `next.config.ts`. Do not add Express
      Helmet to this non-Express server.
- [ ] Add a reviewed Content Security Policy and HSTS after inventorying the
      embedded intake page, analytics, maps, and webhook integrations. A global
      `frame-ancestors 'none'` would break `/embed/intake`, so scope framing
      policy by route.
- [ ] Configure `UPSTASH_REDIS_REST_URL` and
      `UPSTASH_REDIS_REST_TOKEN`. Production requests fail closed when the
      shared limiter is configured but unavailable.
- [ ] Rate-limit SSO by IP and account identifier, and lead webhooks by trusted
      proxy IP plus credential. Configure trusted proxy behavior so clients
      cannot spoof `X-Forwarded-For`.
- [ ] Verify `/portal`, `/dashboard`, `/admin`, analytics, revenue, and
      automation routes reject unauthenticated or under-privileged requests.
- [ ] Add request body limits at Cloudflare/Hostinger and reject unsupported
      content types.

## Persistence and replay protection

- [ ] Use a durable shared database for auth sessions, consumed SSO `jti`
      values, webhook idempotency records, leads, and nurture jobs before
      horizontal scaling. The current JSON store is suitable only for one
      persistent Node process.
- [ ] Set `LOANPILOT_DATA_DIR` to a persistent writable directory and verify
      `/api/health` reports persistent storage.
- [ ] Back up the data store, encrypt it at rest, restrict filesystem
      permissions, and test `npm run store:backup` plus
      `npm run store:restore -- /absolute/path/to/snapshot.json` before launch.
- [ ] Retain consumed `jti` records at least until their JWT expiration and
      retain webhook `eventId` records for the provider retry window.

## Lead webhook and nurture

- [ ] Send `Content-Type: application/json`,
      `Authorization: Bearer <MLO_LEAD_WEBHOOK_SECRET>`, a unique `eventId`,
      a complete `mlo` object, and a complete `borrower` object.
- [ ] Send an explicit `borrower.contactConsent` boolean. Nurture outreach is
      queued only when it is `true`; never infer consent.
- [ ] Configure a scheduler to call `POST /api/automation/process` with
      `CRON_SECRET` so delayed nurture steps are delivered.
- [ ] Verify provider opt-out handling (including SMS STOP), delivery retries,
      suppression lists, and audit retention before live outreach.

## Error handling and observability

- [ ] Preserve structured API errors without returning stack traces, secrets,
      JWTs, borrower payloads, or session identifiers.
- [ ] Confirm proxy/access logs record only POST callback paths and never JWT
      request bodies.
- [ ] Send server errors and failed outreach attempts to centralized monitoring
      with request IDs, while excluding PII and credentials.
- [ ] Alert on SSO signature failures, replay attempts, webhook authorization
      failures, rate-limit spikes, persistence failures, and nurture delivery
      failures.
- [ ] Verify global error pages and every route-level `try/catch` return stable
      status codes and `Cache-Control: no-store` on auth responses.

## Release verification

- [ ] Run `npm test`, `npm run lint`, and `npm run build`.
- [ ] Test valid SSO, invalid signature, expired token, wrong issuer/audience,
      inactive subscription, repeated `jti`, session verification, and logout.
- [ ] Test webhook auth failure, malformed payload, MLO assignment,
      idempotent `eventId` replay, consent-off behavior, nurture creation, and
      delayed automation delivery.
- [ ] Confirm `app.ypnus.com` returns the app directly rather than redirecting
      to `ypnus.com`, and test the complete production flow through Cloudflare.
