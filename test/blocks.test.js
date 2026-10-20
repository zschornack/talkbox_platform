// Tipos novos de bloco (v0.6): as regras que não dependem da tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chipsOf } from '../web/js/blocks/order.js';
import { parseSpot, spotLine } from '../web/js/blocks/spot.js';
import { parseMarks } from '../web/js/blocks/timeline.js';
import { past, participle, ing, third, TENSES } from '../web/js/blocks/tense.js';
import { seededShuffle } from '../web/js/blocks/kit.js';

test('ordenar frases: fichas, " / " junta palavras e a pontuação final fica de fora', () => {
  assert.deepEqual(chipsOf('I have never been to Europe.'), { chips: ['I', 'have', 'never', 'been', 'to', 'Europe'], end: '.' });
  assert.deepEqual(chipsOf('Where / did you go / last weekend?'), { chips: ['Where', 'did you go', 'last weekend'], end: '?' });
  const a = [1, 2, 3, 4, 5];
  assert.deepEqual(seededShuffle(a, 'x'), seededShuffle(a, 'x'), 'sempre igual (também no PDF)');
  assert.notDeepEqual(seededShuffle(a, 'x'), a, 'nunca na ordem certa');
});

test('encontrar o erro: [errada=certa], ida e volta', () => {
  const it = parseSpot('She [have=has] seen a fox.');
  assert.deepEqual(it, { words: ['She', 'have', 'seen', 'a', 'fox.'], wrong: 1, fix: 'has' });
  assert.equal(spotLine(it), 'She [have=has] seen a fox.');
  assert.equal(parseSpot('sem marca'), null);
  assert.equal(parseSpot('I like [it=]. ').words[2], 'it.', 'pontuação colada fica com a palavra');
});

test('linha do tempo: pontos e intervalos', () => {
  const { marks } = parseMarks('35 | 2019\n10-90 | MY LIFE');
  assert.equal(marks[0].kind, 'point');
  assert.equal(marks[0].at, 35);
  assert.deepEqual([marks[1].kind, marks[1].from, marks[1].to, marks[1].text], ['range', 10, 90, 'MY LIFE']);
  assert.ok(parseMarks('qualquer coisa').error);
});

test('tabela de tempo verbal: formas e uma linha por pessoa, he/she/it juntos', () => {
  assert.deepEqual([past('stop'), past('study'), past('play'), past('go'), participle('eat'), participle('visit')], ['stopped', 'studied', 'played', 'went', 'eaten', 'visited']);
  assert.deepEqual([ing('make'), ing('swim'), ing('lie'), ing('see')], ['making', 'swimming', 'lying', 'seeing']);
  assert.deepEqual([third('watch'), third('try'), third('have'), third('go')], ['watches', 'tries', 'has', 'goes']);
  const pp = TENSES['present-perfect'];
  assert.deepEqual([0, 1, 2, 3, 4].map((p) => pp.row('visit', p)[0]), ['have', 'have', 'has', 'have', 'have']);
  assert.notEqual(pp.row('visit', 0)[1], pp.row('visit', 2)[1], 'have e has com cores diferentes (regra 2)');
  assert.deepEqual([0, 1, 2].map((p) => TENSES['present-simple'].row('be', p)[2]), ['am', 'are', 'is']);
});
