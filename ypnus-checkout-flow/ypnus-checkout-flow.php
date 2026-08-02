<?php
/**
 * Plugin Name: YPNUS Checkout Flow
 * Description: Stripe webhook handler, post-payment welcome page, onboarding form, and 7-email nurture sequence.
 * Version:     1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'YPNUS_CF_VERSION', '1.0.0' );
define( 'YPNUS_CF_OPT',     'ypnus_checkout_settings' );

// ─── Activation: create pages + schedule cron ────────────────────────────────

register_activation_hook( __FILE__, 'ypnus_cf_activate' );
function ypnus_cf_activate(): void {
    ypnus_cf_create_pages();
    if ( ! wp_next_scheduled( 'ypnus_cf_send_scheduled_email' ) ) {
        // Cron hook is fired per-scheduled-email, not on a recurring interval
    }
}

function ypnus_cf_create_pages(): void {
    $pages = [
        'checkout-success' => [
            'title'   => 'Welcome to YPNUS! 🎉',
            'content' => '<!-- wp:shortcode -->[ypnus_welcome_page]<!-- /wp:shortcode -->',
        ],
        'checkout-cancel'  => [
            'title'   => 'No Worries — We\'re Here When You\'re Ready',
            'content' => '<!-- wp:shortcode -->[ypnus_cancel_page]<!-- /wp:shortcode -->',
        ],
    ];
    foreach ( $pages as $slug => $data ) {
        if ( ! get_page_by_path( $slug ) ) {
            wp_insert_post( [
                'post_title'   => $data['title'],
                'post_content' => $data['content'],
                'post_status'  => 'publish',
                'post_type'    => 'page',
                'post_name'    => $slug,
            ] );
        }
    }
}

// ─── Settings page ────────────────────────────────────────────────────────────

add_action( 'admin_menu', function () {
    add_options_page( 'YPNUS Checkout Flow', 'YPNUS Checkout', 'manage_options', 'ypnus-checkout', 'ypnus_cf_settings_page' );
} );

function ypnus_cf_settings_page(): void {
    if ( isset( $_POST['ypnus_cf_save'] ) && check_admin_referer( 'ypnus_cf_settings' ) ) {
        $settings = [
            'webhook_secret' => sanitize_text_field( $_POST['webhook_secret'] ?? '' ),
            'from_name'      => sanitize_text_field( $_POST['from_name']      ?? 'YPNUS' ),
            'from_email'     => sanitize_email( $_POST['from_email']           ?? get_option( 'admin_email' ) ),
            'reply_to'       => sanitize_email( $_POST['reply_to']             ?? '' ),
            'site_name'      => sanitize_text_field( $_POST['site_name']       ?? 'YPNUS' ),
            'calendly_url'   => esc_url_raw( $_POST['calendly_url']            ?? '' ),
        ];
        update_option( YPNUS_CF_OPT, $settings, false );
        echo '<div class="notice notice-success"><p>Settings saved.</p></div>';
    }

    $s            = ypnus_cf_settings();
    $webhook_url  = home_url( '/?ypnus_stripe_hook=1' );
    $success_url  = home_url( '/checkout-success/?session_id={CHECKOUT_SESSION_ID}' );
    $cancel_url   = home_url( '/checkout-cancel/' );
    ?>
    <div class="wrap">
    <h1>YPNUS Checkout Flow</h1>

    <table class="widefat" style="max-width:680px;margin-bottom:24px;">
      <tr><th>Stripe Webhook URL</th><td><code><?php echo esc_html( $webhook_url ); ?></code><br><small>Paste this into Stripe Dashboard → Developers → Webhooks → Add Endpoint. Listen for <strong>checkout.session.completed</strong>.</small></td></tr>
      <tr><th>Stripe Success URL</th><td><code><?php echo esc_html( $success_url ); ?></code><br><small>Set this as the "Success URL" in your Stripe Pricing Table settings.</small></td></tr>
      <tr><th>Stripe Cancel URL</th><td><code><?php echo esc_html( $cancel_url ); ?></code><br><small>Set this as the "Cancel URL" in your Stripe Pricing Table settings.</small></td></tr>
    </table>

    <form method="post">
    <?php wp_nonce_field( 'ypnus_cf_settings' ); ?>
    <table class="form-table" style="max-width:680px;">
      <tr><th>Stripe Webhook Secret</th><td><input type="password" name="webhook_secret" value="<?php echo esc_attr( $s['webhook_secret'] ); ?>" class="regular-text"><br><small>From Stripe Dashboard → Webhooks → your endpoint → Signing Secret. Starts with <code>whsec_</code></small></td></tr>
      <tr><th>From Name</th><td><input type="text" name="from_name" value="<?php echo esc_attr( $s['from_name'] ); ?>" class="regular-text"></td></tr>
      <tr><th>From Email</th><td><input type="email" name="from_email" value="<?php echo esc_attr( $s['from_email'] ); ?>" class="regular-text"></td></tr>
      <tr><th>Reply-To Email</th><td><input type="email" name="reply_to" value="<?php echo esc_attr( $s['reply_to'] ); ?>" class="regular-text"><br><small>Where replies from customers go. Leave blank to use From Email.</small></td></tr>
      <tr><th>Business / Site Name</th><td><input type="text" name="site_name" value="<?php echo esc_attr( $s['site_name'] ); ?>" class="regular-text"></td></tr>
      <tr><th>Calendly / Booking URL</th><td><input type="url" name="calendly_url" value="<?php echo esc_attr( $s['calendly_url'] ); ?>" class="regular-text"><br><small>Optional: link to your booking page used in the welcome email.</small></td></tr>
    </table>
    <p><input type="submit" name="ypnus_cf_save" value="Save Settings" class="button button-primary"></p>
    </form>

    <hr>
    <h2>Recent Subscribers</h2>
    <?php ypnus_cf_render_subscribers_table(); ?>
    </div>
    <?php
}

function ypnus_cf_settings(): array {
    $defaults = [
        'webhook_secret' => '',
        'from_name'      => 'YPNUS',
        'from_email'     => get_option( 'admin_email' ),
        'reply_to'       => '',
        'site_name'      => 'YPNUS',
        'calendly_url'   => '',
    ];
    $saved = get_option( YPNUS_CF_OPT, [] );
    return array_merge( $defaults, is_array( $saved ) ? $saved : [] );
}

// ─── Stripe webhook endpoint ─────────────────────────────────────────────────

add_action( 'init', 'ypnus_cf_maybe_handle_webhook' );
function ypnus_cf_maybe_handle_webhook(): void {
    if ( empty( $_GET['ypnus_stripe_hook'] ) ) return;

    $payload    = file_get_contents( 'php://input' );
    $sig_header = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
    $secret     = ypnus_cf_settings()['webhook_secret'];

    if ( $secret && ! ypnus_cf_verify_stripe_sig( $payload, $sig_header, $secret ) ) {
        status_header( 400 );
        echo 'Invalid signature';
        exit;
    }

    $event = json_decode( $payload, true );
    if ( ( $event['type'] ?? '' ) === 'checkout.session.completed' ) {
        $session = $event['data']['object'];
        ypnus_cf_handle_new_customer( $session );
    }

    status_header( 200 );
    echo 'OK';
    exit;
}

function ypnus_cf_verify_stripe_sig( string $payload, string $sig_header, string $secret ): bool {
    $parts     = explode( ',', $sig_header );
    $timestamp = null;
    $sigs      = [];
    foreach ( $parts as $part ) {
        [ $k, $v ] = array_pad( explode( '=', $part, 2 ), 2, '' );
        if ( $k === 't' )  $timestamp = $v;
        if ( $k === 'v1' ) $sigs[]    = $v;
    }
    if ( ! $timestamp || empty( $sigs ) ) return false;
    if ( abs( time() - (int) $timestamp ) > 300 ) return false; // 5-min tolerance
    $signed   = $timestamp . '.' . $payload;
    $expected = hash_hmac( 'sha256', $signed, $secret );
    foreach ( $sigs as $sig ) {
        if ( hash_equals( $expected, $sig ) ) return true;
    }
    return false;
}

function ypnus_cf_handle_new_customer( array $session ): void {
    $email     = $session['customer_details']['email'] ?? $session['customer_email'] ?? '';
    $name      = $session['customer_details']['name']  ?? '';
    $plan      = ypnus_cf_resolve_plan( $session );
    $amount    = ( $session['amount_total'] ?? 0 ) / 100;
    $stripe_id = $session['id'] ?? '';

    if ( ! $email ) return;

    // Store subscriber
    $subscribers   = get_option( 'ypnus_cf_subscribers', [] );
    $subscriber_id = md5( $email . $stripe_id );
    $subscribers[ $subscriber_id ] = [
        'email'      => $email,
        'name'       => $name,
        'plan'       => $plan,
        'amount'     => $amount,
        'stripe_id'  => $stripe_id,
        'created_at' => current_time( 'mysql' ),
        'emails_sent' => [],
    ];
    update_option( 'ypnus_cf_subscribers', $subscribers, false );

    // Send email 1 immediately
    ypnus_cf_send_email( $subscriber_id, 1 );

    // Schedule emails 2–7
    $delays = [ 2 => DAY_IN_SECONDS * 2, 3 => DAY_IN_SECONDS * 5, 4 => DAY_IN_SECONDS * 10, 5 => DAY_IN_SECONDS * 15, 6 => DAY_IN_SECONDS * 22, 7 => DAY_IN_SECONDS * 30 ];
    foreach ( $delays as $num => $delay ) {
        wp_schedule_single_event( time() + $delay, 'ypnus_cf_send_scheduled_email', [ $subscriber_id, $num ] );
    }
}

function ypnus_cf_resolve_plan( array $session ): string {
    $amount = ( $session['amount_total'] ?? 0 ) / 100;
    if ( $amount <= 35 )  return 'Starter';
    if ( $amount <= 110 ) return 'Pro';
    return 'Elite';
}

// ─── Cron email sender ───────────────────────────────────────────────────────

add_action( 'ypnus_cf_send_scheduled_email', 'ypnus_cf_send_email', 10, 2 );
function ypnus_cf_send_email( string $subscriber_id, int $email_num ): void {
    $subscribers = get_option( 'ypnus_cf_subscribers', [] );
    $sub         = $subscribers[ $subscriber_id ] ?? null;
    if ( ! $sub ) return;

    $s         = ypnus_cf_settings();
    $emails    = ypnus_cf_email_sequence( $sub, $s );
    $email_def = $emails[ $email_num ] ?? null;
    if ( ! $email_def ) return;

    $headers = [
        'Content-Type: text/html; charset=UTF-8',
        "From: {$s['from_name']} <{$s['from_email']}>",
    ];
    $reply_to = $s['reply_to'] ?: $s['from_email'];
    $headers[] = "Reply-To: {$reply_to}";

    $sent = wp_mail( $sub['email'], $email_def['subject'], ypnus_cf_wrap_email( $email_def['body'], $s ), $headers );

    if ( $sent ) {
        $subscribers[ $subscriber_id ]['emails_sent'][] = $email_num;
        update_option( 'ypnus_cf_subscribers', $subscribers, false );
    }
}

function ypnus_cf_wrap_email( string $body, array $s ): string {
    return <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <tr><td style="background:linear-gradient(135deg,#0D1B3E,#1565C0);padding:28px 36px;">
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;">{$s['site_name']}</h1>
  </td></tr>
  <tr><td style="padding:36px;">
    {$body}
  </td></tr>
  <tr><td style="background:#F9FAFB;padding:20px 36px;text-align:center;font-size:13px;color:#9CA3AF;">
    You're receiving this because you signed up for {$s['site_name']}.<br>
    Equal Housing Lender. YPNUS is a website platform — not a lender.
  </td></tr>
</table>
</td></tr></table>
</body></html>
HTML;
}

// ─── Email sequence ───────────────────────────────────────────────────────────

function ypnus_cf_email_sequence( array $sub, array $s ): array {
    $first_name  = $sub['name'] ? explode( ' ', trim( $sub['name'] ) )[0] : 'there';
    $plan        = $sub['plan'];
    $site_name   = $s['site_name'];
    $calendly    = $s['calendly_url'];
    $demo_url    = home_url( '/mlo-site-demo/' );
    $pricing_url = home_url( '/pricing/' );
    $cal_btn     = $calendly ? "<p style='margin:24px 0;text-align:center;'><a href='{$calendly}' style='background:#1565C0;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px;display:inline-block;'>📅 Schedule My Kickoff Call</a></p>" : '';
    $p = "style='font-size:16px;line-height:1.7;color:#374151;margin:0 0 16px;'";
    $h2 = "style='font-size:20px;font-weight:800;color:#111827;margin:0 0 16px;'";
    $btn = "style='background:#1565C0;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px;display:inline-block;'";

    return [

        // ── Email 1: Immediate ───────────────────────────────────────────────
        1 => [
            'subject' => "🎉 Welcome to {$site_name}, {$first_name}! Here's what happens next",
            'body'    => "
<h2 {$h2}>You're officially in, {$first_name}! 🎉</h2>
<p {$p}>Thank you for joining {$site_name} on the <strong>{$plan} plan</strong>. You've just made the smartest investment in your MLO business — a website that works for you 24/7.</p>
<p {$p}>Here's exactly what happens next:</p>
<ol style='font-size:16px;line-height:1.9;color:#374151;padding-left:20px;margin:0 0 20px;'>
  <li><strong>Complete your onboarding form</strong> — tell us your market, loan types, and niche (takes 5 minutes)</li>
  <li><strong>We build your site</strong> — AI generates your city pages, loan pages, and compliant copy</li>
  <li><strong>Review &amp; launch</strong> — you approve it, we make it live</li>
</ol>
{$cal_btn}
<p style='margin:24px 0;text-align:center;'><a href='" . home_url('/checkout-success/') . "' {$btn}>✅ Complete My Onboarding Form</a></p>
<p {$p}>If you have any questions at all, just reply to this email. I personally read every response.</p>
<p {$p}>Welcome aboard,<br><strong>The {$site_name} Team</strong></p>",
        ],

        // ── Email 2: Day 2 ───────────────────────────────────────────────────
        2 => [
            'subject' => "{$first_name}, your MLO website checklist (don't skip #3)",
            'body'    => "
<h2 {$h2}>Your MLO Website Launch Checklist</h2>
<p {$p}>Hey {$first_name} — just checking in. Here's everything we need to build you the best possible site:</p>
<table style='width:100%;border-collapse:collapse;margin:0 0 20px;'>
  <tr style='background:#F0F9FF;'><td style='padding:12px 16px;font-size:15px;border-bottom:1px solid #DBEAFE;'>✅ <strong>Your markets</strong> — which cities do you serve?</td></tr>
  <tr><td style='padding:12px 16px;font-size:15px;border-bottom:1px solid #E5E7EB;'>✅ <strong>Your loan specialties</strong> — VA, FHA, DSCR, Jumbo, etc.</td></tr>
  <tr style='background:#F0F9FF;'><td style='padding:12px 16px;font-size:15px;border-bottom:1px solid #DBEAFE;'>✅ <strong>Your NMLS number</strong> — required for compliant pages</td></tr>
  <tr><td style='padding:12px 16px;font-size:15px;border-bottom:1px solid #E5E7EB;'>✅ <strong>Your headshot or logo</strong> — builds trust with borrowers</td></tr>
  <tr style='background:#F0F9FF;'><td style='padding:12px 16px;font-size:15px;'>✅ <strong>Your phone / contact preference</strong> — how do you want leads to reach you?</td></tr>
</table>
<p {$p}>If you haven't filled out the onboarding form yet, do it now — it takes 5 minutes and unlocks your build:</p>
<p style='margin:24px 0;text-align:center;'><a href='" . home_url('/checkout-success/') . "' {$btn}>📋 Fill Out My Onboarding Form</a></p>
<p {$p}>Talk soon,<br><strong>The {$site_name} Team</strong></p>",
        ],

        // ── Email 3: Day 5 ───────────────────────────────────────────────────
        3 => [
            'subject' => "How your YPNUS site will rank on Google ({$first_name}, this is important)",
            'body'    => "
<h2 {$h2}>How MLO Websites Actually Rank on Google</h2>
<p {$p}>Hey {$first_name} — while we're building your site, I want to make sure you understand what makes it work.</p>
<p {$p}><strong>Most MLO websites fail because they\'re too generic.</strong> A page that says &ldquo;I do mortgages in California&rdquo; is invisible on Google.</p>
<p {$p}>What actually ranks:</p>
<ul style='font-size:16px;line-height:1.9;color:#374151;padding-left:20px;margin:0 0 20px;'>
  <li><strong>Specific city + loan type pages</strong> &mdash; &ldquo;VA Loans in Fresno CA&rdquo;, &ldquo;FHA Loans in Sacramento&rdquo;</li>
  <li><strong>Local content that answers real questions</strong> &mdash; &ldquo;What credit score do I need for an FHA loan in Fresno?&rdquo;</li>
  <li><strong>Schema markup</strong> — tells Google exactly who you are and what you do</li>
  <li><strong>Internal links</strong> — connecting your pages so Google crawls all of them</li>
</ul>
<p {$p}><strong>Your YPNUS site has all of this built in from day one.</strong> That's the difference between a generic website and one that actually generates leads.</p>
<p {$p}>One tip: the more cities and loan types you give us in your onboarding form, the stronger your site will be at launch.</p>
<p style='margin:24px 0;text-align:center;'><a href='" . home_url('/checkout-success/') . "' {$btn}>📋 Add My Cities &amp; Loan Types</a></p>
<p {$p}>To your rankings,<br><strong>The {$site_name} Team</strong></p>",
        ],

        // ── Email 4: Day 10 ─────────────────────────────────────────────────
        4 => [
            'subject' => "Meet the AI agent on your new website",
            'body'    => "
<h2 {$h2}>Your Website Has an AI Agent. Here's What It Does.</h2>
<p {$p}>Hey {$first_name} — your {$plan} plan includes a built-in AI agent on your website. Most MLOs don't realize how powerful this is, so let me show you.</p>
<p {$p}><strong>What your AI agent does while you sleep:</strong></p>
<ul style='font-size:16px;line-height:1.9;color:#374151;padding-left:20px;margin:0 0 20px;'>
  <li>Answers borrower questions about VA loans, FHA, DSCR, credit scores, down payments</li>
  <li>Qualifies leads by asking the right questions</li>
  <li>Tells borrowers how to reach you or book a call</li>
  <li>Educates prospects who aren't ready yet — keeping them engaged</li>
  <li>Handles weekend and after-hours inquiries automatically</li>
</ul>
<p {$p}>This means your website isn't a brochure anymore — it's a 24/7 loan officer assistant.</p>
<p {$p}><strong>Pro tip:</strong> Train your agent with your specific markets and loan specialties and it becomes even more powerful. You can do this right from your WordPress dashboard.</p>
<p {$p}>More on this coming soon. In the meantime, if you're not done with onboarding:</p>
<p style='margin:24px 0;text-align:center;'><a href='" . home_url('/checkout-success/') . "' {$btn}>✅ Finish My Onboarding</a></p>
<p {$p}>Talk soon,<br><strong>The {$site_name} Team</strong></p>",
        ],

        // ── Email 5: Day 15 ─────────────────────────────────────────────────
        5 => [
            'subject' => "Quick check-in, {$first_name} — how's everything going?",
            'body'    => "
<h2 {$h2}>Just checking in 👋</h2>
<p {$p}>Hey {$first_name} — it's been about two weeks. I wanted to personally check in and make sure everything is going smoothly with your YPNUS site.</p>
<p {$p}><strong>A few questions:</strong></p>
<ul style='font-size:16px;line-height:1.9;color:#374151;padding-left:20px;margin:0 0 20px;'>
  <li>Have you completed your onboarding form yet?</li>
  <li>Is there a specific city or loan type you're trying to rank for first?</li>
  <li>Any questions about how the platform works?</li>
</ul>
<p {$p}>Just hit reply and let me know — I read every response and I'm happy to jump on a quick call if it helps.</p>
{$cal_btn}
<p {$p}>If you're still getting started:</p>
<p style='margin:24px 0;text-align:center;'><a href='" . home_url('/checkout-success/') . "' {$btn}>📋 Complete Onboarding</a></p>
<p {$p}>Here for you,<br><strong>The {$site_name} Team</strong></p>",
        ],

        // ── Email 6: Day 22 ─────────────────────────────────────────────────
        6 => [
            'subject' => "3 things top MLOs do in their first 30 days",
            'body'    => "
<h2 {$h2}>What the Best MLOs Do First</h2>
<p {$p}>Hey {$first_name} — here are the three moves that make the biggest difference in the first 30 days for MLOs using YPNUS:</p>
<p style='font-size:16px;font-weight:800;color:#1565C0;margin:20px 0 6px;'>1. Focus on 2–3 specific cities first</p>
<p {$p}>Don't try to rank everywhere at once. Pick your strongest market and dominate it. Once those pages start getting traction, expand.</p>
<p style='font-size:16px;font-weight:800;color:#1565C0;margin:20px 0 6px;'>2. Add your Google Business Profile link</p>
<p {$p}>Your website and your Google Business Profile work together. MLOs who have both rank in the local map pack AND organic results — double the visibility.</p>
<p style='font-size:16px;font-weight:800;color:#1565C0;margin:20px 0 6px;'>3. Share your city pages with referral partners</p>
<p {$p}>When a realtor sends you a buyer who needs an FHA loan in Sacramento, send them the link to your FHA Sacramento page. It reinforces your expertise and builds trust.</p>
<p {$p}>These are small moves that compound over time. Any questions on any of them — just hit reply.</p>
<p {$p}>Rooting for you,<br><strong>The {$site_name} Team</strong></p>",
        ],

        // ── Email 7: Day 30 ─────────────────────────────────────────────────
        7 => [
            'subject' => "30 days in, {$first_name} — here's what's next",
            'body'    => "
<h2 {$h2}>You've Been With Us 30 Days 🙌</h2>
<p {$p}>Hey {$first_name} — congratulations on your first 30 days with {$site_name}.</p>
<p {$p}>By now your site should be indexed by Google and your city pages should be getting their first impressions. SEO is a long game, but the foundation you've built is the hardest part — and it's done.</p>
<p {$p}><strong>What to do in month 2:</strong></p>
<ul style='font-size:16px;line-height:1.9;color:#374151;padding-left:20px;margin:0 0 20px;'>
  <li>Add 1–2 blog posts targeting local mortgage questions</li>
  <li>Expand to 2–3 more cities if you haven't already</li>
  <li>Ask happy clients for a Google review and link it from your site</li>
  <li>Use your AI agent to answer the top 5 questions your borrowers always ask</li>
</ul>
<p {$p}><strong>Know another MLO who needs this?</strong></p>
<p {$p}>If you've gotten value from {$site_name}, I'd be grateful if you sent one referral our way. Just share this link:</p>
<p style='margin:20px 0;text-align:center;'><a href='" . home_url('/mlo-site-demo/') . "' {$btn}>🔗 Share My Free Preview Link</a></p>
<p {$p}>Thank you for being a {$site_name} customer. We're building something that makes every MLO more competitive — and you're part of it.</p>
<p {$p}>To your growth,<br><strong>The {$site_name} Team</strong></p>",
        ],
    ];
}

// ─── Shortcodes ──────────────────────────────────────────────────────────────

add_shortcode( 'ypnus_welcome_page', 'ypnus_cf_welcome_shortcode' );
function ypnus_cf_welcome_shortcode(): string {
    $s           = ypnus_cf_settings();
    $calendly    = $s['calendly_url'];
    $cal_section = $calendly ? "<p style='margin:20px 0;text-align:center;'><a href='{$calendly}' style='background:#1565C0;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px;display:inline-block;'>📅 Schedule My Kickoff Call</a></p>" : '';

    $form_html = ypnus_cf_onboarding_form_html();

    return <<<HTML
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:720px;margin:0 auto;padding:40px 24px;">
  <div style="background:linear-gradient(135deg,#0D1B3E,#1565C0);border-radius:16px;padding:40px;text-align:center;color:#fff;margin-bottom:40px;">
    <div style="font-size:52px;margin-bottom:12px;">🎉</div>
    <h1 style="font-size:clamp(24px,4vw,36px);font-weight:900;margin:0 0 12px;">You're In! Welcome to YPNUS.</h1>
    <p style="font-size:17px;opacity:.88;max-width:480px;margin:0 auto;">Your payment is confirmed. Fill out the form below and we'll start building your site.</p>
  </div>
  {$cal_section}
  <div style="background:#F8FAFF;border:1px solid #DBEAFE;border-radius:14px;padding:32px;margin-bottom:32px;">
    <h2 style="font-size:20px;font-weight:800;margin:0 0 6px;color:#111827;">What Happens Next</h2>
    <ol style="font-size:15px;line-height:1.8;color:#374151;padding-left:18px;margin:12px 0 0;">
      <li>Fill out the onboarding form below</li>
      <li>Our AI builds your personalized mortgage website</li>
      <li>You review it and we make it live</li>
      <li>Your site starts ranking and converting leads</li>
    </ol>
  </div>
  {$form_html}
</div>
HTML;
}

function ypnus_cf_onboarding_form_html(): string {
    // Handle form submission
    $submitted = false;
    $error     = '';

    if ( isset( $_POST['ypnus_onboarding_submit'] ) ) {
        if ( ! isset( $_POST['ypnus_onboarding_nonce'] ) || ! wp_verify_nonce( $_POST['ypnus_onboarding_nonce'], 'ypnus_onboarding' ) ) {
            $error = 'Security check failed. Please refresh and try again.';
        } else {
            $data = [
                'email'        => sanitize_email( $_POST['ob_email']       ?? '' ),
                'name'         => sanitize_text_field( $_POST['ob_name']   ?? '' ),
                'nmls'         => sanitize_text_field( $_POST['ob_nmls']   ?? '' ),
                'cities'       => sanitize_textarea_field( $_POST['ob_cities'] ?? '' ),
                'loan_types'   => array_map( 'sanitize_text_field', (array)( $_POST['ob_loans'] ?? [] ) ),
                'phone'        => sanitize_text_field( $_POST['ob_phone']  ?? '' ),
                'notes'        => sanitize_textarea_field( $_POST['ob_notes'] ?? '' ),
                'submitted_at' => current_time( 'mysql' ),
            ];
            if ( ! $data['email'] || ! $data['name'] ) {
                $error = 'Please enter your name and email.';
            } else {
                $all = get_option( 'ypnus_cf_onboarding_submissions', [] );
                $all[] = $data;
                update_option( 'ypnus_cf_onboarding_submissions', $all, false );

                // Notify admin
                $s = ypnus_cf_settings();
                wp_mail(
                    $s['from_email'],
                    "New YPNUS Onboarding Submission — {$data['name']}",
                    "Name: {$data['name']}\nEmail: {$data['email']}\nNMLS: {$data['nmls']}\nPhone: {$data['phone']}\nCities: {$data['cities']}\nLoan Types: " . implode( ', ', $data['loan_types'] ) . "\nNotes: {$data['notes']}",
                    [ "Content-Type: text/plain; charset=UTF-8", "From: {$s['from_name']} <{$s['from_email']}>" ]
                );

                $submitted = true;
            }
        }
    }

    if ( $submitted ) {
        return '<div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:12px;padding:32px;text-align:center;">
          <div style="font-size:40px;margin-bottom:12px;">✅</div>
          <h3 style="font-size:20px;font-weight:800;color:#065F46;margin:0 0 10px;">Got it — we\'re on it!</h3>
          <p style="font-size:16px;color:#374151;margin:0;">We\'ll be in touch within 1 business day to walk you through your site. Check your email for a welcome message.</p>
        </div>';
    }

    $err_html = $error ? "<p style='color:#DC2626;font-weight:600;'>{$error}</p>" : '';
    $nonce    = wp_nonce_field( 'ypnus_onboarding', 'ypnus_onboarding_nonce', true, false );

    return <<<HTML
<div style="background:#fff;border:1px solid #E5E7EB;border-radius:14px;padding:36px;">
  <h2 style="font-size:22px;font-weight:800;margin:0 0 6px;color:#111827;">📋 Your Onboarding Form</h2>
  <p style="font-size:15px;color:#6B7280;margin:0 0 28px;">This takes 5 minutes and starts your site build.</p>
  {$err_html}
  <form method="post">
    {$nonce}
    <div style="margin-bottom:18px;">
      <label style="display:block;font-weight:700;font-size:14px;margin-bottom:6px;">Full Name *</label>
      <input type="text" name="ob_name" required style="width:100%;padding:12px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:15px;">
    </div>
    <div style="margin-bottom:18px;">
      <label style="display:block;font-weight:700;font-size:14px;margin-bottom:6px;">Email Address *</label>
      <input type="email" name="ob_email" required style="width:100%;padding:12px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:15px;">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px;">
      <div>
        <label style="display:block;font-weight:700;font-size:14px;margin-bottom:6px;">NMLS Number</label>
        <input type="text" name="ob_nmls" style="width:100%;padding:12px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:15px;">
      </div>
      <div>
        <label style="display:block;font-weight:700;font-size:14px;margin-bottom:6px;">Phone Number</label>
        <input type="tel" name="ob_phone" style="width:100%;padding:12px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:15px;">
      </div>
    </div>
    <div style="margin-bottom:18px;">
      <label style="display:block;font-weight:700;font-size:14px;margin-bottom:6px;">Cities / Markets You Serve *</label>
      <textarea name="ob_cities" rows="3" placeholder="e.g. Fresno CA, Visalia CA, Sacramento CA, Las Vegas NV" style="width:100%;padding:12px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:15px;resize:vertical;"></textarea>
    </div>
    <div style="margin-bottom:18px;">
      <label style="display:block;font-weight:700;font-size:14px;margin-bottom:10px;">Loan Types You Specialize In</label>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="VA Loans"> VA Loans</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="FHA Loans"> FHA Loans</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="Conventional"> Conventional</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="DSCR Investor"> DSCR Investor</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="Jumbo"> Jumbo</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="USDA"> USDA</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="Refinance"> Refinance</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="First-Time Buyer"> First-Time Buyer</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="HELOC"> HELOC</label>
        <label style="display:flex;align-items:center;gap:6px;font-size:14px;"><input type="checkbox" name="ob_loans[]" value="Reverse Mortgage"> Reverse Mortgage</label>
      </div>
    </div>
    <div style="margin-bottom:24px;">
      <label style="display:block;font-weight:700;font-size:14px;margin-bottom:6px;">Anything else we should know? (optional)</label>
      <textarea name="ob_notes" rows="3" placeholder="Your niche, target clients, referral partners, anything that makes your business unique..." style="width:100%;padding:12px 14px;border:1px solid #D1D5DB;border-radius:8px;font-size:15px;resize:vertical;"></textarea>
    </div>
    <button type="submit" name="ypnus_onboarding_submit" style="background:#1565C0;color:#fff;padding:16px 40px;border-radius:10px;font-size:17px;font-weight:800;border:none;cursor:pointer;width:100%;">
      🚀 Submit &amp; Start My Site Build
    </button>
  </form>
</div>
HTML;
}

add_shortcode( 'ypnus_cancel_page', 'ypnus_cf_cancel_shortcode' );
function ypnus_cf_cancel_shortcode(): string {
    $pricing_url = home_url( '/pricing/' );
    $demo_url    = home_url( '/mlo-site-demo/' );
    return <<<HTML
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:60px 24px;text-align:center;">
  <div style="font-size:52px;margin-bottom:16px;">👋</div>
  <h1 style="font-size:32px;font-weight:900;margin:0 0 14px;color:#111827;">No worries at all.</h1>
  <p style="font-size:18px;color:#6B7280;line-height:1.7;margin:0 0 32px;">Your cart was not charged. Whenever you're ready, we'll be here.</p>
  <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
    <a href="{$demo_url}" style="background:#1565C0;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:800;font-size:16px;">▶ See My Free Preview</a>
    <a href="{$pricing_url}" style="background:transparent;color:#1565C0;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:16px;border:2px solid #1565C0;">View Plans</a>
  </div>
</div>
HTML;
}

// ─── Admin: view onboarding submissions ──────────────────────────────────────

function ypnus_cf_render_subscribers_table(): void {
    $subs = get_option( 'ypnus_cf_subscribers', [] );
    if ( empty( $subs ) ) { echo '<p>No subscribers yet.</p>'; return; }
    echo '<table class="widefat striped" style="max-width:900px;"><thead><tr><th>Email</th><th>Name</th><th>Plan</th><th>Amount</th><th>Emails Sent</th><th>Date</th></tr></thead><tbody>';
    foreach ( array_reverse( $subs ) as $s ) {
        $sent = implode( ', ', array_map( fn($n) => "#{$n}", $s['emails_sent'] ?? [] ) ) ?: '—';
        printf( '<tr><td>%s</td><td>%s</td><td>%s</td><td>$%s</td><td>%s</td><td>%s</td></tr>',
            esc_html( $s['email'] ), esc_html( $s['name'] ), esc_html( $s['plan'] ),
            esc_html( $s['amount'] ), esc_html( $sent ), esc_html( $s['created_at'] )
        );
    }
    echo '</tbody></table>';
    echo '<h3>Onboarding Form Submissions</h3>';
    $forms = get_option( 'ypnus_cf_onboarding_submissions', [] );
    if ( empty( $forms ) ) { echo '<p>No submissions yet.</p>'; return; }
    echo '<table class="widefat striped" style="max-width:900px;"><thead><tr><th>Name</th><th>Email</th><th>NMLS</th><th>Cities</th><th>Loans</th><th>Date</th></tr></thead><tbody>';
    foreach ( array_reverse( $forms ) as $f ) {
        printf( '<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>',
            esc_html( $f['name'] ), esc_html( $f['email'] ), esc_html( $f['nmls'] ),
            esc_html( $f['cities'] ), esc_html( implode( ', ', $f['loan_types'] ) ), esc_html( $f['submitted_at'] )
        );
    }
    echo '</tbody></table>';
}
