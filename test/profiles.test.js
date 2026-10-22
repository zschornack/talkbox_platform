// "profiles" num pacote traz o histórico de antes da plataforma (Drive): nível, mapa (só sobe) e quantas aulas já houve.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4100 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-profiles-'));
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
const post = async (url, body) => (await fetch(BASE + url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();

before(async () => {
  fs.mkdirSync(CONTENT, { recursive: true });
  await start();
  await stop();
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'));
  const t = new Date().toISOString();
  db.prepare("INSERT INTO students (id, name, level, created_at, updated_at) VALUES ('b1', 'Bia', 'A2', ?, ?)").run(t, t);
  db.prepare("INSERT INTO students (id, name, created_at, updated_at) VALUES ('c1', 'Caio', ?, ?)").run(t, t);
  db.prepare("INSERT INTO students (id, name, active, created_at, updated_at) VALUES ('z1', 'Zé', 0, ?, ?)").run(t, t);
  const les = db.prepare("INSERT INTO lessons (id, title, doc, created_at, updated_at, student_id, lesson_date, number) VALUES (?, ?, '{\"v\":1,\"blocks\":[]}', ?, ?, ?, ?, ?)");
  les.run('l2', 'Segunda', t, t, 'b1', '2026-10-20', 1);
  les.run('l1', 'Primeira', t, t, 'b1', '2026-10-15', 2);
  les.run('z', 'Do Zé', t, t, 'z1', '2026-10-15', 1);
  db.prepare("INSERT INTO assessments (id, student_id, content, status, date, created_at) VALUES ('s1', 'b1', 'Past Simple', 'good', '2026-10-15', ?)").run(t);
  db.close();
  fs.writeFileSync(path.join(CONTENT, 'profiles.json'), JSON.stringify({
    id: 'profiles-drive',
    profiles: [
      { name: 'Bia', level: 'B1', priorLessons: 34, map: { 'Past Simple': 'practicing', 'present perfect': 'practicing', 'Passive voice': 'good' } },
      { name: 'Caio', level: 'B1', priorLessons: 27, map: { 'Present Simple': 'good' } },
      { name: 'Zé', level: 'C2', priorLessons: 50 },
    ],
  }));
  await start();
});
after(async () => { await stop(); fs.rmSync(DATA, { recursive: true, force: true }); });

test('nível e mapa vêm do histórico; o mapa só sobe', async () => {
  const bia = await get('/api/students/b1');
  assert.equal(bia.level, 'B1');
  assert.equal(bia.map['Past Simple'], 'good', 'não volta de "Já está bom" para "Praticando"');
  assert.equal(bia.map['Present Perfect'], 'practicing', 'sinônimo vira o nome oficial');
  assert.equal(bia.map['Passive voice'], 'good');
});

test('as aulas da plataforma continuam a contagem do Drive, pela ordem das datas', async () => {
  const bia = await get('/api/students/b1');
  assert.deepEqual(bia.lessons.map((l) => [l.title, l.number]).sort((x, y) => x[1] - y[1]), [['Primeira', 35], ['Segunda', 36]]);
  assert.equal(bia.priorLessons, 34);
  const next = await post('/api/students/c1/lessons', { title: 'Primeira na plataforma' });
  assert.equal(next.number, 28, 'aluno sem aula na plataforma começa em priorLessons + 1');
  const again = await post('/api/students/b1/lessons', { title: 'Terceira' });
  assert.equal(again.number, 37);
});

test('aluno inativo fica como estava', async () => {
  const ze = (await get('/api/students')).find((s) => s.id === 'z1');
  assert.equal(ze.level, '');
  assert.equal(ze.priorLessons, 0);
  const ficha = await get('/api/students/z1');
  assert.equal(ficha.lessons[0].number, 1);
});

test('ao reiniciar, nada muda de novo', async () => {
  await stop();
  await start();
  const bia = await get('/api/students/b1');
  assert.equal(bia.lessons.length, 3);
  assert.equal(bia.lessons.find((l) => l.title === 'Primeira').number, 35);
});
