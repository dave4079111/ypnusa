<?php
/**
 * Plugin Name: YPNUS Page Fixes (One-Time)
 * Description: Fixes CTAs on Home, About, Platform, Features, and Marketing Automation pages. Deactivate and delete after running.
 * Version:     1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'admin_init', 'ypnus_run_page_fixes' );

function ypnus_run_page_fixes(): void {
    if ( get_option( 'ypnus_page_fixes_done' ) ) return;

    $demo_url    = 'https://ypnus.com/mlo-site-demo/';
    $pricing_url = 'https://ypnus.com/pricing/';

    $fixes = [

        // ── 1. HOMEPAGE (ID 1829) ─────────────────────────────────────────────
        // Fix hero primary CTA: lo-signup.html → /mlo-site-demo/
        // Fix hero ghost CTA: /how-it-works/ → /pricing/
        1829 => [
            [
                'old' => 'href="https://ypnus.com/lo-signup.html"',
                'new' => 'href="' . $demo_url . '"',
            ],
            [
                'old' => '>Start Free &mdash; No Credit Card</a>',
                'new' => '>&#9654; See My Free Site Preview</a>',
            ],
            [
                'old' => 'href="https://ypnus.com/how-it-works/"',
                'new' => 'href="' . $pricing_url . '"',
            ],
            [
                'old' => '>See How It Works</a>',
                'new' => '>View Plans &amp; Pricing</a>',
            ],
        ],

        // ── 2. ABOUT (ID 1835) ───────────────────────────────────────────────
        // Append a demo CTA section at the end of the About page content
        1835 => 'append_demo_cta',

        // ── 3. PLATFORM (ID 1836) ────────────────────────────────────────────
        // Already has demo button added in session. Fix pricing-plans → pricing.
        1836 => [
            [
                'old' => 'href="/pricing-plans/"',
                'new' => 'href="/pricing/"',
                'all' => true,
            ],
        ],

        // ── 4. FEATURES (ID 1474) ────────────────────────────────────────────
        // Fix pricing-plans → pricing
        1474 => [
            [
                'old' => 'href="https://ypnus.com/pricing-plans/"',
                'new' => 'href="' . $pricing_url . '"',
                'all' => true,
            ],
            [
                'old' => 'href="/pricing-plans/"',
                'new' => 'href="/pricing/"',
                'all' => true,
            ],
        ],

        // ── 5. MARKETING AUTOMATION (ID 2393) ────────────────────────────────
        // Append a demo CTA section at the end
        2393 => 'append_demo_cta',
    ];

    $demo_cta_html = '
<!-- wp:html -->
<div style="margin:48px 0 16px;background:linear-gradient(135deg,#0D1B3E 0%,#1565C0 100%);border-radius:16px;padding:40px 36px;text-align:center;color:#fff;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;">
  <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin:0 0 10px;">FREE — No Account Required</p>
  <h3 style="font-size:clamp(20px,3.5vw,28px);font-weight:800;margin:0 0 12px;line-height:1.2;">See Your MLO Website Plan in 30 Seconds</h3>
  <p style="font-size:15px;opacity:.88;max-width:520px;margin:0 auto 24px;line-height:1.6;">Enter your market and loan niche. The AI builds a personalized page map, keyword list, and sample outline — instantly.</p>
  <a href="' . $demo_url . '" style="display:inline-block;background:#fff;color:#1565C0;font-size:16px;font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;box-shadow:0 4px 16px rgba(0,0,0,.2);">&#9654; Build My Free Site Preview</a>
  <p style="font-size:12px;opacity:.65;margin:10px 0 0;">No email. No credit card. Just your personalized plan.</p>
</div>
<!-- /wp:html -->';

    foreach ( $fixes as $post_id => $fix ) {
        $post = get_post( $post_id );
        if ( ! $post ) continue;

        $content = $post->post_content;

        if ( $fix === 'append_demo_cta' ) {
            // Only append if not already there
            if ( ! str_contains( $content, 'mlo-site-demo' ) ) {
                $content .= "\n" . $demo_cta_html;
            }
        } elseif ( is_array( $fix ) ) {
            foreach ( $fix as $pair ) {
                $replace_all = $pair['all'] ?? false;
                if ( $replace_all ) {
                    $content = str_replace( $pair['old'], $pair['new'], $content );
                } else {
                    // Replace first occurrence only
                    $pos = strpos( $content, $pair['old'] );
                    if ( $pos !== false ) {
                        $content = substr_replace( $content, $pair['new'], $pos, strlen( $pair['old'] ) );
                    }
                }
            }
        }

        wp_update_post( [
            'ID'           => $post_id,
            'post_content' => $content,
        ] );
    }

    // Mark as done so this never runs twice
    update_option( 'ypnus_page_fixes_done', '2.5.2', false );
}
