// Banco de dados local (SQLite embutido no Node, sem instalar nada a mais).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const DATA_DIR = path.resolve(process.env.TALKBOX_DATA || 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'talkbox.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS lessons (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    student    TEXT NOT NULL DEFAULT '',
    doc        TEXT NOT NULL,             -- conteúdo da aula (blocos)
    state      TEXT NOT NULL DEFAULT '{}',-- o que acontece na aula (respostas, caneta), separado do conteúdo
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const parse = (row) =>
  row && {
    id: row.id,
    title: row.title,
    student: row.student,
    doc: JSON.parse(row.doc),
    state: JSON.parse(row.state),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

export function listLessons() {
  return db
    .prepare('SELECT id, title, student, created_at, updated_at FROM lessons ORDER BY updated_at DESC')
    .all()
    .map((r) => ({ id: r.id, title: r.title, student: r.student, createdAt: r.created_at, updatedAt: r.updated_at }));
}

export function getLesson(id) {
  return parse(db.prepare('SELECT * FROM lessons WHERE id = ?').get(id));
}

export function createLesson({ id, title, student, doc, state = {} }) {
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO lessons (id, title, student, doc, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, student, JSON.stringify(doc), JSON.stringify(state), now, now);
  return getLesson(id);
}

export function updateLesson(id, patch) {
  const cur = getLesson(id);
  if (!cur) return null;
  const next = {
    title: patch.title ?? cur.title,
    student: patch.student ?? cur.student,
    doc: patch.doc ?? cur.doc,
    state: patch.state ?? cur.state,
  };
  db.prepare('UPDATE lessons SET title = ?, student = ?, doc = ?, state = ?, updated_at = ? WHERE id = ?').run(
    next.title,
    next.student,
    JSON.stringify(next.doc),
    JSON.stringify(next.state),
    new Date().toISOString(),
    id
  );
  return getLesson(id);
}

export function countLessons() {
  return db.prepare('SELECT COUNT(*) AS n FROM lessons').get().n;
}
