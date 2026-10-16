// A aluna de exemplo "Julia" vira a Júlia de verdade, inclusive num banco onde o cadastro em lote já criou outra "Júlia".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-julia-'));
const EMPTY = path.join(DATA, 'sem-conteudo');
let proc;

async function start() {
  proc = spawn(process.execPath, ['server/start.js'], { env: { ...process.env, PORT: String(PORT), TALKBOX_DATA: DATA, TALKBOX_CONTENT: EMPTY }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/lessons'); return; } catch { await new Promise((r) => setTimeout(r, 100)); }
  }
  throw new Error('servidor não subiu');
}
const stop = () => new Promise((r) => { proc.once('exit', r); proc.kill(); });
const get = async (url) => (await fetch(BASE + url)).json();

before(async () => {
  await start();
  await stop();
  // como ficava o banco antes: Julia de exemplo + uma "Júlia" do cadastro em lote, com uma aula
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'));
  const t = new Date().toISOString();
  db.prepare("UPDATE students SET name = 'Julia', notes = 'Aluna de exemplo. Edite ou inative quando quiser.'").run();
  db.prepare('INSERT INTO students (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)').run('dup', 'Júlia', t, t);
  db.prepare("INSERT INTO lessons (id, title, doc, created_at, updated_at, student_id, lesson_date) VALUES ('ldup', 'Aula da Júlia', '{\"v\":1,\"blocks\":[]}', ?, ?, 'dup', '2026-10-15')").run(t, t);
  db.close();
  await start();
});
after(async () => { await stop(); fs.rmSync(DATA, { recursive: true, force: true }); });

test('fica uma Júlia só, com as aulas das duas, e o cadastro repetido fica inativo', async () => {
  const all = await get('/api/students');
  const active = all.filter((s) => s.active && s.name.startsWith('J'));
  assert.deepEqual(active.map((s) => s.name), ['Júlia']);
  const ficha = await get(`/api/students/${active[0].id}`);
  assert.equal(ficha.notes, '');
  const titles = ficha.lessons.map((l) => l.title).sort();
  assert.deepEqual(titles, ['Aula da Júlia', 'Natural Disasters']);
  assert.ok(all.some((s) => s.id === 'dup' && !s.active), 'o cadastro repetido continua guardado, inativo');
});
