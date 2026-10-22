// Banco de dados local (SQLite embutido no Node, sem instalar nada a mais).
// Regras (documento "Banco de dados" do projeto):
//   - nada é apagado: aulas e modelos são arquivados; o banco recusa DELETE nas tabelas principais;
//   - o modelo é copiado para a aula, e a tabela block_uses registra de onde veio cada bloco;
//   - o mapa de conteúdos é o resultado das avaliações (handover ou ajuste manual na ficha);
//   - "usado em" e "visto em" são calculados, nunca digitados.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonicalContent, MAP_SECTIONS } from '../web/js/catalog.js';

export const DATA_DIR = path.resolve(process.env.TALKBOX_DATA || 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'talkbox.db'));
export const newId = () => crypto.randomBytes(6).toString('base64url');
const now = () => new Date().toISOString();
// data local do computador (a escola está no Brasil: depois das 21h, a data UTC já é o dia seguinte)
const localDate = (d = new Date()) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};
const today = () => localDate();

/** Erro de regra, com mensagem para o professor (a API responde 400). */
export class RuleError extends Error {
  status = 400;
}

db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS students (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    level      TEXT NOT NULL DEFAULT '',
    goal       TEXT NOT NULL DEFAULT '',   -- objetivo resumido (aparece na lista)
    notes      TEXT NOT NULL DEFAULT '',   -- objetivo e observações (ficha)
    map        TEXT NOT NULL DEFAULT '{}', -- (antigo) o mapa agora vem da tabela assessments
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

  CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, file TEXT NOT NULL, imported_at TEXT NOT NULL);
`);

// ---------- migração 0 (v0.2): aulas passam a pertencer a um aluno cadastrado ----------
const cols = (table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
if (!cols('lessons').includes('student_id')) {
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

// Transações que podem ser aninhadas (as de dentro viram SAVEPOINT).
let depth = 0;
export function transaction(fn) {
  const sp = `sp${depth}`;
  db.exec(depth === 0 ? 'BEGIN' : `SAVEPOINT ${sp}`);
  depth++;
  try {
    const out = fn();
    depth--;
    db.exec(depth === 0 ? 'COMMIT' : `RELEASE ${sp}`);
    return out;
  } catch (err) {
    depth--;
    db.exec(depth === 0 ? 'ROLLBACK' : `ROLLBACK TO ${sp}; RELEASE ${sp}`);
    throw err;
  }
}

// ---------- migração 1 (v0.4): banco "pra valer" ----------
const SCHEMA_VERSION = 3;
if (db.prepare('PRAGMA user_version').get().user_version < 1) {
  transaction(() => {
    // aulas: data, número, situação e arquivamento. Aulas que já existiam contam como dadas.
    db.exec(`
      ALTER TABLE lessons ADD COLUMN lesson_date TEXT;
      ALTER TABLE lessons ADD COLUMN number INTEGER;
      ALTER TABLE lessons ADD COLUMN status TEXT NOT NULL DEFAULT 'done';
      ALTER TABLE lessons ADD COLUMN received_message TEXT NOT NULL DEFAULT '';
      ALTER TABLE lessons ADD COLUMN archived_at TEXT;

      ALTER TABLE models ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
      ALTER TABLE models ADD COLUMN import_id TEXT;
      ALTER TABLE models ADD COLUMN needs_content INTEGER NOT NULL DEFAULT 0;

      ALTER TABLE imports ADD COLUMN review INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE imports ADD COLUMN undone_at TEXT;

      -- de onde veio cada bloco de cada aula: base de "usado em" e "visto em"
      CREATE TABLE block_uses (
        lesson_id TEXT NOT NULL,
        block_id  TEXT NOT NULL,
        model_id  TEXT,              -- vazio = bloco criado na própria aula
        position  INTEGER NOT NULL,
        PRIMARY KEY (lesson_id, block_id)
      );
      CREATE INDEX block_uses_by_model ON block_uses (model_id, lesson_id);

      -- mapa de conteúdos: uma linha por avaliação; o status atual é a mais recente
      CREATE TABLE assessments (
        id         TEXT PRIMARY KEY,
        student_id TEXT NOT NULL,
        content    TEXT NOT NULL,
        status     TEXT NOT NULL CHECK (status IN ('none', 'practicing', 'good')),
        date       TEXT NOT NULL,
        lesson_id  TEXT,             -- vazio = ajuste manual na ficha
        created_at TEXT NOT NULL
      );
      CREATE INDEX assessments_by_student ON assessments (student_id, content, created_at);

      -- finalizar aula
      CREATE TABLE handovers (
        lesson_id     TEXT PRIMARY KEY,
        last_block_id TEXT,          -- vazio = nenhum bloco feito
        message       TEXT NOT NULL DEFAULT '',
        finished_at   TEXT NOT NULL
      );

      -- blocos que ficaram para depois
      CREATE TABLE pending (
        id                 TEXT PRIMARY KEY,
        student_id         TEXT NOT NULL,
        lesson_id          TEXT NOT NULL,   -- aula em que ficou pendente pela primeira vez
        block              TEXT NOT NULL,   -- o bloco como estava na última aula em que apareceu
        status             TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'discarded')),
        resolved_lesson_id TEXT,
        created_at         TEXT NOT NULL,
        closed_at          TEXT
      );
      CREATE INDEX pending_by_student ON pending (student_id, status);

      CREATE TRIGGER keep_students       BEFORE DELETE ON students       BEGIN SELECT RAISE(ABORT, 'Alunos não são apagados: inative.'); END;
      CREATE TRIGGER keep_lessons        BEFORE DELETE ON lessons        BEGIN SELECT RAISE(ABORT, 'Aulas não são apagadas: arquive.'); END;
      CREATE TRIGGER keep_models         BEFORE DELETE ON models         BEGIN SELECT RAISE(ABORT, 'Modelos não são apagados: arquive.'); END;
      CREATE TRIGGER keep_model_versions BEFORE DELETE ON model_versions BEGIN SELECT RAISE(ABORT, 'Versões não são apagadas.'); END;
      CREATE TRIGGER keep_assessments    BEFORE DELETE ON assessments    BEGIN SELECT RAISE(ABORT, 'Avaliações não são apagadas.'); END;
      CREATE TRIGGER keep_handovers      BEFORE DELETE ON handovers      BEGIN SELECT RAISE(ABORT, 'Handovers não são apagados.'); END;
      CREATE TRIGGER keep_pending        BEFORE DELETE ON pending        BEGIN SELECT RAISE(ABORT, 'Pendências não são apagadas: descarte.'); END;
    `);

    const setDate = db.prepare('UPDATE lessons SET lesson_date = ? WHERE id = ?');
    for (const l of db.prepare('SELECT id, created_at FROM lessons').all()) setDate.run(localDate(l.created_at), l.id);

    // numera as aulas de cada aluno pela ordem em que foram criadas
    const byStudent = db.prepare('SELECT id, student_id FROM lessons WHERE student_id IS NOT NULL ORDER BY created_at').all();
    const counter = {};
    const setNum = db.prepare('UPDATE lessons SET number = ? WHERE id = ?');
    for (const l of byStudent) setNum.run((counter[l.student_id] = (counter[l.student_id] || 0) + 1), l.id);

    // o mapa antigo (JSON no aluno) vira avaliações manuais
    const insA = db.prepare('INSERT INTO assessments (id, student_id, content, status, date, lesson_id, created_at) VALUES (?, ?, ?, ?, ?, NULL, ?)');
    for (const s of db.prepare("SELECT id, map, updated_at FROM students WHERE map <> '{}'").all()) {
      for (const [content, status] of Object.entries(json(s.map, {}))) {
        if (status === 'good' || status === 'practicing') insA.run(newId(), s.id, canonicalContent(content), status, localDate(s.updated_at), s.updated_at);
      }
    }

    // etiquetas de conteúdo passam pelo nome oficial
    const upTags = db.prepare('UPDATE models SET tags = ? WHERE id = ?');
    for (const m of db.prepare('SELECT id, tags FROM models').all()) upTags.run(JSON.stringify(cleanTags(json(m.tags, {}))), m.id);

    for (const l of db.prepare('SELECT id, doc FROM lessons').all()) syncUses(l.id, json(l.doc, {}));
    db.exec("PRAGMA user_version = 1");
  });
}

// ---------- migração 2 (v0.5): "Reabrir aula" ----------
// Uma aula finalizada pode ser reaberta. Nada é apagado: o handover desfeito fica marcado (undone_at)
// e as avaliações dele ficam anuladas (voided_at), fora do mapa.
if (db.prepare('PRAGMA user_version').get().user_version < 2) {
  transaction(() => {
    db.exec(`
      ALTER TABLE assessments ADD COLUMN voided_at TEXT;

      CREATE TABLE handovers_v2 (
        id            TEXT PRIMARY KEY,
        lesson_id     TEXT NOT NULL,
        last_block_id TEXT,
        message       TEXT NOT NULL DEFAULT '',
        finished_at   TEXT NOT NULL,
        undone_at     TEXT            -- preenchido = aula reaberta (este handover não vale mais)
      );
      INSERT INTO handovers_v2 (id, lesson_id, last_block_id, message, finished_at)
        SELECT lesson_id, lesson_id, last_block_id, message, finished_at FROM handovers;
      DROP TRIGGER keep_handovers;
      DROP TABLE handovers;
      ALTER TABLE handovers_v2 RENAME TO handovers;
      CREATE UNIQUE INDEX handovers_active ON handovers (lesson_id) WHERE undone_at IS NULL;
      CREATE TRIGGER keep_handovers BEFORE DELETE ON handovers BEGIN SELECT RAISE(ABORT, 'Handovers não são apagados.'); END;
    `);
    db.exec('PRAGMA user_version = 2');
  });
}

// ---------- migração 3 (v0.7): aulas dadas antes da plataforma ----------
// prior_lessons = quantas aulas o aluno teve antes (no Drive). A primeira aula na plataforma é prior_lessons + 1.
if (db.prepare('PRAGMA user_version').get().user_version < 3) {
  transaction(() => {
    db.exec('ALTER TABLE students ADD COLUMN prior_lessons INTEGER NOT NULL DEFAULT 0');
    db.exec('PRAGMA user_version = 3');
  });
}

db.exec('CREATE INDEX IF NOT EXISTS lessons_by_student ON lessons (student_id, lesson_date)');

// ---------- a aluna de exemplo "Julia" é a Júlia de verdade (pasta JÚLIA no Drive) ----------
// Renomeia a de exemplo para "Júlia" e tira a observação de exemplo. Se o cadastro em lote já tiver criado
// outra "Júlia", tudo dela passa para a ficha da Julia e o cadastro repetido fica inativo (nada é apagado).
{
  const example = db.prepare("SELECT id FROM students WHERE name = 'Julia' AND notes LIKE 'Aluna de exemplo%'").get();
  if (example) {
    transaction(() => {
      for (const dup of db.prepare("SELECT id FROM students WHERE name = 'Júlia' AND id <> ?").all(example.id)) {
        db.prepare('UPDATE lessons SET student_id = ? WHERE student_id = ?').run(example.id, dup.id);
        db.prepare('UPDATE assessments SET student_id = ? WHERE student_id = ?').run(example.id, dup.id);
        db.prepare('UPDATE pending SET student_id = ? WHERE student_id = ?').run(example.id, dup.id);
        db.prepare("UPDATE students SET name = 'Júlia (cadastro repetido)', active = 0, notes = ?, updated_at = ? WHERE id = ?")
          .run('Juntado com a ficha da Júlia em 15/10/2026.', now(), dup.id);
      }
      db.prepare("UPDATE students SET name = 'Júlia', notes = '', updated_at = ? WHERE id = ?").run(now(), example.id);
    });
  }
}

// ============================== ALUNOS ==============================
const latestMap = db.prepare(`
  SELECT content, status, date FROM (
    SELECT content, status, date,
           ROW_NUMBER() OVER (PARTITION BY content ORDER BY date DESC, created_at DESC) AS rn
    FROM assessments WHERE student_id = ? AND voided_at IS NULL
  ) WHERE rn = 1 AND status <> 'none'`);

function studentMap(id) {
  const map = {};
  const since = {};
  for (const r of latestMap.all(id)) {
    map[r.content] = r.status;
    since[r.content] = r.date;
  }
  return { map, since };
}

const studentOut = (r) => {
  if (!r) return r;
  const { map, since } = studentMap(r.id);
  return {
    id: r.id,
    name: r.name,
    level: r.level,
    goal: r.goal,
    notes: r.notes,
    map,
    mapSince: since,
    active: !!r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastLessonAt: r.last_lesson_at ?? null,
    lessonCount: r.lesson_count ?? 0,
    priorLessons: r.prior_lessons ?? 0,
  };
};

const STUDENT_SELECT = `
  SELECT s.*, MAX(l.lesson_date) AS last_lesson_at, COUNT(l.id) AS lesson_count
  FROM students s LEFT JOIN lessons l ON l.student_id = s.id AND l.archived_at IS NULL`;

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

function assess(studentId, content, status, { lessonId = null, date = today() } = {}) {
  db.prepare('INSERT INTO assessments (id, student_id, content, status, date, lesson_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    newId(), studentId, canonicalContent(content), status, date, lessonId, now()
  );
}

export function updateStudent(id, patch) {
  const cur = getStudent(id);
  if (!cur) return null;
  const next = { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) };
  return transaction(() => {
    db.prepare('UPDATE students SET name = ?, level = ?, goal = ?, notes = ?, active = ?, updated_at = ? WHERE id = ?').run(
      next.name, next.level, next.goal, next.notes, next.active ? 1 : 0, now(), id
    );
    // mudanças no mapa feitas na ficha viram avaliações manuais (dá para ver a evolução depois)
    if (patch.map) {
      const wanted = Object.fromEntries(Object.entries(patch.map).map(([k, v]) => [canonicalContent(k), v]));
      for (const c of new Set([...Object.keys(cur.map), ...Object.keys(wanted)])) {
        const before = cur.map[c] || 'none';
        const after = wanted[c] || 'none';
        if (before !== after) assess(id, c, after);
      }
    }
    // mantém o nome usado no cabeçalho do PDF das aulas
    if (patch.name !== undefined) db.prepare('UPDATE lessons SET student = ? WHERE student_id = ?').run(next.name, id);
    return getStudent(id);
  });
}

/**
 * Junta dois cadastros do mesmo aluno: aulas, mapa (avaliações) e pendências do "from" passam para o "into".
 * Nível, objetivo e observações em branco no "into" são completados com os do "from". O "from" fica inativo,
 * com o nome "<nome> (cadastro repetido)" (nada é apagado). Com "name", o "into" passa a ter esse nome.
 */
export function mergeStudents(fromId, intoId, name) {
  const from = getStudent(fromId);
  const into = getStudent(intoId);
  if (!from || !into || fromId === intoId) return null;
  return transaction(() => {
    const moved = db.prepare('UPDATE lessons SET student_id = ? WHERE student_id = ?').run(intoId, fromId).changes;
    db.prepare('UPDATE assessments SET student_id = ? WHERE student_id = ?').run(intoId, fromId);
    db.prepare('UPDATE pending SET student_id = ? WHERE student_id = ?').run(intoId, fromId);
    // aulas que vieram do outro cadastro: renumera tudo pela ordem das datas
    if (moved) {
      const rows = db.prepare('SELECT id FROM lessons WHERE student_id = ? ORDER BY lesson_date, created_at').all(intoId);
      const setNum = db.prepare('UPDATE lessons SET number = ? WHERE id = ?');
      rows.forEach((r, i) => setNum.run(i + 1, r.id));
    }
    const fill = (a, b) => (String(a || '').trim() ? a : b || '');
    db.prepare("UPDATE students SET name = ?, active = 0, notes = ?, updated_at = ? WHERE id = ?")
      .run(`${from.name} (cadastro repetido)`, `Juntado com a ficha de ${name || into.name} em ${now().slice(0, 10).split('-').reverse().join('/')}.`, now(), fromId);
    updateStudent(intoId, {
      name: name?.trim() || into.name,
      level: fill(into.level, from.level),
      goal: fill(into.goal, from.goal),
      notes: fill(into.notes, from.notes),
    });
    return getStudent(intoId);
  });
}

const MAP_ITEMS = new Set(MAP_SECTIONS.flatMap((sec) => sec.items));
const RANK = { none: 0, practicing: 1, good: 2 };

/**
 * Atualiza a ficha com o histórico de antes da plataforma (as aulas do Drive).
 * - level: o nível, se vier.
 * - map: { conteúdo: 'practicing' | 'good' }. Só sobe: um conteúdo nunca volta de "Já está bom" para "Praticando",
 *   e o que não estiver na lista fica como está. Cada mudança vira uma avaliação manual (aparece na evolução).
 * - priorLessons: quantas aulas o aluno teve antes. As aulas da plataforma (não arquivadas) são renumeradas
 *   pela ordem das datas a partir de priorLessons + 1, e as próximas continuam dali.
 */
export function applyProfile(studentId, { level, map = {}, priorLessons } = {}) {
  const cur = getStudent(studentId);
  if (!cur) return null;
  return transaction(() => {
    const changed = [];
    if (String(level || '').trim() && level.trim() !== cur.level) {
      db.prepare('UPDATE students SET level = ?, updated_at = ? WHERE id = ?').run(level.trim(), now(), studentId);
    }
    for (const [term, status] of Object.entries(map)) {
      const content = canonicalContent(term);
      if (!MAP_ITEMS.has(content) || !(status in RANK)) throw new Error(`Conteúdo ou situação inválida no perfil de ${cur.name}: ${term} = ${status}`);
      if (RANK[status] > RANK[cur.map[content] || 'none']) {
        assess(studentId, content, status);
        changed.push(content);
      }
    }
    if (Number.isInteger(priorLessons) && priorLessons >= 0) {
      db.prepare('UPDATE students SET prior_lessons = ?, updated_at = ? WHERE id = ?').run(priorLessons, now(), studentId);
      const rows = db.prepare('SELECT id FROM lessons WHERE student_id = ? AND archived_at IS NULL ORDER BY lesson_date, created_at').all(studentId);
      const setNum = db.prepare('UPDATE lessons SET number = ? WHERE id = ?');
      rows.forEach((r, i) => setNum.run(priorLessons + i + 1, r.id));
    }
    return { student: getStudent(studentId), changed };
  });
}

/** Copia o mapa atual de um aluno para outro (ex.: turma que se separa). Vira avaliações manuais com a data de hoje. */
export function copyMap(fromId, toId) {
  const from = getStudent(fromId);
  if (!from || !getStudent(toId)) return 0;
  return transaction(() => {
    for (const [content, status] of Object.entries(from.map)) assess(toId, content, status);
    return Object.keys(from.map).length;
  });
}

/** Evolução do mapa na ficha: avaliações de um conteúdo (ou de todos), da mais antiga para a mais nova. */
export function contentHistory(studentId, content = '') {
  const one = !!String(content).trim();
  return db
    .prepare(`SELECT a.content, a.status, a.date, a.lesson_id, l.title AS lesson_title FROM assessments a
              LEFT JOIN lessons l ON l.id = a.lesson_id
              WHERE a.student_id = ? AND a.voided_at IS NULL ${one ? 'AND a.content = ?' : ''} ORDER BY a.date, a.created_at`)
    .all(...(one ? [studentId, canonicalContent(content)] : [studentId]))
    .map((r) => ({ content: r.content, status: r.status, date: r.date, lessonId: r.lesson_id, lessonTitle: r.lesson_title, manual: !r.lesson_id }));
}

// ============================== AULAS ==============================
/** Atualiza block_uses a partir dos blocos da aula (chamado sempre que a aula é salva). */
function syncUses(lessonId, doc) {
  db.prepare('DELETE FROM block_uses WHERE lesson_id = ?').run(lessonId);
  const ins = db.prepare('INSERT OR IGNORE INTO block_uses (lesson_id, block_id, model_id, position) VALUES (?, ?, ?, ?)');
  (doc.blocks || []).forEach((b, i) => {
    if (b?.id) ins.run(lessonId, String(b.id), b.source?.modelId ? String(b.source.modelId) : null, i + 1);
  });
}

const lessonOut = (row) =>
  row && {
    id: row.id,
    title: row.title,
    studentId: row.student_id,
    student: row.student_name ?? row.student,
    number: row.number,
    date: row.lesson_date,
    status: row.status,
    receivedMessage: row.received_message,
    doc: json(row.doc, { blocks: [] }),
    state: json(row.state, {}),
    handover: handoverOut(db.prepare('SELECT * FROM handovers WHERE lesson_id = ? AND undone_at IS NULL').get(row.id)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

const handoverOut = (h) => h && { lastBlockId: h.last_block_id, message: h.message, finishedAt: h.finished_at };

// conteúdos de uma aula = etiquetas dos modelos de onde vieram os blocos.
// Numa aula finalizada, só os blocos feitos (até o corte do handover).
const lessonContents = db.prepare(`
  SELECT DISTINCT m.tags FROM block_uses u
  JOIN models m ON m.id = u.model_id
  LEFT JOIN handovers h ON h.lesson_id = u.lesson_id AND h.undone_at IS NULL
  LEFT JOIN block_uses cut ON cut.lesson_id = u.lesson_id AND cut.block_id = h.last_block_id
  WHERE u.lesson_id = ? AND (? = 0 OR h.lesson_id IS NULL OR u.position <= COALESCE(cut.position, 0))`);
function contentsOf(lessonId, { doneOnly = true } = {}) {
  return [...new Set(lessonContents.all(lessonId, doneOnly ? 1 : 0).flatMap((r) => json(r.tags, {}).content || []))];
}

const lessonSummary = (r) => {
  const doc = json(r.doc, {});
  return {
    id: r.id,
    title: r.title,
    studentId: r.student_id,
    student: r.student_name ?? r.student,
    number: r.number,
    date: r.lesson_date,
    status: r.status,
    level: doc.level || '',
    tags: doc.tags || [],
    contents: contentsOf(r.id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};
const LESSON_SELECT = 'SELECT l.*, s.name AS student_name FROM lessons l LEFT JOIN students s ON s.id = l.student_id';

export function listLessons({ studentId, limit } = {}) {
  const where = ['l.archived_at IS NULL'];
  if (studentId) where.push('l.student_id = ?');
  const order = studentId ? 'ORDER BY l.lesson_date DESC, l.created_at DESC' : 'ORDER BY l.updated_at DESC';
  const lim = limit ? `LIMIT ${Number(limit) | 0}` : '';
  return db
    .prepare(`${LESSON_SELECT} WHERE ${where.join(' AND ')} ${order} ${lim}`)
    .all(...(studentId ? [studentId] : []))
    .map(lessonSummary);
}

export function getLesson(id) {
  return lessonOut(db.prepare(`${LESSON_SELECT} WHERE l.id = ? AND l.archived_at IS NULL`).get(id));
}

export function createLesson({ id = newId(), title, studentId = null, doc, state = {}, date, number, status = 'preparing', receivedMessage = '' }) {
  const name = studentId ? db.prepare('SELECT name FROM students WHERE id = ?').get(studentId)?.name || '' : '';
  if (number === undefined && studentId) {
    const max = db.prepare('SELECT MAX(number) AS n FROM lessons WHERE student_id = ?').get(studentId).n || 0;
    const prior = db.prepare('SELECT prior_lessons AS p FROM students WHERE id = ?').get(studentId)?.p || 0;
    number = Math.max(max, prior) + 1;
  }
  return transaction(() => {
    db.prepare(
      `INSERT INTO lessons (id, title, student, student_id, doc, state, lesson_date, number, status, received_message, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, title, name, studentId, JSON.stringify(doc), JSON.stringify(state), date || today(), number ?? null, status, receivedMessage, now(), now());
    syncUses(id, doc);
    return getLesson(id);
  });
}

export function updateLesson(id, patch) {
  const cur = getLesson(id);
  if (!cur) return null;
  return transaction(() => {
    db.prepare('UPDATE lessons SET title = ?, doc = ?, state = ?, lesson_date = ?, updated_at = ? WHERE id = ?').run(
      patch.title ?? cur.title,
      JSON.stringify(patch.doc ?? cur.doc),
      JSON.stringify(patch.state ?? cur.state),
      patch.date ?? cur.date,
      now(),
      id
    );
    if (patch.doc) syncUses(id, patch.doc);
    return getLesson(id);
  });
}

/** "Excluir" uma aula: ela sai das listas, mas fica guardada (regra 2.1). */
export function archiveLesson(id) {
  return db.prepare('UPDATE lessons SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL').run(now(), now(), id).changes > 0;
}
export const deleteLesson = archiveLesson;

export const countLessons = () => db.prepare('SELECT COUNT(*) AS n FROM lessons WHERE archived_at IS NULL').get().n;
export const countStudents = () => db.prepare('SELECT COUNT(*) AS n FROM students').get().n;

// ============================== FINALIZAR AULA (handover) ==============================
/** O que a tela de finalizar precisa: os blocos (para escolher até onde chegamos) e os conteúdos da aula. */
export function finishInfo(lessonId) {
  const l = getLesson(lessonId);
  if (!l) return null;
  return {
    lessonId,
    status: l.status,
    blocks: l.doc.blocks.map((b, i) => ({
      id: b.id,
      position: i + 1,
      type: b.type,
      title: b.source?.title || b.label || '',
      pending: !!b.pending,
      skip: skipsPending(b),
    })),
    contents: contentsOf(lessonId, { doneOnly: false }),
  };
}

/** Anotações e textos vazios não viram pendência. */
const skipsPending = (b) =>
  b.type === 'notes' || (['text', 'explanation'].includes(b.type) && !String(b.html || '').replace(/<[^>]*>|&nbsp;/g, '').trim());

/**
 * Finaliza a aula: tudo depois do último bloco feito vira pendente, as avaliações alimentam o mapa
 * e o recado fica para o próximo professor. assessments = { "Past Simple": "practicing" | "good" }.
 */
export function finishLesson(lessonId, { lastBlockId = null, assessments = {}, message = '' } = {}) {
  const l = getLesson(lessonId);
  if (!l) return null;
  if (l.status !== 'preparing') throw new RuleError('Esta aula já foi finalizada.');
  if (!l.studentId) throw new RuleError('A aula precisa ter um aluno para ser finalizada.');
  const blocks = l.doc.blocks;
  let cut = 0;
  if (lastBlockId) {
    cut = blocks.findIndex((b) => b.id === lastBlockId) + 1;
    if (!cut) throw new RuleError('O último bloco feito precisa ser um bloco desta aula.');
  }
  for (const s of Object.values(assessments)) {
    if (s !== 'practicing' && s !== 'good') throw new RuleError('Use "practicing" ou "good" nas avaliações.');
  }
  const summary = { done: cut, newPending: 0, resolvedPending: 0, stillPending: 0 };
  return transaction(() => {
    const t = now();
    db.prepare('INSERT INTO handovers (id, lesson_id, last_block_id, message, finished_at) VALUES (?, ?, ?, ?, ?)').run(newId(), lessonId, lastBlockId, message.trim(), t);
    blocks.forEach((b, i) => {
      const done = i < cut;
      if (b.pending) {
        if (done) {
          db.prepare("UPDATE pending SET status = 'resolved', resolved_lesson_id = ?, closed_at = ? WHERE id = ? AND status = 'open'").run(lessonId, t, b.pending);
          summary.resolvedPending++;
        } else {
          db.prepare('UPDATE pending SET block = ? WHERE id = ?').run(JSON.stringify(b), b.pending);
          summary.stillPending++;
        }
      } else if (!done && !skipsPending(b)) {
        db.prepare('INSERT INTO pending (id, student_id, lesson_id, block, created_at) VALUES (?, ?, ?, ?, ?)').run(newId(), l.studentId, lessonId, JSON.stringify(b), t);
        summary.newPending++;
      }
    });
    for (const [content, status] of Object.entries(assessments)) assess(l.studentId, content, status, { lessonId, date: l.date });
    db.prepare("UPDATE lessons SET status = 'done', updated_at = ? WHERE id = ?").run(t, lessonId);
    return summary;
  });
}

/**
 * Reabre uma aula finalizada (ex.: finalizou por engano). Desfaz o que o "Finalizar aula" fez,
 * sem apagar nada: o handover fica marcado como desfeito, as avaliações dele saem do mapa,
 * os pendentes que ela criou são descartados e os que ela resolveu voltam a ficar pendentes.
 */
export function reopenLesson(lessonId) {
  const l = getLesson(lessonId);
  if (!l) return null;
  if (l.status !== 'done') throw new RuleError('Esta aula ainda não foi finalizada.');
  return transaction(() => {
    const t = now();
    db.prepare('UPDATE handovers SET undone_at = ? WHERE lesson_id = ? AND undone_at IS NULL').run(t, lessonId);
    db.prepare('UPDATE assessments SET voided_at = ? WHERE lesson_id = ? AND voided_at IS NULL').run(t, lessonId);
    const discarded = db.prepare("UPDATE pending SET status = 'discarded', closed_at = ? WHERE lesson_id = ? AND status = 'open'").run(t, lessonId).changes;
    const reopened = db.prepare("UPDATE pending SET status = 'open', resolved_lesson_id = NULL, closed_at = NULL WHERE resolved_lesson_id = ? AND status = 'resolved'").run(lessonId).changes;
    db.prepare("UPDATE lessons SET status = 'preparing', updated_at = ? WHERE id = ?").run(t, lessonId);
    return { discarded, reopened };
  });
}

/** "Onde paramos" na ficha. */
export function whereWeStopped(studentId) {
  const last = db
    .prepare(`SELECT l.id, l.title, l.number, l.lesson_date, h.message FROM lessons l JOIN handovers h ON h.lesson_id = l.id AND h.undone_at IS NULL
              WHERE l.student_id = ? AND l.archived_at IS NULL ORDER BY l.lesson_date DESC, h.finished_at DESC LIMIT 1`)
    .get(studentId);
  const pending = db
    .prepare(`SELECT p.id, p.block, p.created_at, l.lesson_date FROM pending p JOIN lessons l ON l.id = p.lesson_id
              WHERE p.student_id = ? AND p.status = 'open' ORDER BY p.created_at`)
    .all(studentId)
    .map((p) => {
      const b = json(p.block, {});
      return { id: p.id, type: b.type, title: b.source?.title || b.label || '', since: p.lesson_date };
    });
  return {
    lesson: last ? { id: last.id, title: last.title, number: last.number, date: last.lesson_date, contents: contentsOf(last.id) } : null,
    message: last?.message || '',
    pending,
  };
}

/** "Preparar próxima aula": aula nova com os pendentes dentro e o recado do último professor. */
export function prepareNextLesson(studentId, { title, emptyDoc }) {
  const stop = whereWeStopped(studentId);
  const student = getStudent(studentId);
  const pendingBlocks = db
    .prepare("SELECT id, block FROM pending WHERE student_id = ? AND status = 'open' ORDER BY created_at")
    .all(studentId)
    .map((p) => ({ ...json(p.block, {}), id: 'b' + crypto.randomBytes(5).toString('hex'), pending: p.id }));
  const doc = emptyDoc(title);
  doc.level = student.level || '';
  doc.blocks = [...pendingBlocks, ...doc.blocks];
  return createLesson({ title, studentId, doc, receivedMessage: stop.message });
}

export function discardPending(id) {
  return db.prepare("UPDATE pending SET status = 'discarded', closed_at = ? WHERE id = ? AND status = 'open'").run(now(), id).changes > 0;
}

// ============================== MODELOS ==============================
// Um modelo é uma atividade pronta (um bloco) com etiquetas. Ao entrar numa aula ele é COPIADO;
// a cópia guarda de onde veio em block.source.modelId (requisitos 7.4).
function cleanTags(t = {}) {
  return {
    content: [...new Set((t.content || []).map((x) => canonicalContent(x)).filter(Boolean))],
    levels: [...new Set((t.levels || []).map(String))],
    skills: [...new Set((t.skills || []).map(String))],
  };
}

const usesOf = db.prepare(`
  SELECT COUNT(DISTINCT u.lesson_id) AS n FROM block_uses u JOIN lessons l ON l.id = u.lesson_id
  WHERE u.model_id = ? AND l.archived_at IS NULL`);

// "visto em": aula do aluno em que o bloco foi feito. Numa aula finalizada, só conta o que ficou
// antes do corte do handover; aulas ainda não finalizadas contam por inteiro.
const seenOf = db.prepare(`
  SELECT u.model_id, MAX(l.lesson_date) AS at
  FROM block_uses u
  JOIN lessons l ON l.id = u.lesson_id AND l.archived_at IS NULL
  LEFT JOIN handovers h ON h.lesson_id = l.id AND h.undone_at IS NULL
  LEFT JOIN block_uses cut ON cut.lesson_id = l.id AND cut.block_id = h.last_block_id
  WHERE l.student_id = ? AND u.model_id IS NOT NULL
    AND (h.lesson_id IS NULL OR u.position <= COALESCE(cut.position, 0))
  GROUP BY u.model_id`);

const MODEL_STATUSES = { published: 'published', review: 'review' };

const modelOut = (r, extra = {}) =>
  r && {
    id: r.id,
    title: r.title,
    type: r.type,
    block: json(r.block, {}),
    tags: cleanTags(json(r.tags, {})),
    status: r.status,
    needsContent: !!r.needs_content,
    importId: r.import_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...extra,
  };

const allUses = db.prepare(`
  SELECT model_id, COUNT(DISTINCT lesson_id) AS n FROM block_uses
  WHERE model_id IS NOT NULL AND lesson_id NOT IN (SELECT id FROM lessons WHERE archived_at IS NOT NULL)
  GROUP BY model_id`);

export function listModels({ studentId, status } = {}) {
  const seen = studentId ? new Map(seenOf.all(studentId).map((r) => [r.model_id, r.at])) : null;
  const uses = new Map(allUses.all().map((r) => [r.model_id, r.n]));
  const where = status && MODEL_STATUSES[status] ? 'status = ?' : "status IN ('published', 'review')";
  return db
    .prepare(`SELECT * FROM models WHERE ${where} ORDER BY updated_at DESC`)
    .all(...(status && MODEL_STATUSES[status] ? [status] : []))
    .map((r) => modelOut(r, { uses: uses.get(r.id) || 0, ...(seen ? { seenAt: seen.get(r.id) || null } : {}) }));
}

export function getModel(id) {
  const r = db.prepare("SELECT * FROM models WHERE id = ? AND status <> 'archived'").get(id);
  if (!r) return null;
  const versions = db
    .prepare('SELECT id, title, saved_at FROM model_versions WHERE model_id = ? ORDER BY saved_at DESC LIMIT 30')
    .all(id)
    .map((v) => ({ id: v.id, title: v.title, savedAt: v.saved_at }));
  return modelOut(r, { uses: usesOf.get(id).n, versions });
}

export function createModel({ title, type, block, tags, status = 'published', importId = null }) {
  const id = newId();
  const { source, pending, ...clean } = block || {};
  const t = cleanTags(tags);
  db.prepare(
    'INSERT INTO models (id, title, type, block, tags, status, import_id, needs_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, title, type, JSON.stringify({ ...clean, type }), JSON.stringify(t), status, importId, t.content.length ? 0 : 1, now(), now());
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
  const cur = db.prepare("SELECT * FROM models WHERE id = ? AND status <> 'archived'").get(id);
  if (!cur) return null;
  snapshot(modelOut(cur));
  const tags = patch.tags ? cleanTags(patch.tags) : json(cur.tags, {});
  db.prepare('UPDATE models SET title = ?, block = ?, tags = ?, needs_content = ?, updated_at = ? WHERE id = ?').run(
    patch.title ?? cur.title,
    patch.block ? JSON.stringify({ ...patch.block, type: cur.type }) : cur.block,
    JSON.stringify(tags),
    (tags.content || []).length ? 0 : 1,
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

/** "Excluir" um modelo: sai da biblioteca, mas as versões e o histórico de uso ficam (regra 2.1). */
export function archiveModel(id) {
  return db.prepare("UPDATE models SET status = 'archived', updated_at = ? WHERE id = ? AND status <> 'archived'").run(now(), id).changes > 0;
}
export const deleteModel = archiveModel;

/** Tira um item importado da fila "a revisar". */
export function approveModel(id) {
  db.prepare("UPDATE models SET status = 'published', updated_at = ? WHERE id = ? AND status = 'review'").run(now(), id);
  return getModel(id);
}

export const countModels = () => db.prepare("SELECT COUNT(*) AS n FROM models WHERE status = 'published'").get().n;

// ============================== IMPORTAÇÃO ==============================
export function listImports() {
  return db
    .prepare(`SELECT i.*,
                (SELECT COUNT(*) FROM models m WHERE m.import_id = i.id) AS models,
                (SELECT COUNT(*) FROM models m WHERE m.import_id = i.id AND m.status = 'review') AS to_review
              FROM imports i ORDER BY imported_at`)
    .all()
    .map((r) => ({ id: r.id, file: r.file, importedAt: r.imported_at, review: !!r.review, undoneAt: r.undone_at, models: r.models, toReview: r.to_review }));
}

/** Desfaz um lote: arquiva os itens dele que ainda estavam "a revisar". */
export function undoImport(id) {
  return transaction(() => {
    const n = db.prepare("UPDATE models SET status = 'archived', updated_at = ? WHERE import_id = ? AND status = 'review'").run(now(), id).changes;
    db.prepare('UPDATE imports SET undone_at = ? WHERE id = ?').run(now(), id);
    return n;
  });
}

// ============================== CÓPIA DE SEGURANÇA E EXPORTAÇÃO ==============================
/**
 * Uma cópia do banco por dia em data/backups/, guardando as últimas `keep`.
 * As imagens nunca mudam depois de enviadas, então a cópia delas (backups/uploads/) só acrescenta as novas.
 */
export function backupNow({ keep = 30 } = {}) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `talkbox-${today()}.db`);
  if (!fs.existsSync(file)) db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  const imgDir = path.join(BACKUP_DIR, 'uploads');
  fs.mkdirSync(imgDir, { recursive: true });
  for (const name of fs.readdirSync(UPLOADS_DIR)) {
    const dst = path.join(imgDir, name);
    if (!fs.existsSync(dst)) fs.copyFileSync(path.join(UPLOADS_DIR, name), dst);
  }
  const all = fs.readdirSync(BACKUP_DIR).filter((f) => /^talkbox-\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  for (const old of all.slice(0, Math.max(0, all.length - keep))) fs.unlinkSync(path.join(BACKUP_DIR, old));
  return file;
}

const EXPORT_TABLES = ['students', 'lessons', 'models', 'model_versions', 'imports', 'block_uses', 'assessments', 'handovers', 'pending'];

/** O banco inteiro em JSON (as imagens ficam em data/uploads/). */
export function exportAll() {
  return {
    format: 'talkbox-export',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now(),
    tables: Object.fromEntries(EXPORT_TABLES.map((t) => [t, db.prepare(`SELECT * FROM ${t}`).all()])),
  };
}

export function stats() {
  const n = (sql) => db.prepare(sql).get().n;
  return {
    activeStudents: n('SELECT COUNT(*) AS n FROM students WHERE active = 1'),
    lessons: n('SELECT COUNT(*) AS n FROM lessons WHERE archived_at IS NULL'),
    lessonsDone: n("SELECT COUNT(*) AS n FROM lessons WHERE archived_at IS NULL AND status = 'done'"),
    models: n("SELECT COUNT(*) AS n FROM models WHERE status = 'published'"),
    modelsToReview: n("SELECT COUNT(*) AS n FROM models WHERE status = 'review'"),
    openPending: n("SELECT COUNT(*) AS n FROM pending WHERE status = 'open'"),
  };
}
