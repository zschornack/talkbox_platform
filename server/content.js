// Pacotes de conteúdo: aulas prontas que chegam pelo repositório (pasta content/).
// Ao iniciar, o servidor importa cada pacote novo UMA vez: cria (ou reaproveita) o aluno,
// salva as atividades na biblioteca de Modelos e monta a aula copiando esses modelos.
//
// Formato de um pacote (content/*.json):
// {
//   "id": "identificador-unico",
//   "student": { "name": "Victor", "level": "B2", "goal": "...", "notes": "..." },
//   "models": [ { "key": "x", "title": "...", "tags": { "content": [], "levels": [], "skills": [] }, "block": { "type": "fill", ... } } ],
//   "lesson": { "title": "...", "subtitle": "...", "level": "B2", "tags": [], "blocks": [ { "model": "x" }, { "type": "notes", ... } ] }
// }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import { bid } from './templates.js';

const DEFAULT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const CONTENT_DIR = process.env.TALKBOX_CONTENT ? path.resolve(process.env.TALKBOX_CONTENT) : DEFAULT_DIR;

db.db.exec('CREATE TABLE IF NOT EXISTS imports (id TEXT PRIMARY KEY, file TEXT NOT NULL, imported_at TEXT NOT NULL)');

/** Dá ids para o bloco e para os itens internos que vierem sem id. */
function withIds(block) {
  const b = JSON.parse(JSON.stringify(block));
  b.id ||= bid();
  for (const key of ['items', 'pairs']) (b[key] || []).forEach((it) => (it.id ||= bid()));
  return b;
}

export function importPack(pack, file = '') {
  if (!pack?.id) throw new Error(`Pacote sem "id" (${file})`);
  if (db.db.prepare('SELECT 1 FROM imports WHERE id = ?').get(pack.id)) return null;

  db.db.exec('BEGIN');
  try {
    let student = null;
    if (pack.student?.name) {
      const found = db.listStudents().find((s) => s.name.toLowerCase() === pack.student.name.toLowerCase());
      student = found || db.createStudent({
        name: pack.student.name,
        level: pack.student.level || '',
        goal: pack.student.goal || '',
        notes: pack.student.notes || '',
      });
    }

    const models = {};
    for (const m of pack.models || []) {
      const block = withIds(m.block);
      models[m.key] = db.createModel({ title: m.title, type: block.type, block, tags: m.tags });
    }

    let lesson = null;
    if (pack.lesson) {
      const blocks = (pack.lesson.blocks || []).map((entry) => {
        if (entry.model) {
          const m = models[entry.model];
          if (!m) throw new Error(`Modelo "${entry.model}" não existe no pacote ${pack.id}`);
          const copy = JSON.parse(JSON.stringify(m.block));
          copy.id = bid();
          for (const key of ['items', 'pairs']) (copy[key] || []).forEach((it) => (it.id = bid()));
          copy.source = { modelId: m.id, title: m.title };
          return copy;
        }
        return withIds(entry);
      });
      lesson = db.createLesson({
        title: pack.lesson.title,
        studentId: student?.id || null,
        doc: {
          v: 1,
          title: pack.lesson.title,
          subtitle: pack.lesson.subtitle || '',
          level: pack.lesson.level || student?.level || '',
          tags: pack.lesson.tags || [],
          blocks,
        },
      });
    }

    db.db.prepare('INSERT INTO imports (id, file, imported_at) VALUES (?, ?, ?)').run(pack.id, file, new Date().toISOString());
    db.db.exec('COMMIT');
    return { student, models: Object.keys(models).length, lesson };
  } catch (err) {
    db.db.exec('ROLLBACK');
    throw err;
  }
}

export function importContentDir(dir = CONTENT_DIR) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    try {
      const pack = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      const out = importPack(pack, name);
      if (out) {
        const who = out.student ? ` para ${out.student.name}` : '';
        console.log(`  Conteúdo novo importado${who}: ${out.lesson ? `aula "${out.lesson.title}"` : 'sem aula'} + ${out.models} modelos (${name})`);
      }
    } catch (err) {
      console.error(`  Não consegui importar ${name}: ${err.message}`);
    }
  }
}
