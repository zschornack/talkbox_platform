// Encontrar o erro: o aluno clica na palavra errada de cada frase; depois aparece a correção.
// No painel: She [have=has] seen a fox.  (a palavra errada entre colchetes, = a correção)
import { h, uid } from '../dom.js';
import { instructions, lines, linesPanel, panelAction } from './kit.js';

/** "She [have=has] seen a fox." → { words: ['She','have','seen','a','fox.'], wrong: 1, fix: 'has' } */
export function parseSpot(line) {
  const m = String(line).match(/^(.*?)\[(.+?)=(.*?)\](.*)$/);
  if (!m) return null;
  const before = m[1].trim().split(/\s+/).filter(Boolean);
  const after = m[4].trim().split(/\s+/).filter(Boolean);
  // pontuação colada depois do colchete fica com a palavra errada
  let wrongWord = m[2].trim();
  if (after[0] && /^[.,!?;:]+$/.test(after[0])) wrongWord += after.shift();
  return { words: [...before, wrongWord, ...after], wrong: before.length, fix: m[3].trim() };
}
export const spotLine = (it) => it.words.map((w, i) => (i === it.wrong ? `[${w.replace(/[.,!?;:]+$/, '')}=${it.fix}]${(w.match(/[.,!?;:]+$/) || [''])[0]}` : w)).join(' ');

export const spot = {
  name: 'Encontrar o erro',
  hint: 'Clique na palavra errada e veja a correção',
  create: () => ({
    label: 'PRACTICE · SPOT THE MISTAKE',
    html: 'Each sentence has one mistake. Click the wrong word, then say the correct sentence.',
    items: [
      { id: uid('i'), ...parseSpot('She [have=has] seen a fox.') },
      { id: uid('i'), ...parseSpot('I [am=have] living here since 2019.') },
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const st = ctx.state();
    st.clicked ||= {}; // { idDoItem: índice da palavra clicada }
    let right = 0;
    const list = h('ol.spot-list', b.items.map((it) => {
      const picked = st.clicked[it.id];
      const found = picked === it.wrong;
      if (found) right++;
      return h('li',
        h('span.spot-words', it.words.map((w, i) =>
          h('button.spot-word', {
            type: 'button',
            class: picked === i ? (i === it.wrong ? 'ok' : 'bad') : '',
            onClick: () => { st.clicked[it.id] = picked === i ? undefined : i; ctx.stateChanged(); ctx.rerender(); },
          }, w))),
        found ? h('span.spot-fix', '→ ', h('b', it.fix)) : null);
    }));
    const score = h('div.score', { role: 'status', hidden: !Object.keys(st.clicked).length }, `Encontrou ${right} de ${b.items.length}.`);
    const buttons = h('div.btns.screen-only',
      h('button.btn', { type: 'button', onClick: () => { b.items.forEach((it) => (st.clicked[it.id] = it.wrong)); ctx.stateChanged(); ctx.rerender(); } }, 'Revelar'),
      h('button.btn', { type: 'button', onClick: () => { st.clicked = {}; ctx.stateChanged(); ctx.rerender(); } }, 'Limpar'));
    const body = h('div.block-body', h('div.block-head', instructions(ctx), buttons), list, score);
    if (ctx.local.panel) {
      body.append(linesPanel(ctx, {
        title: 'FRASES',
        help: 'Uma por linha. Coloque a palavra errada entre colchetes com a correção depois do =. Ex.: She [have=has] seen a fox.',
        value: b.items.map(spotLine).join('\n'),
        parse: (txt) => {
          const ls = lines(txt);
          const parsed = ls.map(parseSpot);
          const bad = parsed.findIndex((p) => !p);
          if (bad >= 0) return { error: `Linha ${bad + 1}: marque a palavra errada assim: [errada=certa].` };
          b.items = parsed.map((p, i) => ({ id: b.items[i]?.id || uid('i'), ...p }));
          return { ok: true };
        },
      }));
    }
    return { body, actions: [panelAction(ctx, 'Editar frases')] };
  },
};
