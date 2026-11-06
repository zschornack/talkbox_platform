// Tipos novos de bloco (v0.6): as regras que não dependem da tela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chipsOf } from '../web/js/blocks/order.js';
import { parseSpot, spotLine } from '../web/js/blocks/spot.js';
import { parseMarks } from '../web/js/blocks/timeline.js';
import { past, participle, ing, third, TENSES } from '../web/js/blocks/tense.js';
import { seededShuffle, columnTemplate } from '../web/js/blocks/kit.js';

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

test('baralho: a carta pode ter a própria palavra-desafio ([try: …])', async () => {
  const { splitTry } = await import('../web/js/blocks/deck.js');
  assert.deepEqual(splitTry('What is your dream job? [try: ambitious]'), { q: 'What is your dream job?', word: 'ambitious' });
  assert.deepEqual(splitTry('Do you like rap?'), { q: 'Do you like rap?', word: '' });
  assert.deepEqual(splitTry('Who is your rival?[TRY:  a rival ]'), { q: 'Who is your rival?', word: 'a rival' });
});

test('tabela (v1.1): colunas pelo conteúdo, sem quebrar palavra no meio e sem passar da largura', () => {
  const split = (t) => t.split(/ (?=minmax|min\()/);
  const n = (c) => Number(c.match(/\* (\d+)\)/)[1]);
  const cap = (c) => Number(c.match(/, ([\d.]+)%\)/)[1]);
  const weight = (c) => Number((c.match(/, (\d+)fr\)$/) || [0, 0])[1]);
  // palavra curta numa coluna estreita; os exemplos ficam com o resto da largura
  const words = split(columnTemplate([['Word', 'Example'], ['Who', 'Who is your teacher?'], ['How often', 'How often do you go to the gym?']], 2));
  assert.equal(words.length, 2);
  assert.ok(!words[0].includes('fr') && weight(words[1]) > 0, 'coluna curta tem medida fixa; a de frases fica com a sobra');
  assert.ok(n(words[0]) >= Math.ceil('How often'.length * 0.56 + 2.6), '"How often" cabe numa linha');
  // tempo verbal: tudo curto, a última coluna fica com a sobra (o verbo não vai parar no meio da tabela)
  const tense = split(columnTemplate([['PERSON', 'VERB', ''], ['I', '<mark style="background:#FFDB8F">worked</mark>', 'yesterday.'], ['He / She / It', 'worked', 'yesterday.']], 3));
  assert.deepEqual(tense.map((c) => c.includes('fr')), [false, false, true]);
  // nenhuma palavra quebra: a medida mínima acompanha a palavra mais longa
  const long = split(columnTemplate([['a', 'responsibilities are shared by everyone in the team'], ['b', 'it is a long sentence to make this column wide']], 2));
  assert.ok(n(long[1]) >= Math.ceil('responsibilities'.length * 0.62 + 2.8));
  assert.ok([...words, ...tense, ...long].every((c) => c.includes('var(--cell')), 'a medida usa a letra da tabela (cabeçalho e linhas alinhados)');
  // o HTML do destaque não conta como texto; quebra de linha na célula conta a linha mais longa
  assert.equal(columnTemplate([['<mark style="background:#FFDB8F">I</mark>']], 1), 'minmax(min(calc(var(--cell, 1em) * 4), 100%), 6fr)');
  assert.equal(columnTemplate([['go<br>went', 'x']], 2), columnTemplate([['went', 'x']], 2));
  // texto muito longo não toma a tabela inteira; muitas colunas nunca passam da largura
  assert.equal(weight(columnTemplate([['x'.repeat(200)]], 1)), 36);
  const seven = split(columnTemplate([Array(7).fill('responsibilities')], 7));
  assert.ok(seven.reduce((sum, c) => sum + cap(c), 0) <= 100);
});

test('ligar colunas (v1.1): o app embaralha de verdade as duas colunas, sem par na mesma linha', async () => {
  const { matchOrder } = await import('../web/js/blocks/match.js');
  const pairs = 'abcdefgh'.split('').map((x, i) => ({ id: 'p' + i, left: x, right: x.toUpperCase() }));
  const a = matchOrder(pairs, 'bloco1');
  assert.deepEqual(a, matchOrder(pairs, 'bloco1'), 'mesma semente, mesma ordem (reabrir a aula, PDF)');
  assert.ok(a.right.every((p, i) => p !== a.left[i]), 'nenhum par começa na mesma linha');
  assert.notDeepEqual(a.left.map((p) => p.id), pairs.map((p) => p.id), 'a coluna da esquerda também sai embaralhada');
  // embaralhar de verdade: em 200 sementes, cada item cai em várias posições diferentes
  const seen = new Set();
  for (let k = 0; k < 200; k++) seen.add(matchOrder(pairs, 'x' + k).right.findIndex((p) => p.id === 'p0'));
  assert.ok(seen.size >= 7, `p0 apareceu em ${seen.size} posições`);
  // não sobram blocos de vizinhos juntos (o embaralhamento antigo só girava pedaços)
  let adjacent = 0;
  for (let k = 0; k < 200; k++) { const r = matchOrder(pairs, 's' + k).right.map((p) => p.id); for (let i = 1; i < r.length; i++) if (+r[i].slice(1) === +r[i - 1].slice(1) + 1) adjacent++; }
  assert.ok(adjacent / 200 < 2, `vizinhos em ordem por embaralhamento: ${adjacent / 200}`);
});
