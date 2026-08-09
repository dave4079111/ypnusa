import fs from "fs";
import path from "path";
import type {
  DbShape,
  AppointmentRecord,
  AnalyticsEventRecord,
  BorrowerLeadRecord,
  CrmLeadRecord,
  DemoRequestRecord,
  IntakeSessionRecord,
  LoanOfficerRecord,
  LoAlertRecord,
  ScheduledFollowUpRecord,
} from "./types";

/**
 * Storage layer.
 *
 * The source of truth is an in-memory store held on the module scope. It is
 * hydrated once from disk (if a snapshot exists) and written through to disk on
 * every mutation on a best-effort basis.
 *
 * Why in-memory-first: on serverless hosts (e.g. Vercel) the application
 * directory is read-only, so file writes throw. Keeping state in memory means
 * multi-step flows (the intake chat posting several `tick`s) still work within a
 * warm instance even when disk persistence is unavailable. On a persistent Node
 * host (`next start`, a VPS, Docker) the disk snapshot additionally survives
 * restarts. Set `LOANPILOT_DATA_DIR` to a writable path to control where the
 * snapshot lives.
 */

/**
 * Resolve the data directory lazily (not at module scope) so bundlers don't
 * trace `process.cwd()` as a build-time filesystem dependency.
 */
let cachedDataDir: string | null = null;
function dataDir(): string {
  if (cachedDataDir) return cachedDataDir;
  const configured = process.env.LOANPILOT_DATA_DIR?.trim();
  if (configured) {
    cachedDataDir = configured;
    return cachedDataDir;
  }
  // Keep the data dir under ./data so NFT does not trace the whole repo.
  // Prefer resolve("data") over cwd()+join — Hostinger/standalone NFT treats
  // process.cwd() joins as whole-project traces even with turbopackIgnore.
  cachedDataDir = path.resolve(/*turbopackIgnore: true*/ "data");
  return cachedDataDir;
}
function dbPath(): string {
  return path.join(dataDir(), "store.json");
}

const defaultLoanOfficers: LoanOfficerRecord[] = [
  {
    id: "lo_jordan_lee",
    name: "Jordan Lee",
    email: "jordan.lee@loanapilot.ai",
    specialties: ["FHA", "VA", "REFI"],
    weeklyWindows: [
      { dow: 1, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 2, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 3, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 4, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 5, startMin: 9 * 60, endMin: 15 * 60 },
    ],
  },
  {
    id: "lo_priya_nandakumar",
    name: "Priya Nandakumar",
    email: "priya.n@loanapilot.ai",
    specialties: ["DSCR", "JUMBO"],
    weeklyWindows: [
      { dow: 1, startMin: 10 * 60, endMin: 18 * 60 },
      { dow: 2, startMin: 10 * 60, endMin: 18 * 60 },
      { dow: 3, startMin: 10 * 60, endMin: 18 * 60 },
      { dow: 4, startMin: 10 * 60, endMin: 18 * 60 },
      { dow: 5, startMin: 10 * 60, endMin: 16 * 60 },
    ],
  },
  {
    id: "lo_mateo_rosales",
    name: "Mateo Rosales",
    email: "mateo.r@loanapilot.ai",
    specialties: ["HELOC", "REFI", "FHA"],
    weeklyWindows: [
      { dow: 2, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 3, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 4, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 5, startMin: 9 * 60, endMin: 17 * 60 },
      { dow: 6, startMin: 10 * 60, endMin: 14 * 60 },
    ],
  },
];

const emptyDb = (): DbShape => ({
  loanOfficers: defaultLoanOfficers,
  sessions: [],
  borrowerLeads: [],
  crmLeads: [],
  loAlerts: [],
  followUps: [],
  appointments: [],
  analyticsEvents: [],
  demoRequests: [],
});

/** Fill in any missing collections so older snapshots stay forward-compatible. */
function normalize(parsed: DbShape): DbShape {
  parsed.loanOfficers =
    parsed.loanOfficers && parsed.loanOfficers.length > 0
      ? parsed.loanOfficers
      : defaultLoanOfficers;

  parsed.sessions ??= [];
  parsed.borrowerLeads ??= [];
  parsed.crmLeads ??= [];
  parsed.loAlerts ??= [];
  parsed.followUps ??= [];
  parsed.appointments ??= [];
  parsed.analyticsEvents ??= [];
  parsed.demoRequests ??= [];

  parsed.sessions = parsed.sessions.map((session) => ({
    ...session,
    status: session.status ?? "collecting",
  }));

  return parsed;
}

/** Process-scoped source of truth. */
let memoryDb: DbShape | null = null;
let diskWritable = true;

function ensureDataDir(): boolean {
  try {
    if (!fs.existsSync(dataDir())) {
      fs.mkdirSync(dataDir(), { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

function flushToDisk(db: DbShape): void {
  if (!diskWritable) return;
  if (!ensureDataDir()) {
    diskWritable = false;
    return;
  }
  try {
    // Write to a temp file and rename so a crash mid-write can't truncate the
    // snapshot (rename is atomic on the same filesystem).
    const target = dbPath();
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, target);
  } catch {
    // Read-only/serverless filesystem: keep serving from memory. Stop retrying
    // so we don't throw on every request.
    diskWritable = false;
  }
}

/** Hydrate the in-memory store from disk exactly once per process. */
function hydrate(): DbShape {
  if (memoryDb) return memoryDb;

  let snapshotUnreadable = false;
  try {
    if (fs.existsSync(dbPath())) {
      const parsed = JSON.parse(fs.readFileSync(dbPath(), "utf8")) as DbShape;
      memoryDb = normalize(parsed);
      return memoryDb;
    }
  } catch (error) {
    // Corrupt/unreadable snapshot: serve from memory but DO NOT overwrite the
    // file — preserve it for manual recovery.
    snapshotUnreadable = true;
    console.error(`[db] unreadable snapshot at ${dbPath()} — serving fresh store`, error);
  }

  memoryDb = emptyDb();
  if (!snapshotUnreadable) flushToDisk(memoryDb);
  return memoryDb;
}

export function ensureDataDirExists(): void {
  ensureDataDir();
}

export function readDb(): DbShape {
  // Return a deep clone so callers cannot accidentally mutate live state.
  return structuredClone(hydrate());
}

/**
 * Mutate the live in-memory store, then best-effort flush to disk.
 *
 * The mutator receives the process-scoped store (not a disposable clone).
 * Clone-then-replace RMW lets overlapping or nested writers drop each other's
 * updates (e.g. two demo-request reservations racing on the same ZIP).
 */
export function writeDb(mutator: (db: DbShape) => void): DbShape {
  const db = hydrate();
  mutator(db);
  flushToDisk(db);
  return structuredClone(db);
}

export function persistSession(session: IntakeSessionRecord): void {
  writeDb((db) => {
    const idx = db.sessions.findIndex((s) => s.id === session.id);
    if (idx >= 0) db.sessions[idx] = session;
    else db.sessions.push(session);
  });
}

export function appendBorrowerLead(lead: BorrowerLeadRecord): void {
  writeDb((db) => db.borrowerLeads.push(lead));
}

export function appendCrmLead(record: CrmLeadRecord): void {
  writeDb((db) => db.crmLeads.push(record));
}

export function appendLoAlert(record: LoAlertRecord): void {
  writeDb((db) => db.loAlerts.push(record));
}

export function appendFollowUp(record: ScheduledFollowUpRecord): void {
  writeDb((db) => db.followUps.push(record));
}

export function persistFollowUpsBatch(batch: ScheduledFollowUpRecord[]): void {
  writeDb((db) => {
    batch.forEach((followUp) => db.followUps.push(followUp));
  });
}

export function appendAppointment(record: AppointmentRecord): void {
  writeDb((db) => db.appointments.push(record));
}

export function appendDemoRequest(record: DemoRequestRecord): void {
  writeDb((db) => db.demoRequests.push(record));
}

/** Keep the analytics log bounded so it can't grow (and slow disk writes) forever. */
const MAX_ANALYTICS_EVENTS = 2000;

export function appendAnalytics(event: Omit<AnalyticsEventRecord, "id" | "createdAt">): void {
  writeDb((db) => {
    db.analyticsEvents.push({
      ...event,
      id: `evt_${Date.now()}_${db.analyticsEvents.length}`,
      createdAt: new Date().toISOString(),
    });
    if (db.analyticsEvents.length > MAX_ANALYTICS_EVENTS) {
      db.analyticsEvents.splice(0, db.analyticsEvents.length - MAX_ANALYTICS_EVENTS);
    }
  });
}

/** Exposed for diagnostics/health checks. */
export function storageMode(): { persistent: boolean; dir: string } {
  hydrate();
  return {
    persistent: diskWritable,
    dir: dataDir(),
  };
}
