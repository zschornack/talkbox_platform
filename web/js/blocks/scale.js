// Escala de opinião: uma afirmação por vez e uma linha de 5 pontos, de "discordo totalmente" a "concordo totalmente".
// O aluno marca e defende a opinião. As marcas ficam no estado da aula (e saem no PDF).
import { h, escapeHtml } from '../dom.js';
import { editable } from '../editable.js';
import { toText, sanitize } from '../sanitize.js';
import { lines, linesPanel, panelAction } from './kit.js';

const POINTS = 5;

export const scale = {
  name: 'Escala de opinião',
  hint: 'Concorda ou discorda? Marque e defenda',
  create: () => ({
    label: 'SPEAKING · WHAT DO YOU THINK?',
    html: 'Mark your opinion. Then explain it with at least two reasons.',
    left: 'Totally disagree',
    right: 'Totally agree',
    statements: ['Working from home is better than working in an office.', 'Everybody should learn to cook.'],
  }),
  render(ctx) {
    const b = ctx.block;
    const st = ctx.state();
    st.marks ||= {};
    const local = ctx.local;
    if (!b.statements.length) b.statements.push('');
    local.i = Math.min(local.i || 0, b.statements.length - 1);
    const i = local.i;
    const go = (n) => { local.i = (n + b.statements.length) % b.statements.length; ctx.rerender({ pop: true }); };
    const mark = st.marks[i];
    const card = h('div.scale-card' + (ctx.pop ? '.pop' : ''),
      h('div.deck-meta', h('span', 'Statement'), h('span', `${i + 1} / ${b.statements.length}`)),
      editable(h('div.deck-q'), { value: b.statements[i], placeholder: 'Escreva a afirmação…', onChange: (v) => { b.statements[i] = v; ctx.changed(); } }),
      h('div.scale-line', { role: 'radiogroup', 'aria-label': 'Sua opinião' },
        Array.from({ length: POINTS }, (_, k) =>
          h('button.scale-dot', {
            type: 'button', role: 'radio', 'aria-checked': String(mark === k), class: mark === k ? 'on' : '',
            'aria-label': `${k + 1} de ${POINTS}`,
            onClick: () => { st.marks[i] = mark === k ? undefined : k; ctx.stateChanged(); ctx.rerender(); },
          }, String(k + 1)))),
      h('div.scale-ends',
        editable(h('span'), { value: b.left, single: true, rich: false, onChange: (v) => { b.left = v; ctx.changed(); } }),
        editable(h('span'), { value: b.right, single: true, rich: false, onChange: (v) => { b.right = v; ctx.changed(); } })),
      h('div.deck-foot.screen-only', h('span'),
        h('div.btns',
          h('button.btn.icon', { type: 'button', 'aria-label': 'Anterior', onClick: () => go(i - 1) }, '‹'),
          h('button.btn.primary', { type: 'button', onClick: () => go(i + 1) }, 'Próxima'))));
    const print = h('div.print-only',
      h('ol.print-list', b.statements.map((s, k) => {
        const li = h('li');
        li.innerHTML = sanitize(s) + (st.marks[k] !== undefined ? ` <b>(${st.marks[k] + 1}/${POINTS})</b>` : '');
        return li;
      })));
    const intro = editable(h('div.muted-text.opt'), { value: b.html, placeholder: 'Instrução (opcional)', onChange: (v) => { b.html = v; ctx.changed(); } });
    const body = h('div.block-body', intro, card, print);
    if (local.panel) {
      body.append(linesPanel(ctx, {
        title: 'AFIRMAÇÕES',
        help: 'Uma afirmação por linha.',
        value: b.statements.map(toText).join('\n'),
        parse: (txt) => { b.statements = lines(txt).map(escapeHtml); return { ok: true }; },
      }));
    }
    return { body, actions: [panelAction(ctx, 'Editar afirmações')] };
  },
};
