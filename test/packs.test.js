// Acervo de imagens: etiquetas livres, pacotes (ex.: Animals), imagens em vários pacotes, tirar do pacote sem
// apagar, pacote vindo da pasta content/ e troca do endereço de uma imagem em todo lugar.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = 4300 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'talkbox-packs-'));
const CONTENT = path.join(DATA, 'content');
fs.mkdirSync(path.join(CONTENT, 'images', 'farm'), { recursive: true });
// uma "imagem" WebP mínima (só o cabeçalho, o suficiente para o servidor)
const fakeWebp = (n) => Buffer.concat([Buffer.from('RIFF0000WEBPVP8 '), Buffer.from(String(n))]);
fs.writeFileSync(path.join(CONTENT, 'images', 'farm', 'cow.webp'), fakeWebp(1));
fs.writeFileSync(path.join(CONTENT, 'images', 'farm', 'pig.webp'), fakeWebp(2));
fs.writeFileSync(path.join(CONTENT, 'farm.json'), JSON.stringify({
  id: 'pack-farm',
  imagePacks: [{
    name: 'Farm animals', keywords: ['animals', 'farm'],
    images: [
      { file: 'images/farm/cow.webp', title: 'Cow', keywords: ['cow', 'milk'] },
      { file: 'images/farm/pig.webp', title: 'Pig', keywords: ['Pig'] },
    ],
  }],
}));
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server/start.js'], { env: { ...process.env, PORT: String(PORT), TALKBOX_DATA: DATA, TALKBOX_CONTENT: CONTENT }, stdio: 'pipe' });
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
const upload = async (n) => (await (await fetch(BASE + '/api/uploads', { method: 'POST', headers: { 'Content-Type': 'image/webp' }, body: fakeWebp(n) })).json()).url;
const image = (title, src, keywords, packIds) =>
  ok('POST', '/api/models', { title, type: 'image', block: { type: 'image', src, caption: '', layout: 'full' }, tags: { keywords, skills: ['Fala'] }, packIds });

test('pacote da pasta content/: imagens no acervo, com as etiquetas do pacote e as próprias', async () => {
  const packs = await ok('GET', '/api/packs');
  const farm = packs.find((p) => p.name === 'Farm animals');
  assert.equal(farm.count, 2);
  assert.equal(farm.cover.length, 2);
  const full = await ok('GET', `/api/packs/${farm.id}`);
  assert.deepEqual(full.items.map((m) => m.title), ['Cow', 'Pig']);
  assert.deepEqual(full.items[1].tags.keywords, ['animals', 'farm', 'pig'], 'minúsculas, sem repetir');
  assert.match(full.items[0].block.src, /^\/uploads\/[0-9a-f]{32}\.webp$/);
});

test('etiquetas livres separadas por vírgula, imagem em dois pacotes e tirar do pacote sem apagar', async () => {
  const transport = await ok('POST', '/api/packs', { name: 'Means of transport', keywords: 'transport' });
  const blue = await ok('POST', '/api/packs', { name: 'Blue things' });
  assert.equal((await call('POST', '/api/packs', { name: 'means of TRANSPORT' })).status, 400, 'nome repetido');
  assert.equal((await call('POST', '/api/packs', { name: ' ' })).status, 400);

  const src = await upload(10);
  const fusca = await image('Blue Beetle on the street', src, 'means of transport, Car,  blue , car', [transport.id, blue.id]);
  assert.deepEqual(fusca.tags.keywords, ['means of transport', 'car', 'blue']);
  assert.deepEqual(fusca.packs.sort(), [blue.id, transport.id].sort());
  assert.equal(fusca.needsContent, false, 'com etiquetas livres a imagem já está etiquetada');

  // imagem sem arquivo não é salva
  assert.equal((await call('POST', '/api/models', { title: 'x', type: 'image', block: { type: 'image', src: '' } })).status, 400);

  const out = await ok('POST', `/api/packs/${blue.id}/remove`, { modelIds: [fusca.id] });
  assert.equal(out.removed, 1);
  assert.equal(out.pack.count, 0);
  assert.equal((await ok('GET', `/api/models/${fusca.id}`)).packs.length, 1, 'continua no outro pacote');
  // voltar para o pacote
  assert.equal((await ok('POST', `/api/packs/${blue.id}/items`, { modelIds: [fusca.id, fusca.id] })).added, 1);
  // só imagens entram em pacote
  const deck = await ok('POST', '/api/models', { title: 'Deck', type: 'deck', block: { type: 'deck', cats: [] } });
  assert.equal((await ok('POST', `/api/packs/${blue.id}/items`, { modelIds: [deck.id] })).added, 0);

  // arquivar o pacote não mexe nas imagens
  await ok('DELETE', `/api/packs/${transport.id}`);
  assert.equal((await call('GET', `/api/packs/${transport.id}`)).status, 404);
  assert.deepEqual((await ok('GET', `/api/models/${fusca.id}`)).packs, [blue.id]);
  const db = new DatabaseSync(path.join(DATA, 'talkbox.db'));
  assert.throws(() => db.exec('DELETE FROM pack_items'), /não saem assim/);
  assert.throws(() => db.exec('DELETE FROM packs'), /não são apagados/);
  db.close();
});

test('guardar no computador: o endereço da imagem muda no acervo, nas aulas (também nas galerias) e nas pendências', async () => {
  const web = 'https://upload.wikimedia.org/x/Beetle.jpg';
  const m = await image('Beetle', web, ['car']);
  const s = await ok('POST', '/api/students', { name: 'Lia' });
  const l = await ok('POST', `/api/students/${s.id}/lessons`, { title: 'Cars' });
  const gallery = { id: 'gal1', type: 'gallery', label: 'PICTURES', html: '', columns: 3, hidden: true, images: [
    { id: 'g1', src: web, caption: 'Beetle', modelId: m.id },
    { id: 'g2', src: '/img/examples/flood.webp', caption: 'Flood' },
  ] };
  l.doc.blocks = [{ ...m.block, id: 'img1', source: { modelId: m.id, title: m.title } }, gallery, { id: 'n', type: 'notes', html: '' }];
  await ok('PUT', `/api/lessons/${l.id}`, { doc: l.doc });
  await ok('POST', `/api/lessons/${l.id}/finish`, { lastBlockId: null, assessments: {} });

  const local = await upload(20);
  assert.equal((await call('POST', '/api/images/replace', { from: web, to: 'https://outro.site/x.jpg' })).status, 400, 'só para o acervo local');
  const out = await ok('POST', '/api/images/replace', { from: web, to: local });
  // o bloco de imagem da aula e a pendência dele só apontam para o modelo (v0.8): mudam junto com o modelo
  assert.deepEqual(out, { models: 1, lessons: 1, pending: 1 });
  assert.equal((await ok('GET', `/api/models/${m.id}`)).block.src, local);
  const doc = (await ok('GET', `/api/lessons/${l.id}`)).doc;
  assert.equal(doc.blocks[0].src, local);
  assert.deepEqual(doc.blocks[1].images.map((x) => x.src), [local, '/img/examples/flood.webp']);
});

test('o servidor só busca imagens http(s)', async () => {
  assert.equal((await call('GET', '/api/images/fetch?url=file:///etc/passwd')).status, 400);
  assert.equal((await call('GET', '/api/images/fetch?url=nada')).status, 400);
});

test('a exportação leva os pacotes', async () => {
  const data = await ok('GET', '/api/export');
  assert.ok(data.tables.packs.length >= 2);
  assert.ok(data.tables.pack_items.length >= 3);
});
