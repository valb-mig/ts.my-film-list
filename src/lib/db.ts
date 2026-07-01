import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "data", "watchlist.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = createClient({ url: `file:${dbPath}` });

let initialized = false;

export async function ensureInit() {
  if (initialized) return;
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS watchlist (
        imdb_id    TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        year       INTEGER,
        poster_url TEXT,
        rating     REAL,
        added_at   INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE TABLE IF NOT EXISTS search_history (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        query       TEXT NOT NULL,
        searched_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE TABLE IF NOT EXISTS favorites (
        imdb_id    TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        year       INTEGER,
        poster_url TEXT,
        rating     REAL,
        added_at   INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE TABLE IF NOT EXISTS history_movies (
        history_id    INTEGER NOT NULL,
        imdb_id       TEXT NOT NULL,
        title         TEXT NOT NULL,
        year          INTEGER,
        poster_url    TEXT,
        type          TEXT,
        genres_json   TEXT,
        first_seen_at INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (history_id, imdb_id)
      )`,
    ],
    "write"
  );

  // Migration: add first_seen_at to existing tables that lack it
  try {
    await db.execute("ALTER TABLE history_movies ADD COLUMN first_seen_at INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — ignore
  }

  initialized = true;
}
