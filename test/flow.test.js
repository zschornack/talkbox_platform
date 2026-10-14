// O fluxo completo do banco: aula → finalizar → pendências → próxima aula → mapa → "visto em",
// mais arquivar, revisão de importados, sinônimos, cópia de segurança e exportação.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 3700 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-flow-'));
const CONTENT = path.join(DATA, 'content');
fs.mkdirSync(CONTENT);
let proc;

// um pacote "a revisar", como virá a importação do Drive
fs.writeFileSync(path.join(CONTENT, 'drive.json'), JSON.stringify({
  id: 'drive-lote-1',
  review: true,
  models: [
    { key: 'a', title: 'Countable and uncountable practice', block: { type: 'text', label: '', html: 'Some and any.' } },
    { key: 'b', title: 'Sem pista nenhuma', block: { type: 'text', label: '', html: 'Hello.' } },
  ],
}));

before(async () => {
  proc = spawn(process.execPath, ['server/start.js'], {
    env: { ...process.env, PORT: String(PORT), TALKBOX_DATA: DATA, TALKBOX_CONTENT: CONTENT },
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
const ok = async (...a) => {
  const r = await call(...a);
  assert.ok(r.status < 300, `${a[0]} ${a[1]} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
};

async function modelOf(title, content, type = 'fill') {
  return ok('POST', '/api/models', {
    title, type,
    block: { type, label: title.toUpperCase(), html: '', items: [{ id: 'i1', before: 'I', hint: 'go', after: 'home.', answers: ['went'] }] },
    tags: { content, levels: ['A2'], skills: ['Escrita'] },
  });
}
const asBlock = (m, id) => ({ ...m.block, id, source: { modelId: m.id, title: m.title } });

test('sinônimos: etiquetas viram o nome oficial', async () => {
  const m = await modelOf('Sinônimos', ['simple past', 'Past Simple', 'passado simples', 'Tema livre']);
  assert.deepEqual(m.tags.content, ['Past Simple', 'Tema livre']);
});

test('fluxo completo: finalizar, pendências, próxima aula, mapa e "visto em"', async () => {
  const s = await ok('POST', '/api/students', { name: 'Ariane', level: 'A2' });
  const mTable = await modelOf('Tabela', ['Quantifiers'], 'fill');
  const mFill = await modelOf('Lacunas', ['some any']);
  const mDeck = await modelOf('Deck', ['How much / How many']);

  // aula 1, montada com três modelos
  const l1 = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'Aula 1' });
  assert.equal(l1.status, 'preparing');
  assert.equal(l1.number, 1);
  l1.doc.blocks = [asBlock(mTable, 'b1'), asBlock(mFill, 'b2'), asBlock(mDeck, 'b3'), { id: 'n1', type: 'notes', label: 'ANOTAÇÕES', html: '' }];
  await ok('PUT', `/api/lessons/${l1.id}`, { doc: l1.doc, date: '2026-10-01' });

  const info = await ok('GET', `/api/lessons/${l1.id}/finish`);
  assert.deepEqual(info.contents.sort(), ['How much / How many', 'Quantifiers']);

  assert.equal((await call('POST', `/api/lessons/${l1.id}/finish`, { lastBlockId: 'outro' })).status, 400);
  const fin = await ok('POST', `/api/lessons/${l1.id}/finish`, {
    lastBlockId: 'b2', assessments: { Quantifiers: 'practicing', 'how much': 'good' }, message: 'Revisar o deck',
  });
  assert.equal(fin.done, 2);
  assert.equal(fin.newPending, 1, 'anotações não viram pendência');
  assert.equal(fin.lesson.status, 'done');
  assert.equal((await call('POST', `/api/lessons/${l1.id}/finish`, {})).status, 400, 'não finaliza duas vezes');

  let ficha = await ok('GET', `/api/students/${s.id}`);
  assert.equal(ficha.stop.lesson.id, l1.id);
  assert.equal(ficha.stop.message, 'Revisar o deck');
  assert.deepEqual(ficha.stop.pending.map((p) => p.title), ['Deck']);
  assert.equal(ficha.map.Quantifiers, 'practicing');
  assert.equal(ficha.map['How much / How many'], 'good');
  assert.equal(ficha.mapSince.Quantifiers, '2026-10-01');

  // "visto em": só o que ficou antes do corte
  let seen = Object.fromEntries((await ok('GET', `/api/models?student=${s.id}`)).map((m) => [m.id, m.seenAt]));
  assert.equal(seen[mTable.id], '2026-10-01');
  assert.equal(seen[mFill.id], '2026-10-01');
  assert.equal(seen[mDeck.id], null);

  // aula 2 pela ficha: traz o pendente e o recado
  const l2 = await ok('POST', `/api/students/${s.id}/next-lesson`, { title: 'Aula 2' });
  assert.equal(l2.receivedMessage, 'Revisar o deck');
  assert.equal(l2.number, 2);
  const pend = l2.doc.blocks.filter((b) => b.pending);
  assert.equal(pend.length, 1);
  assert.equal(pend[0].source.modelId, mDeck.id);
  // o pendente fica para depois de novo: segue aberto, sem duplicar
  l2.doc.blocks = [asBlock(mFill, 'c1'), ...pend];
  await ok('PUT', `/api/lessons/${l2.id}`, { doc: l2.doc, date: '2026-10-08' });
  const fin2 = await ok('POST', `/api/lessons/${l2.id}/finish`, { lastBlockId: 'c1', assessments: { Quantifiers: 'good' } });
  assert.deepEqual([fin2.newPending, fin2.stillPending], [0, 1]);
  ficha = await ok('GET', `/api/students/${s.id}`);
  assert.equal(ficha.stop.pending.length, 1);
  assert.equal(ficha.stop.message, '', 'sem recado = está tudo certo');
  assert.equal(ficha.map.Quantifiers, 'good');

  // aula 3 resolve o pendente
  const l3 = await ok('POST', `/api/students/${s.id}/next-lesson`, { title: 'Aula 3' });
  const last = l3.doc.blocks.find((b) => b.pending);
  await ok('PUT', `/api/lessons/${l3.id}`, { date: '2026-10-15' });
  const fin3 = await ok('POST', `/api/lessons/${l3.id}/finish`, { lastBlockId: last.id });
  assert.equal(fin3.resolvedPending, 1);
  ficha = await ok('GET', `/api/students/${s.id}`);
  assert.equal(ficha.stop.pending.length, 0);
  seen = Object.fromEntries((await ok('GET', `/api/models?student=${s.id}`)).map((m) => [m.id, m.seenAt]));
  assert.equal(seen[mDeck.id], '2026-10-15');
  assert.equal(seen[mFill.id], '2026-10-08');

  // evolução do mapa
  const hist = await ok('GET', `/api/students/${s.id}/history?content=quantificadores`);
  assert.deepEqual(hist.map((x) => x.status), ['practicing', 'good']);
  assert.ok(hist.every((x) => !x.manual));

  // ajuste manual na ficha vira avaliação
  await ok('PUT', `/api/students/${s.id}`, { map: { ...ficha.map, 'Past Simple': 'practicing' } });
  const all = await ok('GET', `/api/students/${s.id}/history`);
  assert.equal(all.at(-1).content, 'Past Simple');
  assert.equal(all.at(-1).manual, true);
  // tirar do mapa (voltar para "nunca viu") também fica registrado
  const { 'Past Simple': _, ...rest } = (await ok('GET', `/api/students/${s.id}`)).map;
  const cleared = await ok('PUT', `/api/students/${s.id}`, { map: rest });
  assert.equal(cleared.map['Past Simple'], undefined);
  assert.equal((await ok('GET', `/api/students/${s.id}/history?content=Past Simple`)).length, 2);

  // última aula e contagem na lista de alunos
  const listed = (await ok('GET', '/api/students')).find((x) => x.id === s.id);
  assert.equal(listed.lastLessonAt, '2026-10-15');
  assert.equal(listed.lessonCount, 3);
});

test('descartar pendência', async () => {
  const s = await ok('POST', '/api/students', { name: 'Leo' });
  const m = await modelOf('Para descartar', ['Articles']);
  const l = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'Aula' });
  l.doc.blocks = [asBlock(m, 'x1'), asBlock(m, 'x2')];
  await ok('PUT', `/api/lessons/${l.id}`, { doc: l.doc });
  await ok('POST', `/api/lessons/${l.id}/finish`, { lastBlockId: 'x1' });
  const p = (await ok('GET', `/api/students/${s.id}`)).stop.pending[0];
  await ok('POST', `/api/pending/${p.id}/discard`);
  assert.equal((await ok('GET', `/api/students/${s.id}`)).stop.pending.length, 0);
  const next = await ok('POST', `/api/students/${s.id}/next-lesson`, {});
  assert.equal(next.doc.blocks.filter((b) => b.pending).length, 0);
});

test('nada é apagado: aulas e modelos são arquivados', async () => {
  const s = await ok('POST', '/api/students', { name: 'Arquivo' });
  const m = await modelOf('Arquivar', ['Articles']);
  const l = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'Aula' });
  l.doc.blocks.push(asBlock(m, 'z1'));
  await ok('PUT', `/api/lessons/${l.id}`, { doc: l.doc });

  await ok('DELETE', `/api/models/${m.id}`);
  assert.equal((await call('GET', `/api/models/${m.id}`)).status, 404);
  assert.ok(!(await ok('GET', '/api/models')).some((x) => x.id === m.id));
  await ok('DELETE', `/api/lessons/${l.id}`);
  assert.equal((await call('GET', `/api/lessons/${l.id}`)).status, 404);
  assert.equal((await ok('GET', `/api/students/${s.id}`)).lessons.length, 0);

  const dump = await ok('GET', '/api/export');
  assert.equal(dump.format, 'talkbox-export');
  assert.ok(dump.tables.lessons.some((x) => x.id === l.id && x.archived_at), 'a aula continua guardada');
  assert.ok(dump.tables.models.some((x) => x.id === m.id && x.status === 'archived'), 'o modelo continua guardado');
});

test('importação: itens "a revisar", sugestão de conteúdo, aprovar e desfazer lote', async () => {
  const lots = await ok('GET', '/api/imports');
  const lot = lots.find((x) => x.id === 'drive-lote-1');
  assert.equal(lot.toReview, 2);
  const review = await ok('GET', '/api/models?status=review');
  const a = review.find((m) => m.title.startsWith('Countable'));
  const b = review.find((m) => m.title === 'Sem pista nenhuma');
  assert.deepEqual(a.tags.content, ['Countable & uncountable nouns'], 'conteúdo sugerido pelos sinônimos');
  assert.equal(b.needsContent, true);

  const approved = await ok('POST', `/api/models/${a.id}/approve`);
  assert.equal(approved.status, 'published');
  assert.equal((await ok('POST', '/api/imports/drive-lote-1/undo')).archived, 1, 'só o que ainda estava a revisar');
  assert.equal((await call('GET', `/api/models/${b.id}`)).status, 404);
  assert.equal((await ok('GET', `/api/models/${a.id}`)).status, 'published');
});

test('cópia de segurança do dia', async () => {
  const { file } = await ok('POST', '/api/backup');
  assert.match(file, /^talkbox-\d{4}-\d{2}-\d{2}\.db$/);
  assert.ok(fs.existsSync(path.join(DATA, 'backups', file)));
});

test('a mesma imagem enviada duas vezes é guardada uma vez só, e entra na cópia de segurança', async () => {
  const img = Buffer.from('RIFF0000WEBPVP8 teste-imagem');
  const up = async () => (await fetch(BASE + '/api/uploads', { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: img })).json();
  const a = await up();
  const b = await up();
  assert.equal(a.url, b.url);
  await ok('POST', '/api/backup');
  assert.ok(fs.existsSync(path.join(DATA, 'backups', 'uploads', path.basename(a.url))));
});

test('datas inválidas são recusadas', async () => {
  const s = await ok('POST', '/api/students', { name: 'Data' });
  const l = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'X' });
  assert.equal((await call('PUT', `/api/lessons/${l.id}`, { date: '14/10/2026' })).status, 400);
});
