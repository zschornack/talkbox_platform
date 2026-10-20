// Linha do tempo: do passado até agora (e além), com pontos e intervalos rotulados e uma frase de exemplo.
// No painel: uma marca por linha → "35 | 2019" (ponto em 35% da linha) ou "10-90 | MY LIFE" (intervalo).
import { h, uid } from '../dom.js';
import { editable } from '../editable.js';
import { lines, linesPanel, panelAction } from './kit.js';

const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text != null) el.textContent = text;
  return el;
};

export function parseMarks(txt) {
  const out = [];
  for (const [i, l] of lines(txt).entries()) {
    const m = l.match(/^(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s*\|\s*(.*)$/);
    if (!m) return { error: `Linha ${i + 1}: use "posição | texto" (ex.: 35 | 2019) ou "início-fim | texto" (ex.: 10-90 | MY LIFE).` };
    const a = Math.min(100, Number(m[1]));
    const b = m[2] !== undefined ? Math.min(100, Number(m[2])) : null;
    out.push(b === null ? { id: uid('m'), kind: 'point', at: a, text: m[3].trim() } : { id: uid('m'), kind: 'range', from: Math.min(a, b), to: Math.max(a, b), text: m[3].trim() });
  }
  return { marks: out };
}
const markLine = (m) => (m.kind === 'range' ? `${m.from}-${m.to} | ${m.text}` : `${m.at} | ${m.text}`);

export const timeline = {
  name: 'Linha do tempo',
  hint: 'Passado → agora, com pontos e intervalos',
  create: () => ({
    label: 'TIMELINE',
    now: 85,
    marks: [{ id: uid('m'), kind: 'point', at: 40, text: '2019' }],
    html: 'I visited Rio <b>in 2019</b>.',
  }),
  render(ctx) {
    const b = ctx.block;
    const W = 1000, H = 220, L = 40, R = 960, Y = 130;
    const x = (p) => L + ((R - L) * p) / 100;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'tl-svg', role: 'img', 'aria-label': 'Linha do tempo' });
    s.append(
      svg('line', { x1: L, y1: Y, x2: R, y2: Y, class: 'tl-axis' }),
      svg('path', { d: `M${R + 18} ${Y} L${R - 4} ${Y - 12} L${R - 4} ${Y + 12} Z`, class: 'tl-arrow' }),
      svg('text', { x: L, y: Y + 34, class: 'tl-past' }, 'PAST'));
    if (b.now != null) {
      s.append(svg('line', { x1: x(b.now), y1: Y - 30, x2: x(b.now), y2: Y + 30, class: 'tl-now' }),
        svg('text', { x: x(b.now), y: Y + 56, class: 'tl-now-label', 'text-anchor': 'middle' }, 'NOW'));
    }
    for (const m of b.marks) {
      if (m.kind === 'range') {
        const top = Y - 100; // acima dos rótulos dos pontos
        s.append(svg('rect', { x: x(m.from), y: top, width: Math.max(4, x(m.to) - x(m.from)), height: 34, rx: 17, class: 'tl-range' }),
          svg('text', { x: (x(m.from) + x(m.to)) / 2, y: top + 23, class: 'tl-range-label', 'text-anchor': 'middle' }, m.text));
      } else {
        s.append(svg('circle', { cx: x(m.at), cy: Y, r: 13, class: 'tl-point' }),
          svg('text', { x: x(m.at), y: Y - 26, class: 'tl-point-label', 'text-anchor': 'middle' }, m.text));
      }
    }
    const sentence = editable(h('div.tl-sentence'), { value: b.html, placeholder: 'Frase de exemplo (opcional)', onChange: (v) => { b.html = v; ctx.changed(); } });
    const body = h('div.block-body', h('div.tl-wrap', s), sentence);
    if (ctx.local.panel) {
      body.append(linesPanel(ctx, {
        title: 'MARCAS',
        help: 'Uma por linha. Ponto: posição (0 a 100) | texto → 35 | 2019. Intervalo: início-fim | texto → 10-90 | MY LIFE. O NOW fica na posição abaixo.',
        value: b.marks.map(markLine).join('\n'),
        minHeight: '110px',
        parse: (txt) => { const out = parseMarks(txt); if (out.error) return out; b.marks = out.marks; return { ok: true }; },
        extra: h('label.check', 'Posição do NOW (0 a 100, vazio = sem NOW): ', h('input', {
          type: 'number', min: '0', max: '100', value: b.now == null ? '' : String(b.now), style: { width: '90px' },
          onInput: (e) => { b.now = e.target.value === '' ? null : Math.max(0, Math.min(100, Number(e.target.value))); ctx.changed(); },
          onChange: () => ctx.rerender(),
        })),
      }));
    }
    return { body, actions: [panelAction(ctx, 'Editar marcas')] };
  },
};
