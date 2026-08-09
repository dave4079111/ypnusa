<?php
/**
 * Plugin Name: YPNUS App Bridge
 * Description: Keeps ypnus.com (WordPress) and app.ypnus.com (Next.js product) separate hosts, but wires clear CTAs and homepage links between them.
 * Version: 1.0.0
 * Author: YPN USA
 * Requires at least: 6.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Canonical product URL (Next.js on Hostinger Cloud).
 * Override with: define( 'YPNUS_APP_URL', 'https://app.ypnus.com' );
 */
function ypnus_app_bridge_app_url( string $path = '/' ): string {
	$base = defined( 'YPNUS_APP_URL' ) ? YPNUS_APP_URL : 'https://app.ypnus.com';
	$base = untrailingslashit( $base );
	if ( $path === '' || $path === '/' ) {
		return $base . '/';
	}
	return $base . ( str_starts_with( $path, '/' ) ? $path : '/' . $path );
}

/**
 * Primary deep link into the live ZIP / territory product surface.
 */
function ypnus_app_bridge_territory_url(): string {
	return ypnus_app_bridge_app_url( '/#territories' );
}

/**
 * Front-page announcement bar → product app.
 */
add_action(
	'wp_body_open',
	static function () {
		if ( is_admin() || ! is_front_page() ) {
			return;
		}

		$app  = esc_url( ypnus_app_bridge_app_url( '/' ) );
		$zip  = esc_url( ypnus_app_bridge_territory_url() );
		$home = esc_url( home_url( '/' ) );

		echo '<aside class="ypnus-app-bridge-bar" role="region" aria-label="YPN USA product app">';
		echo '<div class="ypnus-app-bridge-bar__inner">';
		echo '<p class="ypnus-app-bridge-bar__copy">';
		echo '<strong>Product app is live</strong> on a separate host — check ZIP availability and claim territory without leaving the brand.';
		echo '</p>';
		echo '<div class="ypnus-app-bridge-bar__actions">';
		echo '<a class="ypnus-app-bridge-bar__btn ypnus-app-bridge-bar__btn--primary" href="' . $zip . '">Open app · check ZIP</a>';
		echo '<a class="ypnus-app-bridge-bar__btn" href="' . $app . '">app.ypnus.com</a>';
		echo '<a class="ypnus-app-bridge-bar__home" href="' . $home . '">ypnus.com home</a>';
		echo '</div></div></aside>';
	},
	5
);

/**
 * Lightweight styles for the bridge bar (front page only).
 */
add_action(
	'wp_enqueue_scripts',
	static function () {
		if ( is_admin() || ! is_front_page() ) {
			return;
		}

		$css = <<<'CSS'
.ypnus-app-bridge-bar{background:#09081b;color:#f5f3ff;border-bottom:1px solid rgba(255,255,255,.12);font-family:system-ui,-apple-system,Segoe UI,sans-serif}
.ypnus-app-bridge-bar__inner{max-width:1120px;margin:0 auto;padding:12px 18px;display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:space-between}
.ypnus-app-bridge-bar__copy{margin:0;font-size:14px;line-height:1.45;color:rgba(245,243,255,.88);max-width:46rem}
.ypnus-app-bridge-bar__copy strong{color:#fff;font-weight:700}
.ypnus-app-bridge-bar__actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.ypnus-app-bridge-bar__btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:8px 14px;font-size:13px;font-weight:600;text-decoration:none;border:1px solid rgba(255,255,255,.28);color:#fff;background:rgba(255,255,255,.06)}
.ypnus-app-bridge-bar__btn:hover{background:rgba(255,255,255,.14);color:#fff}
.ypnus-app-bridge-bar__btn--primary{background:#fbbf24;border-color:#fbbf24;color:#09081b}
.ypnus-app-bridge-bar__btn--primary:hover{filter:brightness(1.05);color:#09081b}
.ypnus-app-bridge-bar__home{font-size:12px;color:rgba(245,243,255,.55);text-decoration:underline;margin-left:4px}
@media (max-width:720px){.ypnus-app-bridge-bar__inner{padding:14px 16px}.ypnus-app-bridge-bar__actions{width:100%}.ypnus-app-bridge-bar__btn{flex:1 1 auto}}
CSS;

		wp_register_style( 'ypnus-app-bridge', false, array(), '1.0.0' );
		wp_enqueue_style( 'ypnus-app-bridge' );
		wp_add_inline_style( 'ypnus-app-bridge', $css );
	}
);

/**
 * Append a "Product app" item to primary / header nav menus sitewide.
 */
add_filter(
	'wp_nav_menu_items',
	static function ( $items, $args ) {
		$locations = array( 'primary', 'main', 'header', 'menu-1', 'top', 'primary-menu' );
		$theme_loc = isset( $args->theme_location ) ? (string) $args->theme_location : '';

		// Only inject into known header/primary locations (skip footer/utility menus).
		if ( ! in_array( $theme_loc, $locations, true ) ) {
			return $items;
		}

		// Avoid duplicates if the theme already links the app.
		if ( str_contains( (string) $items, 'app.ypnus.com' ) ) {
			return $items;
		}

		$url    = esc_url( ypnus_app_bridge_app_url( '/' ) );
		$items .= '<li class="menu-item menu-item-type-custom ypnus-app-bridge-nav">';
		$items .= '<a href="' . $url . '">Product app</a></li>';
		return $items;
	},
	20,
	2
);

/**
 * Shortcode for Elementor / classic content:
 *   [ypnus_open_app]
 *   [ypnus_open_app label="Check ZIP in the app" path="/#territories"]
 */
add_shortcode(
	'ypnus_open_app',
	static function ( $atts ) {
		$atts = shortcode_atts(
			array(
				'label' => 'Open the product app',
				'path'  => '/',
				'class' => 'ypnus-app-bridge-shortcode',
			),
			$atts,
			'ypnus_open_app'
		);

		$url = esc_url( ypnus_app_bridge_app_url( (string) $atts['path'] ) );
		$label = esc_html( (string) $atts['label'] );
		$class = esc_attr( (string) $atts['class'] );

		return '<a class="' . $class . '" href="' . $url . '" rel="noopener">' . $label . '</a>';
	}
);

/**
 * Document the host split in robots.txt (alongside SEO Hygiene if both active).
 */
add_filter(
	'robots_txt',
	static function ( $output, $public ) {
		if ( ! $public ) {
			return $output;
		}
		$note  = "\n# YPNUS App Bridge\n";
		$note .= '# Marketing homepage: ' . home_url( '/' ) . "\n";
		$note .= '# Product app: ' . ypnus_app_bridge_app_url( '/' ) . "\n";
		return $output . $note;
	},
	25,
	2
);

/**
 * Admin notice with install confirmation + copy-paste deep links.
 */
add_action(
	'admin_notices',
	static function () {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
		if ( ! $screen || $screen->id !== 'plugins' ) {
			return;
		}
		echo '<div class="notice notice-success"><p><strong>YPNUS App Bridge</strong> is active. Homepage shows a bar linking to <code>'
			. esc_html( ypnus_app_bridge_app_url( '/' ) )
			. '</code>. Shortcode: <code>[ypnus_open_app path="/#territories"]</code></p></div>';
	}
);
