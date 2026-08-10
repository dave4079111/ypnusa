<?php

define( 'ABSPATH', __DIR__ . '/wordpress/' );
define( 'DAY_IN_SECONDS', 86400 );
define( 'YPNUS_STRIPE_WEBHOOK_SECRET', 'whsec_primary_test' );
define(
	'YPNUS_STRIPE_PAYMENT_LINK_TIERS',
	array(
		'plink_starter' => 'starter',
		'plink_pro'     => 'pro',
		'plink_elite'   => 'elite',
	)
);
define(
	'YPNUS_STRIPE_PRICE_TIERS',
	array(
		'price_starter' => 'starter',
		'price_pro'     => 'pro',
		'price_elite'   => 'elite',
	)
);

$GLOBALS['ypnus_test_options']       = array();
$GLOBALS['ypnus_test_users']         = array();
$GLOBALS['ypnus_test_user_meta']     = array();
$GLOBALS['ypnus_test_notifications'] = array();
$GLOBALS['ypnus_test_next_user_id']  = 1;

function register_activation_hook() {}
function register_deactivation_hook() {}
function add_action() {}
function register_rest_route() {}
function wp_next_scheduled() {
	return false;
}
function wp_schedule_event() {}
function wp_clear_scheduled_hook() {}
function dbDelta() {}

class WP_REST_Response {
	public $data;
	public $status;

	public function __construct( $data, $status ) {
		$this->data   = $data;
		$this->status = $status;
	}
}

function current_time( $type, $gmt = false ) {
	return gmdate( 'Y-m-d H:i:s' );
}

function sanitize_text_field( $value ) {
	return trim( strip_tags( (string) $value ) );
}

function sanitize_email( $value ) {
	return filter_var( trim( (string) $value ), FILTER_SANITIZE_EMAIL );
}

function is_email( $value ) {
	return false !== filter_var( $value, FILTER_VALIDATE_EMAIL );
}

function sanitize_user( $value ) {
	return preg_replace( '/[^a-zA-Z0-9_.-]/', '', (string) $value );
}

function sanitize_key( $value ) {
	return strtolower( preg_replace( '/[^a-z0-9_-]/i', '', (string) $value ) );
}

function get_option( $key, $default = false ) {
	return array_key_exists( $key, $GLOBALS['ypnus_test_options'] )
		? $GLOBALS['ypnus_test_options'][ $key ]
		: $default;
}

function update_option( $key, $value ) {
	$GLOBALS['ypnus_test_options'][ $key ] = $value;
	return true;
}

function get_user_meta( $user_id, $key, $single = false ) {
	return isset( $GLOBALS['ypnus_test_user_meta'][ $user_id ][ $key ] )
		? $GLOBALS['ypnus_test_user_meta'][ $user_id ][ $key ]
		: '';
}

function update_user_meta( $user_id, $key, $value ) {
	$GLOBALS['ypnus_test_user_meta'][ $user_id ][ $key ] = (string) $value;
	return true;
}

function get_users( $args ) {
	$matches = array();
	foreach ( $GLOBALS['ypnus_test_users'] as $user ) {
		if (
			isset( $args['meta_key'], $args['meta_value'] )
			&& (string) get_user_meta( $user->ID, $args['meta_key'], true ) === (string) $args['meta_value']
		) {
			$matches[] = $user;
		}
	}
	return array_slice( $matches, 0, isset( $args['number'] ) ? (int) $args['number'] : null );
}

function get_user_by( $field, $value ) {
	foreach ( $GLOBALS['ypnus_test_users'] as $user ) {
		if ( 'email' === $field && $user->user_email === $value ) {
			return $user;
		}
	}
	return false;
}

function username_exists( $username ) {
	foreach ( $GLOBALS['ypnus_test_users'] as $user ) {
		if ( $user->user_login === $username ) {
			return $user->ID;
		}
	}
	return false;
}

function wp_insert_user( $data ) {
	$user_id = $GLOBALS['ypnus_test_next_user_id']++;
	$user    = (object) array(
		'ID'         => $user_id,
		'user_login' => $data['user_login'],
		'user_email' => $data['user_email'],
	);
	$GLOBALS['ypnus_test_users'][ $user_id ] = $user;
	return $user_id;
}

function wp_generate_password() {
	return 'test-generated-password';
}

function is_wp_error() {
	return false;
}

function wp_new_user_notification( $user_id ) {
	$GLOBALS['ypnus_test_notifications'][] = $user_id;
}

class FakeWpdb {
	public $prefix = 'wp_';
	public $last_error = '';
	public $query_results = array();
	public $row_results = array();
	public $deleted = array();
	public $updated = array();

	public function prepare( $query, ...$args ) {
		return $query . ' /* ' . json_encode( $args ) . ' */';
	}

	public function query( $query ) {
		return array_shift( $this->query_results );
	}

	public function get_row( $query ) {
		return array_shift( $this->row_results );
	}

	public function delete( $table, $where, $where_format = null ) {
		$this->deleted[] = array( $table, $where );
		return 1;
	}

	public function update( $table, $data, $where, $format = null, $where_format = null ) {
		$this->updated[] = array( $table, $data, $where );
		return 1;
	}

	public function get_charset_collate() {
		return 'DEFAULT CHARACTER SET utf8mb4';
	}
}

require dirname( __DIR__ ) . '/ypnus-stripe-webhook.php';

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

function signed_header( $payload, $timestamp, $secret, $extra = '' ) {
	$signature = hash_hmac( 'sha256', $timestamp . '.' . $payload, $secret );
	return "t={$timestamp},v1={$extra},v1={$signature}";
}

$payload   = '{"id":"evt_signature"}';
$timestamp = 1900000000;
$verified  = ypnus_stripe_verify_signature(
	$payload,
	signed_header( $payload, $timestamp, YPNUS_STRIPE_WEBHOOK_SECRET, str_repeat( '0', 64 ) ),
	array( YPNUS_STRIPE_WEBHOOK_SECRET ),
	$timestamp
);
assert_same( true, $verified['ok'], 'accepts any matching v1 signature during rotation' );

$stale = ypnus_stripe_verify_signature(
	$payload,
	signed_header( $payload, $timestamp, YPNUS_STRIPE_WEBHOOK_SECRET ),
	array( YPNUS_STRIPE_WEBHOOK_SECRET ),
	$timestamp + 301
);
assert_same( 'stale_signature', $stale['error'], 'rejects signatures older than 300 seconds' );

$invalid = ypnus_stripe_verify_signature(
	$payload,
	"t={$timestamp},v1=" . str_repeat( 'f', 64 ),
	array( YPNUS_STRIPE_WEBHOOK_SECRET ),
	$timestamp
);
assert_same( 'invalid_signature', $invalid['error'], 'rejects invalid signatures' );

assert_same(
	'pro',
	ypnus_stripe_resolve_checkout_tier(
		array(
			'metadata'     => array( 'ypnus_tier' => 'pro' ),
			'payment_link' => 'plink_starter',
		)
	),
	'metadata tier takes priority over payment-link mapping'
);
assert_same(
	'starter',
	ypnus_stripe_resolve_checkout_tier( array( 'payment_link' => 'plink_starter' ) ),
	'resolves a whitelisted payment-link tier'
);
assert_same(
	'',
	ypnus_stripe_resolve_checkout_tier( array( 'metadata' => array( 'ypnus_tier' => 'enterprise' ) ) ),
	'fails closed for a non-whitelisted tier'
);
assert_same(
	'elite',
	ypnus_stripe_resolve_subscription_tier(
		array(
			'items' => array(
				'data' => array(
					array( 'price' => array( 'id' => 'price_elite' ) ),
				),
			),
		)
	),
	'resolves subscription tier from a configured price ID'
);

$wpdb                = new FakeWpdb();
$wpdb->query_results = array( 1 );
assert_same( 'claimed', ypnus_stripe_claim_event( $wpdb, 'evt_new', 'checkout.session.completed' ), 'atomically claims a new event' );

$wpdb                = new FakeWpdb();
$wpdb->query_results = array( 0 );
$wpdb->row_results   = array( (object) array( 'status' => 'completed', 'updated_at' => gmdate( 'Y-m-d H:i:s' ) ) );
assert_same( 'duplicate', ypnus_stripe_claim_event( $wpdb, 'evt_done', 'checkout.session.completed' ), 'acknowledges a completed duplicate' );

$wpdb                = new FakeWpdb();
$wpdb->query_results = array( false );
assert_same( 'retry', ypnus_stripe_claim_event( $wpdb, 'evt_db', 'checkout.session.completed' ), 'retries a database lock error' );

$GLOBALS['wpdb'] = new FakeWpdb();
assert_same( true, ypnus_stripe_release_event( 'evt_failed' ), 'releases a failed event lock' );
assert_same( 'evt_failed', $GLOBALS['wpdb']->deleted[0][1]['event_id'], 'releases the correct event ID' );

$GLOBALS['wpdb']                = new FakeWpdb();
$GLOBALS['wpdb']->query_results = array( 1 );
$GLOBALS['wpdb']->row_results   = array(
	(object) array(
		'subscription_id'     => 'sub_paid',
		'customer_id'         => 'cus_paid',
		'tier'                => 'starter',
		'subscription_status' => 'active',
		'last_event_id'       => 'evt_checkout',
	),
);
$checkout = ypnus_stripe_process_checkout(
	array(
		'id'      => 'evt_checkout',
		'type'    => 'checkout.session.completed',
		'created' => $timestamp,
		'data'    => array(
			'object' => array(
				'mode'            => 'subscription',
				'payment_status'  => 'paid',
				'customer'        => 'cus_paid',
				'subscription'    => 'sub_paid',
				'payment_link'    => 'plink_starter',
				'customer_email'  => 'paid@example.com',
				'metadata'        => array(),
			),
		),
	)
);
assert_same( true, $checkout['ok'], 'provisions a paid checkout session' );
$paid_user_id = $checkout['user_id'];
assert_same( 'active', get_user_meta( $paid_user_id, 'ypnus_subscription_status', true ), 'stores active subscription status' );
assert_same( '1', get_user_meta( $paid_user_id, 'ypnus_paid_access', true ), 'grants paid access' );
assert_same( 1, count( $GLOBALS['ypnus_test_notifications'] ), 'sends one new-user notification' );

$unknown_tier = ypnus_stripe_process_checkout(
	array(
		'id'      => 'evt_unknown',
		'type'    => 'checkout.session.completed',
		'created' => $timestamp,
		'data'    => array(
			'object' => array(
				'mode'            => 'subscription',
				'payment_status'  => 'paid',
				'customer'        => 'cus_unknown',
				'subscription'    => 'sub_unknown',
				'customer_email'  => 'unknown@example.com',
				'metadata'        => array( 'ypnus_tier' => 'enterprise' ),
			),
		),
	)
);
assert_same( 'tier_unresolved', $unknown_tier['error'], 'does not provision an unknown tier' );

$GLOBALS['wpdb']                = new FakeWpdb();
$GLOBALS['wpdb']->query_results = array( 1 );
$GLOBALS['wpdb']->row_results   = array(
	(object) array(
		'subscription_id'     => 'sub_trial',
		'customer_id'         => 'cus_trial',
		'tier'                => 'pro',
		'subscription_status' => 'trialing',
		'last_event_id'       => 'evt_trial',
	),
);
$trial = ypnus_stripe_process_checkout(
	array(
		'id'      => 'evt_trial',
		'type'    => 'checkout.session.completed',
		'created' => $timestamp,
		'data'    => array(
			'object' => array(
				'mode'            => 'subscription',
				'payment_status'  => 'no_payment_required',
				'customer'        => 'cus_trial',
				'subscription'    => 'sub_trial',
				'customer_email'  => 'trial@example.com',
				'metadata'        => array(
					'ypnus_tier'     => 'pro',
					'ypnus_trialing'  => 'true',
				),
			),
		),
	)
);
assert_same( true, $trial['ok'], 'provisions an explicitly configured active trial' );
assert_same( 'trialing', get_user_meta( $trial['user_id'], 'ypnus_subscription_status', true ), 'stores trialing status' );

update_user_meta( $paid_user_id, 'ypnus_subscription_status', 'active' );
update_user_meta( $paid_user_id, 'ypnus_paid_access', '1' );
$GLOBALS['wpdb']                = new FakeWpdb();
$GLOBALS['wpdb']->query_results = array( 1 );
$GLOBALS['wpdb']->row_results   = array(
	(object) array(
		'subscription_id'     => 'sub_paid',
		'customer_id'         => 'cus_paid',
		'tier'                => 'starter',
		'subscription_status' => 'active',
		'last_event_id'       => 'evt_checkout',
	),
	(object) array(
		'subscription_id'     => 'sub_paid',
		'customer_id'         => 'cus_paid',
		'tier'                => 'starter',
		'subscription_status' => 'past_due',
		'last_event_id'       => 'evt_payment_failed',
	),
);
$payment_failed = ypnus_stripe_process_invoice(
	array(
		'id'      => 'evt_payment_failed',
		'type'    => 'invoice.payment_failed',
		'created' => $timestamp + 5,
		'data'    => array(
			'object' => array(
				'customer' => 'cus_paid',
				'parent'   => array(
					'subscription_details' => array( 'subscription' => 'sub_paid' ),
				),
			),
		),
	),
	false
);
assert_same( true, $payment_failed['ok'], 'processes invoice payment failure' );
assert_same( 'past_due', get_user_meta( $paid_user_id, 'ypnus_subscription_status', true ), 'marks failed payment past due' );
assert_same( '0', get_user_meta( $paid_user_id, 'ypnus_paid_access', true ), 'restricts paid access after payment failure' );

$GLOBALS['wpdb']                = new FakeWpdb();
$GLOBALS['wpdb']->query_results = array( 1 );
$GLOBALS['wpdb']->row_results   = array(
	(object) array(
		'subscription_id'     => 'sub_paid',
		'customer_id'         => 'cus_paid',
		'tier'                => 'starter',
		'subscription_status' => 'canceled',
		'last_event_id'       => 'evt_deleted',
	),
);
$deleted = ypnus_stripe_process_subscription(
	array(
		'id'      => 'evt_deleted',
		'type'    => 'customer.subscription.deleted',
		'created' => $timestamp + 10,
		'data'    => array(
			'object' => array(
				'id'       => 'sub_paid',
				'customer' => 'cus_paid',
				'status'   => 'canceled',
				'metadata' => array( 'ypnus_tier' => 'starter' ),
				'items'    => array( 'data' => array() ),
			),
		),
	)
);
assert_same( true, $deleted['ok'], 'processes subscription deletion' );
assert_same( 'canceled', get_user_meta( $paid_user_id, 'ypnus_subscription_status', true ), 'deactivates a canceled subscription' );
assert_same( '0', get_user_meta( $paid_user_id, 'ypnus_paid_access', true ), 'removes paid access on cancellation' );

fwrite( STDOUT, "PASS: {$assertions} assertions\n" );
