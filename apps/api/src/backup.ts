import path from "node:path";
import { mkdirSync } from "node:fs";
import { Cron } from "croner";
import { sqlite } from "./db/client.js";
import { DATA_DIR } from "./db/paths.js";

const BACKUPS_DIR = path.join(DATA_DIR, "backups");

function runBackup() {
  mkdirSync(BACKUPS_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const target = path.join(BACKUPS_DIR, `plantapp-${date}.db`);
  // VACUUM INTO erzeugt immer einen konsistenten Snapshot, auch während des
  // laufenden WAL-Betriebs — im Gegensatz zum bloßen Kopieren der .db-Datei.
  sqlite.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
}

export function startBackupSchedule() {
  // Basis-Backup, vorgezogen aus M6: noch ohne Generationen-Rotation und ohne
  // Restore-Test — nur Absicherung gegen ein Datenverlust-Fenster ab M1.
  new Cron("0 3 * * *", runBackup);
}
