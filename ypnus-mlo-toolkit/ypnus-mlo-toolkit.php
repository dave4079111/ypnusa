<?php
/**
 * Plugin Name: YPNUS MLO Toolkit
 * Plugin URI:  https://ypnus.com
 * Description: Mortgage Compliance Social-Content Generator, Keyword Scout, and Programmatic Silo Navigation for Loan Officers.
 * Version:     1.0.0
 * Author:      YPNUS
 * License:     GPL-2.0+
 * Text Domain: ypnus-mlo
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'YPNUS_MLO_VERSION', '1.0.0' );
define( 'YPNUS_MLO_DIR', plugin_dir_path( __FILE__ ) );
define( 'YPNUS_MLO_URL', plugin_dir_url( __FILE__ ) );

// ─── Settings ────────────────────────────────────────────────────────────────

add_action( 'admin_menu', function () {
    add_options_page(
        'MLO Toolkit Settings',
        'MLO Toolkit',
        'manage_options',
        'ypnus-mlo-settings',
        'ypnus_mlo_settings_page'
    );
} );

add_action( 'admin_init', function () {
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_openai_key', [
        'sanitize_callback' => 'sanitize_text_field',
    ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_nmls', [
        'sanitize_callback' => 'sanitize_text_field',
    ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_company', [
        'sanitize_callback' => 'sanitize_text_field',
    ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_disclosure', [
        'sanitize_callback' => 'sanitize_textarea_field',
    ] );
    register_setting( 'ypnus_mlo_group', 'ypnus_mlo_silos', [
        'sanitize_callback' => 'sanitize_textarea_field',
    ] );
} );

function ypnus_mlo_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) return;
    ?>
    <div class="wrap">
        <h1>MLO Toolkit Settings</h1>
        <form method="post" action="options.php">
            <?php settings_fields( 'ypnus_mlo_group' ); ?>
            <table class="form-table">
                <tr>
                    <th><label for="ypnus_mlo_openai_key">OpenAI API Key</label></th>
                    <td>
                        <input type="password" id="ypnus_mlo_openai_key" name="ypnus_mlo_openai_key"
                               value="<?php echo esc_attr( get_option( 'ypnus_mlo_openai_key' ) ); ?>"
                               class="regular-text" autocomplete="off" />
                        <p class="description">Your OpenAI API key for content and keyword generation.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="ypnus_mlo_nmls">NMLS Number</label></th>
                    <td>
                        <input type="text" id="ypnus_mlo_nmls" name="ypnus_mlo_nmls"
                               value="<?php echo esc_attr( get_option( 'ypnus_mlo_nmls' ) ); ?>"
                               class="regular-text" />
                    </td>
                </tr>
                <tr>
                    <th><label for="ypnus_mlo_company">Company Name</label></th>
                    <td>
                        <input type="text" id="ypnus_mlo_company" name="ypnus_mlo_company"
                               value="<?php echo esc_attr( get_option( 'ypnus_mlo_company' ) ); ?>"
                               class="regular-text" />
                    </td>
                </tr>
                <tr>
                    <th><label for="ypnus_mlo_disclosure">Compliance Disclosure</label></th>
                    <td>
                        <textarea id="ypnus_mlo_disclosure" name="ypnus_mlo_disclosure"
                                  rows="5" class="large-text"><?php
                            echo esc_textarea( get_option( 'ypnus_mlo_disclosure',
                                ypnus_mlo_default_disclosure() ) );
                        ?></textarea>
                        <p class="description">This disclosure is automatically appended to every generated post.</p>
                    </td>
                </tr>
                <tr>
                    <th><label for="ypnus_mlo_silos">Silo Structure (JSON)</label></th>
                    <td>
                        <textarea id="ypnus_mlo_silos" name="ypnus_mlo_silos"
                                  rows="10" class="large-text code"><?php
                            echo esc_textarea( get_option( 'ypnus_mlo_silos',
                                ypnus_mlo_default_silos() ) );
                        ?></textarea>
                        <p class="description">
                            Define your silo pillars in JSON. Each key is a URL prefix; value has <code>label</code> and <code>children</code> array.<br>
                            Example: <code>{"\/mlo-marketing": {"label": "MLO Marketing", "children": [{"label": "Lead Generation", "url": "\/mlo-marketing\/lead-generation\/"}]}}</code>
                        </p>
                    </td>
                </tr>
            </table>
            <?php submit_button(); ?>
        </form>
    </div>
    <?php
}

function ypnus_mlo_default_disclosure() {
    $nmls    = get_option( 'ypnus_mlo_nmls', 'XXXXXX' );
    $company = get_option( 'ypnus_mlo_company', 'Your Company Name' );
    return "NMLS #{$nmls} | {$company} | Equal Housing Lender | This is not a commitment to lend. Rates and terms subject to change without notice. All loans subject to credit approval. For licensing information, visit nmlsconsumeraccess.org.";
}

function ypnus_mlo_default_silos() {
    return json_encode( [
        '/mlo-marketing' => [
            'label'    => 'MLO Marketing',
            'children' => [
                [ 'label' => 'Lead Generation',   'url' => '/mlo-marketing/lead-generation/' ],
                [ 'label' => 'Compliance Tools',  'url' => '/mlo-marketing/compliance-tools/' ],
                [ 'label' => 'Social Content',    'url' => '/mlo-marketing/social-content/' ],
            ],
        ],
        '/mortgage-compliance' => [
            'label'    => 'Mortgage Compliance',
            'children' => [
                [ 'label' => 'Social Media Rules', 'url' => '/mortgage-compliance/social-media-rules/' ],
                [ 'label' => 'NMLS Requirements',  'url' => '/mortgage-compliance/nmls-requirements/' ],
            ],
        ],
        '/ai-marketing-tools' => [
            'label'    => 'AI Marketing Tools',
            'children' => [
                [ 'label' => 'Content Generator',  'url' => '/ai-marketing-tools/content-generator/' ],
                [ 'label' => 'Keyword Scout',      'url' => '/ai-marketing-tools/keyword-scout/' ],
            ],
        ],
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
}

// ─── Assets ──────────────────────────────────────────────────────────────────
// Handled by ypnus_mlo_enqueue_assets() below (registered after shortcode definitions).

// ─── AJAX: Content Generator ─────────────────────────────────────────────────

add_action( 'wp_ajax_nopriv_ypnus_generate_content', 'ypnus_handle_generate_content' );
add_action( 'wp_ajax_ypnus_generate_content',        'ypnus_handle_generate_content' );

function ypnus_handle_generate_content() {
    check_ajax_referer( 'ypnus_mlo_nonce', 'nonce' );

    $article    = isset( $_POST['article'] ) ? sanitize_textarea_field( wp_unslash( $_POST['article'] ) ) : '';
    $disclosure = get_option( 'ypnus_mlo_disclosure', ypnus_mlo_default_disclosure() );

    if ( empty( $article ) ) {
        wp_send_json_error( [ 'message' => 'Please paste an article or newsletter to generate content.' ] );
    }

    $api_key = get_option( 'ypnus_mlo_openai_key', '' );
    if ( empty( $api_key ) ) {
        wp_send_json_error( [ 'message' => 'OpenAI API key is not configured. Please visit MLO Toolkit settings.' ] );
    }

    $system_prompt = 'You are a licensed mortgage marketing specialist who writes FINRA/CFPB-compliant social media content for Loan Officers. You write in plain, engaging language. You never make promises about rates, guaranteed approvals, or specific loan terms. You never use superlatives like "best" or "cheapest" without substantiation.';

    $user_prompt = <<<PROMPT
Based on the following article or newsletter content, generate three distinct social media posts for a Mortgage Loan Officer. Return ONLY valid JSON with keys: linkedin, instagram, tiktok.

Rules for each post:
- linkedin: 150-300 words. Professional, educational, thought-leader tone. Use 2-3 relevant hashtags. No emojis in the body.
- instagram: 80-150 words. Conversational, warm, relatable. Use 5-8 hashtags. 1-2 emojis allowed.
- tiktok: A 30-45 second script with [VISUAL CUE] stage directions in brackets. Hook in first 3 seconds. Fast-paced, energetic. One clear CTA at end.

Do NOT include any compliance disclosure — that is added separately. Just write the post body.

ARTICLE:
{$article}
PROMPT;

    $response = wp_remote_post(
        'https://api.openai.com/v1/chat/completions',
        [
            'timeout' => 60,
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json',
            ],
            'body' => json_encode( [
                'model'       => 'gpt-4o-mini',
                'messages'    => [
                    [ 'role' => 'system', 'content' => $system_prompt ],
                    [ 'role' => 'user',   'content' => $user_prompt ],
                ],
                'temperature'    => 0.7,
                'response_format' => [ 'type' => 'json_object' ],
            ] ),
        ]
    );

    if ( is_wp_error( $response ) ) {
        wp_send_json_error( [ 'message' => 'API connection failed: ' . $response->get_error_message() ] );
    }

    $body = json_decode( wp_remote_retrieve_body( $response ), true );

    if ( empty( $body['choices'][0]['message']['content'] ) ) {
        wp_send_json_error( [ 'message' => 'Unexpected API response. Please try again.' ] );
    }

    $posts = json_decode( $body['choices'][0]['message']['content'], true );

    if ( ! isset( $posts['linkedin'], $posts['instagram'], $posts['tiktok'] ) ) {
        wp_send_json_error( [ 'message' => 'Content generation returned an unexpected format.' ] );
    }

    // Append mandatory disclosure
    foreach ( $posts as &$content ) {
        $content .= "\n\n" . $disclosure;
    }
    unset( $content );

    wp_send_json_success( $posts );
}

// ─── AJAX: Keyword Scout ─────────────────────────────────────────────────────

add_action( 'wp_ajax_nopriv_ypnus_keyword_scout', 'ypnus_handle_keyword_scout' );
add_action( 'wp_ajax_ypnus_keyword_scout',        'ypnus_handle_keyword_scout' );

function ypnus_handle_keyword_scout() {
    check_ajax_referer( 'ypnus_mlo_nonce', 'nonce' );

    $topic = isset( $_POST['topic'] ) ? sanitize_text_field( wp_unslash( $_POST['topic'] ) ) : '';

    if ( empty( $topic ) ) {
        wp_send_json_error( [ 'message' => 'Please enter a topic to research.' ] );
    }

    // Cache results per topic for 24 hours to reduce API costs
    $cache_key = 'ypnus_kw_' . md5( strtolower( $topic ) );
    $cached    = get_transient( $cache_key );
    if ( $cached !== false ) {
        wp_send_json_success( $cached );
    }

    $api_key = get_option( 'ypnus_mlo_openai_key', '' );
    if ( empty( $api_key ) ) {
        wp_send_json_error( [ 'message' => 'OpenAI API key is not configured.' ] );
    }

    $user_prompt = <<<PROMPT
You are an SEO specialist for mortgage and real estate professionals. Generate a list of 10 high-intent, long-tail keyword ideas related to the topic: "{$topic}".

Focus on keywords a Mortgage Loan Officer's potential borrowers would actually search for. Prioritize question-based and comparison keywords that signal buying intent but are specific enough to rank for without a huge domain authority.

Return ONLY valid JSON: an array of 10 objects, each with these keys:
- keyword (string): the exact long-tail keyword phrase
- intent (string): one of "Informational", "Commercial", "Navigational", or "Transactional"
- difficulty (string): one of "Easy", "Medium", or "Hard" (estimate based on specificity)
- angle (string): a 1-sentence content angle or hook for this keyword (what makes it rankable and useful)
PROMPT;

    $response = wp_remote_post(
        'https://api.openai.com/v1/chat/completions',
        [
            'timeout' => 45,
            'headers' => [
                'Authorization' => 'Bearer ' . $api_key,
                'Content-Type'  => 'application/json',
            ],
            'body' => json_encode( [
                'model'          => 'gpt-4o-mini',
                'messages'       => [
                    [ 'role' => 'user', 'content' => $user_prompt ],
                ],
                'temperature'    => 0.5,
                'response_format' => [ 'type' => 'json_object' ],
            ] ),
        ]
    );

    if ( is_wp_error( $response ) ) {
        wp_send_json_error( [ 'message' => 'API connection failed.' ] );
    }

    $body     = json_decode( wp_remote_retrieve_body( $response ), true );
    $raw      = $body['choices'][0]['message']['content'] ?? '{}';
    $decoded  = json_decode( $raw, true );

    // API returns object with a keywords key, or just an array
    $keywords = $decoded['keywords'] ?? ( is_array( $decoded ) && isset( $decoded[0] ) ? $decoded : null );

    if ( ! $keywords ) {
        wp_send_json_error( [ 'message' => 'Keyword generation returned an unexpected format.' ] );
    }

    set_transient( $cache_key, $keywords, DAY_IN_SECONDS );
    wp_send_json_success( $keywords );
}

// ─── Shortcode: Content Generator ────────────────────────────────────────────

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
            <textarea
                id="ypnus-article-input"
                class="ypnus-textarea"
                rows="8"
                placeholder="Paste your article, email newsletter, or market update here. The more detail, the better the output..."
                aria-describedby="ypnus-article-hint"
            ></textarea>
            <p class="ypnus-hint" id="ypnus-article-hint">Tip: Copy from your weekly market update email and paste it here.</p>
            <button class="ypnus-btn ypnus-btn--primary" id="ypnus-generate-btn" onclick="ypnusGenerateContent()">
                <span class="ypnus-btn__text">Generate 3 Posts</span>
                <span class="ypnus-btn__loader" aria-hidden="true"></span>
            </button>
        </div>

        <div id="ypnus-content-output" class="ypnus-output" hidden aria-live="polite">
            <div class="ypnus-output-grid">
                <div class="ypnus-post-card" id="ypnus-card-linkedin">
                    <div class="ypnus-post-card__header">
                        <span class="ypnus-platform-badge ypnus-platform-badge--linkedin">LinkedIn</span>
                        <button class="ypnus-copy-btn" onclick="ypnusCopy('ypnus-linkedin-content', this)" aria-label="Copy LinkedIn post">Copy</button>
                    </div>
                    <div class="ypnus-post-card__body">
                        <pre id="ypnus-linkedin-content" class="ypnus-post-text"></pre>
                    </div>
                    <div class="ypnus-disclosure-badge" aria-label="Compliance disclosure included">Disclosure Included</div>
                </div>

                <div class="ypnus-post-card" id="ypnus-card-instagram">
                    <div class="ypnus-post-card__header">
                        <span class="ypnus-platform-badge ypnus-platform-badge--instagram">Instagram</span>
                        <button class="ypnus-copy-btn" onclick="ypnusCopy('ypnus-instagram-content', this)" aria-label="Copy Instagram post">Copy</button>
                    </div>
                    <div class="ypnus-post-card__body">
                        <pre id="ypnus-instagram-content" class="ypnus-post-text"></pre>
                    </div>
                    <div class="ypnus-disclosure-badge" aria-label="Compliance disclosure included">Disclosure Included</div>
                </div>

                <div class="ypnus-post-card" id="ypnus-card-tiktok">
                    <div class="ypnus-post-card__header">
                        <span class="ypnus-platform-badge ypnus-platform-badge--tiktok">TikTok / Reel</span>
                        <button class="ypnus-copy-btn" onclick="ypnusCopy('ypnus-tiktok-content', this)" aria-label="Copy TikTok script">Copy</button>
                    </div>
                    <div class="ypnus-post-card__body">
                        <pre id="ypnus-tiktok-content" class="ypnus-post-text"></pre>
                    </div>
                    <div class="ypnus-disclosure-badge" aria-label="Compliance disclosure included">Disclosure Included</div>
                </div>
            </div>
        </div>

        <div id="ypnus-content-error" class="ypnus-error" hidden role="alert"></div>
    </div>
    <?php
    return ob_get_clean();
} );

// ─── Shortcode: Keyword Scout ─────────────────────────────────────────────────

add_shortcode( 'ypnus_keyword_scout', function () {
    ob_start(); ?>
    <div class="ypnus-tool" id="ypnus-keyword-scout" role="main" aria-label="Keyword Scout">
        <div class="ypnus-tool__header">
            <span class="ypnus-tool__eyebrow">SEO Research</span>
            <h2 class="ypnus-tool__title">Keyword Scout</h2>
            <p class="ypnus-tool__desc">Enter any mortgage or real estate topic. Get 10 long-tail keyword ideas ranked by competition level with a content angle for each.</p>
        </div>

        <div class="ypnus-form ypnus-form--inline">
            <label for="ypnus-keyword-input" class="ypnus-label">Topic or Niche</label>
            <div class="ypnus-input-row">
                <input
                    type="text"
                    id="ypnus-keyword-input"
                    class="ypnus-input"
                    placeholder="e.g. VA home loans, first-time buyer programs, FHA down payment..."
                    aria-label="Enter a mortgage topic to research"
                />
                <button class="ypnus-btn ypnus-btn--primary" id="ypnus-keyword-btn" onclick="ypnusKeywordScout()">
                    <span class="ypnus-btn__text">Find Keywords</span>
                    <span class="ypnus-btn__loader" aria-hidden="true"></span>
                </button>
            </div>
        </div>

        <div id="ypnus-keyword-output" class="ypnus-output" hidden aria-live="polite">
            <div class="ypnus-table-wrap">
                <table class="ypnus-keyword-table" id="ypnus-keyword-table">
                    <thead>
                        <tr>
                            <th>Keyword</th>
                            <th>Intent</th>
                            <th>Difficulty</th>
                            <th>Content Angle</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody id="ypnus-keyword-body"></tbody>
                </table>
            </div>
        </div>

        <div id="ypnus-keyword-error" class="ypnus-error" hidden role="alert"></div>
    </div>
    <?php
    return ob_get_clean();
} );

// ─── Shortcode: Silo Navigation ──────────────────────────────────────────────

add_shortcode( 'ypnus_silo_nav', function () {
    $silos_raw = get_option( 'ypnus_mlo_silos', ypnus_mlo_default_silos() );
    $silos     = json_decode( $silos_raw, true );

    if ( ! is_array( $silos ) ) return '';

    $current_path = parse_url( $_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH );
    $active_silo  = null;
    $active_key   = '';

    foreach ( $silos as $prefix => $silo ) {
        if ( str_starts_with( $current_path, $prefix ) ) {
            $active_silo = $silo;
            $active_key  = $prefix;
            break;
        }
    }

    if ( ! $active_silo ) return '';

    $label    = esc_html( $active_silo['label'] );
    $children = $active_silo['children'] ?? [];
    $home_url = esc_url( home_url( $active_key . '/' ) );

    ob_start();
    ?>
    <nav class="ypnus-silo-nav" aria-label="<?php echo esc_attr( $label ); ?> section navigation">
        <div class="ypnus-silo-nav__breadcrumb">
            <a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="ypnus-silo-nav__home">Home</a>
            <span class="ypnus-silo-nav__sep" aria-hidden="true">/</span>
            <a href="<?php echo $home_url; ?>" class="ypnus-silo-nav__pillar"><?php echo $label; ?></a>
            <?php if ( get_the_title() ): ?>
                <span class="ypnus-silo-nav__sep" aria-hidden="true">/</span>
                <span class="ypnus-silo-nav__current" aria-current="page"><?php echo esc_html( get_the_title() ); ?></span>
            <?php endif; ?>
        </div>
        <?php if ( $children ): ?>
        <div class="ypnus-silo-nav__children">
            <span class="ypnus-silo-nav__label">In this section:</span>
            <?php foreach ( $children as $child ):
                $is_current = rtrim( $current_path, '/' ) === rtrim( $child['url'], '/' );
            ?>
                <a href="<?php echo esc_url( home_url( $child['url'] ) ); ?>"
                   class="ypnus-silo-nav__child<?php echo $is_current ? ' ypnus-silo-nav__child--active' : ''; ?>"
                   <?php echo $is_current ? 'aria-current="page"' : ''; ?>>
                    <?php echo esc_html( $child['label'] ); ?>
                </a>
            <?php endforeach; ?>
        </div>
        <?php endif; ?>
    </nav>
    <?php
    return ob_get_clean();
} );

// ─── Auto-inject Silo Nav (optional hook) ────────────────────────────────────
// If you want the silo nav to appear automatically on every page without a shortcode,
// uncomment the block below. It will inject before the entry content.

/*
add_action( 'generate_before_content', function () {
    echo do_shortcode( '[ypnus_silo_nav]' );
} );
*/

// ─── Asset enqueue: also load for ypnus_agent shortcode ──────────────────────

add_filter( 'ypnus_mlo_has_shortcode', function ( $has, $post ) {
    return $has || has_shortcode( $post->post_content, 'ypnus_agent' );
}, 10, 2 );

// Override the existing enqueue check to use this filter
remove_action( 'wp_enqueue_scripts', 'ypnus_mlo_enqueue_assets' );
add_action( 'wp_enqueue_scripts', 'ypnus_mlo_enqueue_assets' );

function ypnus_mlo_enqueue_assets() {
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) ) return;

    $has = has_shortcode( $post->post_content, 'ypnus_content_generator' )
        || has_shortcode( $post->post_content, 'ypnus_keyword_scout' )
        || has_shortcode( $post->post_content, 'ypnus_silo_nav' )
        || has_shortcode( $post->post_content, 'ypnus_agent' );

    if ( ! $has ) return;

    wp_enqueue_style(
        'ypnus-mlo-style',
        YPNUS_MLO_URL . 'assets/style.css',
        [],
        YPNUS_MLO_VERSION
    );

    wp_enqueue_script(
        'ypnus-mlo-script',
        YPNUS_MLO_URL . 'assets/script.js',
        [],
        YPNUS_MLO_VERSION,
        true
    );

    wp_localize_script( 'ypnus-mlo-script', 'ypnusMLO', [
        'ajaxUrl'    => admin_url( 'admin-ajax.php' ),
        'nonce'      => wp_create_nonce( 'ypnus_mlo_nonce' ),
        'disclosure' => get_option( 'ypnus_mlo_disclosure', ypnus_mlo_default_disclosure() ),
    ] );
}

// ─── AJAX: Agentic Chat ───────────────────────────────────────────────────────

add_action( 'wp_ajax_nopriv_ypnus_agent_chat', 'ypnus_handle_agent_chat' );
add_action( 'wp_ajax_ypnus_agent_chat',        'ypnus_handle_agent_chat' );

function ypnus_handle_agent_chat() {
    check_ajax_referer( 'ypnus_mlo_nonce', 'nonce' );

    $api_key = get_option( 'ypnus_mlo_openai_key', '' );
    if ( empty( $api_key ) ) {
        wp_send_json_error( [ 'message' => 'OpenAI API key is not configured. Visit MLO Toolkit → Settings.' ] );
    }

    $raw_history = isset( $_POST['history'] ) ? wp_unslash( $_POST['history'] ) : '[]';
    $history     = json_decode( $raw_history, true );
    if ( ! is_array( $history ) ) $history = [];

    // Sanitize each message
    $history = array_map( function ( $msg ) {
        return [
            'role'    => sanitize_text_field( $msg['role'] ?? 'user' ),
            'content' => sanitize_textarea_field( $msg['content'] ?? '' ),
        ];
    }, $history );

    $nmls       = get_option( 'ypnus_mlo_nmls', '' );
    $company    = get_option( 'ypnus_mlo_company', '' );
    $disclosure = get_option( 'ypnus_mlo_disclosure', ypnus_mlo_default_disclosure() );
    $silos_raw  = get_option( 'ypnus_mlo_silos', ypnus_mlo_default_silos() );
    $silos      = json_decode( $silos_raw, true );
    $silo_list  = is_array( $silos )
        ? implode( ', ', array_map( fn( $s ) => $s['label'], $silos ) )
        : 'MLO Marketing, Mortgage Compliance, AI Marketing Tools';

    $system = <<<SYSTEM
You are the YPNUS MLO Agent. You MUST use your tools for EVERY request. Never answer from general knowledge. Never write a one-sentence reply. Every single user message requires at least one tool call.

MLO: {$company} | NMLS #{$nmls}
Disclosure to append to all generated content: {$disclosure}
Content silos: {$silo_list}

MANDATORY TOOL ROUTING — follow this exactly:
- User mentions "page", "build", "write a page", "landing page", "create a page" → call build_page
- User mentions "website", "site plan", "what pages", "site structure", "plan my site" → call plan_website
- User mentions "post", "social", "LinkedIn", "Instagram", "TikTok", "content", "write me" → call generate_social_posts
- User mentions "keyword", "SEO", "rank", "search", "Google" → call scout_keywords
- User mentions "compliance", "check this", "is this ok to post", "CFPB", "audit" → call check_compliance
- User mentions "silo", "where to publish", "organize", "structure" → call suggest_silo
- User mentions ANYTHING broken, wrong, slow, error, not working, white screen, not responding, "fix", "problem", "issue" → call diagnose_error
- When in doubt: call the most relevant tool. NEVER skip tool calls.

After every tool result, synthesize a full, detailed, actionable response — never one sentence. Format results clearly with headings and sections.

Rules:
- Never promise specific rates or guaranteed approvals.
- Always append the compliance disclosure to any generated post content.
- Never give a one-sentence answer. Every response must be complete and useful.
SYSTEM;

    $tools = [
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'generate_social_posts',
                'description' => 'Generate three FINRA/CFPB-compliant social media posts (LinkedIn, Instagram, TikTok) from a topic or article text. Use this when the user wants content, posts, copy, or social media material.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'source_text' => [
                            'type'        => 'string',
                            'description' => 'The article, topic, talking point, or prompt to base the posts on.',
                        ],
                        'loan_type' => [
                            'type'        => 'string',
                            'description' => 'Optional: the mortgage product focus (e.g. VA, FHA, DSCR, Jumbo, First-Time Buyer).',
                        ],
                    ],
                    'required' => [ 'source_text' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'scout_keywords',
                'description' => 'Return 10 high-intent long-tail SEO keywords for a mortgage topic. Use this when the user asks about keywords, SEO, what to rank for, or content ideas.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'topic' => [
                            'type'        => 'string',
                            'description' => 'The mortgage topic or niche to research (e.g. "DSCR loans for investors", "VA loan eligibility").',
                        ],
                    ],
                    'required' => [ 'topic' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'check_compliance',
                'description' => 'Audit a piece of mortgage marketing text for CFPB/FINRA compliance issues. Returns a pass/fail score plus specific flags. Use this before the user publishes any content.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'content' => [
                            'type'        => 'string',
                            'description' => 'The marketing copy, post, or ad text to audit.',
                        ],
                    ],
                    'required' => [ 'content' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'suggest_silo',
                'description' => 'Recommend the best content silo and page placement for a topic, plus internal linking suggestions. Use when the user asks where to publish, how to organize content, or how to structure their site.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'topic' => [
                            'type'        => 'string',
                            'description' => 'The topic or page idea to place within the silo structure.',
                        ],
                    ],
                    'required' => [ 'topic' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'build_page',
                'description' => 'Generate complete, conversion-optimized website page copy for a mortgage loan officer. Output includes: H1 headline, subheadline, hero paragraph, 3 benefit/feature blocks, body copy sections, FAQ section (5 Q&As), a primary CTA, trust signals, and SEO meta title/description. Use this when the user asks to build, write, or create a page, landing page, or any website content.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'page_type' => [
                            'type'        => 'string',
                            'description' => 'The type of page to build. Examples: VA loan, FHA loan, DSCR loan, first-time homebuyer, jumbo loan, refinance, about, homepage, contact, lead capture.',
                        ],
                        'city' => [
                            'type'        => 'string',
                            'description' => 'Optional: city or geographic market to localize the page for (e.g. "Phoenix AZ", "Tampa FL").',
                        ],
                        'angle' => [
                            'type'        => 'string',
                            'description' => 'Optional: a specific selling angle or hook (e.g. "no down payment", "investor focused", "self-employed borrowers").',
                        ],
                    ],
                    'required' => [ 'page_type' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'diagnose_error',
                'description' => 'Diagnose any WordPress error, broken behavior, plugin conflict, PHP error, white screen, theme issue, slow page, or site problem. Returns root cause, step-by-step fix, corrected code if applicable, and what to check. Use this whenever the user describes ANYTHING broken, wrong, slow, missing, or not working on their site.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'symptom' => [
                            'type'        => 'string',
                            'description' => 'Full description of the problem — error message text, what the user sees, what they expected, when it started. The more detail the better.',
                        ],
                        'context' => [
                            'type'        => 'string',
                            'description' => 'Optional: WordPress version, active theme, relevant plugins, what was changed before the error appeared, hosting environment.',
                        ],
                    ],
                    'required' => [ 'symptom' ],
                ],
            ],
        ],
        [
            'type'     => 'function',
            'function' => [
                'name'        => 'plan_website',
                'description' => 'Generate a complete website architecture plan for a mortgage loan officer — page list with URLs, content briefs, primary keywords, and internal linking strategy. Use when the user asks to plan, design, or structure their whole website, or asks what pages they need.',
                'parameters'  => [
                    'type'       => 'object',
                    'properties' => [
                        'niche' => [
                            'type'        => 'string',
                            'description' => 'The MLO\'s primary loan niche(s) (e.g. "VA and FHA", "DSCR investor loans", "first-time buyers", "full service").',
                        ],
                        'market' => [
                            'type'        => 'string',
                            'description' => 'Optional: geographic market or state (e.g. "Phoenix AZ", "Texas statewide", "Southeast US").',
                        ],
                        'goal' => [
                            'type'        => 'string',
                            'description' => 'Optional: primary business goal (e.g. "generate leads", "rank locally", "establish authority", "convert referrals").',
                        ],
                    ],
                    'required' => [ 'niche' ],
                ],
            ],
        ],
    ];

    $messages = array_merge(
        [ [ 'role' => 'system', 'content' => $system ] ],
        $history
    );

    // Agentic loop — max 5 iterations to prevent runaway calls
    $max_iterations = 5;
    $tool_results   = [];

    for ( $i = 0; $i < $max_iterations; $i++ ) {

        // Inject tool results from previous iteration
        if ( ! empty( $tool_results ) ) {
            foreach ( $tool_results as $tr ) {
                $messages[] = $tr;
            }
            $tool_results = [];
        }

        // Force tool use on first iteration; allow auto on follow-up iterations
        $body = [
            'model'       => 'gpt-4o-mini',
            'messages'    => $messages,
            'tools'       => $tools,
            'tool_choice' => ( $i === 0 ) ? 'required' : 'auto',
            'temperature' => 0.6,
        ];

        $response = wp_remote_post(
            'https://api.openai.com/v1/chat/completions',
            [
                'timeout' => 90,
                'headers' => [
                    'Authorization' => 'Bearer ' . $api_key,
                    'Content-Type'  => 'application/json',
                ],
                'body' => json_encode( $body ),
            ]
        );

        if ( is_wp_error( $response ) ) {
            wp_send_json_error( [ 'message' => 'API connection failed: ' . $response->get_error_message() ] );
        }

        $data    = json_decode( wp_remote_retrieve_body( $response ), true );
        $choice  = $data['choices'][0] ?? null;
        $message = $choice['message'] ?? null;

        if ( ! $message ) {
            wp_send_json_error( [ 'message' => 'Unexpected API response. Please try again.' ] );
        }

        // No tool calls — final answer
        if ( empty( $message['tool_calls'] ) ) {
            wp_send_json_success( [
                'reply' => $message['content'] ?? '',
            ] );
            return;
        }

        // Append assistant message with tool_calls to maintain context
        $messages[] = $message;

        // Execute each tool call
        foreach ( $message['tool_calls'] as $tc ) {
            $fn_name = $tc['function']['name'] ?? '';
            $fn_args = json_decode( $tc['function']['arguments'] ?? '{}', true );
            $tc_id   = $tc['id'] ?? '';

            $result = ypnus_run_agent_tool( $fn_name, $fn_args, $api_key, $disclosure );

            $tool_results[] = [
                'role'         => 'tool',
                'tool_call_id' => $tc_id,
                'content'      => json_encode( $result ),
            ];
        }
    }

    wp_send_json_error( [ 'message' => 'The agent took too many steps. Please rephrase your request.' ] );
}

function ypnus_run_agent_tool( $name, $args, $api_key, $disclosure ) {
    switch ( $name ) {

        case 'generate_social_posts': {
            $source    = $args['source_text'] ?? '';
            $loan_type = $args['loan_type'] ?? '';
            $focus     = $loan_type ? " Focus on {$loan_type} mortgages." : '';

            $prompt = <<<PROMPT
Generate three compliant social media posts for a Mortgage Loan Officer.{$focus}
Return ONLY valid JSON with keys: linkedin, instagram, tiktok.

linkedin: 150-300 words. Professional, educational. 2-3 hashtags. No emojis in body.
instagram: 80-150 words. Warm, conversational. 5-8 hashtags. 1-2 emojis.
tiktok: 30-45 second script with [VISUAL CUE] stage directions. Hook in first 3 seconds. One clear CTA.

Do NOT include any compliance disclosure in the output.

SOURCE:
{$source}
PROMPT;

            $r = wp_remote_post(
                'https://api.openai.com/v1/chat/completions',
                [
                    'timeout' => 60,
                    'headers' => [
                        'Authorization' => 'Bearer ' . $api_key,
                        'Content-Type'  => 'application/json',
                    ],
                    'body' => json_encode( [
                        'model'           => 'gpt-4o-mini',
                        'messages'        => [ [ 'role' => 'user', 'content' => $prompt ] ],
                        'temperature'     => 0.7,
                        'response_format' => [ 'type' => 'json_object' ],
                    ] ),
                ]
            );

            if ( is_wp_error( $r ) ) {
                return [ 'error' => 'Content generation failed.' ];
            }

            $posts = json_decode(
                json_decode( wp_remote_retrieve_body( $r ), true )['choices'][0]['message']['content'] ?? '{}',
                true
            );

            // Append disclosure to each post
            foreach ( [ 'linkedin', 'instagram', 'tiktok' ] as $platform ) {
                if ( isset( $posts[ $platform ] ) ) {
                    $posts[ $platform ] .= "\n\n" . $disclosure;
                }
            }

            return $posts ?: [ 'error' => 'Unexpected content format.' ];
        }

        case 'scout_keywords': {
            $topic     = $args['topic'] ?? '';
            $cache_key = 'ypnus_kw_' . md5( strtolower( $topic ) );
            $cached    = get_transient( $cache_key );
            if ( $cached !== false ) return [ 'keywords' => $cached ];

            $prompt = <<<PROMPT
SEO specialist for mortgage professionals. Generate 10 high-intent long-tail keywords for: "{$topic}".
Return ONLY valid JSON: {"keywords": [ {keyword, intent, difficulty, angle}, ... ]}
intent: Informational | Commercial | Transactional | Navigational
difficulty: Easy | Medium | Hard
PROMPT;

            $r = wp_remote_post(
                'https://api.openai.com/v1/chat/completions',
                [
                    'timeout' => 45,
                    'headers' => [
                        'Authorization' => 'Bearer ' . $api_key,
                        'Content-Type'  => 'application/json',
                    ],
                    'body' => json_encode( [
                        'model'           => 'gpt-4o-mini',
                        'messages'        => [ [ 'role' => 'user', 'content' => $prompt ] ],
                        'temperature'     => 0.4,
                        'response_format' => [ 'type' => 'json_object' ],
                    ] ),
                ]
            );

            if ( is_wp_error( $r ) ) return [ 'error' => 'Keyword research failed.' ];

            $decoded  = json_decode(
                json_decode( wp_remote_retrieve_body( $r ), true )['choices'][0]['message']['content'] ?? '{}',
                true
            );
            $keywords = $decoded['keywords'] ?? [];
            if ( $keywords ) set_transient( $cache_key, $keywords, DAY_IN_SECONDS );
            return [ 'keywords' => $keywords ];
        }

        case 'check_compliance': {
            $content = $args['content'] ?? '';

            $prompt = <<<PROMPT
You are a CFPB and FINRA mortgage advertising compliance auditor.
Audit the following mortgage marketing content. Return ONLY valid JSON:
{
  "passed": true/false,
  "score": 0-100,
  "flags": [ { "severity": "high|medium|low", "issue": "...", "suggestion": "..." } ],
  "safe_to_post": true/false,
  "summary": "one-sentence verdict"
}

Flag these specifically: guaranteed rates, APR without full disclosure, superlatives without substantiation, missing NMLS number, equal housing omission, discriminatory language, false urgency.

CONTENT:
{$content}
PROMPT;

            $r = wp_remote_post(
                'https://api.openai.com/v1/chat/completions',
                [
                    'timeout' => 30,
                    'headers' => [
                        'Authorization' => 'Bearer ' . $api_key,
                        'Content-Type'  => 'application/json',
                    ],
                    'body' => json_encode( [
                        'model'           => 'gpt-4o-mini',
                        'messages'        => [ [ 'role' => 'user', 'content' => $prompt ] ],
                        'temperature'     => 0.1,
                        'response_format' => [ 'type' => 'json_object' ],
                    ] ),
                ]
            );

            if ( is_wp_error( $r ) ) return [ 'error' => 'Compliance check failed.' ];

            return json_decode(
                json_decode( wp_remote_retrieve_body( $r ), true )['choices'][0]['message']['content'] ?? '{}',
                true
            ) ?: [ 'error' => 'Unexpected compliance response.' ];
        }

        case 'suggest_silo': {
            $topic     = $args['topic'] ?? '';
            $silos_raw = get_option( 'ypnus_mlo_silos', ypnus_mlo_default_silos() );
            $silos     = json_decode( $silos_raw, true );
            $silo_json = json_encode( $silos );

            $prompt = <<<PROMPT
You are an MLO website SEO architect. Given the silo structure below and a topic, recommend:
1. Which silo this topic belongs in (use the exact silo label from the structure)
2. The ideal URL slug for a new page
3. Three internal linking suggestions (which existing pages in the silo should link to this new page)
4. A 1-sentence SEO meta description for the page

Return ONLY valid JSON:
{"silo": "...", "url_slug": "...", "internal_links": ["...", "...", "..."], "meta_description": "..."}

SILO STRUCTURE:
{$silo_json}

TOPIC: {$topic}
PROMPT;

            $r = wp_remote_post(
                'https://api.openai.com/v1/chat/completions',
                [
                    'timeout' => 30,
                    'headers' => [
                        'Authorization' => 'Bearer ' . $api_key,
                        'Content-Type'  => 'application/json',
                    ],
                    'body' => json_encode( [
                        'model'           => 'gpt-4o-mini',
                        'messages'        => [ [ 'role' => 'user', 'content' => $prompt ] ],
                        'temperature'     => 0.3,
                        'response_format' => [ 'type' => 'json_object' ],
                    ] ),
                ]
            );

            if ( is_wp_error( $r ) ) return [ 'error' => 'Silo suggestion failed.' ];

            return json_decode(
                json_decode( wp_remote_retrieve_body( $r ), true )['choices'][0]['message']['content'] ?? '{}',
                true
            ) ?: [ 'error' => 'Unexpected silo response.' ];
        }

        case 'diagnose_error': {
            $symptom = $args['symptom'] ?? '';
            $context = $args['context'] ?? '';
            $theme   = 'GeneratePress';
            $plugins = 'YPNUS MLO Toolkit, Xagio SEO, CookieYes, Google Site Kit, Stripe';
            $host    = 'Hostinger Cloud (shared, PHP 8.x, no persistent Node.js)';

            $ctx_block = $context
                ? "Additional context provided by user: {$context}"
                : "Known site context: Theme: {$theme} | Plugins: {$plugins} | Host: {$host}";

            $prompt = <<<PROMPT
You are a senior WordPress developer and systems architect with 15 years of experience. You debug WordPress sites, PHP errors, plugin conflicts, theme issues, performance problems, and white screens of death.

Diagnose the following problem and return a complete fix. Think like an expert — go beyond surface symptoms to identify the real root cause.

PROBLEM: {$symptom}
{$ctx_block}

Return ONLY valid JSON:
{
  "root_cause": "Precise technical explanation of WHY this is happening",
  "category": "one of: php-error | plugin-conflict | theme-issue | database | permissions | memory-limit | caching | css-js | block-editor | htaccess | hosting-config | third-party-api | user-error",
  "severity": "critical | high | medium | low",
  "diagnosis_confidence": "high | medium | low",
  "immediate_fix": {
    "summary": "What to do right now in one sentence",
    "steps": [
      "Exact step 1 with specific menu paths, file paths, or settings",
      "Exact step 2",
      "Exact step 3"
    ]
  },
  "code_fix": {
    "needed": true,
    "file": "path/to/file.php or null",
    "language": "php | css | js | htaccess | null",
    "before": "the broken code snippet, if applicable",
    "after": "the corrected code snippet, if applicable",
    "instructions": "where exactly to paste this"
  },
  "root_fix": {
    "summary": "The permanent solution to prevent this recurring",
    "steps": ["step 1", "step 2"]
  },
  "what_to_check_first": [
    "Specific thing to verify first (e.g. WordPress Admin → Tools → Site Health → Info → PHP version)",
    "Second thing",
    "Third thing"
  ],
  "safe_to_ignore": false,
  "warning": "Any risk of data loss or site downtime from the fix, or null if safe"
}

If the symptom is vague, give the most likely diagnosis for a WordPress site on shared Hostinger hosting running GeneratePress theme. Always give exact menu paths (e.g. 'Plugins → Installed Plugins → Deactivate All') not generic instructions.
PROMPT;

            $r = wp_remote_post(
                'https://api.openai.com/v1/chat/completions',
                [
                    'timeout' => 60,
                    'headers' => [
                        'Authorization' => 'Bearer ' . $api_key,
                        'Content-Type'  => 'application/json',
                    ],
                    'body' => json_encode( [
                        'model'           => 'gpt-4o-mini',
                        'messages'        => [ [ 'role' => 'user', 'content' => $prompt ] ],
                        'temperature'     => 0.2,
                        'response_format' => [ 'type' => 'json_object' ],
                    ] ),
                ]
            );

            if ( is_wp_error( $r ) ) return [ 'error' => 'Diagnosis failed — API error.' ];

            $result = json_decode(
                json_decode( wp_remote_retrieve_body( $r ), true )['choices'][0]['message']['content'] ?? '{}',
                true
            );

            return $result ?: [ 'error' => 'Unexpected diagnosis response.' ];
        }

        case 'build_page': {
            $page_type  = $args['page_type'] ?? 'mortgage';
            $city       = $args['city']       ?? '';
            $angle      = $args['angle']      ?? '';
            $nmls       = get_option( 'ypnus_mlo_nmls', '' );
            $company    = get_option( 'ypnus_mlo_company', '' );
            $city_str   = $city   ? " in {$city}"          : '';
            $angle_str  = $angle  ? " Angle/hook: {$angle}." : '';
            $credit_str = $nmls   ? "NMLS #{$nmls}"        : '';
            $co_str     = $company ? " | {$company}"        : '';

            $prompt = <<<PROMPT
You are an expert mortgage website copywriter. Generate complete, conversion-optimized page copy for a Mortgage Loan Officer's website.

Page type: {$page_type}{$city_str}.{$angle_str}
MLO credentials: {$credit_str}{$co_str}

Return ONLY valid JSON with these exact keys:
{
  "meta_title": "60-char max SEO title",
  "meta_description": "150-char max meta description with CTA verb",
  "h1": "Main page headline (benefit-focused, location-specific if city provided)",
  "subheadline": "Supporting sentence under H1",
  "hero_paragraph": "2-3 sentence intro paragraph",
  "benefit_blocks": [
    {"icon_label": "short label", "headline": "benefit headline", "body": "2-sentence description"},
    {"icon_label": "short label", "headline": "benefit headline", "body": "2-sentence description"},
    {"icon_label": "short label", "headline": "benefit headline", "body": "2-sentence description"}
  ],
  "body_sections": [
    {"heading": "H2 section heading", "content": "2-3 paragraph section body"},
    {"heading": "H2 section heading", "content": "2-3 paragraph section body"}
  ],
  "faqs": [
    {"question": "...", "answer": "2-3 sentence answer"},
    {"question": "...", "answer": "2-3 sentence answer"},
    {"question": "...", "answer": "2-3 sentence answer"},
    {"question": "...", "answer": "2-3 sentence answer"},
    {"question": "...", "answer": "2-3 sentence answer"}
  ],
  "primary_cta": {"button_text": "...", "supporting_text": "one line under the button"},
  "trust_signals": ["signal 1", "signal 2", "signal 3", "signal 4"],
  "url_slug": "/suggested-url-slug/"
}

Rules:
- Never promise specific interest rates or guaranteed approvals.
- Include NMLS number in trust signals if provided.
- All FAQs must answer real borrower questions.
- Body copy must be hyper-local if city is provided.
- Trust signals: real, specific, no generic fluff.
PROMPT;

            $r = wp_remote_post(
                'https://api.openai.com/v1/chat/completions',
                [
                    'timeout' => 90,
                    'headers' => [
                        'Authorization' => 'Bearer ' . $api_key,
                        'Content-Type'  => 'application/json',
                    ],
                    'body' => json_encode( [
                        'model'           => 'gpt-4o-mini',
                        'messages'        => [ [ 'role' => 'user', 'content' => $prompt ] ],
                        'temperature'     => 0.65,
                        'response_format' => [ 'type' => 'json_object' ],
                    ] ),
                ]
            );

            if ( is_wp_error( $r ) ) return [ 'error' => 'Page build failed.' ];

            $result = json_decode(
                json_decode( wp_remote_retrieve_body( $r ), true )['choices'][0]['message']['content'] ?? '{}',
                true
            );

            return $result ?: [ 'error' => 'Unexpected page build response.' ];
        }

        case 'plan_website': {
            $niche  = $args['niche']  ?? 'full service mortgage';
            $market = $args['market'] ?? '';
            $goal   = $args['goal']   ?? 'generate leads and rank locally';
            $nmls   = get_option( 'ypnus_mlo_nmls', '' );
            $company = get_option( 'ypnus_mlo_company', '' );

            $market_str = $market ? " Target market: {$market}." : '';
            $credit_str = $nmls   ? "NMLS #{$nmls}"              : '';
            $co_str     = $company ? " | {$company}"              : '';

            $prompt = <<<PROMPT
You are a senior mortgage website architect and SEO strategist. Create a complete website plan for a Mortgage Loan Officer.

Niche: {$niche}.{$market_str}
Goal: {$goal}.
MLO: {$credit_str}{$co_str}

Return ONLY valid JSON:
{
  "site_summary": "2-sentence positioning statement for the site",
  "pages": [
    {
      "title": "Page title",
      "url": "/url-slug/",
      "purpose": "one sentence — what this page does for the business",
      "primary_keyword": "main SEO keyword to target",
      "secondary_keywords": ["kw1", "kw2", "kw3"],
      "content_brief": "3-4 sentence description of what content goes on this page",
      "priority": "high|medium|low",
      "links_to": ["/other-page/", "/another-page/"]
    }
  ],
  "silo_structure": {
    "silo_name": ["page-url-1", "page-url-2"]
  },
  "launch_order": ["/highest-priority-url/", "/second/"],
  "quick_wins": ["specific actionable tip 1", "tip 2", "tip 3"]
}

Include: homepage, about, all relevant loan type pages, local/city pages (at least 3 if market provided), a blog hub, contact, and any niche-specific pages. Minimum 10 pages total. Make URLs, keywords, and content briefs specific — no generic placeholders.
PROMPT;

            $r = wp_remote_post(
                'https://api.openai.com/v1/chat/completions',
                [
                    'timeout' => 90,
                    'headers' => [
                        'Authorization' => 'Bearer ' . $api_key,
                        'Content-Type'  => 'application/json',
                    ],
                    'body' => json_encode( [
                        'model'           => 'gpt-4o-mini',
                        'messages'        => [ [ 'role' => 'user', 'content' => $prompt ] ],
                        'temperature'     => 0.5,
                        'response_format' => [ 'type' => 'json_object' ],
                    ] ),
                ]
            );

            if ( is_wp_error( $r ) ) return [ 'error' => 'Website plan generation failed.' ];

            $result = json_decode(
                json_decode( wp_remote_retrieve_body( $r ), true )['choices'][0]['message']['content'] ?? '{}',
                true
            );

            return $result ?: [ 'error' => 'Unexpected website plan response.' ];
        }

        default:
            return [ 'error' => "Unknown tool: {$name}" ];
    }
}

// ─── Shortcode: Agentic Chat ──────────────────────────────────────────────────

add_shortcode( 'ypnus_agent', function () {
    $nmls    = get_option( 'ypnus_mlo_nmls', '' );
    $company = get_option( 'ypnus_mlo_company', '' );
    $label   = $company ? esc_html( $company ) . ' AI Agent' : 'MLO AI Agent';
    $sub     = $nmls ? 'NMLS #' . esc_html( $nmls ) . ' · Powered by YPNUS' : 'Powered by YPNUS';

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

        <div class="ypnus-agent__messages" id="ypnus-agent-messages" role="log" aria-live="polite" aria-label="Conversation">
            <div class="ypnus-agent__message ypnus-agent__message--agent">
                <div class="ypnus-agent__bubble">
                    Hi! I'm your MLO AI Agent — part marketer, part senior WordPress developer. I can diagnose and fix WordPress errors, build complete website pages, plan your entire site architecture, write compliant social posts, find SEO keywords, and audit copy for CFPB compliance. Describe any problem — broken page, weird error, something not responding — and I'll diagnose it like a coder and give you the exact fix.
                </div>
            </div>
        </div>

        <div class="ypnus-agent__suggestions" id="ypnus-agent-suggestions">
            <button class="ypnus-agent__chip" onclick="ypnusAgentSuggest('My WordPress page is broken and showing text written up and down — what is wrong and how do I fix it?')">Fix a broken page</button>
            <button class="ypnus-agent__chip" onclick="ypnusAgentSuggest('Build me a VA loan page for my website')">Build a page</button>
            <button class="ypnus-agent__chip" onclick="ypnusAgentSuggest('Plan my entire mortgage website — I focus on VA and FHA loans')">Plan my website</button>
            <button class="ypnus-agent__chip" onclick="ypnusAgentSuggest('Write me 3 VA loan posts for LinkedIn, Instagram, and TikTok')">Write social posts</button>
            <button class="ypnus-agent__chip" onclick="ypnusAgentSuggest('Find SEO keywords for DSCR investor loans')">Find keywords</button>
        </div>

        <form class="ypnus-agent__input-row" id="ypnus-agent-form" onsubmit="ypnusAgentSend(event)" novalidate>
            <textarea
                id="ypnus-agent-input"
                class="ypnus-agent__input"
                placeholder="Ask anything — write posts, find keywords, check compliance, plan content…"
                rows="1"
                aria-label="Message the MLO agent"
            ></textarea>
            <button type="submit" class="ypnus-agent__send" id="ypnus-agent-send" aria-label="Send message">
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
    <?php
    return ob_get_clean();
} );
