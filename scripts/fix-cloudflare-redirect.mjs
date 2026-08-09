#!/usr/bin/env node
/**
 * List (and optionally delete) Cloudflare redirect rules that send
 * app.ypnus.com → ypnus.com.
 *
 * Requires CLOUDFLARE_API_TOKEN with Zone:Read (+ Zone:Edit to delete)
 * and either CLOUDFLARE_ZONE_ID or CLOUDFLARE_ZONE_NAME=ypnus.com.
 *
 * Usage:
 *   node scripts/fix-cloudflare-redirect.mjs list
 *   node scripts/fix-cloudflare-redirect.mjs delete
 */

const TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();
const ZONE_ID_ENV = process.env.CLOUDFLARE_ZONE_ID?.trim();
const ZONE_NAME = process.env.CLOUDFLARE_ZONE_NAME?.trim() || "ypnus.com";
const API = "https://api.cloudflare.com/client/v4";

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

async function cf(pathname, { method = "GET", body } = {}) {
  if (!TOKEN) die("CLOUDFLARE_API_TOKEN is not set.");
  const res = await fetch(`${API}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok || data.success === false) {
    die(`${method} ${pathname} failed:\n${JSON.stringify(data, null, 2)}`);
  }
  return data;
}

async function resolveZoneId() {
  if (ZONE_ID_ENV) return ZONE_ID_ENV;
  const data = await cf(`/zones?name=${encodeURIComponent(ZONE_NAME)}`);
  const zone = data.result?.[0];
  if (!zone) die(`No Cloudflare zone found for ${ZONE_NAME}`);
  return zone.id;
}

function mentionsAppRedirect(value) {
  const s = JSON.stringify(value).toLowerCase();
  return s.includes("app.ypnus.com") && s.includes("ypnus.com");
}

async function listRedirects(zoneId) {
  const out = [];
  // Modern Redirect Rules (Rulesets)
  try {
    const phase = await cf(
      `/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`,
    );
    for (const rule of phase.result?.rules || []) {
      if (mentionsAppRedirect(rule)) {
        out.push({ kind: "redirect_ruleset", id: rule.id, rule });
      }
    }
  } catch (e) {
    console.warn("Redirect ruleset lookup skipped:", String(e.message || e));
  }

  // Legacy Page Rules
  try {
    const pages = await cf(`/zones/${zoneId}/pagerules`);
    for (const rule of pages.result || []) {
      if (mentionsAppRedirect(rule)) {
        out.push({ kind: "page_rule", id: rule.id, rule });
      }
    }
  } catch (e) {
    console.warn("Page rules lookup skipped:", String(e.message || e));
  }

  // Bulk Redirect lists (best-effort)
  try {
    const lists = await cf(`/accounts?per_page=50`);
    for (const account of lists.result || []) {
      const bl = await cf(`/accounts/${account.id}/rules/lists?per_page=100`);
      for (const list of bl.result || []) {
        if (String(list.kind || "").includes("redirect") || mentionsAppRedirect(list)) {
          out.push({ kind: "bulk_list", accountId: account.id, id: list.id, list });
        }
      }
    }
  } catch {
    // Account token scope may not allow this; ignore.
  }

  return out;
}

const [cmd] = process.argv.slice(2);
const zoneId = await resolveZoneId();
const matches = await listRedirects(zoneId);
console.log(JSON.stringify({ zoneId, matches }, null, 2));

if (cmd === "delete") {
  if (!matches.length) {
    console.log("No matching Cloudflare redirect rules found.");
    process.exit(0);
  }
  for (const m of matches) {
    if (m.kind === "page_rule") {
      await cf(`/zones/${zoneId}/pagerules/${m.id}`, { method: "DELETE" });
      console.log("Deleted page rule", m.id);
    } else if (m.kind === "redirect_ruleset") {
      // Fetch full entrypoint, drop the matching rule, PUT remaining.
      const phase = await cf(
        `/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`,
      );
      const rules = (phase.result?.rules || []).filter((r) => r.id !== m.id);
      await cf(
        `/zones/${zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`,
        { method: "PUT", body: { rules } },
      );
      console.log("Removed redirect ruleset rule", m.id);
    } else {
      console.warn("Skipping automated delete for", m.kind, m.id, "— remove in dashboard.");
    }
  }
} else if (cmd && cmd !== "list") {
  die("Usage: node scripts/fix-cloudflare-redirect.mjs <list|delete>");
}
