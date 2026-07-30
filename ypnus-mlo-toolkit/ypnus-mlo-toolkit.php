<?php
/**
 * Plugin Name: YPNUS MLO Toolkit
 * Plugin URI:  https://ypnus.com
 * Description: Self-learning agentic AI for Mortgage Loan Officers — builds pages, writes compliant content, scores GMB, scouts keywords, and grows its own toolset from the WordPress dashboard.
 * Version:     2.3.0
 * Author:      YPNUS
 * License:     GPL-2.0+
 * Text Domain: ypnus-mlo
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'YPNUS_MLO_VERSION', '2.3.0' );
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
    add_options_page( 'MLO Toolkit', 'MLO Toolkit', 'manage_options', 'ypnus-mlo', 'ypnus_admin_page' );
} );

add_action( 'admin_init', function () {
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_openai_key',  [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_nmls',        [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_company',     [ 'sanitize_callback' => 'sanitize_text_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_disclosure',  [ 'sanitize_callback' => 'sanitize_textarea_field' ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_silos',       [ 'sanitize_callback' => 'sanitize_textarea_field' ] );
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
                <a href="<?php echo esc_url( admin_url( "options-general.php?page=ypnus-mlo&tab={$t}" ) ); ?>"
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
                <a href="<?php echo esc_url( admin_url( 'options-general.php?page=ypnus-mlo&tab=tools' ) ); ?>" class="button">Cancel</a>
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
            'build_page'            => [ 'name' => 'Page Builder',            'shortcode' => '',                         'desc' => 'Generates a full SEO landing page and saves it as a WordPress draft.' ],
            'write_article'         => [ 'name' => 'Article Writer',          'shortcode' => '',                         'desc' => 'Writes a 1500–2000 word SEO article with internal links, authority backlinks, and optional affiliate products.' ],
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
                    <a href="<?php echo esc_url( admin_url( "options-general.php?page=ypnus-mlo&tab=tools&edit=" . urlencode( $t['slug'] ) ) ); ?>">Edit</a> |
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
    $sc = [ 'ypnus_content_generator', 'ypnus_keyword_scout', 'ypnus_silo_nav', 'ypnus_agent' ];
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
- User mentions "marketing", "funnel", "email sequence", "conversion", "optimize my site", "get more leads", "marketing strategy", "grow my business", "maximize", "marketing stack", "CRM", "email marketing", "drip campaign", "follow up", "automate marketing" → marketing_advisor
{$dtool_hint}
- When in doubt: call the most relevant tool. NEVER skip.

After every tool result: give a complete, detailed, actionable response — never one sentence.
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
        [ 'type' => 'function', 'function' => [ 'name' => 'write_article', 'description' => 'Write a full 1500–2000 word SEO article with internal links, authority backlinks, and optional affiliate product mentions. Saves as WordPress draft.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'topic' => [ 'type' => 'string', 'description' => 'Article topic (e.g. "FHA loans for first-time buyers").' ], 'city' => [ 'type' => 'string', 'description' => 'Optional city/market for local SEO.' ], 'loan_type' => [ 'type' => 'string', 'description' => 'Optional loan type focus (FHA, VA, USDA, Conventional, Jumbo).' ], 'include_affiliates' => [ 'type' => 'boolean', 'description' => 'Set true to include relevant affiliate product links (credit monitoring, insurance, etc).' ] ], 'required' => [ 'topic' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'plan_website', 'description' => 'Generate a complete website architecture for an MLO.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'niche' => [ 'type' => 'string', 'description' => 'Loan niche(s).' ], 'market' => [ 'type' => 'string', 'description' => 'Optional geographic market.' ], 'goal' => [ 'type' => 'string', 'description' => 'Optional business goal.' ] ], 'required' => [ 'niche' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'score_gmb', 'description' => 'Score and optimize a Google Business Profile for an MLO. Returns 0-100 score with action items.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'business_name' => [ 'type' => 'string', 'description' => 'Business name on Google.' ], 'city' => [ 'type' => 'string', 'description' => 'City and state.' ], 'categories' => [ 'type' => 'string', 'description' => 'Current GMB categories.' ], 'review_count' => [ 'type' => 'integer', 'description' => 'Number of reviews.' ], 'avg_rating' => [ 'type' => 'number', 'description' => 'Average star rating.' ], 'has_photos' => [ 'type' => 'boolean', 'description' => 'Photos uploaded?' ], 'posts_per_month' => [ 'type' => 'integer', 'description' => 'Posts per month.' ], 'has_qa' => [ 'type' => 'boolean', 'description' => 'Q&A filled in?' ], 'services_listed' => [ 'type' => 'boolean', 'description' => 'Services listed?' ], 'description_filled' => [ 'type' => 'boolean', 'description' => 'Description filled?' ] ], 'required' => [ 'business_name', 'city' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'save_memory', 'description' => 'Save a fact about this MLO to long-term memory so it persists across all future conversations.', 'parameters' => [ 'type' => 'object', 'properties' => [ 'key' => [ 'type' => 'string', 'description' => 'Short key (e.g. primary_market, loan_niche, top_realtor_partner).' ], 'value' => [ 'type' => 'string', 'description' => 'The value to remember.' ] ], 'required' => [ 'key', 'value' ] ] ] ],
        [ 'type' => 'function', 'function' => [ 'name' => 'recall_memory', 'description' => 'Retrieve everything currently saved in agent memory.', 'parameters' => [ 'type' => 'object', 'properties' => [], 'required' => [] ] ] ],
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
