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

add_action( 'wp_enqueue_scripts', function () {
    // Only enqueue when a shortcode is present on the page
    global $post;
    if ( ! is_a( $post, 'WP_Post' ) ) return;
    $has_shortcode = has_shortcode( $post->post_content, 'ypnus_content_generator' )
                  || has_shortcode( $post->post_content, 'ypnus_keyword_scout' )
                  || has_shortcode( $post->post_content, 'ypnus_silo_nav' );
    if ( ! $has_shortcode ) return;

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
} );

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
