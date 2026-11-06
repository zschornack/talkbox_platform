// Pacotes de conteúdo (pasta content/): importados uma vez, com a aula montada a partir dos modelos.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3800 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-content-'));
const PACKS = fs.readdirSync('content').filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join('content', f), 'utf8')));
// nomes renomeados por algum pacote ("rename") contam pelo nome novo
const RENAMED = new Map(PACKS.flatMap((p) => p.rename || []).map((r) => [r.from.toLowerCase(), r.to]));
const ROSTER = PACKS.filter((p) => p.students).flatMap((p) => p.students)
  .map((s) => ({ ...s, name: RENAMED.get(s.name.toLowerCase()) || s.name }));
const LESSON_PACKS = PACKS.filter((p) => p.lesson && p.student);
const COURSE_PACKS = PACKS.filter((p) => p.lesson && p.course);
let proc;

async function start() {
  proc = spawn(process.execPath, ['server/start.js'], { env: { ...process.env, PORT: String(PORT), TALKBOX_DATA: DATA }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/lessons'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('servidor não subiu');
}
const stop = () => new Promise((r) => { proc.once('exit', r); proc.kill(); });
const get = async (url) => (await fetch(BASE + url)).json();

before(start);
after(async () => { await stop(); fs.rmSync(DATA, { recursive: true, force: true }); });

test('cada pacote vira aluno + aula + modelos, e a aula usa os modelos', async () => {
  for (const pack of LESSON_PACKS) {
    const students = await get('/api/students');
    const s = students.find((x) => x.name === pack.student.name);
    assert.ok(s, `aluno ${pack.student.name} criado`);
    const ficha = await get(`/api/students/${s.id}`);
    const lesson = ficha.lessons.find((l) => l.title === pack.lesson.title);
    assert.ok(lesson, 'aula criada');
    const full = await get(`/api/lessons/${lesson.id}`);
    // pacotes "append" acrescentam blocos a esta aula
    const appended = PACKS.filter((p) => p.append && p.append.student === pack.student.name && pack.lesson.title.toLowerCase().startsWith(p.append.lesson.toLowerCase()))
      .reduce((n, p) => n + p.append.blocks.length, 0);
    assert.equal(full.doc.blocks.length, pack.lesson.blocks.length + appended);
    // blocos retomados de pendências ("pending") apontam para modelos do banco do professor: aqui (banco de teste) não contam
    const fromModels = full.doc.blocks.filter((b) => b.source?.modelId && !b.pending);
    assert.equal(fromModels.length, pack.lesson.blocks.filter((b) => (b.model || b.ref || b.source?.modelId) && !b.pending).length + appended);
    if (appended) assert.equal(full.doc.blocks.at(-1).type, 'notes', 'o que foi acrescentado entra antes das anotações');
    const ids = new Set(full.doc.blocks.map((b) => b.id));
    assert.equal(ids.size, full.doc.blocks.length, 'ids únicos');
  }
});

test('aulas do curso: sem aluno, no roteiro, fora das listas de aulas e com as imagens no acervo', async () => {
  const course = await get('/api/course');
  for (const pack of COURSE_PACKS) {
    const c = course.find((x) => x.number === pack.course.number);
    assert.ok(c, `aula ${pack.course.number} do curso no roteiro`);
    assert.equal(c.title, pack.lesson.title);
    const full = await get(`/api/lessons/${c.id}`);
    assert.equal(full.studentId, null);
    assert.equal(full.courseNumber, pack.course.number);
    assert.equal(full.doc.blocks.length, pack.lesson.blocks.length);
    assert.equal(full.doc.blocks.filter((b) => b.ref).length, pack.lesson.blocks.filter((b) => b.model).length, 'blocos do curso apontam para a biblioteca');
    for (const b of full.doc.blocks.filter((x) => x.type === 'gallery' || x.type === 'image')) {
      // fotos da internet (Wikimedia Commons) não são conferidas aqui: o teste roda sem internet
      for (const src of (b.type === 'image' ? [b.src] : b.images.map((i) => i.src)).filter((x) => x.startsWith('/'))) assert.equal((await fetch(BASE + src)).status, 200, src);
    }
  }
  const all = await get('/api/lessons');
  assert.ok(!all.some((l) => course.some((c) => c.id === l.id)), 'aulas do curso não aparecem na lista de aulas');
});

test('respostas dos exercícios estão coerentes', () => {
  for (const pack of [...LESSON_PACKS, ...COURSE_PACKS]) {
    for (const m of pack.models || []) {
      const b = m.block;
      if (b.type === 'choice') b.items.forEach((it) => assert.ok(it.options[it.answer] !== undefined, `${m.title}: ${it.before}`));
      // a dica é opcional (num diálogo, o contexto é a dica): sem dica, a lacuna não mostra os parênteses
      if (b.type === 'fill') b.items.forEach((it) => assert.ok(it.answers.length > 0 && typeof (it.hint ?? '') === 'string', `${m.title}: ${it.before}`));
      if (b.type === 'match') assert.ok(b.pairs.length >= 3 && b.pairs.every((p) => p.left && p.right));
      if (b.type === 'deck') assert.ok(b.cats.every((c) => c.qs.length));
      if (b.type === 'challenge') assert.ok(b.lines.length && b.prompts.length);
      if (b.type === 'image') assert.ok(b.src || fs.existsSync(path.join('content', b.file || '')), `${m.title}: imagem ${b.file}`);
    }
  }
});

test('imagens do pacote entram no acervo e a aula aponta para elas', async () => {
  for (const pack of LESSON_PACKS) {
    const files = (pack.models || []).filter((m) => m.block.type === 'image' && m.block.file);
    if (!files.length) continue;
    const s = (await get('/api/students')).find((x) => x.name === pack.student.name);
    const lesson = (await get(`/api/students/${s.id}`)).lessons.find((l) => l.title === pack.lesson.title);
    const imgs = (await get(`/api/lessons/${lesson.id}`)).doc.blocks.filter((b) => b.type === 'image');
    assert.equal(imgs.length, pack.lesson.blocks.filter((e) => files.some((m) => m.key === e.model)).length);
    for (const b of imgs) {
      assert.match(b.src, /^\/uploads\/[0-9a-f]{32}\.webp$/);
      assert.equal(b.file, undefined, 'o caminho do pacote não fica no bloco');
      const res = await fetch(BASE + b.src);
      assert.equal(res.status, 200, b.src);
      assert.ok((await res.arrayBuffer()).byteLength > 1000);
    }
  }
});

test('galerias do pacote: cada imagem com "file" vai para o acervo de arquivos', async () => {
  let seen = 0;
  for (const pack of LESSON_PACKS) {
    const gals = (pack.models || []).filter((m) => m.block.type === 'gallery' && (m.block.images || []).some((i) => i.file));
    if (!gals.length) continue;
    const s = (await get('/api/students')).find((x) => x.name === pack.student.name);
    const lesson = (await get(`/api/students/${s.id}`)).lessons.find((l) => l.title === pack.lesson.title);
    const blocks = (await get(`/api/lessons/${lesson.id}`)).doc.blocks.filter((b) => b.type === 'gallery');
    assert.equal(blocks.length, pack.lesson.blocks.filter((e) => gals.some((m) => m.key === e.model)).length);
    for (const b of blocks) {
      for (const img of b.images) {
        assert.match(img.src, /^\/uploads\/[0-9a-f]{32}\.webp$/);
        assert.equal(img.file, undefined, 'o caminho do pacote não fica na galeria');
        assert.equal((await fetch(BASE + img.src)).status, 200, img.src);
        seen++;
      }
    }
  }
  assert.ok(seen > 0, 'algum pacote tem galeria com imagens');
});

test('ao reiniciar, o pacote não é importado de novo', async () => {
  const before = (await get('/api/models')).length;
  await stop();
  await start();
  assert.equal((await get('/api/models')).length, before);
  const lessons = await get('/api/lessons');
  // a mesma aula pode ter sido copiada para outro aluno: conta quantos pacotes trazem aquele título
  for (const pack of LESSON_PACKS) assert.equal(lessons.filter((l) => l.title === pack.lesson.title).length, LESSON_PACKS.filter((p) => p.lesson.title === pack.lesson.title).length);
  assert.equal((await get('/api/course')).length, new Set(COURSE_PACKS.map((p) => p.course.number)).size, 'aulas do curso não duplicam');
  const students = await get('/api/students');
  for (const s of ROSTER) assert.equal(students.filter((x) => x.name.toLowerCase() === s.name.toLowerCase()).length, 1, `${s.name} uma vez só`);
});

test('cadastro em lote cria todos os alunos, sem duplicar quem já veio num pacote de aula', async () => {
  const students = await get('/api/students');
  const names = students.map((s) => s.name.toLowerCase());
  for (const s of ROSTER) assert.ok(names.includes(s.name.toLowerCase()), `${s.name} cadastrado`);
  for (const from of RENAMED.keys()) assert.ok(!names.includes(from), `${from} foi renomeado`);
  for (const pack of LESSON_PACKS) assert.equal(names.filter((n) => n === pack.student.name.toLowerCase()).length, 1);
});

test('emojis são proibidos: o material importado sai sem nenhum', async () => {
  const models = await get('/api/models');
  const emoji = /\p{Extended_Pictographic}/u;
  const bad = models.filter((m) => [...JSON.stringify([m.title, m.block])].some((ch) => emoji.test(ch) && !/[©®™←-⇿]/.test(ch)));
  assert.deepEqual(bad.map((m) => m.title), []);
});
