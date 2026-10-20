// Lista com revelar: cada linha tem um enunciado e a resposta só daquela linha aparece com um clique.
// É o "5 frases com Revelar" da metodologia. O que já foi revelado fica no estado da aula.
import { h, uid, escapeHtml } from '../dom.js';
import { editable } from '../editable.js';
import { toText } from '../sanitize.js';
import { instructions, lines, linesPanel, panelAction } from './kit.js';

export const reveal = {
  name: 'Lista com revelar',
  hint: 'Cada linha revela só a própria resposta',
  create: () => ({
    label: 'PRACTICE · SAY IT, THEN REVEAL',
    html: 'Say the answer first. Then click to check.',
    items: [
      { id: uid('i'), q: 'I / visit / Rio', a: 'I have visited Rio.' },
      { id: uid('i'), q: 'She / eat / sushi', a: 'She has eaten sushi.' },
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const st = ctx.state();
    st.shown ||= {};
    const toggle = (it) => { st.shown[it.id] = !st.shown[it.id]; ctx.stateChanged(); ctx.rerender(); };
    const list = h('ol.reveal-list',
      b.items.map((it) =>
        h('li', { class: st.shown[it.id] ? 'open' : '' },
          editable(h('span.reveal-q'), { value: it.q, single: true, onChange: (v) => { it.q = v; ctx.changed(); } }),
          h('button.reveal-btn.screen-only', { type: 'button', 'aria-expanded': String(!!st.shown[it.id]), onClick: () => toggle(it) },
            st.shown[it.id] ? 'Esconder' : 'Revelar'),
          h('span.reveal-a', { hidden: !st.shown[it.id] },
            editable(h('span'), { value: it.a, single: true, onChange: (v) => { it.a = v; ctx.changed(); } })))));
    const all = b.items.every((it) => st.shown[it.id]);
    const buttons = h('div.btns.screen-only',
      h('button.btn', {
        type: 'button',
        onClick: () => { b.items.forEach((it) => (st.shown[it.id] = !all)); ctx.stateChanged(); ctx.rerender(); },
      }, all ? 'Esconder todas' : 'Revelar todas'));
    const body = h('div.block-body', h('div.block-head', instructions(ctx), buttons), list);
    if (ctx.local.panel) {
      body.append(linesPanel(ctx, {
        title: 'LINHAS',
        help: 'Uma por linha: enunciado => resposta. Ex.: She / eat / sushi => She has eaten sushi.',
        value: b.items.map((it) => `${toText(it.q)} => ${toText(it.a)}`).join('\n'),
        parse: (txt) => {
          const ls = lines(txt);
          const bad = ls.findIndex((l) => !l.includes('=>'));
          if (bad >= 0) return { error: `Linha ${bad + 1}: falta "=>" entre o enunciado e a resposta.` };
          b.items = ls.map((l, i) => {
            const [q, ...rest] = l.split('=>');
            return { id: b.items[i]?.id || uid('i'), q: escapeHtml(q.trim()), a: escapeHtml(rest.join('=>').trim()) };
          });
          return { ok: true };
        },
      }));
    }
    return { body, actions: [panelAction(ctx, 'Editar linhas')] };
  },
};
