/**
 * Runs once each time the hosted app boots, before the web server starts.
 *
 * Its only job is to make sure the database exists and has the 195 markets in
 * it. On a brand-new host the mounted disk is empty, so this loads the markets
 * and scoring configuration from the committed source workbook. On every
 * restart after that it finds the data already there and does nothing, so no
 * work anyone has done is ever overwritten.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const DB_PATH = process.env.DATABASE_PATH?.trim()
  ? path.resolve(process.env.DATABASE_PATH.trim())
  : path.join(process.cwd(), "data", "app.db");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

function marketCount() {
  if (!fs.existsSync(DB_PATH)) return 0;
  const db = new Database(DB_PATH, { readonly: true });
  try {
    return db.prepare(`SELECT COUNT(*) AS n FROM markets`).get().n;
  } catch {
    return 0; // table does not exist yet
  } finally {
    db.close();
  }
}

const existing = marketCount();
if (existing > 0) {
  console.log(`[startup] Database ready at ${DB_PATH} — ${existing} markets already loaded.`);
} else {
  console.log(`[startup] Empty database at ${DB_PATH} — loading markets from the source workbook.`);
  const result = spawnSync(process.execPath, ["scripts/import-workbook.mjs"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_PATH: DB_PATH },
  });
  if (result.status !== 0) {
    console.error("[startup] Could not load the source workbook. The app will still start, but");
    console.error("[startup] the Markets pages will be empty until this is fixed.");
  }
}
