<?php
/**
 * Plugin Name: YPNUS Homepage Rewrite (One-Time)
 * Description: Replaces homepage (ID 1829) with a conversion-optimized layout. Deactivate and delete after running.
 * Version:     1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) exit;

add_action( 'admin_init', 'ypnus_run_homepage_rewrite' );

function ypnus_run_homepage_rewrite(): void {
    if ( get_option( 'ypnus_homepage_rewrite_done' ) ) return;

    $demo_url    = 'https://ypnus.com/mlo-site-demo/';
    $pricing_url = 'https://ypnus.com/pricing/';

    $content = <<<'HTML'
<!-- wp:html -->
<style>
.yp-page { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #111827; }
.yp-page * { box-sizing: border-box; }
.yp-btn-primary { display:inline-block; background:#1565C0; color:#fff !important; font-size:17px; font-weight:800; padding:16px 36px; border-radius:10px; text-decoration:none !important; box-shadow:0 4px 20px rgba(21,101,192,.35); transition:transform .15s,box-shadow .15s; }
.yp-btn-primary:hover { transform:translateY(-2px); box-shadow:0 8px 28px rgba(21,101,192,.45); }
.yp-btn-ghost { display:inline-block; background:transparent; color:#1565C0 !important; font-size:16px; font-weight:700; padding:14px 32px; border-radius:10px; text-decoration:none !important; border:2px solid #1565C0; transition:background .15s,color .15s; }
.yp-btn-ghost:hover { background:#1565C0; color:#fff !important; }
.yp-btn-white { display:inline-block; background:#fff; color:#1565C0 !important; font-size:17px; font-weight:800; padding:16px 36px; border-radius:10px; text-decoration:none !important; box-shadow:0 4px 20px rgba(0,0,0,.18); }
@media(max-width:640px){
  .yp-hero-btns { flex-direction:column !important; align-items:center !important; }
  .yp-grid-3 { grid-template-columns:1fr !important; }
  .yp-grid-2 { grid-template-columns:1fr !important; }
  .yp-steps { flex-direction:column !important; }
  .yp-step-arrow { display:none !important; }
  .yp-pain-grid { grid-template-columns:1fr !important; }
}
</style>

<!-- ═══════════════════════════════════════════════════════
     HERO
════════════════════════════════════════════════════════ -->
<section class="yp-page" style="background:linear-gradient(135deg,#0D1B3E 0%,#1565C0 60%,#1976D2 100%);padding:80px 24px 90px;text-align:center;">
  <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.65);margin:0 0 16px;">Built Exclusively for Mortgage Loan Officers</p>
  <h1 style="font-size:clamp(32px,5.5vw,60px);font-weight:900;color:#fff;line-height:1.1;margin:0 auto 20px;max-width:820px;">Your MLO Website.<br>Built by AI. Live in Minutes.</h1>
  <p style="font-size:clamp(17px,2.2vw,22px);color:rgba(255,255,255,.88);max-width:640px;margin:0 auto 36px;line-height:1.6;">YPNUS builds you a complete mortgage website — local city pages, loan product pages, compliant copy, and an AI agent — without you writing a single word or touching any code.</p>
  <div class="yp-hero-btns" style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:28px;">
    <a href="DEMO_URL" class="yp-btn-white">&#9654;&nbsp; See My Free Site Preview</a>
    <a href="PRICING_URL" class="yp-btn-ghost" style="border-color:rgba(255,255,255,.6);color:#fff !important;">View Plans &amp; Pricing</a>
  </div>
  <p style="font-size:13px;color:rgba(255,255,255,.55);margin:0;">No email. No credit card. See your personalized site plan in 30 seconds.</p>
</section>

<!-- ═══════════════════════════════════════════════════════
     TRUST BAR
════════════════════════════════════════════════════════ -->
<section class="yp-page" style="background:#F8FAFF;border-top:1px solid #E3EAF5;border-bottom:1px solid #E3EAF5;padding:28px 24px;text-align:center;">
  <p style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6B7280;margin:0 0 18px;">Serving MLOs Across</p>
  <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:10px 24px;">
    <span style="font-size:15px;font-weight:600;color:#374151;">📍 Fresno, CA</span>
    <span style="font-size:15px;font-weight:600;color:#374151;">📍 Sacramento, CA</span>
    <span style="font-size:15px;font-weight:600;color:#374151;">📍 Las Vegas, NV</span>
    <span style="font-size:15px;font-weight:600;color:#374151;">📍 Phoenix, AZ</span>
    <span style="font-size:15px;font-weight:600;color:#374151;">📍 San Diego, CA</span>
    <span style="font-size:15px;font-weight:600;color:#374151;">📍 Los Angeles, CA</span>
    <span style="font-size:15px;font-weight:600;color:#374151;">📍 Stockton, CA</span>
    <span style="font-size:15px;font-weight:600;color:#374151;">📍 Modesto, CA</span>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════
     PAIN SECTION
════════════════════════════════════════════════════════ -->
<section class="yp-page" style="padding:72px 24px;max-width:960px;margin:0 auto;">
  <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1565C0;text-align:center;margin:0 0 12px;">The Problem</p>
  <h2 style="font-size:clamp(26px,4vw,40px);font-weight:900;text-align:center;margin:0 auto 16px;max-width:700px;line-height:1.2;">Every Day Without a Real Website Is a Lead Your Competitor Closes</h2>
  <p style="font-size:18px;color:#6B7280;text-align:center;max-width:600px;margin:0 auto 52px;line-height:1.7;">Borrowers Google their loan questions before they ever call anyone. If you're not showing up, someone else is.</p>
  <div class="yp-pain-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:20px;">
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:28px;">
      <div style="font-size:28px;margin-bottom:10px;">😓</div>
      <h3 style="font-size:17px;font-weight:800;margin:0 0 8px;color:#111827;">No Website — or a Broken One</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">Your bank's generic page or an outdated site isn't ranking. Prospects can't find you — and when they do, they leave.</p>
    </div>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:28px;">
      <div style="font-size:28px;margin-bottom:10px;">⏰</div>
      <h3 style="font-size:17px;font-weight:800;margin:0 0 8px;color:#111827;">No Time to Build It Right</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">You're closing loans, not writing 50-page websites. The MLOs ranking on Google have an unfair advantage — they're using the right tools.</p>
    </div>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:28px;">
      <div style="font-size:28px;margin-bottom:10px;">💸</div>
      <h3 style="font-size:17px;font-weight:800;margin:0 0 8px;color:#111827;">Agencies Cost $5K–$15K</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">Traditional web agencies charge a fortune, take months, and still deliver generic sites that don't rank for local mortgage searches.</p>
    </div>
    <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:14px;padding:28px;">
      <div style="font-size:28px;margin-bottom:10px;">🔍</div>
      <h3 style="font-size:17px;font-weight:800;margin:0 0 8px;color:#111827;">Generic Content Doesn't Rank</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">Google rewards specific, local, helpful content. A page that says "I do mortgages in California" is invisible compared to "VA Loans in Fresno CA."</p>
    </div>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════
     SOLUTION / HOW IT WORKS
════════════════════════════════════════════════════════ -->
<section class="yp-page" style="background:linear-gradient(135deg,#0D1B3E 0%,#1565C0 100%);padding:80px 24px;text-align:center;">
  <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.65);margin:0 0 12px;">The Solution</p>
  <h2 style="font-size:clamp(26px,4vw,40px);font-weight:900;color:#fff;margin:0 auto 16px;max-width:700px;line-height:1.2;">YPNUS Builds Your Entire Mortgage Website for You</h2>
  <p style="font-size:18px;color:rgba(255,255,255,.85);max-width:580px;margin:0 auto 60px;line-height:1.7;">Tell us your market and loan specialty. The AI does the rest — pages, content, SEO, and a built-in agent that converts visitors.</p>

  <div class="yp-steps" style="display:flex;align-items:flex-start;justify-content:center;gap:0;max-width:860px;margin:0 auto 56px;">
    <div style="flex:1;text-align:center;padding:0 16px;">
      <div style="width:60px;height:60px;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;margin:0 auto 16px;">1</div>
      <h3 style="font-size:18px;font-weight:800;color:#fff;margin:0 0 10px;">Tell Us Your Market</h3>
      <p style="font-size:15px;color:rgba(255,255,255,.75);margin:0;line-height:1.6;">Enter your city, loan types, and niche. Takes 30 seconds.</p>
    </div>
    <div class="yp-step-arrow" style="font-size:28px;color:rgba(255,255,255,.35);padding-top:14px;">→</div>
    <div style="flex:1;text-align:center;padding:0 16px;">
      <div style="width:60px;height:60px;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;margin:0 auto 16px;">2</div>
      <h3 style="font-size:18px;font-weight:800;color:#fff;margin:0 0 10px;">AI Builds Your Site</h3>
      <p style="font-size:15px;color:rgba(255,255,255,.75);margin:0;line-height:1.6;">City pages, loan pages, compliant copy, local SEO — all done for you.</p>
    </div>
    <div class="yp-step-arrow" style="font-size:28px;color:rgba(255,255,255,.35);padding-top:14px;">→</div>
    <div style="flex:1;text-align:center;padding:0 16px;">
      <div style="width:60px;height:60px;background:rgba(255,255,255,.15);border:2px solid rgba(255,255,255,.3);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;color:#fff;margin:0 auto 16px;">3</div>
      <h3 style="font-size:18px;font-weight:800;color:#fff;margin:0 0 10px;">You Close More Loans</h3>
      <p style="font-size:15px;color:rgba(255,255,255,.75);margin:0;line-height:1.6;">Your site works 24/7 to rank, attract, and convert borrowers.</p>
    </div>
  </div>

  <a href="DEMO_URL" class="yp-btn-white">&#9654;&nbsp; See My Free Site Preview</a>
  <p style="font-size:13px;color:rgba(255,255,255,.5);margin:14px 0 0;">No account needed. No credit card. Instant personalized preview.</p>
</section>

<!-- ═══════════════════════════════════════════════════════
     FEATURE BENEFITS
════════════════════════════════════════════════════════ -->
<section class="yp-page" style="padding:80px 24px;max-width:1040px;margin:0 auto;">
  <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1565C0;text-align:center;margin:0 0 12px;">What You Get</p>
  <h2 style="font-size:clamp(26px,4vw,40px);font-weight:900;text-align:center;margin:0 auto 52px;max-width:700px;line-height:1.2;">Everything an MLO Needs to Dominate Local Search</h2>
  <div class="yp-grid-3" style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;">

    <div style="border:1px solid #E5E7EB;border-radius:16px;padding:32px 26px;">
      <div style="font-size:36px;margin-bottom:14px;">🏙️</div>
      <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;">Local City Pages</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">Dedicated pages for every city you serve — "VA Loans in Fresno CA", "FHA Loans in Sacramento" — built to rank on Google for high-intent local searches.</p>
    </div>

    <div style="border:1px solid #E5E7EB;border-radius:16px;padding:32px 26px;">
      <div style="font-size:36px;margin-bottom:14px;">📄</div>
      <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;">Loan Product Pages</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">VA, FHA, Conventional, DSCR, Jumbo, USDA — complete pages for every loan type with compliant, conversion-focused copy written by AI.</p>
    </div>

    <div style="border:1px solid #E5E7EB;border-radius:16px;padding:32px 26px;">
      <div style="font-size:36px;margin-bottom:14px;">🤖</div>
      <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;">Built-In AI Agent</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">Your site comes with an intelligent AI assistant that answers borrower questions, qualifies leads, and books calls — 24/7, even while you sleep.</p>
    </div>

    <div style="border:1px solid #E5E7EB;border-radius:16px;padding:32px 26px;">
      <div style="font-size:36px;margin-bottom:14px;">🔎</div>
      <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;">SEO Built In</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">Schema markup, meta tags, internal linking, and keyword-optimized content — all configured from day one so Google can find and rank your site.</p>
    </div>

    <div style="border:1px solid #E5E7EB;border-radius:16px;padding:32px 26px;">
      <div style="font-size:36px;margin-bottom:14px;">✅</div>
      <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;">Compliance-Friendly Copy</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">Every word is written for mortgage professionals — no rate guarantees, no RESPA violations, no fair lending red flags. CFPB-aware from the start.</p>
    </div>

    <div style="border:1px solid #E5E7EB;border-radius:16px;padding:32px 26px;">
      <div style="font-size:36px;margin-bottom:14px;">⚡</div>
      <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;">Fast &amp; Mobile-First</h3>
      <p style="font-size:15px;color:#6B7280;margin:0;line-height:1.6;">Built on WordPress with performance-optimized hosting. Lightning-fast on mobile — because 70% of your borrowers are searching on their phones.</p>
    </div>

  </div>
</section>

<!-- ═══════════════════════════════════════════════════════
     LOAN TYPES SECTION
════════════════════════════════════════════════════════ -->
<section class="yp-page" style="background:#F8FAFF;padding:72px 24px;text-align:center;">
  <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1565C0;margin:0 0 12px;">Loan Types We Cover</p>
  <h2 style="font-size:clamp(24px,3.5vw,36px);font-weight:900;margin:0 auto 40px;max-width:600px;line-height:1.3;">Pages Built for Every Loan in Your Toolkit</h2>
  <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;max-width:800px;margin:0 auto 40px;">
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">🎖 VA Loans</span>
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">🏠 FHA Loans</span>
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">📋 Conventional</span>
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">🏢 DSCR Investor Loans</span>
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">💎 Jumbo Loans</span>
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">🌾 USDA Loans</span>
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">🔄 Refinance</span>
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">🔑 First-Time Buyer</span>
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">🏦 HELOC</span>
    <span style="background:#fff;border:1px solid #DBEAFE;border-radius:50px;padding:10px 22px;font-size:15px;font-weight:700;color:#1565C0;">🧓 Reverse Mortgage</span>
  </div>
  <a href="DEMO_URL" class="yp-btn-primary">&#9654;&nbsp; See My Free Site Preview</a>
</section>

<!-- ═══════════════════════════════════════════════════════
     FAQ
════════════════════════════════════════════════════════ -->
<section class="yp-page" style="padding:80px 24px;max-width:780px;margin:0 auto;">
  <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#1565C0;text-align:center;margin:0 0 12px;">FAQ</p>
  <h2 style="font-size:clamp(24px,3.5vw,36px);font-weight:900;text-align:center;margin:0 auto 48px;line-height:1.3;">Common Questions</h2>

  <div style="border-bottom:1px solid #E5E7EB;padding:24px 0;">
    <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;color:#111827;">Do I need any technical skills to use YPNUS?</h3>
    <p style="font-size:16px;color:#6B7280;margin:0;line-height:1.7;">None. You enter your market details and the AI builds your complete site. Everything is done for you — no coding, no copywriting, no design work required.</p>
  </div>

  <div style="border-bottom:1px solid #E5E7EB;padding:24px 0;">
    <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;color:#111827;">How long does it take to get my website live?</h3>
    <p style="font-size:16px;color:#6B7280;margin:0;line-height:1.7;">Your personalized site plan is generated in 30 seconds. Full site build and launch typically happens within a few business days depending on your plan.</p>
  </div>

  <div style="border-bottom:1px solid #E5E7EB;padding:24px 0;">
    <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;color:#111827;">Is the content RESPA and CFPB compliant?</h3>
    <p style="font-size:16px;color:#6B7280;margin:0;line-height:1.7;">Yes. All content is written specifically for mortgage professionals — no rate guarantees, no misleading claims, no fair lending violations. Always review with your compliance team before publishing.</p>
  </div>

  <div style="border-bottom:1px solid #E5E7EB;padding:24px 0;">
    <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;color:#111827;">Will my site actually rank on Google?</h3>
    <p style="font-size:16px;color:#6B7280;margin:0;line-height:1.7;">YPNUS builds every page with local SEO in mind — city-specific URLs, keyword-optimized content, schema markup, and internal linking. Rankings take time, but you start on the right foundation from day one.</p>
  </div>

  <div style="border-bottom:1px solid #E5E7EB;padding:24px 0;">
    <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;color:#111827;">What makes YPNUS different from a regular website builder?</h3>
    <p style="font-size:16px;color:#6B7280;margin:0;line-height:1.7;">Generic builders give you a blank canvas. YPNUS gives you a fully-loaded mortgage website with local city pages, loan product pages, compliant copy, an AI agent, and SEO — all built for the specific markets you serve.</p>
  </div>

  <div style="padding:24px 0;">
    <h3 style="font-size:18px;font-weight:800;margin:0 0 10px;color:#111827;">How much does it cost?</h3>
    <p style="font-size:16px;color:#6B7280;margin:0;line-height:1.7;">See our full pricing on the <a href="PRICING_URL" style="color:#1565C0;font-weight:700;">Plans &amp; Pricing page</a>. We offer flexible plans for individual MLOs and teams. Start with a free site preview — no credit card needed.</p>
  </div>
</section>

<!-- ═══════════════════════════════════════════════════════
     FINAL CTA
════════════════════════════════════════════════════════ -->
<section class="yp-page" style="background:linear-gradient(135deg,#0D1B3E 0%,#1565C0 100%);padding:90px 24px;text-align:center;">
  <p style="font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.6);margin:0 0 14px;">FREE — No Account Required</p>
  <h2 style="font-size:clamp(28px,4.5vw,48px);font-weight:900;color:#fff;margin:0 auto 18px;max-width:700px;line-height:1.15;">Stop Letting Competitors Get Your Leads</h2>
  <p style="font-size:18px;color:rgba(255,255,255,.85);max-width:560px;margin:0 auto 36px;line-height:1.7;">See exactly what your MLO website could look like — personalized to your market, your loan types, and your niche. Ready in 30 seconds.</p>
  <a href="DEMO_URL" class="yp-btn-white" style="font-size:19px;padding:18px 44px;">&#9654;&nbsp; Build My Free Site Preview</a>
  <p style="font-size:13px;color:rgba(255,255,255,.5);margin:16px 0 0;">No email. No credit card. Just your personalized mortgage website plan.</p>
  <p style="font-size:13px;color:rgba(255,255,255,.4);margin:8px 0 0;">Already have a plan? <a href="PRICING_URL" style="color:rgba(255,255,255,.7);font-weight:700;text-decoration:underline;">View Pricing →</a></p>
</section>
<!-- /wp:html -->
HTML;

    // Replace URL placeholders
    $content = str_replace( 'DEMO_URL',    $demo_url,    $content );
    $content = str_replace( 'PRICING_URL', $pricing_url, $content );

    wp_update_post( [
        'ID'           => 1829,
        'post_title'   => 'MLO Websites Built by AI | YPNUS',
        'post_content' => $content,
    ] );

    update_option( 'ypnus_homepage_rewrite_done', '1.0.0', false );
}
