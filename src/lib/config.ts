const MIN_SECRET_BYTES = 32;

function configured(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function strongSecret(name: string): boolean {
  const value = process.env[name]?.trim();
  return Boolean(value && Buffer.byteLength(value) >= MIN_SECRET_BYTES);
}

function httpsUrl(name: string): boolean {
  const value = process.env[name]?.trim();
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function productionCalendarsConfigured(): boolean {
  const raw = process.env.MLO_CALENDAR_CONFIG_JSON?.trim();
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      { provider?: string; calendarId?: string; calendlyUrl?: string }
    >;
    const connections = Object.values(parsed);
    return (
      connections.length > 0 &&
      connections.every((connection) => {
        if (connection.provider === "google") {
          return Boolean(connection.calendarId && configured("GOOGLE_CALENDAR_ACCESS_TOKEN"));
        }
        if (connection.provider === "microsoft") {
          return Boolean(connection.calendarId && configured("MICROSOFT_GRAPH_ACCESS_TOKEN"));
        }
        if (connection.provider === "calendly") {
          try {
            return new URL(connection.calendlyUrl ?? "").protocol === "https:";
          } catch {
            return false;
          }
        }
        return false;
      })
    );
  } catch {
    return false;
  }
}

function embedOriginsConfigured(): boolean {
  const values = process.env.EMBED_ALLOWED_ORIGINS?.split(",") ?? [];
  return (
    values.length > 0 &&
    values.every((candidate) => {
      try {
        return new URL(candidate.trim()).protocol === "https:";
      } catch {
        return false;
      }
    })
  );
}

export interface ProductionReadiness {
  ready: boolean;
  missing: string[];
  integrations: {
    sso: boolean;
    leadWebhook: boolean;
    entitlementSync: boolean;
    outreach: boolean;
    scheduler: boolean;
    persistentStorage: boolean;
    sharedRateLimit: boolean;
    calendar: boolean;
    bookingTokens: boolean;
    reviews: boolean;
    embeds: boolean;
    demoSafe: boolean;
    crmMirror: boolean;
    trustedProxy: boolean;
  };
}

export function productionReadiness(): ProductionReadiness {
  const missing: string[] = [];
  const requireCheck = (condition: boolean, name: string) => {
    if (!condition) missing.push(name);
  };

  requireCheck(httpsUrl("NEXT_PUBLIC_SITE_URL"), "NEXT_PUBLIC_SITE_URL");
  requireCheck(httpsUrl("NEXT_PUBLIC_MARKETING_SITE_URL"), "NEXT_PUBLIC_MARKETING_SITE_URL");
  requireCheck(strongSecret("SSO_JWT_SECRET"), "SSO_JWT_SECRET");
  requireCheck(configured("SSO_JWT_ISSUER"), "SSO_JWT_ISSUER");
  requireCheck(configured("SSO_JWT_AUDIENCE"), "SSO_JWT_AUDIENCE");
  requireCheck(httpsUrl("SSO_ALLOWED_ORIGIN"), "SSO_ALLOWED_ORIGIN");
  requireCheck(strongSecret("MLO_LEAD_WEBHOOK_SECRET"), "MLO_LEAD_WEBHOOK_SECRET");
  requireCheck(strongSecret("ENTITLEMENT_SYNC_SECRET"), "ENTITLEMENT_SYNC_SECRET");
  requireCheck(strongSecret("ADMIN_TOKEN"), "ADMIN_TOKEN");
  requireCheck(strongSecret("CRON_SECRET"), "CRON_SECRET");
  requireCheck(strongSecret("BOOKING_TOKEN_SECRET"), "BOOKING_TOKEN_SECRET");
  requireCheck(configured("LOANPILOT_DATA_DIR"), "LOANPILOT_DATA_DIR");
  requireCheck(httpsUrl("UPSTASH_REDIS_REST_URL"), "UPSTASH_REDIS_REST_URL");
  requireCheck(configured("UPSTASH_REDIS_REST_TOKEN"), "UPSTASH_REDIS_REST_TOKEN");
  const trustedProxy = ["cloudflare", "hostinger", "render"].includes(
    process.env.TRUSTED_PROXY_MODE?.trim().toLowerCase() ?? "",
  );
  requireCheck(trustedProxy, "TRUSTED_PROXY_MODE");
  requireCheck(productionCalendarsConfigured(), "MLO_CALENDAR_CONFIG_JSON");
  const reviewsConfigured =
    strongSecret("REVIEW_REQUEST_API_SECRET") &&
    configured("GBP_PLACE_ID") &&
    httpsUrl("REVIEW_REQUEST_WEBHOOK_URL");
  requireCheck(reviewsConfigured, "REVIEW_AUTOMATION");
  requireCheck(embedOriginsConfigured(), "EMBED_ALLOWED_ORIGINS");
  const demoSafe =
    process.env.LOANPILOT_DEMO_MODE !== "1" &&
    !process.env.LOANPILOT_DEMO_DAY_MINUTES?.trim();
  requireCheck(demoSafe, "DEMO_FLAGS_DISABLED");

  const genericOutreach =
    httpsUrl("OUTREACH_WEBHOOK_URL") && strongSecret("OUTREACH_WEBHOOK_TOKEN");
  const directOutreach =
    configured("TWILIO_ACCOUNT_SID") &&
    configured("TWILIO_AUTH_TOKEN") &&
    configured("TWILIO_FROM_NUMBER") &&
    configured("SENDGRID_API_KEY") &&
    configured("SENDGRID_FROM_EMAIL");
  requireCheck(genericOutreach || directOutreach, "OUTREACH_PROVIDER");
  const crmMirror =
    httpsUrl("INTAKE_EXTERNAL_WEBHOOK_URL") &&
    strongSecret("INTAKE_EXTERNAL_WEBHOOK_TOKEN");
  requireCheck(crmMirror, "INTAKE_EXTERNAL_WEBHOOK");

  return {
    ready: missing.length === 0,
    missing,
    integrations: {
      sso:
        strongSecret("SSO_JWT_SECRET") &&
        configured("SSO_JWT_ISSUER") &&
        configured("SSO_JWT_AUDIENCE") &&
        httpsUrl("SSO_ALLOWED_ORIGIN"),
      leadWebhook: strongSecret("MLO_LEAD_WEBHOOK_SECRET"),
      entitlementSync: strongSecret("ENTITLEMENT_SYNC_SECRET"),
      outreach: genericOutreach || directOutreach,
      scheduler: strongSecret("CRON_SECRET"),
      persistentStorage: configured("LOANPILOT_DATA_DIR"),
      sharedRateLimit:
        httpsUrl("UPSTASH_REDIS_REST_URL") &&
        configured("UPSTASH_REDIS_REST_TOKEN"),
      calendar: productionCalendarsConfigured(),
      bookingTokens: strongSecret("BOOKING_TOKEN_SECRET"),
      reviews: reviewsConfigured,
      embeds: embedOriginsConfigured(),
      demoSafe,
      crmMirror,
      trustedProxy,
    },
  };
}
