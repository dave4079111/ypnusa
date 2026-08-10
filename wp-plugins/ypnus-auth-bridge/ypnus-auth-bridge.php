<?php
/**
 * Plugin Name: YPNUS App Auth Bridge
 * Description: Adds a dynamic MLO dashboard CTA and securely signs users into app.ypnus.com.
 * Version: 1.0.0
 * Author: YPN USA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'YPNUS_APP_URL' ) ) {
	define( 'YPNUS_APP_URL', 'https://app.ypnus.com' );
}
if ( ! defined( 'YPNUS_SSO_TOKEN_TTL' ) ) {
	define( 'YPNUS_SSO_TOKEN_TTL', 90 );
}

add_action( 'admin_post_ypnus_app_sso', 'ypnus_auth_bridge_redirect' );
add_action( 'admin_post_nopriv_ypnus_app_sso', 'ypnus_auth_bridge_login' );
add_filter( 'allowed_redirect_hosts', 'ypnus_auth_bridge_allowed_hosts' );
add_filter( 'wp_nav_menu_items', 'ypnus_auth_bridge_nav_cta', 20, 2 );
add_shortcode( 'ypnus_app_cta', 'ypnus_auth_bridge_shortcode' );

function ypnus_auth_bridge_secret() {
	if ( ! defined( 'YPNUS_SSO_SECRET' ) || ! is_string( YPNUS_SSO_SECRET ) ) {
		return '';
	}
	$secret = trim( YPNUS_SSO_SECRET );
	return strlen( $secret ) >= 32 ? $secret : '';
}

function ypnus_auth_bridge_app_url( $path = '/' ) {
	$base = untrailingslashit( YPNUS_APP_URL );
	if ( '/' === $path || '' === $path ) {
		return $base;
	}
	return $base . '/' . ltrim( $path, '/' );
}

function ypnus_auth_bridge_sso_url() {
	return admin_url( 'admin-post.php?action=ypnus_app_sso' );
}

function ypnus_auth_bridge_allowed_hosts( $hosts ) {
	$host = wp_parse_url( YPNUS_APP_URL, PHP_URL_HOST );
	if ( is_string( $host ) && $host ) {
		$hosts[] = $host;
	}
	return array_values( array_unique( $hosts ) );
}

function ypnus_auth_bridge_base64url( $value ) {
	return rtrim( strtr( base64_encode( $value ), '+/', '-_' ), '=' );
}

function ypnus_auth_bridge_issue_token( $claims, $secret ) {
	$header  = ypnus_auth_bridge_base64url(
		wp_json_encode(
			array(
				'alg' => 'HS256',
				'typ' => 'JWT',
			)
		)
	);
	$payload = ypnus_auth_bridge_base64url( wp_json_encode( $claims ) );
	$input   = $header . '.' . $payload;
	$sig     = ypnus_auth_bridge_base64url( hash_hmac( 'sha256', $input, $secret, true ) );
	return $input . '.' . $sig;
}

function ypnus_auth_bridge_tier( $user_id ) {
	$tier = strtolower( (string) get_user_meta( $user_id, 'ypnus_tier', true ) );
	return in_array( $tier, array( 'free', 'starter', 'pro', 'elite' ), true ) ? $tier : 'free';
}

function ypnus_auth_bridge_subscription_status( $user_id, $tier ) {
	$status = sanitize_key( get_user_meta( $user_id, 'ypnus_subscription_status', true ) );
	if ( $status ) {
		return $status;
	}
	return 'free' === $tier ? 'free' : 'inactive';
}

function ypnus_auth_bridge_build_handoff( $user, $now = null ) {
	$secret = ypnus_auth_bridge_secret();
	if ( ! $secret ) {
		return new WP_Error(
			'ypnus_sso_not_configured',
			'YPNUS_SSO_SECRET must be configured in wp-config.php with at least 32 characters.'
		);
	}

	$now    = null === $now ? time() : (int) $now;
	$tier   = ypnus_auth_bridge_tier( $user->ID );
	$claims = array(
		'token_use'          => 'wp_sso',
		'iss'                => untrailingslashit( home_url() ),
		'aud'                => untrailingslashit( YPNUS_APP_URL ),
		'sub'                => (string) $user->ID,
		'email'              => strtolower( (string) $user->user_email ),
		'name'               => (string) $user->display_name,
		'tier'               => $tier,
		'subscription_status' => ypnus_auth_bridge_subscription_status( $user->ID, $tier ),
		'roles'              => array_values( array_map( 'sanitize_key', (array) $user->roles ) ),
		'jti'                => wp_generate_uuid4(),
		'iat'                => $now,
		'exp'                => $now + YPNUS_SSO_TOKEN_TTL,
	);

	return ypnus_auth_bridge_issue_token( $claims, $secret );
}

function ypnus_auth_bridge_login() {
	wp_safe_redirect( wp_login_url( ypnus_auth_bridge_sso_url() ) );
	exit;
}

function ypnus_auth_bridge_redirect() {
	if ( ! is_user_logged_in() ) {
		ypnus_auth_bridge_login();
	}

	$user  = wp_get_current_user();
	$token = ypnus_auth_bridge_build_handoff( $user );
	if ( is_wp_error( $token ) ) {
		wp_die(
			esc_html( $token->get_error_message() ),
			'YPNUS secure sign-in is not configured',
			array( 'response' => 503 )
		);
	}

	$destination = add_query_arg(
		array( 'token' => $token ),
		ypnus_auth_bridge_app_url( '/auth/callback' )
	);
	wp_safe_redirect( $destination );
	exit;
}

function ypnus_auth_bridge_cta_data() {
	if ( is_user_logged_in() ) {
		return array(
			'url'   => ypnus_auth_bridge_sso_url(),
			'label' => 'Dashboard',
			'class' => 'ypnus-dashboard-cta',
		);
	}
	return array(
		'url'   => wp_login_url( ypnus_auth_bridge_sso_url() ),
		'label' => 'Login / Sign Up',
		'class' => 'ypnus-login-cta',
	);
}

function ypnus_auth_bridge_nav_cta( $items, $args ) {
	if ( ! isset( $args->theme_location ) || 'primary' !== $args->theme_location ) {
		return $items;
	}
	$cta = ypnus_auth_bridge_cta_data();
	return $items . sprintf(
		'<li class="menu-item %1$s"><a href="%2$s">%3$s</a></li>',
		esc_attr( $cta['class'] ),
		esc_url( $cta['url'] ),
		esc_html( $cta['label'] )
	);
}

function ypnus_auth_bridge_shortcode( $attributes ) {
	$attributes = shortcode_atts(
		array( 'class' => 'ypnus-app-cta' ),
		$attributes,
		'ypnus_app_cta'
	);
	$cta        = ypnus_auth_bridge_cta_data();
	return sprintf(
		'<a class="%1$s %2$s" href="%3$s">%4$s</a>',
		esc_attr( $attributes['class'] ),
		esc_attr( $cta['class'] ),
		esc_url( $cta['url'] ),
		esc_html( $cta['label'] )
	);
}
