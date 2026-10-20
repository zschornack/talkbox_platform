// Separar em grupos: clique num item e depois no grupo (coluna) onde ele vai.
// No painel: uma linha por grupo → Regular: worked, played, visited
import { h, uid } from '../dom.js';
import { editable } from '../editable.js';
import { instructions, lines, linesPanel, panelAction, seededShuffle } from './kit.js';

export const sort = {
  name: 'Separar em grupos',
  hint: 'Itens vão para 2 a 4 colunas',
  create: () => ({
    label: 'PRACTICE · SORT THE WORDS',
    html: 'Click a word, then click the group where it goes.',
    groups: ['Countable', 'Uncountable'],
    items: [
      { id: uid('i'), text: 'apple', group: 0 }, { id: uid('i'), text: 'rice', group: 1 },
      { id: uid('i'), text: 'egg', group: 0 }, { id: uid('i'), text: 'water', group: 1 },
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const st = ctx.state();
    st.placed ||= {}; // { idDoItem: índice do grupo }
    const local = ctx.local;
    const pool = seededShuffle(b.items, b.id).filter((it) => st.placed[it.id] === undefined);
    const place = (g) => {
      if (!local.sel) return;
      st.placed[local.sel] = g;
      local.sel = null;
      local.checked = false;
      ctx.stateChanged();
      ctx.rerender();
    };
    let right = 0;
    b.items.forEach((it) => { if (st.placed[it.id] === it.group) right++; });
    const cols = h('div.sort-cols', { style: { gridTemplateColumns: `repeat(${b.groups.length}, minmax(0, 1fr))` } },
      b.groups.map((g, gi) =>
        h('div.sort-col', { class: local.sel ? 'target' : '', onClick: () => place(gi) },
          editable(h('div.sort-head'), { value: g, single: true, rich: false, onChange: (v) => { b.groups[gi] = v; ctx.changed(); } }),
          h('div.sort-items',
            b.items.filter((it) => st.placed[it.id] === gi).map((it) =>
              h('button.chip-word.placed', {
                type: 'button',
                class: local.checked ? (it.group === gi ? 'ok' : 'bad') : '',
                title: 'Devolver',
                onClick: (e) => { e.stopPropagation(); delete st.placed[it.id]; local.checked = false; ctx.stateChanged(); ctx.rerender(); },
              }, it.text))))));
    const poolEl = h('div.sort-pool.screen-only',
      pool.length
        ? pool.map((it) => h('button.chip-word', { type: 'button', class: local.sel === it.id ? 'sel' : '', onClick: () => { local.sel = local.sel === it.id ? null : it.id; ctx.rerender(); } }, it.text))
        : h('span.muted', 'Todos os itens estão nos grupos.'));
    const printPool = h('div.print-only.order-print', seededShuffle(b.items, b.id).map((it) => it.text).join('  ·  '));
    const score = h('div.score', { role: 'status', hidden: !local.checked }, `Acertou ${right} de ${b.items.length}.`);
    const buttons = h('div.btns.screen-only',
      h('button.btn.primary', { type: 'button', onClick: () => { local.checked = true; ctx.rerender(); } }, 'Conferir'),
      h('button.btn', { type: 'button', onClick: () => { b.items.forEach((it) => (st.placed[it.id] = it.group)); local.checked = true; ctx.stateChanged(); ctx.rerender(); } }, 'Revelar'),
      h('button.btn', { type: 'button', onClick: () => { st.placed = {}; local.checked = false; local.sel = null; ctx.stateChanged(); ctx.rerender(); } }, 'Limpar'));
    const body = h('div.block-body', h('div.block-head', instructions(ctx), buttons), poolEl, printPool, cols, score);
    if (local.panel) {
      body.append(linesPanel(ctx, {
        title: 'GRUPOS',
        help: 'Uma linha por grupo (2 a 4): Nome do grupo: item, item, item',
        value: b.groups.map((g, gi) => `${g}: ${b.items.filter((it) => it.group === gi).map((it) => it.text).join(', ')}`).join('\n'),
        parse: (txt) => {
          const ls = lines(txt);
          if (ls.length < 2 || ls.length > 4) return { error: 'Use de 2 a 4 grupos, um por linha.' };
          const bad = ls.findIndex((l) => !l.includes(':'));
          if (bad >= 0) return { error: `Linha ${bad + 1}: falta ":" depois do nome do grupo.` };
          const old = new Map(b.items.map((it) => [it.text, it.id]));
          b.groups = ls.map((l) => l.split(':')[0].trim());
          b.items = ls.flatMap((l, gi) => l.split(':').slice(1).join(':').split(',').map((x) => x.trim()).filter(Boolean)
            .map((text) => ({ id: old.get(text) || uid('i'), text, group: gi })));
          return { ok: true };
        },
      }));
    }
    return { body, actions: [panelAction(ctx, 'Editar grupos')] };
  },
};
