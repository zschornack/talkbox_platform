// Copiar aula: a cópia leva só o material. Anotações, marca-texto da aula, o que foi escrito na aula,
// respostas, caneta e pendências ficam na aula original. E o pacote "clean" limpa uma aula ainda não dada.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stripLiveMarks } from '../web/js/marks.js';

const PORT = 4200 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-copy-'));
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
const MATERIAL = (t) => `<span style="background-color: #CBE4D8"><b>${t}</b></span>`;

test('marca-texto: sai o da aula (rgb), fica o do material (#RRGGBB)', () => {
  const out = stripLiveMarks(`I ${LIVE('went')} home. ${MATERIAL('has')} <span style="background-color: transparent">x</span>`);
  assert.equal(out.removed, 2);
  assert.equal(out.html, `I went home. ${MATERIAL('has')} x`);
});

let gabriel, thiago, lesson, model;
test('copiar para outro aluno: sem anotações, marca-texto, respostas, caneta e pendências', async () => {
  gabriel = await ok('POST', '/api/students', { name: 'Gabriel' });
  thiago = await ok('POST', '/api/students', { name: 'Thiago' });
  model = await ok('POST', '/api/models', {
    title: 'Reading · bees', type: 'text',
    block: { type: 'text', label: 'READING', html: `A bee ${MATERIAL('stings')} once.` },
    tags: { content: ['Reading'] },
  });
  lesson = await ok('POST', `/api/students/${gabriel.id}/lessons`, { title: 'Bees' });
  lesson.doc.blocks = [
    // veio da biblioteca e foi mexido na aula: escreveu e destacou
    { ...model.block, id: 'b1', html: `A bee ${MATERIAL('stings')} once. ${LIVE('stinger')} - ferrão`, source: { modelId: model.id, title: model.title } },
    // feito na própria aula, com marca-texto
    { id: 'b2', type: 'explanation', label: 'EXTRA', html: `Use ${LIVE('should')} for advice. ${MATERIAL('should')}` },
    // retomada de uma pendência
    { id: 'b3', type: 'text', label: 'OLD', html: 'old', pending: 'p-old' },
    { id: 'n1', type: 'notes', label: 'ANOTAÇÕES', html: 'stinger = ferrão · pronúncia: STING-er' },
  ];
  await ok('PUT', `/api/lessons/${lesson.id}`, { doc: lesson.doc, state: { pen: [[[1, 1], [2, 2]]], blocks: { b1: { answers: { x: 'y' } } } } });
  await ok('POST', `/api/lessons/${lesson.id}/finish`, { lastBlockId: 'n1', assessments: {}, message: 'Revisar should' });

  const info = await ok('GET', `/api/lessons/${lesson.id}/copy`);
  assert.equal(info.fromModels, 1);
  assert.deepEqual(info.changed, ['Reading · bees']);
  assert.equal(info.marks, 2);
  assert.equal(info.notes, true);

  const copy = await ok('POST', `/api/lessons/${lesson.id}/duplicate`, { studentId: thiago.id, title: 'Bees for Thiago' });
  assert.equal(copy.studentId, thiago.id);
  assert.equal(copy.title, 'Bees for Thiago');
  assert.equal(copy.status, 'preparing');
  assert.deepEqual(copy.state, {}, 'sem respostas e sem caneta');
  assert.equal(copy.receivedMessage, '', 'a anotação para a próxima aula é do Gabriel');
  const [b1, b2, b3, n1] = copy.doc.blocks;
  assert.equal(b1.html, model.block.html, 'bloco da biblioteca volta ao original');
  assert.equal(b1.source.modelId, model.id);
  assert.equal(b2.html, `Use should for advice. ${MATERIAL('should')}`, 'sai só o marca-texto da aula');
  assert.equal(b3.pending, undefined, 'a cópia não é a retomada da pendência');
  assert.equal(n1.html, '', 'anotações vão vazias');
  assert.ok(copy.doc.blocks.every((b) => !['b1', 'b2', 'b3', 'n1'].includes(b.id)), 'ids novos');
  assert.deepEqual(copy.report, { restored: 1, marks: 1, notesCleared: true });

  // a original não muda
  const orig = await ok('GET', `/api/lessons/${lesson.id}`);
  assert.match(orig.doc.blocks[0].html, /ferrão/);
  assert.equal(orig.doc.blocks[3].html, 'stinger = ferrão · pronúncia: STING-er');
});

test('copiar mantendo o que foi feito na aula, se pedir', async () => {
  const copy = await ok('POST', `/api/lessons/${lesson.id}/duplicate`, { original: false, keepMarks: true });
  assert.equal(copy.studentId, gabriel.id, 'sem aluno escolhido: o mesmo da aula');
  assert.match(copy.doc.blocks[0].html, /ferrão/);
  assert.match(copy.doc.blocks[1].html, /rgb\(255, 219, 143\)/);
  assert.equal(copy.doc.blocks[3].html, '', 'anotações nunca vão');
});

test('pacote "clean": limpa uma aula ainda não dada, mantendo os blocos adaptados', async () => {
  // aula do Thiago copiada "como estava" (com as marcações do Gabriel) e com um bloco adaptado para ele
  const raw = await ok('POST', `/api/lessons/${lesson.id}/duplicate`, { studentId: thiago.id, title: 'Bees raw', original: false, keepMarks: true });
  raw.doc.blocks[1].label = 'ADAPTADO';
  raw.doc.blocks[1].html = `Thiago, use ${LIVE('should')}.`;
  // "Bees raw" foi criada e editada agora: com onlyIfUntouched, o pacote não mexe
  await ok('PUT', `/api/lessons/${raw.id}`, { doc: raw.doc });
  await stop();
  fs.writeFileSync(path.join(CONTENT, 'clean-1.json'), JSON.stringify({ id: 'clean-1', clean: [{ student: 'Thiago', lesson: 'Bees raw', onlyIfUntouched: true }] }));
  fs.writeFileSync(path.join(CONTENT, 'clean-2.json'), JSON.stringify({ id: 'clean-2', clean: [{ student: 'Thiago', lesson: 'Bees raw', keep: ['ADAPTADO'] }] }));
  await start();
  const after = await ok('GET', `/api/lessons/${raw.id}`);
  assert.equal(after.doc.blocks[0].html, model.block.html, 'bloco da biblioteca voltou ao original');
  assert.equal(after.doc.blocks[1].html, 'Thiago, use should.', 'o adaptado fica, sem o marca-texto');
  assert.equal(after.doc.blocks[3].html, '');
  assert.equal(after.doc.blocks[0].id, raw.doc.blocks[0].id, 'os ids ficam');
});
