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
// Cadastro em lote: um pacote só com "students": [ { "name": "Ana" }, ... ] cria os alunos que ainda não existem
// (mesmo nome, sem diferenciar maiúsculas, é reaproveitado). Pode vir junto com os campos acima.
// Acrescentar a uma aula existente: "append": { "student", "lesson" (título ou começo dele), "blocks": [ { "model": "x" } ] }.
// Renomear: "rename": [ { "from": "William & Letícia", "to": "William" } ] muda o nome e mantém aulas, mapa e histórico.
// Roda antes do cadastro. Se "from" não existe ou "to" já existe, não faz nada.
// Juntar cadastros repetidos: "merge": [ { "from": "Júlia", "into": "Julia", "name": "Júlia" } ] passa aulas, mapa e
// pendências do "from" para o "into" (que fica com o nome "name", se vier). O "from" fica inativo como
// "<nome> (cadastro repetido)". Roda antes do "rename". Se um dos dois não existe, não faz nada.
// Histórico de antes da plataforma: "profiles": [ { "name": "Ana", "level": "A1", "map": { "Present Simple": "good" },
// "priorLessons": 5 } ] atualiza a ficha (nível; mapa só sobe, nunca desce) e renumera as aulas da plataforma a partir
// de priorLessons + 1. Alunos inativos ou que não existem são pulados.
// Copiar de outro aluno: { "name": "Letícia", "copyFrom": "William" } cria o aluno com o nível, o objetivo e o mapa
// de conteúdos do outro (as aulas continuam só no original).
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

    const findOrCreate = (s) => {
      const found = db.listStudents().find((x) => x.name.toLowerCase() === s.name.trim().toLowerCase());
      if (found) return { student: found, created: false };
      return { student: db.createStudent({ name: s.name.trim(), level: s.level || '', goal: s.goal || '', notes: s.notes || '' }), created: true };
    };

    const byName = (name) => db.listStudents().find((x) => x.name.toLowerCase() === String(name || '').trim().toLowerCase());
    for (const m of pack.merge || []) {
      const from = byName(m.from);
      const into = byName(m.into);
      if (from && into && from.id !== into.id) db.mergeStudents(from.id, into.id, m.name);
    }
    for (const r of pack.rename || []) {
      const from = byName(r.from);
      if (from && r.to?.trim() && !byName(r.to)) db.updateStudent(from.id, { name: r.to.trim() });
    }

    let created = 0;
    for (const s of pack.students || []) {
      if (!s?.name?.trim()) continue;
      const src = s.copyFrom ? byName(s.copyFrom) : null;
      const base = src ? { level: src.level, goal: src.goal, ...s } : s;
      const out = findOrCreate(base);
      if (out.created) {
        created++;
        if (src) db.copyMap(src.id, out.student.id);
      }
    }

    for (const p of pack.profiles || []) {
      const s = byName(p.name);
      if (s?.active) db.applyProfile(s.id, { level: p.level, map: p.map, priorLessons: p.priorLessons });
    }

    let student = null;
    if (pack.student?.name) student = findOrCreate(pack.student).student;

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
    // Acrescentar a uma aula que já existe: "append": { "student": "Thiago Santos", "lesson": "Present Perfect (part 1)…", "blocks": [ { "model": "x" } ] }
    // Os blocos entram antes do bloco de anotações (ou no fim). Procura a aula pelo título (ou pelo começo dele), a mais recente.
    if (pack.append) {
      const who = byName(pack.append.student);
      if (!who) throw new Error(`"append": aluno "${pack.append.student}" não encontrado (${pack.id})`);
      const want = String(pack.append.lesson || '').trim().toLowerCase();
      const target = db.listLessons({ studentId: who.id }).find((l) => l.title.toLowerCase() === want || (want && l.title.toLowerCase().startsWith(want)));
      if (!target) throw new Error(`"append": aula "${pack.append.lesson}" de ${who.name} não encontrada (${pack.id})`);
      const full = db.getLesson(target.id);
      const add = (pack.append.blocks || []).map((entry) => {
        const m = models[entry.model];
        if (!m) throw new Error(`Modelo "${entry.model}" não existe no pacote ${pack.id}`);
        const copy = JSON.parse(JSON.stringify(m.block));
        copy.id = bid();
        for (const key of ['items', 'pairs']) (copy[key] || []).forEach((it) => (it.id = bid()));
        copy.source = { modelId: m.id, title: m.title };
        return copy;
      });
      const blocks = [...full.doc.blocks];
      const notesAt = blocks.findIndex((b) => b.type === 'notes');
      blocks.splice(notesAt < 0 ? blocks.length : notesAt, 0, ...add);
      lesson = db.updateLesson(full.id, { doc: { ...full.doc, blocks } });
      student = who;
    }
    return { student, created, models: Object.keys(models).length, lesson };
  });
}

export function importContentDir(dir = CONTENT_DIR) {
  if (!fs.existsSync(dir)) return;
  // pacotes que acrescentam a uma aula ("append") vêm por último: a aula já precisa existir
  const packs = [];
  for (const name of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
    try {
      packs.push({ name, pack: JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) });
    } catch (err) {
      console.error(`  Não consegui ler ${name}: ${err.message}`);
    }
  }
  packs.sort((a, b) => (a.pack.append ? 1 : 0) - (b.pack.append ? 1 : 0));
  for (const { name, pack } of packs) {
    try {
      const out = importPack(pack, name, dir);
      if (out?.created) console.log(`  Alunos cadastrados: ${out.created} (${name})`);
      if (out && (out.lesson || out.models)) {
        const who = out.student ? ` para ${out.student.name}` : '';
        console.log(`  Conteúdo novo importado${who}: ${out.lesson ? `${pack.append ? 'blocos novos na aula' : 'aula'} "${out.lesson.title}"` : 'sem aula'} + ${out.models} modelos (${name})`);
      }
    } catch (err) {
      console.error(`  Não consegui importar ${name}: ${err.message}`);
    }
  }
}
