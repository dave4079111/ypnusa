<?php
/**
 * Plugin Name: YPNUS MLO Toolkit
 * Plugin URI:  https://ypnus.com
 * Description: Self-learning agentic AI for Mortgage Loan Officers — builds pages, writes compliant content, scores GMB, scouts keywords, and grows its own toolset from the WordPress dashboard.
 * Version:     2.5.8
 * Author:      YPNUS
 * License:     GPL-2.0+
 * Text Domain: ypnus-mlo
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'YPNUS_MLO_VERSION', '2.5.0' );
define( 'YPNUS_MLO_DIR', plugin_dir_path( __FILE__ ) );
define( 'YPNUS_MLO_URL', plugin_dir_url( __FILE__ ) );

// ─── Storage helpers ─────────────────────────────────────────────────────────

function ypnus_get_tools() {
    $tools = get_option( 'ypnus_dynamic_tools', [] );
    return is_array( $tools ) ? $tools : [];
}

function ypnus_save_tools( $tools ) {
    update_option( 'ypnus_dynamic_tools', $tools, false );
}

function ypnus_get_tool_by_slug( $slug ) {
    foreach ( ypnus_get_tools() as $t ) {
        if ( ( $t['slug'] ?? '' ) === $slug ) return $t;
    }
    return null;
}

function ypnus_upsert_tool( $tool ) {
    $tools = ypnus_get_tools();
    $slug  = $tool['slug'] ?? sanitize_title( $tool['name'] ?? 'tool_' . time() );
    $tool['slug'] = $slug;
    foreach ( $tools as $i => $t ) {
        if ( ( $t['slug'] ?? '' ) === $slug ) {
            $tools[ $i ] = array_merge( $t, $tool );
            ypnus_save_tools( $tools );
            return $slug;
        }
    }
    $tool['created_at'] = current_time( 'mysql' );
    $tools[] = $tool;
    ypnus_save_tools( $tools );
    return $slug;
}

function ypnus_delete_tool( $slug ) {
    $tools = array_values( array_filter( ypnus_get_tools(), fn( $t ) => ( $t['slug'] ?? '' ) !== $slug ) );
    ypnus_save_tools( $tools );
}

function ypnus_get_memory() {
    $mem = get_option( 'ypnus_agent_memory', [] );
    return is_array( $mem ) ? $mem : [];
}

function ypnus_save_memory( $key, $value ) {
    $mem = ypnus_get_memory();
    $mem[ sanitize_key( $key ) ] = [
        'value'      => sanitize_textarea_field( $value ),
        'updated_at' => current_time( 'mysql' ),
    ];
    update_option( 'ypnus_agent_memory', $mem, false );
}

function ypnus_delete_memory( $key ) {
    $mem = ypnus_get_memory();
    unset( $mem[ sanitize_key( $key ) ] );
    update_option( 'ypnus_agent_memory', $mem, false );
}

function ypnus_format_memory_for_prompt() {
    $mem = ypnus_get_memory();
    if ( empty( $mem ) ) return '';
    $lines = [ 'Known facts about this MLO (from memory):' ];
    foreach ( $mem as $k => $v ) {
        $lines[] = "- {$k}: " . ( $v['value'] ?? '' );
    }
    return implode( "\n", $lines );
}

// ─── Admin menu ──────────────────────────────────────────────────────────────

add_action( 'admin_menu', function () {
    add_menu_page(
        'MLO Toolkit',
        'MLO Toolkit',
        'manage_options',
        'ypnus-mlo',
        'ypnus_admin_page',
        'dashicons-superhero-alt',
        3
    );
    add_submenu_page( 'ypnus-mlo', 'Settings',     'Settings',     'manage_options', 'ypnus-mlo',              'ypnus_admin_page' );
    add_submenu_page( 'ypnus-mlo', 'Tools',        'Tools',        'manage_options', 'ypnus-mlo-tools',        'ypnus_admin_tools_redirect' );
    add_submenu_page( 'ypnus-mlo', 'Agent Memory', 'Agent Memory', 'manage_options', 'ypnus-mlo-memory',       'ypnus_admin_memory_redirect' );
} );

function ypnus_admin_tools_redirect() {
    wp_redirect( admin_url( 'admin.php?page=ypnus-mlo&tab=tools' ) ); exit;
}
function ypnus_admin_memory_redirect() {
    wp_redirect( admin_url( 'admin.php?page=ypnus-mlo&tab=memory' ) ); exit;
}

add_action( 'admin_init', function () {
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_openai_key',   [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_nmls',         [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_company',      [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_disclosure',   [ 'sanitize_callback' => 'sanitize_textarea_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_silos',        [ 'sanitize_callback' => 'sanitize_textarea_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_demo_signup_url',  [ 'sanitize_callback' => 'esc_url_raw' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_demo_cta_text',    [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_demo_price_label', [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_demo_daily_limit', [ 'sanitize_callback' => 'absint' ] );
} );

function ypnus_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;
    $tab = sanitize_key( $_GET['tab'] ?? 'settings' );

    // Handle tool save
    if ( $tab === 'tools' && $_SERVER['REQUEST_METHOD'] === 'POST' && isset( $_POST['ypnus_tool_nonce'] ) ) {
        check_admin_referer( 'ypnus_save_tool', 'ypnus_tool_nonce' );
        $action = sanitize_key( $_POST['tool_action'] ?? 'save' );
        if ( $action === 'delete' ) {
            ypnus_delete_tool( sanitize_key( $_POST['tool_slug'] ?? '' ) );
            echo '<div class="notice notice-success"><p>Tool deleted.</p></div>';
        } else {
            $name     = sanitize_text_field( $_POST['tool_name']        ?? '' );
            $desc     = sanitize_textarea_field( $_POST['tool_desc']    ?? '' );
            $keywords = sanitize_text_field( $_POST['tool_keywords']    ?? '' );
            $prompt   = sanitize_textarea_field( $_POST['tool_prompt']  ?? '' );
            $format   = sanitize_key( $_POST['tool_format']             ?? 'text' );
            $category = sanitize_text_field( $_POST['tool_category']    ?? '' );
            $enabled  = isset( $_POST['tool_enabled'] ) ? 1 : 0;
            $slug     = sanitize_key( $_POST['tool_slug'] ?? sanitize_title( $name ) );
            if ( $name && $prompt ) {
                ypnus_upsert_tool( compact( 'slug', 'name', 'desc', 'keywords', 'prompt', 'format', 'category', 'enabled' ) );
                echo '<div class="notice notice-success"><p>Tool saved.</p></div>';
            } else {
                echo '<div class="notice notice-error"><p>Name and prompt are required.</p></div>';
            }
        }
    }

    // Handle memory delete
    if ( $tab === 'memory' && $_SERVER['REQUEST_METHOD'] === 'POST' && isset( $_POST['ypnus_memory_nonce'] ) ) {
        check_admin_referer( 'ypnus_memory_action', 'ypnus_memory_nonce' );
        $mk = sanitize_key( $_POST['memory_key'] ?? '' );
        if ( $mk ) {
            ypnus_delete_memory( $mk );
            echo '<div class="notice notice-success"><p>Memory entry deleted.</p></div>';
        }
    }

    $editing = null;
    if ( $tab === 'tools' && isset( $_GET['edit'] ) ) {
        $editing = ypnus_get_tool_by_slug( sanitize_key( $_GET['edit'] ) );
    }

    $tabs = [
        'settings' => 'Settings',
        'tools'    => 'Agent Tools',
        'memory'   => 'Agent Memory',
    ];
    ?>
    <div class="wrap">
        <h1>MLO Toolkit <small style="font-size:13px;color:#999;">v<?php echo YPNUS_MLO_VERSION; ?></small></h1>
        <nav class="nav-tab-wrapper" style="margin-bottom:20px;">
            <?php foreach ( $tabs as $t => $label ): ?>
                <a href="<?php echo esc_url( admin_url( "admin.php?page=ypnus-mlo&tab={$t}" ) ); ?>"
                   class="nav-tab<?php echo $tab === $t ? ' nav-tab-active' : ''; ?>">
                    <?php echo esc_html( $label ); ?>
                </a>
            <?php endforeach; ?>
        </nav>

        <?php if ( $tab === 'settings' ): ?>
        <form method="post" action="options.php">
            <?php settings_fields( 'ypnus_mlo_group' ); ?>
            <table class="form-table">
                <tr>
                    <th><label for="ypnus_mlo_openai_key">OpenAI API Key</label></th>
                    <td>
                        <input type="password" id="ypnus_mlo_openai_key" name="ypnus_mlo_openai_key"
                               value="<?php echo esc_attr( get_option( 'ypnus_mlo_openai_key' ) ); ?>"
                               class="regular-text" autocomplete="off" />
                        <p class="description">Your OpenAI key — stored encrypted in the database, never displayed in plain text.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="ypnus_mlo_nmls">NMLS Number</label></th>
                    <td><input type="text" id="ypnus_mlo_nmls" name="ypnus_mlo_nmls" value="<?php echo esc_attr( get_option( 'ypnus_mlo_nmls' ) ); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th><label for="ypnus_mlo_company">Company Name</label></th>
                    <td><input type="text" id="ypnus_mlo_company" name="ypnus_mlo_company" value="<?php echo esc_attr( get_option( 'ypnus_mlo_company' ) ); ?>" class="regular-text" /></td>
                </tr>
                <tr>
                    <th><label for="ypnus_mlo_disclosure">Compliance Disclosure</label></th>
                    <td>
                        <textarea id="ypnus_mlo_disclosure" name="ypnus_mlo_disclosure" rows="4" class="large-text"><?php echo esc_textarea( get_option( 'ypnus_mlo_disclosure', ypnus_mlo_default_disclosure() ) ); ?></textarea>
                        <p class="description">Auto-appended to every generated post. Required for NMLS compliance.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="ypnus_mlo_silos">Silo Structure (JSON)</label></th>
                    <td>
                        <textarea id="ypnus_mlo_silos" name="ypnus_mlo_silos" rows="8" class="large-text code"><?php echo esc_textarea( get_option( 'ypnus_mlo_silos', ypnus_mlo_default_silos() ) ); ?></textarea>
                    </td>
                </tr>
            </table>

            <h2 style="margin-top:32px;">Demo Mode Settings <small style="font-size:13px;color:#999;">for [ypnus_mlo_demo] on your sales page</small></h2>
            <p style="color:#666;">Place <code>[ypnus_mlo_demo]</code> on any page on ypnus.com to show prospects a live preview of their site before they sign up.</p>
            <table class="form-table">
                <tr>
                    <th><label for="ypnus_demo_signup_url">Signup / Checkout URL</label></th>
                    <td>
                        <input type="url" id="ypnus_demo_signup_url" name="ypnus_demo_signup_url" value="<?php echo esc_attr( get_option( 'ypnus_demo_signup_url', '' ) ); ?>" class="regular-text" placeholder="https://ypnus.com/checkout" />
                        <p class="description">Where to send MLOs after they see the demo. Your Stripe/PayPal checkout or signup page.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="ypnus_demo_cta_text">CTA Button Text</label></th>
                    <td>
                        <input type="text" id="ypnus_demo_cta_text" name="ypnus_demo_cta_text" value="<?php echo esc_attr( get_option( 'ypnus_demo_cta_text', 'Get My Full Website — Sign Up Now' ) ); ?>" class="regular-text" />
                    </td>
                </tr>
                <tr>
                    <th><label for="ypnus_demo_price_label">Price / Offer Label</label></th>
                    <td>
                        <input type="text" id="ypnus_demo_price_label" name="ypnus_demo_price_label" value="<?php echo esc_attr( get_option( 'ypnus_demo_price_label', 'Starting at $97/month — Cancel anytime' ) ); ?>" class="regular-text" />
                        <p class="description">Shown under the signup button in the demo paywall.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="ypnus_demo_daily_limit">Demo Limit (per IP/day)</label></th>
                    <td>
                        <input type="number" id="ypnus_demo_daily_limit" name="ypnus_demo_daily_limit" value="<?php echo esc_attr( get_option( 'ypnus_demo_daily_limit', 3 ) ); ?>" class="small-text" min="1" max="20" />
                        <p class="description">Max demo runs per visitor per day. Prevents API cost abuse.</p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>

        <?php elseif ( $tab === 'tools' ): ?>

        <div style="display:flex;gap:30px;align-items:flex-start;">
        <div style="flex:2;min-width:0;">
        <h2><?php echo $editing ? 'Edit Tool' : 'Add New Tool'; ?></h2>
        <form method="post">
            <?php wp_nonce_field( 'ypnus_save_tool', 'ypnus_tool_nonce' ); ?>
            <input type="hidden" name="tool_action" value="save">
            <input type="hidden" name="tool_slug" value="<?php echo esc_attr( $editing['slug'] ?? '' ); ?>">
            <table class="form-table">
                <tr>
                    <th><label>Tool Name</label></th>
                    <td><input type="text" name="tool_name" value="<?php echo esc_attr( $editing['name'] ?? '' ); ?>" class="regular-text" placeholder="e.g. Pre-Approval Letter Helper" required /></td>
                </tr>
                <tr>
                    <th><label>Description</label></th>
                    <td><input type="text" name="tool_desc" value="<?php echo esc_attr( $editing['desc'] ?? '' ); ?>" class="large-text" placeholder="What does this tool do? (shown to the agent)" /></td>
                </tr>
                <tr>
                    <th><label>Trigger Keywords</label></th>
                    <td>
                        <input type="text" name="tool_keywords" value="<?php echo esc_attr( $editing['keywords'] ?? '' ); ?>" class="large-text" placeholder="pre-approval, pre-qual, letter, qualification letter" />
                        <p class="description">Comma-separated words. When the user says any of these, the agent calls this tool.</p>
                    </td>
                </tr>
                <tr>
                    <th><label>Prompt Template</label></th>
                    <td>
                        <textarea name="tool_prompt" rows="10" class="large-text code" placeholder="Write the AI instructions here. Use {args.field} for agent-provided values, {nmls}, {company}, {city}, {disclosure} for MLO data."><?php echo esc_textarea( $editing['prompt'] ?? '' ); ?></textarea>
                        <p class="description">
                            Available placeholders: <code>{args.topic}</code> <code>{args.city}</code> <code>{args.content}</code> <code>{nmls}</code> <code>{company}</code> <code>{disclosure}</code><br>
                            Return format: plain text, or JSON for structured outputs.
                        </p>
                    </td>
                </tr>
                <tr>
                    <th><label>Output Format</label></th>
                    <td>
                        <select name="tool_format">
                            <?php
                            $formats = [
                                'text'         => 'Plain Text / Markdown',
                                'social_posts' => 'Social Posts (LinkedIn + Instagram + TikTok)',
                                'page'         => 'WordPress Page (auto-publish as draft)',
                                'keyword_table'=> 'Keyword Table',
                            ];
                            $cur = $editing['format'] ?? 'text';
                            foreach ( $formats as $v => $l ):
                            ?>
                                <option value="<?php echo esc_attr($v); ?>" <?php selected( $cur, $v ); ?>><?php echo esc_html($l); ?></option>
                            <?php endforeach; ?>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th><label>Auto-Publish Category</label></th>
                    <td>
                        <input type="text" name="tool_category" value="<?php echo esc_attr( $editing['category'] ?? '' ); ?>" class="regular-text" placeholder="mortgage-marketing (category slug)" />
                        <p class="description">Only used when Output Format is "WordPress Page". Leave blank for auto-detect.</p>
                    </td>
                </tr>
                <tr>
                    <th><label>Enabled</label></th>
                    <td><label><input type="checkbox" name="tool_enabled" value="1" <?php checked( $editing['enabled'] ?? 1 ); ?> /> Active — agent can use this tool</label></td>
                </tr>
            </table>
            <?php submit_button( $editing ? 'Update Tool' : 'Save Tool' ); ?>
            <?php if ( $editing ): ?>
                <a href="<?php echo esc_url( admin_url( 'admin.php?page=ypnus-mlo&tab=tools' ) ); ?>" class="button">Cancel</a>
            <?php endif; ?>
        </form>
        </div>

        <div style="flex:3;min-width:0;">

        <?php
        // Handle core-tool toggle
        if ( isset( $_POST['core_tool_toggle'], $_POST['ypnus_core_toggle_nonce'] )
            && wp_verify_nonce( sanitize_key( $_POST['ypnus_core_toggle_nonce'] ), 'ypnus_core_toggle' ) ) {
            $ctslug   = sanitize_key( $_POST['core_tool_toggle'] );
            $cstate   = ! empty( $_POST['core_tool_enabled'] ) ? 1 : 0;
            $disabled = get_option( 'ypnus_disabled_core_tools', [] );
            if ( $cstate ) {
                $disabled = array_values( array_diff( $disabled, [ $ctslug ] ) );
            } else {
                $disabled[] = $ctslug;
                $disabled   = array_values( array_unique( $disabled ) );
            }
            update_option( 'ypnus_disabled_core_tools', $disabled );
        }
        $disabled_core = get_option( 'ypnus_disabled_core_tools', [] );

        $core_tool_meta = [
            'scout_keywords'        => [ 'name' => 'Keyword Scout',           'shortcode' => '[ypnus_keyword_scout]',    'desc' => 'Find 10 long-tail mortgage keywords with difficulty + site fit rating.' ],
            'generate_social_posts' => [ 'name' => 'Social Post Generator',   'shortcode' => '[ypnus_content_generator]','desc' => 'FINRA-compliant LinkedIn / Instagram / TikTok posts from any article.' ],
            'check_compliance'      => [ 'name' => 'Compliance Checker',      'shortcode' => '',                         'desc' => 'Audit marketing copy for CFPB/FINRA compliance issues.' ],
            'suggest_silo'          => [ 'name' => 'Content Silo Advisor',    'shortcode' => '',                         'desc' => 'Recommends the right silo and URL for any topic.' ],
            'site_wizard'           => [ 'name' => 'Site Wizard (Onboarding)', 'shortcode' => '',                         'desc' => 'Guides an MLO through building their complete website — 5 questions → full plan with prioritized pages, plugin checklist, and conversion rules.' ],
            'build_full_site'       => [ 'name' => 'Build Full Site',          'shortcode' => '',                         'desc' => 'Bulk-creates all core website pages as WordPress drafts in one shot, each conversion-optimized with CTAs, lead forms, and trust signals.' ],
            'build_page'            => [ 'name' => 'Page Builder',             'shortcode' => '',                         'desc' => 'Generates a full SEO landing page and saves it as a WordPress draft.' ],
            'write_article'         => [ 'name' => 'Article Writer',           'shortcode' => '',                         'desc' => 'Writes a 1500–2000 word SEO article with internal links, authority backlinks, and optional affiliate products.' ],
            'plan_website'          => [ 'name' => 'Website Planner',         'shortcode' => '',                         'desc' => 'Creates a complete website architecture for an MLO.' ],
            'score_gmb'             => [ 'name' => 'GMB Scorer',              'shortcode' => '',                         'desc' => 'Scores a Google Business Profile 0–100 and gives an optimization guide.' ],
            'recommend_plugins'     => [ 'name' => 'Plugin Advisor',          'shortcode' => '',                         'desc' => 'Recommends the right WordPress plugins for your stack.' ],
            'marketing_advisor'     => [ 'name' => 'Marketing Advisor',       'shortcode' => '',                         'desc' => 'Full-funnel strategy: lead capture, email sequences, CRM, conversions.' ],
            'diagnose_error'        => [ 'name' => 'Error Diagnostics',       'shortcode' => '',                         'desc' => 'Diagnoses WordPress errors, white screens, and plugin conflicts.' ],
            'create_tool'           => [ 'name' => 'Self-Learning (Create)',  'shortcode' => '',                         'desc' => 'Agent can create new custom tools and save them to this panel.' ],
            'update_tool'           => [ 'name' => 'Self-Learning (Update)',  'shortcode' => '',                         'desc' => 'Agent can update existing tools without reinstalling the plugin.' ],
            'save_memory'           => [ 'name' => 'Agent Memory (Save)',     'shortcode' => '',                         'desc' => 'Saves facts across conversations (markets, niche, preferences).' ],
            'recall_memory'         => [ 'name' => 'Agent Memory (Recall)',   'shortcode' => '',                         'desc' => 'Retrieves all saved memory so the agent picks up where it left off.' ],
        ];
        ?>

        <h2>Core Tools</h2>
        <p style="color:#666;font-size:13px;">Built-in tools. Toggle any off if you don't need it. Copy shortcodes to add tools to any page.</p>
        <table class="widefat striped" style="margin-bottom:28px;">
            <thead><tr><th>Tool</th><th>Description</th><th>Shortcode</th><th style="width:56px;text-align:center;">On/Off</th></tr></thead>
            <tbody>
            <?php foreach ( $core_tool_meta as $cslug => $cmeta ):
                $is_on = ! in_array( $cslug, $disabled_core, true );
            ?>
            <tr>
                <td><strong><?php echo esc_html( $cmeta['name'] ); ?></strong></td>
                <td style="font-size:13px;color:#555;"><?php echo esc_html( $cmeta['desc'] ); ?></td>
                <td><?php if ( $cmeta['shortcode'] ): ?>
                    <code style="font-size:12px;user-select:all;"><?php echo esc_html( $cmeta['shortcode'] ); ?></code>
                <?php else: ?>
                    <span style="color:#bbb;font-size:12px;">agent only</span>
                <?php endif; ?></td>
                <td style="text-align:center;">
                    <form method="post" style="margin:0;">
                        <?php wp_nonce_field( 'ypnus_core_toggle', 'ypnus_core_toggle_nonce' ); ?>
                        <input type="hidden" name="core_tool_toggle" value="<?php echo esc_attr( $cslug ); ?>">
                        <input type="hidden" name="core_tool_enabled" value="<?php echo $is_on ? '0' : '1'; ?>">
                        <button type="submit" title="<?php echo $is_on ? 'Click to disable' : 'Click to enable'; ?>"
                            style="background:none;border:none;cursor:pointer;font-size:20px;padding:2px 0;line-height:1;">
                            <?php echo $is_on ? '🟢' : '🔴'; ?>
                        </button>
                    </form>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>

        <h2>Custom Tools <span style="font-size:13px;color:#999;">(<?php echo count( ypnus_get_tools() ); ?>)</span></h2>
        <?php $dtools = ypnus_get_tools(); if ( $dtools ): ?>
        <table class="widefat striped">
            <thead><tr><th>Name</th><th>Triggers</th><th>Format</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
            <?php foreach ( $dtools as $t ): ?>
            <tr>
                <td><strong><?php echo esc_html( $t['name'] ?? '' ); ?></strong><br><small style="color:#888;"><?php echo esc_html( $t['slug'] ?? '' ); ?></small></td>
                <td><small><?php echo esc_html( $t['keywords'] ?? '' ); ?></small></td>
                <td><code><?php echo esc_html( $t['format'] ?? 'text' ); ?></code></td>
                <td><?php echo empty( $t['enabled'] ) ? '<span style="color:#c00;">Off</span>' : '<span style="color:#0a0;">On</span>'; ?></td>
                <td>
                    <a href="<?php echo esc_url( admin_url( "admin.php?page=ypnus-mlo&tab=tools&edit=" . urlencode( $t['slug'] ) ) ); ?>">Edit</a> |
                    <form method="post" style="display:inline;" onsubmit="return confirm('Delete this tool?')">
                        <?php wp_nonce_field( 'ypnus_save_tool', 'ypnus_tool_nonce' ); ?>
                        <input type="hidden" name="tool_action" value="delete">
                        <input type="hidden" name="tool_slug" value="<?php echo esc_attr( $t['slug'] ); ?>">
                        <button type="submit" style="background:none;border:none;color:#c00;cursor:pointer;padding:0;">Delete</button>
                    </form>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php else: ?>
        <p style="color:#888;">No custom tools yet. Add one above, or ask the agent to create one for you.</p>
        <?php endif; ?>
        </div>
        </div>

        <?php elseif ( $tab === 'memory' ): ?>

        <h2>Agent Memory</h2>
        <p style="color:#666;">The agent saves facts here during conversations — your markets, preferences, what's been built. You can delete any entry.</p>
        <?php $mem = ypnus_get_memory(); if ( $mem ): ?>
        <table class="widefat striped" style="max-width:900px;">
            <thead><tr><th>Key</th><th>Value</th><th>Updated</th><th></th></tr></thead>
            <tbody>
            <?php foreach ( $mem as $k => $v ): ?>
            <tr>
                <td><code><?php echo esc_html( $k ); ?></code></td>
                <td><?php echo esc_html( $v['value'] ?? '' ); ?></td>
                <td style="color:#888;font-size:12px;"><?php echo esc_html( $v['updated_at'] ?? '' ); ?></td>
                <td>
                    <form method="post" style="display:inline;">
                        <?php wp_nonce_field( 'ypnus_memory_action', 'ypnus_memory_nonce' ); ?>
                        <input type="hidden" name="memory_key" value="<?php echo esc_attr( $k ); ?>">
                        <button type="submit" style="background:none;border:none;color:#c00;cursor:pointer;">Delete</button>
                    </form>
                </td>
            </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <?php else: ?>
        <p style="color:#888;">No memory yet. The agent will start saving facts as you have conversations.</p>
        <?php endif; ?>

        <?php endif; ?>
    </div>
    <?php
}

// ─── Default config ───────────────────────────────────────────────────────────

function ypnus_mlo_default_disclosure() {
    $nmls    = get_option( 'ypnus_mlo_nmls', 'XXXXXX' );
    $company = get_option( 'ypnus_mlo_company', 'Your Company Name' );
    return "NMLS #{$nmls} | {$company} | Equal Housing Lender | This is not a commitment to lend. Rates and terms subject to change without notice. All loans subject to credit approval. For licensing information, visit nmlsconsumeraccess.org.";
}

function ypnus_mlo_default_silos() {
    return json_encode( [
        '/mlo-marketing'      => [ 'label' => 'MLO Marketing',       'children' => [ [ 'label' => 'Lead Generation',  'url' => '/mlo-marketing/lead-generation/' ], [ 'label' => 'Social Content', 'url' => '/mlo-marketing/social-content/' ] ] ],
        '/mortgage-compliance'=> [ 'label' => 'Mortgage Compliance', 'children' => [ [ 'label' => 'Social Media Rules','url' => '/mortgage-compliance/social-media-rules/' ] ] ],
        '/ai-marketing-tools' => [ 'label' => 'AI Marketing Tools',  'children' => [ [ 'label' => 'Content Generator','url' => '/ai-marketing-tools/content-generator/' ] ] ],
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
}

// ─── Assets ───────────────────────────────────────────────────────────────────

add_action( 'wp_enqueue_scripts', 'ypnus_mlo_enqueue_assets' );

function ypnus_mlo_enqueue_assets() {
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) ) return;
    $sc = [ 'ypnus_content_generator', 'ypnus_keyword_scout', 'ypnus_silo_nav', 'ypnus_agent', 'ypnus_mlo_demo' ];
    $has = false;
    foreach ( $sc as $s ) { if ( has_shortcode( $post->post_content, $s ) ) { $has = true; break; } }
    if ( ! $has ) return;
    wp_enqueue_style(  'ypnus-mlo-style',  YPNUS_MLO_URL . 'assets/style.css',  [], YPNUS_MLO_VERSION );
    wp_enqueue_script( 'ypnus-mlo-script', YPNUS_MLO_URL . 'assets/script.js', [], YPNUS_MLO_VERSION, true );
    wp_localize_script( 'ypnus-mlo-script', 'ypnusMLO', [
        'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
        'nonce'      => wp_create_nonce( 'ypnus_mlo_nonce' ),
        'disclosure' => get_option( 'ypnus_mlo_disclosure', ypnus_mlo_default_disclosure() ),
    ] );
}

// ─── AJAX: legacy content generator ──────────────────────────────────────────

add_action( 'wp_ajax_nopriv_ypnus_generate_content', 'ypnus_handle_generate_content' );
add_action( 'wp_ajax_ypnus_generate_content',        'ypnus_handle_generate_content' );

function ypnus_handle_generate_content() {
    check_ajax_referer( 'ypnus_mlo_nonce', 'nonce' );
    $article    = sanitize_textarea_field( wp_unslash( $_POST['article'] ?? '' ) );
    $disclosure = get_option( 'ypnus_mlo_disclosure', ypnus_mlo_default_disclosure() );
    if ( empty( $article ) ) wp_send_json_error( [ 'message' => 'Please paste an article.' ] );
    $api_key = get_option( 'ypnus_mlo_openai_key', '' );
    if ( empty( $api_key ) ) wp_send_json_error( [ 'message' => 'OpenAI API key not configured.' ] );

    $prompt = "Generate three compliant social posts for a Mortgage Loan Officer. Return ONLY JSON: {linkedin, instagram, tiktok}.\nlinkedin: 150-300 words, professional, 2-3 hashtags.\ninstagram: 80-150 words, conversational, 5-8 hashtags.\ntiktok: 30-45s script with [VISUAL CUE] directions.\nNo disclosure in output.\n\nARTICLE:\n{$article}";
    $r = ypnus_openai( $api_key, $prompt, 0.7 );
    $posts = json_decode( $r['content'] ?? '{}', true );
    if ( ! isset( $posts['linkedin'] ) ) wp_send_json_error( [ 'message' => 'Unexpected format.' ] );
    foreach ( $posts as &$c ) $c .= "\n\n" . $disclosure;
    unset( $c );
    wp_send_json_success( $posts );
}

// ─── AJAX: legacy keyword scout ───────────────────────────────────────────────

add_action( 'wp_ajax_nopriv_ypnus_keyword_scout', 'ypnus_handle_keyword_scout' );
add_action( 'wp_ajax_ypnus_keyword_scout',        'ypnus_handle_keyword_scout' );

function ypnus_handle_keyword_scout() {
    check_ajax_referer( 'ypnus_mlo_nonce', 'nonce' );
    $topic = sanitize_text_field( wp_unslash( $_POST['topic'] ?? '' ) );
    if ( empty( $topic ) ) wp_send_json_error( [ 'message' => 'Enter a topic.' ] );
    $cache_key = 'ypnus_kw_' . md5( strtolower( $topic ) );
    $cached = get_transient( $cache_key );
    if ( $cached !== false ) wp_send_json_success( $cached );
    $api_key = get_option( 'ypnus_mlo_openai_key', '' );
    if ( empty( $api_key ) ) wp_send_json_error( [ 'message' => 'API key not configured.' ] );
    $r = ypnus_openai( $api_key, "SEO specialist for mortgage websites. Generate 10 high-intent long-tail keywords for: \"{$topic}\". For each keyword also rate how well it fits a local MLO website (1–5 stars) and give a one-sentence reason. Return JSON: {\"keywords\":[{\"keyword\":\"\",\"intent\":\"Informational|Commercial|Transactional\",\"difficulty\":\"Easy|Medium|Hard\",\"angle\":\"\",\"website_fit\":1,\"fit_reason\":\"\"}]}", 0.4 );
    $decoded = json_decode( $r['content'] ?? '{}', true );
    $keywords = $decoded['keywords'] ?? [];
    if ( $keywords ) set_transient( $cache_key, $keywords, DAY_IN_SECONDS );
    wp_send_json_success( $keywords );
}

// ─── OpenAI helper ────────────────────────────────────────────────────────────

function ypnus_openai( $api_key, $prompt, $temp = 0.5, $timeout = 60, $system = '' ) {
    $messages = [];
    if ( $system ) $messages[] = [ 'role' => 'system', 'content' => $system ];
    $messages[] = [ 'role' => 'user', 'content' => $prompt ];

    $r = wp_remote_post( 'https://api.openai.com/v1/chat/completions', [
        'timeout' => $timeout,
        'headers' => [ 'Authorization' => 'Bearer ' . $api_key, 'Content-Type' => 'application/json' ],
        'body'    => json_encode( [
            'model'           => 'gpt-4o-mini',
            'messages'        => $messages,
            'temperature'     => $temp,
            'response_format' => [ 'type' => 'json_object' ],
        ] ),
    ] );

    if ( is_wp_error( $r ) ) return [ 'error' => $r->get_error_message() ];
    $body = json_decode( wp_remote_retrieve_body( $r ), true );
    return [
        'content' => $body['choices'][0]['message']['content'] ?? null,
        'error'   => $body['error']['message'] ?? null,
    ];
}

// ─── Auto-category ────────────────────────────────────────────────────────────

function ypnus_auto_category( $context, $override_slug = '' ) {
    if ( $override_slug ) {
        $term = get_term_by( 'slug', $override_slug, 'category' );
        if ( $term ) return $term->term_id;
    }
    $ctx = strtolower( $context );
    $map = [
        'local-markets'        => [ 'fresno', 'sacramento', 'bakersfield', 'stockton', 'modesto', 'los angeles', 'san diego', 'city', 'local', 'market', 'area', 'county', 'region' ],
        'financing-mastery'    => [ 'va loan', 'fha', 'dscr', 'jumbo', 'conventional', 'usda', 'reverse mortgage', 'heloc', 'refinance', 'first-time', 'down payment', 'home loan', 'mortgage loan', 'interest rate', 'arm ', 'fixed rate' ],
        'lead-generation'      => [ 'lead', 'landing page', 'capture', 'funnel', 'opt-in', 'contact', 'call to action', 'form', 'convert', 'pipeline' ],
        'mortgage-marketing'   => [ 'marketing', 'brand', 'content', 'social', 'email', 'newsletter', 'campaign', 'gmb', 'google my business', 'google business', 'seo', 'rank', 'keyword', 'blog' ],
        'realtor-partnerships' => [ 'realtor', 'agent', 'partner', 'referral', 'co-market', 'open house', 'listing', 'broker' ],
        'mlo-growth-engine'    => [ 'growth', 'strategy', 'system', 'process', 'workflow', 'automation', 'scale', 'plan', 'playbook', 'training', 'coaching' ],
        'ai-tools'             => [ 'ai ', 'artificial intelligence', 'chatgpt', 'openai', 'automation', 'tool', 'software', 'technology', 'plugin' ],
    ];
    foreach ( $map as $slug => $keywords ) {
        foreach ( $keywords as $kw ) {
            if ( str_contains( $ctx, $kw ) ) {
                $term = get_term_by( 'slug', $slug, 'category' );
                if ( $term ) return $term->term_id;
            }
        }
    }
    $default = get_term_by( 'slug', 'financing-mastery', 'category' );
    return $default ? $default->term_id : 0;
}

// ─── Publish page helper ──────────────────────────────────────────────────────

function ypnus_publish_draft( $title, $html, $context, $category_slug, $meta_title = '', $meta_desc = '' ) {
    $cat_id  = ypnus_auto_category( $context, $category_slug );
    $post_id = wp_insert_post( [
        'post_title'   => $title,
        'post_content' => $html,
        'post_status'  => 'draft',
        'post_type'    => 'page',
        'post_category'=> $cat_id ? [ $cat_id ] : [],
    ] );
    if ( $post_id && ! is_wp_error( $post_id ) ) {
        if ( $meta_title ) update_post_meta( $post_id, 'rank_math_title',       $meta_title );
        if ( $meta_desc  ) update_post_meta( $post_id, 'rank_math_description', $meta_desc );
        return [
            'wp_post_id'      => $post_id,
            'wp_edit_url'     => admin_url( "post.php?post={$post_id}&action=edit" ),
            'wp_preview_url'  => get_preview_post_link( $post_id ),
        ];
    }
    return [];
}

// ─── AJAX: Agentic Chat ───────────────────────────────────────────────────────

add_action( 'wp_ajax_nopriv_ypnus_agent_chat', 'ypnus_handle_agent_chat' );
add_action( 'wp_ajax_ypnus_agent_chat',        'ypnus_handle_agent_chat' );

function ypnus_handle_agent_chat() {
    check_ajax_referer( 'ypnus_mlo_nonce', 'nonce' );

    $api_key = get_option( 'ypnus_mlo_openai_key', '' );
    if ( empty( $api_key ) ) wp_send_json_error( [ 'message' => 'OpenAI API key not configured.' ] );

    $history = json_decode( wp_unslash( $_POST['history'] ?? '[]' ), true );
    if ( ! is_array( $history ) ) $history = [];
    $history = array_map( fn( $m ) => [
        'role'    => sanitize_text_field( $m['role'] ?? 'user' ),
        'content' => sanitize_textarea_field( $m['content'] ?? '' ),
    ], $history );

    $nmls       = get_option( 'ypnus_mlo_nmls', '' );
    $company    = get_option( 'ypnus_mlo_company', '' );
    $disclosure = get_option( 'ypnus_mlo_disclosure', ypnus_mlo_default_disclosure() );
    $silos_raw  = get_option( 'ypnus_mlo_silos', ypnus_mlo_default_silos() );
    $silos      = json_decode( $silos_raw, true );
    $silo_list  = is_array( $silos ) ? implode( ', ', array_map( fn( $s ) => $s['label'], $silos ) ) : 'MLO Marketing, Mortgage Compliance';
    $memory_str = ypnus_format_memory_for_prompt();

    // Build dynamic tool routing hints from custom tools
    $dtools     = array_filter( ypnus_get_tools(), fn( $t ) => ! empty( $t['enabled'] ) );
    $dtool_hint = '';
    foreach ( $dtools as $t ) {
        $slug = $t['slug'] ?? '';
        $kw   = $t['keywords'] ?? '';
        if ( $slug && $kw ) $dtool_hint .= "- User mentions any of [{$kw}] → call custom tool `{$slug}`\n";
    }

    $system = <<<SYSTEM
You are the YPNUS MLO Agent — a self-learning AI for Mortgage Loan Officers. You MUST use a tool for EVERY request. Never answer from general knowledge. Never give a one-sentence reply.

MLO: {$company} | NMLS #{$nmls}
Disclosure: {$disclosure}
Content silos: {$silo_list}
{$memory_str}

MANDATORY TOOL ROUTING:
- "help me build my site", "I'm new", "just starting", "getting started", "build my website", "where do I start", "set up my site", "onboard me", "website wizard", "site wizard" → site_wizard
- "build all my pages", "build everything", "create all pages", "build the whole site", "all at once", "turnkey" → build_full_site
- "page", "build", "landing page", "create a page" → build_page
- "article", "write an article", "blog post", "1500 words", "long form", "write about", "SEO article", "content piece", "affiliate", "backlinks" → write_article
- "website", "site plan", "what pages", "site structure" → plan_website
- "post", "social", "LinkedIn", "Instagram", "TikTok", "write me" → generate_social_posts
- "keyword", "SEO", "rank", "search" → scout_keywords
- "compliance", "check this", "is this ok", "CFPB", "audit" → check_compliance
- "silo", "where to publish", "organize", "structure" → suggest_silo
- "broken", "error", "not working", "white screen", "fix", "problem" → diagnose_error
- "google my business", "GMB", "google business profile", "local listing", "local seo score" → score_gmb
- User wants to remember something, "remember that", "save this" → save_memory
- User asks what you know, "what do you remember" → recall_memory
- User asks you to build a new capability, "teach yourself", "add a tool", "you can't do X" → create_tool
- User wants to change how an existing tool works → update_tool
- User mentions "plugin", "install", "what plugin", "best plugin", "plugin conflict", "plugin recommendation", "which plugin", "do I need", "plugin for" → recommend_plugins
- User mentions "html", "css", "javascript", "js", "frontend", "front end", "design", "layout", "hero section", "banner", "card", "grid", "animation", "slider", "accordion", "FAQ", "modal", "tab", "responsive", "mobile", "button style", "color scheme", "landing page design", "page section", "UI", "user interface", "Tailwind", "flex", "flexbox", "component", "pricing table design", "testimonial section", "CTA block", "sticky header" → frontend_developer
- User mentions "speed", "slow", "fast", "performance", "Core Web Vitals", "CWV", "LCP", "CLS", "INP", "TTFB", "PageSpeed", "Lighthouse", "caching", "cache", "minif", "lazy load", "CDN", "image optim", "compress", "defer", "render block", "database slow", "query slow", "OPcache", "LiteSpeed", "WP Rocket", "W3TC", "optimize", "Google score" → performance_engineer
- User mentions "schema", "structured data", "JSON-LD", "rich result", "rich snippet", "local business markup", "FAQ schema", "review stars", "star rating Google", "breadcrumb schema", "LocalBusiness", "MortgageLender", "markup" → schema_markup_builder
- User mentions "code", "php", "function", "snippet", "plugin", "hook", "filter", "action", "custom post type", "CPT", "meta box", "REST API", "endpoint", "ajax", "database", "SQL", "query", "cron", "wp-cli", "child theme", "functions.php", "shortcode", "widget", "admin page", "build me a", "write me a", "create a script", "backend", "developer", "debug this code", "error in my code", "PHP error", "fatal error" → backend_developer
- User mentions "menu", "nav", "navigation", "remove from menu", "add to menu", "menu item", "header link", "show me the menu", "take out", "delete from nav" → manage_nav_menu
- User mentions "marketing", "funnel", "email sequence", "conversion", "optimize my site", "get more leads", "marketing strategy", "grow my business", "maximize", "marketing stack", "CRM", "email marketing", "drip campaign", "follow up", "automate marketing" → marketing_advisor
- User mentions "CRO", "conversion rate", "A/B test", "heatmap", "button color", "headline test", "form conversion", "landing page test", "bounce rate", "exit intent", "above the fold", "split test", "persuasion", "trust signal", "social proof", "urgency", "scarcity", "improve my page", "why aren't people converting", "increase sign-ups" → cro_specialist
- User mentions "email sequence", "drip sequence", "follow-up emails", "nurture sequence", "welcome series", "email funnel", "email automation", "write me emails", "email campaign", "lead magnet follow up", "onboarding emails", "borrower email", "realtor email sequence" → email_sequence_writer
- User mentions "content strategy", "what should I write", "content plan", "editorial calendar", "content calendar", "content ideas", "blog strategy", "content roadmap", "pillar page", "cluster", "topic authority", "content gap", "what topics", "content for MLO", "content marketing plan" → content_strategist
- User mentions "video", "YouTube", "reel", "short video", "TikTok video", "script", "talking head", "video script", "record a video", "explainer video", "mortgage video", "video content", "video for MLO", "video idea" → video_script_writer
- User mentions "realtor", "real estate agent", "referral partner", "builder partner", "partnership", "co-marketing", "referral system", "agent outreach", "build realtor relationships", "agent pipeline", "real estate partnerships", "referral network" → realtor_partner_system
- User mentions "analytics", "Google Analytics", "GA4", "stats", "traffic data", "which pages", "what's working", "bounce rate data", "conversion data", "interpret my data", "read my analytics", "what do my numbers mean", "site performance data", "sessions", "pageviews", "funnel drop-off" → analytics_interpreter
{$dtool_hint}
- When in doubt: call the most relevant tool. NEVER skip.

After every tool result: give a complete, detailed, actionable response — never one sentence. Always tell the MLO exactly what to do next in plain English. Be encouraging and specific — these are busy professionals who need a guide, not a tool.
If the MLO seems new or hasn't built pages yet: proactively suggest running site_wizard to get their full plan.
Rules: Never promise specific rates or guaranteed approvals. Always append disclosure to social content.
SYSTEM;

    // Core tool definitions (filter out admin-disabled tools)
    $disabled_core = get_option( 'ypnus_disabled_core_tools', [] );
    $core_tools = array_values( array_filter(
        ypnus_core_tool_definitions(),
        fn( $t ) => ! in_array( $t['function']['name'] ?? '', $disabled_core, true )
    ) );

    // Dynamic tool definitions
    $dynamic_tools = ypnus_dynamic_tool_definitions();

    $all_tools = array_merge( $core_tools, $dynamic_tools );

    $messages = array_merge( [ [ 'role' => 'system', 'content' => $system ] ], $history );

    $response = wp_remote_post( 'https://api.openai.com/v1/chat/completions', [
        'timeout' => 30,
        'headers' => [ 'Authorization' => 'Bearer ' . $api_key, 'Content-Type' => 'application/json' ],
        'body'    => json_encode( [
            'model'       => 'gpt-4o-mini',
            'messages'    => $messages,
            'tools'       => $all_tools,
            'tool_choice' => 'required',
            'temperature' => 0.3,
        ] ),
    ] );

    if ( is_wp_error( $response ) ) wp_send_json_error( [ 'message' => 'API error: ' . $response->get_error_message() ] );

    $data    = json_decode( wp_remote_retrieve_body( $response ), true );
    $message = $data['choices'][0]['message'] ?? null;

    if ( ! $message || empty( $message['tool_calls'] ) ) {
        $debug = [
            'http_code' => wp_remote_retrieve_response_code( $response ),
            'finish'    => $data['choices'][0]['finish_reason'] ?? null,
            'error'     => $data['error']['message'] ?? null,
            'content'   => $data['choices'][0]['message']['content'] ?? null,
        ];
        wp_send_json_error( [ 'message' => 'Agent could not route request. Debug: ' . json_encode( $debug ) ] );
    }

    $output_parts = [];
    foreach ( $message['tool_calls'] as $tc ) {
        $fn_name = $tc['function']['name'] ?? '';
        $fn_args = json_decode( $tc['function']['arguments'] ?? '{}', true );
        $result  = ypnus_run_agent_tool( $fn_name, $fn_args, $api_key, $disclosure );
        $output_parts[] = ypnus_format_tool_result( $fn_name, $fn_args, $result );
    }

    wp_send_json_success( [ 'reply' => implode( "\n\n---\n\n", $output_parts ) ] );
}

// ─── Core tool definitions ────────────────────────────────────────────────────

function ypnus_core_tool_definitions() {
    return [
        [ 'type' => 'function', 'function' => [ 'name' => 'generate_social_posts', 'description' => 'Generate three FINRA/CFPB-compliant social media posts (LinkedIn, Instagram, TikTok).', 'parameters' => [ 'type' => 'object', 'properties' => [ 'source_text' => [ 'type' => 'string', 'description' => 'Topic or article text.' ], 'loan_type' => [ 'type' => 'string', 'description' => 'Optional mortgage product focus.' ] ], 'required' => [ 'source_text' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'scout_keywords', 'description' => 'Return 10 high-intent long-tail SEO keywords for a mortgage topic.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'topic' => [ 'type' => 'string', 'description' => 'Mortgage topic to research.' ] ], 'required' => [ 'topic' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'check_compliance', 'description' => 'Audit mortgage marketing text for CFPB/FINRA compliance.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'content' => [ 'type' => 'string', 'description' => 'Marketing copy to audit.' ] ], 'required' => [ 'content' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'suggest_silo', 'description' => 'Recommend the best content silo and URL for a topic.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'topic' => [ 'type' => 'string', 'description' => 'Topic to place.' ] ], 'required' => [ 'topic' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'build_page', 'description' => 'Generate complete conversion-optimized page copy and publish as WordPress draft.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'page_type' => [ 'type' => 'string', 'description' => 'Type of page (VA loan, FHA, DSCR, about, etc).' ], 'city' => [ 'type' => 'string', 'description' => 'Optional city/state.' ], 'angle' => [ 'type' => 'string', 'description' => 'Optional selling angle.' ] ], 'required' => [ 'page_type' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'diagnose_error', 'description' => 'Diagnose any WordPress error, broken behavior, plugin conflict, white screen, or site problem.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'symptom' => [ 'type' => 'string', 'description' => 'Full description of the problem.' ], 'context' => [ 'type' => 'string', 'description' => 'Optional: theme, plugins, hosting.' ] ], 'required' => [ 'symptom' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'site_wizard', 'description' => 'Onboard a new MLO and generate their complete website launch plan with prioritized page build order, plugin checklist, conversion rules, and step-by-step launch checklist. Use when someone wants to build their website, is just starting out, or says "help me build my site".', 'parameters' => [ 'type' => 'object', 'properties' => [ 'full_name' => [ 'type' => 'string', 'description' => 'MLO full name.' ], 'city' => [ 'type' => 'string', 'description' => 'Primary market city and state.' ], 'loan_niches' => [ 'type' => 'string', 'description' => 'Comma-separated loan types they specialize in (e.g. VA, FHA, DSCR, Jumbo).' ], 'target_buyer' => [ 'type' => 'string', 'description' => 'Who they serve (e.g. first-time buyers, veterans, investors, move-up buyers).' ], 'primary_goal' => [ 'type' => 'string', 'description' => 'Their #1 website goal (e.g. generate leads, rank locally, build referral partner trust).' ] ], 'required' => [ 'city', 'loan_niches' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'build_full_site', 'description' => 'Bulk-create all core website pages as WordPress drafts in one shot — homepage, about, contact, loan type pages, local area pages — each conversion-optimized with CTAs, lead forms, trust signals, and NMLS disclosure. Use when someone says "build my whole site", "build all my pages", or after site_wizard runs.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'city' => [ 'type' => 'string', 'description' => 'Primary market city (pulled from memory if saved).' ], 'loan_niches' => [ 'type' => 'string', 'description' => 'Loan types to build pages for (pulled from memory if saved).' ], 'target_buyer' => [ 'type' => 'string', 'description' => 'Target audience (pulled from memory if saved).' ] ], 'required' => [] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'write_article', 'description' => 'Write a full 1500–2000 word SEO article with internal links, authority backlinks, and optional affiliate product mentions. Saves as WordPress draft.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'topic' => [ 'type' => 'string', 'description' => 'Article topic (e.g. "FHA loans for first-time buyers").' ], 'city' => [ 'type' => 'string', 'description' => 'Optional city/market for local SEO.' ], 'loan_type' => [ 'type' => 'string', 'description' => 'Optional loan type focus (FHA, VA, USDA, Conventional, Jumbo).' ], 'include_affiliates' => [ 'type' => 'boolean', 'description' => 'Set true to include relevant affiliate product links (credit monitoring, insurance, etc).' ] ], 'required' => [ 'topic' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'plan_website', 'description' => 'Generate a complete website architecture for an MLO.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'niche' => [ 'type' => 'string', 'description' => 'Loan niche(s).' ], 'market' => [ 'type' => 'string', 'description' => 'Optional geographic market.' ], 'goal' => [ 'type' => 'string', 'description' => 'Optional business goal.' ] ], 'required' => [ 'niche' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'score_gmb', 'description' => 'Score and optimize a Google Business Profile for an MLO. Returns 0-100 score with action items.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'business_name' => [ 'type' => 'string', 'description' => 'Business name on Google.' ], 'city' => [ 'type' => 'string', 'description' => 'City and state.' ], 'categories' => [ 'type' => 'string', 'description' => 'Current GMB categories.' ], 'review_count' => [ 'type' => 'integer', 'description' => 'Number of reviews.' ], 'avg_rating' => [ 'type' => 'number', 'description' => 'Average star rating.' ], 'has_photos' => [ 'type' => 'boolean', 'description' => 'Photos uploaded?' ], 'posts_per_month' => [ 'type' => 'integer', 'description' => 'Posts per month.' ], 'has_qa' => [ 'type' => 'boolean', 'description' => 'Q&A filled in?' ], 'services_listed' => [ 'type' => 'boolean', 'description' => 'Services listed?' ], 'description_filled' => [ 'type' => 'boolean', 'description' => 'Description filled?' ] ], 'required' => [ 'business_name', 'city' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'save_memory', 'description' => 'Save a fact about this MLO to long-term memory so it persists across all future conversations.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'key' => [ 'type' => 'string', 'description' => 'Short key (e.g. primary_market, loan_niche, top_realtor_partner).' ], 'value' => [ 'type' => 'string', 'description' => 'The value to remember.' ] ], 'required' => [ 'key', 'value' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'recall_memory', 'description' => 'Retrieve everything currently saved in agent memory.', 'parameters' => [ 'type' => 'object', 'properties' => (object)[], 'required' => [] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'create_tool', 'description' => 'Create a new custom agent tool and save it permanently. Use when the user asks for a capability that does not exist yet.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'name' => [ 'type' => 'string', 'description' => 'Human-readable tool name.' ], 'desc' => [ 'type' => 'string', 'description' => 'What this tool does.' ], 'keywords' => [ 'type' => 'string', 'description' => 'Comma-separated trigger keywords.' ], 'prompt' => [ 'type' => 'string', 'description' => 'The AI prompt template. Use {args.field}, {nmls}, {company}, {disclosure} as placeholders.' ], 'format' => [ 'type' => 'string', 'description' => 'Output format: text | social_posts | page | keyword_table' ], 'category' => [ 'type' => 'string', 'description' => 'WordPress category slug for page output.' ] ], 'required' => [ 'name', 'prompt' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'update_tool', 'description' => 'Update the prompt or settings of an existing custom tool.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'slug' => [ 'type' => 'string', 'description' => 'The tool slug to update.' ], 'prompt' => [ 'type' => 'string', 'description' => 'New prompt template.' ], 'keywords' => [ 'type' => 'string', 'description' => 'New trigger keywords.' ], 'desc' => [ 'type' => 'string', 'description' => 'New description.' ] ], 'required' => [ 'slug' ] ] ] ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'recommend_plugins',
                'description' => 'Recommend the best WordPress plugins for a specific need. Knows the full WordPress plugin ecosystem and gives opinionated, stack-specific advice for Hostinger shared hosting, GeneratePress theme, PHP 8.3, and a mortgage MLO site. Covers SEO, caching, lead capture, email/CRM, payments, security, backups, forms, popups, page builders, and more. Also diagnoses plugin conflicts and bloat.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'need' => [
                            'type'        => 'string',
                            'description' => 'What the user needs the plugin(s) to do. Be specific. Examples: "capture leads from my VA loan page", "speed up my site", "send email follow-ups", "collect payments", "rank better on Google", "protect my site from spam".',
                        ],
                        'currently_installed' => [
                            'type'        => 'string',
                            'description' => 'Optional: plugins currently active on the site. If unknown, leave blank and the advisor will use known site context.',
                        ],
                        'concern' => [
                            'type'        => 'string',
                            'description' => 'Optional: specific concern like "I don\'t want anything that slows my site" or "it needs to be free" or "is X plugin worth it?".',
                        ],
                    ],
                    'required' => [ 'need' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'manage_nav_menu',
                'description' => 'View, add, remove, or reorder items in any WordPress navigation menu. Use when the user asks to change the nav menu, add a page to the menu, remove a menu item, or reorder navigation links.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'action' => [
                            'type'        => 'string',
                            'enum'        => [ 'list', 'remove', 'add' ],
                            'description' => 'list = show all menu items; remove = delete an item by title/label; add = add a URL to the menu.',
                        ],
                        'item_title' => [
                            'type'        => 'string',
                            'description' => 'For remove: the nav label to remove (partial match, case-insensitive). For add: the link label to display.',
                        ],
                        'item_url' => [
                            'type'        => 'string',
                            'description' => 'For add: the full URL or path to add to the menu.',
                        ],
                        'menu_name' => [
                            'type'        => 'string',
                            'description' => 'Optional menu name or slug. Defaults to the primary nav menu.',
                        ],
                    ],
                    'required' => [ 'action' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'frontend_developer',
                'description' => 'Senior frontend developer specialist. Writes production-ready HTML, CSS, and JavaScript for WordPress pages, custom sections, hero blocks, animated components, responsive layouts, and interactive UI elements. Knows GeneratePress theme structure, Gutenberg block HTML output, CSS custom properties, Flexbox/Grid, vanilla JS (no jQuery dependency), and Hostinger-compatible inline/enqueued assets. Also handles Tailwind utility classes if requested. Outputs complete copy-paste code — never pseudo-code. Use when the user needs a page section, custom hero, pricing table, card grid, testimonial slider, FAQ accordion, sticky nav, animated CTA, modal, tab component, or any HTML/CSS/JS UI work.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'task' => [
                            'type'        => 'string',
                            'description' => 'What to build. Describe the UI component, layout, or page section in plain English.',
                        ],
                        'context' => [
                            'type'        => 'string',
                            'description' => 'Optional: existing HTML to modify, brand colors, font names, or design constraints.',
                        ],
                        'output_type' => [
                            'type'        => 'string',
                            'enum'        => [ 'html_css_js', 'gutenberg_block_html', 'wp_shortcode', 'css_only', 'js_only', 'full_page_section' ],
                            'description' => 'Format of the output. Defaults to html_css_js.',
                        ],
                        'save_as_draft' => [
                            'type'        => 'boolean',
                            'description' => 'Save the output as a WordPress draft post for easy access later.',
                        ],
                    ],
                    'required' => [ 'task' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'performance_engineer',
                'description' => 'WordPress performance and Core Web Vitals specialist. Audits and fixes LCP, CLS, INP, FID, TTFB on Hostinger shared hosting. Configures caching (LiteSpeed, WP Rocket, W3TC), image optimization, lazy loading, critical CSS, font loading, JS/CSS minification and deferral, database cleanup, slow query identification, and CDN setup. Knows Hostinger LiteSpeed server specifics, PHP 8.3 OPcache, and GeneratePress performance settings. Returns a prioritized action plan with exact settings and code changes — not generic advice. Use when the user asks about site speed, slow loading, Core Web Vitals scores, Google PageSpeed, caching, or optimization.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'symptom' => [
                            'type'        => 'string',
                            'description' => 'What is slow or what score/metric needs improving. E.g. "LCP is 4.2s on mobile", "PageSpeed score is 54", "site feels slow on 3G", "TTFB is 800ms".',
                        ],
                        'current_setup' => [
                            'type'        => 'string',
                            'description' => 'Optional: active caching plugin, image plugin, CDN, page builder, known heavy plugins.',
                        ],
                        'page_url' => [
                            'type'        => 'string',
                            'description' => 'Optional: specific page URL to diagnose.',
                        ],
                    ],
                    'required' => [ 'symptom' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'schema_markup_builder',
                'description' => 'Builds complete JSON-LD schema markup for WordPress pages. Generates LocalBusiness, MortgageLender, LoanOrFund, FAQPage, HowTo, Review, AggregateRating, BreadcrumbList, WebPage, and Person schemas. Outputs ready-to-paste script blocks and explains which pages to add them to for maximum Google rich result eligibility. Use when the user asks about schema, structured data, rich results, JSON-LD, local business markup, FAQ schema, or review stars in Google.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'schema_type' => [
                            'type'        => 'string',
                            'enum'        => [ 'local_business', 'mortgage_lender', 'faq', 'how_to', 'review', 'breadcrumb', 'person', 'webpage', 'auto' ],
                            'description' => 'Type of schema to generate. Use auto to let the agent decide based on the page description.',
                        ],
                        'page_description' => [
                            'type'        => 'string',
                            'description' => 'Describe the page this schema is for. E.g. "VA loans page for Fresno CA", "homepage", "about page for MLO named Dave", "FAQ page about FHA loans".',
                        ],
                        'business_details' => [
                            'type'        => 'string',
                            'description' => 'Optional: business name, address, phone, hours, NMLS number, review count, rating. Leave blank to use plugin settings.',
                        ],
                    ],
                    'required' => [ 'page_description' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'backend_developer',
                'description' => 'Senior WordPress backend developer specialist. Writes production-ready PHP code, builds custom plugins and theme functions, creates REST API endpoints, custom post types, meta boxes, admin pages, AJAX handlers, WP-CLI commands, database queries, and cron jobs. Debugs PHP errors, hook conflicts, and performance issues. Knows Hostinger shared hosting constraints (PHP 8.3, MySQL 8, no root access), GeneratePress theme hooks, and WordPress coding standards. Always outputs complete, copy-paste-ready code with inline comments. Use when the user asks for custom code, a plugin snippet, a function, a REST route, a database fix, or any PHP/WordPress development task.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'task' => [
                            'type'        => 'string',
                            'description' => 'What to build or fix. Be specific — include what the code should do, any inputs/outputs, and where it will run (plugin file, functions.php, child theme, etc.).',
                        ],
                        'context' => [
                            'type'        => 'string',
                            'description' => 'Optional: existing code, error messages, plugin names, table names, or any other relevant technical context.',
                        ],
                        'output_format' => [
                            'type'        => 'string',
                            'enum'        => [ 'plugin_snippet', 'functions_php', 'rest_endpoint', 'cpt_registration', 'ajax_handler', 'db_query', 'cli_command', 'full_plugin', 'debug_analysis' ],
                            'description' => 'The type of output needed. Omit if unsure — the agent will decide.',
                        ],
                        'save_as_draft' => [
                            'type'        => 'boolean',
                            'description' => 'Set true to save the generated code as a WordPress draft post so you can copy it from the admin.',
                        ],
                    ],
                    'required' => [ 'task' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'video_script_writer',
                'description' => 'Writes complete, ready-to-record video scripts for MLOs. Produces YouTube explainer videos, short-form Reels/TikToks, talking-head introductions, loan product explainers, FAQ videos, local market updates, realtor co-marketing videos, and testimonial prompts. Each script includes a hook, talking points, B-roll cues, on-screen text suggestions, and a CTA. All content is RESPA-compliant — no rate promises, no approval guarantees. Use when the user asks to write a video script, create video content, record a YouTube video, make a reel, or produce any mortgage video.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'topic'       => [
                            'type'        => 'string',
                            'description' => 'What the video is about. E.g. "How VA loans work in Fresno CA", "5 mistakes first-time buyers make", "What is a DSCR loan", "Why work with an MLO".',
                        ],
                        'format'      => [
                            'type'        => 'string',
                            'enum'        => [ 'youtube_long', 'short_reel', 'talking_head_intro', 'loan_explainer', 'faq_video', 'local_market_update', 'realtor_collab', 'testimonial_prompt' ],
                            'description' => 'Video format. youtube_long = 5-10 min; short_reel = 30-60 sec; others are 1-3 min.',
                        ],
                        'target_audience' => [
                            'type'        => 'string',
                            'description' => 'Who will watch. E.g. "first-time buyers in Fresno CA", "real estate investors", "military veterans", "real estate agents".',
                        ],
                        'include_broll' => [
                            'type'        => 'boolean',
                            'description' => 'Set true to include B-roll shot suggestions and on-screen text overlays.',
                        ],
                    ],
                    'required' => [ 'topic' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'realtor_partner_system',
                'description' => 'Builds complete realtor referral partnership systems for MLOs. Creates outreach scripts (email, phone, text, LinkedIn), co-marketing content plans, joint webinar frameworks, open house flyer copy, value proposition messaging for realtors, partner onboarding sequences, and CRM tagging strategies for agent partners. Also generates a partnership tier structure (active / preferred / elite) with benefits for each level. Use when the user asks about building realtor relationships, agent partnerships, referral systems, co-marketing, or growing their referral network.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'output_type' => [
                            'type'        => 'string',
                            'enum'        => [ 'outreach_scripts', 'co_marketing_plan', 'partnership_tiers', 'onboarding_sequence', 'value_prop_messaging', 'full_system' ],
                            'description' => 'What part of the realtor partner system to build. Use full_system for a complete package.',
                        ],
                        'market'      => [
                            'type'        => 'string',
                            'description' => 'Geographic market to target. E.g. "Fresno CA", "Las Vegas NV and Phoenix AZ", "Central Valley California".',
                        ],
                        'loan_specialty' => [
                            'type'        => 'string',
                            'description' => 'Optional: loan type(s) the MLO specializes in that realtors should know about. E.g. "VA loans and FHA", "jumbo and conventional", "DSCR investor loans".',
                        ],
                        'agent_count_goal' => [
                            'type'        => 'integer',
                            'description' => 'Optional: how many active referral agents the MLO wants to build relationships with. Used to size the system.',
                        ],
                    ],
                    'required' => [ 'output_type', 'market' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'analytics_interpreter',
                'description' => 'Interprets website analytics data for MLOs and turns raw numbers into clear business decisions. Reads GA4 reports, traffic breakdowns, page performance data, funnel drop-off points, keyword rankings, and conversion data — then explains in plain English what is working, what is broken, and exactly what to do next. Identifies top-performing pages to double down on, weak pages to fix or retire, traffic sources to invest in, and funnel leaks to plug. Use when the user shares analytics data, asks what their numbers mean, wants to understand their traffic, or asks which pages are performing.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'data_snapshot' => [
                            'type'        => 'string',
                            'description' => 'Paste the raw analytics data here — GA4 export, table of pages/sessions/bounce rates, keyword rankings, or any traffic numbers you want interpreted.',
                        ],
                        'question'      => [
                            'type'        => 'string',
                            'description' => 'Optional: specific question about the data. E.g. "Why is my bounce rate so high?", "Which pages should I improve first?", "Where am I losing leads in the funnel?".',
                        ],
                        'business_context' => [
                            'type'        => 'string',
                            'description' => 'Optional: what the site is trying to do. Defaults to "convert mortgage prospects into demo sign-ups and loan applications".',
                        ],
                    ],
                    'required' => [ 'data_snapshot' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'cro_specialist',
                'description' => 'Conversion Rate Optimization specialist for MLO websites. Audits landing pages, hero sections, CTAs, forms, trust signals, headline copy, button placement, above-the-fold layout, and mobile UX. Recommends specific copy changes, element repositioning, color/contrast fixes, urgency/social-proof additions, and A/B test hypotheses — all with reasoning. Knows mortgage borrower psychology and what makes MLO prospects convert. Returns a prioritized list of changes ranked by expected impact. Use when the user asks why visitors aren\'t converting, wants to improve a page, asks about A/B testing, bounce rate, form optimization, CTA optimization, trust signals, or conversion rate.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'page_or_section' => [
                            'type'        => 'string',
                            'description' => 'Which page or section to audit. E.g. "homepage hero", "FHA loans page", "pricing page", "demo signup form", "about page".',
                        ],
                        'current_copy'    => [
                            'type'        => 'string',
                            'description' => 'Optional: paste the current headline, subheading, CTA text, or full section HTML to get specific rewrites.',
                        ],
                        'goal'            => [
                            'type'        => 'string',
                            'description' => 'Optional: what conversion action you want visitors to take. Defaults to booking a demo or starting an application.',
                        ],
                    ],
                    'required' => [ 'page_or_section' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'email_sequence_writer',
                'description' => 'Writes complete RESPA-compliant email nurture sequences for MLOs. Generates welcome series, post-inquiry drip campaigns, pre-approval follow-ups, realtor partner outreach sequences, rate-alert drips, borrower educational series, and re-engagement campaigns. Each email includes subject line, preview text, full body copy, and a CTA. Calibrated for mortgage compliance — no rate guarantees, no fee promises, no discriminatory language, no trigger words. Use when the user wants to write email sequences, follow-up emails, a nurture campaign, borrower emails, realtor emails, or any email marketing content.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'sequence_type' => [
                            'type'        => 'string',
                            'enum'        => [ 'welcome_series', 'post_inquiry_drip', 'pre_approval_followup', 'realtor_partner_outreach', 'rate_alert', 'educational_series', 're_engagement', 'custom' ],
                            'description' => 'Type of email sequence to write.',
                        ],
                        'audience'      => [
                            'type'        => 'string',
                            'description' => 'Who the emails are for. E.g. "first-time homebuyers in Fresno CA", "real estate agents in Las Vegas", "investors interested in DSCR loans".',
                        ],
                        'loan_focus'    => [
                            'type'        => 'string',
                            'description' => 'Optional: loan type to center the sequence around. E.g. "VA loans", "FHA", "DSCR investor loans", "jumbo".',
                        ],
                        'num_emails'    => [
                            'type'        => 'integer',
                            'description' => 'How many emails in the sequence. Defaults to 5.',
                        ],
                        'tone'          => [
                            'type'        => 'string',
                            'enum'        => [ 'professional', 'friendly', 'educational', 'urgent' ],
                            'description' => 'Voice and tone for the sequence. Defaults to friendly.',
                        ],
                    ],
                    'required' => [ 'sequence_type', 'audience' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'content_strategist',
                'description' => 'Senior content strategist for MLO websites. Builds full content plans: pillar pages, topic clusters, blog editorial calendars, lead magnet ideas, video topics, content repurposing plans, and keyword-to-content mapping. Identifies content gaps vs. competitors, suggests high-intent topics, and maps each piece of content to a funnel stage (awareness/consideration/decision). Knows local mortgage SEO and what MLO prospects actually search for. Use when the user asks what to write, wants a content plan, content calendar, blog strategy, topic ideas, pillar page strategy, or wants to understand their content gaps.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'focus'          => [
                            'type'        => 'string',
                            'description' => 'The content focus area. E.g. "VA loans in Fresno CA", "DSCR investor loans", "first-time homebuyer education", "refinance content", "realtor partnership content".',
                        ],
                        'output_type'    => [
                            'type'        => 'string',
                            'enum'        => [ 'editorial_calendar', 'pillar_cluster_map', 'blog_topic_list', 'lead_magnet_ideas', 'content_gap_analysis', 'full_strategy' ],
                            'description' => 'What kind of content plan to produce. Use full_strategy for a comprehensive deliverable.',
                        ],
                        'time_horizon'   => [
                            'type'        => 'string',
                            'enum'        => [ '30_days', '90_days', '6_months', '12_months' ],
                            'description' => 'Planning horizon. Defaults to 90_days.',
                        ],
                        'current_content' => [
                            'type'        => 'string',
                            'description' => 'Optional: list of existing pages or posts so the strategist can avoid duplicates and find gaps.',
                        ],
                    ],
                    'required' => [ 'focus' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'marketing_advisor',
                'description' => 'Comprehensive WordPress marketing strategy advisor for MLOs. Covers the full marketing stack: lead funnels, email sequences, CRM setup, conversion optimization, landing pages, retargeting, social media automation, referral systems, content marketing, local SEO, and more. Gives a complete actionable plan specific to the MLO\'s WordPress setup and business goals. Use when the user asks about marketing strategy, getting more leads, converting website visitors, email automation, or maximizing their WordPress site for business growth.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'goal' => [
                            'type'        => 'string',
                            'description' => 'The marketing goal or challenge. Examples: "get more leads from my website", "convert more visitors to applications", "set up email follow-up sequences", "optimize my site for conversions", "build a referral system with realtors", "automate my entire marketing".',
                        ],
                        'current_setup' => [
                            'type'        => 'string',
                            'description' => 'Optional: what marketing tools or systems are already in place (email service, CRM, forms, etc.).',
                        ],
                        'budget' => [
                            'type'        => 'string',
                            'description' => 'Optional: monthly budget for marketing tools. Examples: "free only", "under $100/month", "no limit".',
                        ],
                        'niche' => [
                            'type'        => 'string',
                            'description' => 'Optional: loan niche focus (VA, FHA, DSCR, first-time buyers, etc.).',
                        ],
                    ],
                    'required' => [ 'goal' ],
                ],
            ],
        ],
    ];
}

// ─── Dynamic tool definitions (from DB) ───────────────────────────────────────

function ypnus_dynamic_tool_definitions() {
    $tools = array_filter( ypnus_get_tools(), fn( $t ) => ! empty( $t['enabled'] ) );
    $defs  = [];
    foreach ( $tools as $t ) {
        $slug = $t['slug'] ?? '';
        if ( ! $slug ) continue;
        $defs[] = [
            'type'     => 'function',
            'function' => [
                'name'        => 'custom__' . $slug,
                'description' => ( $t['desc'] ?? $t['name'] ?? $slug ) . ' (custom tool)',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'topic'   => [ 'type' => 'string', 'description' => 'The topic or input for this tool.' ],
                        'city'    => [ 'type' => 'string', 'description' => 'Optional city/location.' ],
                        'content' => [ 'type' => 'string', 'description' => 'Optional content input.' ],
                        'details' => [ 'type' => 'string', 'description' => 'Any additional details.' ],
                    ],
                    'required' => [],
                ],
            ],
        ];
    }
    return $defs;
}

// ─── Tool executor ────────────────────────────────────────────────────────────

function ypnus_run_agent_tool( $name, $args, $api_key, $disclosure ) {
    $nmls    = get_option( 'ypnus_mlo_nmls', '' );
    $company = get_option( 'ypnus_mlo_company', '' );

    // Custom tool (prefixed with custom__)
    if ( str_starts_with( $name, 'custom__' ) ) {
        $slug = substr( $name, 8 );
        $tool = ypnus_get_tool_by_slug( $slug );
        if ( ! $tool ) return [ 'error' => "Custom tool '{$slug}' not found." ];
        return ypnus_run_dynamic_tool( $tool, $args, $api_key, $disclosure, $nmls, $company );
    }

    switch ( $name ) {

        case 'save_memory': {
            $key   = $args['key']   ?? '';
            $value = $args['value'] ?? '';
            if ( ! $key ) return [ 'error' => 'Memory key required.' ];
            ypnus_save_memory( $key, $value );
            return [ 'status' => 'saved', 'key' => $key, 'value' => $value ];
        }

        case 'recall_memory': {
            $mem = ypnus_get_memory();
            if ( empty( $mem ) ) return [ 'memory' => [], 'note' => 'No memory saved yet.' ];
            $flat = [];
            foreach ( $mem as $k => $v ) $flat[] = [ 'key' => $k, 'value' => $v['value'] ?? '', 'updated' => $v['updated_at'] ?? '' ];
            return [ 'memory' => $flat ];
        }

        case 'create_tool': {
            $name_val = $args['name']     ?? '';
            $desc     = $args['desc']     ?? '';
            $keywords = $args['keywords'] ?? '';
            $prompt   = $args['prompt']   ?? '';
            $format   = $args['format']   ?? 'text';
            $category = $args['category'] ?? '';
            if ( ! $name_val || ! $prompt ) return [ 'error' => 'Tool name and prompt are required.' ];
            $slug = ypnus_upsert_tool( [
                'name'     => $name_val,
                'desc'     => $desc,
                'keywords' => $keywords,
                'prompt'   => $prompt,
                'format'   => $format,
                'category' => $category,
                'enabled'  => 1,
            ] );
            return [ 'status' => 'created', 'slug' => $slug, 'name' => $name_val, 'message' => "Tool '{$name_val}' created and ready to use." ];
        }

        case 'update_tool': {
            $slug = $args['slug'] ?? '';
            if ( ! $slug ) return [ 'error' => 'Tool slug required.' ];
            $existing = ypnus_get_tool_by_slug( $slug );
            if ( ! $existing ) return [ 'error' => "Tool '{$slug}' not found." ];
            $updated = array_merge( $existing, array_filter( [
                'prompt'   => $args['prompt']   ?? null,
                'keywords' => $args['keywords'] ?? null,
                'desc'     => $args['desc']     ?? null,
            ], fn( $v ) => $v !== null ) );
            ypnus_upsert_tool( $updated );
            return [ 'status' => 'updated', 'slug' => $slug, 'message' => "Tool '{$slug}' updated." ];
        }

        case 'generate_social_posts': {
            $source    = $args['source_text'] ?? '';
            $loan_type = $args['loan_type']   ?? '';
            $focus     = $loan_type ? " Focus on {$loan_type} mortgages." : '';
            $r = ypnus_openai( $api_key, "Generate three compliant social posts for an MLO.{$focus}\nReturn JSON: {linkedin,instagram,tiktok}\nlinkedin: 150-300 words, professional, 2-3 hashtags.\ninstagram: 80-150 words, warm, 5-8 hashtags, 1-2 emojis.\ntiktok: 30-45s script with [VISUAL CUE] directions. No disclosure.\n\nSOURCE:\n{$source}", 0.7, 60 );
            $posts = json_decode( $r['content'] ?? '{}', true );
            foreach ( [ 'linkedin', 'instagram', 'tiktok' ] as $p ) {
                if ( isset( $posts[$p] ) ) $posts[$p] .= "\n\n" . $disclosure;
            }
            return $posts ?: [ 'error' => 'Content generation failed.' ];
        }

        case 'scout_keywords': {
            $topic     = $args['topic'] ?? '';
            $cache_key = 'ypnus_kw_' . md5( strtolower( $topic ) );
            $cached    = get_transient( $cache_key );
            if ( $cached !== false ) return [ 'keywords' => $cached ];
            $r = ypnus_openai( $api_key, "SEO specialist for mortgage websites. Generate 10 high-intent long-tail keywords for: \"{$topic}\". For each keyword also rate how well it fits a local MLO website (1–5 stars) and give a one-sentence reason. Return JSON: {\"keywords\":[{\"keyword\":\"\",\"intent\":\"Informational|Commercial|Transactional\",\"difficulty\":\"Easy|Medium|Hard\",\"angle\":\"\",\"website_fit\":1,\"fit_reason\":\"\"}]}", 0.4 );
            $decoded  = json_decode( $r['content'] ?? '{}', true );
            $keywords = $decoded['keywords'] ?? [];
            if ( $keywords ) set_transient( $cache_key, $keywords, DAY_IN_SECONDS );
            return [ 'keywords' => $keywords ];
        }

        case 'check_compliance': {
            $content = $args['content'] ?? '';
            $r = ypnus_openai( $api_key, "CFPB/FINRA mortgage compliance auditor. Audit this content:\n\n{$content}\n\nReturn JSON: {passed,score,verdict,summary,flags:[{severity,issue,recommendation}],required_disclosures:[]}", 0.1 );
            return json_decode( $r['content'] ?? '{}', true ) ?: [ 'error' => 'Compliance check failed.' ];
        }

        case 'suggest_silo': {
            $topic     = $args['topic'] ?? '';
            $silo_json = get_option( 'ypnus_mlo_silos', ypnus_mlo_default_silos() );
            $r = ypnus_openai( $api_key, "MLO SEO architect. Given silos: {$silo_json}\n\nTopic: {$topic}\n\nReturn JSON: {silo_name,url_slug,meta_description,internal_links:[{anchor,url,reason}]}", 0.3 );
            return json_decode( $r['content'] ?? '{}', true ) ?: [ 'error' => 'Silo suggestion failed.' ];
        }

        case 'diagnose_error': {
            $symptom = $args['symptom'] ?? '';
            $ctx     = $args['context'] ?? "Theme: GeneratePress | Host: Hostinger Cloud PHP 8.3 | Key plugins: YPNUS MLO Toolkit, Rank Math, CookieYes";
            $r = ypnus_openai( $api_key, "Senior WordPress developer. Diagnose:\n\nPROBLEM: {$symptom}\nCONTEXT: {$ctx}\n\nReturn JSON: {root_cause,category,severity,steps:[],code_fix,what_to_check_first:[],warning}", 0.2, 60 );
            return json_decode( $r['content'] ?? '{}', true ) ?: [ 'error' => 'Diagnosis failed.' ];
        }

        case 'build_page': {
            $page_type = $args['page_type'] ?? 'mortgage';
            $city      = $args['city']      ?? '';
            $angle     = $args['angle']     ?? '';
            $city_str  = $city  ? " in {$city}"    : '';
            $angle_str = $angle ? " Angle: {$angle}." : '';
            $creds     = "NMLS #{$nmls}" . ( $company ? " | {$company}" : '' );

            $prompt = "Expert mortgage copywriter. Generate complete page copy for an MLO.\nPage: {$page_type}{$city_str}.{$angle_str}\nMLO: {$creds}\n\nReturn JSON: {meta_title,meta_description,h1,subheadline,hero_paragraph,benefit_blocks:[{icon_label,headline,body}],body_sections:[{heading,content}],faqs:[{question,answer}],primary_cta:{button_text,supporting_text},trust_signals:[],url_slug}\n\nRules: Never promise rates. Include NMLS in trust signals. Hyper-local if city given.";

            $r = ypnus_openai( $api_key, $prompt, 0.65, 90 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( ! $result ) return [ 'error' => 'Page build failed.' ];

            $html  = '<p><em>' . esc_html( $result['subheadline'] ?? '' ) . '</em></p>';
            $html .= '<p>' . nl2br( esc_html( $result['hero_paragraph'] ?? '' ) ) . '</p>';
            foreach ( $result['benefit_blocks'] ?? [] as $b ) {
                $html .= '<div class="ypnus-benefit"><strong>' . esc_html( $b['headline'] ?? '' ) . '</strong><p>' . esc_html( $b['body'] ?? '' ) . '</p></div>';
            }
            foreach ( $result['body_sections'] ?? [] as $s ) {
                $html .= '<h2>' . esc_html( $s['heading'] ?? '' ) . '</h2><p>' . nl2br( esc_html( $s['content'] ?? '' ) ) . '</p>';
            }
            if ( $result['faqs'] ?? [] ) {
                $html .= '<h2>Frequently Asked Questions</h2>';
                foreach ( $result['faqs'] as $f ) $html .= '<h3>' . esc_html( $f['question'] ?? '' ) . '</h3><p>' . esc_html( $f['answer'] ?? '' ) . '</p>';
            }
            if ( $cta = $result['primary_cta'] ?? [] ) {
                $html .= '<div class="ypnus-cta-block"><strong>' . esc_html( $cta['button_text'] ?? '' ) . '</strong><p>' . esc_html( $cta['supporting_text'] ?? '' ) . '</p></div>';
            }
            if ( $trust = $result['trust_signals'] ?? [] ) {
                $html .= '<p class="ypnus-trust">' . implode( ' &middot; ', array_map( 'esc_html', $trust ) ) . '</p>';
            }

            $wp = ypnus_publish_draft( $result['h1'] ?? $page_type . ( $city ? " — {$city}" : '' ), $html, $page_type . ' ' . $city . ' ' . $angle, '', $result['meta_title'] ?? '', $result['meta_description'] ?? '' );
            return array_merge( $result, $wp );
        }

        case 'write_article': {
            $topic      = $args['topic']      ?? '';
            $city       = $args['city']       ?? '';
            $loan_type  = $args['loan_type']  ?? '';
            $affiliates = ! empty( $args['include_affiliates'] ) ? 'yes' : 'no';
            $city_str   = $city ? " in {$city}" : '';
            $loan_str   = $loan_type ? " (loan type: {$loan_type})" : '';
            $creds      = "NMLS #{$nmls}" . ( $company ? " | {$company}" : '' );
            $disc_line  = $disclosure ? "\n\nDISCLOSURE (append verbatim at bottom): {$disclosure}" : '';

            $aff_instruction = $affiliates === 'yes'
                ? 'Include 2–3 natural affiliate product mentions (e.g. credit monitoring: Credit Karma / MyFICO; homeowners insurance comparison: Policygenius; title/closing: Doma or Qualia; down payment assistance tools: Down Payment Resource). Frame them as helpful resources, not ads. Add rel="nofollow sponsored" to those links.'
                : 'Do not include affiliate products.';

            $prompt = <<<PROMPT
You are a senior mortgage content strategist and SEO copywriter. Write a high-quality, fully formatted 1500–2000 word article for a Mortgage Loan Officer website.

TOPIC: {$topic}{$city_str}{$loan_str}
MLO: {$creds}

REQUIREMENTS:
- Target word count: 1500–2000 words (body_html must contain the full article, not a summary)
- Write in a helpful, authoritative tone — like a local expert guiding a first-time buyer
- H2 and H3 subheadings throughout for scannability
- At least 3 internal link placeholders using this format: <a href="/[relevant-slug]">[anchor text]</a> — use realistic slugs that would exist on a mortgage site (e.g. /va-loans-[city], /fha-loan-requirements, /mortgage-calculator)
- At least 2 outbound authority links to real, reputable sources (HUD.gov, CFPB.gov, VA.gov, FHA.gov, Freddie Mac, Fannie Mae, NAR, Census Bureau) — open in new tab
- {$aff_instruction}
- Include a strong FAQ section (4–6 questions) near the bottom
- End with a clear call-to-action paragraph mentioning the MLO by NMLS and inviting the reader to apply or get a free consultation
- CFPB/FINRA compliant — no rate promises, no misleading claims{$disc_line}

Return ONLY valid JSON:
{{
  "meta_title": "",
  "meta_description": "",
  "h1": "",
  "url_slug": "",
  "primary_keyword": "",
  "secondary_keywords": [],
  "word_count_estimate": 0,
  "internal_links": ["{anchor}→{slug}"],
  "external_links": ["{anchor}→{url}"],
  "affiliate_links": [],
  "body_html": "<full article HTML here — all sections, FAQs, CTA, disclosure>"
}}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.65, 120 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['body_html'] ) ) return [ 'error' => 'Article generation failed.' ];

            $wp = ypnus_publish_draft(
                $result['h1'] ?? $topic,
                $result['body_html'],
                'article ' . $topic . ' ' . $city . ' ' . $loan_type,
                '',
                $result['meta_title'] ?? '',
                $result['meta_description'] ?? ''
            );
            return array_merge( $result, $wp );
        }

        case 'plan_website': {
            $niche   = $args['niche']  ?? 'full service mortgage';
            $market  = $args['market'] ?? '';
            $goal    = $args['goal']   ?? 'generate leads and rank locally';
            $creds   = "NMLS #{$nmls}" . ( $company ? " | {$company}" : '' );
            $prompt  = "Senior mortgage website architect. Plan a complete MLO website.\nNiche: {$niche}. Market: {$market}. Goal: {$goal}. MLO: {$creds}\n\nReturn JSON: {site_summary,pages:[{title,url,purpose,primary_keyword,content_brief,priority,links_to:[]}],silo_structure:{},launch_order:[],quick_wins:[]}\n\nMinimum 10 pages. Make URLs and keywords specific.";
            $r = ypnus_openai( $api_key, $prompt, 0.5, 90 );
            return json_decode( $r['content'] ?? '{}', true ) ?: [ 'error' => 'Website plan failed.' ];
        }

        case 'site_wizard': {
            $name       = $args['full_name']    ?? $company;
            $city       = $args['city']         ?? '';
            $niches     = $args['loan_niches']  ?? 'purchase, refinance';
            $audience   = $args['target_buyer'] ?? 'first-time homebuyers';
            $goal       = $args['primary_goal'] ?? 'generate leads and rank locally';
            $creds      = "NMLS #{$nmls}" . ( $company ? " | {$company}" : '' );

            // Save everything to agent memory
            if ( $name )     ypnus_save_memory( 'full_name',    $name );
            if ( $city )     ypnus_save_memory( 'primary_city', $city );
            if ( $niches )   ypnus_save_memory( 'loan_niches',  $niches );
            if ( $audience ) ypnus_save_memory( 'target_buyer', $audience );
            if ( $goal )     ypnus_save_memory( 'primary_goal', $goal );

            $prompt = <<<PROMPT
You are a senior mortgage website strategist. An MLO just answered 5 onboarding questions. Create their complete website launch plan.

MLO: {$creds}
Name: {$name}
City/Market: {$city}
Loan niches: {$niches}
Target buyer: {$audience}
Primary goal: {$goal}

Return JSON:
{
  "welcome_message": "One warm, encouraging sentence welcoming them and summarizing what you're about to build together",
  "site_summary": "2-3 sentence overview of their site strategy",
  "pages": [
    {
      "title": "",
      "url_slug": "",
      "purpose": "",
      "primary_keyword": "",
      "conversion_elements": ["CTA button text", "lead form type", "trust signal"],
      "build_command": "Exact sentence the MLO can paste to build this page (e.g. Build me a VA loan page for Phoenix AZ targeting first-time buyers)",
      "priority": "1-15",
      "estimated_time": "minutes to build with AI"
    }
  ],
  "plugin_checklist": [
    {"plugin": "", "purpose": "", "free": true, "install_first": true}
  ],
  "conversion_rules": [
    "Rule every page must follow for max conversions"
  ],
  "launch_checklist": [
    "Step-by-step ordered checklist item"
  ],
  "first_thing_to_do": "The single most important next step right now, in plain English",
  "encouragement": "One motivating sentence about how close they are to having a real lead-generating machine"
}

Pages to include (minimum 12): Homepage, About/Bio, Contact/Apply Now, Purchase Loans hub, Refinance hub, at least 3 loan-type pages (VA/FHA/USDA/Conventional/Jumbo/DSCR based on their niche), at least 2 local area pages (city + nearby suburb), Mortgage Calculator, Blog/Resources hub, First-Time Buyer Guide.

Every page must have a phone-number CTA above the fold, a lead capture form, and NMLS disclosure. Make build_command entries specific to their city and niche.
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.5, 90 );
            $result = json_decode( $r['content'] ?? '{}', true );
            return $result ?: [ 'error' => 'Site wizard failed.' ];
        }

        case 'build_full_site': {
            $mem        = ypnus_get_memory();
            $city       = $mem['primary_city']['value']  ?? $args['city']       ?? '';
            $niches     = $mem['loan_niches']['value']   ?? $args['loan_niches'] ?? 'purchase, refinance, VA, FHA';
            $audience   = $mem['target_buyer']['value']  ?? $args['target_buyer'] ?? 'first-time homebuyers';
            $creds      = "NMLS #{$nmls}" . ( $company ? " | {$company}" : '' );
            $city_str   = $city ? " in {$city}" : '';

            $core_pages = [
                [ 'type' => 'homepage',       'city' => $city, 'angle' => "conversion-focused homepage for {$audience}" ],
                [ 'type' => 'about',          'city' => $city, 'angle' => 'personal bio and trust-building' ],
                [ 'type' => 'purchase loans', 'city' => $city, 'angle' => "home purchase mortgage{$city_str}" ],
                [ 'type' => 'refinance',      'city' => $city, 'angle' => "mortgage refinance options{$city_str}" ],
                [ 'type' => 'contact',        'city' => $city, 'angle' => 'apply now and free consultation' ],
                [ 'type' => 'mortgage calculator', 'city' => $city, 'angle' => 'interactive tool page' ],
            ];

            // Add niche-specific pages
            $niche_list = array_map( 'trim', explode( ',', $niches ) );
            foreach ( array_slice( $niche_list, 0, 4 ) as $n ) {
                $core_pages[] = [ 'type' => trim( $n ) . ' loans', 'city' => $city, 'angle' => "{$n} mortgage specialist{$city_str}" ];
            }

            $built = [];
            $failed = [];
            foreach ( $core_pages as $pg ) {
                $pg_prompt = "Expert mortgage copywriter and conversion specialist. Generate complete, conversion-optimized page copy.\nPage type: {$pg['type']}{$city_str}. Angle: {$pg['angle']}.\nMLO: {$creds}. Target buyer: {$audience}.\n\nCONVERSION REQUIREMENTS (mandatory on every page):\n- Phone CTA button above the fold\n- Lead capture form (name, email, phone, loan type)\n- 3+ trust signals (NMLS, years experience, reviews, local expertise)\n- 1 primary CTA button (e.g. Get Pre-Approved, Apply Now, Schedule a Call)\n- Social proof section\n- NMLS disclosure at bottom\n- Mobile-first layout\n\nReturn JSON: {meta_title,meta_description,h1,subheadline,hero_paragraph,benefit_blocks:[{icon_label,headline,body}],body_sections:[{heading,content}],faqs:[{question,answer}],primary_cta:{button_text,supporting_text},trust_signals:[],url_slug}";

                $r   = ypnus_openai( $api_key, $pg_prompt, 0.65, 90 );
                $res = json_decode( $r['content'] ?? '{}', true );
                if ( ! empty( $res['h1'] ) ) {
                    $html  = '<p><em>' . esc_html( $res['subheadline'] ?? '' ) . '</em></p>';
                    $html .= '<p>' . nl2br( esc_html( $res['hero_paragraph'] ?? '' ) ) . '</p>';
                    foreach ( $res['benefit_blocks'] ?? [] as $b ) {
                        $html .= '<div><strong>' . esc_html( $b['headline'] ?? '' ) . '</strong><p>' . esc_html( $b['body'] ?? '' ) . '</p></div>';
                    }
                    foreach ( $res['body_sections'] ?? [] as $s ) {
                        $html .= '<h2>' . esc_html( $s['heading'] ?? '' ) . '</h2><p>' . esc_html( $s['content'] ?? '' ) . '</p>';
                    }
                    if ( ! empty( $res['faqs'] ) ) {
                        $html .= '<h2>Frequently Asked Questions</h2>';
                        foreach ( $res['faqs'] as $faq ) {
                            $html .= '<h3>' . esc_html( $faq['question'] ?? '' ) . '</h3><p>' . esc_html( $faq['answer'] ?? '' ) . '</p>';
                        }
                    }
                    if ( $cta = $res['primary_cta'] ?? [] ) {
                        $html .= '<p><strong>' . esc_html( $cta['button_text'] ?? 'Apply Now' ) . '</strong> — ' . esc_html( $cta['supporting_text'] ?? '' ) . '</p>';
                    }
                    if ( $trust = $res['trust_signals'] ?? [] ) {
                        $html .= '<p>' . implode( ' · ', array_map( 'esc_html', $trust ) ) . '</p>';
                    }
                    if ( $disclosure ) $html .= '<p><small>' . esc_html( $disclosure ) . '</small></p>';

                    $wp = ypnus_publish_draft( $res['h1'], $html, $pg['type'] . ' ' . $city, '', $res['meta_title'] ?? '', $res['meta_description'] ?? '' );
                    $built[] = [
                        'title'       => $res['h1'],
                        'slug'        => $res['url_slug'] ?? '',
                        'edit_url'    => $wp['wp_edit_url'] ?? '',
                        'preview_url' => $wp['wp_preview_url'] ?? '',
                    ];
                } else {
                    $failed[] = $pg['type'];
                }
            }

            return [
                'pages_built'  => count( $built ),
                'pages_failed' => count( $failed ),
                'built'        => $built,
                'failed'       => $failed,
                'next_step'    => 'Review each draft in WordPress (Pages → All Pages), customize your phone number and headshot photo on each page, then publish when ready.',
            ];
        }

        case 'score_gmb': {
            $biz    = $args['business_name']      ?? '';
            $city   = $args['city']               ?? '';
            $cats   = $args['categories']         ?? 'not specified';
            $revs   = (int)   ( $args['review_count']   ?? 0 );
            $rating = (float) ( $args['avg_rating']      ?? 0 );
            $photos = ! empty( $args['has_photos'] )         ? 'yes' : 'no';
            $posts  = (int)   ( $args['posts_per_month']  ?? 0 );
            $qa     = ! empty( $args['has_qa'] )             ? 'yes' : 'no';
            $svc    = ! empty( $args['services_listed'] )    ? 'yes' : 'no';
            $desc   = ! empty( $args['description_filled'] ) ? 'yes' : 'no';
            $creds  = "NMLS #{$nmls}" . ( $company ? " | {$company}" : '' );

            $prompt = "Google Business Profile expert for mortgage loan officers.\n\nPROFILE:\n- Business: {$biz} | City: {$city} | Categories: {$cats}\n- Reviews: {$revs} | Rating: {$rating} | Photos: {$photos}\n- Posts/month: {$posts} | Q&A: {$qa} | Services: {$svc} | Description: {$desc}\n- {$creds}\n\nScore and return JSON:\n{total_score,grade,summary,categories:[{name,score,max,status,why,actions:[{priority,action}]}],quick_wins:[],gmb_guide_html:'<full HTML guide 600-800 words with h2/h3/p/ul — include score in intro>'}\n\nCategories: Profile Completeness (max 20), Category Selection (10), Review Velocity (20), Google Posts (15), Photos (10), Q&A (10), Services (10), NAP/Hours (5).\n\nBe hyper-specific — name exact menu paths in Google Business Profile Manager, exact loan types to list. No generic advice.";

            $r = ypnus_openai( $api_key, $prompt, 0.3, 90 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( ! $result ) return [ 'error' => 'GMB score failed.' ];

            $guide_html = $result['gmb_guide_html'] ?? '';
            unset( $result['gmb_guide_html'] );

            if ( $guide_html ) {
                $score = $result['total_score'] ?? 0;
                $wp = ypnus_publish_draft(
                    "GMB Optimization Guide — {$biz} ({$city}) — Score: {$score}/100",
                    $guide_html,
                    'google my business marketing',
                    'mortgage-marketing',
                    "GMB Optimization for {$biz} in {$city} | Local SEO Score",
                    "See your Google Business Profile score and get a step-by-step optimization checklist for {$biz} in {$city}."
                );
                $result = array_merge( $result, $wp );
            }

            return $result;
        }

        case 'recommend_plugins': {
            $need      = $args['need']                ?? '';
            $installed = $args['currently_installed'] ?? 'Rank Math SEO, CookieYes, Google Site Kit, Stripe, YPNUS MLO Toolkit';
            $concern   = $args['concern']             ?? '';
            $concern_str = $concern ? "\nUser concern: {$concern}" : '';

            $prompt = <<<PROMPT
You are a senior WordPress developer and site architect with 15 years of experience, specializing in mortgage and financial services websites. You have encyclopedic knowledge of the WordPress plugin ecosystem.

SITE CONTEXT (mandatory — all recommendations must account for this):
- Hosting: Hostinger Cloud Shared Hosting (limited RAM ~512MB per process, no persistent background processes, no Node.js, no Redis)
- Theme: GeneratePress (lightweight, block-compatible, no page builder)
- PHP: 8.3.30
- WordPress: 7.0.x
- Currently active plugins: {$installed}
- Site type: Mortgage Loan Officer (MLO) — lead generation, local SEO, compliance-sensitive content
- Goal of site: Generate mortgage leads, rank locally, build authority

NEED: {$need}{$concern_str}

Return ONLY valid JSON:
{
  "primary_recommendation": {
    "plugin": "Plugin Name",
    "why": "2-3 sentence explanation of why this is the best fit for this exact stack",
    "free_version_ok": true,
    "paid_plan": "plan name and price if paid needed, or null",
    "install_notes": "exact steps or settings to configure after install",
    "conflict_risk": "none|low|medium|high",
    "performance_impact": "none|minimal|moderate|heavy",
    "compliance_note": "any CFPB/mortgage compliance consideration, or null"
  },
  "alternatives": [
    {
      "plugin": "Alternative Plugin Name",
      "why_alternative": "one sentence — when to choose this instead",
      "tradeoff": "what you give up vs primary recommendation"
    }
  ],
  "avoid": [
    {
      "plugin": "Plugin to avoid",
      "reason": "specific reason why it's wrong for this stack"
    }
  ],
  "stack_conflicts": "Any known conflicts with current installed plugins, or null",
  "pro_tip": "One expert insight about this category of plugins specific to mortgage sites",
  "estimated_setup_time": "e.g. 30 minutes",
  "plugin_category": "e.g. Lead Capture | SEO | Caching | Email/CRM | Security | Forms | Payments | Backup | Analytics | Popup | Page Builder | Other"
}

Be opinionated. If one plugin is clearly better for this stack, say so directly. Never hedge with "it depends" without a specific explanation. Name exact plugin versions or known issues where relevant.
PROMPT;

            $r = ypnus_openai( $api_key, $prompt, 0.2, 60 );
            $result = json_decode( $r['content'] ?? '{}', true );
            return $result ?: [ 'error' => 'Plugin recommendation failed.' ];
        }

        case 'marketing_advisor': {
            $goal    = $args['goal']          ?? '';
            $setup   = $args['current_setup'] ?? 'no existing marketing tools configured';
            $budget  = $args['budget']        ?? 'flexible';
            $niche   = $args['niche']         ?? ( get_option( 'ypnus_mlo_nmls' ) ? 'full service mortgage' : 'mortgage' );
            $nmls_v  = $nmls;
            $comp_v  = $company;
            $memory_context = ypnus_format_memory_for_prompt();

            $prompt = <<<PROMPT
You are the world's most experienced mortgage marketing strategist AND WordPress conversion expert. You've built hundreds of MLO websites that generate consistent lead flow. You know every marketing tool, plugin, funnel strategy, email sequence, CRM workflow, and conversion tactic that works for mortgage loan officers.

MLO CONTEXT:
- NMLS: {$nmls_v} | Company: {$comp_v}
- Niche: {$niche}
- WordPress stack: GeneratePress + Hostinger Shared Hosting + PHP 8.3
- Current marketing setup: {$setup}
- Budget: {$budget}
{$memory_context}

GOAL: {$goal}

Return ONLY valid JSON:
{
  "executive_summary": "2-3 sentence plain-English verdict on what this MLO needs to do",
  "priority_actions": [
    {
      "rank": 1,
      "action": "Specific action title",
      "what_to_do": "Exact step-by-step instructions — be specific, name the tool/plugin/service",
      "why_it_matters": "Business impact in plain English",
      "time_to_implement": "e.g. 2 hours",
      "cost": "free | $X/month | one-time $X",
      "expected_result": "What the MLO can realistically expect"
    }
  ],
  "full_marketing_stack": {
    "lead_capture": {"tool": "...", "why": "...", "wordpress_plugin": "..."},
    "crm": {"tool": "...", "why": "...", "wordpress_plugin": "..."},
    "email_automation": {"tool": "...", "why": "...", "setup_notes": "..."},
    "landing_pages": {"approach": "...", "why": "..."},
    "seo_local": {"approach": "...", "key_actions": ["..."]},
    "social_automation": {"tool": "...", "strategy": "..."},
    "referral_system": {"approach": "...", "realtor_strategy": "..."},
    "paid_ads": {"recommendation": "...", "budget_guidance": "..."},
    "analytics": {"tool": "...", "what_to_track": ["..."]}
  },
  "email_sequence": {
    "trigger": "What starts the sequence (e.g. form submission on VA loan page)",
    "emails": [
      {"day": 0, "subject": "...", "purpose": "...", "key_content": "..."},
      {"day": 1, "subject": "...", "purpose": "...", "key_content": "..."},
      {"day": 3, "subject": "...", "purpose": "...", "key_content": "..."},
      {"day": 7, "subject": "...", "purpose": "...", "key_content": "..."},
      {"day": 14, "subject": "...", "purpose": "...", "key_content": "..."}
    ]
  },
  "conversion_quick_wins": [
    "Specific thing to change on the WordPress site today that increases conversions"
  ],
  "biggest_mistake": "The #1 mistake MLOs make with their WordPress marketing and how to avoid it",
  "month_1_plan": ["Week 1 action", "Week 2 action", "Week 3 action", "Week 4 action"],
  "kpis_to_track": ["Specific metric with target number"]
}

Be brutally specific. Name exact tools, plugins, prices, and tactics. Never say "consider using X" — say "use X, here's exactly how." Tailor everything to a mortgage loan officer on Hostinger shared WordPress hosting.
PROMPT;

            $r = ypnus_openai( $api_key, $prompt, 0.4, 90 );
            $result = json_decode( $r['content'] ?? '{}', true );
            return $result ?: [ 'error' => 'Marketing advisory failed.' ];
        }

        case 'frontend_developer': {
            $task        = $args['task']        ?? '';
            $context     = $args['context']     ?? '';
            $output_type = $args['output_type'] ?? 'html_css_js';
            $save_draft  = ! empty( $args['save_as_draft'] );
            $ctx_block   = $context ? "\nContext/constraints:\n{$context}" : '';

            $prompt = <<<PROMPT
You are a senior frontend developer specializing in WordPress and mortgage marketing websites.

Site context:
- WordPress with GeneratePress theme (no page builder)
- Hosted on Hostinger shared hosting (LiteSpeed)
- Brand: dark navy (#0D1B3E), gold (#C9A15F), white — clean, professional, trust-building
- Output type requested: {$output_type}

TASK: {$task}{$ctx_block}

RULES:
1. Write complete, production-ready code — no placeholders
2. Self-contained: inline the CSS in a <style> block and JS in a <script> block unless told otherwise
3. Responsive by default: mobile-first, test at 375px and 1200px
4. No jQuery — use vanilla JS only
5. CSS: use custom properties (--var) for colors and spacing, BEM-adjacent class names
6. Accessibility: semantic HTML, aria labels where needed, focus states
7. If generating a WordPress shortcode, wrap in add_shortcode() PHP
8. Keep animations subtle — this is a professional finance site

Return JSON:
{
  "title": "Short component name",
  "files": [
    {"path": "paste location or file path", "language": "html|css|js|php", "code": "full code here"}
  ],
  "how_to_use": "Exact steps to add this to WordPress",
  "preview_description": "One sentence describing what the user will see"
}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.3, 90 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['files'] ) ) {
                $result = [ 'title' => 'Frontend Output', 'files' => [ [ 'path' => 'See below', 'language' => 'html', 'code' => $r['content'] ?? '' ] ], 'how_to_use' => '', 'preview_description' => '' ];
            }

            if ( $save_draft ) {
                $combined = '';
                foreach ( $result['files'] as $f ) $combined .= "/* {$f['path']} */\n{$f['code']}\n\n";
                $did = wp_insert_post( [ 'post_title' => 'Frontend: ' . ( $result['title'] ?? $task ), 'post_content' => '<pre>' . esc_html( $combined ) . '</pre>', 'post_status' => 'draft', 'post_type' => 'post' ] );
                $result['draft_edit_url'] = is_wp_error( $did ) ? '' : get_edit_post_link( $did, 'raw' );
            }
            return $result;
        }

        case 'performance_engineer': {
            $symptom = $args['symptom']      ?? '';
            $setup   = $args['current_setup'] ?? '';
            $page    = $args['page_url']      ?? '';

            $nmls_val    = get_option( 'ypnus_mlo_nmls', '' );
            $company_val = get_option( 'ypnus_mlo_company', '' );

            $prompt = <<<PROMPT
You are a WordPress performance engineer specializing in Hostinger shared hosting optimization.

Site context:
- Hosting: Hostinger Cloud shared (LiteSpeed web server, PHP 8.3, MySQL 8, OPcache enabled)
- WordPress theme: GeneratePress (lightweight, no page builder)
- NMLS-regulated mortgage site — must stay live, no risky experiments
- Active plugins include: YPNUS MLO Toolkit (custom), WPForms Lite

Symptom / goal: {$symptom}
Current setup: {$setup}
Page in question: {$page}

Produce a complete performance optimization plan. Return JSON:
{
  "diagnosis": "Root cause analysis in 2-3 sentences",
  "priority_fixes": [
    {
      "fix": "Action title",
      "impact": "High|Medium|Low",
      "effort": "5min|30min|1hr|1day",
      "how": "Exact steps — plugin settings, code snippet, or server config to change",
      "expected_gain": "What metric improves and by how much"
    }
  ],
  "hostinger_specific": "LiteSpeed/Hostinger-specific settings to enable (LiteSpeed Cache config, OPcache settings, etc.)",
  "code_snippet": "Any functions.php or plugin code to add (empty string if none)",
  "tools_to_use": ["List of free tools to measure results"],
  "do_not_do": ["Common mistakes to avoid on this stack"]
}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.2, 60 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['priority_fixes'] ) ) {
                $result = [ 'diagnosis' => $r['content'] ?? 'Analysis unavailable.', 'priority_fixes' => [], 'hostinger_specific' => '', 'code_snippet' => '', 'tools_to_use' => [], 'do_not_do' => [] ];
            }
            return $result;
        }

        case 'schema_markup_builder': {
            $schema_type = $args['schema_type']       ?? 'auto';
            $page_desc   = $args['page_description']  ?? '';
            $biz_details = $args['business_details']  ?? '';

            $nmls_val    = get_option( 'ypnus_mlo_nmls', '' );
            $company_val = get_option( 'ypnus_mlo_company', '' );
            $site_url    = get_site_url();

            $auto_biz = $biz_details ?: "Business: {$company_val}, NMLS: {$nmls_val}, Site: {$site_url}";

            $prompt = <<<PROMPT
You are a structured data and schema markup expert for mortgage websites.

Site context:
- {$auto_biz}
- Mortgage Loan Officer / MLO marketing platform
- WordPress site on {$site_url}

Page description: {$page_desc}
Schema type requested: {$schema_type}

Generate complete, valid JSON-LD schema markup. Rules:
1. Output valid JSON-LD that passes Google Rich Results Test
2. Include @context, @type, and all required fields for the schema type
3. For local_business/mortgage_lender: include geo, openingHours, areaServed, hasCredential for NMLS
4. For faq: include minimum 4 realistic Q&A pairs relevant to the page topic
5. For person: include MLO-specific credential fields
6. Always include a sameAs array with NMLS Consumer Access URL if NMLS number is known
7. Stack multiple schema types in a @graph array when appropriate

Return JSON:
{
  "schema_types_used": ["list of @types in the output"],
  "script_block": "The complete <script type='application/ld+json'>...</script> block ready to paste",
  "where_to_add": "Exact WordPress instructions for adding this (plugin, theme, specific page)",
  "rich_result_eligibility": "Which Google rich results this qualifies for",
  "validation_url": "https://search.google.com/test/rich-results"
}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.1, 60 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['script_block'] ) ) {
                $result = [ 'schema_types_used' => [], 'script_block' => $r['content'] ?? '', 'where_to_add' => '', 'rich_result_eligibility' => '', 'validation_url' => 'https://search.google.com/test/rich-results' ];
            }
            return $result;
        }

        case 'video_script_writer': {
            $topic    = $args['topic']            ?? '';
            $format   = $args['format']           ?? 'talking_head_intro';
            $audience = $args['target_audience']  ?? 'mortgage borrowers';
            $broll    = ! empty( $args['include_broll'] );
            $broll_hint = $broll ? 'Include B-roll shot suggestions and on-screen text overlay cues in square brackets.' : '';

            $length_map = [
                'youtube_long'       => '5–8 minutes (750–1200 words of spoken content)',
                'short_reel'         => '30–60 seconds (75–150 words of spoken content)',
                'talking_head_intro' => '60–90 seconds (150–225 words of spoken content)',
                'loan_explainer'     => '2–3 minutes (300–450 words of spoken content)',
                'faq_video'          => '2–4 minutes, cover 3–5 questions',
                'local_market_update' => '2–3 minutes focusing on local data and trends',
                'realtor_collab'     => '60–90 seconds, joint value proposition',
                'testimonial_prompt' => 'A list of 5–7 prompt questions to guide a borrower testimonial recording',
            ];
            $length = $length_map[ $format ] ?? '2–3 minutes';

            $prompt = <<<PROMPT
You are a professional video scriptwriter specializing in mortgage content for MLOs. You write engaging, compliant scripts that educate and convert without triggering RESPA or CFPB concerns.

TOPIC: {$topic}
FORMAT: {$format} — Target length: {$length}
TARGET AUDIENCE: {$audience}
{$broll_hint}

COMPLIANCE RULES:
- No guaranteed interest rates or APR quotes
- No promise of loan approval
- Avoid "best rate", "lowest rate", "guaranteed", "no money down" (unless specifically VA/USDA context)
- Educational tone — inform and build trust, do not make financial promises

Return a JSON object:
{
  "title": "video title (also usable as YouTube title)",
  "hook": "opening 5-10 seconds — the attention grabber",
  "script": "full word-for-word script with [B-ROLL: description] and [ON SCREEN: text] cues where applicable",
  "cta": "closing call to action (15-20 seconds)",
  "description_template": "YouTube/social media description with hashtags",
  "thumbnail_text_suggestions": ["3 short text options for the thumbnail overlay"],
  "chapters": [
    {"timestamp": "0:00", "label": "section name"}
  ],
  "compliance_notes": "any compliance considerations for this specific script"
}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.7, 120 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['script'] ) ) {
                $result = [ 'title' => $topic, 'script' => $r['content'] ?? '', 'hook' => '', 'cta' => '', 'chapters' => [] ];
            }
            return $result;
        }

        case 'realtor_partner_system': {
            $out_type    = $args['output_type']     ?? 'full_system';
            $market      = $args['market']          ?? '';
            $specialty   = $args['loan_specialty']  ?? 'VA, FHA, Conventional, DSCR, and Jumbo loans';
            $agent_goal  = (int)( $args['agent_count_goal'] ?? 20 );

            $prompt = <<<PROMPT
You are a senior mortgage business development consultant specializing in MLO-to-realtor partnership systems. You build referral networks that generate consistent, high-quality purchase loan referrals.

OUTPUT TYPE: {$out_type}
MARKET: {$market}
LOAN SPECIALTY: {$specialty}
AGENT RELATIONSHIP GOAL: {$agent_goal} active referral partners

Return a JSON object:
{
  "system_summary": "2-3 sentence overview of the strategy for this market",
  "value_proposition": "The 2-3 sentence pitch MLO uses to explain their value to realtors",
  "partnership_tiers": [
    {
      "tier_name": "Active|Preferred|Elite",
      "criteria": "what qualifies an agent for this tier",
      "benefits": ["benefit 1", "benefit 2"],
      "co_marketing_assets": ["what the MLO provides at this tier"]
    }
  ],
  "outreach_scripts": {
    "cold_email": "full email template",
    "linkedin_dm": "short LinkedIn message",
    "phone_voicemail": "30-second voicemail script",
    "text_message": "follow-up text (under 160 chars)"
  },
  "onboarding_sequence": [
    {"step": 1, "timing": "Day 1", "action": "what to do", "template": "message or content"}
  ],
  "co_marketing_ideas": ["list of specific co-marketing activities with realtors"],
  "crm_tagging_strategy": "how to tag and segment realtor partners in a CRM",
  "90_day_action_plan": "plain English week-by-week plan to reach the agent goal"
}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.5, 120 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['outreach_scripts'] ) && empty( $result['partnership_tiers'] ) ) {
                $result = [ 'system_summary' => $r['content'] ?? '', 'outreach_scripts' => [], 'partnership_tiers' => [], 'onboarding_sequence' => [] ];
            }
            return $result;
        }

        case 'analytics_interpreter': {
            $data    = $args['data_snapshot']    ?? '';
            $question = $args['question']        ?? '';
            $context = $args['business_context'] ?? 'convert mortgage prospects into demo sign-ups and loan applications';
            $q_block = $question ? "\n\nSpecific question: {$question}" : '';

            $prompt = <<<PROMPT
You are a senior digital analytics consultant specializing in mortgage websites and MLO lead generation funnels. You translate raw analytics data into clear, prioritized actions.

BUSINESS GOAL: {$context}

ANALYTICS DATA:
{$data}{$q_block}

Analyze the data and return a JSON object:
{
  "tldr": "3-sentence plain-English summary of what the data is saying overall",
  "top_performing_pages": [
    {"page": "page name or URL", "why_it_works": "reason", "action": "how to capitalize on this"}
  ],
  "underperforming_pages": [
    {"page": "page name or URL", "problem": "what the metric reveals", "fix": "specific action to take"}
  ],
  "traffic_source_insights": [
    {"source": "organic|direct|referral|social|paid", "assessment": "what's working or not", "recommendation": "action"}
  ],
  "funnel_leaks": [
    {"stage": "where in the funnel", "drop_off_signal": "what metric shows the leak", "fix": "how to plug it"}
  ],
  "quick_wins": ["actions that can be taken in under a week with high impact"],
  "priority_actions": [
    {"rank": 1, "action": "specific thing to do", "expected_impact": "what improvement to expect", "effort": "low|medium|high"}
  ],
  "what_to_track_next": ["metrics or experiments to set up based on these findings"]
}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.3, 90 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['priority_actions'] ) ) {
                $result = [ 'tldr' => $r['content'] ?? '', 'top_performing_pages' => [], 'underperforming_pages' => [], 'priority_actions' => [], 'quick_wins' => [] ];
            }
            return $result;
        }

        case 'cro_specialist': {
            $page    = $args['page_or_section'] ?? '';
            $copy    = $args['current_copy']    ?? '';
            $goal    = $args['goal']            ?? 'book a free demo or start a loan application';
            $copy_block = $copy ? "\n\nCurrent copy/HTML provided:\n{$copy}" : '';

            $prompt = <<<PROMPT
You are a senior Conversion Rate Optimization specialist with deep expertise in mortgage websites and MLO lead generation.

PAGE / SECTION TO AUDIT: {$page}
CONVERSION GOAL: {$goal}{$copy_block}

Perform a comprehensive CRO audit. Return a JSON object with:
{
  "headline_score": integer 1-10,
  "overall_assessment": "2-3 sentence summary of conversion strength",
  "priority_fixes": [
    {
      "rank": 1,
      "element": "what element (headline, CTA button, hero image, form, trust badge, etc.)",
      "issue": "specific problem",
      "fix": "exact recommended change",
      "expected_lift": "estimated % improvement in conversions",
      "effort": "low|medium|high"
    }
  ],
  "copy_rewrites": {
    "headline": "new headline if applicable",
    "subheadline": "new subheadline",
    "cta_button": "new CTA text",
    "supporting_copy": "any other copy improvements"
  },
  "trust_signals_to_add": ["list of specific trust elements to add"],
  "ab_test_hypotheses": [
    {"hypothesis": "if we change X to Y, conversions will increase because Z", "priority": "high|medium|low"}
  ],
  "quick_wins": ["list of changes that take under 30 minutes and have high impact"]
}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.4, 90 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['priority_fixes'] ) ) {
                $result = [ 'overall_assessment' => $r['content'] ?? '', 'priority_fixes' => [], 'copy_rewrites' => [], 'trust_signals_to_add' => [], 'ab_test_hypotheses' => [], 'quick_wins' => [] ];
            }
            return $result;
        }

        case 'email_sequence_writer': {
            $seq_type   = $args['sequence_type'] ?? 'welcome_series';
            $audience   = $args['audience']      ?? 'mortgage borrowers';
            $loan_focus = $args['loan_focus']    ?? '';
            $num_emails = max( 1, min( 10, (int)( $args['num_emails'] ?? 5 ) ) );
            $tone       = $args['tone']          ?? 'friendly';
            $loan_block = $loan_focus ? "\nLoan type focus: {$loan_focus}" : '';

            $prompt = <<<PROMPT
You are a senior email copywriter specializing in RESPA-compliant mortgage marketing. You write high-converting email sequences for MLOs that build trust, educate prospects, and drive loan applications.

SEQUENCE TYPE: {$seq_type}
AUDIENCE: {$audience}{$loan_block}
NUMBER OF EMAILS: {$num_emails}
TONE: {$tone}

COMPLIANCE RULES — every email must follow these without exception:
- No specific interest rate promises or guarantees
- No guarantee of loan approval
- No discriminatory language (no references to race, religion, national origin, etc.)
- No pressure tactics that violate fair lending
- Include "Equal Housing Lender" reminder in at least the first email
- Avoid trigger words: "guaranteed", "lowest rate", "best rate", "no money down" (unless VA/USDA specific)
- Keep educational — inform, don't mislead

Return a JSON object:
{
  "sequence_name": "descriptive name",
  "audience_summary": "who this is for",
  "emails": [
    {
      "email_number": 1,
      "send_timing": "immediately / day 2 / day 5 / etc.",
      "subject_line": "subject here",
      "preview_text": "preview text here (50 chars max)",
      "body": "full email body with line breaks. Use [MLO_NAME], [BORROWER_NAME] placeholders.",
      "cta_text": "CTA button label",
      "cta_url_placeholder": "[DEMO_URL] or [APPLICATION_URL] or [PHONE_NUMBER]",
      "compliance_note": "any compliance consideration for this specific email"
    }
  ],
  "setup_notes": "how to configure this in an email platform like Mailchimp, ActiveCampaign, or FluentCRM"
}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.6, 120 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['emails'] ) ) {
                $result = [ 'sequence_name' => 'Email Sequence', 'emails' => [], 'raw' => $r['content'] ?? '' ];
            }
            return $result;
        }

        case 'content_strategist': {
            $focus    = $args['focus']           ?? '';
            $out_type = $args['output_type']     ?? 'full_strategy';
            $horizon  = $args['time_horizon']    ?? '90_days';
            $existing = $args['current_content'] ?? '';
            $exist_block = $existing ? "\n\nExisting content (avoid duplicating):\n{$existing}" : '';

            $prompt = <<<PROMPT
You are a senior content strategist specializing in mortgage loan officer websites and local SEO. You build content architectures that drive organic traffic, capture leads, and establish topical authority for MLOs.

CONTENT FOCUS: {$focus}
OUTPUT TYPE: {$out_type}
PLANNING HORIZON: {$horizon}{$exist_block}

Return a JSON object:
{
  "strategy_summary": "2-3 sentences on the overall approach",
  "pillar_pages": [
    {"title": "page title", "slug": "/url-slug/", "primary_keyword": "keyword", "funnel_stage": "awareness|consideration|decision", "word_count_target": 2000, "content_brief": "what this page covers"}
  ],
  "cluster_posts": [
    {"title": "blog post title", "slug": "/url-slug/", "primary_keyword": "keyword", "funnel_stage": "awareness|consideration|decision", "links_to_pillar": "/pillar-slug/", "publish_week": 1}
  ],
  "lead_magnets": [
    {"title": "lead magnet name", "format": "checklist|guide|calculator|video", "topic": "what it covers", "cta_placement": "where to promote it"}
  ],
  "content_gaps": ["topic or keyword not yet covered that competitors rank for"],
  "quick_publish_wins": ["pieces that are fast to write and high-intent"],
  "editorial_calendar_summary": "plain English week-by-week plan for the horizon"
}
PROMPT;

            $r      = ypnus_openai( $api_key, $prompt, 0.5, 120 );
            $result = json_decode( $r['content'] ?? '{}', true );
            if ( empty( $result['pillar_pages'] ) && empty( $result['cluster_posts'] ) ) {
                $result = [ 'strategy_summary' => $r['content'] ?? '', 'pillar_pages' => [], 'cluster_posts' => [], 'lead_magnets' => [], 'content_gaps' => [], 'quick_publish_wins' => [], 'editorial_calendar_summary' => '' ];
            }
            return $result;
        }

        case 'backend_developer': {
            $task          = $args['task']          ?? '';
            $context       = $args['context']       ?? '';
            $output_format = $args['output_format'] ?? '';
            $save_draft    = ! empty( $args['save_as_draft'] );

            $format_hint = $output_format ? "Output format requested: {$output_format}.\n" : '';
            $ctx_block   = $context ? "\n\nAdditional context provided:\n{$context}" : '';

            $dev_prompt = <<<PROMPT
You are a senior WordPress backend developer with 10+ years of experience. You specialize in:
- WordPress plugin and theme development (PHP 8.3, WordPress coding standards)
- Custom Post Types, taxonomies, meta boxes, REST API endpoints
- AJAX handlers (both wp_ajax_ and wp_ajax_nopriv_)
- WordPress hooks system (add_action, add_filter, do_action, apply_filters)
- WP_Query, wpdb, direct SQL with prepared statements
- WP-CLI commands and automation scripts
- Hostinger shared hosting constraints: PHP 8.3.x, MySQL 8, no root, no exec(), shared resources
- GeneratePress theme hooks and child theme development
- Performance optimization: transients, object cache, query optimization
- Security: nonce verification, capability checks, input sanitization, output escaping
- WordPress REST API: register_rest_route, WP_REST_Controller, authentication

TASK: {$task}
{$format_hint}{$ctx_block}

OUTPUT RULES:
1. Return ONLY valid, production-ready PHP code — no placeholders, no TODO comments for core logic
2. Every function must be prefixed to avoid conflicts (use a unique prefix)
3. Include nonce verification on all AJAX handlers
4. Include capability checks on all admin-facing code
5. Sanitize all inputs, escape all outputs
6. Add brief inline comments only where behavior is non-obvious
7. If the task requires multiple files, clearly label each file path at the top
8. After the code, provide a 3-5 line "How to use" block explaining exactly where to paste it and what to do

Return your response as JSON:
{
  "title": "Short title of what was built",
  "files": [
    {
      "path": "where to put this file or 'paste into functions.php' etc",
      "code": "the complete PHP code"
    }
  ],
  "how_to_use": "Step by step instructions in plain English",
  "warnings": "Any gotchas, version requirements, or conflicts to watch for (empty string if none)"
}
PROMPT;

            $r      = ypnus_openai( $api_key, $dev_prompt, 0.2, 90 );
            $result = json_decode( $r['content'] ?? '{}', true );

            if ( empty( $result['files'] ) ) {
                // OpenAI returned plain text instead of JSON — wrap it
                $result = [
                    'title'      => 'Code Output',
                    'files'      => [ [ 'path' => 'See below', 'code' => $r['content'] ?? '' ] ],
                    'how_to_use' => '',
                    'warnings'   => '',
                ];
            }

            // Optionally save as WordPress draft
            if ( $save_draft && ! empty( $result['files'] ) ) {
                $combined = '';
                foreach ( $result['files'] as $f ) {
                    $combined .= "/* File: " . ( $f['path'] ?? '' ) . " */\n" . ( $f['code'] ?? '' ) . "\n\n";
                }
                $draft_id = wp_insert_post( [
                    'post_title'   => 'Dev: ' . ( $result['title'] ?? $task ),
                    'post_content' => '<pre>' . esc_html( $combined ) . '</pre>',
                    'post_status'  => 'draft',
                    'post_type'    => 'post',
                ] );
                $result['draft_id']       = $draft_id;
                $result['draft_edit_url'] = is_wp_error( $draft_id ) ? '' : get_edit_post_link( $draft_id, 'raw' );
            }

            return $result;
        }

        case 'manage_nav_menu': {
            $action     = $args['action']     ?? 'list';
            $item_title = $args['item_title'] ?? '';
            $item_url   = $args['item_url']   ?? '';
            $menu_name  = $args['menu_name']  ?? '';

            // Resolve menu: prefer named menu, otherwise fall back to first registered location
            $menu_obj = null;
            if ( $menu_name ) {
                $menu_obj = wp_get_nav_menu_object( $menu_name );
            }
            if ( ! $menu_obj ) {
                $locations = get_nav_menu_locations();
                foreach ( $locations as $loc_menu_id ) {
                    $menu_obj = wp_get_nav_menu_object( $loc_menu_id );
                    if ( $menu_obj ) break;
                }
            }
            if ( ! $menu_obj ) return [ 'error' => 'No navigation menu found. Please create one in Appearance → Menus.' ];

            $menu_id    = $menu_obj->term_id;
            $menu_items = wp_get_nav_menu_items( $menu_id );
            if ( ! is_array( $menu_items ) ) $menu_items = [];

            if ( $action === 'list' ) {
                $list = array_map( fn( $i ) => [
                    'id'    => $i->ID,
                    'title' => $i->title,
                    'url'   => $i->url,
                    'order' => $i->menu_order,
                ], $menu_items );
                return [ 'menu' => $menu_obj->name, 'items' => $list, 'count' => count( $list ) ];
            }

            if ( $action === 'remove' ) {
                if ( ! $item_title ) return [ 'error' => 'item_title is required to remove a menu item.' ];
                $removed = [];
                foreach ( $menu_items as $item ) {
                    if ( stripos( $item->title, $item_title ) !== false ) {
                        wp_delete_post( $item->ID, true );
                        $removed[] = $item->title;
                    }
                }
                if ( empty( $removed ) ) return [ 'error' => "No menu item matching \"{$item_title}\" found in the \"{$menu_obj->name}\" menu.", 'available' => array_column( $menu_items, 'title' ) ];
                return [ 'status' => 'removed', 'removed' => $removed, 'menu' => $menu_obj->name, 'message' => 'Item(s) removed from the nav menu.' ];
            }

            if ( $action === 'add' ) {
                if ( ! $item_title || ! $item_url ) return [ 'error' => 'item_title and item_url are required to add a menu item.' ];
                $item_id = wp_update_nav_menu_item( $menu_id, 0, [
                    'menu-item-title'  => $item_title,
                    'menu-item-url'    => $item_url,
                    'menu-item-status' => 'publish',
                    'menu-item-type'   => 'custom',
                ] );
                if ( is_wp_error( $item_id ) ) return [ 'error' => $item_id->get_error_message() ];
                return [ 'status' => 'added', 'item_id' => $item_id, 'title' => $item_title, 'url' => $item_url, 'menu' => $menu_obj->name, 'message' => "\"{$item_title}\" added to the \"{$menu_obj->name}\" menu." ];
            }

            return [ 'error' => 'Unknown action. Use list, remove, or add.' ];
        }

        default:
            return [ 'error' => "Unknown tool: {$name}" ];
    }
}

// ─── Dynamic tool executor ────────────────────────────────────────────────────

function ypnus_run_dynamic_tool( $tool, $args, $api_key, $disclosure, $nmls, $company ) {
    $prompt = $tool['prompt'] ?? '';
    // Interpolate placeholders
    $replacements = [
        '{nmls}'         => $nmls,
        '{company}'      => $company,
        '{disclosure}'   => $disclosure,
        '{args.topic}'   => $args['topic']   ?? '',
        '{args.city}'    => $args['city']    ?? '',
        '{args.content}' => $args['content'] ?? '',
        '{args.details}' => $args['details'] ?? '',
    ];
    $prompt = str_replace( array_keys( $replacements ), array_values( $replacements ), $prompt );

    $format = $tool['format'] ?? 'text';
    $temp   = in_array( $format, [ 'page', 'social_posts' ] ) ? 0.65 : 0.5;

    // For structured outputs, wrap in JSON instruction
    $json_formats = [ 'social_posts', 'page', 'keyword_table' ];
    if ( in_array( $format, $json_formats ) ) {
        if ( $format === 'social_posts' ) $prompt .= "\n\nReturn ONLY valid JSON: {linkedin, instagram, tiktok}";
        if ( $format === 'page' )         $prompt .= "\n\nReturn ONLY valid JSON: {meta_title, meta_description, h1, subheadline, hero_paragraph, body_html, url_slug}";
        if ( $format === 'keyword_table' ) $prompt .= "\n\nReturn ONLY valid JSON: {\"keywords\":[{keyword,intent,difficulty,angle}]}";
    } else {
        $prompt .= "\n\nReturn ONLY valid JSON: {\"output\": \"<your full response as a single string, with markdown formatting>\"}";
    }

    $r = ypnus_openai( $api_key, $prompt, $temp, 90 );
    $decoded = json_decode( $r['content'] ?? '{}', true );

    if ( $format === 'page' ) {
        if ( empty( $decoded['h1'] ) ) return [ 'error' => 'Page generation failed.', 'raw' => $decoded ];
        $html  = '<p><em>' . esc_html( $decoded['subheadline'] ?? '' ) . '</em></p>';
        $html .= $decoded['body_html'] ?? '';
        $context  = ( $args['topic'] ?? '' ) . ' ' . ( $args['city'] ?? '' );
        $cat_slug = $tool['category'] ?? '';
        $wp = ypnus_publish_draft( $decoded['h1'], $html, $context, $cat_slug, $decoded['meta_title'] ?? '', $decoded['meta_description'] ?? '' );
        return array_merge( $decoded, $wp );
    }

    if ( $format === 'social_posts' ) {
        foreach ( [ 'linkedin', 'instagram', 'tiktok' ] as $p ) {
            if ( isset( $decoded[$p] ) ) $decoded[$p] .= "\n\n" . $disclosure;
        }
        return $decoded;
    }

    return $decoded ?: [ 'error' => 'Tool returned empty result.' ];
}

// ─── Tool result formatter ────────────────────────────────────────────────────

function ypnus_format_tool_result( $fn_name, $fn_args, $result ) {
    if ( isset( $result['error'] ) ) return "**Error:** " . esc_html( $result['error'] );

    // Meta tools
    if ( $fn_name === 'save_memory' ) {
        return "🧠 **Memory saved:** `{$result['key']}` = {$result['value']}\n\nI'll remember this in every future conversation.";
    }
    if ( $fn_name === 'recall_memory' ) {
        $mem = $result['memory'] ?? [];
        if ( empty( $mem ) ) return "I don't have anything saved in memory yet. Tell me about your markets, loan niches, or business details and I'll remember them.";
        $out = "## What I Remember About You\n\n";
        foreach ( $mem as $m ) $out .= "- **{$m['key']}**: {$m['value']}\n";
        return $out;
    }
    if ( $fn_name === 'backend_developer' ) {
        $title    = $result['title']      ?? 'Code Output';
        $files    = $result['files']      ?? [];
        $howto    = $result['how_to_use'] ?? '';
        $warnings = $result['warnings']   ?? '';
        $draft    = $result['draft_edit_url'] ?? '';

        $out = "## 🛠 Backend Dev: {$title}\n\n";

        foreach ( $files as $f ) {
            $path = $f['path'] ?? '';
            $code = $f['code'] ?? '';
            if ( $path ) $out .= "**File:** `{$path}`\n\n";
            $out .= "```php\n{$code}\n```\n\n";
        }

        if ( $howto ) {
            $out .= "### How to Use\n{$howto}\n\n";
        }
        if ( $warnings ) {
            $out .= "> ⚠️ **Note:** {$warnings}\n\n";
        }
        if ( $draft ) {
            $out .= "📋 **[View saved draft in WordPress admin]({$draft})**\n";
        }
        return $out;
    }
    if ( $fn_name === 'frontend_developer' ) {
        $title   = $result['title']               ?? 'Frontend Output';
        $files   = $result['files']               ?? [];
        $howto   = $result['how_to_use']          ?? '';
        $preview = $result['preview_description'] ?? '';

        $out = "## 🎨 Frontend Dev: {$title}\n\n";
        if ( $preview ) $out .= "_Preview:_ {$preview}\n\n";

        foreach ( $files as $f ) {
            $path = $f['path']     ?? '';
            $lang = $f['language'] ?? 'html';
            $code = $f['code']     ?? '';
            if ( $path ) $out .= "**File:** `{$path}`\n\n";
            $out .= "```{$lang}\n{$code}\n```\n\n";
        }

        if ( $howto ) $out .= "### How to Use\n{$howto}\n";
        return $out;
    }
    if ( $fn_name === 'performance_engineer' ) {
        $diagnosis = $result['diagnosis']         ?? '';
        $fixes     = $result['priority_fixes']    ?? [];
        $hostinger = $result['hostinger_specific'] ?? '';
        $snippet   = $result['code_snippet']      ?? '';
        $tools     = $result['tools_to_use']      ?? [];
        $avoid     = $result['do_not_do']         ?? [];

        $out = "## ⚡ Performance Audit\n\n";
        if ( $diagnosis ) $out .= "**Diagnosis:** {$diagnosis}\n\n";

        if ( $fixes ) {
            $out .= "### Priority Fixes\n";
            foreach ( $fixes as $i => $f ) $out .= ( $i + 1 ) . ". {$f}\n";
            $out .= "\n";
        }
        if ( $hostinger ) $out .= "**Hostinger-Specific:** {$hostinger}\n\n";
        if ( $snippet )   $out .= "### Code / Config\n```\n{$snippet}\n```\n\n";
        if ( $tools )     $out .= "**Tools to use:** " . implode( ', ', $tools ) . "\n\n";
        if ( $avoid )     $out .= "**Avoid:** " . implode( ', ', $avoid ) . "\n";
        return $out;
    }
    if ( $fn_name === 'schema_markup_builder' ) {
        $types      = $result['schema_types_used']       ?? [];
        $script     = $result['script_block']            ?? '';
        $where      = $result['where_to_add']            ?? '';
        $eligibility = $result['rich_result_eligibility'] ?? '';
        $val_url    = $result['validation_url']          ?? 'https://search.google.com/test/rich-results';

        $out = "## 🏷 Schema Markup\n\n";
        if ( $types ) $out .= "**Types:** " . implode( ', ', $types ) . "\n\n";
        if ( $script ) $out .= "### JSON-LD Script Block\n```json\n{$script}\n```\n\n";
        if ( $where ) $out .= "**Where to add:** {$where}\n\n";
        if ( $eligibility ) $out .= "**Rich result eligibility:** {$eligibility}\n\n";
        $out .= "**Validate at:** [{$val_url}]({$val_url})";
        return $out;
    }
    if ( $fn_name === 'video_script_writer' ) {
        $title      = $result['title']                    ?? 'Video Script';
        $hook       = $result['hook']                     ?? '';
        $script     = $result['script']                   ?? '';
        $cta        = $result['cta']                      ?? '';
        $chapters   = $result['chapters']                 ?? [];
        $desc       = $result['description_template']     ?? '';
        $thumbnails = $result['thumbnail_text_suggestions'] ?? [];
        $note       = $result['compliance_notes']         ?? '';

        $out = "## 🎬 Video Script: {$title}\n\n";
        if ( $hook )   $out .= "**Hook (first 5–10 sec):** {$hook}\n\n";
        if ( $script ) $out .= "---\n### Script\n\n{$script}\n\n";
        if ( $cta )    $out .= "---\n### Closing CTA\n{$cta}\n\n";

        if ( $chapters ) {
            $out .= "### Chapters\n";
            foreach ( $chapters as $c ) $out .= "- `{$c['timestamp']}` {$c['label']}\n";
            $out .= "\n";
        }
        if ( $thumbnails ) {
            $out .= "### Thumbnail Text Options\n";
            foreach ( $thumbnails as $t ) $out .= "- {$t}\n";
            $out .= "\n";
        }
        if ( $desc ) $out .= "### Description / Caption\n{$desc}\n\n";
        if ( $note ) $out .= "> ⚖️ _Compliance note: {$note}_";
        return $out;
    }
    if ( $fn_name === 'realtor_partner_system' ) {
        $summary   = $result['system_summary']    ?? '';
        $vp        = $result['value_proposition'] ?? '';
        $tiers     = $result['partnership_tiers'] ?? [];
        $scripts   = $result['outreach_scripts']  ?? [];
        $onboard   = $result['onboarding_sequence'] ?? [];
        $comarket  = $result['co_marketing_ideas']  ?? [];
        $crm       = $result['crm_tagging_strategy'] ?? '';
        $plan90    = $result['90_day_action_plan']   ?? '';

        $out = "## 🤝 Realtor Partner System\n\n";
        if ( $summary ) $out .= "**Strategy:** {$summary}\n\n";
        if ( $vp )      $out .= "**Your Value Proposition to Realtors:** _{$vp}_\n\n";

        if ( $tiers ) {
            $out .= "### Partnership Tiers\n";
            foreach ( $tiers as $t ) {
                $out .= "#### {$t['tier_name']} Tier\n";
                $out .= "_Criteria:_ {$t['criteria']}\n";
                if ( ! empty( $t['benefits'] ) )        $out .= "_Benefits:_ " . implode( ', ', $t['benefits'] ) . "\n";
                if ( ! empty( $t['co_marketing_assets'] ) ) $out .= "_Co-marketing assets:_ " . implode( ', ', $t['co_marketing_assets'] ) . "\n";
                $out .= "\n";
            }
        }
        if ( $scripts ) {
            $out .= "### Outreach Scripts\n";
            foreach ( $scripts as $channel => $text ) {
                $label = ucwords( str_replace( '_', ' ', $channel ) );
                $out .= "**{$label}:**\n{$text}\n\n";
            }
        }
        if ( $onboard ) {
            $out .= "### Onboarding Sequence\n";
            foreach ( $onboard as $s ) $out .= "**Step {$s['step']} — {$s['timing']}:** {$s['action']}\n_{$s['template']}_\n\n";
        }
        if ( $comarket ) $out .= "### Co-Marketing Ideas\n" . implode( "\n", array_map( fn($c) => "- {$c}", $comarket ) ) . "\n\n";
        if ( $crm )      $out .= "### CRM Tagging Strategy\n{$crm}\n\n";
        if ( $plan90 )   $out .= "### 90-Day Action Plan\n{$plan90}";
        return $out;
    }
    if ( $fn_name === 'analytics_interpreter' ) {
        $tldr       = $result['tldr']                   ?? '';
        $top        = $result['top_performing_pages']   ?? [];
        $under      = $result['underperforming_pages']  ?? [];
        $sources    = $result['traffic_source_insights'] ?? [];
        $leaks      = $result['funnel_leaks']           ?? [];
        $quick      = $result['quick_wins']             ?? [];
        $priorities = $result['priority_actions']       ?? [];
        $track_next = $result['what_to_track_next']     ?? [];

        $out = "## 📊 Analytics Interpretation\n\n";
        if ( $tldr ) $out .= "**Summary:** {$tldr}\n\n";

        if ( $priorities ) {
            $out .= "### Priority Actions\n";
            foreach ( $priorities as $p ) {
                $out .= "**#{$p['rank']} [{$p['effort']} effort]** {$p['action']}\n";
                $out .= "_Expected impact:_ {$p['expected_impact']}\n\n";
            }
        }
        if ( $top ) {
            $out .= "### Top-Performing Pages — Double Down\n";
            foreach ( $top as $p ) $out .= "- **{$p['page']}** — {$p['why_it_works']} → _{$p['action']}_\n";
            $out .= "\n";
        }
        if ( $under ) {
            $out .= "### Underperforming Pages — Fix or Cut\n";
            foreach ( $under as $p ) $out .= "- **{$p['page']}** — {$p['problem']} → _{$p['fix']}_\n";
            $out .= "\n";
        }
        if ( $sources ) {
            $out .= "### Traffic Source Insights\n";
            foreach ( $sources as $s ) $out .= "- **{$s['source']}:** {$s['assessment']} → _{$s['recommendation']}_\n";
            $out .= "\n";
        }
        if ( $leaks ) {
            $out .= "### Funnel Leaks\n";
            foreach ( $leaks as $l ) $out .= "- **{$l['stage']}:** {$l['drop_off_signal']} → _{$l['fix']}_\n";
            $out .= "\n";
        }
        if ( $quick )      $out .= "### Quick Wins\n" . implode( "\n", array_map( fn($q) => "- {$q}", $quick ) ) . "\n\n";
        if ( $track_next ) $out .= "### What to Track Next\n" . implode( "\n", array_map( fn($t) => "- {$t}", $track_next ) );
        return $out;
    }
    if ( $fn_name === 'cro_specialist' ) {
        $assessment = $result['overall_assessment'] ?? '';
        $fixes      = $result['priority_fixes']     ?? [];
        $rewrites   = $result['copy_rewrites']      ?? [];
        $trust      = $result['trust_signals_to_add'] ?? [];
        $ab_tests   = $result['ab_test_hypotheses'] ?? [];
        $quick_wins = $result['quick_wins']         ?? [];

        $out = "## 🎯 CRO Audit Results\n\n";
        if ( $assessment ) $out .= "**Assessment:** {$assessment}\n\n";

        if ( $fixes ) {
            $out .= "### Priority Fixes\n";
            foreach ( $fixes as $f ) {
                $rank   = $f['rank']           ?? '';
                $elem   = $f['element']        ?? '';
                $issue  = $f['issue']          ?? '';
                $fix    = $f['fix']            ?? '';
                $lift   = $f['expected_lift']  ?? '';
                $effort = $f['effort']         ?? '';
                $out .= "**#{$rank} — {$elem}** `[{$effort} effort | +{$lift}]`\n";
                $out .= "_Problem:_ {$issue}\n_Fix:_ {$fix}\n\n";
            }
        }
        if ( $rewrites ) {
            $out .= "### Suggested Copy Rewrites\n";
            foreach ( $rewrites as $k => $v ) {
                if ( $v ) $out .= "- **" . ucfirst( str_replace( '_', ' ', $k ) ) . ":** {$v}\n";
            }
            $out .= "\n";
        }
        if ( $trust )      $out .= "### Trust Signals to Add\n" . implode( "\n", array_map( fn($t) => "- {$t}", $trust ) ) . "\n\n";
        if ( $ab_tests ) {
            $out .= "### A/B Test Hypotheses\n";
            foreach ( $ab_tests as $t ) $out .= "- [{$t['priority']}] {$t['hypothesis']}\n";
            $out .= "\n";
        }
        if ( $quick_wins ) $out .= "### Quick Wins (< 30 min)\n" . implode( "\n", array_map( fn($q) => "- {$q}", $quick_wins ) );
        return $out;
    }
    if ( $fn_name === 'email_sequence_writer' ) {
        $name   = $result['sequence_name']    ?? 'Email Sequence';
        $emails = $result['emails']           ?? [];
        $setup  = $result['setup_notes']      ?? '';
        $raw    = $result['raw']              ?? '';

        if ( $raw && empty( $emails ) ) return "## 📧 {$name}\n\n{$raw}";

        $out = "## 📧 {$name}\n\n";
        foreach ( $emails as $e ) {
            $num     = $e['email_number']        ?? '';
            $timing  = $e['send_timing']         ?? '';
            $subject = $e['subject_line']        ?? '';
            $preview = $e['preview_text']        ?? '';
            $body    = $e['body']                ?? '';
            $cta     = $e['cta_text']            ?? '';
            $note    = $e['compliance_note']     ?? '';

            $out .= "---\n### Email {$num} — Send: {$timing}\n";
            $out .= "**Subject:** {$subject}\n**Preview:** _{$preview}_\n\n";
            $out .= $body . "\n\n";
            if ( $cta )  $out .= "**CTA:** [{$cta}]\n";
            if ( $note ) $out .= "> ⚖️ _Compliance note: {$note}_\n";
            $out .= "\n";
        }
        if ( $setup ) $out .= "---\n### Setup Notes\n{$setup}";
        return $out;
    }
    if ( $fn_name === 'content_strategist' ) {
        $summary   = $result['strategy_summary']         ?? '';
        $pillars   = $result['pillar_pages']             ?? [];
        $clusters  = $result['cluster_posts']            ?? [];
        $magnets   = $result['lead_magnets']             ?? [];
        $gaps      = $result['content_gaps']             ?? [];
        $quick     = $result['quick_publish_wins']       ?? [];
        $calendar  = $result['editorial_calendar_summary'] ?? '';

        $out = "## 📋 Content Strategy\n\n";
        if ( $summary ) $out .= "**Strategy:** {$summary}\n\n";

        if ( $pillars ) {
            $out .= "### Pillar Pages\n";
            foreach ( $pillars as $p ) {
                $out .= "- **{$p['title']}** — `{$p['slug']}` _{$p['funnel_stage']}_ | {$p['word_count_target']} words\n";
                if ( ! empty( $p['content_brief'] ) ) $out .= "  {$p['content_brief']}\n";
            }
            $out .= "\n";
        }
        if ( $clusters ) {
            $out .= "### Cluster Blog Posts\n";
            foreach ( $clusters as $c ) {
                $week = isset( $c['publish_week'] ) ? " (Week {$c['publish_week']})" : '';
                $out .= "- **{$c['title']}** — `{$c['slug']}`{$week} → links to `{$c['links_to_pillar']}`\n";
            }
            $out .= "\n";
        }
        if ( $magnets ) {
            $out .= "### Lead Magnets\n";
            foreach ( $magnets as $m ) $out .= "- **{$m['title']}** ({$m['format']}) — {$m['topic']} | Promote: {$m['cta_placement']}\n";
            $out .= "\n";
        }
        if ( $gaps )   $out .= "### Content Gaps\n" . implode( "\n", array_map( fn($g) => "- {$g}", $gaps ) ) . "\n\n";
        if ( $quick )  $out .= "### Quick Publish Wins\n" . implode( "\n", array_map( fn($q) => "- {$q}", $quick ) ) . "\n\n";
        if ( $calendar ) $out .= "### Editorial Calendar\n{$calendar}";
        return $out;
    }
    if ( $fn_name === 'create_tool' ) {
        $slug = $result['slug'] ?? '';
        $name = $result['name'] ?? $slug;
        $out  = "## ✅ New Tool Created: {$name}\n\n";
        $out .= "I've added `{$slug}` to your agent toolset and saved it to your WordPress dashboard.\n\n";
        $out .= "**You can manage it at:** WordPress Admin → Settings → MLO Toolkit → Agent Tools\n\n";
        $out .= "Try it now by describing what you want to do.";
        return $out;
    }
    if ( $fn_name === 'update_tool' ) {
        return "## ✅ Tool Updated\n\n`{$result['slug']}` has been updated. The new behavior is active immediately.";
    }

    // Custom dynamic tool
    if ( str_starts_with( $fn_name, 'custom__' ) ) {
        $format = ypnus_get_tool_by_slug( substr( $fn_name, 8 ) )['format'] ?? 'text';
        if ( $format === 'social_posts' ) {
            $fn_name = 'generate_social_posts';
        } elseif ( $format === 'page' ) {
            return ypnus_format_page_result( $fn_args, $result );
        } elseif ( $format === 'keyword_table' ) {
            $fn_name = 'scout_keywords';
        } else {
            return $result['output'] ?? json_encode( $result, JSON_PRETTY_PRINT );
        }
    }

    switch ( $fn_name ) {

        case 'generate_social_posts': {
            $loan = $fn_args['loan_type'] ?? '';
            $label = $loan ? " ({$loan})" : '';
            $out  = "## Social Posts{$label}\n\n";
            $out .= "### LinkedIn\n" . ( $result['linkedin']  ?? '*(none)*' ) . "\n\n";
            $out .= "### Instagram\n" . ( $result['instagram'] ?? '*(none)*' ) . "\n\n";
            $out .= "### TikTok Script\n" . ( $result['tiktok'] ?? '*(none)*' );
            return $out;
        }

        case 'scout_keywords': {
            $topic = $fn_args['topic'] ?? '';
            $out   = "## Keyword Research — {$topic}\n\n";
            $out  .= "| Keyword | Intent | Difficulty | Content Angle | Site Fit |\n";
            $out  .= "|---------|--------|------------|---------------|----------|\n";
            foreach ( (array)( $result['keywords'] ?? $result ) as $kw ) {
                $stars   = str_repeat( '⭐', (int)( $kw['website_fit'] ?? 0 ) );
                $fit_why = $kw['fit_reason'] ?? '';
                $fit_col = $stars ? "{$stars} {$fit_why}" : $fit_why;
                $out    .= sprintf( "| %s | %s | %s | %s | %s |\n", $kw['keyword'] ?? '', $kw['intent'] ?? '', $kw['difficulty'] ?? '', $kw['angle'] ?? '', $fit_col );
            }
            return $out;
        }

        case 'check_compliance': {
            $score   = $result['score']   ?? '?';
            $verdict = $result['verdict'] ?? ( $result['passed'] ? 'Pass' : 'Fail' );
            $icon    = ( strtolower( $verdict ) === 'pass' || ! empty( $result['passed'] ) ) ? '✅' : '❌';
            $out     = "## Compliance Check {$icon} — {$verdict} (Score: {$score}/100)\n\n";
            $out    .= "**Summary:** " . ( $result['summary'] ?? '' ) . "\n\n";
            foreach ( $result['flags'] ?? [] as $f ) {
                $sev  = strtoupper( $f['severity'] ?? 'INFO' );
                $rec  = $f['recommendation'] ?? $f['suggestion'] ?? '';
                $out .= "- **[{$sev}]** {$f['issue']} — _{$rec}_\n";
            }
            return $out;
        }

        case 'suggest_silo': {
            $out  = "## Content Silo Recommendation\n\n";
            $out .= "**Silo:** " . ( $result['silo_name'] ?? $result['silo'] ?? '' ) . "\n\n";
            $out .= "**URL Slug:** `" . ( $result['url_slug'] ?? '' ) . "`\n\n";
            $out .= "**Meta Description:** " . ( $result['meta_description'] ?? '' ) . "\n\n";
            foreach ( $result['internal_links'] ?? [] as $l ) {
                $out .= "- [{$l['anchor']}]({$l['url']}) — {$l['reason']}\n";
            }
            return $out;
        }

        case 'diagnose_error': {
            $sev  = strtoupper( $result['severity'] ?? 'medium' );
            $out  = "## WordPress Error Diagnosis\n\n";
            $out .= "**Root Cause:** " . ( $result['root_cause'] ?? '' ) . "\n\n";
            $out .= "**Severity:** {$sev} | **Category:** " . ( $result['category'] ?? '' ) . "\n\n";
            $steps = $result['steps'] ?? $result['immediate_fix']['steps'] ?? [];
            if ( $steps ) {
                $out .= "### Fix Steps\n";
                foreach ( $steps as $i => $s ) $out .= ( $i + 1 ) . ". {$s}\n";
                $out .= "\n";
            }
            $fix = $result['code_fix']['after'] ?? $result['code_fix'] ?? '';
            if ( $fix && is_string( $fix ) ) $out .= "### Code Fix\n```php\n{$fix}\n```\n\n";
            $check = is_array( $result['what_to_check_first'] ?? null ) ? implode( "\n", array_map( fn( $c ) => "- {$c}", $result['what_to_check_first'] ) ) : ( $result['what_to_check'] ?? '' );
            if ( $check ) $out .= "**What to Check:** {$check}\n\n";
            if ( $result['warning'] ?? null ) $out .= "> ⚠️ {$result['warning']}";
            return $out;
        }

        case 'build_page': {
            return ypnus_format_page_result( $fn_args, $result );
        }

        case 'site_wizard': {
            $out  = "## 🏠 Your Website Launch Plan\n\n";
            $out .= ( $result['welcome_message'] ?? '' ) . "\n\n";
            $out .= "### Your Strategy\n" . ( $result['site_summary'] ?? '' ) . "\n\n";

            $pages = $result['pages'] ?? [];
            if ( $pages ) {
                $out .= "### Pages to Build (in order)\n\n";
                foreach ( $pages as $i => $p ) {
                    $num  = $i + 1;
                    $out .= "**{$num}. {$p['title']}** — `/{$p['url_slug']}`\n";
                    $out .= "_Purpose:_ {$p['purpose']}\n";
                    $out .= "_Keyword:_ {$p['primary_keyword']}\n";
                    if ( ! empty( $p['conversion_elements'] ) ) {
                        $out .= "_Conversion elements:_ " . implode( ', ', $p['conversion_elements'] ) . "\n";
                    }
                    $out .= "_To build it, tell me:_ \"{$p['build_command']}\"\n\n";
                }
            }

            if ( ! empty( $result['plugin_checklist'] ) ) {
                $out .= "### Plugins to Install First\n";
                foreach ( $result['plugin_checklist'] as $pl ) {
                    $free = ! empty( $pl['free'] ) ? ' (free)' : '';
                    $out .= "- **{$pl['plugin']}**{$free} — {$pl['purpose']}\n";
                }
                $out .= "\n";
            }

            if ( ! empty( $result['conversion_rules'] ) ) {
                $out .= "### Conversion Rules for Every Page\n";
                foreach ( $result['conversion_rules'] as $r ) $out .= "- {$r}\n";
                $out .= "\n";
            }

            if ( ! empty( $result['launch_checklist'] ) ) {
                $out .= "### Launch Checklist\n";
                foreach ( $result['launch_checklist'] as $i => $step ) {
                    $out .= ( $i + 1 ) . ". {$step}\n";
                }
                $out .= "\n";
            }

            $out .= "---\n**Your next step right now:** " . ( $result['first_thing_to_do'] ?? '' ) . "\n\n";
            $out .= "_" . ( $result['encouragement'] ?? '' ) . "_\n\n";
            $out .= "> 💡 **Tip:** Tell me \"build all my pages\" and I'll create every draft in WordPress automatically — then all you have to do is review and hit publish.\n";
            return $out;
        }

        case 'build_full_site': {
            $built  = $result['built']  ?? [];
            $failed = $result['failed'] ?? [];
            $out    = "## ✅ Your Website Is Built!\n\n";
            $out   .= "**" . count( $built ) . " pages created as WordPress drafts.**\n\n";

            if ( $built ) {
                $out .= "### Pages Ready to Review\n";
                foreach ( $built as $p ) {
                    $out .= "- **{$p['title']}** — `/{$p['slug']}`";
                    if ( ! empty( $p['edit_url'] ) )    $out .= " | [Edit]({$p['edit_url']})";
                    if ( ! empty( $p['preview_url'] ) ) $out .= " | [Preview]({$p['preview_url']})";
                    $out .= "\n";
                }
                $out .= "\n";
            }

            if ( $failed ) {
                $out .= "### Pages to Retry\n";
                foreach ( $failed as $f ) $out .= "- {$f}\n";
                $out .= "\n";
            }

            $out .= "---\n**Next step:** " . ( $result['next_step'] ?? 'Review your drafts in WordPress → Pages → All Pages.' ) . "\n\n";
            $out .= "**After reviewing:** Tell me which page to write a long-form article for, or ask me to score your Google My Business listing to drive local traffic to this new site.\n";
            return $out;
        }

        case 'write_article': {
            $out  = "## Article Draft: " . ( $result['h1'] ?? $fn_args['topic'] ?? 'Article' ) . "\n\n";
            if ( ! empty( $result['wp_post_id'] ) ) {
                $out .= "✅ **Draft saved to WordPress!**\n";
                $out .= "- Edit URL: " . ( $result['wp_edit_url'] ?? '' ) . "\n";
                $out .= "- Preview: " . ( $result['wp_preview_url'] ?? '' ) . "\n\n";
            }
            $out .= "**Primary keyword:** " . ( $result['primary_keyword'] ?? '' ) . "\n";
            $out .= "**Estimated word count:** ~" . ( $result['word_count_estimate'] ?? '1500–2000' ) . " words\n";
            $out .= "**URL slug:** `/" . ( $result['url_slug'] ?? '' ) . "`\n\n";
            if ( ! empty( $result['secondary_keywords'] ) ) {
                $out .= "**Secondary keywords:** " . implode( ', ', $result['secondary_keywords'] ) . "\n\n";
            }
            if ( ! empty( $result['internal_links'] ) ) {
                $out .= "**Internal links included:**\n";
                foreach ( $result['internal_links'] as $l ) $out .= "- {$l}\n";
                $out .= "\n";
            }
            if ( ! empty( $result['external_links'] ) ) {
                $out .= "**Authority backlinks included:**\n";
                foreach ( $result['external_links'] as $l ) $out .= "- {$l}\n";
                $out .= "\n";
            }
            if ( ! empty( $result['affiliate_links'] ) ) {
                $out .= "**Affiliate links included:**\n";
                foreach ( $result['affiliate_links'] as $l ) $out .= "- {$l}\n";
                $out .= "\n";
            }
            $out .= "**Meta title:** " . ( $result['meta_title'] ?? '' ) . "\n";
            $out .= "**Meta description:** " . ( $result['meta_description'] ?? '' ) . "\n";
            return $out;
        }

        case 'plan_website': {
            $out  = "## Website Architecture Plan\n\n";
            $out .= ( $result['site_summary'] ?? $result['summary'] ?? '' ) . "\n\n";
            $pages = $result['pages'] ?? [];
            if ( $pages ) {
                $out .= "### Page Map\n| Page | URL | Priority |\n|------|-----|----------|\n";
                foreach ( $pages as $p ) {
                    $out .= sprintf( "| %s | `%s` | %s |\n", $p['title'] ?? '', $p['url'] ?? '', $p['priority'] ?? '' );
                }
                $out .= "\n";
            }
            $order = $result['launch_order'] ?? [];
            if ( $order ) {
                $out .= "### Launch Order\n";
                foreach ( $order as $i => $s ) $out .= ( $i + 1 ) . ". {$s}\n";
                $out .= "\n";
            }
            foreach ( $result['quick_wins'] ?? [] as $w ) $out .= "- {$w}\n";
            return $out;
        }

        case 'score_gmb': {
            $total   = $result['total_score'] ?? 0;
            $grade   = $result['grade']       ?? 'N/A';
            $summary = $result['summary']     ?? '';
            $bar     = str_repeat( '█', (int) round( $total / 10 ) ) . str_repeat( '░', 10 - (int) round( $total / 10 ) );
            $color   = $total >= 80 ? '🟢' : ( $total >= 60 ? '🟡' : '🔴' );

            $out = "## Google My Business Score {$color}\n\n# {$total}/100 — Grade: {$grade}\n`{$bar}`\n\n_{$summary}_\n\n";

            $cats = $result['categories'] ?? [];
            if ( $cats ) {
                $out .= "### Score Breakdown\n| Category | Score | Max | Status |\n|----------|-------|-----|--------|\n";
                foreach ( $cats as $c ) {
                    $icon = ( $c['score'] ?? 0 ) >= ( $c['max'] ?? 10 ) * 0.8 ? '✅' : ( ( $c['score'] ?? 0 ) >= ( $c['max'] ?? 10 ) * 0.5 ? '⚠️' : '❌' );
                    $out .= sprintf( "| %s | %s | %s | %s |\n", $c['name'] ?? '', $c['score'] ?? 0, $c['max'] ?? 10, $icon . ' ' . ( $c['status'] ?? '' ) );
                }
                $out .= "\n### Action Items\n";
                foreach ( $cats as $c ) {
                    $actions = $c['actions'] ?? [];
                    if ( ! $actions ) continue;
                    $out .= "**" . ( $c['name'] ?? '' ) . "** ({$c['score']}/{$c['max']})\n";
                    foreach ( $actions as $a ) {
                        $out .= "- [" . strtoupper( $a['priority'] ?? 'medium' ) . "] " . ( $a['action'] ?? $a ) . "\n";
                    }
                    $out .= "\n";
                }
            }

            foreach ( $result['quick_wins'] ?? [] as $i => $w ) $out .= ( $i + 1 ) . ". {$w}\n";

            if ( ! empty( $result['wp_post_id'] ) ) {
                $out .= "\n---\n✅ **Full GMB Guide saved as WordPress draft**\n";
                $out .= "- [Edit Guide](" . ( $result['wp_edit_url'] ?? '#' ) . ")\n";
                $out .= "- [Preview Guide](" . ( $result['wp_preview_url'] ?? '#' ) . ")\n";
            }
            return $out;
        }

        case 'recommend_plugins': {
            $cat  = $result['plugin_category']    ?? 'Plugin';
            $prim = $result['primary_recommendation'] ?? [];
            $name_p = $prim['plugin'] ?? 'Unknown';
            $impact = $prim['performance_impact'] ?? 'unknown';
            $conflict = $prim['conflict_risk'] ?? 'unknown';
            $impact_icon  = $impact  === 'none' || $impact  === 'minimal' ? '🟢' : ( $impact  === 'moderate' ? '🟡' : '🔴' );
            $conflict_icon = $conflict === 'none' || $conflict === 'low'  ? '🟢' : ( $conflict === 'medium'  ? '🟡' : '🔴' );
            $free = ! empty( $prim['free_version_ok'] ) ? '✅ Free version works' : '💳 Paid required: ' . ( $prim['paid_plan'] ?? '' );

            $out  = "## Plugin Recommendation — {$cat}\n\n";
            $out .= "### ✅ Best Choice: {$name_p}\n\n";
            $out .= ( $prim['why'] ?? '' ) . "\n\n";
            $out .= "| | |\n|---|---|\n";
            $out .= "| **Cost** | {$free} |\n";
            $out .= "| **Performance Impact** | {$impact_icon} " . ucfirst( $impact ) . " |\n";
            $out .= "| **Conflict Risk** | {$conflict_icon} " . ucfirst( $conflict ) . " |\n";
            $out .= "| **Setup Time** | " . ( $result['estimated_setup_time'] ?? '—' ) . " |\n\n";

            if ( $prim['install_notes'] ?? '' ) {
                $out .= "**How to configure:** " . $prim['install_notes'] . "\n\n";
            }
            if ( $prim['compliance_note'] ?? '' ) {
                $out .= "> ⚠️ **Compliance Note:** " . $prim['compliance_note'] . "\n\n";
            }
            if ( $result['stack_conflicts'] ?? '' ) {
                $out .= "> 🔧 **Stack Note:** " . $result['stack_conflicts'] . "\n\n";
            }

            $alts = $result['alternatives'] ?? [];
            if ( $alts ) {
                $out .= "### Alternatives\n";
                foreach ( $alts as $a ) {
                    $out .= "- **" . ( $a['plugin'] ?? '' ) . "** — " . ( $a['why_alternative'] ?? '' ) . " *(tradeoff: " . ( $a['tradeoff'] ?? '' ) . ")*\n";
                }
                $out .= "\n";
            }

            $avoid = $result['avoid'] ?? [];
            if ( $avoid ) {
                $out .= "### ❌ Avoid\n";
                foreach ( $avoid as $av ) {
                    $out .= "- **" . ( $av['plugin'] ?? '' ) . "** — " . ( $av['reason'] ?? '' ) . "\n";
                }
                $out .= "\n";
            }

            if ( $result['pro_tip'] ?? '' ) {
                $out .= "**Pro tip:** " . $result['pro_tip'];
            }
            return $out;
        }

        case 'marketing_advisor': {
            $out  = "## Marketing Strategy\n\n";
            $out .= ( $result['executive_summary'] ?? '' ) . "\n\n";

            $actions = $result['priority_actions'] ?? [];
            if ( $actions ) {
                $out .= "### Priority Actions\n\n";
                foreach ( $actions as $a ) {
                    $rank = $a['rank'] ?? '•';
                    $out .= "**{$rank}. " . ( $a['action'] ?? '' ) . "** (" . ( $a['cost'] ?? '' ) . " · " . ( $a['time_to_implement'] ?? '' ) . ")\n";
                    $out .= ( $a['what_to_do'] ?? '' ) . "\n";
                    $out .= "_Expected: " . ( $a['expected_result'] ?? '' ) . "_\n\n";
                }
            }

            $stack = $result['full_marketing_stack'] ?? [];
            if ( $stack ) {
                $out .= "### Your Full Marketing Stack\n\n";
                $labels = [
                    'lead_capture'     => 'Lead Capture',
                    'crm'              => 'CRM',
                    'email_automation' => 'Email Automation',
                    'landing_pages'    => 'Landing Pages',
                    'seo_local'        => 'Local SEO',
                    'social_automation'=> 'Social Media',
                    'referral_system'  => 'Referral System',
                    'paid_ads'         => 'Paid Ads',
                    'analytics'        => 'Analytics',
                ];
                foreach ( $labels as $key => $label ) {
                    $item = $stack[ $key ] ?? null;
                    if ( ! $item ) continue;
                    $tool = $item['tool'] ?? $item['approach'] ?? $item['recommendation'] ?? '';
                    $why  = $item['why'] ?? $item['strategy'] ?? $item['realtor_strategy'] ?? $item['budget_guidance'] ?? '';
                    $wp   = $item['wordpress_plugin'] ?? '';
                    $out .= "**{$label}:** {$tool}";
                    if ( $wp ) $out .= " (WP Plugin: _{$wp}_)";
                    $out .= "\n_{$why}_\n\n";
                }
            }

            $seq = $result['email_sequence'] ?? [];
            if ( $seq ) {
                $out .= "### Email Follow-Up Sequence\n";
                $out .= "**Trigger:** " . ( $seq['trigger'] ?? '' ) . "\n\n";
                foreach ( $seq['emails'] ?? [] as $e ) {
                    $out .= "- **Day " . ( $e['day'] ?? '?' ) . "** — _" . ( $e['subject'] ?? '' ) . "_ — " . ( $e['key_content'] ?? '' ) . "\n";
                }
                $out .= "\n";
            }

            $wins = $result['conversion_quick_wins'] ?? [];
            if ( $wins ) {
                $out .= "### Conversion Quick Wins\n";
                foreach ( $wins as $i => $w ) $out .= ( $i + 1 ) . ". {$w}\n";
                $out .= "\n";
            }

            if ( $result['biggest_mistake'] ?? '' ) {
                $out .= "> ⚠️ **Biggest mistake MLOs make:** " . $result['biggest_mistake'] . "\n\n";
            }

            $plan = $result['month_1_plan'] ?? [];
            if ( $plan ) {
                $out .= "### 30-Day Action Plan\n";
                foreach ( $plan as $i => $step ) $out .= "Week " . ( $i + 1 ) . ": {$step}\n";
                $out .= "\n";
            }

            $kpis = $result['kpis_to_track'] ?? [];
            if ( $kpis ) {
                $out .= "### KPIs to Track\n";
                foreach ( $kpis as $k ) $out .= "- {$k}\n";
            }

            return $out;
        }

        default:
            return "**Tool:** `{$fn_name}`\n\n```json\n" . json_encode( $result, JSON_PRETTY_PRINT ) . "\n```";
    }
}

function ypnus_format_page_result( $fn_args, $result ) {
    $out = "## Page Draft: " . ( $result['h1'] ?? $fn_args['page_type'] ?? 'Page' ) . "\n\n";
    if ( ! empty( $result['wp_post_id'] ) ) {
        $out .= "✅ **Draft page created in WordPress!**\n";
        $out .= "- [Edit in WordPress](" . ( $result['wp_edit_url'] ?? '#' ) . ")\n";
        $out .= "- [Preview Page](" . ( $result['wp_preview_url'] ?? '#' ) . ")\n\n";
    }
    $out .= "**Subheadline:** " . ( $result['subheadline'] ?? '' ) . "\n\n";
    $out .= "**Hero:** " . ( $result['hero_paragraph'] ?? '' ) . "\n\n";
    foreach ( $result['benefit_blocks'] ?? [] as $b ) {
        $out .= "- **" . ( $b['headline'] ?? '' ) . "** — " . ( $b['body'] ?? '' ) . "\n";
    }
    $out .= "\n";
    foreach ( $result['body_sections'] ?? [] as $s ) {
        $out .= "### " . ( $s['heading'] ?? '' ) . "\n" . ( $s['content'] ?? '' ) . "\n\n";
    }
    foreach ( $result['faqs'] ?? [] as $f ) {
        $out .= "**Q: " . ( $f['question'] ?? '' ) . "**\n" . ( $f['answer'] ?? '' ) . "\n\n";
    }
    $out .= "---\n**SEO** | Meta: " . ( $result['meta_title'] ?? '' ) . " | Slug: `" . ( $result['url_slug'] ?? '' ) . "`";
    return $out;
}

// ─── Shortcodes ───────────────────────────────────────────────────────────────

add_shortcode( 'ypnus_content_generator', function () {
    ob_start(); ?>
    <div class="ypnus-tool" id="ypnus-content-generator" role="main" aria-label="Social Content Generator">
        <div class="ypnus-tool__header">
            <span class="ypnus-tool__eyebrow">FINRA / CFPB Compliant</span>
            <h2 class="ypnus-tool__title">Social Content Generator</h2>
            <p class="ypnus-tool__desc">Paste any market update, newsletter, or article. Get three platform-ready posts with your compliance disclosure attached.</p>
        </div>
        <div class="ypnus-form">
            <label for="ypnus-article-input" class="ypnus-label">Article or Newsletter Content</label>
            <textarea id="ypnus-article-input" class="ypnus-textarea" rows="8" placeholder="Paste your article, email newsletter, or market update here..."></textarea>
            <button class="ypnus-btn ypnus-btn--primary" id="ypnus-generate-btn" onclick="ypnusGenerateContent()">
                <span class="ypnus-btn__text">Generate 3 Posts</span>
                <span class="ypnus-btn__loader" aria-hidden="true"></span>
            </button>
        </div>
        <div id="ypnus-content-output" class="ypnus-output" hidden aria-live="polite">
            <div class="ypnus-output-grid">
                <?php foreach ( [ 'linkedin' => 'LinkedIn', 'instagram' => 'Instagram', 'tiktok' => 'TikTok / Reel' ] as $id => $label ): ?>
                <div class="ypnus-post-card">
                    <div class="ypnus-post-card__header">
                        <span class="ypnus-platform-badge ypnus-platform-badge--<?php echo $id; ?>"><?php echo $label; ?></span>
                        <button class="ypnus-copy-btn" onclick="ypnusCopy('ypnus-<?php echo $id; ?>-content', this)">Copy</button>
                    </div>
                    <div class="ypnus-post-card__body"><pre id="ypnus-<?php echo $id; ?>-content" class="ypnus-post-text"></pre></div>
                    <div class="ypnus-disclosure-badge">Disclosure Included</div>
                </div>
                <?php endforeach; ?>
            </div>
        </div>
        <div id="ypnus-content-error" class="ypnus-error" hidden role="alert"></div>
    </div>
    <?php return ob_get_clean();
} );

add_shortcode( 'ypnus_keyword_scout', function () {
    ob_start(); ?>
    <div class="ypnus-tool" id="ypnus-keyword-scout" role="main" aria-label="Keyword Scout">
        <div class="ypnus-tool__header">
            <span class="ypnus-tool__eyebrow">SEO Research</span>
            <h2 class="ypnus-tool__title">Keyword Scout</h2>
            <p class="ypnus-tool__desc">Enter any mortgage topic. Get 10 long-tail keyword ideas with difficulty rating and content angle.</p>
        </div>
        <div class="ypnus-form ypnus-form--inline">
            <div class="ypnus-input-row">
                <input type="text" id="ypnus-keyword-input" class="ypnus-input" placeholder="e.g. VA home loans, FHA down payment..." />
                <button class="ypnus-btn ypnus-btn--primary" onclick="ypnusKeywordScout()">
                    <span class="ypnus-btn__text">Find Keywords</span>
                    <span class="ypnus-btn__loader" aria-hidden="true"></span>
                </button>
            </div>
        </div>
        <div id="ypnus-keyword-output" class="ypnus-output" hidden aria-live="polite">
            <div class="ypnus-table-wrap">
                <table class="ypnus-keyword-table">
                    <thead><tr><th>Keyword</th><th>Intent</th><th>Difficulty</th><th>Content Angle</th><th>Site Fit</th><th></th></tr></thead>
                    <tbody id="ypnus-keyword-body"></tbody>
                </table>
            </div>
        </div>
        <div id="ypnus-keyword-error" class="ypnus-error" hidden role="alert"></div>
    </div>
    <?php return ob_get_clean();
} );

add_shortcode( 'ypnus_silo_nav', function () {
    $silos = json_decode( get_option( 'ypnus_mlo_silos', ypnus_mlo_default_silos() ), true );
    if ( ! is_array( $silos ) ) return '';
    $current_path = parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH );
    $active_silo = null; $active_key = '';
    foreach ( $silos as $prefix => $silo ) {
        if ( str_starts_with( $current_path, $prefix ) ) { $active_silo = $silo; $active_key = $prefix; break; }
    }
    if ( ! $active_silo ) return '';
    ob_start(); ?>
    <nav class="ypnus-silo-nav" aria-label="<?php echo esc_attr( $active_silo['label'] ); ?> navigation">
        <div class="ypnus-silo-nav__breadcrumb">
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>">Home</a>
            <span>/</span>
            <a href="<?php echo esc_url( home_url( $active_key . '/' ) ); ?>"><?php echo esc_html( $active_silo['label'] ); ?></a>
            <?php if ( get_the_title() ): ?><span>/</span><span aria-current="page"><?php echo esc_html( get_the_title() ); ?></span><?php endif; ?>
        </div>
        <?php if ( $active_silo['children'] ?? [] ): ?>
        <div class="ypnus-silo-nav__children">
            <?php foreach ( $active_silo['children'] as $child ):
                $is_current = rtrim( $current_path, '/' ) === rtrim( $child['url'], '/' ); ?>
                <a href="<?php echo esc_url( home_url( $child['url'] ) ); ?>"
                   class="ypnus-silo-nav__child<?php echo $is_current ? ' ypnus-silo-nav__child--active' : ''; ?>"
                   <?php echo $is_current ? 'aria-current="page"' : ''; ?>><?php echo esc_html( $child['label'] ); ?></a>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </nav>
    <?php return ob_get_clean();
} );

add_shortcode( 'ypnus_agent', function () {
    $nmls    = get_option( 'ypnus_mlo_nmls', '' );
    $company = get_option( 'ypnus_mlo_company', '' );
    $label   = $company ? esc_html( $company ) . ' AI Agent' : 'MLO AI Agent';
    $sub     = $nmls ? 'NMLS #' . esc_html( $nmls ) . ' · Powered by YPNUS' : 'Powered by YPNUS';

    // Build suggestion chips including active custom tools
    $chips = [
        [ 'label' => '🚀 Build my website', 'msg' => 'Help me build my website — I\'m just getting started' ],
        [ 'label' => 'Build ALL pages', 'msg' => 'Build all my website pages right now — use what you know about me' ],
        [ 'label' => 'Build a page', 'msg' => 'Build me a VA loan page for Fresno CA' ],
        [ 'label' => 'Write an article', 'msg' => 'Write a 1500 word SEO article about FHA loans for first-time buyers in [Your City] — include affiliate links' ],
        [ 'label' => 'Plan my website', 'msg' => 'Plan my entire mortgage website — I focus on VA and FHA loans' ],
        [ 'label' => 'Write social posts', 'msg' => 'Write me 3 VA loan posts for LinkedIn, Instagram, and TikTok' ],
        [ 'label' => 'Find keywords', 'msg' => 'Find SEO keywords for DSCR investor loans' ],
        [ 'label' => 'Score my GMB', 'msg' => 'Score my Google My Business — business name: [Your Name] Mortgage, city: [Your City], I have about 10 reviews, 4.8 stars, no posts and no Q&A filled in' ],
        [ 'label' => 'What do you remember?', 'msg' => 'What do you know about me and my business?' ],
        [ 'label' => 'Recommend plugins', 'msg' => 'What plugins should I use to capture more leads from my mortgage website? I want something lightweight that works on Hostinger.' ],
        [ 'label' => 'Full marketing strategy', 'msg' => 'Give me a complete marketing strategy to get more leads from my WordPress site — including email follow-up, CRM, and conversion optimization.' ],
    ];

    $dtools = array_filter( ypnus_get_tools(), fn( $t ) => ! empty( $t['enabled'] ) );
    foreach ( $dtools as $t ) {
        $kw_list = array_map( 'trim', explode( ',', $t['keywords'] ?? '' ) );
        $first_kw = $kw_list[0] ?? $t['name'];
        $chips[] = [ 'label' => $t['name'], 'msg' => "Use the {$t['name']} tool — {$first_kw}" ];
    }

    ob_start(); ?>
    <div class="ypnus-agent" id="ypnus-agent" role="main" aria-label="MLO AI Agent">
        <div class="ypnus-agent__header">
            <div class="ypnus-agent__avatar" aria-hidden="true">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                    <path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
            </div>
            <div>
                <div class="ypnus-agent__name"><?php echo $label; ?></div>
                <div class="ypnus-agent__sub"><?php echo $sub; ?></div>
            </div>
            <div class="ypnus-agent__status" id="ypnus-agent-status" aria-live="polite">
                <span class="ypnus-agent__dot"></span>
                <span class="ypnus-agent__status-text">Ready</span>
            </div>
        </div>

        <div class="ypnus-agent__messages" id="ypnus-agent-messages" role="log" aria-live="polite">
            <div class="ypnus-agent__message ypnus-agent__message--agent">
                <div class="ypnus-agent__bubble">
                    Hi! I'm your MLO AI Agent. I can build pages, plan your site, write compliant social posts, score your Google Business Profile, find keywords, and fix WordPress errors. I also learn — tell me to remember something and I will. Ask me to do something new and I'll build the tool for it on the spot.
                </div>
            </div>
        </div>

        <div class="ypnus-agent__suggestions" id="ypnus-agent-suggestions">
            <?php foreach ( $chips as $chip ): ?>
            <button class="ypnus-agent__chip" onclick="ypnusAgentSuggest(<?php echo json_encode( $chip['msg'] ); ?>)"><?php echo esc_html( $chip['label'] ); ?></button>
            <?php endforeach; ?>
        </div>

        <form class="ypnus-agent__input-row" id="ypnus-agent-form" onsubmit="ypnusAgentSend(event)" novalidate>
            <textarea id="ypnus-agent-input" class="ypnus-agent__input"
                placeholder="Ask anything — build pages, remember my market, create a new tool, fix an error…"
                rows="1" aria-label="Message the MLO agent"></textarea>
            <button type="submit" class="ypnus-agent__send" id="ypnus-agent-send" aria-label="Send">
                <span class="ypnus-btn__text">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </span>
                <span class="ypnus-btn__loader" aria-hidden="true"></span>
            </button>
        </form>

        <div class="ypnus-agent__footer">
            This AI agent assists with content creation and planning. Always review output before publishing. · <?php echo $sub; ?>
        </div>
    </div>
    <?php return ob_get_clean();
} );

// ─── Demo Shortcode ───────────────────────────────────────────────────────────

add_shortcode( 'ypnus_mlo_demo', function () {
    $cta_text    = get_option( 'ypnus_demo_cta_text',    'Get My Full Website — Sign Up Now' );
    $price_label = get_option( 'ypnus_demo_price_label', 'Starting at $97/month — Cancel anytime' );
    $signup_url  = get_option( 'ypnus_demo_signup_url',  '#' );

    ob_start(); ?>
    <div class="ypnus-demo" id="ypnus-demo-wrap">

        <!-- ── Step 1: The 3-question form ── -->
        <div class="ypnus-demo__form-wrap" id="ypnus-demo-form-wrap">
            <div class="ypnus-demo__intro">
                <span class="ypnus-demo__badge">Live Preview — No Credit Card Required</span>
                <h2 class="ypnus-demo__headline">See Your MLO Website Before You Buy It</h2>
                <p class="ypnus-demo__sub">Answer 3 quick questions and watch the AI build your personalized mortgage website plan in seconds.</p>
            </div>

            <form class="ypnus-demo__form" id="ypnus-demo-form" onsubmit="ypnusDemoSubmit(event)">
                <div class="ypnus-demo__fields">
                    <div class="ypnus-demo__field">
                        <label class="ypnus-demo__label" for="ypnus-demo-city">
                            <span class="ypnus-demo__step-num">1</span>
                            What city or market do you serve?
                        </label>
                        <input type="text" id="ypnus-demo-city" class="ypnus-demo__input" placeholder="e.g. Phoenix AZ, Dallas TX, Denver CO" autocomplete="off" />
                    </div>
                    <div class="ypnus-demo__field">
                        <label class="ypnus-demo__label" for="ypnus-demo-niches">
                            <span class="ypnus-demo__step-num">2</span>
                            What type of loans do you specialize in?
                        </label>
                        <div class="ypnus-demo__chips" id="ypnus-demo-niche-chips">
                            <?php foreach ( [ 'VA Loans', 'FHA Loans', 'Conventional', 'DSCR / Investor', 'Jumbo', 'First-Time Buyers', 'Refinance', 'USDA' ] as $n ): ?>
                            <button type="button" class="ypnus-demo__chip-btn" onclick="ypnusToggleNiche(this)"><?php echo esc_html( $n ); ?></button>
                            <?php endforeach; ?>
                        </div>
                        <input type="hidden" id="ypnus-demo-niches" value="" />
                    </div>
                    <div class="ypnus-demo__field">
                        <label class="ypnus-demo__label" for="ypnus-demo-name">
                            <span class="ypnus-demo__step-num">3</span>
                            What's your first name?
                        </label>
                        <input type="text" id="ypnus-demo-name" class="ypnus-demo__input" placeholder="e.g. David" autocomplete="given-name" />
                    </div>
                </div>

                <div id="ypnus-demo-error" class="ypnus-error" hidden></div>

                <button type="submit" class="ypnus-demo__submit" id="ypnus-demo-btn">
                    <span class="ypnus-btn__text">Build My Site Preview →</span>
                    <span class="ypnus-btn__loader" aria-hidden="true"></span>
                </button>
                <p class="ypnus-demo__privacy">No email required. No credit card. Just your personalized plan.</p>
            </form>
        </div>

        <!-- ── Step 2: Generating state ── -->
        <div class="ypnus-demo__generating" id="ypnus-demo-generating" hidden>
            <div class="ypnus-demo__gen-inner">
                <div class="ypnus-demo__gen-spinner"></div>
                <div class="ypnus-demo__gen-title">Building Your Personalized Website Plan…</div>
                <div class="ypnus-demo__gen-steps" id="ypnus-demo-gen-steps">
                    <div class="ypnus-demo__gen-step" id="ypnus-demo-gstep-1">Analyzing your market…</div>
                    <div class="ypnus-demo__gen-step" id="ypnus-demo-gstep-2">Mapping your loan niches to page types…</div>
                    <div class="ypnus-demo__gen-step" id="ypnus-demo-gstep-3">Building your conversion strategy…</div>
                    <div class="ypnus-demo__gen-step" id="ypnus-demo-gstep-4">Generating keywords for your market…</div>
                    <div class="ypnus-demo__gen-step" id="ypnus-demo-gstep-5">Finalizing your website blueprint…</div>
                </div>
            </div>
        </div>

        <!-- ── Step 3: Results ── -->
        <div class="ypnus-demo__results" id="ypnus-demo-results" hidden>

            <div class="ypnus-demo__results-header">
                <div class="ypnus-demo__results-badge">✅ Your Website Plan Is Ready</div>
                <h2 class="ypnus-demo__results-headline" id="ypnus-demo-headline">Here's What We'd Build For You</h2>
                <p class="ypnus-demo__results-sub" id="ypnus-demo-summary"></p>
            </div>

            <!-- Page map preview (blurred after first 4) -->
            <div class="ypnus-demo__section">
                <h3 class="ypnus-demo__section-title">Pages Your Site Would Include</h3>
                <div class="ypnus-demo__pages" id="ypnus-demo-pages"></div>
                <div class="ypnus-demo__blur-gate">
                    <div class="ypnus-demo__blur-overlay"></div>
                    <div class="ypnus-demo__blur-cta">
                        <p>🔒 <strong>4 more pages</strong> in your full plan — unlock with a free account</p>
                    </div>
                </div>
            </div>

            <!-- Keywords preview -->
            <div class="ypnus-demo__section">
                <h3 class="ypnus-demo__section-title">Top Keywords for Your Market</h3>
                <div class="ypnus-demo__kw-list" id="ypnus-demo-keywords"></div>
            </div>

            <!-- Sample page teaser -->
            <div class="ypnus-demo__section ypnus-demo__section--teaser">
                <h3 class="ypnus-demo__section-title">Sample Page Outline</h3>
                <div class="ypnus-demo__teaser-card" id="ypnus-demo-teaser"></div>
            </div>

            <!-- Paywall -->
            <div class="ypnus-demo__paywall">
                <div class="ypnus-demo__paywall-inner">
                    <div class="ypnus-demo__paywall-icon">🏠</div>
                    <h3 class="ypnus-demo__paywall-headline">Your Full Website Is One Click Away</h3>
                    <p class="ypnus-demo__paywall-body">When you sign up, the AI agent builds every one of these pages as live WordPress drafts — ready to review, customize, and publish. No agency. No delays. Just your complete mortgage site, done.</p>
                    <ul class="ypnus-demo__paywall-features">
                        <li>✅ All pages built as WordPress drafts automatically</li>
                        <li>✅ AI agent available 24/7 — build anything, fix anything</li>
                        <li>✅ Keyword research, compliance checker, social post generator</li>
                        <li>✅ Article writer with SEO + authority backlinks</li>
                        <li>✅ Google My Business scoring &amp; optimization guide</li>
                        <li>✅ Agent remembers your market, niche, and preferences</li>
                    </ul>
                    <a class="ypnus-demo__paywall-btn" href="<?php echo esc_url( $signup_url ); ?>"><?php echo esc_html( $cta_text ); ?></a>
                    <p class="ypnus-demo__paywall-price"><?php echo esc_html( $price_label ); ?></p>
                </div>
            </div>

            <div class="ypnus-demo__restart">
                <button type="button" onclick="ypnusDemoRestart()">← Try a Different Market</button>
            </div>
        </div>

    </div>

    <style>
    .ypnus-demo { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 860px; margin: 0 auto; color: #1a2744; }
    .ypnus-demo__intro { text-align: center; margin-bottom: 36px; }
    .ypnus-demo__badge { display: inline-block; background: #e8f4fd; color: #1565C0; font-size: 12px; font-weight: 700; letter-spacing: .05em; padding: 5px 14px; border-radius: 20px; margin-bottom: 16px; text-transform: uppercase; }
    .ypnus-demo__headline { font-size: clamp(24px, 4vw, 38px); font-weight: 800; margin: 0 0 12px; line-height: 1.15; color: #0D1B3E; }
    .ypnus-demo__sub { font-size: 17px; color: #4a5d80; max-width: 560px; margin: 0 auto; }
    .ypnus-demo__form { background: #fff; border: 1.5px solid #dce6f5; border-radius: 16px; padding: 36px; box-shadow: 0 4px 24px rgba(0,0,0,.06); }
    .ypnus-demo__fields { display: flex; flex-direction: column; gap: 28px; }
    .ypnus-demo__label { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 15px; color: #0D1B3E; margin-bottom: 10px; }
    .ypnus-demo__step-num { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: #1565C0; color: #fff; font-size: 13px; font-weight: 800; flex-shrink: 0; }
    .ypnus-demo__input { width: 100%; box-sizing: border-box; padding: 13px 16px; border: 1.5px solid #cdd9ef; border-radius: 10px; font-size: 15px; color: #1a2744; outline: none; transition: border-color .2s; }
    .ypnus-demo__input:focus { border-color: #1565C0; box-shadow: 0 0 0 3px rgba(21,101,192,.12); }
    .ypnus-demo__chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .ypnus-demo__chip-btn { padding: 8px 16px; border-radius: 22px; border: 1.5px solid #cdd9ef; background: #f5f8ff; color: #1a2744; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .18s; }
    .ypnus-demo__chip-btn.is-selected { background: #1565C0; border-color: #1565C0; color: #fff; }
    .ypnus-demo__submit { display: block; width: 100%; margin-top: 28px; padding: 16px; background: #1565C0; color: #fff; border: none; border-radius: 10px; font-size: 17px; font-weight: 800; cursor: pointer; transition: background .2s, transform .1s; position: relative; }
    .ypnus-demo__submit:hover { background: #0D47A1; }
    .ypnus-demo__submit:active { transform: scale(.98); }
    .ypnus-demo__submit.is-loading .ypnus-btn__text { opacity: 0; }
    .ypnus-demo__submit.is-loading .ypnus-btn__loader { display: block; }
    .ypnus-btn__loader { display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 22px; height: 22px; border: 3px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: ypnus-spin 0.7s linear infinite; }
    @keyframes ypnus-spin { to { transform: translate(-50%,-50%) rotate(360deg); } }
    .ypnus-demo__privacy { text-align: center; font-size: 12px; color: #8a9bc0; margin-top: 10px; }
    .ypnus-demo__generating { text-align: center; padding: 60px 24px; }
    .ypnus-demo__gen-spinner { width: 52px; height: 52px; border: 5px solid #dce6f5; border-top-color: #1565C0; border-radius: 50%; animation: ypnus-spin 0.8s linear infinite; margin: 0 auto 24px; }
    .ypnus-demo__gen-title { font-size: 20px; font-weight: 700; color: #0D1B3E; margin-bottom: 20px; }
    .ypnus-demo__gen-steps { display: flex; flex-direction: column; gap: 8px; max-width: 380px; margin: 0 auto; text-align: left; }
    .ypnus-demo__gen-step { font-size: 14px; color: #8a9bc0; padding: 6px 12px; border-radius: 8px; transition: all .3s; }
    .ypnus-demo__gen-step.is-active { color: #1565C0; font-weight: 700; background: #e8f4fd; }
    .ypnus-demo__gen-step.is-done { color: #2e7d32; }
    .ypnus-demo__gen-step.is-done::before { content: '✓ '; }
    .ypnus-demo__results-header { text-align: center; margin-bottom: 36px; }
    .ypnus-demo__results-badge { display: inline-block; background: #e8f5e9; color: #2e7d32; font-size: 13px; font-weight: 700; padding: 5px 14px; border-radius: 20px; margin-bottom: 14px; }
    .ypnus-demo__results-headline { font-size: clamp(22px, 3.5vw, 32px); font-weight: 800; color: #0D1B3E; margin: 0 0 10px; }
    .ypnus-demo__results-sub { font-size: 16px; color: #4a5d80; max-width: 600px; margin: 0 auto; }
    .ypnus-demo__section { background: #fff; border: 1.5px solid #dce6f5; border-radius: 14px; padding: 28px; margin-bottom: 20px; position: relative; overflow: hidden; }
    .ypnus-demo__section-title { font-size: 17px; font-weight: 700; color: #0D1B3E; margin: 0 0 16px; }
    .ypnus-demo__section--teaser { background: #f5f8ff; }
    .ypnus-demo__pages { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
    .ypnus-demo__page-card { border: 1.5px solid #dce6f5; border-radius: 10px; padding: 14px 16px; background: #f9fbff; }
    .ypnus-demo__page-num { font-size: 11px; font-weight: 700; color: #1565C0; text-transform: uppercase; letter-spacing: .04em; }
    .ypnus-demo__page-title { font-size: 14px; font-weight: 700; color: #0D1B3E; margin: 4px 0 4px; }
    .ypnus-demo__page-kw { font-size: 12px; color: #6b7da6; }
    .ypnus-demo__blur-gate { position: relative; height: 80px; margin-top: -40px; }
    .ypnus-demo__blur-overlay { position: absolute; bottom: 0; left: 0; right: 0; top: 0; background: linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,.96) 100%); }
    .ypnus-demo__blur-cta { position: absolute; bottom: 0; left: 0; right: 0; text-align: center; font-size: 14px; color: #4a5d80; }
    .ypnus-demo__blur-cta strong { color: #1565C0; }
    .ypnus-demo__kw-list { display: flex; flex-direction: column; gap: 10px; }
    .ypnus-demo__kw-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: #f5f8ff; border-radius: 8px; font-size: 14px; }
    .ypnus-demo__kw-word { font-weight: 700; color: #0D1B3E; flex: 1; }
    .ypnus-demo__kw-diff { font-size: 12px; padding: 2px 10px; border-radius: 12px; font-weight: 600; }
    .ypnus-demo__kw-diff--easy   { background: #e8f5e9; color: #2e7d32; }
    .ypnus-demo__kw-diff--medium { background: #fff8e1; color: #f57f17; }
    .ypnus-demo__kw-diff--hard   { background: #fce4ec; color: #c62828; }
    .ypnus-demo__kw-intent { font-size: 12px; color: #6b7da6; }
    .ypnus-demo__teaser-card { font-size: 14px; color: #4a5d80; line-height: 1.7; }
    .ypnus-demo__teaser-card h4 { color: #0D1B3E; font-weight: 700; margin: 0 0 8px; font-size: 16px; }
    .ypnus-demo__teaser-card ul { margin: 0; padding-left: 20px; }
    .ypnus-demo__teaser-card li { margin-bottom: 4px; }
    .ypnus-demo__paywall { background: linear-gradient(135deg, #0D1B3E 0%, #1565C0 100%); border-radius: 16px; padding: 48px 40px; text-align: center; margin-top: 24px; color: #fff; }
    .ypnus-demo__paywall-inner { max-width: 600px; margin: 0 auto; }
    .ypnus-demo__paywall-icon { font-size: 48px; margin-bottom: 16px; }
    .ypnus-demo__paywall-headline { font-size: clamp(20px, 3vw, 28px); font-weight: 800; margin: 0 0 14px; }
    .ypnus-demo__paywall-body { font-size: 15px; opacity: .88; margin-bottom: 24px; line-height: 1.65; }
    .ypnus-demo__paywall-features { list-style: none; margin: 0 0 28px; padding: 0; text-align: left; display: inline-block; }
    .ypnus-demo__paywall-features li { font-size: 14px; padding: 4px 0; opacity: .92; }
    .ypnus-demo__paywall-btn { display: inline-block; background: #fff; color: #1565C0; font-size: 17px; font-weight: 800; padding: 16px 36px; border-radius: 10px; text-decoration: none; transition: transform .15s, box-shadow .15s; box-shadow: 0 4px 16px rgba(0,0,0,.2); }
    .ypnus-demo__paywall-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.25); }
    .ypnus-demo__paywall-price { font-size: 13px; opacity: .7; margin-top: 12px; }
    .ypnus-demo__restart { text-align: center; margin-top: 20px; }
    .ypnus-demo__restart button { background: none; border: none; color: #6b7da6; font-size: 13px; cursor: pointer; text-decoration: underline; }
    @media (max-width: 600px) {
        .ypnus-demo__form { padding: 24px 18px; }
        .ypnus-demo__paywall { padding: 32px 20px; }
    }
    </style>

    <script>
    (function () {
        'use strict';
        var selectedNiches = [];

        window.ypnusToggleNiche = function (btn) {
            var val = btn.textContent.trim();
            var idx = selectedNiches.indexOf(val);
            if (idx === -1) { selectedNiches.push(val); btn.classList.add('is-selected'); }
            else            { selectedNiches.splice(idx, 1); btn.classList.remove('is-selected'); }
            document.getElementById('ypnus-demo-niches').value = selectedNiches.join(', ');
        };

        window.ypnusDemoSubmit = function (e) {
            e.preventDefault();
            var city   = ((document.getElementById('ypnus-demo-city')   || {}).value || '').trim();
            var niches = ((document.getElementById('ypnus-demo-niches') || {}).value || '').trim();
            var name   = ((document.getElementById('ypnus-demo-name')   || {}).value || '').trim();
            var errEl  = document.getElementById('ypnus-demo-error');

            if (!city)   { errEl.textContent = 'Please enter your city or market.';        errEl.hidden = false; return; }
            if (!niches) { errEl.textContent = 'Please select at least one loan type.';    errEl.hidden = false; return; }
            errEl.hidden = true;

            var btn = document.getElementById('ypnus-demo-btn');
            if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }

            document.getElementById('ypnus-demo-form-wrap').hidden  = true;
            document.getElementById('ypnus-demo-generating').hidden = false;
            ypnusDemoAnimate();

            var fd = new FormData();
            fd.append('action', 'ypnus_demo_run');
            fd.append('nonce',  ypnusMLO.nonce);
            fd.append('city',   city);
            fd.append('niches', niches);
            fd.append('name',   name || 'there');

            fetch(ypnusMLO.ajaxUrl, { method: 'POST', body: fd })
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (!data.success) {
                        ypnusDemoShowError(data.data && data.data.message ? data.data.message : 'Something went wrong. Please try again.');
                        return;
                    }
                    ypnusDemoRender(data.data, name, city);
                })
                .catch(function () { ypnusDemoShowError('Connection error. Please check your internet and try again.'); });
        };

        function ypnusDemoAnimate() {
            var steps  = ['ypnus-demo-gstep-1','ypnus-demo-gstep-2','ypnus-demo-gstep-3','ypnus-demo-gstep-4','ypnus-demo-gstep-5'];
            var delays = [0, 1000, 2200, 3600, 5200];
            steps.forEach(function (id, i) {
                setTimeout(function () {
                    var el = document.getElementById(id);
                    if (!el) return;
                    if (i > 0) {
                        var prev = document.getElementById(steps[i - 1]);
                        if (prev) { prev.classList.remove('is-active'); prev.classList.add('is-done'); }
                    }
                    el.classList.add('is-active');
                }, delays[i]);
            });
        }

        function ypnusDemoShowError(msg) {
            document.getElementById('ypnus-demo-generating').hidden = true;
            document.getElementById('ypnus-demo-form-wrap').hidden  = false;
            var errEl = document.getElementById('ypnus-demo-error');
            if (errEl) { errEl.textContent = msg; errEl.hidden = false; }
            var btn = document.getElementById('ypnus-demo-btn');
            if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
        }

        function esc(str) {
            return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        }

        function ypnusDemoRender(data, name, city) {
            document.getElementById('ypnus-demo-generating').hidden = true;
            document.getElementById('ypnus-demo-results').hidden    = false;

            var greeting = name && name !== 'there' ? name + ', here' : 'Here';
            document.getElementById('ypnus-demo-headline').textContent = greeting + "'s What We'd Build For You in " + city;
            document.getElementById('ypnus-demo-summary').textContent  = data.site_summary || '';

            // Pages (show first 4)
            var pagesEl = document.getElementById('ypnus-demo-pages');
            pagesEl.innerHTML = '';
            (data.pages || []).slice(0, 4).forEach(function (p, i) {
                var card = document.createElement('div');
                card.className = 'ypnus-demo__page-card';
                card.innerHTML =
                    '<div class="ypnus-demo__page-num">Page ' + (i + 1) + '</div>' +
                    '<div class="ypnus-demo__page-title">' + esc(p.title || '') + '</div>' +
                    '<div class="ypnus-demo__page-kw">' + esc(p.primary_keyword || '') + '</div>';
                pagesEl.appendChild(card);
            });

            // Keywords (show 5)
            var kwEl = document.getElementById('ypnus-demo-keywords');
            kwEl.innerHTML = '';
            (data.keywords || []).slice(0, 5).forEach(function (kw) {
                var diff = (kw.difficulty || 'medium').toLowerCase();
                var item = document.createElement('div');
                item.className = 'ypnus-demo__kw-item';
                item.innerHTML =
                    '<span class="ypnus-demo__kw-word">' + esc(kw.keyword || '') + '</span>' +
                    '<span class="ypnus-demo__kw-diff ypnus-demo__kw-diff--' + diff + '">' + esc(kw.difficulty || '') + '</span>' +
                    '<span class="ypnus-demo__kw-intent">' + esc(kw.intent || '') + '</span>';
                kwEl.appendChild(item);
            });

            // Sample page teaser
            var teaser   = data.sample_page || {};
            var teaserEl = document.getElementById('ypnus-demo-teaser');
            if (teaser.title) {
                var sections = (teaser.sections || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
                teaserEl.innerHTML =
                    '<h4>' + esc(teaser.title) + '</h4>' +
                    '<p>' + esc(teaser.description || '') + '</p>' +
                    (sections ? '<ul>' + sections + '</ul>' : '');
            } else {
                teaserEl.innerHTML = '<p>Your homepage would include a hero section, lead capture form, loan type overview, trust signals, and local SEO content for ' + esc(city) + '.</p>';
            }

            var resultsEl = document.getElementById('ypnus-demo-results');
            if (resultsEl) resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        window.ypnusDemoRestart = function () {
            document.getElementById('ypnus-demo-results').hidden   = true;
            document.getElementById('ypnus-demo-form-wrap').hidden = false;
            for (var i = 1; i <= 5; i++) {
                var el = document.getElementById('ypnus-demo-gstep-' + i);
                if (el) el.className = 'ypnus-demo__gen-step';
            }
            var btn = document.getElementById('ypnus-demo-btn');
            if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; }
            window.scrollTo({ top: document.getElementById('ypnus-demo-wrap').offsetTop - 40, behavior: 'smooth' });
        };
    })();
    </script>

    <?php return ob_get_clean();
} );

// ─── AJAX: Demo Run (unauthenticated) ─────────────────────────────────────────

add_action( 'wp_ajax_nopriv_ypnus_demo_run', 'ypnus_handle_demo_run' );
add_action( 'wp_ajax_ypnus_demo_run',        'ypnus_handle_demo_run' );

function ypnus_handle_demo_run() {
    check_ajax_referer( 'ypnus_mlo_nonce', 'nonce' );

    // Rate limit by IP
    $limit = max( 1, (int) get_option( 'ypnus_demo_daily_limit', 3 ) );
    $ip    = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ?? '' ) );
    $key   = 'ypnus_demo_' . md5( $ip );
    $count = (int) get_transient( $key );
    if ( $count >= $limit ) {
        wp_send_json_error( [ 'message' => "You've seen today's {$limit} free previews. Come back tomorrow — or <a href='" . esc_url( home_url( '/pricing/' ) ) . "' style='color:#fff;font-weight:700;'>sign up now</a> to unlock your full site immediately." ] );
    }

    $city   = sanitize_text_field( wp_unslash( $_POST['city']   ?? '' ) );
    $niches = sanitize_text_field( wp_unslash( $_POST['niches'] ?? '' ) );
    $name   = sanitize_text_field( wp_unslash( $_POST['name']   ?? 'there' ) );

    if ( ! $city || ! $niches ) {
        wp_send_json_error( [ 'message' => 'Please fill in all fields.' ] );
    }

    $api_key = get_option( 'ypnus_mlo_openai_key', '' );
    if ( ! $api_key ) {
        wp_send_json_error( [ 'message' => 'Demo is temporarily unavailable. Please try again later.' ] );
    }

    $prompt = <<<PROMPT
You are a senior mortgage website strategist. A Mortgage Loan Officer named "{$name}" wants to preview their website. Generate a personalized website preview plan.

Market: {$city}
Loan specialties: {$niches}

Return ONLY valid JSON:
{
  "site_summary": "2-3 sentence motivating overview of what their site would accomplish (mention the city, loan types, and lead generation potential)",
  "pages": [
    {
      "title": "Page title",
      "url_slug": "/slug",
      "purpose": "One sentence on what this page does for leads",
      "primary_keyword": "exact long-tail keyword this page would rank for",
      "priority": 1
    }
  ],
  "keywords": [
    {
      "keyword": "long-tail keyword specific to {$city} and their niches",
      "intent": "Informational|Commercial|Transactional",
      "difficulty": "Easy|Medium|Hard"
    }
  ],
  "sample_page": {
    "title": "Sample homepage headline for {$name} in {$city}",
    "description": "One sentence describing what this page would accomplish for lead generation",
    "sections": [
      "Hero section with phone CTA button and lead capture form",
      "Loan type overview (specific to their niches)",
      "Trust signals: NMLS number, years experience, reviews badge",
      "Local area section mentioning {$city} neighborhoods and market data",
      "Client testimonial with star rating",
      "FAQ about the mortgage process in {$city}"
    ]
  }
}

Include exactly 8 pages in priority order: Homepage, About/Bio, primary loan type hub (their top niche), second loan type page, local market page for {$city}, Contact/Apply Now, Mortgage Calculator, Blog/Resources hub. Make every title and keyword SPECIFIC to {$city} and their exact loan niches. Include exactly 5 keywords.
PROMPT;

    $r      = ypnus_openai( $api_key, $prompt, 0.5, 60 );
    $result = json_decode( $r['content'] ?? '{}', true );

    if ( empty( $result['pages'] ) ) {
        wp_send_json_error( [ 'message' => 'Unable to generate your preview right now. Please try again in a moment.' ] );
    }

    // Increment rate limit (resets at midnight)
    $seconds_until_midnight = strtotime( 'tomorrow midnight' ) - time();
    set_transient( $key, $count + 1, $seconds_until_midnight );

    wp_send_json_success( $result );
}

// ─── Customer Flow: Auto CTA on Posts & City Pages ───────────────────────────

/**
 * Appends a demo CTA block to the content of blog posts and local city loan pages.
 * Fires on single views only — no archives, feeds, or admin.
 */
add_filter( 'the_content', 'ypnus_append_demo_cta', 20 );

function ypnus_append_demo_cta( string $content ): string {
    if ( is_admin() || ! is_singular() ) return $content;

    global $post;
    if ( ! $post ) return $content;

    // Skip the demo page and pricing pages themselves
    $skip_slugs = [ 'mlo-site-demo', 'pricing', 'pricing-plans', 'free-trial', 'checkout-cancel' ];
    if ( in_array( $post->post_name, $skip_slugs, true ) ) return $content;

    $show_cta = false;

    // Show on all blog posts
    if ( get_post_type( $post ) === 'post' ) {
        $show_cta = true;
    }

    // Show on local city loan pages (slug contains a loan keyword + city pattern)
    if ( get_post_type( $post ) === 'page' ) {
        $loan_slugs = [ 'va-loans-', 'fha-loans-', 'conventional-loans-', 'dscr-loans-', 'jumbo-loans-',
                        'first-time-', 'refinance-', 'usda-loans-', 'heloc-', 'reverse-' ];
        foreach ( $loan_slugs as $prefix ) {
            if ( str_starts_with( $post->post_name, $prefix ) ) {
                $show_cta = true;
                break;
            }
        }
    }

    if ( ! $show_cta ) return $content;

    $demo_url   = esc_url( home_url( '/mlo-site-demo/' ) );
    $city_hint  = '';
    if ( function_exists( 'get_post_meta' ) ) {
        // Try to pull a city name from the page title for the CTA headline
        $title = get_the_title( $post->ID );
        if ( preg_match( '/\bin\s+([A-Z][a-z]+(?:\s[A-Z][A-Z])?)/u', $title, $m ) ) {
            $city_hint = ' for ' . esc_html( $m[1] );
        }
    }

    ob_start();
    ?>
    <div class="ypnus-flow-cta" style="
        margin: 48px 0 16px;
        background: linear-gradient(135deg, #0D1B3E 0%, #1565C0 100%);
        border-radius: 16px;
        padding: 40px 36px;
        text-align: center;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
        <p style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin:0 0 10px;">FREE — No Account Required</p>
        <h3 style="font-size:clamp(20px,3.5vw,28px);font-weight:800;margin:0 0 12px;line-height:1.2;">
            See Your MLO Website Plan<?php echo $city_hint; ?> in 30 Seconds
        </h3>
        <p style="font-size:15px;opacity:.88;max-width:520px;margin:0 auto 24px;line-height:1.6;">
            Enter your market and loan niche. The AI builds a personalized page map, keyword list, and sample outline — instantly.
        </p>
        <a href="<?php echo $demo_url; ?>" style="
            display:inline-block;
            background:#fff;
            color:#1565C0;
            font-size:16px;
            font-weight:800;
            padding:14px 32px;
            border-radius:10px;
            text-decoration:none;
            box-shadow:0 4px 16px rgba(0,0,0,.2);
            transition:transform .15s;
        ">Build My Free Site Preview →</a>
        <p style="font-size:12px;opacity:.65;margin:10px 0 0;">No email. No credit card. Just your personalized plan.</p>
    </div>
    <?php
    return $content . ob_get_clean();
}

// ─── Fix #6: Rate-limit error embeds /pricing/ link ──────────────────────────
// Applied directly in ypnus_handle_demo_run() above — the error message now
// includes an anchor. No separate function needed; handled at line 2427.

// ─── Fix #7: Intra-city silo links on loan city pages ────────────────────────

/**
 * Data map: all city pages by city suffix and their loan types.
 * Slug pattern: {loan-prefix}{city-suffix}
 */
function ypnus_city_loan_map(): array {
    return [
        // loan prefix => display label
        'loan_types' => [
            'va-loans-'           => 'VA Loans',
            'fha-loans-'          => 'FHA Loans',
            'conventional-loans-' => 'Conventional Loans',
            'dscr-loans-'         => 'DSCR Investor Loans',
            'jumbo-loans-'        => 'Jumbo Loans',
        ],
        // city suffix => display city name
        'cities' => [
            'fresno-ca'       => 'Fresno, CA',
            'visalia-ca'      => 'Visalia, CA',
            'stockton-ca'     => 'Stockton, CA',
            'sacramento-ca'   => 'Sacramento, CA',
            'modesto-ca'      => 'Modesto, CA',
            'las-vegas-nv'    => 'Las Vegas, NV',
            'phoenix-az'      => 'Phoenix, AZ',
            'san-diego-ca'    => 'San Diego, CA',
            'bakersfield-ca'  => 'Bakersfield, CA',
            'los-angeles-ca'  => 'Los Angeles, CA',
        ],
    ];
}

add_filter( 'the_content', 'ypnus_append_city_silo_links', 15 );

function ypnus_append_city_silo_links( string $content ): string {
    if ( is_admin() || ! is_singular( 'page' ) ) return $content;

    global $post;
    if ( ! $post ) return $content;

    $slug = $post->post_name;
    $map  = ypnus_city_loan_map();

    // Identify which loan type and city this page belongs to
    $current_loan_prefix = null;
    $current_loan_label  = null;
    $current_city_suffix = null;
    $current_city_label  = null;

    foreach ( $map['loan_types'] as $prefix => $label ) {
        if ( str_starts_with( $slug, $prefix ) ) {
            $current_loan_prefix = $prefix;
            $current_loan_label  = $label;
            $rest                = substr( $slug, strlen( $prefix ) );
            foreach ( $map['cities'] as $suffix => $city_label ) {
                if ( $rest === $suffix ) {
                    $current_city_suffix = $suffix;
                    $current_city_label  = $city_label;
                    break 2;
                }
            }
        }
    }

    if ( ! $current_city_suffix ) return $content; // not a recognized city loan page

    // Build links to other loan types in the same city
    $other_loans = [];
    foreach ( $map['loan_types'] as $prefix => $label ) {
        if ( $prefix === $current_loan_prefix ) continue;
        $other_slug = $prefix . $current_city_suffix;
        $other_loans[] = [
            'url'   => home_url( '/' . $other_slug . '/' ),
            'label' => $label,
        ];
    }

    if ( empty( $other_loans ) ) return $content;

    ob_start();
    ?>
    <div class="ypnus-city-silo" style="
        margin: 40px 0 8px;
        padding: 28px 28px 24px;
        background: #f4f7fc;
        border: 1px solid #dde5f0;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
        <p style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5b6474;margin:0 0 12px;">
            Other Loan Programs in <?php echo esc_html( $current_city_label ); ?>
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <?php foreach ( $other_loans as $loan ) : ?>
            <a href="<?php echo esc_url( $loan['url'] ); ?>" style="
                display:inline-block;
                background:#fff;
                border:1px solid #c9d5e8;
                color:#182338;
                font-size:13px;
                font-weight:600;
                padding:8px 16px;
                border-radius:8px;
                text-decoration:none;
            "><?php echo esc_html( $loan['label'] ); ?> →</a>
        <?php endforeach; ?>
        </div>
    </div>
    <?php
    // Prepend before the demo CTA (priority 15 runs before CTA at priority 20)
    return $content . ob_get_clean();
}

// ─── Fix #8: Blog posts → city market cross-links ────────────────────────────

add_filter( 'the_content', 'ypnus_append_blog_market_links', 18 );

function ypnus_append_blog_market_links( string $content ): string {
    if ( is_admin() || ! is_singular( 'post' ) ) return $content;

    global $post;
    if ( ! $post ) return $content;

    $map       = ypnus_city_loan_map();
    $title_low = strtolower( get_the_title( $post->ID ) . ' ' . $post->post_name );

    // Detect which loan type the post is primarily about
    $loan_keyword_map = [
        'va-loans-'           => [ 'va loan', 'va home', 'veteran', 'military', ' va ' ],
        'fha-loans-'          => [ 'fha loan', 'fha home', 'fha ', 'first-time buyer', 'first time buyer' ],
        'conventional-loans-' => [ 'conventional', 'conforming' ],
        'dscr-loans-'         => [ 'dscr', 'investor loan', 'rental property', 'investment property', 'real estate investor' ],
        'jumbo-loans-'        => [ 'jumbo', 'high-value', 'luxury home' ],
    ];

    $matched_prefix = null;
    $matched_label  = null;

    foreach ( $loan_keyword_map as $prefix => $keywords ) {
        foreach ( $keywords as $kw ) {
            if ( str_contains( $title_low, $kw ) ) {
                $matched_prefix = $prefix;
                $matched_label  = $map['loan_types'][ $prefix ];
                break 2;
            }
        }
    }

    // Build the market grid — limit to 6 cities for readability
    $cities       = array_slice( $map['cities'], 0, 6, true );
    $use_prefix   = $matched_prefix ?? 'fha-loans-'; // default to FHA if no match
    $section_head = $matched_label
        ? "MLO {$matched_label} Specialists in These Markets"
        : 'MLO Specialists in These Markets';

    ob_start();
    ?>
    <div class="ypnus-blog-markets" style="
        margin: 40px 0 8px;
        padding: 28px 28px 24px;
        background: #f9f8f5;
        border: 1px solid #e3ddd0;
        border-radius: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    ">
        <p style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#8b6f3f;margin:0 0 6px;">
            Local Expertise
        </p>
        <h4 style="font-size:16px;font-weight:700;color:#182338;margin:0 0 14px;">
            <?php echo esc_html( $section_head ); ?>
        </h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;">
        <?php foreach ( $cities as $suffix => $city_label ) : ?>
            <a href="<?php echo esc_url( home_url( '/' . $use_prefix . $suffix . '/' ) ); ?>" style="
                display:block;
                background:#fff;
                border:1px solid #d8d0c0;
                color:#182338;
                font-size:13px;
                font-weight:600;
                padding:10px 14px;
                border-radius:8px;
                text-decoration:none;
            "><?php echo esc_html( $city_label ); ?></a>
        <?php endforeach; ?>
        </div>
        <p style="font-size:12px;color:#8b93a0;margin:14px 0 0;">
            Don't see your market? <a href="<?php echo esc_url( home_url( '/mlo-site-demo/' ) ); ?>" style="color:#1565C0;font-weight:600;">Try the free site preview →</a>
        </p>
    </div>
    <?php
    return $content . ob_get_clean();
}

