// Teste do servidor: sobe numa porta livre, com uma pasta de dados temporária.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-test-'));
let proc;

before(async () => {
  proc = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server/index.js'], {
    env: { ...process.env, PORT: String(PORT), TALKBOX_DATA: DATA },
    stdio: 'pipe',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/lessons'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('servidor não subiu');
});
after(() => { proc?.kill(); fs.rmSync(DATA, { recursive: true, force: true }); });

const json = (method, url, body) =>
  fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });

test('cria a aula de exemplo na primeira vez', async () => {
  const list = await (await fetch(BASE + '/api/lessons')).json();
  assert.equal(list.length, 1);
  assert.equal(list[0].student, 'Julia');
});

test('cria, edita e lê uma aula; conteúdo e respostas ficam separados', async () => {
  const created = await (await json('POST', '/api/lessons', { title: 'Past Simple', student: 'Bia' })).json();
  assert.equal(created.title, 'Past Simple');
  assert.ok(created.doc.blocks.length > 0);

  const doc = { ...created.doc, title: 'Past Simple 2' };
  const state = { blocks: { x: { answers: { i1: 'went' } } } };
  assert.equal((await json('PUT', `/api/lessons/${created.id}`, { title: doc.title, doc, state })).status, 200);

  const read = await (await fetch(`${BASE}/api/lessons/${created.id}`)).json();
  assert.equal(read.title, 'Past Simple 2');
  assert.equal(read.state.blocks.x.answers.i1, 'went');
});

test('duplicar cria cópia sem as respostas', async () => {
  const [src] = await (await fetch(BASE + '/api/lessons')).json();
  const copy = await (await json('POST', `/api/lessons/${src.id}/duplicate`, { student: 'Leo' })).json();
  assert.notEqual(copy.id, src.id);
  assert.equal(copy.student, 'Leo');
  assert.deepEqual(copy.state, {});
});

test('aceita só WebP no upload e não deixa sair da pasta de imagens', async () => {
  const bad = await fetch(BASE + '/api/uploads', { method: 'POST', headers: { 'Content-Type': 'image/png' }, body: 'x' });
  assert.equal(bad.status, 415);
  const ok = await fetch(BASE + '/api/uploads', { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: Buffer.from('RIFF0000WEBP') });
  assert.equal(ok.status, 201);
  const { url } = await ok.json();
  assert.equal((await fetch(BASE + url)).status, 200);
  assert.equal((await fetch(BASE + '/uploads/..%2f..%2fpackage.json')).status, 404);
});

test('aula inexistente dá 404', async () => {
  assert.equal((await fetch(BASE + '/api/lessons/nada')).status, 404);
});
