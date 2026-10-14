// Tabela com estilo fixo. Toda célula é editável; Tab passa para a próxima.
import { h } from '../dom.js';
import { editable } from '../editable.js';

export const table = {
  name: 'Tabela',
  hint: 'Verbos, pronomes, regras…',
  create: () => ({
    label: '',
    header: true,
    rows: [
      ['COLUNA 1', 'COLUNA 2', 'COLUNA 3'],
      ['', '', ''],
      ['', '', ''],
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const cols = Math.max(1, ...b.rows.map((r) => r.length));
    const grid = `repeat(${cols}, minmax(120px, 1fr))`;

    const rows = b.rows.map((row, ri) =>
      h(
        'div.trow',
        { class: ri === 0 && b.header ? 'head' : '', role: 'row', style: { gridTemplateColumns: grid } },
        Array.from({ length: cols }, (_, ci) =>
          editable(h('div.tcell', { role: ri === 0 && b.header ? 'columnheader' : 'cell' }), {
            value: row[ci] ?? '',
            onChange: (v) => { b.rows[ri][ci] = v; ctx.changed(); },
          })
        )
      )
    );

    const mutate = (fn) => () => { fn(); ctx.changed(); ctx.rerender(); };
    return {
      body: h('div.ttable-scroll', h('div.ttable', { role: 'table' }, rows)),
      actions: [
        { label: '+ linha', onClick: mutate(() => b.rows.push(Array(cols).fill(''))) },
        { label: '− linha', onClick: mutate(() => b.rows.length > 1 && b.rows.pop()) },
        { label: '+ coluna', onClick: mutate(() => b.rows.forEach((r, i) => r.push(i === 0 && b.header ? 'NOVA' : ''))) },
        { label: '− coluna', onClick: mutate(() => cols > 1 && b.rows.forEach((r) => r.splice(cols - 1, 1))) },
      ],
    };
  },
};
