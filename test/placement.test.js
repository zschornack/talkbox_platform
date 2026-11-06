// Nivelamento (v1.2): o conteúdo do teste e a conta do nível.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, stageScore, suggestLevel, suggestMap, summaryText } from '../web/js/placement-data.js';
import { CONTENTS } from '../web/js/catalog.js';

const all = (pick) => Object.fromEntries(STAGES.flatMap((st) => [...st.grammar, ...st.reading.questions]).map((it) => [it.id, pick(it)]));
const right = all((it) => it.answer);
const wrong = all((it) => (it.answer + 1) % it.options.length);
const full = { talk: 3, listen: 3 };

test('nivelamento: 4 etapas completas, respostas válidas, conteúdos oficiais, sem emoji', () => {
  assert.equal(STAGES.length, 4);
  const ids = new Set();
  const names = new Set(CONTENTS.filter((c) => c.section !== 'theme').map((c) => c.name));
  for (const st of STAGES) {
    assert.equal(st.talk.length, 3); assert.equal(st.listening.length, 2);
    assert.equal(st.grammar.length, 6); assert.equal(st.reading.questions.length, 2);
    for (const it of [...st.grammar, ...st.reading.questions]) {
      assert.ok(!ids.has(it.id), `id repetido: ${it.id}`); ids.add(it.id);
      assert.ok(it.answer >= 0 && it.answer < it.options.length, it.id);
      assert.equal(new Set(it.options).size, it.options.length, `opções repetidas em ${it.id}`);
    }
    for (const g of st.grammar) if (g.content) assert.ok(names.has(g.content), `conteúdo fora do mapa: ${g.content}`);
  }
  assert.doesNotMatch(JSON.stringify(STAGES), /\p{Extended_Pictographic}/u);
});

test('nivelamento: pontos e nível sugerido', () => {
  const s = (answers, rating = full) => STAGES.map((st) => stageScore(st, answers, rating));
  assert.equal(stageScore(STAGES[0], right, full).pct, 1);
  assert.equal(stageScore(STAGES[0], right, {}).max, 8, 'sem nota do professor, conta só o que o app corrige');
  assert.equal(suggestLevel(s(wrong, { talk: 0, listen: 0 }), 1), 'A1');
  assert.equal(suggestLevel(s(right), 1), 'A2', 'parou depois do básico');
  assert.equal(suggestLevel(s(right), 2), 'B1');
  assert.equal(suggestLevel(s(right), 3), 'B2');
  assert.equal(suggestLevel(s(right), 4), 'C2');
  const mixed = s(right); mixed[3] = stageScore(STAGES[3], wrong, full); // avançado: só a nota de fala e escuta
  assert.equal(suggestLevel(mixed, 4), 'B2');
});

test('nivelamento: mapa da ficha e resumo', () => {
  const answers = { ...right, 'b-g2': 0 };
  const map = suggestMap(answers, 1);
  assert.equal(map['Present Continuous'], 'practicing', 'passou na etapa, errou: Praticando');
  assert.equal(map['Verb to be'], 'good');
  assert.equal(map['Present Perfect'], undefined, 'etapa não feita não entra');
  assert.equal(suggestMap({ ...right, 'u-g4': 0 }, 4)['Passive voice'], 'practicing', 'um erro no mesmo conteúdo já marca Praticando');
  // não passou na etapa: o que acertou fica Praticando, o que errou fica Nunca viu
  const weak = { ...right, 'i-g1': 2, 'i-g2': 0, 'i-g3': 0, 'i-g4': 1, 'i-r1': 0 };
  const m2 = suggestMap(weak, 2, STAGES.map((st) => stageScore(st, weak, { talk: 1, listen: 1 })));
  assert.equal(m2['Present Perfect'], 'none');
  assert.equal(m2['Used to'], 'practicing');
  const text = summaryText(STAGES.map((st) => stageScore(st, right, { talk: 2 })), 2, 'B1', new Date(2026, 10, 5));
  assert.match(text, /Nivelamento em 05\/11\/2026: nível B1/);
  assert.match(text, /fala 2\/3, escuta —/);
});
