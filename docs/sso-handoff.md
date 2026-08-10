# SSO handoff: ypnus.com → app.ypnus.com

## Architecture

`ypnus.com` (WordPress) is the public marketing and MLO lead-capture site. It should not
issue or hold its own dashboard session — `app.ypnus.com` (this repo) is the only host
that sets or reads the app's session cookie (`ypnus_session`, host-only, `httpOnly`,
never shared with `ypnus.com` via a cookie `domain`).

WordPress remains the identity source (its existing `ypnus/v1` login / signup / password
reset / MLO account creation endpoints keep doing credential verification). What moves is
the *session*: after WordPress verifies who someone is, it redirects the browser to
app.ypnus.com's SSO callback instead of setting its own logged-in state.

```
Browser → ypnus.com/wp-json/ypnus/v1/login (verify credentials)
        → 302 to https://app.ypnus.com/api/auth/callback?...&sig=...
        → app.ypnus.com verifies the signature, mints ypnus_session, 302 to /dashboard
```

## Contract WordPress must implement

After a successful login, signup, or MLO account creation, redirect the browser to:

```
GET https://app.ypnus.com/api/auth/callback
  ?email=<user email, urlencoded>
  &sub=<stable WordPress user id>
  &role=mlo|admin
  &iat=<unix seconds when the token was issued>
  &next=<optional relative path into the app, defaults to /dashboard>
  &sig=<base64url HMAC-SHA256, see below>
```

`sig` is computed over the pipe-joined string `email|sub|role|iat|next` (using the
`next` value that was actually sent, `/dashboard` included if omitted) with a secret
shared between both hosts:

```php
$message = implode('|', [$email, $sub, $role, $iat, $next]);
$sig = rtrim(strtr(base64_encode(hash_hmac('sha256', $message, $shared_secret, true)), '+/', '-_'), '=');
```

The token is valid for 5 minutes from `iat` — treat it as a one-time redirect, not a
durable credential.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `YPNUS_SSO_SHARED_SECRET` | Both hosts | HMAC secret for the handoff. Until this is set on app.ypnus.com, `/api/auth/callback` refuses every handoff (fails closed — there is no insecure fallback). |
| `SESSION_SECRET` | app.ypnus.com | Signs the `ypnus_session` cookie. If unset, a random per-process secret is used (fine for local dev; sessions won't survive a restart or work across multiple instances, so set this explicitly in production). |

## What's already built on app.ypnus.com

- `src/lib/session.ts` — signed session token (HMAC-SHA256, host-only cookie).
- `src/lib/auth.ts` — `createSession` / `destroySession` / `getSession` (server-only).
- `src/lib/sso.ts` — verifies the handoff token described above.
- `src/proxy.ts` — optimistic gate on `/dashboard`, `/portal`, `/analytics`, `/admin`;
  redirects unauthenticated visitors to `/login`.
- `GET /api/auth/callback` — the SSO callback.
- `POST /api/auth/logout`, `GET /api/auth/session`.
- `POST /api/auth/dev-login` — local-dev-only session issuer (404s when
  `NODE_ENV=production`) so the dashboard gate can be exercised with `npm run dev`
  without a live WordPress handoff.

## Billing

Stripe billing/entitlement is handled entirely by `ypnus.com`'s `ypnus-stripe-webhook`
plugin (see `hostinger/README.md`) — it is not part of this handoff. If a dashboard
feature on app.ypnus.com ever needs to know a user's paid tier, the intended path is to
add `tier` / `subscription_status` as extra claims on the SSO handoff above (signed the
same way), not a second Stripe webhook on this app.

## Not yet done (needs a live WordPress change)

The WordPress side (`ypnus-mlo-toolkit` plugin, which currently registers
`/wp-json/ypnus/v1/login`, `/request-reset`, `/reset-password`, `/profile`,
`/create-mlo`) has not been changed. It still owns credential verification; it does not
yet redirect into the callback above. Wiring that redirect is a production change to a
live, active plugin and should happen as its own reviewed step once `YPNUS_SSO_SHARED_SECRET`
is set on both hosts.
