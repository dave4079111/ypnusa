import fs from "fs";
import path from "path";
import type {
  DbShape,
  AppointmentRecord,
  AnalyticsEventRecord,
  BorrowerLeadRecord,
  CrmLeadRecord,
  IntakeSessionRecord,
  LoanOfficerRecord,
  LoAlertRecord,
  ScheduledFollowUpRecord,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "store.json");

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
});

export function ensureDataDir(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {
    // ignore mkdir errors in ephemeral environments without write access
  }
}

export function readDb(): DbShape {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    const fresh = emptyDb();
    writeDbMutable(fresh);
    return structuredClone(fresh);
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DbShape;

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

    parsed.sessions = parsed.sessions.map((session) => ({
      ...session,
      status: session.status ?? "collecting",
    }));

    return structuredClone(parsed);
  } catch {
    const fresh = emptyDb();
    writeDbMutable(fresh);
    return structuredClone(fresh);
  }
}

function writeDbMutable(db: DbShape): void {
  ensureDataDir();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  } catch {
    // allow read-only deployments to keep in-memory clones per request unreliable
    // callers should tolerate missing persistence
  }
}

export function writeDb(mutator: (db: DbShape) => void): DbShape {
  const db = readDb();
  mutator(db);
  writeDbMutable(db);
  return db;
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

export function appendAnalytics(event: Omit<AnalyticsEventRecord, "id" | "createdAt">): void {
  writeDb((db) => {
    db.analyticsEvents.push({
      ...event,
      id: `evt_${Date.now()}_${db.analyticsEvents.length}`,
      createdAt: new Date().toISOString(),
    });
  });
}
