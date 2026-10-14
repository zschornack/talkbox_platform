// Banco de dados local (SQLite embutido no Node, sem instalar nada a mais).
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = path.resolve(process.env.TALKBOX_DATA || 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'talkbox.db'));
export const newId = () => crypto.randomBytes(6).toString('base64url');
const now = () => new Date().toISOString();

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS students (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    level      TEXT NOT NULL DEFAULT '',
    goal       TEXT NOT NULL DEFAULT '',   -- objetivo resumido (aparece na lista)
    notes      TEXT NOT NULL DEFAULT '',   -- objetivo e observações (ficha)
    map        TEXT NOT NULL DEFAULT '{}', -- mapa de conteúdos: { "Past Simple": "good" | "practicing" }
    active     INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS lessons (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    student    TEXT NOT NULL DEFAULT '',   -- nome antigo (antes do cadastro de alunos)
    doc        TEXT NOT NULL,              -- conteúdo da aula (blocos)
    state      TEXT NOT NULL DEFAULT '{}', -- o que acontece na aula (respostas, caneta), separado do conteúdo
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS models (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    type       TEXT NOT NULL,              -- formato (tipo de bloco)
    block      TEXT NOT NULL,              -- o bloco pronto para copiar na aula
    tags       TEXT NOT NULL DEFAULT '{}', -- { content: [], levels: [], skills: [] }
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS model_versions (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT NOT NULL,
    title    TEXT NOT NULL,
    block    TEXT NOT NULL,
    tags     TEXT NOT NULL,
    saved_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS model_versions_by_model ON model_versions (model_id, saved_at);
`);

// ---------- migração: aulas passam a pertencer a um aluno cadastrado ----------
const lessonCols = db.prepare('PRAGMA table_info(lessons)').all().map((c) => c.name);
if (!lessonCols.includes('student_id')) {
  db.exec('ALTER TABLE lessons ADD COLUMN student_id TEXT');
}
{
  const orphans = db.prepare("SELECT DISTINCT student FROM lessons WHERE student_id IS NULL AND student <> ''").all();
  for (const { student: name } of orphans) {
    let s = db.prepare('SELECT id FROM students WHERE name = ?').get(name);
    if (!s) {
      s = { id: newId() };
      db.prepare('INSERT INTO students (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run(s.id, name, now(), now());
    }
    db.prepare('UPDATE lessons SET student_id = ? WHERE student_id IS NULL AND student = ?').run(s.id, name);
  }
}

const json = (s, fallback) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

// ============================== ALUNOS ==============================
const studentOut = (r) =>
  r && {
    id: r.id,
    name: r.name,
    level: r.level,
    goal: r.goal,
    notes: r.notes,
    map: json(r.map, {}),
    active: !!r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastLessonAt: r.last_lesson_at ?? null,
    lessonCount: r.lesson_count ?? 0,
  };

const STUDENT_SELECT = `
  SELECT s.*, MAX(l.created_at) AS last_lesson_at, COUNT(l.id) AS lesson_count
  FROM students s LEFT JOIN lessons l ON l.student_id = s.id`;

export function listStudents({ active } = {}) {
  const where = active === undefined ? '' : 'WHERE s.active = ?';
  const rows = db
    .prepare(`${STUDENT_SELECT} ${where} GROUP BY s.id ORDER BY s.name COLLATE NOCASE`)
    .all(...(active === undefined ? [] : [active ? 1 : 0]));
  return rows.map(studentOut);
}

export function getStudent(id) {
  return studentOut(db.prepare(`${STUDENT_SELECT} WHERE s.id = ? GROUP BY s.id`).get(id));
}

export function createStudent({ name, level = '', goal = '', notes = '' }) {
  const id = newId();
  db.prepare('INSERT INTO students (id, name, level, goal, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, name, level, goal, notes, now(), now()
  );
  return getStudent(id);
}

export function updateStudent(id, patch) {
  const cur = getStudent(id);
  if (!cur) return null;
  const next = { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
  db.prepare('UPDATE students SET name = ?, level = ?, goal = ?, notes = ?, map = ?, active = ?, updated_at = ? WHERE id = ?').run(
    next.name, next.level, next.goal, next.notes, JSON.stringify(next.map || {}), next.active ? 1 : 0, now(), id
  );
  // mantém o nome usado no cabeçalho do PDF das aulas
  if (patch.name !== undefined) db.prepare('UPDATE lessons SET student = ? WHERE student_id = ?').run(next.name, id);
  return getStudent(id);
}

// ============================== AULAS ==============================
const lessonOut = (row) =>
  row && {
    id: row.id,
    title: row.title,
    studentId: row.student_id,
    student: row.student_name ?? row.student,
    doc: json(row.doc, { blocks: [] }),
    state: json(row.state, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
const lessonSummary = (r, modelTags) => {
  const doc = json(r.doc, {});
  // conteúdos vistos = etiquetas de conteúdo dos modelos usados na aula
  const contents = [...new Set((doc.blocks || []).flatMap((b) => modelTags.get(b.source?.modelId) || []))];
  return {
    id: r.id,
    title: r.title,
    studentId: r.student_id,
    student: r.student_name ?? r.student,
    level: doc.level || '',
    tags: doc.tags || [],
    contents,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};
const LESSON_SELECT = 'SELECT l.*, s.name AS student_name FROM lessons l LEFT JOIN students s ON s.id = l.student_id';

export function listLessons({ studentId, limit } = {}) {
  const where = studentId ? 'WHERE l.student_id = ?' : '';
  const order = studentId ? 'ORDER BY l.created_at DESC' : 'ORDER BY l.updated_at DESC';
  const lim = limit ? `LIMIT ${Number(limit) | 0}` : '';
  const modelTags = new Map(db.prepare('SELECT id, tags FROM models').all().map((m) => [m.id, json(m.tags, {}).content || []]));
  return db.prepare(`${LESSON_SELECT} ${where} ${order} ${lim}`).all(...(studentId ? [studentId] : [])).map((r) => lessonSummary(r, modelTags));
}

export function getLesson(id) {
  return lessonOut(db.prepare(`${LESSON_SELECT} WHERE l.id = ?`).get(id));
}

export function createLesson({ id = newId(), title, studentId = null, doc, state = {} }) {
  const name = studentId ? db.prepare('SELECT name FROM students WHERE id = ?').get(studentId)?.name || '' : '';
  db.prepare(
    'INSERT INTO lessons (id, title, student, student_id, doc, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, name, studentId, JSON.stringify(doc), JSON.stringify(state), now(), now());
  return getLesson(id);
}

export function updateLesson(id, patch) {
  const cur = getLesson(id);
  if (!cur) return null;
  db.prepare('UPDATE lessons SET title = ?, doc = ?, state = ?, updated_at = ? WHERE id = ?').run(
    patch.title ?? cur.title,
    JSON.stringify(patch.doc ?? cur.doc),
    JSON.stringify(patch.state ?? cur.state),
    now(),
    id
  );
  return getLesson(id);
}

export function deleteLesson(id) {
  return db.prepare('DELETE FROM lessons WHERE id = ?').run(id).changes > 0;
}

export const countLessons = () => db.prepare('SELECT COUNT(*) AS n FROM lessons').get().n;
export const countStudents = () => db.prepare('SELECT COUNT(*) AS n FROM students').get().n;

// ============================== MODELOS ==============================
// Um modelo é uma atividade pronta (um bloco) com etiquetas. Ao entrar numa aula ele é COPIADO;
// a cópia guarda de onde veio em block.source.modelId (requisitos 7.4).
const cleanTags = (t = {}) => ({
  content: [...new Set((t.content || []).map((x) => String(x).trim()).filter(Boolean))],
  levels: [...new Set((t.levels || []).map(String))],
  skills: [...new Set((t.skills || []).map(String))],
});

const usesStmt = () => db.prepare("SELECT COUNT(*) AS n FROM lessons WHERE doc LIKE ? ESCAPE '\\'");
const seenStmt = () => db.prepare("SELECT MAX(created_at) AS at FROM lessons WHERE student_id = ? AND doc LIKE ? ESCAPE '\\'");
const sourcePattern = (id) => `%"modelId":"${id.replace(/[\\%_]/g, (c) => '\\' + c)}"%`;

const modelOut = (r, extra = {}) =>
  r && {
    id: r.id,
    title: r.title,
    type: r.type,
    block: json(r.block, {}),
    tags: cleanTags(json(r.tags, {})),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...extra,
  };

export function listModels({ studentId } = {}) {
  const uses = usesStmt();
  const seen = studentId ? seenStmt() : null;
  return db
    .prepare('SELECT * FROM models ORDER BY updated_at DESC')
    .all()
    .map((r) =>
      modelOut(r, {
        uses: uses.get(sourcePattern(r.id)).n,
        ...(seen ? { seenAt: seen.get(studentId, sourcePattern(r.id)).at } : {}),
      })
    );
}

export function getModel(id) {
  const r = db.prepare('SELECT * FROM models WHERE id = ?').get(id);
  if (!r) return null;
  const versions = db
    .prepare('SELECT id, title, saved_at FROM model_versions WHERE model_id = ? ORDER BY saved_at DESC LIMIT 30')
    .all(id)
    .map((v) => ({ id: v.id, title: v.title, savedAt: v.saved_at }));
  return modelOut(r, { uses: usesStmt().get(sourcePattern(id)).n, versions });
}

export function createModel({ title, type, block, tags }) {
  const id = newId();
  const { source, ...clean } = block || {};
  db.prepare('INSERT INTO models (id, title, type, block, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    id, title, type, JSON.stringify({ ...clean, type }), JSON.stringify(cleanTags(tags)), now(), now()
  );
  return getModel(id);
}

// Guarda uma versão anterior no histórico, no máximo uma a cada 10 minutos de edição.
const VERSION_GAP_MS = 10 * 60 * 1000;
function snapshot(cur) {
  const last = db.prepare('SELECT saved_at FROM model_versions WHERE model_id = ? ORDER BY saved_at DESC LIMIT 1').get(cur.id);
  if (last && Date.now() - Date.parse(last.saved_at) < VERSION_GAP_MS) return;
  db.prepare('INSERT INTO model_versions (model_id, title, block, tags, saved_at) VALUES (?, ?, ?, ?, ?)').run(
    cur.id, cur.title, JSON.stringify(cur.block), JSON.stringify(cur.tags), cur.updatedAt
  );
}

export function updateModel(id, patch) {
  const cur = db.prepare('SELECT * FROM models WHERE id = ?').get(id);
  if (!cur) return null;
  snapshot(modelOut(cur));
  db.prepare('UPDATE models SET title = ?, block = ?, tags = ?, updated_at = ? WHERE id = ?').run(
    patch.title ?? cur.title,
    patch.block ? JSON.stringify({ ...patch.block, type: cur.type }) : cur.block,
    patch.tags ? JSON.stringify(cleanTags(patch.tags)) : cur.tags,
    now(),
    id
  );
  return getModel(id);
}

export function restoreModelVersion(id, versionId) {
  const v = db.prepare('SELECT * FROM model_versions WHERE id = ? AND model_id = ?').get(versionId, id);
  if (!v) return null;
  // a versão atual também vai para o histórico, para dar para voltar atrás
  const cur = db.prepare('SELECT * FROM models WHERE id = ?').get(id);
  db.prepare('INSERT INTO model_versions (model_id, title, block, tags, saved_at) VALUES (?, ?, ?, ?, ?)').run(
    id, cur.title, cur.block, cur.tags, now()
  );
  db.prepare('UPDATE models SET title = ?, block = ?, tags = ?, updated_at = ? WHERE id = ?').run(v.title, v.block, v.tags, now(), id);
  return getModel(id);
}

export function deleteModel(id) {
  db.prepare('DELETE FROM model_versions WHERE model_id = ?').run(id);
  return db.prepare('DELETE FROM models WHERE id = ?').run(id).changes > 0;
}

export const countModels = () => db.prepare('SELECT COUNT(*) AS n FROM models').get().n;
