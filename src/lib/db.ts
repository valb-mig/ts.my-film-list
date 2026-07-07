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
      `CREATE TABLE IF NOT EXISTS watched (
        imdb_id    TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        year       INTEGER,
        poster_url TEXT,
        watched_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE TABLE IF NOT EXISTS lists (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      )`,
      `CREATE TABLE IF NOT EXISTS list_items (
        list_id    INTEGER NOT NULL,
        imdb_id    TEXT NOT NULL,
        title      TEXT NOT NULL,
        year       INTEGER,
        poster_url TEXT,
        rating     REAL,
        added_at   INTEGER NOT NULL DEFAULT (unixepoch()),
        PRIMARY KEY (list_id, imdb_id)
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

  // Migration: add duration_min, filled in lazily when the user opens a movie's detail
  try {
    await db.execute("ALTER TABLE history_movies ADD COLUMN duration_min INTEGER");
  } catch {
    // Column already exists — ignore
  }

  // Migration: the single `watchlist` table is replaced by named lists (`lists` + `list_items`).
  // Runs once — moves any existing watchlist rows into a default "Minha Lista" and empties the
  // old table so this block is a no-op on subsequent boots.
  const listsCount = await db.execute("SELECT COUNT(*) as c FROM lists");
  if (Number(listsCount.rows[0]?.c ?? 0) === 0) {
    const oldRows = await db.execute("SELECT * FROM watchlist");
    if (oldRows.rows.length > 0) {
      const defaultList = await db.execute({
        sql: "INSERT INTO lists (name) VALUES (?)",
        args: ["Minha Lista"],
      });
      const defaultListId = Number(defaultList.lastInsertRowid);
      await db.batch(
        oldRows.rows.map((r) => ({
          sql: `INSERT OR IGNORE INTO list_items (list_id, imdb_id, title, year, poster_url, rating, added_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [defaultListId, r.imdb_id, r.title, r.year, r.poster_url, r.rating, r.added_at],
        })),
        "write"
      );
      await db.execute("DELETE FROM watchlist");
    }
  }

  initialized = true;
}
