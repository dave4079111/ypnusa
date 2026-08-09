#!/usr/bin/env node
/**
 * Deploy the Next.js app to Hostinger Cloud (Node.js web apps).
 *
 * Requires HOSTINGER_API_TOKEN (hPanel → API).
 * Uses the Hostinger file upload (TUS) + Node.js builds API — the multipart
 * from-archive shortcut is blocked by Cloudflare on this account.
 *
 * Usage:
 *   node scripts/deploy-hostinger.mjs list
 *   node scripts/deploy-hostinger.mjs deploy-next [domain]
 *   node scripts/deploy-hostinger.mjs status [domain]
 *   node scripts/deploy-hostinger.mjs logs <domain> <build-uuid>
 *   node scripts/deploy-hostinger.mjs fix-htaccess [domain]
 *   node scripts/deploy-hostinger.mjs dns [domain]
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let tus;
try {
  tus = require("tus-js-client");
} catch {
  tus = null;
}

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

async function api(pathname, { method = "GET", body } = {}) {
  if (!TOKEN) die("HOSTINGER_API_TOKEN is not set.");
  const headers = {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/json",
    "User-Agent": "ypnusa-deploy-hostinger/1.0",
  };
  let payload;
  if (body !== undefined) {
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
    const preview =
      typeof data === "string"
        ? data.slice(0, 500)
        : JSON.stringify(data, null, 2);
    die(`${method} ${pathname} → ${res.status}\n${preview}`);
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
      `Website matched but no account username found.\n${JSON.stringify(hit, null, 2)}`,
    );
  }
  return { site: hit, username, domain };
}

function ensureTus() {
  if (tus) return tus;
  console.log("Installing tus-js-client…");
  const r = spawnSync("npm", ["install", "--no-save", "tus-js-client@4"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) die("Failed to install tus-js-client");
  tus = require("tus-js-client");
  return tus;
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

async function uploadFile(domain, localPath, remoteName = path.basename(localPath)) {
  const client = ensureTus();
  const { username } = await resolveWebsite(domain);
  const creds = await api("/api/hosting/v1/files/upload-urls", {
    method: "POST",
    body: { username, domain },
  });
  const uploadUrl = String(creds.url).replace(/\/$/, "");
  const target = `${uploadUrl}/${remoteName}?override=true`;
  const stats = fs.statSync(localPath);
  const headers = {
    "X-Auth": creds.auth_key,
    "X-Auth-Rest": creds.rest_auth_key,
    "upload-length": String(stats.size),
    "upload-offset": "0",
  };
  const pre = await fetch(target, { method: "POST", headers, body: "" });
  if (pre.status !== 201) {
    die(`Pre-upload failed ${pre.status}: ${(await pre.text()).slice(0, 300)}`);
  }
  await new Promise((resolve, reject) => {
    const upload = new client.Upload(fs.createReadStream(localPath), {
      uploadUrl: target,
      retryDelays: [1000, 2000, 4000, 8000],
      uploadDataDuringCreation: false,
      parallelUploads: 1,
      chunkSize: 10485760,
      headers,
      removeFingerprintOnSuccess: true,
      uploadSize: stats.size,
      metadata: { filename: remoteName },
      onError: reject,
      onProgress: (sent, total) => {
        process.stdout.write(`\rupload ${remoteName} ${sent}/${total}`);
      },
      onSuccess: () => {
        process.stdout.write("\n");
        resolve();
      },
    });
    upload.start();
  });
  return { creds, remoteName, username };
}

async function deployNext(domain = DEFAULT_DOMAIN) {
  const { username } = await resolveWebsite(domain);
  const archivePath = makeArchive();
  const archiveBasename = path.basename(archivePath);
  console.log(`Uploading ${archiveBasename} to ${domain}…`);
  await uploadFile(domain, archivePath, archiveBasename);

  console.log("Resolving build settings…");
  const settings = await api(
    `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/builds/settings/from-archive?archive_path=${encodeURIComponent(archiveBasename)}`,
  );
  const buildData = {
    ...settings,
    node_version: settings?.node_version || 20,
    build_script: settings?.build_script || "build",
    output_directory: settings?.output_directory || ".next",
    package_manager: settings?.package_manager || "npm",
    app_type: settings?.app_type || "next",
    source_type: "archive",
    source_options: { archive_path: archiveBasename },
  };
  console.log("Triggering build…");
  const result = await api(
    `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/builds`,
    { method: "POST", body: buildData },
  );
  console.log(JSON.stringify(result, null, 2));
  const uuid = result?.uuid || result?.data?.uuid;
  if (uuid) {
    console.log(`\nPolling build ${uuid} …`);
    await pollBuild(username, domain, uuid);
  }

  console.log("Removing stale homepage → ypnus.com .htaccess redirect (if present)…");
  try {
    await fixHtaccess(domain);
  } catch (e) {
    console.warn("fix-htaccess skipped:", e.message || e);
  }

  await api(
    `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/server/restart`,
    { method: "POST" },
  );

  console.log(
    "\nSet these env vars in hPanel → Node.js app → Environment if not already set:\n" +
      Object.entries(APP_ENV)
        .map(([k, v]) => `  ${k}=${v}`)
        .join("\n"),
  );
  console.log(`\nLive check: curl -sI https://${domain}/ | head`);
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
  const content = data?.logs ?? data?.content ?? data?.data?.content ?? "";
  if (typeof content === "string" && content) {
    process.stdout.write(content.endsWith("\n") ? content : `${content}\n`);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
  return data;
}

async function pollBuild(username, domain, uuid, { timeoutMs = 14 * 60 * 1000 } = {}) {
  const started = Date.now();
  let prev = "";
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
        `/api/hosting/v1/accounts/${encodeURIComponent(username)}/websites/${encodeURIComponent(domain)}/nodejs/builds/${encodeURIComponent(uuid)}/logs`,
      );
      const content = logs?.logs ?? logs?.content ?? logs?.data?.content ?? "";
      if (typeof content === "string" && content && content !== prev) {
        process.stdout.write(content.startsWith(prev) ? content.slice(prev.length) : content);
        prev = content;
      }
    } catch {
      // logs may 404 briefly while queued
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

async function fileBrowser(domain) {
  const { username } = await resolveWebsite(domain);
  const creds = await api("/api/hosting/v1/files/upload-urls", {
    method: "POST",
    body: { username, domain },
  });
  const base = String(creds.url).match(/^(https:\/\/[^/]+\/rest\/[^/]+)/)?.[1];
  if (!base) die(`Unexpected upload URL: ${creds.url}`);
  return {
    creds,
    base,
    headers: { "X-Auth": creds.auth_key, "X-Auth-Rest": creds.rest_auth_key },
  };
}

async function fixHtaccess(domain = DEFAULT_DOMAIN) {
  const { base, headers } = await fileBrowser(domain);
  const res = await fetch(`${base}/api/raw/.htaccess`, { headers });
  if (!res.ok) die(`Could not read .htaccess (${res.status})`);
  const original = await res.text();
  if (!/RewriteRule \^\$ https:\/\/ypnus\.com\//.test(original)) {
    console.log("No homepage→ypnus.com redirect found in .htaccess.");
    return;
  }
  const fixed = original
    .replace(
      /# Brand marketing lives on ypnus\.com[^\n]*\nRewriteRule \^\$ https:\/\/ypnus\.com\/ \[R=301,L\]\nRewriteRule \^index\\\.html\$ https:\/\/ypnus\.com\/ \[R=301,L\]\n?/m,
      "# Homepage served by Next.js Node app (Passenger) — do not redirect to ypnus.com.\n\n",
    )
    .replace(/RewriteRule \^\$ https:\/\/ypnus\.com\/ \[R=301,L\]\n?/g, "")
    .replace(/RewriteRule \^index\\\.html\$ https:\/\/ypnus\.com\/ \[R=301,L\]\n?/g, "");
  const tmp = path.join("/tmp", `htaccess-fixed-${Date.now()}`);
  fs.writeFileSync(tmp, fixed);
  await uploadFile(domain, tmp, ".htaccess");
  fs.unlinkSync(tmp);
  console.log("Updated .htaccess — homepage redirect removed.");
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
  case "fix-htaccess":
    await fixHtaccess(arg || DEFAULT_DOMAIN);
    break;
  case "dns":
    await showDns(arg || "ypnus.com");
    break;
  default:
    die(
      "Usage: node scripts/deploy-hostinger.mjs <list|deploy-next|status|logs|fix-htaccess|dns> [args]\n" +
        "Requires HOSTINGER_API_TOKEN.",
    );
}
