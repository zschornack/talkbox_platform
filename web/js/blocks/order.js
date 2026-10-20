// Ordenar frases: as palavras viram fichas embaralhadas; o aluno clica na ordem certa.
// Para juntar palavras numa ficha só, use " / " na frase (ex.: I / went / to the beach).
import { h, uid } from '../dom.js';
import { instructions, lines, linesPanel, panelAction, seededShuffle, norm } from './kit.js';

/** "I / went / to the beach." → { chips: ['I','went','to the beach'], end: '.' } */
export function chipsOf(answer) {
  const s = String(answer || '').trim();
  const end = (s.match(/[.?!]+$/) || [''])[0];
  const core = s.slice(0, s.length - end.length).trim();
  const chips = core.includes('/') ? core.split('/').map((x) => x.trim()).filter(Boolean) : core.split(/\s+/).filter(Boolean);
  return { chips, end };
}

export const order = {
  name: 'Ordenar frases',
  hint: 'Palavras embaralhadas: clique na ordem certa',
  create: () => ({
    label: 'PRACTICE · PUT THE WORDS IN ORDER',
    html: 'Click the words in the correct order.',
    items: [
      { id: uid('i'), answer: 'I have never been to Europe.' },
      { id: uid('i'), answer: 'Where / did you go / last weekend?' },
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const st = ctx.state();
    st.built ||= {}; // { idDoItem: [índices das fichas, na ordem clicada] }
    const local = ctx.local;
    const score = h('div.score', { role: 'status', hidden: !local.checked });
    let right = 0;

    const list = h('ol.order-list', b.items.map((it) => {
      const { chips, end } = chipsOf(it.answer);
      const pool = seededShuffle(chips.map((c, i) => i), b.id + it.id);
      const built = (st.built[it.id] ||= []).filter((i) => i < chips.length);
      const ok = built.length === chips.length && norm(built.map((i) => chips[i]).join(' ')) === norm(chips.join(' '));
      if (ok) right++;
      const set = (arr) => { st.built[it.id] = arr; local.checked = false; ctx.stateChanged(); ctx.rerender(); };
      return h('li', { class: local.checked ? (ok ? 'ok' : 'bad') : '' },
        h('div.order-line', { 'aria-label': 'Sua frase' },
          built.length
            ? built.map((ci, k) => h('button.chip-word.placed', { type: 'button', title: 'Tirar da frase', onClick: () => set(built.filter((_, j) => j !== k)) }, chips[ci]))
            : h('span.order-empty', 'Clique nas palavras abaixo…'),
          built.length === chips.length ? h('span.order-end', end) : null,
          local.checked ? h('span.mark', { class: ok ? 'ok' : 'bad' }, ok ? '✓' : `✗ ${it.answer.replace(/\s*\/\s*/g, ' ')}`) : null),
        h('div.order-pool.screen-only',
          pool.filter((ci) => !built.includes(ci)).map((ci) =>
            h('button.chip-word', { type: 'button', onClick: () => set([...built, ci]) }, chips[ci]))),
        h('div.print-only.order-print', pool.map((ci) => chips[ci]).join('  /  ')));
    }));
    score.textContent = `Acertou ${right} de ${b.items.length}.`;

    const buttons = h('div.btns.screen-only',
      h('button.btn.primary', { type: 'button', onClick: () => { local.checked = true; ctx.rerender(); } }, 'Conferir'),
      h('button.btn', {
        type: 'button',
        onClick: () => { b.items.forEach((it) => (st.built[it.id] = chipsOf(it.answer).chips.map((_, i) => i))); local.checked = true; ctx.stateChanged(); ctx.rerender(); },
      }, 'Revelar'),
      h('button.btn', { type: 'button', onClick: () => { st.built = {}; local.checked = false; ctx.stateChanged(); ctx.rerender(); } }, 'Limpar'));

    const body = h('div.block-body', h('div.block-head', instructions(ctx), buttons), list, score);
    if (local.panel) {
      body.append(linesPanel(ctx, {
        title: 'FRASES',
        help: 'Uma frase certa por linha. O programa embaralha. Use " / " para manter palavras juntas numa ficha: Where / did you go / last weekend?',
        value: b.items.map((it) => it.answer).join('\n'),
        parse: (txt) => {
          b.items = lines(txt).map((l, i) => ({ id: b.items[i]?.id || uid('i'), answer: l }));
          return { ok: true };
        },
      }));
    }
    return { body, actions: [panelAction(ctx, 'Editar frases')] };
  },
};
