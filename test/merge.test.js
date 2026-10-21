// "merge" num pacote junta dois cadastros do mesmo aluno: aulas, mapa e pendências vão para um só, o outro fica inativo.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4000 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-merge-'));
const CONTENT = path.join(DATA, 'content');
let proc;

async function start() {
  proc = spawn(process.execPath, ['server/start.js'], { env: { ...process.env, PORT: String(PORT), TALKBOX_DATA: DATA, TALKBOX_CONTENT: CONTENT }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/lessons'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('servidor não subiu');
}
const stop = () => new Promise((r) => { proc.once('exit', r); proc.kill(); });
const get = async (url) => (await fetch(BASE + url)).json();

before(async () => {
  fs.mkdirSync(CONTENT, { recursive: true });
  await start();
  await stop();
  // dois cadastros da mesma aluna: "Ana" com 2 aulas e mapa, "Aná" com 1 aula, nível e uma pendência
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'));
  const t = new Date().toISOString();
  db.prepare("INSERT INTO students (id, name, created_at, updated_at) VALUES ('a1', 'Ana', ?, ?)").run(t, t);
  db.prepare("INSERT INTO students (id, name, level, created_at, updated_at) VALUES ('a2', 'Aná', 'A2', ?, ?)").run(t, t);
  const les = db.prepare("INSERT INTO lessons (id, title, doc, created_at, updated_at, student_id, lesson_date, number) VALUES (?, ?, '{\"v\":1,\"blocks\":[]}', ?, ?, ?, ?, ?)");
  les.run('l1', 'Primeira', t, t, 'a1', '2026-10-01', 1);
  les.run('l3', 'Terceira', t, t, 'a1', '2026-10-15', 2);
  les.run('l2', 'Segunda', t, t, 'a2', '2026-10-08', 1);
  db.prepare("INSERT INTO assessments (id, student_id, content, status, date, created_at) VALUES ('s1', 'a1', 'Past Simple', 'practicing', '2026-10-01', ?)").run(t);
  db.prepare("INSERT INTO pending (id, student_id, lesson_id, block, created_at) VALUES ('p1', 'a2', 'l2', '{\"type\":\"text\",\"html\":\"x\"}', ?)").run(t);
  db.close();
  fs.writeFileSync(path.join(CONTENT, 'merge.json'), JSON.stringify({ id: 'merge-ana', merge: [{ from: 'Aná', into: 'Ana', name: 'Ana Souza' }] }));
  await start();
});
after(async () => { await stop(); fs.rmSync(DATA, { recursive: true, force: true }); });

test('fica uma ficha só, com as aulas, o mapa e as pendências dos dois cadastros', async () => {
  const all = await get('/api/students');
  const ana = all.find((s) => s.id === 'a1');
  assert.equal(ana.name, 'Ana Souza');
  assert.equal(ana.level, 'A2', 'nível em branco completado com o do outro cadastro');
  const ficha = await get('/api/students/a1');
  assert.deepEqual(ficha.lessons.map((l) => [l.title, l.number]).sort((x, y) => x[1] - y[1]), [['Primeira', 1], ['Segunda', 2], ['Terceira', 3]]);
  assert.equal(ficha.map['Past Simple'], 'practicing');
  const dup = all.find((s) => s.id === 'a2');
  assert.equal(dup.active, false);
  assert.equal(dup.name, 'Aná (cadastro repetido)');
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'));
  assert.equal(db.prepare("SELECT student_id FROM pending WHERE id = 'p1'").get().student_id, 'a1');
  db.close();
});

test('ao reiniciar, nada muda de novo', async () => {
  await stop();
  await start();
  const ficha = await get('/api/students/a1');
  assert.equal(ficha.name, 'Ana Souza');
  assert.equal(ficha.lessons.length, 3);
});
