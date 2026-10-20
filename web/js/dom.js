// Ajudantes pequenos para criar elementos sem framework.

/** h('div.classe', {atributos}, ...filhos) */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  let value;
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'value') value = v; // aplicado depois dos filhos (select precisa das opções)
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, pv] of Object.entries(v)) p.startsWith('--') ? el.style.setProperty(p, pv) : (el.style[p] = pv);
    } else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  if (value !== undefined) el.value = value;
  return el;
}

/**
 * A marca TalkBox, sempre igual em todo lugar (como no site da escola):
 * a logo + "TalkBox" em Nunito Sans 900, verde, com espaçamento apertado.
 * href = null → só a marca, sem link (ex.: cabeçalho do PDF).
 */
export function brandMark({ href = '#/', size = 'md' } = {}) {
  return h(href ? 'a.brand' : 'span.brand', { href: href || null, class: `brand-${size}`, title: href ? 'Início' : null },
    h('img.brand-logo', { src: '/img/talkbox-logo.png', alt: '', width: '132', height: '144' }),
    h('span.brand-name', 'TalkBox'));
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const svgIcon = (paths, size = 18) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('width', size);
  s.setAttribute('height', size);
  s.setAttribute('fill', 'none');
  s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round');
  s.setAttribute('stroke-linejoin', 'round');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = paths;
  return s;
};

export const ICONS = {
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  noHl: '<path d="M4 4l16 16"/><circle cx="12" cy="12" r="8"/>',
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5Z"/><path d="M3 13l9 5 9-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M14 6l4 4"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  file: '<path d="M14 3H6v18h12V7l-4-4Z"/><path d="M14 3v4h4"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  // formatos
  text: '<path d="M4 6h16M4 11h16M4 16h10"/>',
  explanation: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 10v10M15 10v10"/>',
  fill: '<path d="M3 17h5M16 17h5"/><rect x="9" y="12" width="6" height="7" rx="1"/><path d="M4 8h16"/>',
  choice: '<circle cx="6" cy="7" r="2"/><circle cx="6" cy="17" r="2" fill="currentColor"/><path d="M11 7h9M11 17h9"/>',
  match: '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6.5l10 11M7 17.5l10-11"/>',
  deck: '<rect x="7" y="3" width="13" height="16" rx="2"/><path d="M4 7v12a2 2 0 0 0 2 2h10"/>',
  challenge: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
  notes: '<path d="M5 3h10l4 4v14H5Z"/><path d="M9 12h6M9 16h4"/>',
  tense: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/><path d="M12.5 14h5"/>',
  timeline: '<path d="M3 12h16M19 9l3 3-3 3"/><circle cx="8" cy="12" r="2" fill="currentColor"/><path d="M14 8v8"/>',
  reveal: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
  order: '<rect x="3" y="5" width="6" height="5" rx="1.5"/><rect x="11" y="5" width="10" height="5" rx="1.5"/><path d="M4 16h16M16 13l4 3-4 3"/>',
  transform: '<path d="M4 7h12l-3-3M20 17H8l3 3"/>',
  spot: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8M8.5 8.5l4 4M12.5 8.5l-4 4"/>',
  sort: '<rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/><path d="M5.5 9h2M16.5 9h2M16.5 13h2"/>',
  scale: '<path d="M3 12h18"/><circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="3"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
  roleplay: '<circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 19a5.5 5.5 0 0 1 11 0M13 18.5a4 4 0 0 1 8 0"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',
};

export const uid = (p = 'b') => p + Math.random().toString(16).slice(2, 12);
export const clone = (x) => JSON.parse(JSON.stringify(x));

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** "2026-10-13" é a data do dia (sem fuso); um carimbo completo é convertido para o horário local. */
const toDate = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso));

export function formatDate(iso) {
  if (!iso) return '—';
  return toDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
export const shortDate = (iso) => (iso ? toDate(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—');
/** Data de hoje no formato do banco (AAAA-MM-DD), no horário local. */
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const dateTime = (iso) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "hoje", "ontem", "há 3 dias" ou a data. */
export function relativeDate(iso) {
  if (!iso) return '—';
  const d = toDate(iso);
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((start(new Date()) - start(d)) / 86400000);
  if (days <= 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days < 7) return `há ${days} dias`;
  return formatDate(iso);
}

/** Lê "#/modelos?formato=fill&nivel=A2" → { path: '/modelos', query: URLSearchParams } */
export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  return { path, query: new URLSearchParams(qs) };
}
