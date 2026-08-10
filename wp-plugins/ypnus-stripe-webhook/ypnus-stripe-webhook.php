<?php
/**
 * Plugin Name: YPNUS Stripe Webhook
 * Description: Verifies Stripe webhooks and reconciles YPNUS WordPress account entitlements.
 * Version: 2.0.0
 * Author: YPN USA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'YPNUS_STRIPE_ALLOWED_TIERS' ) ) {
	define( 'YPNUS_STRIPE_ALLOWED_TIERS', array( 'starter', 'pro', 'elite' ) );
}
if ( ! defined( 'YPNUS_STRIPE_SIGNATURE_TOLERANCE' ) ) {
	define( 'YPNUS_STRIPE_SIGNATURE_TOLERANCE', 300 );
}
if ( ! defined( 'YPNUS_STRIPE_EVENT_STALE_SECONDS' ) ) {
	define( 'YPNUS_STRIPE_EVENT_STALE_SECONDS', 600 );
}
if ( ! defined( 'YPNUS_STRIPE_EVENT_RETENTION_DAYS' ) ) {
	define( 'YPNUS_STRIPE_EVENT_RETENTION_DAYS', 31 );
}

register_activation_hook( __FILE__, 'ypnus_stripe_activate' );
register_deactivation_hook( __FILE__, 'ypnus_stripe_deactivate' );
add_action( 'ypnus_stripe_cleanup', 'ypnus_stripe_cleanup_events' );
add_action( 'rest_api_init', 'ypnus_stripe_register_route' );
add_action( 'admin_post_ypnus_app_sso', 'ypnus_app_sso_handler' );
if ( function_exists( 'add_shortcode' ) ) {
	add_shortcode( 'ypnus_app_login', 'ypnus_app_login_shortcode' );
}

function ypnus_sso_base64url( $value ) {
	return rtrim( strtr( base64_encode( $value ), '+/', '-_' ), '=' );
}

function ypnus_sso_callback_url() {
	$url = defined( 'YPNUS_APP_SSO_CALLBACK' )
		? YPNUS_APP_SSO_CALLBACK
		: 'https://app.ypnus.com/api/auth/sso/callback';
	$url = esc_url_raw( $url );
	return 'https' === wp_parse_url( $url, PHP_URL_SCHEME ) ? $url : '';
}

function ypnus_sso_claimed_zips( $user_id ) {
	$raw = get_user_meta( $user_id, 'ypnus_claimed_zips', true );
	if ( is_string( $raw ) ) {
		$raw = preg_split( '/[\s,]+/', $raw );
	}
	if ( ! is_array( $raw ) ) {
		return array();
	}
	$zips = array();
	foreach ( $raw as $zip ) {
		$zip = preg_replace( '/\D/', '', (string) $zip );
		if ( 5 === strlen( $zip ) ) {
			$zips[ $zip ] = true;
		}
	}
	return array_keys( $zips );
}

function ypnus_app_login_shortcode() {
	if ( ! is_user_logged_in() ) {
		return sprintf(
			'<a href="%s">Sign in to YPN USA</a>',
			esc_url( wp_login_url( get_permalink() ) )
		);
	}
	$user_id = get_current_user_id();
	if ( '1' !== (string) get_user_meta( $user_id, 'ypnus_paid_access', true ) ) {
		return '<p>An active YPN USA subscription is required to open the MLO dashboard.</p>';
	}
	return sprintf(
		'<form method="post" action="%s"><input type="hidden" name="action" value="ypnus_app_sso">%s<button type="submit">Open MLO dashboard</button></form>',
		esc_url( admin_url( 'admin-post.php' ) ),
		wp_nonce_field( 'ypnus_app_sso', '_ypnus_sso_nonce', true, false )
	);
}

function ypnus_app_sso_handler() {
	if ( ! is_user_logged_in() ) {
		auth_redirect();
	}
	check_admin_referer( 'ypnus_app_sso', '_ypnus_sso_nonce' );

	$secret = defined( 'YPNUS_SSO_JWT_SECRET' ) && is_string( YPNUS_SSO_JWT_SECRET )
		? trim( YPNUS_SSO_JWT_SECRET )
		: '';
	$callback = ypnus_sso_callback_url();
	if ( strlen( $secret ) < 32 || ! $callback ) {
		wp_die( 'YPN USA app SSO is not configured.', '', array( 'response' => 503 ) );
	}

	$user       = wp_get_current_user();
	$user_id    = (int) $user->ID;
	$tier       = ypnus_stripe_allowed_tier( get_user_meta( $user_id, 'ypnus_tier', true ) );
	$status     = sanitize_key( get_user_meta( $user_id, 'ypnus_subscription_status', true ) );
	$customer   = sanitize_text_field( get_user_meta( $user_id, 'ypnus_stripe_customer_id', true ) );
	$subscriber = sanitize_text_field( get_user_meta( $user_id, 'ypnus_stripe_subscription_id', true ) );
	$has_access = '1' === (string) get_user_meta( $user_id, 'ypnus_paid_access', true );
	if (
		! $has_access
		|| ! in_array( $status, array( 'active', 'trialing' ), true )
		|| ! $tier
		|| ! $customer
		|| ! $subscriber
	) {
		wp_die( 'An active paid YPN USA subscription is required.', '', array( 'response' => 403 ) );
	}

	$issued_at = time();
	$header    = array(
		'alg' => 'HS256',
		'typ' => 'JWT',
	);
	$payload   = array(
		'iss' => 'https://ypnus.com',
		'aud' => 'https://app.ypnus.com',
		'sub' => 'wp_' . $user_id,
		'jti' => bin2hex( random_bytes( 24 ) ),
		'iat' => $issued_at,
		'nbf' => $issued_at,
		'exp' => $issued_at + 60,
		'mlo' => array(
			'id'                   => 'wp_' . $user_id,
			'name'                 => sanitize_text_field( isset( $user->display_name ) && $user->display_name ? $user->display_name : $user->user_email ),
			'email'                => sanitize_email( $user->user_email ),
			'paidAccess'           => true,
			'subscriptionStatus'   => $status,
			'subscriptionTier'     => $tier,
			'stripeCustomerId'     => $customer,
			'stripeSubscriptionId' => $subscriber,
			'isAdmin'              => current_user_can( 'manage_options' ),
			'nmlsId'               => sanitize_text_field( get_user_meta( $user_id, 'ypnus_nmls_id', true ) ),
			'company'              => sanitize_text_field( get_user_meta( $user_id, 'ypnus_company', true ) ),
			'claimedZips'          => ypnus_sso_claimed_zips( $user_id ),
		),
	);
	$segments  = array(
		ypnus_sso_base64url( wp_json_encode( $header ) ),
		ypnus_sso_base64url( wp_json_encode( $payload ) ),
	);
	$segments[] = ypnus_sso_base64url(
		hash_hmac( 'sha256', implode( '.', $segments ), $secret, true )
	);
	$token = implode( '.', $segments );

	nocache_headers();
	header( 'Referrer-Policy: no-referrer' );
	header( "Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action " . esc_url_raw( $callback ) );
	echo '<!doctype html><html><head><meta charset="utf-8"><title>Opening YPN USA</title></head><body>';
	echo '<form id="ypnus-sso" method="post" action="' . esc_url( $callback ) . '">';
	echo '<input type="hidden" name="token" value="' . esc_attr( $token ) . '">';
	echo '<noscript><button type="submit">Continue to the MLO dashboard</button></noscript></form>';
	echo '<script>document.getElementById("ypnus-sso").submit();</script></body></html>';
	exit;
}

function ypnus_stripe_monthly_billing_snapshot( $object ) {
	$items = isset( $object['items']['data'] ) && is_array( $object['items']['data'] )
		? $object['items']['data']
		: array();
	$total    = 0;
	$currency = '';
	foreach ( $items as $item ) {
		$price = isset( $item['price'] ) && is_array( $item['price'] ) ? $item['price'] : array();
		if ( ! isset( $price['unit_amount'], $price['recurring']['interval'] ) ) {
			continue;
		}
		$unit           = (int) $price['unit_amount'];
		$quantity       = isset( $item['quantity'] ) ? max( 1, (int) $item['quantity'] ) : 1;
		$interval       = sanitize_key( $price['recurring']['interval'] );
		$interval_count = isset( $price['recurring']['interval_count'] )
			? max( 1, (int) $price['recurring']['interval_count'] )
			: 1;
		$item_currency  = isset( $price['currency'] ) ? strtolower( sanitize_text_field( $price['currency'] ) ) : '';
		if ( $currency && $item_currency && $currency !== $item_currency ) {
			return array();
		}
		$currency = $currency ? $currency : $item_currency;
		if ( 'month' === $interval ) {
			$total += ( $unit * $quantity ) / $interval_count;
		} elseif ( 'year' === $interval ) {
			$total += ( $unit * $quantity ) / ( 12 * $interval_count );
		}
	}
	return $total > 0
		? array(
			'monthlyAmountCents' => (int) round( $total ),
			'currency'           => $currency ? $currency : 'usd',
		)
		: array();
}

function ypnus_sync_entitlement_to_app( $event ) {
	if ( ! defined( 'YPNUS_ENTITLEMENT_SYNC_SECRET' ) || ! is_string( YPNUS_ENTITLEMENT_SYNC_SECRET ) ) {
		return false;
	}
	$secret = trim( YPNUS_ENTITLEMENT_SYNC_SECRET );
	if ( strlen( $secret ) < 32 ) {
		return false;
	}
	$endpoint = defined( 'YPNUS_APP_ENTITLEMENT_ENDPOINT' )
		? esc_url_raw( YPNUS_APP_ENTITLEMENT_ENDPOINT )
		: 'https://app.ypnus.com/api/webhooks/entitlements';
	if ( 'https' !== wp_parse_url( $endpoint, PHP_URL_SCHEME ) ) {
		return false;
	}

	$object      = isset( $event['data']['object'] ) && is_array( $event['data']['object'] )
		? $event['data']['object']
		: array();
	$customer_id = isset( $object['customer'] ) ? sanitize_text_field( $object['customer'] ) : '';
	$user        = ypnus_stripe_find_user_by_meta( 'ypnus_stripe_customer_id', $customer_id );
	if ( ! $user ) {
		return true;
	}
	$user_id         = (int) $user->ID;
	$subscription_id = sanitize_text_field( get_user_meta( $user_id, 'ypnus_stripe_subscription_id', true ) );
	$tier            = ypnus_stripe_allowed_tier( get_user_meta( $user_id, 'ypnus_tier', true ) );
	$status          = sanitize_key( get_user_meta( $user_id, 'ypnus_subscription_status', true ) );
	if ( ! $customer_id || ! $subscription_id || ! $tier || ! $status ) {
		return false;
	}
	$billing = ypnus_stripe_monthly_billing_snapshot( $object );
	$payload = wp_json_encode(
		array(
			'eventId' => sanitize_text_field( $event['id'] ),
			'mlo'     => array_merge(
				array(
				'id'                   => 'wp_' . $user_id,
				'name'                 => sanitize_text_field( isset( $user->display_name ) && $user->display_name ? $user->display_name : $user->user_email ),
				'email'                => sanitize_email( $user->user_email ),
				'company'              => sanitize_text_field( get_user_meta( $user_id, 'ypnus_company', true ) ),
				'tier'                 => $tier,
				'status'               => $status,
				'stripeCustomerId'     => $customer_id,
				'stripeSubscriptionId' => $subscription_id,
				'claimedZips'          => ypnus_sso_claimed_zips( $user_id ),
				),
				$billing
			),
		)
	);
	$timestamp = (string) time();
	$signature = hash_hmac( 'sha256', $timestamp . '.' . $payload, $secret );
	$response  = wp_remote_post(
		$endpoint,
		array(
			'timeout' => 8,
			'headers' => array(
				'Content-Type'      => 'application/json',
				'X-YPNUS-Timestamp' => $timestamp,
				'X-YPNUS-Signature' => $signature,
			),
			'body'    => $payload,
		)
	);
	if ( is_wp_error( $response ) ) {
		return false;
	}
	$code = wp_remote_retrieve_response_code( $response );
	return $code >= 200 && $code < 300;
}

function ypnus_stripe_events_table() {
	global $wpdb;
	return $wpdb->prefix . 'ypnus_stripe_events';
}

function ypnus_stripe_lifecycle_table() {
	global $wpdb;
	return $wpdb->prefix . 'ypnus_stripe_lifecycle';
}

function ypnus_stripe_activate() {
	global $wpdb;

	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	$charset_collate = $wpdb->get_charset_collate();
	$events_table    = ypnus_stripe_events_table();
	$lifecycle_table = ypnus_stripe_lifecycle_table();

	dbDelta(
		"CREATE TABLE {$events_table} (
			event_id VARCHAR(255) NOT NULL,
			event_type VARCHAR(100) NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'processing',
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			last_error TEXT NULL,
			PRIMARY KEY  (event_id),
			KEY status_updated (status, updated_at)
		) {$charset_collate};"
	);

	dbDelta(
		"CREATE TABLE {$lifecycle_table} (
			subscription_id VARCHAR(255) NOT NULL,
			customer_id VARCHAR(255) NOT NULL,
			tier VARCHAR(20) NOT NULL DEFAULT '',
			subscription_status VARCHAR(30) NOT NULL,
			last_event_created BIGINT UNSIGNED NOT NULL DEFAULT 0,
			last_event_priority SMALLINT UNSIGNED NOT NULL DEFAULT 0,
			last_event_id VARCHAR(255) NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY  (subscription_id),
			KEY customer_id (customer_id)
		) {$charset_collate};"
	);

	if ( ! wp_next_scheduled( 'ypnus_stripe_cleanup' ) ) {
		wp_schedule_event( time(), 'daily', 'ypnus_stripe_cleanup' );
	}
}

function ypnus_stripe_deactivate() {
	wp_clear_scheduled_hook( 'ypnus_stripe_cleanup' );
}

function ypnus_stripe_cleanup_events() {
	global $wpdb;

	$events_table = ypnus_stripe_events_table();
	$completed    = gmdate( 'Y-m-d H:i:s', time() - ( YPNUS_STRIPE_EVENT_RETENTION_DAYS * DAY_IN_SECONDS ) );
	$abandoned    = gmdate( 'Y-m-d H:i:s', time() - ( 2 * YPNUS_STRIPE_EVENT_RETENTION_DAYS * DAY_IN_SECONDS ) );

	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$events_table}
			WHERE (status = 'completed' AND updated_at < %s)
			   OR (status = 'processing' AND updated_at < %s)",
			$completed,
			$abandoned
		)
	);
}

function ypnus_stripe_register_route() {
	register_rest_route(
		'ypnus/v1',
		'/stripe-webhook',
		array(
			'methods'             => 'POST',
			'callback'            => 'ypnus_stripe_webhook_handler',
			'permission_callback' => '__return_true',
		)
	);
}

function ypnus_stripe_response( $body, $status = 200 ) {
	return new WP_REST_Response( $body, $status );
}

function ypnus_stripe_webhook_secrets() {
	$secrets = array();

	if ( defined( 'YPNUS_STRIPE_WEBHOOK_SECRET' ) && is_string( YPNUS_STRIPE_WEBHOOK_SECRET ) ) {
		$secrets[] = trim( YPNUS_STRIPE_WEBHOOK_SECRET );
	}
	if ( defined( 'YPNUS_STRIPE_WEBHOOK_SECRETS' ) && is_array( YPNUS_STRIPE_WEBHOOK_SECRETS ) ) {
		foreach ( YPNUS_STRIPE_WEBHOOK_SECRETS as $secret ) {
			if ( is_string( $secret ) ) {
				$secrets[] = trim( $secret );
			}
		}
	}

	return array_values( array_unique( array_filter( $secrets ) ) );
}

function ypnus_stripe_parse_signature_header( $header ) {
	$timestamp  = null;
	$signatures = array();

	foreach ( explode( ',', (string) $header ) as $piece ) {
		$pair = explode( '=', trim( $piece ), 2 );
		if ( 2 !== count( $pair ) ) {
			continue;
		}
		$key   = trim( $pair[0] );
		$value = trim( $pair[1] );
		if ( 't' === $key ) {
			$timestamp = $value;
		} elseif ( 'v1' === $key && '' !== $value ) {
			$signatures[] = $value;
		}
	}

	if ( ! is_string( $timestamp ) || ! ctype_digit( $timestamp ) || empty( $signatures ) ) {
		return array(
			'ok'    => false,
			'error' => 'malformed_signature',
		);
	}

	return array(
		'ok'         => true,
		'timestamp'  => (int) $timestamp,
		'signatures' => $signatures,
	);
}

function ypnus_stripe_verify_signature( $payload, $header, $secrets, $now = null ) {
	$parsed = ypnus_stripe_parse_signature_header( $header );
	if ( ! $parsed['ok'] ) {
		return $parsed;
	}

	$now = null === $now ? time() : (int) $now;
	if ( abs( $now - $parsed['timestamp'] ) > YPNUS_STRIPE_SIGNATURE_TOLERANCE ) {
		return array(
			'ok'    => false,
			'error' => 'stale_signature',
		);
	}

	$signed_payload = $parsed['timestamp'] . '.' . $payload;
	foreach ( $secrets as $secret ) {
		$expected = hash_hmac( 'sha256', $signed_payload, $secret );
		foreach ( $parsed['signatures'] as $candidate ) {
			if ( hash_equals( $expected, $candidate ) ) {
				return array(
					'ok'        => true,
					'timestamp' => $parsed['timestamp'],
				);
			}
		}
	}

	return array(
		'ok'    => false,
		'error' => 'invalid_signature',
	);
}

function ypnus_stripe_allowed_tier( $tier ) {
	$tier = is_string( $tier ) ? strtolower( trim( $tier ) ) : '';
	return in_array( $tier, YPNUS_STRIPE_ALLOWED_TIERS, true ) ? $tier : '';
}

function ypnus_stripe_payment_link_map() {
	if ( defined( 'YPNUS_STRIPE_PAYMENT_LINK_TIERS' ) && is_array( YPNUS_STRIPE_PAYMENT_LINK_TIERS ) ) {
		return YPNUS_STRIPE_PAYMENT_LINK_TIERS;
	}
	$stored = get_option( 'ypnus_stripe_tier_by_payment_link', array() );
	return is_array( $stored ) ? $stored : array();
}

function ypnus_stripe_price_map() {
	if ( defined( 'YPNUS_STRIPE_PRICE_TIERS' ) && is_array( YPNUS_STRIPE_PRICE_TIERS ) ) {
		return YPNUS_STRIPE_PRICE_TIERS;
	}
	$stored = get_option( 'ypnus_stripe_tier_by_price_id', array() );
	return is_array( $stored ) ? $stored : array();
}

function ypnus_stripe_resolve_checkout_tier( $session ) {
	$metadata_tier = isset( $session['metadata']['ypnus_tier'] )
		? ypnus_stripe_allowed_tier( $session['metadata']['ypnus_tier'] )
		: '';
	if ( $metadata_tier ) {
		return $metadata_tier;
	}

	$payment_link = isset( $session['payment_link'] ) ? sanitize_text_field( $session['payment_link'] ) : '';
	$link_map     = ypnus_stripe_payment_link_map();
	return isset( $link_map[ $payment_link ] ) ? ypnus_stripe_allowed_tier( $link_map[ $payment_link ] ) : '';
}

function ypnus_stripe_resolve_subscription_tier( $subscription ) {
	$metadata_tier = isset( $subscription['metadata']['ypnus_tier'] )
		? ypnus_stripe_allowed_tier( $subscription['metadata']['ypnus_tier'] )
		: '';
	if ( $metadata_tier ) {
		return $metadata_tier;
	}

	$price_map = ypnus_stripe_price_map();
	$tiers     = array();
	$items     = isset( $subscription['items']['data'] ) && is_array( $subscription['items']['data'] )
		? $subscription['items']['data']
		: array();

	foreach ( $items as $item ) {
		$price_id = isset( $item['price']['id'] ) ? sanitize_text_field( $item['price']['id'] ) : '';
		$tier     = isset( $price_map[ $price_id ] ) ? ypnus_stripe_allowed_tier( $price_map[ $price_id ] ) : '';
		if ( $tier ) {
			$tiers[ $tier ] = true;
		}
	}

	return 1 === count( $tiers ) ? array_key_first( $tiers ) : '';
}

function ypnus_stripe_claim_event( $wpdb, $event_id, $event_type, $now = null ) {
	$table = $wpdb->prefix . 'ypnus_stripe_events';
	$now   = $now ? $now : current_time( 'mysql', true );

	$inserted = $wpdb->query(
		$wpdb->prepare(
			"INSERT IGNORE INTO {$table}
			(event_id, event_type, status, created_at, updated_at)
			VALUES (%s, %s, 'processing', %s, %s)",
			$event_id,
			$event_type,
			$now,
			$now
		)
	);
	if ( false === $inserted ) {
		return 'retry';
	}
	if ( 1 === $inserted ) {
		return 'claimed';
	}

	$row = $wpdb->get_row(
		$wpdb->prepare(
			"SELECT status, updated_at FROM {$table} WHERE event_id = %s",
			$event_id
		)
	);
	if ( ! $row ) {
		return 'retry';
	}
	if ( 'completed' === $row->status ) {
		return 'duplicate';
	}

	$updated_at = strtotime( $row->updated_at . ' UTC' );
	if ( false === $updated_at ) {
		return 'retry';
	}
	$stale_cutoff = time() - YPNUS_STRIPE_EVENT_STALE_SECONDS;
	if ( $updated_at <= $stale_cutoff ) {
		$cutoff    = gmdate( 'Y-m-d H:i:s', $stale_cutoff );
		$reclaimed = $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table}
				SET event_type = %s, status = 'processing', updated_at = %s, last_error = NULL
				WHERE event_id = %s AND status = 'processing' AND updated_at <= %s",
				$event_type,
				$now,
				$event_id,
				$cutoff
			)
		);
		if ( false === $reclaimed ) {
			return 'retry';
		}
		if ( $reclaimed > 0 ) {
			return 'claimed';
		}
	}

	return 'in_progress';
}

function ypnus_stripe_release_event( $event_id ) {
	global $wpdb;
	return false !== $wpdb->delete( ypnus_stripe_events_table(), array( 'event_id' => $event_id ), array( '%s' ) );
}

function ypnus_stripe_complete_event( $event_id ) {
	global $wpdb;
	$updated = $wpdb->update(
		ypnus_stripe_events_table(),
		array(
			'status'     => 'completed',
			'updated_at' => current_time( 'mysql', true ),
			'last_error' => null,
		),
		array( 'event_id' => $event_id ),
		array( '%s', '%s', '%s' ),
		array( '%s' )
	);
	return false !== $updated && $updated > 0;
}

function ypnus_stripe_lifecycle_priority( $status, $source ) {
	if ( 'canceled' === $status ) {
		return 100;
	}
	if ( 'past_due' === $status ) {
		return 80;
	}
	if ( 'subscription' === $source ) {
		return 60;
	}
	if ( 'invoice_paid' === $source ) {
		return 40;
	}
	return 20;
}

function ypnus_stripe_record_lifecycle( $state ) {
	global $wpdb;
	$table = ypnus_stripe_lifecycle_table();
	$now   = current_time( 'mysql', true );

	$inserted = $wpdb->query(
		$wpdb->prepare(
			"INSERT IGNORE INTO {$table}
			(subscription_id, customer_id, tier, subscription_status, last_event_created,
			 last_event_priority, last_event_id, updated_at)
			VALUES (%s, %s, %s, %s, %d, %d, %s, %s)",
			$state['subscription_id'],
			$state['customer_id'],
			$state['tier'],
			$state['status'],
			$state['event_created'],
			$state['priority'],
			$state['event_id'],
			$now
		)
	);
	if ( false === $inserted ) {
		return array( 'status' => 'retry' );
	}

	if ( 0 === $inserted ) {
		$updated = $wpdb->query(
			$wpdb->prepare(
				"UPDATE {$table}
				SET customer_id = %s,
					tier = IF(%s <> '', %s, tier),
					subscription_status = %s,
					last_event_created = %d,
					last_event_priority = %d,
					last_event_id = %s,
					updated_at = %s
				WHERE subscription_id = %s
				  AND (
					last_event_created < %d
					OR (last_event_created = %d AND last_event_priority < %d)
				  )",
				$state['customer_id'],
				$state['tier'],
				$state['tier'],
				$state['status'],
				$state['event_created'],
				$state['priority'],
				$state['event_id'],
				$now,
				$state['subscription_id'],
				$state['event_created'],
				$state['event_created'],
				$state['priority']
			)
		);
		if ( false === $updated ) {
			return array( 'status' => 'retry' );
		}
	}

	$row = $wpdb->get_row(
		$wpdb->prepare(
			"SELECT * FROM {$table} WHERE subscription_id = %s",
			$state['subscription_id']
		)
	);
	if ( ! $row ) {
		return array( 'status' => 'retry' );
	}

	return array(
		'status' => $row->last_event_id === $state['event_id'] ? 'current' : 'stale',
		'row'    => $row,
	);
}

function ypnus_stripe_subscription_state( $stripe_status ) {
	switch ( $stripe_status ) {
		case 'active':
			return 'active';
		case 'trialing':
			return 'trialing';
		case 'canceled':
		case 'incomplete_expired':
			return 'canceled';
		case 'past_due':
		case 'unpaid':
		case 'incomplete':
		case 'paused':
			return 'past_due';
		default:
			return '';
	}
}

function ypnus_stripe_extract_invoice_subscription_id( $invoice ) {
	if ( ! empty( $invoice['parent']['subscription_details']['subscription'] ) ) {
		return sanitize_text_field( $invoice['parent']['subscription_details']['subscription'] );
	}
	if ( ! empty( $invoice['subscription'] ) ) {
		return sanitize_text_field( $invoice['subscription'] );
	}
	return '';
}

function ypnus_stripe_find_user_by_meta( $key, $value ) {
	if ( '' === $value ) {
		return null;
	}
	$users = get_users(
		array(
			'meta_key'   => $key,
			'meta_value' => $value,
			'number'     => 1,
		)
	);
	return empty( $users ) ? null : $users[0];
}

function ypnus_stripe_unique_username( $email ) {
	$local = strstr( $email, '@', true );
	$local = sanitize_user( false === $local ? 'ypnususer' : $local, true );
	$local = $local ? substr( $local, 0, 38 ) : 'ypnususer';
	$base  = $local . '-' . substr( hash( 'sha256', strtolower( $email ) ), 0, 12 );
	$name  = substr( $base, 0, 60 );
	$index = 1;

	while ( username_exists( $name ) ) {
		$suffix = '-' . $index;
		$name   = substr( $base, 0, 60 - strlen( $suffix ) ) . $suffix;
		++$index;
	}
	return $name;
}

function ypnus_stripe_write_user_meta( $user_id, $values ) {
	foreach ( $values as $key => $value ) {
		update_user_meta( $user_id, $key, $value );
		if ( (string) get_user_meta( $user_id, $key, true ) !== (string) $value ) {
			return false;
		}
	}
	return true;
}

function ypnus_stripe_apply_entitlement( $user_id, $tier, $customer_id, $subscription_id, $status ) {
	$tier = ypnus_stripe_allowed_tier( $tier );
	if ( ! $tier ) {
		return false;
	}
	$has_access = in_array( $status, array( 'active', 'trialing' ), true ) ? '1' : '0';
	return ypnus_stripe_write_user_meta(
		$user_id,
		array(
			'ypnus_tier'                   => $tier,
			'ypnus_stripe_customer_id'     => $customer_id,
			'ypnus_stripe_subscription_id' => $subscription_id,
			'ypnus_subscription_status'    => $status,
			'ypnus_paid_access'             => $has_access,
		)
	);
}

function ypnus_stripe_provision_user( $email, $tier, $customer_id, $subscription_id, $status ) {
	$customer_user = ypnus_stripe_find_user_by_meta( 'ypnus_stripe_customer_id', $customer_id );
	$sub_user      = ypnus_stripe_find_user_by_meta( 'ypnus_stripe_subscription_id', $subscription_id );
	$email_user    = get_user_by( 'email', $email );

	$known_ids = array();
	foreach ( array( $customer_user, $sub_user, $email_user ) as $candidate ) {
		if ( $candidate ) {
			$known_ids[ (int) $candidate->ID ] = true;
		}
	}
	if ( count( $known_ids ) > 1 ) {
		return array(
			'ok'    => false,
			'error' => 'account_mapping_conflict',
		);
	}

	$user   = $customer_user ? $customer_user : ( $sub_user ? $sub_user : $email_user );
	$is_new = false;
	if ( $user ) {
		$stored_customer = (string) get_user_meta( $user->ID, 'ypnus_stripe_customer_id', true );
		$stored_sub      = (string) get_user_meta( $user->ID, 'ypnus_stripe_subscription_id', true );
		if ( ( $stored_customer && $stored_customer !== $customer_id ) || ( $stored_sub && $stored_sub !== $subscription_id ) ) {
			return array(
				'ok'    => false,
				'error' => 'account_mapping_conflict',
			);
		}
		$user_id = (int) $user->ID;
	} else {
		$user_id = wp_insert_user(
			array(
				'user_login' => ypnus_stripe_unique_username( $email ),
				'user_email' => $email,
				'user_pass'  => wp_generate_password( 24 ),
				'role'       => 'subscriber',
			)
		);
		if ( is_wp_error( $user_id ) ) {
			return array(
				'ok'    => false,
				'error' => 'user_create_failed',
			);
		}
		$is_new = true;
	}

	if ( ! ypnus_stripe_apply_entitlement( $user_id, $tier, $customer_id, $subscription_id, $status ) ) {
		return array(
			'ok'    => false,
			'error' => 'user_meta_write_failed',
		);
	}

	if ( $is_new && ! get_user_meta( $user_id, 'ypnus_welcome_sent', true ) ) {
		wp_new_user_notification( $user_id, null, 'user' );
		update_user_meta( $user_id, 'ypnus_welcome_sent', '1' );
	}

	return array(
		'ok'      => true,
		'user_id' => $user_id,
	);
}

function ypnus_stripe_apply_lifecycle_row( $row ) {
	$user = ypnus_stripe_find_user_by_meta( 'ypnus_stripe_customer_id', (string) $row->customer_id );
	if ( ! $user ) {
		return array(
			'ok'      => true,
			'pending' => true,
		);
	}

	$stored_sub = (string) get_user_meta( $user->ID, 'ypnus_stripe_subscription_id', true );
	if ( $stored_sub && $stored_sub !== (string) $row->subscription_id ) {
		return array(
			'ok'      => true,
			'ignored' => true,
		);
	}

	$tier = ypnus_stripe_allowed_tier( $row->tier );
	if ( ! $tier ) {
		$tier = ypnus_stripe_allowed_tier( get_user_meta( $user->ID, 'ypnus_tier', true ) );
	}
	if ( ! $tier ) {
		return array(
			'ok'    => false,
			'error' => 'tier_unresolved',
		);
	}

	$applied = ypnus_stripe_apply_entitlement(
		$user->ID,
		$tier,
		(string) $row->customer_id,
		(string) $row->subscription_id,
		(string) $row->subscription_status
	);
	return $applied ? array( 'ok' => true ) : array( 'ok' => false, 'error' => 'user_meta_write_failed' );
}

function ypnus_stripe_process_checkout( $event, $async = false ) {
	$session = isset( $event['data']['object'] ) && is_array( $event['data']['object'] )
		? $event['data']['object']
		: array();

	$payment_status = isset( $session['payment_status'] ) ? sanitize_text_field( $session['payment_status'] ) : '';
	if ( ! $async && 'unpaid' === $payment_status ) {
		return array(
			'ok'     => true,
			'action' => 'awaiting_async_payment',
		);
	}

	$trial_flag = isset( $session['metadata']['ypnus_trialing'] )
		? strtolower( (string) $session['metadata']['ypnus_trialing'] )
		: '';
	$is_trial   = 'no_payment_required' === $payment_status && in_array( $trial_flag, array( '1', 'true', 'yes' ), true );
	if ( 'paid' !== $payment_status && ! $is_trial ) {
		return array(
			'ok'    => false,
			'error' => 'payment_not_verified',
		);
	}

	$mode            = isset( $session['mode'] ) ? sanitize_text_field( $session['mode'] ) : '';
	$customer_id     = isset( $session['customer'] ) ? sanitize_text_field( $session['customer'] ) : '';
	$subscription_id = isset( $session['subscription'] ) ? sanitize_text_field( $session['subscription'] ) : '';
	$email           = '';
	if ( ! empty( $session['customer_details']['email'] ) ) {
		$email = sanitize_email( $session['customer_details']['email'] );
	} elseif ( ! empty( $session['customer_email'] ) ) {
		$email = sanitize_email( $session['customer_email'] );
	}

	if ( 'subscription' !== $mode || ! $customer_id || ! $subscription_id || ! $email || ! is_email( $email ) ) {
		return array(
			'ok'    => false,
			'error' => 'invalid_checkout_session',
		);
	}

	$tier = ypnus_stripe_resolve_checkout_tier( $session );
	if ( ! $tier ) {
		return array(
			'ok'    => false,
			'error' => 'tier_unresolved',
		);
	}

	$status    = $is_trial ? 'trialing' : 'active';
	$lifecycle = ypnus_stripe_record_lifecycle(
		array(
			'subscription_id' => $subscription_id,
			'customer_id'     => $customer_id,
			'tier'            => $tier,
			'status'          => $status,
			'event_created'   => (int) $event['created'],
			'priority'        => ypnus_stripe_lifecycle_priority( $status, 'checkout' ),
			'event_id'        => $event['id'],
		)
	);
	if ( 'retry' === $lifecycle['status'] ) {
		return array(
			'ok'    => false,
			'error' => 'lifecycle_write_failed',
		);
	}

	$current_tier   = ypnus_stripe_allowed_tier( $lifecycle['row']->tier ) ?: $tier;
	$current_status = (string) $lifecycle['row']->subscription_status;
	return ypnus_stripe_provision_user(
		$email,
		$current_tier,
		$customer_id,
		$subscription_id,
		$current_status
	);
}

function ypnus_stripe_process_subscription( $event ) {
	$subscription = isset( $event['data']['object'] ) && is_array( $event['data']['object'] )
		? $event['data']['object']
		: array();
	$customer_id  = isset( $subscription['customer'] ) ? sanitize_text_field( $subscription['customer'] ) : '';
	$sub_id       = isset( $subscription['id'] ) ? sanitize_text_field( $subscription['id'] ) : '';
	$stripe_state = 'customer.subscription.deleted' === $event['type']
		? 'canceled'
		: ( isset( $subscription['status'] ) ? sanitize_text_field( $subscription['status'] ) : '' );
	$status       = ypnus_stripe_subscription_state( $stripe_state );
	$tier         = ypnus_stripe_resolve_subscription_tier( $subscription );

	if ( ! $customer_id || ! $sub_id || ! $status ) {
		return array(
			'ok'    => false,
			'error' => 'invalid_subscription_event',
		);
	}

	$lifecycle = ypnus_stripe_record_lifecycle(
		array(
			'subscription_id' => $sub_id,
			'customer_id'     => $customer_id,
			'tier'            => $tier,
			'status'          => $status,
			'event_created'   => (int) $event['created'],
			'priority'        => ypnus_stripe_lifecycle_priority( $status, 'subscription' ),
			'event_id'        => $event['id'],
		)
	);
	if ( 'retry' === $lifecycle['status'] ) {
		return array(
			'ok'    => false,
			'error' => 'lifecycle_write_failed',
		);
	}
	if ( 'stale' === $lifecycle['status'] ) {
		return array(
			'ok'     => true,
			'action' => 'stale_event_ignored',
		);
	}
	return ypnus_stripe_apply_lifecycle_row( $lifecycle['row'] );
}

function ypnus_stripe_process_invoice( $event, $paid ) {
	$invoice = isset( $event['data']['object'] ) && is_array( $event['data']['object'] )
		? $event['data']['object']
		: array();

	$customer_id = isset( $invoice['customer'] ) ? sanitize_text_field( $invoice['customer'] ) : '';
	$sub_id      = ypnus_stripe_extract_invoice_subscription_id( $invoice );
	if ( ! $customer_id || ! $sub_id ) {
		return array(
			'ok'     => true,
			'action' => 'unrelated_invoice_ignored',
		);
	}

	global $wpdb;
	$table   = ypnus_stripe_lifecycle_table();
	$current = $wpdb->get_row(
		$wpdb->prepare(
			"SELECT * FROM {$table} WHERE subscription_id = %s",
			$sub_id
		)
	);
	if ( $current && 'canceled' === $current->subscription_status ) {
		return array(
			'ok'     => true,
			'action' => 'invoice_ignored_for_canceled_subscription',
		);
	}
	if ( $paid && ( ! $current || 'past_due' !== $current->subscription_status ) ) {
		return array(
			'ok'     => true,
			'action' => 'invoice_paid_no_recovery_needed',
		);
	}

	$tier   = $current ? ypnus_stripe_allowed_tier( $current->tier ) : '';
	$status = $paid ? 'active' : 'past_due';
	$source = $paid ? 'invoice_paid' : 'invoice_failed';

	$lifecycle = ypnus_stripe_record_lifecycle(
		array(
			'subscription_id' => $sub_id,
			'customer_id'     => $customer_id,
			'tier'            => $tier,
			'status'          => $status,
			'event_created'   => (int) $event['created'],
			'priority'        => ypnus_stripe_lifecycle_priority( $status, $source ),
			'event_id'        => $event['id'],
		)
	);
	if ( 'retry' === $lifecycle['status'] ) {
		return array(
			'ok'    => false,
			'error' => 'lifecycle_write_failed',
		);
	}
	if ( 'stale' === $lifecycle['status'] ) {
		return array(
			'ok'     => true,
			'action' => 'stale_event_ignored',
		);
	}
	return ypnus_stripe_apply_lifecycle_row( $lifecycle['row'] );
}

function ypnus_stripe_process_event( $event ) {
	switch ( $event['type'] ) {
		case 'checkout.session.completed':
			return ypnus_stripe_process_checkout( $event, false );
		case 'checkout.session.async_payment_succeeded':
			return ypnus_stripe_process_checkout( $event, true );
		case 'checkout.session.async_payment_failed':
			return array(
				'ok'     => true,
				'action' => 'async_payment_failed',
			);
		case 'customer.subscription.updated':
		case 'customer.subscription.deleted':
			return ypnus_stripe_process_subscription( $event );
		case 'invoice.payment_failed':
			return ypnus_stripe_process_invoice( $event, false );
		case 'invoice.paid':
			return ypnus_stripe_process_invoice( $event, true );
		default:
			return array(
				'ok'     => true,
				'action' => 'event_ignored',
			);
	}
}

function ypnus_stripe_log( $event, $data = array() ) {
	$log = get_option( 'ypnus_stripe_webhook_log', array() );
	$log = is_array( $log ) ? $log : array();
	array_unshift(
		$log,
		array(
			'time'  => current_time( 'mysql', true ),
			'event' => sanitize_key( $event ),
			'data'  => $data,
		)
	);
	update_option( 'ypnus_stripe_webhook_log', array_slice( $log, 0, 100 ), false );
}

function ypnus_stripe_webhook_handler( WP_REST_Request $request ) {
	$secrets = ypnus_stripe_webhook_secrets();
	if ( empty( $secrets ) ) {
		return ypnus_stripe_response( array( 'error' => 'webhook_not_configured' ), 503 );
	}

	$payload   = $request->get_body();
	$signature = $request->get_header( 'stripe_signature' );
	if ( ! is_string( $payload ) || '' === $payload ) {
		return ypnus_stripe_response( array( 'error' => 'empty_payload' ), 400 );
	}
	if ( strlen( $payload ) > 1048576 ) {
		return ypnus_stripe_response( array( 'error' => 'payload_too_large' ), 413 );
	}

	$verified = ypnus_stripe_verify_signature( $payload, $signature, $secrets );
	if ( ! $verified['ok'] ) {
		ypnus_stripe_log( $verified['error'] );
		return ypnus_stripe_response( array( 'error' => $verified['error'] ), 400 );
	}

	$event = json_decode( $payload, true );
	if (
		! is_array( $event )
		|| empty( $event['id'] )
		|| empty( $event['type'] )
		|| ! isset( $event['created'] )
		|| ! is_numeric( $event['created'] )
	) {
		return ypnus_stripe_response( array( 'error' => 'invalid_event' ), 400 );
	}

	$event_id   = sanitize_text_field( $event['id'] );
	$event_type = sanitize_text_field( $event['type'] );
	global $wpdb;
	$claim = ypnus_stripe_claim_event( $wpdb, $event_id, $event_type );

	if ( 'duplicate' === $claim ) {
		return ypnus_stripe_response(
			array(
				'received'  => true,
				'duplicate' => true,
			)
		);
	}
	if ( 'claimed' !== $claim ) {
		ypnus_stripe_log( 'event_claim_failed', array( 'event_id' => $event_id, 'claim' => $claim ) );
		return ypnus_stripe_response( array( 'error' => 'event_claim_failed' ), 500 );
	}

	try {
		$result = ypnus_stripe_process_event( $event );
	} catch ( Throwable $error ) {
		ypnus_stripe_release_event( $event_id );
		ypnus_stripe_log( 'processing_exception', array( 'event_id' => $event_id ) );
		return ypnus_stripe_response( array( 'error' => 'processing_exception' ), 500 );
	}

	if ( empty( $result['ok'] ) ) {
		ypnus_stripe_release_event( $event_id );
		ypnus_stripe_log(
			'processing_failed',
			array(
				'event_id' => $event_id,
				'reason'   => isset( $result['error'] ) ? $result['error'] : 'unknown',
			)
		);
		return ypnus_stripe_response(
			array( 'error' => isset( $result['error'] ) ? $result['error'] : 'processing_failed' ),
			500
		);
	}

	if ( ! ypnus_sync_entitlement_to_app( $event ) ) {
		ypnus_stripe_release_event( $event_id );
		ypnus_stripe_log( 'entitlement_sync_failed', array( 'event_id' => $event_id ) );
		return ypnus_stripe_response( array( 'error' => 'entitlement_sync_failed' ), 500 );
	}

	if ( ! ypnus_stripe_complete_event( $event_id ) ) {
		ypnus_stripe_release_event( $event_id );
		ypnus_stripe_log( 'completion_write_failed', array( 'event_id' => $event_id ) );
		return ypnus_stripe_response( array( 'error' => 'completion_write_failed' ), 500 );
	}

	return ypnus_stripe_response(
		array(
			'received' => true,
			'action'   => isset( $result['action'] ) ? $result['action'] : 'processed',
		)
	);
}
