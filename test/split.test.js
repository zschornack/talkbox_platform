// Turma que se separa: renomear mantém tudo; o aluno novo copia nível, objetivo e mapa.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-split-'));
process.env.TALKBOX_DATA = DATA;
const db = await import('../server/db.js');
const { importPack } = await import('../server/content.js');

after(() => fs.rmSync(DATA, { recursive: true, force: true }));

test('renomear a turma e criar a aluna copiando o mapa', () => {
  const turma = db.createStudent({ name: 'Ana & Bia', level: 'B1', goal: 'Conversação' });
  db.updateStudent(turma.id, { map: { 'Past Simple': 'good', 'Present Perfect': 'practicing' } });
  const lesson = db.createLesson({ title: 'Aula 1', studentId: turma.id, doc: { v: 1, title: 'Aula 1', blocks: [] } });

  importPack({ id: 'split-1', rename: [{ from: 'Ana & Bia', to: 'Ana' }], students: [{ name: 'Bia', copyFrom: 'Ana', notes: 'x' }] });

  const all = db.listStudents();
  assert.ok(!all.some((s) => s.name === 'Ana & Bia'));
  const ana = all.find((s) => s.name === 'Ana');
  const bia = all.find((s) => s.name === 'Bia');
  assert.equal(ana.id, turma.id, 'mesmo cadastro, só mudou o nome');
  assert.equal(ana.lessonCount, 1);
  assert.equal(db.getLesson(lesson.id).studentId, ana.id);
  assert.equal(bia.lessonCount, 0);
  assert.equal(bia.level, 'B1');
  assert.equal(bia.goal, 'Conversação');
  assert.equal(bia.notes, 'x');
  assert.deepEqual(bia.map, ana.map);
});

test('renomear não faz nada se o nome novo já existe ou o antigo não existe', () => {
  db.createStudent({ name: 'Caio & Duda' });
  db.createStudent({ name: 'Caio' });
  importPack({ id: 'split-2', rename: [{ from: 'Caio & Duda', to: 'Caio' }, { from: 'Ninguém', to: 'Alguém' }] });
  const names = db.listStudents().map((s) => s.name);
  assert.ok(names.includes('Caio & Duda'));
  assert.ok(!names.includes('Alguém'));
});
