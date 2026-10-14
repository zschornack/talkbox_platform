// Modelos: a biblioteca de atividades prontas (requisitos, seção 7).
import { h, svgIcon, ICONS, uid, parseHash, shortDate } from './dom.js';
import { api } from './api.js';
import { appShell, pageHead } from './layout.js';
import { BLOCKS, MENU } from './blocks/index.js';
import { summarize } from './blocks/summary.js';
import { LEVELS, SKILLS, CONTENT_SUGGESTIONS } from './catalog.js';
import { toggleChips, tagInput, modal, field, toast, emptyState } from './ui.js';
import { toText } from './sanitize.js';
import { copyBlock } from './block-view.js';

export const FORMATS = MENU.filter((t) => t !== 'notes');
export const formatName = (t) => BLOCKS[t]?.name || t;

const DEFAULT_SKILLS = { fill: ['Escrita'], choice: ['Leitura'], match: ['Leitura'], deck: ['Fala'], challenge: ['Fala'], image: ['Fala'], explanation: ['Leitura'], table: ['Leitura'], text: ['Leitura'] };

export const formatBadge = (type) => h('span.format-badge', { class: `f-${type}` }, svgIcon(ICONS[type], 15), formatName(type));

/** Todas as etiquetas de conteúdo conhecidas (sugestões + as já usadas). */
export const contentUniverse = (models) =>
  [...new Set([...models.flatMap((m) => m.tags.content), ...CONTENT_SUGGESTIONS])].sort((a, b) => a.localeCompare(b));

/** Filtro combinado: "ou" dentro de cada eixo, "e" entre eixos (requisitos 7.1). */
export function matchModel(m, f) {
  const q = (f.q || '').trim().toLowerCase();
  if (q) {
    const hay = [m.title, formatName(m.type), ...m.tags.content, ...m.tags.levels, ...m.tags.skills, ...summarize(m.block).lines].join(' ').toLowerCase();
    if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  if (f.formats?.length && !f.formats.includes(m.type)) return false;
  if (f.levels?.length && !m.tags.levels.some((l) => f.levels.includes(l))) return false;
  if (f.skills?.length && !m.tags.skills.some((s) => f.skills.includes(s))) return false;
  if (f.content?.length && !m.tags.content.some((c) => f.content.includes(c))) return false;
  return true;
}

export function modelCard(m, { href, compact = false, selected, onToggle } = {}) {
  const s = summarize(m.block);
  const inner = [
    h('div.mc-top', formatBadge(m.type),
      m.seenAt ? h('span.seen', { title: 'Este aluno já viu este modelo' }, `visto em ${shortDate(m.seenAt)}`) : null),
    s.image ? h('img.mc-thumb', { src: s.image, alt: '', loading: 'lazy' }) : null,
    h('h3.mc-title', m.title),
    s.lines.length ? h('ul.mc-lines', s.lines.map((l) => h('li', l))) : null,
    h('div.mc-tags',
      m.tags.levels.map((l) => h('span.level', l)),
      m.tags.content.slice(0, compact ? 3 : 5).map((c) => h('span.chip', c)),
      m.tags.skills.length ? h('span.mc-skills', m.tags.skills.join(' · ')) : null),
    h('div.mc-foot',
      h('span', s.count || ''),
      h('span', m.uses ? `usado em ${m.uses} ${m.uses === 1 ? 'aula' : 'aulas'}` : 'ainda não usado')),
  ];
  if (onToggle) {
    return h('label.model-card.pickable', { class: selected ? 'selected' : '' },
      h('input.pick-box', { type: 'checkbox', checked: !!selected, onChange: (e) => onToggle(e.target.checked), 'aria-label': `Selecionar ${m.title}` }),
      h('div.mc-body', inner));
  }
  return h('a.model-card', { href: href || `#/modelos/${m.id}` }, h('div.mc-body', inner));
}

// ---------- criar um modelo novo: escolher o formato ----------
export function newModelMenu(anchor) {
  document.querySelector('.menu.format-menu')?.remove();
  const menu = h('div.menu.format-menu', { role: 'menu', 'aria-label': 'Formato do novo modelo' },
    h('div.menu-label', 'Qual formato?'),
    FORMATS.map((t) =>
      h('button', {
        type: 'button',
        role: 'menuitem',
        onClick: async () => {
          menu.remove();
          const block = { id: uid(), type: t, ...BLOCKS[t].create() };
          const m = await api.createModel({ title: '', type: t, block, tags: { content: [], levels: [], skills: DEFAULT_SKILLS[t] || [] } });
          location.hash = `#/modelos/${m.id}?novo=1`;
        },
      }, h('span.menu-title', svgIcon(ICONS[t], 16), BLOCKS[t].name), h('small', BLOCKS[t].hint))
    ));
  const r = anchor.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - 296)) + 'px';
  menu.style.top = r.bottom + window.scrollY + 6 + 'px';
  document.body.append(menu);
  menu.querySelector('button').focus();
  const close = (e) => {
    if (e.type === 'keydown' ? e.key === 'Escape' : !menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    }
  };
  setTimeout(() => { document.addEventListener('mousedown', close); document.addEventListener('keydown', close); }, 0);
}

// ---------- salvar um bloco da aula como modelo (requisitos 8.3) ----------
export async function saveAsModelDialog(block, { level, onSaved } = {}) {
  const models = await api.models().catch(() => []);
  const origin = block.source?.modelId ? models.find((m) => m.id === block.source.modelId) : null;
  const base = origin?.tags || { content: [], levels: level ? [level] : [], skills: DEFAULT_SKILLS[block.type] || [] };
  const tags = { content: [...base.content], levels: [...base.levels], skills: [...base.skills] };
  const label = toText(block.label || '').trim();
  const title = h('input', {
    type: 'text', required: true, maxlength: '200',
    value: origin?.title || (label ? label.charAt(0) + label.slice(1).toLowerCase() : formatName(block.type)),
  });
  const mode = origin
    ? h('fieldset.radio-group',
        h('legend', 'Este bloco veio do modelo'),
        h('label', h('input', { type: 'radio', name: 'mode', value: 'update', checked: true }), `Atualizar "${origin.title}"`),
        h('label', h('input', { type: 'radio', name: 'mode', value: 'new' }), 'Salvar como um modelo novo'))
    : null;

  modal({
    title: 'Salvar como modelo',
    submitLabel: 'Salvar',
    wide: true,
    body: [
      mode,
      field('Nome do modelo', title),
      h('div.field', h('span.field-label', 'Conteúdo'),
        tagInput({ value: tags.content, suggestions: contentUniverse(models), onChange: (v) => (tags.content = v), label: 'Conteúdo', placeholder: 'Ex.: Past Simple (Enter para adicionar)' })),
      h('div.field', h('span.field-label', 'Nível'), toggleChips({ options: LEVELS, value: tags.levels, onChange: (v) => (tags.levels = v), label: 'Nível' })),
      h('div.field', h('span.field-label', 'Habilidade'), toggleChips({ options: SKILLS, value: tags.skills, onChange: (v) => (tags.skills = v), label: 'Habilidade' })),
      h('p.muted.small', 'O modelo guarda o bloco como está agora. As aulas que já usam este modelo não mudam.'),
    ],
    onSubmit: async (form) => {
      const clean = copyBlock(block, uid);
      delete clean.source;
      const update = origin && form.querySelector('input[name=mode]:checked')?.value === 'update';
      const saved = update
        ? await api.saveModel(origin.id, { title: title.value, block: clean, tags })
        : await api.createModel({ title: title.value, type: block.type, block: clean, tags });
      onSaved?.(saved);
      toast(update ? 'Modelo atualizado.' : 'Salvo em Modelos.', { label: 'Abrir', run: () => window.open(`#/modelos/${saved.id}`, '_blank') });
    },
  });
}

// ---------- a biblioteca ----------
export async function renderModels(root) {
  document.title = 'Modelos · TalkBox';
  const models = await api.models();
  const { query } = parseHash();
  const f = {
    q: query.get('q') || '',
    formats: query.getAll('formato'),
    levels: query.getAll('nivel'),
    skills: query.getAll('habilidade'),
    content: query.getAll('conteudo'),
    sort: query.get('ordem') || 'recent',
  };

  const syncUrl = () => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    f.formats.forEach((x) => p.append('formato', x));
    f.levels.forEach((x) => p.append('nivel', x));
    f.skills.forEach((x) => p.append('habilidade', x));
    f.content.forEach((x) => p.append('conteudo', x));
    if (f.sort !== 'recent') p.set('ordem', f.sort);
    const qs = p.toString();
    history.replaceState(null, '', '#/modelos' + (qs ? '?' + qs : ''));
  };

  const count = (fn) => models.reduce((acc, m) => (fn(m).forEach((k) => (acc[k] = (acc[k] || 0) + 1)), acc), {});
  const fmtCounts = count((m) => [m.type]);
  const lvlCounts = count((m) => m.tags.levels);
  const sklCounts = count((m) => m.tags.skills);
  const cntCounts = count((m) => m.tags.content);
  const contentOptions = Object.keys(cntCounts).sort((a, b) => cntCounts[b] - cntCounts[a] || a.localeCompare(b));

  const grid = h('div.model-grid');
  const resultInfo = h('span.muted', { role: 'status' });
  const clearBtn = h('button.link-btn', { type: 'button', onClick: () => { Object.assign(f, { q: '', formats: [], levels: [], skills: [], content: [] }); search.value = ''; chips.forEach((c) => c.setValue([])); update(); } }, 'Limpar filtros');

  const search = h('input.search', { type: 'search', value: f.q, placeholder: 'Buscar…', 'aria-label': 'Buscar modelos', onInput: (e) => { f.q = e.target.value; update(); } });
  const chips = [
    toggleChips({ label: 'Formato', options: FORMATS.map((t) => ({ value: t, label: formatName(t), icon: t })), value: f.formats, counts: fmtCounts, onChange: (v) => { f.formats = v; update(); } }),
    toggleChips({ label: 'Nível', options: LEVELS, value: f.levels, counts: lvlCounts, onChange: (v) => { f.levels = v; update(); } }),
    toggleChips({ label: 'Habilidade', options: SKILLS, value: f.skills, counts: sklCounts, onChange: (v) => { f.skills = v; update(); } }),
    toggleChips({ label: 'Conteúdo', options: contentOptions, value: f.content, counts: cntCounts, onChange: (v) => { f.content = v; update(); } }),
  ];
  const sort = h('select.sort', { 'aria-label': 'Ordenar', value: f.sort, onChange: (e) => { f.sort = e.target.value; update(); } },
    h('option', { value: 'recent' }, 'Mais recentes'),
    h('option', { value: 'az' }, 'A–Z'),
    h('option', { value: 'used' }, 'Mais usados'));

  function update() {
    syncUrl();
    const sorters = {
      recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      az: (a, b) => a.title.localeCompare(b.title),
      used: (a, b) => b.uses - a.uses || a.title.localeCompare(b.title),
    };
    const list = models.filter((m) => matchModel(m, f)).sort(sorters[f.sort]);
    const filtering = f.q || f.formats.length || f.levels.length || f.skills.length || f.content.length;
    resultInfo.textContent = filtering ? `${list.length} de ${models.length} modelos` : `${models.length} modelos`;
    clearBtn.hidden = !filtering;
    grid.replaceChildren(
      ...(list.length
        ? list.map((m) => modelCard(m))
        : [emptyState(models.length ? 'Nenhum modelo com esses filtros.' : 'A biblioteca está vazia.',
            models.length ? 'Tire algum filtro ou crie um modelo novo.' : 'Crie o primeiro modelo, ou salve um bloco de uma aula como modelo.')])
    );
  }

  const filterGroup = (title, el) => h('div.filter-group', h('h3', title), el);
  const newBtn = h('button.btn.primary', { type: 'button', onClick: (e) => newModelMenu(e.currentTarget) }, svgIcon(ICONS.plus), 'Novo modelo');

  root.replaceChildren(
    appShell('models',
      h('div.page.page-wide',
        pageHead({
          title: 'Modelos',
          subtitle: 'Atividades prontas para usar nas aulas. Ao entrar numa aula, o modelo é copiado: editar aqui não muda as aulas já montadas.',
          actions: newBtn,
        }),
        h('div.library',
          h('aside.filters', { 'aria-label': 'Filtros' },
            search,
            filterGroup('Formato', chips[0]),
            filterGroup('Nível', chips[1]),
            filterGroup('Habilidade', chips[2]),
            contentOptions.length ? filterGroup('Conteúdo', chips[3]) : null,
            clearBtn),
          h('section.results',
            h('div.results-bar', resultInfo, h('label.sort-label', 'Ordenar ', sort)),
            grid))
      )
    )
  );
  update();
  return () => document.querySelector('.menu.format-menu')?.remove();
}

