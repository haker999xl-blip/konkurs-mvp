/**
 * Слой хранения: SQLite через встроенный в Node модуль node:sqlite.
 * Файл базы лежит в data/hackathon.db и не попадает в git.
 * Здесь только схема и подключение — бизнес-правила живут в api.js.
 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { seedDatabase } from './seed.js';

const DB_PATH = process.env.HACKATHON_DB ?? resolve(process.cwd(), 'data', 'hackathon.db');

let db = null;

/** Единственное подключение на процесс: node:sqlite синхронный, этого достаточно. */
export function getDb() {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  seedDatabase(db);
  return db;
}

/** Создаёт таблицы, если их ещё нет. Идемпотентно — вызывается на каждый старт. */
function migrate(connection) {
  connection.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      -- Уникальность входа: одна и та же пара имя+класс не регистрируется дважды.
      login_key TEXT NOT NULL UNIQUE,
      grade TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
      subject TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL CHECK (category IN ('academic', 'olympiad', 'project', 'volunteer')),
      title TEXT NOT NULL,
      awarded_on TEXT NOT NULL,
      points INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      source TEXT NOT NULL CHECK (source IN ('student', 'admin', 'contest')),
      comment TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      reviewed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_achievements_student ON achievements(student_id);

    CREATE TABLE IF NOT EXISTS competitions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      description TEXT NOT NULL,
      track TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      deadline TEXT NOT NULL,
      max_score INTEGER NOT NULL,
      image TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS participations (
      id TEXT PRIMARY KEY,
      competition_id TEXT NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      score INTEGER NOT NULL DEFAULT 0,
      registered_at TEXT NOT NULL,
      reviewed_at TEXT,
      comment TEXT NOT NULL DEFAULT '',
      UNIQUE (competition_id, student_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}