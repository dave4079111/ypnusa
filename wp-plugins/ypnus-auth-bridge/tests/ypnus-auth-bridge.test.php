<?php

define( 'ABSPATH', __DIR__ . '/wordpress/' );
define( 'YPNUS_SSO_SECRET', 'test-only-sso-secret-with-at-least-32-characters' );

$GLOBALS['ypnus_auth_logged_in'] = false;
$GLOBALS['ypnus_auth_meta']      = array(
	42 => array(
		'ypnus_tier'                => 'pro',
		'ypnus_subscription_status' => 'active',
	),
);

function add_action() {}
function add_filter() {}
function add_shortcode() {}
function untrailingslashit( $value ) {
	return rtrim( $value, '/' );
}
function admin_url( $path = '' ) {
	return 'https://ypnus.com/wp-admin/' . ltrim( $path, '/' );
}
function home_url() {
	return 'https://ypnus.com';
}
function wp_json_encode( $value ) {
	return json_encode( $value, JSON_UNESCAPED_SLASHES );
}
function get_user_meta( $user_id, $key ) {
	return isset( $GLOBALS['ypnus_auth_meta'][ $user_id ][ $key ] )
		? $GLOBALS['ypnus_auth_meta'][ $user_id ][ $key ]
		: '';
}
function sanitize_key( $value ) {
	return strtolower( preg_replace( '/[^a-z0-9_-]/i', '', (string) $value ) );
}
function wp_generate_uuid4() {
	return '11111111-2222-4333-8444-555555555555';
}
function is_user_logged_in() {
	return $GLOBALS['ypnus_auth_logged_in'];
}
function wp_login_url( $redirect ) {
	return 'https://ypnus.com/wp-login.php?redirect_to=' . rawurlencode( $redirect );
}
function shortcode_atts( $defaults, $attributes ) {
	return array_merge( $defaults, $attributes );
}
function esc_attr( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES );
}
function esc_url( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES );
}
function esc_html( $value ) {
	return htmlspecialchars( $value, ENT_QUOTES );
}
function wp_parse_url( $url, $component ) {
	return parse_url( $url, $component );
}

class WP_Error {
	private $message;

	public function __construct( $code, $message ) {
		$this->message = $message;
	}

	public function get_error_message() {
		return $this->message;
	}
}

require dirname( __DIR__ ) . '/ypnus-auth-bridge.php';

$assertions = 0;

function assert_same( $expected, $actual, $message ) {
	global $assertions;
	++$assertions;
	if ( $expected !== $actual ) {
		fwrite(
			STDERR,
			"FAIL: {$message}\nExpected: " . var_export( $expected, true ) . "\nActual: " . var_export( $actual, true ) . "\n"
		);
		exit( 1 );
	}
}

function decode_segment( $segment ) {
	$padding = strlen( $segment ) % 4;
	if ( $padding ) {
		$segment .= str_repeat( '=', 4 - $padding );
	}
	return base64_decode( strtr( $segment, '-_', '+/' ) );
}

$user = (object) array(
	'ID'           => 42,
	'user_email'   => 'mlo@example.com',
	'display_name' => 'Morgan Loan Officer',
	'roles'        => array( 'subscriber' ),
);
$token = ypnus_auth_bridge_build_handoff( $user, 1900000000 );
assert_same( true, is_string( $token ), 'builds a compact handoff token' );

$segments = explode( '.', $token );
assert_same( 3, count( $segments ), 'token has three JWT segments' );
$header  = json_decode( decode_segment( $segments[0] ), true );
$payload = json_decode( decode_segment( $segments[1] ), true );
$sig     = ypnus_auth_bridge_base64url(
	hash_hmac( 'sha256', $segments[0] . '.' . $segments[1], YPNUS_SSO_SECRET, true )
);
assert_same( 'HS256', $header['alg'], 'uses HS256' );
assert_same( $sig, $segments[2], 'signs the exact header and payload' );
assert_same( 'https://ypnus.com', $payload['iss'], 'uses the WordPress origin as issuer' );
assert_same( 'https://app.ypnus.com', $payload['aud'], 'uses the app origin as audience' );
assert_same( 'pro', $payload['tier'], 'includes the account tier' );
assert_same( 'active', $payload['subscription_status'], 'includes subscription status' );
assert_same( 90, $payload['exp'] - $payload['iat'], 'limits handoff lifetime to 90 seconds' );

$guest = ypnus_auth_bridge_cta_data();
assert_same( 'Login / Sign Up', $guest['label'], 'shows login CTA to guests' );
assert_same( true, str_contains( $guest['url'], 'wp-login.php' ), 'guest CTA starts WordPress login' );

$GLOBALS['ypnus_auth_logged_in'] = true;
$member = ypnus_auth_bridge_cta_data();
assert_same( 'Dashboard', $member['label'], 'shows dashboard CTA to signed-in MLOs' );
assert_same(
	'https://ypnus.com/wp-admin/admin-post.php?action=ypnus_app_sso',
	$member['url'],
	'dashboard CTA starts the signed handoff'
);

fwrite( STDOUT, "PASS: {$assertions} assertions\n" );
