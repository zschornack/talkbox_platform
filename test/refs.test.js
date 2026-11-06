// Aulas que apontam para a biblioteca (v0.8): a aula guarda só { id, ref }; mudou o modelo (na aba Modelos), mudou em todas.
// O que se escreve ou destaca no bloco durante a aula (v0.9) fica no state da aula e nunca vai para o modelo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const PORT = 4300 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-refs-'));
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

const LIVE = (t) => `<span style="background-color: rgb(255, 219, 143)">${t}</span>`;

const raw = (id) => {
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'), { readOnly: true });
  const r = db.prepare('SELECT doc, state FROM lessons WHERE id = ?').get(id);
  db.close();
  return { doc: JSON.parse(r.doc), state: JSON.parse(r.state) };
};

let ana, m1, m2, lessonA, lessonB;
const lessonWith = async (title, models) => {
  const l = await ok('POST', `/api/students/${ana.id}/lessons`, { title });
  // como o editor faz ao inserir da biblioteca: o bloco do modelo + ref
  l.doc.blocks = [...models.map((m, i) => ({ ...m.block, id: `${title}-${i}`, type: m.type, ref: m.id, source: { modelId: m.id, title: m.title } })),
    { id: `${title}-n`, type: 'notes', label: 'ANOTAÇÕES', html: '' }];
  return ok('PUT', `/api/lessons/${l.id}`, { doc: l.doc });
};

test('a aula guarda só a referência e mostra o modelo inteiro', async () => {
  ana = await ok('POST', '/api/students', { name: 'Ana Refs' });
  m1 = await ok('POST', '/api/models', { title: 'Fill · go', type: 'fill', tags: { content: ['Past Simple'] },
    block: { type: 'fill', label: 'PRACTICE', html: 'Complete.', items: [{ id: 'i1', before: 'I', hint: 'go', after: 'home.', answers: ['went'] }] } });
  m2 = await ok('POST', '/api/models', { title: 'Text · bees', type: 'text', tags: { content: ['Reading'] },
    block: { type: 'text', label: 'READING', html: 'Bees sting.' } });
  lessonA = await lessonWith('A', [m1, m2]);
  lessonB = await lessonWith('B', [m2]);
  const stored = raw(lessonA.id).doc.blocks;
  assert.deepEqual(stored[0], { id: 'A-0', ref: m1.id });
  assert.deepEqual(stored[1], { id: 'A-1', ref: m2.id });
  assert.equal(stored[2].type, 'notes', 'anotações continuam inteiras na aula');
  const got = await ok('GET', `/api/lessons/${lessonA.id}`);
  assert.equal(got.doc.blocks[0].items[0].answers[0], 'went');
  assert.equal(got.doc.blocks[0].ref, m1.id);
  assert.equal(got.doc.blocks[0].source.title, 'Fill · go');
});

test('mudou o modelo, mudou em todas as aulas; escrever na aula não muda o modelo', async () => {
  await ok('PUT', `/api/models/${m2.id}`, { block: { ...m2.block, html: 'Bees can sting once.' } });
  assert.equal((await ok('GET', `/api/lessons/${lessonA.id}`)).doc.blocks[1].html, 'Bees can sting once.');
  assert.equal((await ok('GET', `/api/lessons/${lessonB.id}`)).doc.blocks[0].html, 'Bees can sting once.');
  // escrever no bloco durante a aula A: fica só na aula A
  const a = await ok('GET', `/api/lessons/${lessonA.id}`);
  a.doc.blocks[1].html = 'Bees can sting once. (Miguel: sting = picar)';
  await ok('PUT', `/api/lessons/${lessonA.id}`, { doc: a.doc });
  assert.equal((await ok('GET', `/api/models/${m2.id}`)).block.html, 'Bees can sting once.', 'o modelo não muda');
  assert.equal((await ok('GET', `/api/lessons/${lessonB.id}`)).doc.blocks[0].html, 'Bees can sting once.', 'a aula B não muda');
  const again = await ok('GET', `/api/lessons/${lessonA.id}`);
  assert.equal(again.doc.blocks[1].html, 'Bees can sting once. (Miguel: sting = picar)', 'a aula A mostra o que foi escrito');
  assert.equal(again.doc.blocks[1].edited, true);
  assert.deepEqual(raw(lessonA.id).doc.blocks[1], { id: 'A-1', ref: m2.id }, 'o doc continua só com a referência');
  // salvar de novo o mesmo doc (com "edited") não cria nada novo
  await ok('PUT', `/api/lessons/${lessonA.id}`, { doc: again.doc });
  assert.equal((await ok('GET', `/api/models/${m2.id}`)).block.html, 'Bees can sting once.');
  // voltar ao original (depois do PDF)
  const r = await ok('POST', `/api/lessons/${lessonA.id}/reset`, {});
  assert.equal(r.reset, 1);
  const back = await ok('GET', `/api/lessons/${lessonA.id}`);
  assert.equal(back.doc.blocks[1].html, 'Bees can sting once.');
  assert.equal(back.doc.blocks[1].edited, undefined);
});

test('voltar ao original: um bloco só, e as respostas ficam', async () => {
  const a = await ok('GET', `/api/lessons/${lessonA.id}`);
  a.doc.blocks[0].html = 'Complete it.';
  a.doc.blocks[1].html = 'Bees!';
  await ok('PUT', `/api/lessons/${lessonA.id}`, { doc: a.doc, state: { blocks: { 'A-0': { answers: { i1: 'went' } } } } });
  const r = await ok('POST', `/api/lessons/${lessonA.id}/reset`, { blockIds: ['A-1'] });
  assert.equal(r.reset, 1);
  const got = await ok('GET', `/api/lessons/${lessonA.id}`);
  assert.equal(got.doc.blocks[0].html, 'Complete it.');
  assert.equal(got.doc.blocks[1].html, 'Bees can sting once.');
  await ok('POST', `/api/lessons/${lessonA.id}/reset`, {});
  const all = await ok('GET', `/api/lessons/${lessonA.id}`);
  assert.equal(all.doc.blocks[0].html, 'Complete.');
  assert.deepEqual(all.state.blocks['A-0'].answers, { i1: 'went' }, 'as respostas ficam');
  assert.equal((await ok('GET', `/api/models/${m1.id}`)).block.html, 'Complete.');
});

test('o marca-texto da aula fica só na aula: nem no modelo, nem na cópia', async () => {
  const a = await ok('GET', `/api/lessons/${lessonA.id}`);
  a.doc.blocks[1].html = `Bees can ${LIVE('sting')} once.`;
  await ok('PUT', `/api/lessons/${lessonA.id}`, { doc: a.doc, state: { blocks: { 'A-0': { answers: { i1: 'went' } } } } });
  assert.equal((await ok('GET', `/api/models/${m2.id}`)).block.html, 'Bees can sting once.', 'o modelo não pega o destaque');
  assert.equal((await ok('GET', `/api/lessons/${lessonB.id}`)).doc.blocks[0].html, 'Bees can sting once.');
  const again = await ok('GET', `/api/lessons/${lessonA.id}`);
  assert.match(again.doc.blocks[1].html, /rgb\(255, 219, 143\)/, 'a aula A continua com o destaque');
  assert.deepEqual(again.state.blocks['A-0'].answers, { i1: 'went' }, 'as respostas continuam');
  assert.equal(raw(lessonA.id).doc.blocks[1].ref, m2.id, 'continua sendo só a referência');
  // salvar só o state (como o navegador faz) não apaga o destaque
  await ok('PUT', `/api/lessons/${lessonA.id}`, { state: again.state });
  assert.match((await ok('GET', `/api/lessons/${lessonA.id}`)).doc.blocks[1].html, /rgb/);
  const copy = await ok('POST', `/api/lessons/${lessonA.id}/duplicate`, { studentId: ana.id, title: 'A copy' });
  assert.equal(copy.doc.blocks[1].html, 'Bees can sting once.');
  assert.ok(raw(copy.id).doc.blocks.slice(0, 2).every((b) => b.ref && Object.keys(b).length === 2), 'a cópia também só aponta');
  // tirar o destaque na aula
  const a2 = await ok('GET', `/api/lessons/${lessonA.id}`);
  a2.doc.blocks[1].html = 'Bees can sting once.';
  await ok('PUT', `/api/lessons/${lessonA.id}`, { doc: a2.doc });
  assert.equal(raw(lessonA.id).state.blocks?.['A-1']?.live, undefined);
});

test('"Só nesta aula" (local) e blocos antigos copiados', async () => {
  const a = await ok('GET', `/api/lessons/${lessonA.id}`);
  const { ref, ...detached } = a.doc.blocks[1];
  a.doc.blocks[1] = { ...detached, local: true, html: 'Only for Ana: bees sting.' };
  // bloco antigo (cópia inteira, sem ref) igual ao modelo vira referência; um diferente fica inteiro
  a.doc.blocks.splice(2, 0,
    { ...m1.block, id: 'old-same', items: [{ ...m1.block.items[0], id: 'x9' }], source: { modelId: m1.id, title: m1.title } },
    { ...m1.block, id: 'old-diff', html: 'Changed in class.', source: { modelId: m1.id, title: m1.title } });
  await ok('PUT', `/api/lessons/${lessonA.id}`, { doc: a.doc, state: { blocks: { 'old-same': { answers: { x9: 'went' } } } } });
  const stored = raw(lessonA.id);
  assert.equal(stored.doc.blocks[1].ref, undefined);
  assert.equal(stored.doc.blocks[1].html, 'Only for Ana: bees sting.');
  assert.equal((await ok('GET', `/api/models/${m2.id}`)).block.html, 'Bees can sting once.', 'o modelo não muda');
  assert.deepEqual(stored.doc.blocks[2], { id: 'old-same', ref: m1.id });
  assert.deepEqual(stored.state.blocks['old-same'].answers, { i1: 'went' }, 'a resposta passa para o id do item do modelo');
  assert.equal(stored.doc.blocks[3].html, 'Changed in class.');
  assert.equal((await ok('GET', `/api/models/${m1.id}`)).block.html, 'Complete.');
});

test('pendência guarda só a referência e volta inteira na próxima aula', async () => {
  const b = await ok('GET', `/api/lessons/${lessonB.id}`);
  await ok('POST', `/api/lessons/${lessonB.id}/finish`, { lastBlockId: null, assessments: {} });
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'), { readOnly: true });
  const p = db.prepare("SELECT block FROM pending WHERE lesson_id = ?").get(lessonB.id);
  db.close();
  assert.deepEqual(JSON.parse(p.block), { id: b.doc.blocks[0].id, type: 'text', ref: m2.id });
  const ficha = await ok('GET', `/api/students/${ana.id}`);
  assert.equal(ficha.stop.pending[0].title, 'Text · bees');
  const next = await ok('POST', `/api/students/${ana.id}/next-lesson`, { title: 'Next' });
  const first = next.doc.blocks[0];
  assert.equal(first.html, 'Bees can sting once.');
  assert.ok(first.pending);
});

test('o plano da aula (observação no início) fica guardado', async () => {
  const a = await ok('GET', `/api/lessons/${lessonA.id}`);
  a.doc.plan = 'Goal: review the past simple.';
  await ok('PUT', `/api/lessons/${lessonA.id}`, { doc: a.doc });
  assert.equal((await ok('GET', `/api/lessons/${lessonA.id}`)).doc.plan, 'Goal: review the past simple.');
});
