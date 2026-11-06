// Ligar colunas (v1.1): clique num item de um lado e depois no par do outro lado.
// - As duas colunas aparecem embaralhadas pelo app (o material pode vir na ordem certa).
// - Cada par feito (certo ou não) desce para baixo, lado a lado, ligado por uma linha;
//   o que sobra em cima vai se juntando. Clicar num par desfaz o par.
// - "Limpar" desfaz tudo e embaralha de novo.
import { h, uid, escapeHtml } from '../dom.js';
import { editable } from '../editable.js';
import { toText } from '../sanitize.js';
import { seededShuffle } from './kit.js';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Ordem das duas colunas: embaralhadas pela semente do bloco, sem nenhum par na mesma linha de cara. */
export function matchOrder(pairs, seed) {
  const left = seededShuffle(pairs, seed + ':L');
  let right = seededShuffle(pairs, seed + ':R');
  // se algum item da direita ficou bem na frente do seu par, gira a coluna até ninguém ficar
  for (let k = 0; k < right.length && right.length > 1 && right.some((p, i) => p === left[i]); k++) right = [...right.slice(1), right[0]];
  return { left, right };
}

const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };

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
    st.links ||= {}; // { idDaEsquerda: idDaDireita }, na ordem em que os pares foram feitos
    const local = ctx.local;
    const ids = new Set(b.pairs.map((p) => p.id));
    for (const [l, r] of Object.entries(st.links)) if (!ids.has(l) || !ids.has(r)) delete st.links[l];

    const { left, right } = matchOrder(b.pairs, st.seed || b.id);
    const byId = new Map(b.pairs.map((p) => [p.id, p]));
    const leftNum = new Map(left.map((p, i) => [p.id, i + 1]));
    const rightLetter = new Map(right.map((p, i) => [p.id, LETTERS[i] || '?']));
    const ownerOf = (rightId) => Object.keys(st.links).find((l) => st.links[l] === rightId);

    // animação: guarda onde cada caixa estava antes de mudar, e depois desliza até o lugar novo
    const els = new Map();
    const remember = () => { local.prevRects = new Map([...(local.els || new Map())].map(([k, el]) => [k, el.getBoundingClientRect()])); };
    const update = () => { remember(); local.selL = local.selR = null; ctx.stateChanged(); ctx.rerender(); };

    const link = (leftId, rightId) => {
      for (const [l, r] of Object.entries(st.links)) if (r === rightId || l === leftId) delete st.links[l];
      st.links[leftId] = rightId;
      local.checked = false;
      update();
    };
    const unlink = (leftId) => { delete st.links[leftId]; local.checked = false; update(); };
    const clickLeft = (p) => {
      if (local.selR) return link(p.id, local.selR);
      local.selL = local.selL === p.id ? null : p.id;
      ctx.rerender();
    };
    const clickRight = (p) => {
      if (local.selL) return link(local.selL, p.id);
      local.selR = local.selR === p.id ? null : p.id;
      ctx.rerender();
    };

    const status = (leftId) => (!local.checked || !st.links[leftId] ? '' : st.links[leftId] === leftId ? 'ok' : 'bad');
    const correct = b.pairs.filter((p) => st.links[p.id] === p.id).length;

    const item = (side, p, extra = {}) => {
      const isLeft = side === 'L';
      const el = h('button.match-item', {
        type: 'button',
        class: [isLeft ? '' : 'right', extra.cls || ''].join(' '),
        'aria-pressed': extra.pressed == null ? undefined : String(extra.pressed),
        title: extra.title,
        onClick: extra.onClick,
      },
      h('span.mnum', isLeft ? String(leftNum.get(p.id)) : rightLetter.get(p.id)),
      h('span.mtext', toText(isLeft ? p.left : p.right)));
      els.set(side + p.id, el);
      return el;
    };

    // em cima: o que ainda não tem par
    const freeLeft = left.filter((p) => !st.links[p.id]);
    const freeRight = right.filter((p) => !ownerOf(p.id));
    const open = freeLeft.length || freeRight.length
      ? h('div.match-grid',
          h('ol.match-col.match-left', { 'aria-label': 'Coluna 1' },
            freeLeft.map((p) => h('li', item('L', p, { cls: local.selL === p.id ? 'sel' : '', pressed: local.selL === p.id, onClick: () => clickLeft(p) })))),
          h('ol.match-col.match-right', { 'aria-label': 'Coluna 2' },
            freeRight.map((p) => h('li', item('R', p, { cls: local.selR === p.id ? 'sel' : '', pressed: local.selR === p.id, onClick: () => clickRight(p) })))))
      : null;

    // embaixo: os pares feitos, lado a lado, ligados por uma linha
    const made = Object.entries(st.links).filter(([l, r]) => byId.has(l) && byId.has(r));
    const pairsEl = made.length
      ? h('ol.match-pairs', { 'aria-label': 'Pares feitos' },
          made.map(([l, r]) => {
            const s = status(l);
            const undo = { title: 'Desfazer este par', onClick: () => unlink(l) };
            return h('li.match-pair', { class: s },
              item('L', byId.get(l), { cls: ['linked', s].join(' '), ...undo }),
              h('span.match-line', { 'aria-hidden': 'true' }),
              item('R', byId.get(r), { cls: ['linked', s].join(' '), ...undo }));
          }))
      : null;

    // no PDF: as duas colunas inteiras, com a letra escolhida ao lado do número (em branco, só a linha)
    const printCols = h('div.print-only', h('div.match-grid.match-print',
      h('ol.match-col.match-left', left.map((p) => {
        const r = st.links[p.id];
        return h('li', h('div.match-item',
          h('span.mnum', String(leftNum.get(p.id))), h('span.mtext', toText(p.left)),
          h('span.mlink', h('span.filled-only', r ? `→ ${rightLetter.get(r)}` : ''), h('span.blank-only.match-blank', ''))));
      })),
      h('ol.match-col.match-right', right.map((p) =>
        h('li', h('div.match-item.right', h('span.mnum', rightLetter.get(p.id)), h('span.mtext', toText(p.right))))))));

    // depois de desenhar: cada caixa sai de onde estava e desliza até o lugar novo
    local.els = els;
    const prev = local.prevRects;
    local.prevRects = null;
    if (prev && !reduceMotion()) {
      requestAnimationFrame(() => {
        for (const [k, el] of els) {
          const a = prev.get(k);
          if (!a || !el.isConnected) continue;
          const z = el.getBoundingClientRect();
          const dx = a.left - z.left, dy = a.top - z.top;
          if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
        }
        for (const line of pairsEl?.querySelectorAll('.match-line') || []) line.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
      });
    }

    const buttons = h(
      'div.btns.screen-only',
      h('button.btn.primary', { type: 'button', onClick: () => { local.checked = true; ctx.rerender(); } }, 'Conferir'),
      h('button.btn', {
        type: 'button',
        onClick: () => { remember(); st.links = Object.fromEntries(left.map((p) => [p.id, p.id])); local.checked = true; local.selL = local.selR = null; ctx.stateChanged(); ctx.rerender(); },
      }, 'Revelar'),
      h('button.btn', {
        type: 'button',
        title: 'Desfaz os pares e embaralha de novo',
        onClick: () => { remember(); st.links = {}; st.seed = uid('s'); local.checked = false; local.selL = local.selR = null; ctx.stateChanged(); ctx.rerender(); },
      }, 'Limpar')
    );

    const instructions = editable(h('div.muted-text'), {
      value: b.html,
      placeholder: 'Enunciado do exercício',
      onChange: (v) => { b.html = v; ctx.changed(); },
    });

    const body = h('div.block-body',
      h('div.block-head', instructions, buttons),
      h('div.match-board.screen-only', open, pairsEl),
      printCols,
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
    h('div.help', 'Um par por linha, separado por " = ". Ex.: contagious = easily passed from person to person. As duas colunas aparecem embaralhadas pelo app: escreva os pares na ordem certa.'),
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

