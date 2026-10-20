// Migração: um banco da versão 0.3 abre na versão nova sem perder nada.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3600 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-mig-'));
let proc;

// o banco exatamente como a versão 0.3 deixava
function oldDatabase() {
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'));
  db.exec(`
    CREATE TABLE students (id TEXT PRIMARY KEY, name TEXT NOT NULL, level TEXT NOT NULL DEFAULT '', goal TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', map TEXT NOT NULL DEFAULT '{}', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE lessons (id TEXT PRIMARY KEY, title TEXT NOT NULL, student TEXT NOT NULL DEFAULT '', doc TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, student_id TEXT);
    CREATE TABLE models (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, block TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE model_versions (id INTEGER PRIMARY KEY AUTOINCREMENT, model_id TEXT NOT NULL, title TEXT NOT NULL,
      block TEXT NOT NULL, tags TEXT NOT NULL, saved_at TEXT NOT NULL);
    CREATE TABLE imports (id TEXT PRIMARY KEY, file TEXT NOT NULL, imported_at TEXT NOT NULL);
  `);
  const t1 = '2026-09-01T14:00:00.000Z';
  const t2 = '2026-09-08T14:00:00.000Z';
  db.prepare('INSERT INTO students VALUES (?,?,?,?,?,?,?,?,?)').run('s1', 'Julia', 'B1', 'Viagem', 'Gosta de séries', JSON.stringify({ 'Past Simple': 'good', 'simple present': 'practicing' }), 1, t1, t2);
  db.prepare('INSERT INTO models VALUES (?,?,?,?,?,?,?)').run('m1', 'Past fill', 'fill', JSON.stringify({ type: 'fill', items: [] }), JSON.stringify({ content: ['simple past'], levels: ['A2'], skills: [] }), t1, t1);
  db.prepare('INSERT INTO model_versions (model_id, title, block, tags, saved_at) VALUES (?,?,?,?,?)').run('m1', 'Past fill v0', '{}', '{}', t1);
  const doc = (id) => JSON.stringify({ v: 1, title: 'x', blocks: [{ id, type: 'fill', items: [], source: { modelId: 'm1', title: 'Past fill' } }] });
  db.prepare('INSERT INTO lessons VALUES (?,?,?,?,?,?,?,?)').run('l1', 'Aula antiga 1', 'Julia', doc('a1'), '{"blocks":{"a1":{"answers":{"i1":"went"}}}}', t1, t1, 's1');
  db.prepare('INSERT INTO lessons VALUES (?,?,?,?,?,?,?,?)').run('l2', 'Aula antiga 2', 'Julia', doc('a2'), '{}', t2, t2, 's1');
  db.prepare('INSERT INTO imports VALUES (?,?,?)').run('natural-disasters-seed', 'seed', t1);
  db.close();
}

before(async () => {
  oldDatabase();
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

const get = async (url) => (await fetch(BASE + url)).json();

test('alunos, aulas e respostas continuam lá', async () => {
  const s = await get('/api/students/s1');
  assert.equal(s.name, 'Julia');
  assert.equal(s.notes, 'Gosta de séries');
  assert.deepEqual(s.lessons.map((l) => [l.title, l.number, l.status]), [['Aula antiga 2', 2, 'done'], ['Aula antiga 1', 1, 'done']]);
  assert.equal(s.lastLessonAt, '2026-09-08');
  const l1 = await get('/api/lessons/l1');
  assert.equal(l1.state.blocks.a1.answers.i1, 'went');
  assert.equal(l1.date, '2026-09-01');
});

test('o mapa antigo vira avaliações, com sinônimos resolvidos', async () => {
  const s = await get('/api/students/s1');
  assert.deepEqual(s.map, { 'Past Simple': 'good', 'Present Simple': 'practicing' });
  const hist = await get('/api/students/s1/history');
  assert.equal(hist.length, 2);
  assert.ok(hist.every((h) => h.manual));
});

test('modelos: etiquetas oficiais, versões, uso e "visto em"', async () => {
  const m = await get('/api/models/m1');
  assert.deepEqual(m.tags.content, ['Past Simple']);
  assert.equal(m.versions.length, 1);
  assert.equal(m.uses, 2);
  const list = await get('/api/models?student=s1');
  assert.equal(list.find((x) => x.id === 'm1').seenAt, '2026-09-08');
});

test('a migração roda uma vez só e o banco recusa apagar', async () => {
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'));
  assert.equal(db.prepare('PRAGMA user_version').get().user_version, 2);
  assert.throws(() => db.exec("DELETE FROM lessons WHERE id = 'l1'"), /não são apagadas/);
  assert.throws(() => db.exec('DELETE FROM models'), /não são apagados/);
  db.close();
});
