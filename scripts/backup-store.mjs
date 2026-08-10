import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.resolve(process.env.LOANPILOT_DATA_DIR?.trim() || "data");
const backupDir = path.resolve(
  process.env.LOANPILOT_BACKUP_DIR?.trim() || path.join(dataDir, "backups"),
);
const source = path.join(dataDir, "store.json");

async function validateSnapshot(file) {
  const parsed = JSON.parse(await fs.readFile(file, "utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Snapshot root must be a JSON object.");
  }
}

async function backup() {
  await validateSnapshot(source);
  await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const destination = path.join(backupDir, `store-${stamp}.json`);
  await fs.copyFile(source, destination);
  await fs.chmod(destination, 0o600);
  console.log(destination);
}

async function restore(file) {
  if (!file) throw new Error("Restore requires an explicit snapshot path.");
  const snapshot = path.resolve(file);
  await validateSnapshot(snapshot);
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  try {
    await fs.access(source);
    const safetyCopy = `${source}.before-restore-${Date.now()}`;
    await fs.copyFile(source, safetyCopy);
    await fs.chmod(safetyCopy, 0o600);
  } catch {
    // There is no current snapshot to preserve.
  }
  const temporary = `${source}.${process.pid}.restore`;
  await fs.copyFile(snapshot, temporary);
  await fs.chmod(temporary, 0o600);
  await fs.rename(temporary, source);
  console.log(source);
}

const [command = "backup", file] = process.argv.slice(2);
if (command === "backup") await backup();
else if (command === "restore") await restore(file);
else throw new Error(`Unknown command: ${command}`);
