// A aula (requisitos seção 9): um modo só, sempre editável e sempre limpa.
import { h, svgIcon, ICONS, uid, formatDate } from './dom.js';
import { api, autosaver, saveOnExit } from './api.js';
import { editable } from './editable.js';
import { mountFormatBar } from './format-bar.js';
import { mountPen } from './pen.js';
import { BLOCKS, MENU } from './blocks/index.js';
import { openExportDialog } from './export.js';
import { mountBlock, copyBlock } from './block-view.js';
import { openModelPicker } from './model-picker.js';
import { saveAsModelDialog } from './models.js';
import { toast } from './ui.js';

const SIZES = [16, 18, 20, 22, 24, 28, 32];

export async function renderEditor(root, id, { openExport = false } = {}) {
  let lesson;
  try {
    lesson = await api.lesson(id);
  } catch {
    root.replaceChildren(h('div.page', h('p', 'Aula não encontrada. '), h('a', { href: '#/' }, 'Voltar para o início')));
    return () => {};
  }
  document.title = `${lesson.doc.title} · TalkBox`;

  const doc = lesson.doc;
  const state = lesson.state;
  state.blocks ||= {};
  state.pen ||= [];
  if (!SIZES.includes(state.size)) state.size = 20;
  const locals = new Map();
  const localOf = (bid) => (locals.has(bid) ? locals.get(bid) : locals.set(bid, {}).get(bid));
  const cleanups = [];
  const backHref = lesson.studentId ? `#/alunos/${lesson.studentId}` : '#/';

  // ---------- salvar automaticamente ----------
  const status = h('span.save-status', { role: 'status', 'aria-live': 'polite' }, 'Salvo');
  const saver = autosaver({ save: (body) => api.saveLesson(lesson.id, body), statusEl: status });
  const markDoc = () => saver.queue({ title: doc.title, doc });
  const markState = () => saver.queue({ state });
  const onExit = () => { if (saver.pending) saveOnExit(`/api/lessons/${lesson.id}`, saver.pending); };
  window.addEventListener('beforeunload', onExit);
  cleanups.push(() => { window.removeEventListener('beforeunload', onExit); saver.flush(); });

  // ---------- a folha ----------
  const paper = h('main.paper', { style: { '--lesson-size': state.size + 'px' } });
  const sizeLabel = h('span', state.size + 'px');
  const setSize = (dir) => {
    const i = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(state.size) + dir));
    state.size = SIZES[i];
    paper.style.setProperty('--lesson-size', state.size + 'px');
    sizeLabel.textContent = state.size + 'px';
    markState();
  };

  const head = h(
    'header.lesson-head',
    h('div.print-head', h('span', lesson.student ? `Aluno(a): ${lesson.student}` : ''), h('span', formatDate(lesson.createdAt))),
    h(
      'div.chips',
      editable(h('span.chip.level'), {
        value: doc.level || '',
        placeholder: 'Nível',
        single: true,
        rich: false,
        onChange: (v) => { doc.level = v.toUpperCase(); markDoc(); },
      }),
      (doc.tags || []).map((t) => h('span.chip', t)),
      lesson.student ? h('span.chip', `Aula · ${lesson.student}`) : null
    ),
    editable(h('h1.lesson-title'), {
      value: doc.title,
      placeholder: 'Tema da aula',
      single: true,
      rich: false,
      onChange: (v) => { doc.title = v; document.title = `${v} · TalkBox`; markDoc(); },
    }),
    h('div.stripe', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
    editable(h('p.lesson-sub.opt'), {
      value: doc.subtitle || '',
      placeholder: 'Uma frase sobre a aula (opcional)',
      onChange: (v) => { doc.subtitle = v; markDoc(); },
    })
  );

  const blocksEl = h('div.blocks');
  const addEnd = h('div.add-end', h('button.btn', { type: 'button', onClick: (e) => openMenu(e.currentTarget, doc.blocks.length) }, '+ Inserir bloco'));
  paper.append(head, blocksEl, addEnd);

  // ---------- blocos ----------
  function shell(block) {
    const index = () => doc.blocks.indexOf(block);
    return mountBlock(block, {
      changed: markDoc,
      state: () => (state.blocks[block.id] ||= {}),
      stateChanged: markState,
      local: localOf(block.id),
      slashKey: (e) => {
        if (e.key === '/' && block.type === 'text' && !e.currentTarget.textContent.trim()) {
          e.preventDefault();
          openMenu(e.currentTarget, index(), { replace: true });
        }
      },
      tools: [
        { icon: 'up', label: 'Mover para cima', run: () => move(index(), -1) },
        { icon: 'down', label: 'Mover para baixo', run: () => move(index(), 1) },
        { icon: 'copy', label: 'Duplicar', run: () => duplicate(index()) },
        { icon: 'trash', label: 'Remover', run: () => remove(index()) },
      ],
      extraActions: () =>
        block.type === 'notes'
          ? []
          : [{ label: 'Salvar como modelo', onClick: () => saveAsModelDialog(block, { level: doc.level, onSaved: (m) => { block.source = { modelId: m.id, title: m.title }; markDoc(); } }) }],
    });
  }

  function renderBlocks() {
    blocksEl.replaceChildren(...doc.blocks.flatMap((b, i) => [insertLine(i), shell(b)]));
  }
  const insertLine = (i) =>
    h('div.insert-line', h('button', { type: 'button', title: 'Inserir bloco aqui', 'aria-label': 'Inserir bloco aqui', onClick: (e) => openMenu(e.currentTarget, i) }, '+'));

  const blockEl = (b) => blocksEl.querySelector(`[data-id="${b.id}"]`);
  const focusBlock = (b) => {
    const el = blockEl(b);
    const target = [...(el?.querySelectorAll('[contenteditable="true"], .dropzone') || [])].find((x) => !x.classList.contains('block-label'));
    target?.focus();
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= doc.blocks.length) return;
    [doc.blocks[i], doc.blocks[j]] = [doc.blocks[j], doc.blocks[i]];
    markDoc();
    renderBlocks();
    blockEl(doc.blocks[j])?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  function duplicate(i) {
    doc.blocks.splice(i + 1, 0, copyBlock(doc.blocks[i], uid));
    markDoc();
    renderBlocks();
  }
  function remove(i) {
    const [gone] = doc.blocks.splice(i, 1);
    const goneState = state.blocks[gone.id];
    delete state.blocks[gone.id];
    markDoc();
    markState();
    renderBlocks();
    toast(`Bloco removido: ${BLOCKS[gone.type]?.name || gone.type}`, {
      label: 'Desfazer',
      run: () => {
        doc.blocks.splice(Math.min(i, doc.blocks.length), 0, gone);
        if (goneState) state.blocks[gone.id] = goneState;
        markDoc();
        markState();
        renderBlocks();
      },
    });
  }
  function insert(type, i, replace = false) {
    const block = { id: uid(), type, ...BLOCKS[type].create() };
    doc.blocks.splice(i, replace ? 1 : 0, block);
    markDoc();
    renderBlocks();
    focusBlock(block);
    return block;
  }
  /** Modelos entram na aula como CÓPIA (requisitos 7.4). */
  function insertModels(models, i, replace = false) {
    const copies = models.map((m) => {
      const c = copyBlock(m.block, uid);
      c.type = m.type;
      c.source = { modelId: m.id, title: m.title };
      return c;
    });
    doc.blocks.splice(i, replace ? 1 : 0, ...copies);
    markDoc();
    renderBlocks();
    blockEl(copies[0])?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    toast(copies.length === 1 ? `"${models[0].title}" entrou na aula.` : `${copies.length} modelos entraram na aula.`);
  }
  const pickModels = (index, replace = false) =>
    openModelPicker({ studentId: lesson.studentId, level: doc.level, onInsert: (models) => insertModels(models, index, replace) });

  // ---------- menu "inserir bloco" (botão + ou "/") ----------
  let menuEl = null;
  function closeMenu() {
    menuEl?.remove();
    menuEl = null;
  }
  function openMenu(anchor, index, { replace = false } = {}) {
    closeMenu();
    let active = 0;
    const fromModels = h('button.menu-models', { type: 'button', role: 'menuitem', onClick: () => { closeMenu(); pickModels(index, replace); } },
      h('span.menu-title', svgIcon(ICONS.layers, 16), 'Da biblioteca de modelos…'), h('small', 'Atividades prontas · Ctrl+K'));
    const items = [
      fromModels,
      ...MENU.map((type) =>
        h('button', { type: 'button', role: 'menuitem', onClick: () => { closeMenu(); insert(type, index, replace); } },
          h('span.menu-title', svgIcon(ICONS[type], 16), BLOCKS[type].name), h('small', BLOCKS[type].hint))
      ),
    ];
    menuEl = h('div.menu', { role: 'menu', 'aria-label': 'Inserir bloco' }, items[0], h('div.menu-sep'), items.slice(1));
    const r = anchor.getBoundingClientRect();
    menuEl.style.left = Math.max(8, Math.min(r.left + window.scrollX, window.scrollX + document.documentElement.clientWidth - 296)) + 'px';
    menuEl.style.top = r.bottom + window.scrollY + 6 + 'px';
    document.body.append(menuEl);
    const highlight = () => items.forEach((b, k) => b.classList.toggle('active', k === active));
    highlight();
    const restoreFocus = document.activeElement;
    menuEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { active = (active + 1) % items.length; items[active].focus(); highlight(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { active = (active - 1 + items.length) % items.length; items[active].focus(); highlight(); e.preventDefault(); }
      if (e.key === 'Escape') { closeMenu(); restoreFocus?.focus?.(); }
    });
    items[0].focus();
  }
  const onDocClick = (e) => { if (menuEl && !menuEl.contains(e.target) && !e.target.closest('.insert-line, .add-end')) closeMenu(); };
  document.addEventListener('mousedown', onDocClick);
  cleanups.push(() => { document.removeEventListener('mousedown', onDocClick); closeMenu(); });

  // ---------- colar imagem em qualquer lugar da aula ----------
  paper.addEventListener('paste', (e) => {
    const file = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))?.getAsFile();
    if (!file) return;
    e.preventDefault();
    const here = document.activeElement?.closest?.('.block');
    const cur = here && doc.blocks.find((b) => b.id === here.dataset.id);
    if (cur?.type === 'image' && !cur.src) return localOf(cur.id).take?.(file);
    const at = cur ? doc.blocks.indexOf(cur) + 1 : doc.blocks.length;
    const block = insert('image', at);
    localOf(block.id).take?.(file);
  });

  // ---------- caneta ----------
  const pen = mountPen(paper, {
    getPaths: () => state.pen,
    setPaths: (p) => { state.pen = p; markState(); refreshPenButtons(); },
  });
  const penBtn = h('button.btn', { type: 'button', 'aria-pressed': 'false', onClick: () => togglePen() }, svgIcon(ICONS.pen), h('span', 'Caneta'));
  const clearBtn = h('button.btn', {
    type: 'button',
    onClick: () => { state.pen = []; pen.redraw(); markState(); refreshPenButtons(); },
  }, 'Apagar desenho');
  function togglePen(force) {
    const on = force ?? !pen.active;
    pen.setActive(on);
    penBtn.classList.toggle('on', on);
    penBtn.setAttribute('aria-pressed', String(on));
    penBtn.lastChild.textContent = on ? 'Caneta ligada' : 'Caneta';
  }
  function refreshPenButtons() { clearBtn.hidden = state.pen.length === 0; }
  refreshPenButtons();

  // ---------- barra superior (meio apagada até passar o mouse) ----------
  const doExport = () => openExportDialog({ lesson, doc, flush: () => saver.flush() });
  const chrome = h(
    'div.chrome',
    h('div.left',
      h('a.btn.icon', { href: backHref, title: lesson.student ? `Voltar para a ficha de ${lesson.student}` : 'Voltar', 'aria-label': 'Voltar' }, svgIcon(ICONS.back)),
      h('a.brand', { href: '#/' }, 'TalkBox'),
      status
    ),
    h('div.right',
      penBtn,
      clearBtn,
      h('div.sizer',
        h('button', { type: 'button', 'aria-label': 'Diminuir fonte', onClick: () => setSize(-1) }, 'A−'),
        sizeLabel,
        h('button', { type: 'button', 'aria-label': 'Aumentar fonte', style: { fontSize: '19px' }, onClick: () => setSize(1) }, 'A+')
      ),
      h('button.btn', { type: 'button', onClick: doExport }, 'Exportar PDF'),
      h('button.btn.primary', { type: 'button', disabled: true, title: 'Chega num próximo patch (handover)' }, 'Finalizar aula')
    )
  );

  // ---------- atalhos ----------
  const cursorIndex = () => {
    const here = document.activeElement?.closest?.('.block');
    const cur = here && doc.blocks.find((b) => b.id === here.dataset.id);
    return cur ? doc.blocks.indexOf(cur) + 1 : doc.blocks.length;
  };
  const onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (document.querySelector('.modal-bg, .drawer')) return;
    if (mod && e.key.toLowerCase() === 'p') { e.preventDefault(); doExport(); }
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); closeMenu(); pickModels(cursorIndex()); }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'e') { e.preventDefault(); togglePen(); }
    if (e.key === 'Escape' && pen.active) togglePen(false);
  };
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));
  cleanups.push(mountFormatBar(paper, () => pen.active));
  cleanups.push(() => document.querySelector('.drawer-bg')?.remove());

  renderBlocks();
  root.replaceChildren(h('div.lesson-wrap', chrome, paper));
  if (openExport) setTimeout(doExport, 300);

  return () => cleanups.forEach((fn) => fn());
}
