// Múltipla escolha: frases com opções clicáveis. Serve também para True / False / Not Given (IELTS).
// As escolhas do aluno ficam no estado da aula, separadas do exercício (requisitos 9.10).
import { h, uid, escapeHtml } from '../dom.js';
import { editable } from '../editable.js';
import { toText } from '../sanitize.js';

/** "Dozens of workers [have been* | had been] quarantined." → item. O * marca a certa. */
export function parseChoiceLine(line) {
  const m = line.match(/^(.*?)\[(.+?)\](.*)$/);
  if (!m) return null;
  const raw = m[2].split('|').map((s) => s.trim()).filter(Boolean);
  const answer = Math.max(0, raw.findIndex((o) => o.endsWith('*')));
  return {
    before: escapeHtml(m[1].trim()),
    options: raw.map((o) => o.replace(/\*$/, '').trim()),
    answer,
    after: escapeHtml(m[3].trim()),
  };
}
export const choiceLine = (it) =>
  `${toText(it.before)} [${it.options.map((o, i) => (i === it.answer ? o + '*' : o)).join(' | ')}] ${toText(it.after)}`.replace(/\s+/g, ' ').trim();

export const choice = {
  name: 'Múltipla escolha',
  hint: 'Opções clicáveis · também True / False / Not Given',
  create: () => ({
    label: 'EXERCÍCIO · CHOOSE THE CORRECT OPTION',
    html: 'Choose the correct option.',
    instant: false,
    items: [
      { id: uid('i'), before: 'Yesterday I', options: ['go', 'went'], answer: 1, after: 'to the beach.' },
      { id: uid('i'), before: 'She has', options: ['already', 'yet'], answer: 0, after: 'finished.' },
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const st = ctx.state();
    st.picks ||= {};
    const local = ctx.local;
    const show = () => !!(b.instant || local.checked);

    const score = h('div.score', { role: 'status', hidden: true });
    const live = h('span.live-score', { role: 'status' });
    const rows = [];

    const refresh = () => {
      let right = 0;
      b.items.forEach((it, i) => {
        const picked = st.picks[it.id];
        if (picked === it.answer) right++;
        rows[i].forEach((btn, k) => {
          const isPicked = picked === k;
          btn.classList.toggle('picked', isPicked);
          btn.classList.toggle('ok', show() && isPicked && k === it.answer);
          btn.classList.toggle('bad', show() && isPicked && k !== it.answer);
          btn.classList.toggle('answer', !!local.checked && picked !== undefined && picked !== it.answer && k === it.answer);
          btn.setAttribute('aria-pressed', String(isPicked));
        });
      });
      const answered = Object.keys(st.picks).filter((k) => b.items.some((it) => it.id === k)).length;
      live.textContent = `${right} / ${b.items.length}`;
      live.hidden = !b.instant || !answered;
      score.hidden = !local.checked;
      score.textContent = `Acertou ${right} de ${b.items.length}.`;
    };

    const pick = (it, k) => {
      if (st.picks[it.id] === k) delete st.picks[it.id];
      else st.picks[it.id] = k;
      if (!b.instant) local.checked = false;
      ctx.stateChanged();
      refresh();
    };

    const list = h(
      'ol.choice-list',
      b.items.map((it, i) => {
        const btns = it.options.map((o, k) =>
          h('button.copt', { type: 'button', 'aria-pressed': 'false', onClick: () => pick(it, k) }, o)
        );
        rows.push(btns);
        return h(
          'li',
          editable(h('span.seg'), { value: it.before, single: true, onChange: (v) => { it.before = v; ctx.changed(); } }),
          ' ',
          h('span.opts', { role: 'group', 'aria-label': `Opções da questão ${i + 1}` }, btns),
          ' ',
          editable(h('span.seg'), { value: it.after, single: true, onChange: (v) => { it.after = v; ctx.changed(); } })
        );
      })
    );

    const buttons = h(
      'div.btns.screen-only',
      live,
      b.instant ? null : h('button.btn.primary', { type: 'button', onClick: () => { local.checked = true; refresh(); } }, 'Conferir'),
      h('button.btn', {
        type: 'button',
        onClick: () => { b.items.forEach((it) => (st.picks[it.id] = it.answer)); local.checked = true; ctx.stateChanged(); refresh(); },
      }, 'Revelar'),
      h('button.btn', {
        type: 'button',
        onClick: () => { b.items.forEach((it) => delete st.picks[it.id]); local.checked = false; ctx.stateChanged(); refresh(); },
      }, 'Limpar')
    );

    const instructions = editable(h('div.muted-text'), {
      value: b.html,
      placeholder: 'Enunciado do exercício',
      onChange: (v) => { b.html = v; ctx.changed(); },
    });

    const body = h('div.block-body', h('div.block-head', instructions, buttons), list, score);
    if (local.panel) body.append(panel(ctx));
    refresh();
    return {
      body,
      actions: [{ label: 'Editar questões', on: !!local.panel, onClick: () => { local.panel = !local.panel; ctx.rerender(); } }],
    };
  },
};

function panel(ctx) {
  const b = ctx.block;
  const error = h('div.help.err', { hidden: true });
  return h(
    'div.panel',
    h('h4', 'QUESTÕES'),
    h('div.help', 'Uma por linha. Coloque as opções entre colchetes, separadas por | , e marque a certa com *. Ex.: She [has* | had] left.  ·  True/False/Not Given: The lab is in Siberia. [True* | False | Not Given]'),
    h('textarea', {
      'aria-label': 'Questões',
      style: { minHeight: '180px' },
      value: b.items.map(choiceLine).join('\n'),
      onInput: (e) => {
        const lines = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean);
        const parsed = lines.map(parseChoiceLine);
        const bad = parsed.findIndex((p) => !p || p.options.length < 2);
        if (bad !== -1) {
          error.hidden = false;
          error.textContent = `Linha ${bad + 1}: faltam as opções entre [ ] com pelo menos duas escolhas.`;
          return;
        }
        error.hidden = true;
        b.items = parsed.map((p, i) => ({ id: b.items[i]?.id || uid('i'), ...p }));
        ctx.changed();
      },
      onChange: () => ctx.rerender(),
    }),
    error,
    h('label.check', h('input', {
      type: 'checkbox',
      checked: !!b.instant,
      onChange: (e) => { b.instant = e.target.checked; ctx.local.checked = false; ctx.changed(); ctx.rerender(); },
    }), 'Correção na hora: cada clique já mostra certo ou errado (bom para "speed round")')
  );
}
