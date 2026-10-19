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
const LESSON_PACKS = PACKS.filter((p) => p.lesson);
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
    assert.equal(full.doc.blocks.length, pack.lesson.blocks.length);
    const fromModels = full.doc.blocks.filter((b) => b.source?.modelId);
    assert.equal(fromModels.length, pack.lesson.blocks.filter((b) => b.model).length);
    const ids = new Set(full.doc.blocks.map((b) => b.id));
    assert.equal(ids.size, full.doc.blocks.length, 'ids únicos');
  }
});

test('respostas dos exercícios estão coerentes', () => {
  for (const pack of LESSON_PACKS) {
    for (const m of pack.models) {
      const b = m.block;
      if (b.type === 'choice') b.items.forEach((it) => assert.ok(it.options[it.answer] !== undefined, `${m.title}: ${it.before}`));
      if (b.type === 'fill') b.items.forEach((it) => assert.ok(it.answers.length > 0 && it.hint, `${m.title}: ${it.before}`));
      if (b.type === 'match') assert.ok(b.pairs.length >= 3 && b.pairs.every((p) => p.left && p.right));
      if (b.type === 'deck') assert.ok(b.cats.every((c) => c.qs.length));
      if (b.type === 'challenge') assert.ok(b.lines.length && b.prompts.length);
      if (b.type === 'image') assert.ok(b.src || fs.existsSync(path.join('content', b.file || '')), `${m.title}: imagem ${b.file}`);
    }
  }
});

test('imagens do pacote entram no acervo e a aula aponta para elas', async () => {
  for (const pack of LESSON_PACKS) {
    const files = pack.models.filter((m) => m.block.type === 'image' && m.block.file);
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

test('ao reiniciar, o pacote não é importado de novo', async () => {
  const before = (await get('/api/models')).length;
  await stop();
  await start();
  assert.equal((await get('/api/models')).length, before);
  const lessons = await get('/api/lessons');
  for (const pack of LESSON_PACKS) assert.equal(lessons.filter((l) => l.title === pack.lesson.title).length, 1);
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
