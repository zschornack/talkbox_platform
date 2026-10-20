// Tabela de tempo verbal: escolha o verbo e o tempo, e a tabela se monta sozinha seguindo a metodologia:
// um verbo só, todas as pessoas (uma por linha, He / She / It juntos) e cores diferentes para regras diferentes.
import { h } from '../dom.js';
import { editable } from '../editable.js';

// Verbos irregulares mais comuns: base → [passado, particípio]
const IRREGULAR = {
  be: ['was', 'been'], beat: ['beat', 'beaten'], become: ['became', 'become'], begin: ['began', 'begun'], bite: ['bit', 'bitten'],
  blow: ['blew', 'blown'], break: ['broke', 'broken'], bring: ['brought', 'brought'], build: ['built', 'built'], burn: ['burnt', 'burnt'],
  buy: ['bought', 'bought'], catch: ['caught', 'caught'], choose: ['chose', 'chosen'], come: ['came', 'come'], cost: ['cost', 'cost'],
  cut: ['cut', 'cut'], dig: ['dug', 'dug'], do: ['did', 'done'], draw: ['drew', 'drawn'], dream: ['dreamt', 'dreamt'], drink: ['drank', 'drunk'],
  drive: ['drove', 'driven'], eat: ['ate', 'eaten'], fall: ['fell', 'fallen'], feed: ['fed', 'fed'], feel: ['felt', 'felt'], fight: ['fought', 'fought'],
  find: ['found', 'found'], fly: ['flew', 'flown'], forget: ['forgot', 'forgotten'], forgive: ['forgave', 'forgiven'], freeze: ['froze', 'frozen'],
  get: ['got', 'got'], give: ['gave', 'given'], go: ['went', 'gone'], grow: ['grew', 'grown'], hang: ['hung', 'hung'], have: ['had', 'had'],
  hear: ['heard', 'heard'], hide: ['hid', 'hidden'], hit: ['hit', 'hit'], hold: ['held', 'held'], hurt: ['hurt', 'hurt'], keep: ['kept', 'kept'],
  know: ['knew', 'known'], lay: ['laid', 'laid'], lead: ['led', 'led'], learn: ['learned', 'learned'], leave: ['left', 'left'], lend: ['lent', 'lent'],
  let: ['let', 'let'], lie: ['lay', 'lain'], lose: ['lost', 'lost'], make: ['made', 'made'], mean: ['meant', 'meant'], meet: ['met', 'met'],
  pay: ['paid', 'paid'], put: ['put', 'put'], quit: ['quit', 'quit'], read: ['read', 'read'], ride: ['rode', 'ridden'], ring: ['rang', 'rung'],
  rise: ['rose', 'risen'], run: ['ran', 'run'], say: ['said', 'said'], see: ['saw', 'seen'], sell: ['sold', 'sold'], send: ['sent', 'sent'],
  set: ['set', 'set'], shake: ['shook', 'shaken'], shine: ['shone', 'shone'], shoot: ['shot', 'shot'], show: ['showed', 'shown'], shut: ['shut', 'shut'],
  sing: ['sang', 'sung'], sink: ['sank', 'sunk'], sit: ['sat', 'sat'], sleep: ['slept', 'slept'], speak: ['spoke', 'spoken'], spend: ['spent', 'spent'],
  stand: ['stood', 'stood'], steal: ['stole', 'stolen'], stick: ['stuck', 'stuck'], swim: ['swam', 'swum'], take: ['took', 'taken'],
  teach: ['taught', 'taught'], tear: ['tore', 'torn'], tell: ['told', 'told'], think: ['thought', 'thought'], throw: ['threw', 'thrown'],
  understand: ['understood', 'understood'], wake: ['woke', 'woken'], wear: ['wore', 'worn'], win: ['won', 'won'], write: ['wrote', 'written'],
};
// verbos curtos que dobram a consoante final (stop → stopped, run → running)
const DOUBLE = new Set(['stop', 'plan', 'shop', 'drop', 'chat', 'jog', 'hug', 'rob', 'beg', 'clap', 'grab', 'skip', 'step', 'travel', 'prefer', 'admit', 'regret', 'run', 'swim', 'sit', 'get', 'put', 'cut', 'hit', 'begin', 'win', 'set', 'let', 'forget']);

export function past(v) {
  if (IRREGULAR[v]) return IRREGULAR[v][0];
  if (v.endsWith('e')) return v + 'd';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ied';
  if (DOUBLE.has(v)) return v + v.at(-1) + 'ed';
  return v + 'ed';
}
export const participle = (v) => (IRREGULAR[v] ? IRREGULAR[v][1] : past(v));
export function ing(v) {
  if (v === 'be') return 'being';
  if (v.endsWith('ie')) return v.slice(0, -2) + 'ying';
  if (v.endsWith('e') && !v.endsWith('ee') && v !== 'be') return v.slice(0, -1) + 'ing';
  if (DOUBLE.has(v)) return v + v.at(-1) + 'ing';
  return v + 'ing';
}
export function third(v) {
  if (v === 'have') return 'has';
  if (v === 'be') return 'is';
  if (/(s|sh|ch|x|z|o)$/.test(v)) return v + 'es';
  if (/[^aeiou]y$/.test(v)) return v.slice(0, -1) + 'ies';
  return v + 's';
}

const PEOPLE = ['I', 'You', 'He / She / It', 'We', 'They'];
// cores fixas por regra (as mesmas do resto das explicações)
const C = { a: '#CBE4D8', b: '#FFC9A3', c: '#FFDB8F' };
const mark = (t, color) => `<span style="background-color: ${color}"><b>${t}</b></span>`;

/** Cada tempo: nome, legenda e as partes por pessoa (auxiliar, cor do auxiliar, forma do verbo, cor da forma). */
export const TENSES = {
  'present-simple': {
    name: 'Present Simple', legend: [['verb', C.a, 'I, you, we, they'], ['verb + s', C.b, 'he, she, it']],
    row: (v, p) => (v === 'be'
      ? [null, null, ['am', 'are', 'is', 'are', 'are'][p], [C.a, C.c, C.b, C.c, C.c][p]]
      : p === 2 ? [null, null, third(v), C.b] : [null, null, v, C.a]),
  },
  'present-continuous': {
    name: 'Present Continuous', legend: [['am', C.a, 'I'], ['is', C.b, 'he, she, it'], ['are', C.c, 'you, we, they'], ['verb + ing', null, '']],
    row: (v, p) => [['am', 'are', 'is', 'are', 'are'][p], [C.a, C.c, C.b, C.c, C.c][p], ing(v), null],
  },
  'past-simple': {
    name: 'Past Simple', legend: [['past form', C.c, 'the same for everyone']],
    row: (v, p) => (v === 'be' ? [null, null, p === 0 || p === 2 ? 'was' : 'were', p === 0 || p === 2 ? C.a : C.b] : [null, null, past(v), C.c]),
  },
  'past-continuous': {
    name: 'Past Continuous', legend: [['was', C.a, 'I, he, she, it'], ['were', C.b, 'you, we, they'], ['verb + ing', null, '']],
    row: (v, p) => [p === 0 || p === 2 ? 'was' : 'were', p === 0 || p === 2 ? C.a : C.b, ing(v), null],
  },
  'present-perfect': {
    name: 'Present Perfect', legend: [['have', C.a, 'I, you, we, they'], ['has', C.b, 'he, she, it'], ['form 3', C.c, 'past participle']],
    row: (v, p) => [p === 2 ? 'has' : 'have', p === 2 ? C.b : C.a, participle(v), C.c],
  },
  'present-perfect-continuous': {
    name: 'Present Perfect Continuous', legend: [['have been', C.a, 'I, you, we, they'], ['has been', C.b, 'he, she, it'], ['verb + ing', null, '']],
    row: (v, p) => [p === 2 ? 'has been' : 'have been', p === 2 ? C.b : C.a, ing(v), null],
  },
  'past-perfect': {
    name: 'Past Perfect', legend: [['had', C.a, 'everyone'], ['form 3', C.c, 'past participle']],
    row: (v) => ['had', C.a, participle(v), C.c],
  },
  'future-will': {
    name: 'Future (will)', legend: [['will', C.b, 'everyone'], ['verb', null, 'base form']],
    row: (v) => ['will', C.b, v, null],
  },
  'future-going-to': {
    name: 'Future (going to)', legend: [['am going to', C.a, 'I'], ['is going to', C.b, 'he, she, it'], ['are going to', C.c, 'you, we, they'], ['verb', null, 'base form']],
    row: (v, p) => [['am going to', 'are going to', 'is going to', 'are going to', 'are going to'][p], [C.a, C.c, C.b, C.c, C.c][p], v, null],
  },
  'future-perfect': {
    name: 'Future Perfect', legend: [['will have', C.b, 'everyone'], ['form 3', C.c, 'past participle']],
    row: (v) => ['will have', C.b, participle(v), C.c],
  },
};

export const tense = {
  name: 'Tabela de tempo verbal',
  hint: 'Escolha verbo e tempo: a tabela se monta sozinha',
  create: () => ({ label: '', verb: 'work', tense: 'present-perfect', complement: '' }),
  render(ctx) {
    const b = ctx.block;
    const t = TENSES[b.tense] || TENSES['present-perfect'];
    const verb = String(b.verb || 'work').trim().toLowerCase();
    const hasAux = PEOPLE.some((_, p) => t.row(verb, p)[0]);
    const cols = hasAux ? 4 : 3;
    const grid = `repeat(${cols}, minmax(110px, 1fr))`;
    const head = ['PERSON', ...(hasAux ? ['AUXILIARY'] : []), 'VERB', ''];
    const cell = (html) => { const el = h('div.tcell'); el.innerHTML = html; return el; };
    const rows = [
      h('div.trow.head', { style: { gridTemplateColumns: grid } }, head.map((x) => h('div.tcell', x))),
      ...PEOPLE.map((person, p) => {
        const [aux, auxColor, form, formColor] = t.row(verb, p);
        return h('div.trow', { style: { gridTemplateColumns: grid } },
          h('div.tcell', person),
          hasAux ? cell(aux ? mark(aux, auxColor) : '') : null,
          cell(formColor ? mark(form, formColor) : `<b>${form}</b>`),
          h('div.tcell', b.complement || ''));
      }),
    ];
    const legend = h('div.tense-legend', t.legend.map(([w, color, who]) =>
      h('span', color ? h('span.tl-chip', { style: { backgroundColor: color } }, w) : h('b', w), who ? ` = ${who}` : '')));
    const body = h('div.block-body',
      h('div.tense-title', `${t.name.toUpperCase()} · ${verb.toUpperCase()}`),
      h('div.ttable-scroll', h('div.ttable', { role: 'table' }, rows)),
      legend);
    if (ctx.local.panel) {
      body.append(h('div.panel',
        h('h4', 'TEMPO E VERBO'),
        h('div.help', 'Um verbo só por tabela (metodologia, regra 1). Os verbos irregulares mais comuns são reconhecidos sozinhos.'),
        h('div.field-row',
          h('label.field', h('span.field-label', 'Tempo'),
            h('select', { value: b.tense, onChange: (e) => { b.tense = e.target.value; ctx.changed(); ctx.rerender(); } },
              Object.entries(TENSES).map(([k, x]) => h('option', { value: k }, x.name)))),
          h('label.field', h('span.field-label', 'Verbo (forma base)'),
            h('input', { type: 'text', value: b.verb, onChange: (e) => { b.verb = e.target.value.trim().toLowerCase(); ctx.changed(); ctx.rerender(); } })),
          h('label.field', h('span.field-label', 'Complemento (opcional)'),
            h('input', { type: 'text', value: b.complement || '', placeholder: 'Rio.', onChange: (e) => { b.complement = e.target.value; ctx.changed(); ctx.rerender(); } })))));
    }
    return { body, actions: [panelActionTense(ctx)] };
  },
};
const panelActionTense = (ctx) => ({ label: 'Escolher tempo e verbo', on: !!ctx.local.panel, onClick: () => { ctx.local.panel = !ctx.local.panel; ctx.rerender(); } });
