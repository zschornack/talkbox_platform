// Volume de alguns anos de escola: as telas principais continuam rápidas.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-vol-'));
process.env.TALKBOX_DATA = DATA;
const db = await import('../server/db.js');
after(() => { db.db.close(); fs.rmSync(DATA, { recursive: true, force: true }); });

test('60 alunos × 100 aulas × 15 blocos', () => {
  const contents = ['Past Simple', 'Quantifiers', 'Prepositions', 'Present Perfect', 'Articles'];
  const models = Array.from({ length: 300 }, (_, i) =>
    db.createModel({ title: `Item ${i}`, type: 'deck', block: { type: 'deck', cats: [{ name: 'G', qs: ['Q?'] }] }, tags: { content: [contents[i % 5]], levels: ['B1'], skills: [] } })
  );
  const students = Array.from({ length: 60 }, (_, i) => db.createStudent({ name: `Aluno ${i}`, level: 'B1' }));
  db.transaction(() => {
    for (const s of students) {
      for (let n = 0; n < 100; n++) {
        const blocks = Array.from({ length: 15 }, (_, p) => {
          const m = models[(n * 15 + p) % 300];
          return { ...m.block, id: `b${n}-${p}`, source: { modelId: m.id, title: m.title } };
        });
        const day = `2026-${String(1 + (n % 12)).padStart(2, '0')}-${String(1 + (n % 28)).padStart(2, '0')}`;
        const l = db.createLesson({ title: `Aula ${n}`, studentId: s.id, doc: { v: 1, title: `Aula ${n}`, blocks }, date: day });
        db.finishLesson(l.id, { lastBlockId: blocks[11].id, assessments: { [contents[n % 5]]: n % 2 ? 'good' : 'practicing' } });
      }
    }
  });
  assert.equal(db.stats().lessons, 6000);

  const t0 = performance.now();
  const s = students[30];
  db.getStudent(s.id);
  db.listLessons({ studentId: s.id });
  db.whereWeStopped(s.id);
  db.listModels({ studentId: s.id });
  db.listStudents({ active: true });
  const ms = performance.now() - t0;
  console.log(`   ficha + histórico + onde paramos + biblioteca com "visto em" + alunos: ${ms.toFixed(0)} ms`);
  assert.ok(ms < 2000, `lento demais: ${ms} ms`);
  assert.equal(db.whereWeStopped(s.id).pending.length, 300, '3 pendentes por aula, nenhum resolvido');
});
