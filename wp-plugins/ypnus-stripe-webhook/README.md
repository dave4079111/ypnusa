# YPNUS Stripe Webhook

Installable WordPress plugin for the single Stripe webhook receiver at:

`POST https://ypnus.com/wp-json/ypnus/v1/stripe-webhook`

The plugin verifies Stripe signatures against the raw request body, rejects signatures outside a
five-minute window, stores atomic event and lifecycle records, provisions WordPress subscribers,
and restricts paid access when a subscription becomes delinquent or canceled.

## Install

1. Upload `ypnus-stripe-webhook.zip` in **WordPress → Plugins → Add Plugin → Upload Plugin**.
2. Activate **YPNUS Stripe Webhook**. Activation creates:
   - `{prefix}_ypnus_stripe_events`
   - `{prefix}_ypnus_stripe_lifecycle`
3. Add configuration to `wp-config.php` above the “stop editing” comment.
4. Add the webhook endpoint in Stripe and select the events listed below.
5. Complete a sandbox Payment Link checkout before enabling the live endpoint.

## `wp-config.php`

Never paste real Stripe secrets into source control, WordPress options, or chat.

```php
define( 'YPNUS_STRIPE_WEBHOOK_SECRET', 'whsec_REPLACE_IN_WP_CONFIG' );
define( 'YPNUS_SSO_JWT_SECRET', 'REPLACE_WITH_THE_SAME_32_PLUS_BYTE_SECRET_AS_THE_APP' );
define( 'YPNUS_APP_SSO_CALLBACK', 'https://app.ypnus.com/api/auth/sso/callback' );
define( 'YPNUS_ENTITLEMENT_SYNC_SECRET', 'REPLACE_WITH_A_SEPARATE_32_PLUS_BYTE_SECRET' );
define( 'YPNUS_APP_ENTITLEMENT_ENDPOINT', 'https://app.ypnus.com/api/webhooks/entitlements' );

define(
	'YPNUS_STRIPE_PAYMENT_LINK_TIERS',
	array(
		'plink_REPLACE_STARTER' => 'starter',
		'plink_REPLACE_PRO'     => 'pro',
		'plink_REPLACE_ELITE'   => 'elite',
	)
);

define(
	'YPNUS_STRIPE_PRICE_TIERS',
	array(
		'price_REPLACE_STARTER' => 'starter',
		'price_REPLACE_PRO'     => 'pro',
		'price_REPLACE_ELITE'   => 'elite',
	)
);
```

During a Stripe signing-secret rotation, configure both secrets temporarily:

```php
define(
	'YPNUS_STRIPE_WEBHOOK_SECRETS',
	array(
		'whsec_CURRENT',
		'whsec_NEXT',
	)
);
```

Remove the retired secret after Stripe's rotation grace period.

## MLO app SSO

Place the `[ypnus_app_login]` shortcode on the authenticated account page. It
renders a nonce-protected POST button only for users whose current Stripe
entitlement has `ypnus_paid_access=1`. The handler creates a 60-second,
one-time HS256 JWT containing the current subscription and MLO profile, then
auto-posts it to `app.ypnus.com` so the token does not enter URL logs.

`YPNUS_SSO_JWT_SECRET` must exactly match the app's `SSO_JWT_SECRET`, be at
least 32 random bytes, and must not be reused as a Stripe or API credential.
Changing subscription status to anything other than `active` or `trialing`
prevents new app sessions; app sessions expire after 15 minutes by default.

Every processed Stripe lifecycle event is also signed and posted to the app's
entitlement endpoint. This updates real MRR records and immediately revokes app
sessions on delinquency or cancellation. Stripe receives a retryable HTTP 500
if this configured synchronization fails.

## Stripe metadata

Each Payment Link must include:

```text
ypnus_tier = starter | pro | elite
```

For a Payment Link that intentionally starts with no payment because of a trial, also include:

```text
ypnus_trialing = true
```

Unknown tiers, one-time payment sessions, missing customer/subscription identifiers, and unverified
payments fail closed.

## Required Stripe events

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_failed`
- `invoice.paid`

## Entitlement metadata

The plugin stores these fields on the WordPress user:

- `ypnus_tier`
- `ypnus_stripe_customer_id`
- `ypnus_stripe_subscription_id`
- `ypnus_subscription_status`
- `ypnus_paid_access` (`1` only for `active` or `trialing`)

Downstream account authorization must check `ypnus_paid_access`; the WordPress `subscriber` role
alone does not represent a paid entitlement.

## Verification

```bash
php -l wp-plugins/ypnus-stripe-webhook/ypnus-stripe-webhook.php
php wp-plugins/ypnus-stripe-webhook/tests/ypnus-stripe-webhook.test.php
```

The harness covers signature rotation, replay rejection, invalid signatures, tier resolution,
unknown-tier failure, atomic event claims, lock release, paid checkout provisioning, trial
provisioning, payment failure, cancellation, and paid-access restriction.
