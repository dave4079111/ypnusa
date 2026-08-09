#!/usr/bin/env node
/**
 * Deploy the Next.js app to Hostinger Cloud (Node.js web apps).
 *
 * Requires HOSTINGER_API_TOKEN (hPanel → API).
 *
 * Usage:
 *   node scripts/deploy-hostinger.mjs list
 *   node scripts/deploy-hostinger.mjs deploy-next [domain]
 *   node scripts/deploy-hostinger.mjs status [domain]
 *   node scripts/deploy-hostinger.mjs logs <domain> <build-uuid>
 *   node scripts/deploy-hostinger.mjs dns [domain]
 *
 * Notes:
 * - Target product host is app.ypnus.com (WordPress stays on ypnus.com).
 * - app.ypnus.com currently 301s to ypnus.com via Cloudflare — remove that
 *   redirect (see scripts/fix-cloudflare-redirect.mjs) before expecting the
 *   app homepage to serve.
 * - The domain must already be a website slot on the Cloud plan. For a fresh
 *   Node.js slot: hPanel → Websites → Add Website → Node.js web app.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Blob } from "node:buffer";

const API = "https://developers.hostinger.com";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.HOSTINGER_API_TOKEN?.trim();
const DEFAULT_DOMAIN = process.env.HOSTINGER_DEPLOY_DOMAIN?.trim() || "app.ypnus.com";

const APP_ENV = {
  NEXT_PUBLIC_SITE_URL: "https://app.ypnus.com",
  NEXT_PUBLIC_MARKETING_SITE_URL: "https://ypnus.com",
  YPNUS_WP_API_BASE: "https://ypnus.com/wp-json/ypnus/v1",
  LOANPILOT_DATA_DIR: "/tmp/ypnus-data",
};

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

async function api(pathname, { method = "GET", body, formData, raw = false } = {}) {
  if (!TOKEN) die("HOSTINGER_API_TOKEN is not set.");
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/json",
  };
  let payload;
  if (formData) {
    payload = formData;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${API}${pathname}`, { method, headers, body: payload });
  if (raw) return res;
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    die(
      `${method} ${pathname} → ${res.status}\n${
        typeof data === "string" ? data : JSON.stringify(data, null, 2)
      }`,
    );
  }
  return data;
}

function websitesFrom(list) {
  return Array.isArray(list) ? list : list?.data || list?.websites || [];
}

async function listWebsites(domain) {
  const qs = domain ? `?domain=${encodeURIComponent(domain)}` : "";
  const data = await api(`/api/hosting/v1/websites${qs}`);
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function resolveWebsite(domain) {
  const data = await api(`/api/hosting/v1/websites?domain=${encodeURIComponent(domain)}`);
  const items = websitesFrom(data);
  const hit =
    items.find((w) => (w.domain || w.vhost || w.name || "") === domain) || items[0];
  if (!hit) die(`No Hostinger website matched domain ${domain}. Run: list`);
  const username =
    process.env.HOSTINGER_USERNAME?.trim() ||
    hit.username ||
    hit.account_username ||
    hit.login ||
    hit.user;
  if (!username) {
    die(
      `Website matched but no account username found. Inspect list output and set HOSTINGER_USERNAME.\n${JSON.stringify(hit, null, 2)}`,
    );
  }
  return { site: hit, username, domain };
}

function makeArchive() {
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const out = path.join("/tmp", `ypnusa-next_${stamp}.zip`);
  const excludes = [
    "node_modules/*",
    ".git/*",
    ".next/*",
    "data/store.json",
    "*.zip",
    ".env",
    ".env.*",
    "ypn-ai-*.html",
    "borrower-intake-widget.html",
    "dashboard.html",
    "core",
    ".cursor/*",
    "coverage/*",
  ];
  const args = ["-r", out, ".", ...excludes.flatMap((e) => ["-x", e])];
  const r = spawnSync("zip", args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) die("Failed to create project archive (is zip installed?).");
  const sizeMb = fs.statSync(out).size / (1024 * 1024);
  if (sizeMb > 49) die(`Archive is ${sizeMb.toFixed(1)}MB; Hostinger limit is 50MB.`);
  console.log(`Archive: ${out} (${sizeMb.toFixed(1)} MB)`);
  return out;
}

async function deployNext(domain = DEFAULT_DOMAIN) {
  const { username } = await resolveWebsite(domain);
  const archivePath = makeArchive();
  const bytes = fs.readFileSync(archivePath);
  const form = new FormData();
  form.append(
    "archive",
    new Blob([bytes], { type: "application/zip" }),
    path.basename(archivePath),
  );
  form.append("node_version", "22");
  form.append("build_script", "build");
  form.append("output_directory", ".next");
  form.append("package_manager", "npm");
  // Do not send app_type: API enum historically omits "next"; auto-detect from package.json.

  console.log(`Starting Node.js build for ${username}/${domain} …`);
  const result = await api(
    `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/builds/from-archive`,
    { method: "POST", formData: form },
  );
  console.log(JSON.stringify(result, null, 2));

  const uuid = result?.uuid || result?.data?.uuid || result?.build?.uuid;
  if (uuid) {
    console.log(`\nPolling build ${uuid} …`);
    await pollBuild(username, domain, uuid);
  }

  console.log(
    "\nSet these env vars in hPanel → Node.js app → Environment, then Restart:\n" +
      Object.entries(APP_ENV)
        .map(([k, v]) => `  ${k}=${v}`)
        .join("\n"),
  );
  console.log(
    "\nAlso remove the Cloudflare redirect app.ypnus.com → ypnus.com if still active:\n" +
      "  node scripts/fix-cloudflare-redirect.mjs list\n" +
      "  node scripts/fix-cloudflare-redirect.mjs delete",
  );
}

async function listBuilds(domain = DEFAULT_DOMAIN) {
  const { username } = await resolveWebsite(domain);
  const data = await api(
    `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/builds?per_page=10`,
  );
  console.log(JSON.stringify(data, null, 2));
  return data;
}

async function getLogs(domain, uuid, fromLine = 0) {
  const { username } = await resolveWebsite(domain);
  const qs = fromLine ? `?from_line=${fromLine}` : "";
  const data = await api(
    `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/builds/${encodeURIComponent(uuid)}/logs${qs}`,
  );
  const lines = data?.lines ?? data?.data?.lines;
  const content = data?.content ?? data?.data?.content ?? data?.log ?? "";
  if (typeof content === "string" && content) process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
  else console.log(JSON.stringify(data, null, 2));
  return { lines, data };
}

async function pollBuild(username, domain, uuid, { timeoutMs = 14 * 60 * 1000 } = {}) {
  const started = Date.now();
  let fromLine = 0;
  while (Date.now() - started < timeoutMs) {
    const list = await api(
      `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/builds?per_page=20`,
    );
    const items = websitesFrom(list);
    const build = items.find((b) => b.uuid === uuid || b.id === uuid);
    const state = build?.state || build?.status || "unknown";
    process.stderr.write(`build state: ${state}\n`);

    try {
      const logs = await api(
        `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/builds/${encodeURIComponent(uuid)}/logs?from_line=${fromLine}`,
      );
      const content = logs?.content ?? logs?.data?.content ?? "";
      if (content) process.stdout.write(content);
      if (typeof logs?.lines === "number") fromLine = logs.lines;
      else if (typeof logs?.data?.lines === "number") fromLine = logs.data.lines;
    } catch {
      // logs may 404 briefly while the build is queued
    }

    if (state === "completed" || state === "success") {
      console.log("\nBuild completed.");
      return build;
    }
    if (state === "failed" || state === "error") {
      die("\nBuild failed. Inspect logs above or run: logs <domain> <uuid>");
    }
    await new Promise((r) => setTimeout(r, 8000));
  }
  die("Timed out waiting for Hostinger build.");
}

async function showDns(domain = "ypnus.com") {
  const data = await api(`/api/dns/v1/zones/${encodeURIComponent(domain)}`);
  console.log(JSON.stringify(data, null, 2));
}

const [cmd, arg, arg2] = process.argv.slice(2);
switch (cmd) {
  case "list":
    await listWebsites(arg);
    break;
  case "deploy-next":
    await deployNext(arg || DEFAULT_DOMAIN);
    break;
  case "status":
    await listBuilds(arg || DEFAULT_DOMAIN);
    break;
  case "logs":
    if (!arg || !arg2) die("Usage: logs <domain> <build-uuid>");
    await getLogs(arg, arg2);
    break;
  case "dns":
    await showDns(arg || "ypnus.com");
    break;
  default:
    die(
      "Usage: node scripts/deploy-hostinger.mjs <list|deploy-next|status|logs|dns> [args]\n" +
        "Requires HOSTINGER_API_TOKEN.",
    );
}
