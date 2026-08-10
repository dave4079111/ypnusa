# YPNUS App Auth Bridge

This WordPress plugin gives `ypnus.com` and `app.ypnus.com` one secure login experience without
sharing WordPress authentication cookies across subdomains.

Signed-in WordPress users receive a **Dashboard** navigation CTA. Guests receive **Login / Sign
Up**. After WordPress authenticates the user, it issues a 90-second HMAC-signed, one-time handoff to
the Node application. The app exchanges it for a host-only, `HttpOnly`, `SameSite=Lax` session
cookie.

## Shared configuration

Generate one random secret of at least 32 characters. Configure the same value privately in both
places—never commit or paste it into chat.

WordPress `wp-config.php`:

```php
define( 'YPNUS_SSO_SECRET', 'REPLACE_WITH_RANDOM_SECRET' );
define( 'YPNUS_APP_URL', 'https://app.ypnus.com' );
```

Node application environment:

```text
YPNUS_SSO_SECRET=REPLACE_WITH_THE_SAME_RANDOM_SECRET
```

## Installation

1. Upload `ypnus-auth-bridge.zip` in **Plugins → Add Plugin → Upload Plugin**.
2. Activate **YPNUS App Auth Bridge**.
3. Confirm the primary navigation shows **Login / Sign Up** when logged out.
4. Sign into WordPress and confirm the CTA changes to **Dashboard**.
5. Click Dashboard and verify the browser lands on `https://app.ypnus.com/dashboard`.

The plugin automatically appends the CTA to the WordPress `primary` menu location. The shortcode
`[ypnus_app_cta]` is also available for a GeneratePress element, block, or custom menu placement.

## Security model

- WordPress credentials and cookies never leave `ypnus.com`.
- Handoff tokens expire after 90 seconds.
- The Node application validates issuer, audience, signature, lifetime, tier, and email.
- Each handoff `jti` can be exchanged only once.
- The app session cookie is host-only; production uses the `__Host-` prefix and `Secure`.
- Paid access is enabled only for Free accounts or paid tiers with `active`/`trialing` status.

## Verification

```bash
php -l wp-plugins/ypnus-auth-bridge/ypnus-auth-bridge.php
php wp-plugins/ypnus-auth-bridge/tests/ypnus-auth-bridge.test.php
npm test
npm run lint
npm run build
```
