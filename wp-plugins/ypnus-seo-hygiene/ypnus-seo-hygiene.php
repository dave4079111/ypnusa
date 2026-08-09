<?php
/**
 * Plugin Name: YPNUS SEO Hygiene
 * Description: Crawl-budget and indexation hygiene for ypnus.com — keeps Rank Math sitemaps focused on real pages, noindexes thin utility routes, and documents the app.ypnus.com split.
 * Version: 1.0.0
 * Author: YPN USA
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Keep attachments / media out of XML sitemaps.
 * Live page-sitemap.xml was emitting .jpg/.webp URLs which waste crawl budget.
 */
add_filter(
	'rank_math/sitemap/exclude_post_type',
	static function ( $exclude, $post_type ) {
		if ( in_array( $post_type, array( 'attachment', 'elementor_library' ), true ) ) {
			return true;
		}
		return $exclude;
	},
	10,
	2
);

/**
 * Do not advertise the app subdomain's giant inventory from WordPress robots.
 */
add_filter(
	'robots_txt',
	static function ( $output, $public ) {
		if ( ! $public ) {
			return $output;
		}

		$note  = "\n# YPNUS SEO Hygiene\n";
		$note .= "# Marketing host = ypnus.com (this file)\n";
		$note .= "# Product/territory host = https://app.ypnus.com/\n";
		$note .= "# Do not mirror app.ypnus.com's 70k ZIP sitemap here.\n";

		return $output . $note;
	},
	20,
	2
);

/**
 * Soft-noindex known thin or utility surfaces that should not compete with money pages.
 * Only applies when Rank Math / WP robots APIs are available.
 */
add_action(
	'wp_head',
	static function () {
		if ( is_admin() ) {
			return;
		}

		$path = wp_parse_url( home_url( add_query_arg( array() ) ), PHP_URL_PATH );
		$path = is_string( $path ) ? untrailingslashit( $path ) : '';

		$noindex_prefixes = array(
			'/site-directory',
			'/sitemap',
		);

		foreach ( $noindex_prefixes as $prefix ) {
			if ( $path === $prefix || str_starts_with( $path, $prefix . '/' ) ) {
				echo "<meta name=\"robots\" content=\"noindex,follow\" />\n";
				return;
			}
		}
	},
	1
);

/**
 * Prefer a single pricing URL in internal tooling defaults.
 */
add_filter(
	'ypnus_primary_pricing_url',
	static function () {
		return home_url( '/pricing-plans/' );
	}
);
