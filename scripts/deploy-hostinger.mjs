#!/usr/bin/env node
/**
 * Deploy helpers for ypnus.com / app.ypnus.com on Hostinger.
 *
 * Requires HOSTINGER_API_TOKEN (hPanel → API).
 *
 * Usage:
 *   node scripts/deploy-hostinger.mjs list
 *   node scripts/deploy-hostinger.mjs deploy-next [domain]
 *   node scripts/deploy-hostinger.mjs dns [domain]
 *
 * Notes:
 * - app.ypnus.com currently 301s to ypnus.com via Cloudflare. Remove that
 *   redirect before expecting the app homepage to serve.
 * - Custom WP plugins (wp-plugins/ypnus-seo-hygiene.zip) must be uploaded via
 *   File Manager / SFTP; the plugins/install API only accepts wp.org slugs.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = "https://developers.hostinger.com";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.HOSTINGER_API_TOKEN?.trim();

function die(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

async function api(pathname, { method = "GET", body, formData } = {}) {
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
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    die(`${method} ${pathname} → ${res.status}\n${typeof data === "string" ? data : JSON.stringify(data, null, 2)}`);
  }
  return data;
}

async function listWebsites() {
  const data = await api("/api/hosting/v1/websites");
  console.log(JSON.stringify(data, null, 2));
  return data;
}

function findWebsite(list, domain) {
  const items = Array.isArray(list) ? list : list?.data || list?.websites || [];
  const hit = items.find((w) => {
    const d = w.domain || w.vhost || w.name || "";
    return d === domain || d.endsWith(`.${domain}`) || domain.endsWith(d);
  });
  if (!hit) die(`No Hostinger website matched domain ${domain}. Run: list`);
  return hit;
}

function makeArchive() {
  const out = path.join("/tmp", `ypnusa-next-${Date.now()}.zip`);
  const excludes = [
    "node_modules/*",
    ".git/*",
    ".next/*",
    "data/store.json",
    "*.zip",
    ".env*",
    "ypn-ai-*.html",
    "borrower-intake-widget.html",
    "dashboard.html",
  ];
  const args = ["-r", out, ".", ...excludes.flatMap((e) => ["-x", e])];
  const r = spawnSync("zip", args, { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) die("Failed to create project archive (is zip installed?).");
  const sizeMb = fs.statSync(out).size / (1024 * 1024);
  if (sizeMb > 49) die(`Archive is ${sizeMb.toFixed(1)}MB; Hostinger limit is 50MB.`);
  console.log(`Archive: ${out} (${sizeMb.toFixed(1)} MB)`);
  return out;
}

async function deployNext(domain = "app.ypnus.com") {
  const websites = await listWebsites();
  const site = findWebsite(websites, domain);
  const username = site.username || site.account_username || site.login || site.user;
  if (!username) {
    die(
      `Website matched but no account username found. Inspect list output and set HOSTINGER_USERNAME.\n${JSON.stringify(site, null, 2)}`,
    );
  }
  const archivePath = makeArchive();
  const archiveB64 = fs.readFileSync(archivePath).toString("base64");
  console.log(`Starting Node.js build for ${username}/${domain} …`);
  const result = await api(
    `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/builds/from-archive`,
    {
      method: "POST",
      body: {
        archive: archiveB64,
        node_version: 22,
        // Hostinger auto-detects Next; enum historically lagged the docs.
        build_script: "build",
        output_directory: ".next",
        package_manager: "npm",
      },
    },
  );
  console.log(JSON.stringify(result, null, 2));
  console.log(
    "\nSet these env vars in hPanel for the Node app, then redeploy if needed:\n" +
      "  NEXT_PUBLIC_SITE_URL=https://app.ypnus.com\n" +
      "  NEXT_PUBLIC_MARKETING_SITE_URL=https://ypnus.com\n" +
      "  YPNUS_WP_API_BASE=https://ypnus.com/wp-json/ypnus/v1\n" +
      "  LOANPILOT_DATA_DIR=/tmp/ypnus-data",
  );
}

async function showDns(domain = "ypnus.com") {
  const data = await api(`/api/dns/v1/zones/${encodeURIComponent(domain)}`);
  console.log(JSON.stringify(data, null, 2));
}

const [cmd, arg] = process.argv.slice(2);
switch (cmd) {
  case "list":
    await listWebsites();
    break;
  case "deploy-next":
    await deployNext(arg || "app.ypnus.com");
    break;
  case "dns":
    await showDns(arg || "ypnus.com");
    break;
  default:
    die(
      "Usage: node scripts/deploy-hostinger.mjs <list|deploy-next|dns> [domain]\n" +
        "Requires HOSTINGER_API_TOKEN.",
    );
}
