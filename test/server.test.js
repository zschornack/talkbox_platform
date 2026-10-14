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
  proc = spawn(process.execPath, ['server/start.js'], {
    env: { ...process.env, PORT: String(PORT), TALKBOX_DATA: DATA, TALKBOX_CONTENT: path.join(DATA, 'sem-conteudo') },
    stdio: 'pipe',
  });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/lessons'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('servidor não subiu');
});
after(() => { proc?.kill(); fs.rmSync(DATA, { recursive: true, force: true }); });

const call = async (method, url, body) => {
  const res = await fetch(BASE + url, { method, headers: { 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: res.status, body: await res.json().catch(() => null) };
};

test('primeira vez: cria a Julia, a aula de exemplo e a biblioteca de modelos', async () => {
  const students = (await call('GET', '/api/students')).body;
  assert.equal(students.length, 1);
  assert.equal(students[0].name, 'Julia');
  assert.equal(students[0].lessonCount, 1);

  const models = (await call('GET', '/api/models')).body;
  assert.ok(models.length >= 8);
  const used = models.filter((m) => m.uses > 0);
  assert.ok(used.length >= 5, 'a aula da Julia foi montada a partir dos modelos');
});

test('alunos: cadastrar, editar, inativar e reativar', async () => {
  const bad = await call('POST', '/api/students', { name: '  ' });
  assert.equal(bad.status, 400);

  const { status, body: s } = await call('POST', '/api/students', { name: 'Vini & Bia', level: 'b1', goal: 'Viagem' });
  assert.equal(status, 201);
  assert.equal(s.level, 'B1');

  const edited = (await call('PUT', `/api/students/${s.id}`, { goal: 'Viagem para Londres', map: { 'Past Simple': 'good', X: 'lixo' } })).body;
  assert.equal(edited.goal, 'Viagem para Londres');
  assert.deepEqual(edited.map, { 'Past Simple': 'good' });

  await call('PUT', `/api/students/${s.id}`, { active: false });
  const active = (await call('GET', '/api/students?status=active')).body.map((x) => x.id);
  const inactive = (await call('GET', '/api/students?status=inactive')).body.map((x) => x.id);
  assert.ok(!active.includes(s.id) && inactive.includes(s.id));

  assert.equal((await call('PUT', `/api/students/${s.id}`, { level: 'Z9' })).status, 400);
});

test('nova aula a partir do aluno aparece no histórico da ficha', async () => {
  const s = (await call('POST', '/api/students', { name: 'Rafa', level: 'A1' })).body;
  const lesson = (await call('POST', `/api/students/${s.id}/lessons`, { title: 'Family' })).body;
  assert.equal(lesson.studentId, s.id);
  assert.equal(lesson.student, 'Rafa');
  assert.equal(lesson.doc.level, 'A1');

  const ficha = (await call('GET', `/api/students/${s.id}`)).body;
  assert.equal(ficha.lessons.length, 1);
  assert.equal(ficha.lessons[0].title, 'Family');

  // renomear o aluno atualiza o nome usado no PDF
  await call('PUT', `/api/students/${s.id}`, { name: 'Rafael' });
  assert.equal((await call('GET', `/api/lessons/${lesson.id}`)).body.student, 'Rafael');
});

test('aulas: salvar conteúdo e respostas separados; duplicar sem respostas', async () => {
  const s = (await call('POST', '/api/students', { name: 'Leo' })).body;
  const created = (await call('POST', `/api/students/${s.id}/lessons`, { title: 'Past Simple' })).body;
  const doc = { ...created.doc, title: 'Past Simple 2' };
  const state = { blocks: { x: { answers: { i1: 'went' } } } };
  assert.equal((await call('PUT', `/api/lessons/${created.id}`, { title: doc.title, doc, state })).status, 200);
  const read = (await call('GET', `/api/lessons/${created.id}`)).body;
  assert.equal(read.title, 'Past Simple 2');
  assert.equal(read.state.blocks.x.answers.i1, 'went');

  const copy = (await call('POST', `/api/lessons/${created.id}/duplicate`, {})).body;
  assert.notEqual(copy.id, created.id);
  assert.deepEqual(copy.state, {});
});

test('modelos: criar, editar com histórico, restaurar, contar uso e "visto em"', async () => {
  const m = (await call('POST', '/api/models', {
    title: 'Teste', type: 'fill',
    block: { id: 'b1', type: 'fill', label: 'L', html: '', items: [], source: { modelId: 'outro' } },
    tags: { content: ['Past Simple', 'Past Simple', ' '], levels: ['A2'], skills: ['Escrita'] },
  })).body;
  assert.deepEqual(m.tags.content, ['Past Simple']);
  assert.equal(m.block.source, undefined, 'modelo não guarda a origem');
  assert.equal(m.uses, 0);

  const v2 = (await call('PUT', `/api/models/${m.id}`, { title: 'Teste 2', block: { ...m.block, label: 'L2' } })).body;
  assert.equal(v2.title, 'Teste 2');
  assert.equal(v2.versions.length, 1);
  assert.equal(v2.versions[0].title, 'Teste');

  const back = (await call('POST', `/api/models/${m.id}/restore`, { versionId: v2.versions[0].id })).body;
  assert.equal(back.title, 'Teste');
  assert.equal(back.block.label, 'L');

  // usar o modelo numa aula
  const s = (await call('POST', '/api/students', { name: 'Ana' })).body;
  const lesson = (await call('POST', `/api/students/${s.id}/lessons`, { title: 'Aula' })).body;
  lesson.doc.blocks.push({ ...back.block, id: 'novo', source: { modelId: m.id, title: back.title } });
  await call('PUT', `/api/lessons/${lesson.id}`, { doc: lesson.doc });
  const list = (await call('GET', `/api/models?student=${s.id}`)).body;
  const mine = list.find((x) => x.id === m.id);
  assert.equal(mine.uses, 1);
  assert.ok(mine.seenAt);

  assert.equal((await call('POST', `/api/models/${m.id}/duplicate`)).status, 201);
  assert.equal((await call('DELETE', `/api/models/${m.id}`)).status, 200);
  assert.equal((await call('GET', `/api/models/${m.id}`)).status, 404);
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

test('rotas desconhecidas e itens inexistentes dão 404', async () => {
  assert.equal((await call('GET', '/api/lessons/nada')).status, 404);
  assert.equal((await call('GET', '/api/students/nada')).status, 404);
  assert.equal((await call('GET', '/api/nada')).status, 404);
});
