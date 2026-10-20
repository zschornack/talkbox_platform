// Barra flutuante ao selecionar texto: negrito, sublinhado, highlight (requisitos 9.4).
import { h, svgIcon, ICONS } from './dom.js';

const HL = [
  ['#FFDB8F', 'Destacar em amarelo'],
  ['#CBE4D8', 'Destacar em verde'],
  ['#FFC9A3', 'Destacar em laranja'],
];

function run(cmd, value) {
  try {
    document.execCommand('styleWithCSS', false, cmd === 'hiliteColor');
    document.execCommand(cmd, false, value);
  } catch {}
}

export function mountFormatBar(scope, isBlocked) {
  const btn = (label, content, onPress) =>
    h('button', { type: 'button', 'aria-label': label, title: label, onMousedown: (e) => { e.preventDefault(); onPress(); } }, content);

  const bar = h(
    'div.fmt-bar',
    { role: 'toolbar', 'aria-label': 'Formatação', hidden: true },
    btn('Negrito (Ctrl+B)', h('b', 'B'), () => run('bold')),
    btn('Sublinhado (Ctrl+U)', h('u', 'U'), () => run('underline')),
    h('span.sep'),
    HL.map(([c, label]) => btn(label, h('span.dot', { style: { background: c } }), () => run('hiliteColor', c))),
    btn('Remover destaque', svgIcon(ICONS.noHl), () => run('hiliteColor', 'transparent'))
  );
  document.body.append(bar);

  const update = () => {
    const sel = window.getSelection();
    if (isBlocked() || !sel || sel.isCollapsed || !sel.rangeCount) return (bar.hidden = true);
    const node = sel.getRangeAt(0).commonAncestorContainer;
    const el = (node.nodeType === 1 ? node : node.parentElement)?.closest('[contenteditable="true"]');
    if (!el || !scope.contains(el) || el.dataset.rich !== '1') return (bar.hidden = true);
    const r = sel.getRangeAt(0).getBoundingClientRect();
    bar.hidden = false;
    bar.style.left = Math.round(Math.min(Math.max(r.left + r.width / 2, 160), window.innerWidth - 160)) + 'px';
    bar.style.top = Math.round(Math.max(r.top, 64)) + 'px';
  };
  document.addEventListener('selectionchange', update);
  window.addEventListener('scroll', update, { passive: true });

  return () => {
    document.removeEventListener('selectionchange', update);
    window.removeEventListener('scroll', update);
    bar.remove();
  };
}
