// Ligar colunas: clique num item de um lado e depois no par do outro lado.
import { h, uid, escapeHtml } from '../dom.js';
import { editable } from '../editable.js';
import { toText } from '../sanitize.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Embaralha a coluna da direita sempre do mesmo jeito (para não mudar a cada clique nem no PDF).
function hash(s) {
  let x = 2166136261;
  for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  return x >>> 0;
}
function shuffledRight(b) {
  const order = [...b.pairs].sort((p, q) => hash(b.id + p.id) - hash(b.id + q.id));
  // evita que fique igual à ordem da esquerda
  if (order.length > 2 && order.every((p, i) => p === b.pairs[i])) order.push(order.shift());
  return order;
}

export const match = {
  name: 'Ligar colunas',
  hint: 'Palavra ↔ significado, pergunta ↔ resposta',
  create: () => ({
    label: 'EXERCÍCIO · MATCH',
    html: 'Match the words (1–3) to their meanings (A–C).',
    pairs: [
      { id: uid('p'), left: 'contagious', right: 'easily passed from person to person' },
      { id: uid('p'), left: 'severe', right: 'very serious' },
      { id: uid('p'), left: 'to monitor', right: 'to watch carefully over time' },
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const st = ctx.state();
    st.links ||= {}; // { idDaEsquerda: idDaDireita }
    const local = ctx.local;
    const right = shuffledRight(b);
    const leftNum = new Map(b.pairs.map((p, i) => [p.id, i + 1]));
    const rightLetter = new Map(right.map((p, i) => [p.id, LETTERS[i] || '?']));

    const link = (leftId, rightId) => {
      for (const [l, r] of Object.entries(st.links)) if (r === rightId) delete st.links[l];
      st.links[leftId] = rightId;
      local.selL = local.selR = null;
      local.checked = false;
      ctx.stateChanged();
      ctx.rerender();
    };
    const clickLeft = (p) => {
      if (local.selR) return link(p.id, local.selR);
      if (st.links[p.id] && local.selL !== p.id) { delete st.links[p.id]; ctx.stateChanged(); }
      local.selL = local.selL === p.id ? null : p.id;
      ctx.rerender();
    };
    const clickRight = (p) => {
      if (local.selL) return link(local.selL, p.id);
      const owner = Object.keys(st.links).find((l) => st.links[l] === p.id);
      if (owner) { delete st.links[owner]; ctx.stateChanged(); }
      local.selR = local.selR === p.id ? null : p.id;
      ctx.rerender();
    };

    const status = (leftId) => {
      const r = st.links[leftId];
      if (!local.checked || !r) return '';
      return r === leftId ? 'ok' : 'bad';
    };
    const correct = b.pairs.filter((p) => st.links[p.id] === p.id).length;

    const leftCol = h('ol.match-col', { 'aria-label': 'Coluna 1' },
      b.pairs.map((p) => {
        const r = st.links[p.id];
        return h('li', h('button.match-item', {
          type: 'button',
          class: [local.selL === p.id ? 'sel' : '', r ? 'linked' : '', status(p.id)].join(' '),
          'aria-pressed': String(local.selL === p.id),
          onClick: () => clickLeft(p),
        },
        h('span.mnum', String(leftNum.get(p.id))),
        h('span.mtext', toText(p.left)),
        h('span.mlink', r ? `→ ${rightLetter.get(r)}` : '')));
      }));

    const rightCol = h('ol.match-col', { 'aria-label': 'Coluna 2' },
      right.map((p) => {
        const owner = Object.keys(st.links).find((l) => st.links[l] === p.id);
        return h('li', h('button.match-item.right', {
          type: 'button',
          class: [local.selR === p.id ? 'sel' : '', owner ? 'linked' : '', owner ? status(owner) : ''].join(' '),
          'aria-pressed': String(local.selR === p.id),
          onClick: () => clickRight(p),
        },
        h('span.mnum', rightLetter.get(p.id)),
        h('span.mtext', toText(p.right)),
        h('span.mlink', owner ? String(leftNum.get(owner)) : '')));
      }));

    const buttons = h(
      'div.btns.screen-only',
      h('button.btn.primary', { type: 'button', onClick: () => { local.checked = true; ctx.rerender(); } }, 'Conferir'),
      h('button.btn', {
        type: 'button',
        onClick: () => { b.pairs.forEach((p) => (st.links[p.id] = p.id)); local.checked = true; local.selL = local.selR = null; ctx.stateChanged(); ctx.rerender(); },
      }, 'Revelar'),
      h('button.btn', {
        type: 'button',
        onClick: () => { st.links = {}; local.checked = false; local.selL = local.selR = null; ctx.stateChanged(); ctx.rerender(); },
      }, 'Limpar')
    );

    const instructions = editable(h('div.muted-text'), {
      value: b.html,
      placeholder: 'Enunciado do exercício',
      onChange: (v) => { b.html = v; ctx.changed(); },
    });

    const body = h('div.block-body',
      h('div.block-head', instructions, buttons),
      h('div.match-grid', leftCol, rightCol),
      local.checked ? h('div.score', { role: 'status' }, `Acertou ${correct} de ${b.pairs.length}.`) : null);
    if (local.panel) body.append(panel(ctx));
    return {
      body,
      actions: [{ label: 'Editar pares', on: !!local.panel, onClick: () => { local.panel = !local.panel; ctx.rerender(); } }],
    };
  },
};

function panel(ctx) {
  const b = ctx.block;
  return h(
    'div.panel',
    h('h4', 'PARES'),
    h('div.help', 'Um par por linha, separado por " = ". Ex.: contagious = easily passed from person to person. A coluna da direita aparece embaralhada.'),
    h('textarea', {
      'aria-label': 'Pares',
      style: { minHeight: '180px' },
      value: b.pairs.map((p) => `${toText(p.left)} = ${toText(p.right)}`).join('\n'),
      onInput: (e) => {
        const pairs = e.target.value
          .split('\n')
          .map((l) => l.split(/\s+=\s+|=/))
          .filter((x) => x.length >= 2 && x[0].trim() && x.slice(1).join('=').trim())
          .map((x, i) => ({ id: b.pairs[i]?.id || uid('p'), left: escapeHtml(x[0].trim()), right: escapeHtml(x.slice(1).join('=').trim()) }));
        if (pairs.length) { b.pairs = pairs; ctx.changed(); }
      },
      onChange: () => ctx.rerender(),
    })
  );
}

