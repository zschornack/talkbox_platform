// Correções da revisão do banco e do servidor (v0.7).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4400 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-fixes-'));
const CONTENT = path.join(DATA, 'content');
fs.mkdirSync(CONTENT);
let proc;

async function start() {
  proc = spawn(process.execPath, ['server/start.js'], { env: { ...process.env, PORT: String(PORT), TALKBOX_DATA: DATA, TALKBOX_CONTENT: CONTENT }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/lessons'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('servidor não subiu');
}
const stop = () => new Promise((r) => { proc.once('exit', r); proc.kill(); });
before(start);
after(async () => { await stop(); fs.rmSync(DATA, { recursive: true, force: true }); });

const call = async (method, url, body) => {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const ok = async (...a) => {
  const r = await call(...a);
  assert.ok(r.status < 300, `${a[0]} ${a[1]} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};

test('o mesmo nome não é cadastrado duas vezes (sem diferenciar acentos e maiúsculas)', async () => {
  const a = await ok('POST', '/api/students', { name: 'Letícia' });
  const dup = await call('POST', '/api/students', { name: '  leticia ' });
  assert.equal(dup.status, 400);
  assert.match(dup.body.error, /Já existe um aluno com esse nome: Letícia/);
  await ok('PUT', `/api/students/${a.id}`, { active: false });
  assert.match((await call('POST', '/api/students', { name: 'LETÍCIA' })).body.error, /inativo.*Reative/);
  const b = await ok('POST', '/api/students', { name: 'William' });
  assert.equal((await call('PUT', `/api/students/${b.id}`, { name: 'Leticia' })).status, 400, 'renomear para um nome que já existe');
  assert.equal((await call('PUT', `/api/students/${b.id}`, { name: 'William' })).status, 200, 'manter o próprio nome');
});

test('arquivar uma aula finalizada desfaz o finalizar: o mapa e as pendências voltam', async () => {
  const s = await ok('POST', '/api/students', { name: 'Bia' });
  const m = await ok('POST', '/api/models', { title: 'Fill', type: 'fill', block: { type: 'fill', items: [] }, tags: { content: ['Past Simple'] } });
  const l1 = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'Aula 1' });
  l1.doc.blocks = [{ ...m.block, id: 'a', source: { modelId: m.id, title: 'Fill' } }, { id: 'b', type: 'text', html: 'later' }];
  await ok('PUT', `/api/lessons/${l1.id}`, { doc: l1.doc });
  await ok('POST', `/api/lessons/${l1.id}/finish`, { lastBlockId: 'a', assessments: { 'Past Simple': 'good' }, message: 'oi' });
  let ficha = await ok('GET', `/api/students/${s.id}`);
  assert.equal(ficha.map['Past Simple'], 'good');
  assert.equal(ficha.stop.pending.length, 1);

  await ok('DELETE', `/api/lessons/${l1.id}`);
  ficha = await ok('GET', `/api/students/${s.id}`);
  assert.equal(ficha.map['Past Simple'], undefined, 'a avaliação da aula arquivada sai do mapa');
  assert.equal(ficha.stop.pending.length, 0, 'o pendente que ela criou sai');
  assert.equal(ficha.stop.lesson, null);
  assert.equal((await call('GET', `/api/lessons/${l1.id}`)).status, 404);

  // a próxima aula pega o número da que foi arquivada
  const l2 = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'Aula de novo' });
  assert.equal(l2.number, 1);
});

test('pendência descartada não conta no resumo do finalizar', async () => {
  const s = await ok('POST', '/api/students', { name: 'Caio' });
  const l1 = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'A' });
  l1.doc.blocks = [{ id: 'x', type: 'text', html: 'um' }, { id: 'y', type: 'text', html: 'dois' }];
  await ok('PUT', `/api/lessons/${l1.id}`, { doc: l1.doc });
  await ok('POST', `/api/lessons/${l1.id}/finish`, { lastBlockId: null, assessments: {} });
  const l2 = await ok('POST', `/api/students/${s.id}/next-lesson`, { title: 'B' });
  const pend = (await ok('GET', `/api/students/${s.id}`)).stop.pending;
  assert.equal(pend.length, 2);
  await ok('POST', `/api/pending/${pend[0].id}/discard`);
  const lastPending = l2.doc.blocks.filter((b) => b.pending).at(-1);
  const fin = await ok('POST', `/api/lessons/${l2.id}/finish`, { lastBlockId: l2.doc.blocks[0].id, assessments: {} });
  assert.equal(fin.resolvedPending, 0, 'a primeira foi descartada antes');
  assert.equal(fin.stillPending, 1);
  assert.ok(lastPending);
});

test('juntar cadastros continua a contagem do Drive', async () => {
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'));
  const t = new Date().toISOString();
  db.prepare("INSERT INTO students (id, name, prior_lessons, created_at, updated_at) VALUES ('j1', 'Joana', 20, ?, ?)").run(t, t);
  db.prepare("INSERT INTO students (id, name, created_at, updated_at) VALUES ('j2', 'Joaná', ?, ?)").run(t, t);
  const les = db.prepare("INSERT INTO lessons (id, title, doc, created_at, updated_at, student_id, lesson_date, number) VALUES (?, ?, '{\"v\":1,\"blocks\":[]}', ?, ?, ?, ?, ?)");
  les.run('jl1', 'Primeira', t, t, 'j1', '2026-10-01', 21);
  les.run('jl2', 'Segunda', t, t, 'j2', '2026-10-08', 1);
  db.close();
  await stop();
  fs.writeFileSync(path.join(CONTENT, 'merge.json'), JSON.stringify({ id: 'merge-joana', merge: [{ from: 'Joaná', into: 'Joana' }] }));
  await start();
  const f = await ok('GET', '/api/students/j1');
  assert.deepEqual(f.lessons.map((l) => [l.title, l.number]).sort((a, b) => a[1] - b[1]), [['Primeira', 21], ['Segunda', 22]]);
});

test('"última aula" é a última dada, não a que está em preparação', async () => {
  const s = await ok('POST', '/api/students', { name: 'Edi' });
  const done = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'Dada' });
  await ok('PUT', `/api/lessons/${done.id}`, { date: '2026-10-10' });
  await ok('POST', `/api/lessons/${done.id}/finish`, { lastBlockId: null, assessments: {} });
  const next = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'Amanhã' });
  await ok('PUT', `/api/lessons/${next.id}`, { date: '2026-10-30' });
  const list = await ok('GET', '/api/students');
  assert.equal(list.find((x) => x.id === s.id).lastLessonAt, '2026-10-10');
});

test('aula sem título vira "Sem título"', async () => {
  const s = await ok('POST', '/api/students', { name: 'Thais' });
  const l = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'X' });
  await ok('PUT', `/api/lessons/${l.id}`, { title: '   ' });
  assert.equal((await ok('GET', `/api/lessons/${l.id}`)).title, 'Sem título');
});

test('upload: só WebP de verdade; arquivo grande demais recebe a resposta 413', async () => {
  const fake = await fetch(BASE + '/api/uploads', { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: Buffer.from('não sou uma imagem') });
  assert.equal(fake.status, 415);
  const big = await fetch(BASE + '/api/uploads', { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: Buffer.alloc(9 * 1024 * 1024) });
  assert.equal(big.status, 413);
  assert.equal((await call('GET', '/api/lessons/%E0%A4%A')).status, 400, 'endereço malformado não derruba o servidor');
});
