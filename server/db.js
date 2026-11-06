// Banco de dados local (SQLite embutido no Node, sem instalar nada a mais).
// Regras (documento "Banco de dados" do projeto):
//   - nada é apagado: aulas e modelos são arquivados; o banco recusa DELETE nas tabelas principais;
//   - o modelo é copiado para a aula, e a tabela block_uses registra de onde veio cada bloco;
//   - o mapa de conteúdos é o resultado das avaliações (handover ou ajuste manual na ficha);
//   - "usado em" e "visto em" são calculados, nunca digitados.
import { stripEmoji, stripEmojiDeep } from './emoji.js';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { canonicalContent, MAP_SECTIONS } from '../web/js/catalog.js';
import { stripBlockMarks, countLiveMarks, comparable } from '../web/js/marks.js';

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
const SCHEMA_VERSION = 7;
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

// ---------- migração 4 (v0.7): pacotes de imagens ----------
// Um pacote junta imagens do acervo (ex.: "Animals"). Uma imagem pode estar em vários pacotes.
// Tirar uma imagem do pacote só marca removed_at (nada é apagado).
if (db.prepare('PRAGMA user_version').get().user_version < 4) {
  transaction(() => {
    db.exec(`
      CREATE TABLE packs (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        keywords    TEXT NOT NULL DEFAULT '[]',   -- etiquetas que valem para o pacote inteiro
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        archived_at TEXT
      );
      CREATE TABLE pack_items (
        pack_id    TEXT NOT NULL,
        model_id   TEXT NOT NULL,
        position   INTEGER NOT NULL,
        added_at   TEXT NOT NULL,
        removed_at TEXT,                          -- preenchido = saiu do pacote
        PRIMARY KEY (pack_id, model_id)
      );
      CREATE INDEX pack_items_by_model ON pack_items (model_id);
      CREATE TRIGGER keep_packs      BEFORE DELETE ON packs      BEGIN SELECT RAISE(ABORT, 'Pacotes não são apagados: arquive.'); END;
      CREATE TRIGGER keep_pack_items BEFORE DELETE ON pack_items BEGIN SELECT RAISE(ABORT, 'Itens de pacote não saem assim: tire do pacote.'); END;
    `);
    // O menu "Novo modelo" criava o modelo antes de ter conteúdo: quem entrava e saía deixava um "Sem título" vazio.
    // Esses modelos vão para o arquivo (imagem sem imagem, ou modelo que nunca foi mexido), se nenhuma aula os usa.
    db.prepare(`UPDATE models SET status = 'archived', updated_at = ?
      WHERE status <> 'archived' AND title = 'Sem título' AND import_id IS NULL
        AND id NOT IN (SELECT model_id FROM block_uses WHERE model_id IS NOT NULL)
        AND ((type = 'image' AND COALESCE(json_extract(block, '$.src'), '') = '') OR updated_at = created_at)`).run(now());
    db.exec('PRAGMA user_version = 4');
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
  SELECT s.*, COALESCE(MAX(CASE WHEN l.status = 'done' THEN l.lesson_date END), MAX(l.lesson_date)) AS last_lesson_at, COUNT(l.id) AS lesson_count
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

/** Nome para comparar: sem acentos, sem diferença de maiúsculas e de espaços ("Júlia" = "julia"). */
export const nameKey = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Aluno (ativo ou inativo) com o mesmo nome, para não cadastrar duas vezes. */
export function findStudentByName(name, exceptId = null) {
  const key = nameKey(name);
  if (!key) return null;
  const row = db.prepare('SELECT id, name, active FROM students').all().find((r) => r.id !== exceptId && nameKey(r.name) === key);
  return row ? { id: row.id, name: row.name, active: !!row.active } : null;
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
    // aulas que vieram do outro cadastro: renumera pela ordem das datas, continuando as aulas de antes da plataforma
    if (moved) {
      const prior = Math.max(into.priorLessons || 0, from.priorLessons || 0);
      if (prior !== (into.priorLessons || 0)) db.prepare('UPDATE students SET prior_lessons = ? WHERE id = ?').run(prior, intoId);
      const rows = db.prepare('SELECT id FROM lessons WHERE student_id = ? AND archived_at IS NULL ORDER BY lesson_date, created_at').all(intoId);
      const setNum = db.prepare('UPDATE lessons SET number = ? WHERE id = ?');
      rows.forEach((r, i) => setNum.run(prior + i + 1, r.id));
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
    const model = b?.ref || b?.source?.modelId;
    if (b?.id) ins.run(lessonId, String(b.id), model ? String(model) : null, i + 1);
  });
}

// ============================== AULA QUE APONTA PARA A BIBLIOTECA (v0.8) ==============================
// No banco, um bloco que veio da biblioteca é só { id, ref } (+ pending, se for retomada de pendência).
// Quem lê a aula (getLesson) recebe o bloco inteiro, montado a partir do modelo. Mudou o modelo, mudou em todas as aulas.
// O modelo só muda na aba Modelos. O que é escrito ou destacado num bloco da biblioteca durante a aula (v0.9) fica
// só nesta aula, no state (state.blocks[id].live), como as respostas: nunca vai para o modelo e nunca é copiado.
// "Voltar ao original" (no bloco ou na aula inteira, depois de exportar o PDF) apaga essa versão da aula.
// Blocos criados na própria aula (anotações, um bloco em branco, "Só nesta aula") continuam inteiros no doc.
const modelRow = db.prepare('SELECT id, title, type, block, status FROM models WHERE id = ?');
const META = ['id', 'type', 'ref', 'source', 'pending', 'local', 'edited'];
const content = (b) => { const c = JSON.parse(JSON.stringify(b || {})); for (const k of META) delete c[k]; return c; };
const unmarked = (b) => { const c = content(b); stripBlockMarks(c); return c; };

/** O bloco inteiro de uma entrada { id, ref } da aula. */
function resolveBlock(entry, state) {
  if (!entry?.ref) return entry;
  const m = modelRow.get(String(entry.ref));
  if (!m) return { ...entry, type: entry.type || 'text', html: '<i>(o modelo desta atividade não foi encontrado)</i>' };
  const live = state?.blocks?.[entry.id]?.live;
  return { ...(live || json(m.block, {})), id: entry.id, type: m.type, ref: m.id, source: { modelId: m.id, title: m.title }, ...(entry.pending ? { pending: entry.pending } : {}), ...(live ? { edited: true } : {}) };
}

/** Ids dos itens do bloco antigo → ids dos itens do modelo (mesma ordem), para as respostas da aula continuarem valendo. */
function remapItemState(state, blockId, from, to) {
  const st = state.blocks?.[blockId];
  if (!st) return;
  let txt = JSON.stringify(st);
  for (const key of ['items', 'pairs', 'images']) {
    (from[key] || []).forEach((it, i) => { const nid = to[key]?.[i]?.id; if (it?.id && nid && it.id !== nid) txt = txt.split(JSON.stringify(it.id)).join(JSON.stringify(nid)); });
  }
  state.blocks[blockId] = JSON.parse(txt);
}

/**
 * Deixa a aula só com referências: { id, ref } para cada bloco da biblioteca. Mexe no state (marca-texto da aula).
 */
function compactDoc(doc, state) {
  const blocks = (doc.blocks || []).map((b0) => {
    if (!b0 || typeof b0 !== 'object') return b0;
    const b = { ...b0 };
    if (b.local) { delete b.ref; return b; }
    // já é só a referência (ex.: uma pendência voltando para a aula)
    if (b.ref && !Object.keys(content(b)).length) return { id: b.id, ref: b.ref, ...(b.pending ? { pending: b.pending } : {}) };
    let m = b.ref ? modelRow.get(String(b.ref)) : null;
    if (!b.ref && b.source?.modelId) {
      // bloco antigo (ou de um pacote): vira referência se for igual ao modelo, fora o marca-texto da aula
      const cand = modelRow.get(String(b.source.modelId));
      const mb = cand && json(cand.block, {});
      if (cand && cand.type === b.type && comparable(unmarked(b)) === comparable(content(mb))) {
        m = cand;
        remapItemState(state, b.id, b, mb);
        b.ref = cand.id;
        // os itens passam a ser os do modelo
        for (const key of ['items', 'pairs', 'images']) if (Array.isArray(mb[key])) b[key] = b[key]?.map((it, i) => ({ ...it, id: mb[key][i]?.id ?? it.id }));
      }
    }
    if (!b.ref) return b;
    if (!m) { delete b.ref; return b; }
    // diferente do modelo (texto mudado ou marca-texto da aula): a versão da aula fica no state, o modelo não muda
    if (comparable(content(b)) !== comparable(content(json(m.block, {})))) ((state.blocks ||= {})[b.id] ||= {}).live = content(b);
    else if (state.blocks?.[b.id]) delete state.blocks[b.id].live;
    return { id: b.id, ref: m.id, ...(b.pending ? { pending: b.pending } : {}) };
  });
  // marca-texto de blocos que saíram da aula não precisa ficar
  const ids = new Set(blocks.map((b) => b?.id));
  for (const [k, v] of Object.entries(state.blocks || {})) if (v?.live && !ids.has(k)) delete v.live;
  const { blocks: _, ...rest } = doc;
  return { ...rest, blocks };
}

/** O bloco que a pendência guarda: só a referência, se veio da biblioteca. */
const pendingBlock = (b) => { const { pending, ...rest } = b; return rest.ref ? { id: rest.id, type: rest.type, ref: rest.ref } : rest; };

const resolveDoc = (doc, state) => ({ ...doc, blocks: (doc.blocks || []).map((b) => resolveBlock(b, state)) });
const stateOut = (state) => {
  const st = JSON.parse(JSON.stringify(state || {}));
  for (const v of Object.values(st.blocks || {})) if (v && typeof v === 'object') delete v.live;
  return st;
};

// ---------- migração 5 (v0.8): aulas que apontam para a biblioteca ----------
// Cada bloco de aula que é igual ao modelo de onde veio (fora o marca-texto da aula) vira só { id, ref }.
// Blocos que foram mudados na aula ficam como estão (com "Voltar ao original" para virar referência).
if (db.prepare('PRAGMA user_version').get().user_version < 5) {
  // antes de reescrever as aulas, uma cópia do banco como ele estava (data/backups/talkbox-antes-v0.8.db)
  const before = path.join(BACKUP_DIR, 'talkbox-antes-v0.8.db');
  if (!fs.existsSync(before) && db.prepare('SELECT COUNT(*) AS n FROM lessons').get().n) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    db.exec(`VACUUM INTO '${before.replace(/'/g, "''")}'`);
  }
  transaction(() => {
    const save = db.prepare('UPDATE lessons SET doc = ?, state = ? WHERE id = ?');
    for (const r of db.prepare('SELECT id, doc, state FROM lessons').all()) {
      const state = json(r.state, {});
      const doc = compactDoc(json(r.doc, { blocks: [] }), state);
      save.run(JSON.stringify(doc), JSON.stringify(state), r.id);
    }
    const savePending = db.prepare('UPDATE pending SET block = ? WHERE id = ?');
    for (const p of db.prepare('SELECT id, block FROM pending').all()) {
      const b = json(p.block, {});
      const out = compactDoc({ blocks: [b] }, {}).blocks[0];
      if (out?.ref) savePending.run(JSON.stringify({ id: out.id, type: b.type, ref: out.ref }), p.id);
    }
    db.exec('PRAGMA user_version = 5');
  });
}

// ---------- migração 6 (v0.9): aulas do curso ----------
// course_number = número da aula no currículo do curso (1 a 100). Aula do curso não tem aluno: ela é o padrão
// que você copia para um aluno ("Dar esta aula"). Não aparece nas listas de aulas dos alunos.
if (db.prepare('PRAGMA user_version').get().user_version < 6) {
  transaction(() => {
    if (!cols('lessons').includes('course_number')) db.exec('ALTER TABLE lessons ADD COLUMN course_number INTEGER');
    db.exec('PRAGMA user_version = 6');
  });
}

// ---------- migração 7 (v1.0): sem emojis no material ----------
// Emojis são proibidos no material. Sai todo emoji dos modelos (a versão anterior fica no histórico do modelo),
// das aulas ainda não dadas, das aulas do curso e das pendências abertas. Aulas já dadas ficam como foram.
if (db.prepare('PRAGMA user_version').get().user_version < 7) {
  const before = path.join(BACKUP_DIR, 'talkbox-antes-v1.0.db');
  if (!fs.existsSync(before) && db.prepare('SELECT COUNT(*) AS n FROM models').get().n) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    db.exec(`VACUUM INTO '${before.replace(/'/g, "''")}'`);
  }
  transaction(() => {
    const keep = db.prepare('INSERT INTO model_versions (model_id, title, block, tags, saved_at) VALUES (?, ?, ?, ?, ?)');
    const saveModel = db.prepare('UPDATE models SET title = ?, block = ? WHERE id = ?');
    for (const m of db.prepare('SELECT id, title, block, tags FROM models').all()) {
      const title = stripEmoji(m.title);
      const block = JSON.stringify(stripEmojiDeep(json(m.block, {})));
      if (title === m.title && block === JSON.stringify(json(m.block, {}))) continue;
      keep.run(m.id, m.title, m.block, m.tags, now());
      saveModel.run(title, block, m.id);
    }
    const saveLesson = db.prepare('UPDATE lessons SET title = ?, doc = ?, state = ? WHERE id = ?');
    for (const l of db.prepare("SELECT id, title, doc, state FROM lessons WHERE status <> 'done' OR course_number IS NOT NULL").all()) {
      const title = stripEmoji(l.title);
      const doc = JSON.stringify(stripEmojiDeep(json(l.doc, {})));
      const state = JSON.stringify(stripEmojiDeep(json(l.state, {})));
      if (title !== l.title || doc !== JSON.stringify(json(l.doc, {})) || state !== JSON.stringify(json(l.state, {}))) saveLesson.run(title, doc, state, l.id);
    }
    const savePending = db.prepare('UPDATE pending SET block = ? WHERE id = ?');
    for (const p of db.prepare("SELECT id, block FROM pending WHERE status = 'open'").all()) {
      const block = JSON.stringify(stripEmojiDeep(json(p.block, {})));
      if (block !== JSON.stringify(json(p.block, {}))) savePending.run(block, p.id);
    }
    db.exec('PRAGMA user_version = 7');
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
    courseNumber: row.course_number ?? null,
    doc: resolveDoc(json(row.doc, { blocks: [] }), json(row.state, {})),
    state: stateOut(json(row.state, {})),
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

export function listLessons({ studentId, limit, course = false } = {}) {
  const where = ['l.archived_at IS NULL', course ? 'l.course_number IS NOT NULL' : 'l.course_number IS NULL'];
  if (studentId) where.push('l.student_id = ?');
  const order = studentId ? 'ORDER BY l.lesson_date DESC, l.created_at DESC' : 'ORDER BY l.updated_at DESC';
  const lim = limit ? `LIMIT ${Number(limit) | 0}` : '';
  return db
    .prepare(`${LESSON_SELECT} WHERE ${where.join(' AND ')} ${order} ${lim}`)
    .all(...(studentId ? [studentId] : []))
    .map(lessonSummary);
}

/** As aulas do curso que já existem (uma por número; se houver duas, vale a mais recente). */
export function listCourse() {
  const out = new Map();
  for (const r of db.prepare('SELECT id, title, course_number, doc, updated_at FROM lessons WHERE course_number IS NOT NULL AND archived_at IS NULL ORDER BY updated_at').all()) {
    const doc = json(r.doc, { blocks: [] });
    out.set(r.course_number, { number: r.course_number, id: r.id, title: r.title, subtitle: doc.subtitle || '', blocks: (doc.blocks || []).length, updatedAt: r.updated_at });
  }
  return [...out.values()].sort((a, b) => a.number - b.number);
}

export function getLesson(id) {
  return lessonOut(db.prepare(`${LESSON_SELECT} WHERE l.id = ? AND l.archived_at IS NULL`).get(id));
}

export function createLesson({ id = newId(), title, studentId = null, doc, state = {}, date, number, status = 'preparing', receivedMessage = '', courseNumber = null }) {
  const name = studentId ? db.prepare('SELECT name FROM students WHERE id = ?').get(studentId)?.name || '' : '';
  if (number === undefined && studentId) {
    // aula arquivada ("excluída") não conta: a próxima aula pega o número dela
    const max = db.prepare('SELECT MAX(number) AS n FROM lessons WHERE student_id = ? AND archived_at IS NULL').get(studentId).n || 0;
    const prior = db.prepare('SELECT prior_lessons AS p FROM students WHERE id = ?').get(studentId)?.p || 0;
    number = Math.max(max, prior) + 1;
  }
  state = JSON.parse(JSON.stringify(state || {}));
  doc = compactDoc(doc, state);
  return transaction(() => {
    db.prepare(
      `INSERT INTO lessons (id, title, student, student_id, doc, state, lesson_date, number, status, received_message, created_at, updated_at, course_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, title, name, studentId, JSON.stringify(doc), JSON.stringify(state), date || today(), number ?? null, status, receivedMessage, now(), now(), courseNumber ?? null);
    syncUses(id, doc);
    return getLesson(id);
  });
}

export function updateLesson(id, patch) {
  const cur = getLesson(id);
  if (!cur) return null;
  const row = db.prepare('SELECT doc, state FROM lessons WHERE id = ?').get(id);
  const stored = json(row.state, {});
  return transaction(() => {
    const title = patch.title === undefined ? cur.title : String(patch.title).trim() || 'Sem título';
    // o marca-texto dos blocos da biblioteca (state.blocks[id].live) é do servidor: o que vem do navegador não vale
    const state = patch.state ? JSON.parse(JSON.stringify(patch.state)) : stored;
    state.blocks ||= {};
    for (const v of Object.values(state.blocks)) if (v && typeof v === 'object') delete v.live;
    for (const [k, v] of Object.entries(stored.blocks || {})) if (v?.live) (state.blocks[k] ||= {}).live = v.live;
    const doc = patch.doc ? compactDoc(patch.doc, state) : json(row.doc, { blocks: [] });
    db.prepare('UPDATE lessons SET title = ?, doc = ?, state = ?, lesson_date = ?, updated_at = ? WHERE id = ?').run(
      title,
      JSON.stringify(doc),
      JSON.stringify(state),
      patch.date ?? cur.date,
      now(),
      id
    );
    if (patch.doc) syncUses(id, doc);
    return getLesson(id);
  });
}

/**
 * Volta os blocos da biblioteca ao original: apaga o que foi escrito e destacado neles nesta aula (state.blocks[id].live).
 * blockIds: só esses blocos; sem blockIds, a aula inteira. As respostas, a caneta e os blocos só desta aula ficam.
 */
export function resetLesson(id, { blockIds = null } = {}) {
  const row = db.prepare('SELECT state FROM lessons WHERE id = ? AND archived_at IS NULL').get(id);
  if (!row) return null;
  const state = json(row.state, {});
  const only = blockIds ? new Set(blockIds.map(String)) : null;
  let reset = 0;
  for (const [k, v] of Object.entries(state.blocks || {})) {
    if (v?.live && (!only || only.has(k))) { delete v.live; reset++; }
  }
  if (reset) db.prepare('UPDATE lessons SET state = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(state), now(), id);
  return { reset, lesson: getLesson(id) };
}

/**
 * "Excluir" uma aula: ela sai das listas, mas fica guardada (regra 2.1).
 * Se ela já tinha sido finalizada, o finalizar é desfeito antes (como no Reabrir): as avaliações dela saem do mapa,
 * os pendentes que ela criou são descartados e os que ela resolveu voltam a ficar pendentes. Assim o mapa e a
 * ficha não ficam apontando para uma aula que não aparece mais.
 */
export function archiveLesson(id) {
  const l = getLesson(id);
  if (!l) return false;
  return transaction(() => {
    if (l.status === 'done') {
      undoHandover(id, now());
      db.prepare("UPDATE lessons SET status = 'preparing' WHERE id = ?").run(id);
    }
    return db.prepare('UPDATE lessons SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL').run(now(), now(), id).changes > 0;
  });
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
        // uma pendência descartada na ficha não volta a contar, mesmo que o bloco ainda esteja na aula
        if (done) {
          const ch = db.prepare("UPDATE pending SET status = 'resolved', resolved_lesson_id = ?, closed_at = ? WHERE id = ? AND status = 'open'").run(lessonId, t, b.pending).changes;
          summary.resolvedPending += ch;
        } else {
          const ch = db.prepare("UPDATE pending SET block = ? WHERE id = ? AND status = 'open'").run(JSON.stringify(pendingBlock(b)), b.pending).changes;
          summary.stillPending += ch;
        }
      } else if (!done && !skipsPending(b)) {
        db.prepare('INSERT INTO pending (id, student_id, lesson_id, block, created_at) VALUES (?, ?, ?, ?, ?)').run(newId(), l.studentId, lessonId, JSON.stringify(pendingBlock(b)), t);
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
    const out = undoHandover(lessonId, t);
    db.prepare("UPDATE lessons SET status = 'preparing', updated_at = ? WHERE id = ?").run(t, lessonId);
    return out;
  });
}

/** O que o Reabrir (e o arquivar de uma aula finalizada) desfaz: handover, avaliações e pendências da aula. */
function undoHandover(lessonId, t) {
  db.prepare('UPDATE handovers SET undone_at = ? WHERE lesson_id = ? AND undone_at IS NULL').run(t, lessonId);
  db.prepare('UPDATE assessments SET voided_at = ? WHERE lesson_id = ? AND voided_at IS NULL').run(t, lessonId);
  const discarded = db.prepare("UPDATE pending SET status = 'discarded', closed_at = ? WHERE lesson_id = ? AND status = 'open'").run(t, lessonId).changes;
  const reopened = db.prepare("UPDATE pending SET status = 'open', resolved_lesson_id = NULL, closed_at = NULL WHERE resolved_lesson_id = ? AND status = 'resolved'").run(lessonId).changes;
  return { discarded, reopened };
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
      const b = resolveBlock(json(p.block, {}), {});
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

// ============================== COPIAR AULA ==============================
// Copiar uma aula (para o mesmo aluno ou para outro) leva só o material, nunca o que aconteceu na aula:
//   - respostas, caneta e tamanho da fonte ficam de fora (estão no "state", que não é copiado);
//   - o bloco de anotações vai vazio e a anotação para a próxima aula não vai;
//   - pendências não vão (a cópia não é a retomada);
//   - blocos que vieram da biblioteca voltam ao modelo original (tira o que foi escrito ou marcado na aula);
//   - nos outros blocos sai o marca-texto feito na aula (as cores do material, em #RRGGBB, ficam).
const textOf = (html) => String(html || '').replace(/<[^>]*>|&nbsp;/g, '').trim();
const liveModel = (id) => (id ? db.prepare("SELECT id, title, block FROM models WHERE id = ? AND status <> 'archived'").get(String(id)) : null);

/** Ids novos para o bloco e para os itens dele. */
function withFreshIds(b) {
  b.id = 'b' + crypto.randomBytes(5).toString('hex');
  for (const key of ['items', 'pairs']) (b[key] || []).forEach((it) => it && (it.id = 'i' + crypto.randomBytes(5).toString('hex')));
  return b;
}

/** O que a cópia vai mudar (para a janela de copiar mostrar antes). */
export function copyInfo(lessonId) {
  const l = getLesson(lessonId);
  if (!l) return null;
  let fromModels = 0, marks = 0, marksFree = 0;
  const changed = [];
  for (const b of l.doc.blocks) {
    if (b.type === 'notes') continue;
    const n = countLiveMarks(b);
    marks += n;
    const m = liveModel(b.source?.modelId);
    if (!m) { marksFree += n; continue; }
    fromModels++;
    if (comparable(json(m.block, {})) !== comparable(b)) changed.push(b.source.title || b.label || b.type);
  }
  return {
    lessonId,
    title: l.title,
    studentId: l.studentId,
    blocks: l.doc.blocks.length,
    fromModels,
    changed,
    marks, // marca-texto feito na aula, em todos os blocos
    marksFree, // só nos blocos que não vieram da biblioteca (os outros voltam ao original)
    notes: l.doc.blocks.some((b) => b.type === 'notes' && textOf(b.html)),
  };
}

/** Os blocos limpos de uma aula (usado na cópia e na limpeza de uma aula). */
function cleanBlocks(blocks, { original = true, keepMarks = false, keepNotes = false, keepLabels = [], freshIds = true } = {}) {
  const report = { restored: 0, marks: 0, notesCleared: false };
  const keep = new Set(keepLabels.map((x) => String(x).trim().toLowerCase()));
  const out = blocks.map((b0) => {
    let b = JSON.parse(JSON.stringify(b0));
    delete b.pending;
    if (b.type === 'notes') {
      if (!keepNotes && textOf(b.html)) { report.notesCleared = true; b.html = ''; }
    } else {
      const m = original && !keep.has(String(b.label || '').trim().toLowerCase()) ? liveModel(b.source?.modelId) : null;
      if (m) {
        const fresh = json(m.block, {});
        if (comparable(fresh) !== comparable(b)) report.restored++;
        b = { ...fresh, id: b.id, type: b.type, source: { modelId: m.id, title: m.title } };
      } else if (!keepMarks) {
        report.marks += stripBlockMarks(b);
      }
    }
    return freshIds ? withFreshIds(b) : b;
  });
  return { blocks: out, report };
}

/**
 * Copia uma aula. studentId: para quem (null = sem aluno). original: blocos da biblioteca voltam ao modelo.
 * keepMarks: mantém o marca-texto feito na aula. Devolve { lesson, report }.
 */
export function copyLesson(lessonId, { studentId = null, title, original = true, keepMarks = false } = {}) {
  const src = getLesson(lessonId);
  if (!src) return null;
  const name = String(title ?? '').trim() || src.title;
  const { blocks, report } = cleanBlocks(src.doc.blocks, { original, keepMarks });
  const lesson = createLesson({ title: name, studentId, doc: { ...src.doc, title: name, blocks } });
  return { lesson, report };
}

/**
 * Limpa uma aula que ainda não foi dada (pacote "clean"): volta os blocos da biblioteca ao original, menos os de
 * keepLabels, tira o marca-texto e esvazia as anotações. Os ids dos blocos ficam os mesmos.
 */
export function cleanLesson(lessonId, opts = {}) {
  const l = getLesson(lessonId);
  if (!l) return null;
  const { blocks, report } = cleanBlocks(l.doc.blocks, { ...opts, freshIds: false });
  updateLesson(lessonId, { doc: { ...l.doc, blocks } });
  return report;
}

// ============================== MODELOS ==============================
// Um modelo é uma atividade pronta (um bloco) com etiquetas. Ao entrar numa aula ele é COPIADO;
// a cópia guarda de onde veio em block.source.modelId (requisitos 7.4).
/** Etiquetas livres: "means of transport, Car, blue" → ['means of transport', 'car', 'blue']. */
export function cleanKeywords(list) {
  const raw = Array.isArray(list) ? list : String(list ?? '').split(',');
  return [...new Set(raw.map((x) => String(x ?? '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean))].slice(0, 40);
}

function cleanTags(t = {}) {
  return {
    content: [...new Set((t.content || []).map((x) => canonicalContent(x)).filter(Boolean))],
    levels: [...new Set((t.levels || []).map(String))],
    skills: [...new Set((t.skills || []).map(String))],
    keywords: cleanKeywords(t.keywords),
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

const allPackItems = db.prepare(`
  SELECT i.model_id, i.pack_id FROM pack_items i JOIN packs p ON p.id = i.pack_id
  WHERE i.removed_at IS NULL AND p.archived_at IS NULL ORDER BY p.name COLLATE NOCASE`);
const packsOfModel = () => {
  const map = new Map();
  for (const r of allPackItems.all()) (map.get(r.model_id) || map.set(r.model_id, []).get(r.model_id)).push(r.pack_id);
  return map;
};

export function listModels({ studentId, status } = {}) {
  const seen = studentId ? new Map(seenOf.all(studentId).map((r) => [r.model_id, r.at])) : null;
  const uses = new Map(allUses.all().map((r) => [r.model_id, r.n]));
  const packs = packsOfModel();
  const where = status && MODEL_STATUSES[status] ? 'status = ?' : "status IN ('published', 'review')";
  return db
    .prepare(`SELECT * FROM models WHERE ${where} ORDER BY updated_at DESC`)
    .all(...(status && MODEL_STATUSES[status] ? [status] : []))
    .map((r) => modelOut(r, { uses: uses.get(r.id) || 0, packs: packs.get(r.id) || [], ...(seen ? { seenAt: seen.get(r.id) || null } : {}) }));
}

export function getModel(id) {
  const r = db.prepare("SELECT * FROM models WHERE id = ? AND status <> 'archived'").get(id);
  if (!r) return null;
  const versions = db
    .prepare('SELECT id, title, saved_at FROM model_versions WHERE model_id = ? ORDER BY saved_at DESC LIMIT 30')
    .all(id)
    .map((v) => ({ id: v.id, title: v.title, savedAt: v.saved_at }));
  return modelOut(r, { uses: usesOf.get(id).n, versions, packs: packsOfModel().get(id) || [] });
}

export function createModel({ title, type, block, tags, status = 'published', importId = null, packIds = [] }) {
  const id = newId();
  const { source, pending, ...clean } = block || {};
  const t = cleanTags(tags);
  return transaction(() => {
    db.prepare(
      'INSERT INTO models (id, title, type, block, tags, status, import_id, needs_content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, title, type, JSON.stringify({ ...clean, type }), JSON.stringify(t), status, importId, t.content.length || t.keywords.length ? 0 : 1, now(), now());
    for (const p of packIds || []) addToPack(p, [id]);
    return getModel(id);
  });
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
    (tags.content || []).length || (tags.keywords || []).length ? 0 : 1,
    now(),
    id
  );
  return getModel(id);
}

export function restoreModelVersion(id, versionId) {
  const cur = db.prepare("SELECT * FROM models WHERE id = ? AND status <> 'archived'").get(id);
  const v = cur && db.prepare('SELECT * FROM model_versions WHERE id = ? AND model_id = ?').get(versionId, id);
  if (!v) return null;
  return transaction(() => {
    // a versão atual também vai para o histórico, para dar para voltar atrás
    db.prepare('INSERT INTO model_versions (model_id, title, block, tags, saved_at) VALUES (?, ?, ?, ?, ?)').run(
      id, cur.title, cur.block, cur.tags, now()
    );
    const tags = cleanTags(json(v.tags, {}));
    db.prepare('UPDATE models SET title = ?, block = ?, tags = ?, needs_content = ?, updated_at = ? WHERE id = ?')
      .run(v.title, v.block, JSON.stringify(tags), tags.content.length || tags.keywords.length ? 0 : 1, now(), id);
    return getModel(id);
  });
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

// ============================== PACOTES DE IMAGENS ==============================
// Um pacote junta imagens do acervo (modelos do tipo imagem), como "Animals". Uma imagem pode estar em vários.
const packItemsOf = db.prepare(`
  SELECT m.* FROM pack_items i JOIN models m ON m.id = i.model_id
  WHERE i.pack_id = ? AND i.removed_at IS NULL AND m.status <> 'archived' ORDER BY i.position, i.added_at`);

const packOut = (r) => {
  if (!r) return r;
  const items = packItemsOf.all(r.id);
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    keywords: cleanKeywords(json(r.keywords, [])),
    count: items.length,
    cover: items.slice(0, 4).map((m) => json(m.block, {}).src).filter(Boolean),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

export function listPacks() {
  return db.prepare('SELECT * FROM packs WHERE archived_at IS NULL ORDER BY name COLLATE NOCASE').all().map(packOut);
}

export function getPack(id) {
  const r = db.prepare('SELECT * FROM packs WHERE id = ? AND archived_at IS NULL').get(id);
  if (!r) return null;
  const uses = new Map(allUses.all().map((x) => [x.model_id, x.n]));
  const packs = packsOfModel();
  return { ...packOut(r), items: packItemsOf.all(id).map((m) => modelOut(m, { uses: uses.get(m.id) || 0, packs: packs.get(m.id) || [] })) };
}

const packByName = (name, exceptId = null) =>
  db.prepare('SELECT id, name FROM packs WHERE archived_at IS NULL').all().find((p) => p.id !== exceptId && nameKey(p.name) === nameKey(name));

export function createPack({ name, description = '', keywords = [] }) {
  const clean = String(name ?? '').trim().slice(0, 80);
  if (!clean) throw new RuleError('Dê um nome ao pacote.');
  if (packByName(clean)) throw new RuleError(`Já existe um pacote chamado "${packByName(clean).name}".`);
  const id = newId();
  db.prepare('INSERT INTO packs (id, name, description, keywords, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, clean, String(description ?? '').trim().slice(0, 500), JSON.stringify(cleanKeywords(keywords)), now(), now());
  return getPack(id);
}

export function updatePack(id, { name, description, keywords } = {}) {
  const cur = db.prepare('SELECT * FROM packs WHERE id = ? AND archived_at IS NULL').get(id);
  if (!cur) return null;
  const next = name === undefined ? cur.name : String(name).trim().slice(0, 80);
  if (!next) throw new RuleError('O nome do pacote não pode ficar vazio.');
  if (packByName(next, id)) throw new RuleError(`Já existe um pacote chamado "${packByName(next, id).name}".`);
  db.prepare('UPDATE packs SET name = ?, description = ?, keywords = ?, updated_at = ? WHERE id = ?').run(
    next,
    description === undefined ? cur.description : String(description).trim().slice(0, 500),
    keywords === undefined ? cur.keywords : JSON.stringify(cleanKeywords(keywords)),
    now(), id);
  return getPack(id);
}

/** "Excluir" um pacote: ele some, as imagens continuam no acervo (e nos outros pacotes). */
export function archivePack(id) {
  return db.prepare('UPDATE packs SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL').run(now(), now(), id).changes > 0;
}

/** Põe imagens num pacote (no fim). Quem já está fica onde está. Só entram modelos de imagem. */
export function addToPack(packId, modelIds = []) {
  const pack = db.prepare('SELECT id FROM packs WHERE id = ? AND archived_at IS NULL').get(packId);
  if (!pack) throw new RuleError('Pacote não encontrado.');
  return transaction(() => {
    let added = 0;
    let pos = db.prepare('SELECT COALESCE(MAX(position), 0) AS n FROM pack_items WHERE pack_id = ?').get(packId).n;
    for (const mid of modelIds) {
      const m = db.prepare("SELECT id, type FROM models WHERE id = ? AND status <> 'archived'").get(String(mid));
      if (!m || m.type !== 'image') continue;
      const cur = db.prepare('SELECT removed_at FROM pack_items WHERE pack_id = ? AND model_id = ?').get(packId, m.id);
      if (cur && cur.removed_at === null) continue;
      if (cur) db.prepare('UPDATE pack_items SET removed_at = NULL, position = ?, added_at = ? WHERE pack_id = ? AND model_id = ?').run(++pos, now(), packId, m.id);
      else db.prepare('INSERT INTO pack_items (pack_id, model_id, position, added_at) VALUES (?, ?, ?, ?)').run(packId, m.id, ++pos, now());
      added++;
    }
    if (added) db.prepare('UPDATE packs SET updated_at = ? WHERE id = ?').run(now(), packId);
    return added;
  });
}

/** Tira imagens de um pacote (elas continuam no acervo). */
export function removeFromPack(packId, modelIds = []) {
  return transaction(() => {
    let n = 0;
    for (const mid of modelIds) {
      n += db.prepare('UPDATE pack_items SET removed_at = ? WHERE pack_id = ? AND model_id = ? AND removed_at IS NULL').run(now(), packId, String(mid)).changes;
    }
    if (n) db.prepare('UPDATE packs SET updated_at = ? WHERE id = ?').run(now(), packId);
    return n;
  });
}

/**
 * Troca o endereço de uma imagem em todo lugar (acervo, aulas e pendências). Usado ao guardar no computador
 * uma imagem que estava na internet: as aulas que já a usam passam a funcionar sem internet.
 */
export function replaceImageSrc(from, to) {
  if (!from || !to || from === to) return { models: 0, lessons: 0, pending: 0 };
  // a imagem pode estar num bloco de imagem ou dentro de uma galeria
  const swap = (b) => {
    if (b?.type === 'image' && b.src === from) { b.src = to; return true; }
    if (b?.type === 'gallery' && Array.isArray(b.images)) {
      let hit = false;
      for (const img of b.images) if (img?.src === from) { img.src = to; hit = true; }
      return hit;
    }
    return false;
  };
  return transaction(() => {
    const out = { models: 0, lessons: 0, pending: 0 };
    for (const m of db.prepare("SELECT id, block FROM models WHERE type IN ('image', 'gallery')").all()) {
      const b = json(m.block, {});
      if (swap(b)) { db.prepare('UPDATE models SET block = ? WHERE id = ?').run(JSON.stringify(b), m.id); out.models++; }
    }
    for (const l of db.prepare('SELECT id, doc FROM lessons').all()) {
      if (!l.doc.includes(from.slice(0, 40))) continue;
      const doc = json(l.doc, {});
      if ((doc.blocks || []).map(swap).some(Boolean)) { db.prepare('UPDATE lessons SET doc = ? WHERE id = ?').run(JSON.stringify(doc), l.id); out.lessons++; }
    }
    for (const p of db.prepare('SELECT id, block FROM pending').all()) {
      const b = json(p.block, {});
      if (swap(b)) { db.prepare('UPDATE pending SET block = ? WHERE id = ?').run(JSON.stringify(b), p.id); out.pending++; }
    }
    return out;
  });
}

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

const EXPORT_TABLES = ['students', 'lessons', 'models', 'model_versions', 'imports', 'block_uses', 'assessments', 'handovers', 'pending', 'packs', 'pack_items'];

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
    images: n("SELECT COUNT(*) AS n FROM models WHERE type = 'image' AND status = 'published'"),
    packs: n('SELECT COUNT(*) AS n FROM packs WHERE archived_at IS NULL'),
  };
}
