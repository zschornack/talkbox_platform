// Galeria de formatos: cada formato tem o guia e dois exemplos certinhos (respostas coerentes, imagens que existem).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { BLOCKS, MENU } from '../web/js/blocks/index.js';
import { EXAMPLES, GUIDE, FORMAT_GROUPS } from '../web/js/blocks/examples.js';
import { chipsOf } from '../web/js/blocks/order.js';
import { CONTENT_SUGGESTIONS } from '../web/js/catalog.js';

const types = FORMAT_GROUPS.flatMap((g) => g.types);

test('todo formato do menu (menos anotações) está na galeria, com guia e dois exemplos', () => {
  assert.deepEqual([...types].sort(), MENU.filter((t) => t !== 'notes').sort());
  for (const t of types) {
    assert.ok(BLOCKS[t], t);
    assert.ok(GUIDE[t]?.purpose && GUIDE[t].how.length && GUIDE[t].edit, `guia de ${t}`);
    assert.equal(EXAMPLES[t].length, 2, `dois exemplos de ${t}`);
    for (const ex of EXAMPLES[t]) {
      assert.equal(ex.block.type, t, `${t}: ${ex.title}`);
      assert.ok(ex.title && ex.use && ex.level, `${t}: título, uso e nível`);
      for (const c of ex.tags.content || []) assert.ok(CONTENT_SUGGESTIONS.includes(c), `${ex.title}: "${c}" não é um conteúdo oficial`);
    }
  }
});

test('exemplos de exercício têm respostas coerentes', () => {
  for (const [t, list] of Object.entries(EXAMPLES)) {
    for (const { title, block: b } of list) {
      if (t === 'fill') b.items.forEach((it) => assert.ok(it.hint && it.answers.length, `${title}: ${it.before}`));
      if (t === 'choice') b.items.forEach((it) => assert.ok(it.answer >= 0 && it.answer < it.options.length, `${title}: ${it.before}`));
      if (t === 'spot') b.items.forEach((it) => assert.ok(it.wrong >= 0 && it.wrong < it.words.length && it.fix, `${title}: ${it.words.join(' ')}`));
      if (t === 'sort') b.items.forEach((it) => assert.ok(it.group >= 0 && it.group < b.groups.length, `${title}: ${it.text}`));
      if (t === 'order') b.items.forEach((it) => assert.ok(chipsOf(it.answer).chips.length >= 3, `${title}: ${it.answer}`));
      if (t === 'transform') b.items.forEach((it) => assert.ok(it.answers.length, `${title}: ${it.sentence}`));
      if (t === 'match') assert.ok(b.pairs.length >= 3, title);
      if (t === 'reveal') b.items.forEach((it) => assert.ok(it.q && it.a, title));
    }
  }
});

test('as imagens dos exemplos existem em web/img/examples', () => {
  const srcs = Object.values(EXAMPLES).flat().flatMap(({ block: b }) => [b.src, ...(b.images || []).map((x) => x.src)]).filter(Boolean);
  assert.ok(srcs.length >= 8);
  for (const src of srcs) assert.ok(fs.existsSync(path.join('web', src)), src);
});
