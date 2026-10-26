import { createClient } from "@libsql/client";
import path from "path";
import fs from "fs";

const dbPath = path.join(process.cwd(), "data", "watchlist.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = createClient({ url: `file:${dbPath}` });

let initialized = false;

export async function ensureInit() {
  if (initialized) return;
  // Only what the user saves on purpose lives here: favorites and named lists. Everything else
  // (metadata, search) comes live from the data source.
  await db.batch(
    [
      `CREATE TABLE IF NOT EXISTS favorites (
        imdb_id    TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        year       INTEGER,
        poster_url TEXT,
        rating     REAL,
        added_at   INTEGER NOT NULL DEFAULT (unixepoch())
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
      // Dropped features: browsing history ("Explorado"), search history and watched tracking.
      "DROP TABLE IF EXISTS history_movies",
      "DROP TABLE IF EXISTS search_history",
      "DROP TABLE IF EXISTS watched",
    ],
    "write"
  );

  // Migration: the old single `watchlist` table becomes a default "Minha Lista" (named lists),
  // then goes away. Only databases from before named lists still have it.
  const legacy = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'watchlist'");
  if (legacy.rows.length > 0) {
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
    }
    await db.execute("DROP TABLE watchlist");
  }

  initialized = true;
}
