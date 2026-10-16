// Pacotes de conteúdo: aulas prontas que chegam pelo repositório (pasta content/).
// Ao iniciar, o servidor importa cada pacote novo UMA vez: cria (ou reaproveita) o aluno,
// salva as atividades na biblioteca de Modelos e monta a aula copiando esses modelos.
//
// Formato de um pacote (content/*.json):
// {
//   "id": "identificador-unico",
//   "student": { "name": "Victor", "level": "B2", "goal": "...", "notes": "..." },
//   "models": [ { "key": "x", "title": "...", "tags": { "content": [], "levels": [], "skills": [] }, "block": { "type": "fill", ... } } ],
//   "lesson": { "title": "...", "subtitle": "...", "level": "B2", "tags": [], "blocks": [ { "model": "x" }, { "type": "notes", ... } ],
//               "date": "2026-10-13", "number": 23,                       (opcionais)
//               "finished": { "last": "x" | "all" | null, "assessments": { "Past Simple": "practicing" }, "message": "" } }  (opcional)
//   "review": true   (opcional: os modelos entram "a revisar", como na importação do Drive)
// }
// Imagens: { "type": "image", "file": "images/x.webp", "caption": "...", "layout": "full" | "half" }, com o arquivo
// em WebP dentro de content/. Na importação ele é copiado para data/uploads/ (uma vez só) e vira "src".
// Modelos sem etiqueta de conteúdo recebem as que forem citadas no título ou no texto (pelos sinônimos).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import { bid } from './templates.js';
import { contentsInText } from '../web/js/catalog.js';

const DEFAULT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const CONTENT_DIR = process.env.TALKBOX_CONTENT ? path.resolve(process.env.TALKBOX_CONTENT) : DEFAULT_DIR;


/** Dá ids para o bloco e para os itens internos que vierem sem id. */
function withIds(block) {
  const b = JSON.parse(JSON.stringify(block));
  b.id ||= bid();
  for (const key of ['items', 'pairs']) (b[key] || []).forEach((it) => (it.id ||= bid()));
  return b;
}

/**
 * Imagem do pacote: um bloco de imagem pode trazer "file" (WebP, caminho relativo à pasta content/).
 * O arquivo vai para o acervo com o nome = impressão digital, como no envio pelo app,
 * então a mesma imagem nunca é guardada duas vezes.
 */
function withMedia(block, dir) {
  if (block.type !== 'image' || !block.file) return block;
  const src = path.resolve(dir, block.file);
  if (!src.startsWith(path.resolve(dir) + path.sep)) throw new Error(`Imagem fora da pasta content/: ${block.file}`);
  if (!fs.existsSync(src)) throw new Error(`Imagem não encontrada: ${block.file}`);
  if (path.extname(src).toLowerCase() !== '.webp') throw new Error(`A imagem precisa estar em WebP: ${block.file}`);
  const buf = fs.readFileSync(src);
  const name = `${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32)}.webp`;
  const dst = path.join(db.UPLOADS_DIR, name);
  if (!fs.existsSync(dst)) {
    fs.mkdirSync(db.UPLOADS_DIR, { recursive: true });
    fs.writeFileSync(dst, buf);
  }
  const { file, ...rest } = block;
  return { ...rest, src: `/uploads/${name}` };
}

export function importPack(pack, file = '', dir = CONTENT_DIR) {
  if (!pack?.id) throw new Error(`Pacote sem "id" (${file})`);
  if (db.db.prepare('SELECT 1 FROM imports WHERE id = ?').get(pack.id)) return null;

  return db.transaction(() => {
    db.db.prepare('INSERT INTO imports (id, file, imported_at, review) VALUES (?, ?, ?, ?)').run(pack.id, file, new Date().toISOString(), pack.review ? 1 : 0);

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
      const block = withMedia(withIds(m.block), dir);
      const tags = { ...(m.tags || {}) };
      if (!(tags.content || []).length) tags.content = contentsInText(`${m.title} ${JSON.stringify(block)}`);
      models[m.key] = db.createModel({
        title: m.title, type: block.type, block, tags,
        status: pack.review ? 'review' : 'published',
        importId: pack.id,
      });
    }

    let lesson = null;
    if (pack.lesson) {
      const keyOfBlock = [];
      const blocks = (pack.lesson.blocks || []).map((entry) => {
        if (entry.model) {
          const m = models[entry.model];
          if (!m) throw new Error(`Modelo "${entry.model}" não existe no pacote ${pack.id}`);
          const copy = JSON.parse(JSON.stringify(m.block));
          copy.id = bid();
          for (const key of ['items', 'pairs']) (copy[key] || []).forEach((it) => (it.id = bid()));
          copy.source = { modelId: m.id, title: m.title };
          keyOfBlock.push(entry.model);
          return copy;
        }
        keyOfBlock.push(entry.key || null);
        return withMedia(withIds(entry), dir);
      });
      lesson = db.createLesson({
        title: pack.lesson.title,
        studentId: student?.id || null,
        date: pack.lesson.date,
        number: pack.lesson.number,
        doc: {
          v: 1,
          title: pack.lesson.title,
          subtitle: pack.lesson.subtitle || '',
          level: pack.lesson.level || student?.level || '',
          tags: pack.lesson.tags || [],
          blocks,
        },
      });
      const fin = pack.lesson.finished;
      if (fin && student) {
        let lastBlockId = null;
        if (fin.last === 'all') lastBlockId = blocks.at(-1)?.id || null;
        else if (fin.last) {
          const i = keyOfBlock.lastIndexOf(fin.last);
          if (i < 0) throw new Error(`"finished.last" aponta para "${fin.last}", que não está na aula (${pack.id})`);
          lastBlockId = blocks[i].id;
        }
        db.finishLesson(lesson.id, { lastBlockId, assessments: fin.assessments || {}, message: fin.message || '' });
      }
    }
    return { student, models: Object.keys(models).length, lesson };
  });
}

export function importContentDir(dir = CONTENT_DIR) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    try {
      const pack = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
      const out = importPack(pack, name, dir);
      if (out) {
        const who = out.student ? ` para ${out.student.name}` : '';
        console.log(`  Conteúdo novo importado${who}: ${out.lesson ? `aula "${out.lesson.title}"` : 'sem aula'} + ${out.models} modelos (${name})`);
      }
    } catch (err) {
      console.error(`  Não consegui importar ${name}: ${err.message}`);
    }
  }
}
