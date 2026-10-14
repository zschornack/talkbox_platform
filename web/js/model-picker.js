// Painel lateral para inserir modelos na aula (requisitos 8.2 e 9.9): busca, filtros e seleção múltipla.
import { h, svgIcon, ICONS } from './dom.js';
import { api } from './api.js';
import { LEVELS } from './catalog.js';
import { toggleChips, emptyState } from './ui.js';
import { FORMATS, formatName, matchModel, modelCard } from './models.js';

export async function openModelPicker({ studentId, onInsert }) {
  document.querySelector('.drawer-bg')?.remove();
  const restore = document.activeElement;
  const models = await api.models(studentId);
  const f = { q: '', formats: [], levels: [] };
  const picked = new Map(); // ordem de seleção = ordem de inserção

  const list = h('div.drawer-list');
  const count = h('span.muted');
  const hint = h('span.muted.small.hint');
  const insertBtn = h('button.btn.primary', { type: 'button', disabled: true, onClick: () => done([...picked.values()]) }, 'Inserir');
  const search = h('input.search', {
    type: 'search',
    placeholder: 'Buscar: "fill past simple", "deck", "A2"…',
    'aria-label': 'Buscar modelos',
    onInput: (e) => { f.q = e.target.value; paint(); },
    onKeydown: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (picked.size) return done([...picked.values()]);
        const first = visible()[0];
        if (first) done([first]);
      }
    },
  });

  // "fill past simple": palavras que batem com um formato viram filtro de formato
  const visible = () => {
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const fmt = new Set(f.formats);
    const rest = words.filter((w) => {
      const hit = FORMATS.find((t) => t === w || formatName(t).toLowerCase().split(/\s+/)[0] === w);
      if (hit) fmt.add(hit);
      return !hit;
    });
    return models.filter((m) => matchModel(m, { ...f, q: rest.join(' '), formats: [...fmt] }));
  };

  function paint() {
    const items = visible();
    list.replaceChildren(
      ...(items.length
        ? items.map((m) =>
            modelCard(m, {
              compact: true,
              selected: picked.has(m.id),
              onToggle: (on) => { on ? picked.set(m.id, m) : picked.delete(m.id); paint(); },
            }))
        : [emptyState('Nada encontrado.', models.length ? 'Tente outra palavra ou tire um filtro.' : 'A biblioteca de modelos está vazia.')])
    );
    count.textContent = picked.size ? `${picked.size} ${picked.size === 1 ? 'selecionado' : 'selecionados'}` : `${items.length} modelos`;
    hint.textContent = picked.size ? 'Enter insere os selecionados' : 'Enter insere o primeiro';
    insertBtn.disabled = !picked.size;
    insertBtn.textContent = picked.size > 1 ? `Inserir ${picked.size}` : 'Inserir';
  }

  const drawer = h('aside.drawer', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Inserir da biblioteca de modelos' },
    h('div.drawer-head',
      h('h2', svgIcon(ICONS.layers, 20), 'Inserir modelos'),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Fechar', onClick: () => close() }, svgIcon(ICONS.x))),
    h('div.drawer-filters',
      search,
      toggleChips({ label: 'Formato', options: FORMATS.map((t) => ({ value: t, label: formatName(t), icon: t })), onChange: (v) => { f.formats = v; paint(); } }),
      toggleChips({ label: 'Nível', options: LEVELS, onChange: (v) => { f.levels = v; paint(); } })),
    list,
    h('div.drawer-foot', count, hint, insertBtn));
  const bg = h('div.drawer-bg', { onMousedown: (e) => e.target === bg && close() }, drawer);

  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  function close() {
    bg.remove();
    document.removeEventListener('keydown', onKey, true);
    restore?.focus?.();
  }
  function done(chosen) {
    close();
    onInsert(chosen);
  }
  document.addEventListener('keydown', onKey, true);
  document.body.append(bg);
  paint();
  search.focus();
}
