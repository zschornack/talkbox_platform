// Modelos: a biblioteca de atividades prontas (requisitos, seção 7).
import { h, svgIcon, ICONS, uid, parseHash, shortDate } from './dom.js';
import { api } from './api.js';
import { appShell, pageHead } from './layout.js';
import { BLOCKS, MENU } from './blocks/index.js';
import { summarize } from './blocks/summary.js';
import { LEVELS, SKILLS, CONTENT_SUGGESTIONS, splitContentQuery, normalizeTerm, canonicalContent } from './catalog.js';
import { toggleChips, tagInput, modal, field, toast, emptyState, confirmDialog } from './ui.js';
import { toText } from './sanitize.js';
import { copyBlock } from './block-view.js';
import { stripBlockMarks, countLiveMarks, toMaterialColors } from './marks.js';

export const FORMATS = MENU.filter((t) => t !== 'notes');
export const formatName = (t) => BLOCKS[t]?.name || t;

export const DEFAULT_SKILLS = {
  fill: ['Escrita'], choice: ['Leitura'], match: ['Leitura'], deck: ['Fala'], challenge: ['Fala'], image: ['Fala'], explanation: ['Leitura'],
  table: ['Leitura'], text: ['Leitura'], tense: ['Leitura'], timeline: ['Leitura'], reveal: ['Fala'], order: ['Escrita'], transform: ['Escrita'],
  spot: ['Leitura'], sort: ['Leitura'], scale: ['Fala'], roleplay: ['Fala'], timer: ['Fala'],
};

/** "means of transport, Car, blue" → ['means of transport', 'car', 'blue'] (como o servidor guarda). */
export const splitKeywords = (text) =>
  [...new Set(String(text || '').split(',').map((x) => x.trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean))];

/** Todas as etiquetas livres já usadas, das mais usadas para as menos. */
export function keywordUniverse(models) {
  const n = {};
  for (const m of models) for (const k of m.tags.keywords || []) n[k] = (n[k] || 0) + 1;
  return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b));
}

/** Campo de etiquetas livres: texto separado por vírgula, com sugestões das que já existem. */
export function keywordsField(tags, onChange, models = [], { label = 'Etiquetas livres', hint } = {}) {
  const listId = 'kw' + Math.random().toString(36).slice(2, 8);
  const input = h('input', {
    type: 'text',
    value: (tags.keywords || []).join(', '),
    placeholder: 'Ex.: means of transport, car, blue',
    autocomplete: 'off',
    list: listId,
    onInput: (e) => { tags.keywords = splitKeywords(e.target.value); onChange?.(tags.keywords); },
    onBlur: (e) => { e.target.value = (tags.keywords || []).join(', '); },
  });
  const known = keywordUniverse(models).slice(0, 60);
  return h('div.field', h('label', { for: (input.id = 'f' + listId) }, label), input,
    h('datalist', { id: listId }, known.map((k) => h('option', { value: k }))),
    h('div.field-hint', hint || 'Separe por vírgula. Do geral para o específico, em inglês: a categoria, a coisa, a cor, o lugar.'));
}

export const formatBadge = (type) => h('span.format-badge', { class: `f-${type}` }, svgIcon(ICONS[type], 15), formatName(type));

/** Todas as etiquetas de conteúdo conhecidas (sugestões + as já usadas). */
export const contentUniverse = (models) =>
  [...new Set([...models.flatMap((m) => m.tags.content), ...CONTENT_SUGGESTIONS])].sort((a, b) => a.localeCompare(b));

/** Filtro combinado: "ou" dentro de cada eixo, "e" entre eixos (requisitos 7.1). */
export function matchModel(m, f) {
  if ((f.q || '').trim()) {
    const hay = normalizeTerm([m.title, formatName(m.type), ...m.tags.content, ...m.tags.levels, ...m.tags.skills, ...(m.tags.keywords || []), ...summarize(m.block).lines].join(' '));
    // conteúdos citados na busca valem pelo nome oficial e por qualquer sinônimo ("simple past" acha Past Simple)
    const { contents, rest } = splitContentQuery(f.q);
    for (const c of contents) {
      if (!m.tags.content.includes(c) && !hay.includes(normalizeTerm(c))) return false;
    }
    if (rest && !rest.split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  if (f.review && m.status !== 'review') return false;
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
      m.status === 'review' ? h('span.badge.review', { title: 'Importado: confira e aprove' }, 'a revisar') : null,
      m.seenAt ? h('span.seen', { title: 'Este aluno já viu este modelo' }, `visto em ${shortDate(m.seenAt)}`) : null),
    s.image ? h('img.mc-thumb', { src: s.image, alt: '', loading: 'lazy' }) : null,
    h('h3.mc-title', m.title),
    s.lines.length ? h('ul.mc-lines', s.lines.map((l) => h('li', l))) : null,
    h('div.mc-tags',
      m.tags.levels.map((l) => h('span.level', l)),
      m.tags.content.slice(0, compact ? 3 : 5).map((c) => h('span.chip', c)),
      (m.tags.keywords || []).slice(0, compact ? 3 : 4).map((k) => h('span.chip.kw', k)),
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

// ---------- criar um modelo novo: a galeria de formatos, com dois exemplos de cada ----------
// Nada é criado aqui: o modelo só nasce quando a professora clica em "Salvar modelo".
export function newModelMenu() {
  location.hash = '#/modelos/novo';
}

// ---------- salvar um bloco da aula como modelo (requisitos 8.3) ----------
export async function saveAsModelDialog(block, { level, onSaved, onlyNew = false } = {}) {
  const models = await api.models().catch(() => []);
  // da aula, sempre um modelo novo: o que se escreve na aula nunca muda um modelo que já existe
  const src = block.source?.modelId ? models.find((m) => m.id === block.source.modelId) : null;
  const origin = onlyNew ? null : src;
  const base = src?.tags || { content: [], levels: level ? [level] : [], skills: DEFAULT_SKILLS[block.type] || [] };
  const tags = { content: [...base.content], levels: [...base.levels], skills: [...base.skills], keywords: [...(base.keywords || [])] };
  const live = countLiveMarks(block);
  const stripBox = h('input', { type: 'checkbox', checked: true });
  const label = toText(block.label || '').trim();
  const title = h('input', {
    type: 'text', required: true, maxlength: '200',
    value: src?.title || (label ? label.charAt(0) + label.slice(1).toLowerCase() : formatName(block.type)),
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
        tagInput({ value: tags.content, suggestions: contentUniverse(models), normalize: canonicalContent, onChange: (v) => (tags.content = v), label: 'Conteúdo', placeholder: 'Ex.: Past Simple (Enter para adicionar)' })),
      h('div.field', h('span.field-label', 'Nível'), toggleChips({ options: LEVELS, value: tags.levels, onChange: (v) => (tags.levels = v), label: 'Nível' })),
      h('div.field', h('span.field-label', 'Habilidade'), toggleChips({ options: SKILLS, value: tags.skills, onChange: (v) => (tags.skills = v), label: 'Habilidade' })),
      keywordsField(tags, null, models),
      live ? h('label.check-row', stripBox, `Tirar o marca-texto feito na aula (${live} ${live === 1 ? 'destaque' : 'destaques'}). As cores do material ficam.`) : null,
      h('p.muted.small', 'O modelo guarda o bloco como está agora, e este bloco da aula passa a apontar para ele. Atualizar um modelo muda todas as aulas que usam ele.'),
    ],
    onSubmit: async (form) => {
      // o modelo fica com os mesmos ids de itens do bloco: a aula passa a apontar para ele sem perder as respostas
      const clean = JSON.parse(JSON.stringify(block));
      delete clean.source; delete clean.ref; delete clean.local; delete clean.pending;
      // o que foi destacado na aula sai (ou, se ficar, vira cor do material)
      if (live && stripBox.checked) stripBlockMarks(clean);
      else toMaterialColors(clean);
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
    review: query.get('revisar') === '1',
  };

  const syncUrl = () => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    f.formats.forEach((x) => p.append('formato', x));
    f.levels.forEach((x) => p.append('nivel', x));
    f.skills.forEach((x) => p.append('habilidade', x));
    f.content.forEach((x) => p.append('conteudo', x));
    if (f.sort !== 'recent') p.set('ordem', f.sort);
    if (f.review) p.set('revisar', '1');
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
  const clearBtn = h('button.link-btn', { type: 'button', onClick: () => { Object.assign(f, { q: '', formats: [], levels: [], skills: [], content: [], review: false }); search.value = ''; chips.forEach((c) => c.setValue([])); paintReview(); update(); } }, 'Limpar filtros');

  // fila "a revisar": itens importados que ainda não foram conferidos
  const toReview = models.filter((m) => m.status === 'review').length;
  const reviewBox = h('div.review-box');
  const paintReview = async () => {
    if (!toReview) return reviewBox.replaceChildren();
    const toggle = h('button.tchip', {
      type: 'button', class: f.review ? 'on' : '', 'aria-pressed': String(f.review),
      onClick: () => { f.review = !f.review; paintReview(); update(); },
    }, 'Só os itens a revisar', h('span.count', String(toReview)));
    const lots = f.review ? (await api.imports()).filter((i) => i.toReview && !i.undoneAt) : [];
    reviewBox.replaceChildren(
      h('h3', 'A revisar'),
      h('p.muted.small', 'Itens importados entram aqui. Abra cada um, confira as etiquetas e aprove.'),
      toggle,
      lots.length ? h('ul.lots', lots.map((l) =>
        h('li', h('span', `${l.file || l.id} · ${l.toReview} a revisar`),
          h('button.link-btn', { type: 'button', onClick: async () => {
            if (!(await confirmDialog(`Os ${l.toReview} itens deste lote que ainda estão "a revisar" saem da biblioteca. Os que você já aprovou ficam.`, { title: 'Desfazer lote?', confirmLabel: 'Desfazer lote' }))) return;
            await api.undoImport(l.id);
            toast('Lote desfeito.');
            window.dispatchEvent(new HashChangeEvent('hashchange'));
          } }, 'Desfazer lote')))) : null);
  };
  paintReview();

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
    const filtering = f.q || f.formats.length || f.levels.length || f.skills.length || f.content.length || f.review;
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
            reviewBox,
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

