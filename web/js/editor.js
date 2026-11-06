// A aula (requisitos seção 9): um modo só, sempre editável e sempre limpa.
import { h, svgIcon, ICONS, uid, formatDate, brandMark } from './dom.js';
import { api, autosaver, saveOnExit } from './api.js';
import { editable } from './editable.js';
import { mountFormatBar } from './format-bar.js';
import { mountPen } from './pen.js';
import { BLOCKS, MENU } from './blocks/index.js';
import { openExportDialog } from './export.js';
import { mountBlock, copyBlock, refBlock } from './block-view.js';
import { openModelPicker } from './model-picker.js';
import { saveAsModelDialog } from './models.js';
import { toast, confirmDialog } from './ui.js';
import { openFinishDialog } from './handover.js';
import { openImagePicker } from './images.js';
import { openGallery } from './gallery.js';
import { copyLessonDialog } from './new-lesson.js';
import { FORMAT_GROUPS } from './blocks/examples.js';
import { stripBlockMarks, countLiveMarks, comparable } from './marks.js';

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
  const backHref = lesson.studentId ? `#/alunos/${lesson.studentId}` : lesson.courseNumber ? `#/curso?nivel=${Math.ceil(lesson.courseNumber / 10)}` : '#/';

  // ---------- salvar automaticamente ----------
  const status = h('span.save-status', { role: 'status', 'aria-live': 'polite' }, 'Salvo');
  const saver = autosaver({ save: (body) => api.saveLesson(lesson.id, body), statusEl: status });
  const markDoc = () => saver.queue({ title: doc.title, doc });
  const markState = () => saver.queue({ state });
  const onExit = () => { if (saver.pending) saveOnExit(`/api/lessons/${lesson.id}`, saver.pending); };
  window.addEventListener('beforeunload', onExit);
  cleanups.push(() => { window.removeEventListener('beforeunload', onExit); saver.flush(); });

  // ---------- a folha ----------
  // o tamanho da letra fica no envoltório da aula: a folha e a barra de cima crescem juntas (A− / A+)
  const wrap = h('div.lesson-wrap', { style: { '--lesson-size': state.size + 'px' } });
  const paper = h('main.paper');
  const sizeLabel = h('span', state.size + 'px');
  const setSize = (dir) => {
    const i = Math.max(0, Math.min(SIZES.length - 1, SIZES.indexOf(state.size) + dir));
    state.size = SIZES[i];
    wrap.style.setProperty('--lesson-size', state.size + 'px');
    sizeLabel.textContent = state.size + 'px';
    markState();
  };

  const printDate = h('span', formatDate(lesson.date || lesson.createdAt));
  const head = h(
    'header.lesson-head',
    h('div.print-head', brandMark({ href: null, size: 'sm' }), h('span.print-meta', h('span', lesson.student ? `Aluno(a): ${lesson.student}` : ''), printDate)),
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
      lesson.student ? h('span.chip', `Aula${lesson.number ? ` ${lesson.number}` : ''} · ${lesson.student}`) : null,
      h('label.date-chip', { title: 'Data da aula' },
        h('span.sr-only', 'Data da aula'),
        h('input', {
          type: 'date',
          value: lesson.date || '',
          onChange: (e) => {
            if (!e.target.value) return;
            lesson.date = e.target.value;
            printDate.textContent = formatDate(lesson.date);
            saver.queue({ date: lesson.date });
          },
        }))
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

  // recado do professor anterior (aula criada pela ficha): só na tela, nunca no PDF
  const received = lesson.status === 'preparing' && lesson.receivedMessage
    ? h('aside.received-note', { role: 'note' },
        h('div', h('strong', 'Sua anotação da aula anterior'), h('p', lesson.receivedMessage)),
        h('button.icon-btn', { type: 'button', 'aria-label': 'Esconder anotação', onClick: (e) => e.currentTarget.parentElement.remove() }, svgIcon(ICONS.x)))
    : null;

  // plano da aula: sobre o que é e os objetivos. Só na tela, nunca no PDF.
  // Fica fechado por padrão (a tela costuma estar compartilhada com o aluno); abre com um clique e lembra a escolha.
  const planText = editable(h('div.plan-text'), {
    value: doc.plan || '',
    placeholder: 'Sobre o que é a aula e os objetivos (não sai no PDF)',
    onChange: (v) => { doc.plan = v; markDoc(); },
  });
  const planOpenKey = 'talkbox.planOpen';
  let planOpen = false;
  try { planOpen = localStorage.getItem(planOpenKey) === '1'; } catch { /* sem armazenamento: fica fechado */ }
  const planToggle = h('button.plan-toggle', { type: 'button', 'aria-expanded': String(planOpen) },
    h('span.plan-label', 'Plano da aula'), h('span.plan-hint', 'só você vê'), svgIcon(ICONS.chevron, 16));
  const plan = h('section.lesson-plan.screen-only', { class: planOpen ? 'open' : '' }, planToggle, planText);
  planToggle.addEventListener('click', () => {
    planOpen = !planOpen;
    plan.classList.toggle('open', planOpen);
    planToggle.setAttribute('aria-expanded', String(planOpen));
    try { localStorage.setItem(planOpenKey, planOpen ? '1' : '0'); } catch { /* ignora */ }
    if (planOpen) planText.focus();
  });

  const blocksEl = h('div.blocks');
  const addEnd = h('div.add-end', h('button.btn', { type: 'button', onClick: (e) => openMenu(e.currentTarget, doc.blocks.length) }, '+ Inserir bloco'));
  paper.append(...[received, head, plan, blocksEl, addEnd].filter(Boolean));

  // ---------- blocos ----------
  function shell(block) {
    const index = () => doc.blocks.indexOf(block);
    let el;
    const el0 = mountBlock(block, {
      // bloco da biblioteca mudado na aula: a mudança fica só nesta aula (o original só muda na aba Modelos)
      changed: () => { if (block.ref && !block.edited) { block.edited = true; el?.classList.add('is-edited'); paintEdited(); } markDoc(); },
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
      pickImage: (opts) => openImagePicker(opts),
      extraActions: () =>
        block.type === 'notes'
          ? []
          : block.ref
            ? [
                // bloco da biblioteca: o que se escreve aqui fica só nesta aula; o original muda só na aba Modelos
                ...(block.edited ? [{ label: 'Voltar ao original', onClick: () => resetBlocks([block.id]) }] : []),
                { label: 'Editar o original ↗', onClick: () => window.open(`#/modelos/${block.ref}`, '_blank') },
              ]
            : [
                ...(block.source?.modelId ? [{ label: 'Voltar ao original', onClick: () => restoreOriginal(block) }] : []),
                { label: 'Salvar como modelo', onClick: () => saveAsModelDialog(block, { level: doc.level, onlyNew: true, onSaved: (m) => { block.source = { modelId: m.id, title: m.title }; block.ref = m.id; delete block.local; markDoc(); renderBlocks(); } }) },
              ],
    });
    el = el0;
    if (block.pending) el.classList.add('is-pending');
    if (block.ref) { el.classList.add('is-ref'); el.title = `Da biblioteca: "${block.source?.title || ''}". O que você escrever aqui fica só nesta aula; o original muda só na aba Modelos.`; }
    if (block.ref && block.edited) el.classList.add('is-edited');
    return el;
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
  // ---------- voltar ao original (o que foi escrito e destacado nos blocos da biblioteca nesta aula) ----------
  const editedCount = () => doc.blocks.filter((b) => b.ref && b.edited).length;
  async function resetBlocks(ids) {
    if (!ids) {
      const n = editedCount();
      if (!n) return toast('Nenhum bloco da biblioteca foi mudado nesta aula.');
      const ok = await confirmDialog(`${n} ${n === 1 ? 'bloco da biblioteca volta' : 'blocos da biblioteca voltam'} ao original: sai o que foi escrito e destacado ${n === 1 ? 'nele' : 'neles'} nesta aula. As respostas, a caneta e as anotações ficam. Se quiser guardar, exporte o PDF antes.`,
        { title: 'Voltar tudo ao original?', confirmLabel: 'Voltar ao original' });
      if (!ok) return;
    }
    await resetNow(ids);
    toast(ids ? 'O bloco voltou ao original.' : 'Os blocos da biblioteca voltaram ao original.');
  }
  async function resetNow(ids) {
    await saver.flush();
    await api.resetLesson(lesson.id, ids);
    // abre a aula de novo, já com os originais
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  const editedBar = h('div.edited-bar', { hidden: true, role: 'status' });
  function paintEdited() {
    const n = editedCount();
    editedBar.hidden = !(lesson.status === 'done' && n);
    if (editedBar.hidden) return;
    editedBar.replaceChildren(
      h('span', `${n} ${n === 1 ? 'bloco ainda tem' : 'blocos ainda têm'} o que foi escrito na aula. Sai depois do PDF.`),
      h('button.btn.small', { type: 'button', onClick: () => doExport() }, 'Exportar PDF'),
      h('button.btn.small', { type: 'button', onClick: () => resetBlocks(null) }, 'Descartar sem PDF'));
  }

  /** O bloco volta a ser o modelo da biblioteca de onde veio (sai o que foi escrito e marcado na aula). */
  async function restoreOriginal(block) {
    let m;
    try { m = await api.model(block.source.modelId); } catch { return toast('O modelo de onde este bloco veio não está mais na biblioteca.'); }
    const fresh = refBlock(m, uid);
    if (comparable(fresh) === comparable(block)) {
      // igual ao modelo: só volta a apontar para ele
      delete block.local; block.ref = m.id; markDoc(); renderBlocks();
      return toast('O bloco voltou a ser o da biblioteca.');
    }
    const ok = await confirmDialog(`O bloco volta a ser o modelo "${m.title}": sai o que foi escrito e destacado nele nesta aula.`, { title: 'Voltar ao original?', confirmLabel: 'Voltar ao original' });
    if (!ok) return;
    const i = doc.blocks.indexOf(block);
    if (i < 0) return;
    const before = doc.blocks[i];
    const next = { ...fresh, id: block.id, ...(block.pending ? { pending: block.pending } : {}) };
    doc.blocks[i] = next;
    markDoc();
    renderBlocks();
    toast('O bloco voltou ao original.', { label: 'Desfazer', run: () => { const k = doc.blocks.indexOf(next); if (k >= 0) { doc.blocks[k] = before; markDoc(); renderBlocks(); } } });
  }

  /** Tira o marca-texto feito na aula de todos os blocos (as cores do material ficam). */
  function clearLiveMarks() {
    const n = doc.blocks.reduce((acc, b) => acc + countLiveMarks(b), 0);
    if (!n) return toast('Esta aula não tem marca-texto feito na aula.');
    const before = JSON.parse(JSON.stringify(doc.blocks));
    doc.blocks.forEach((b) => stripBlockMarks(b));
    markDoc();
    renderBlocks();
    toast(`${n} ${n === 1 ? 'destaque saiu' : 'destaques saíram'}.`, { label: 'Desfazer', run: () => { doc.blocks.splice(0, doc.blocks.length, ...before); markDoc(); renderBlocks(); } });
  }

  /** Imagens do acervo: várias entram como galeria (ou uma em cada bloco). */
  function insertImages(models, i, replace, { asGallery }) {
    const blocks = asGallery
      ? [{ id: uid(), type: 'gallery', ...BLOCKS.gallery.create(), images: models.map((m) => ({ id: uid('g'), src: m.block.src, caption: m.title, modelId: m.id })) }]
      : models.map((m) => refBlock(m, uid));
    doc.blocks.splice(i, replace ? 1 : 0, ...blocks);
    markDoc();
    renderBlocks();
    blockEl(blocks[0])?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    toast(asGallery ? `Galeria com ${models.length} imagens.` : models.length === 1 ? `"${models[0].title}" entrou na aula.` : `${models.length} imagens entraram na aula.`);
  }
  const pickImages = (index, replace = false) =>
    openImagePicker({ multiple: true, onPick: (models, opts) => insertImages(models, index, replace, opts) });

  /** Bloco pronto (em branco ou um exemplo da galeria de formatos). */
  function insertBlock(block, i, replace = false) {
    const b = { ...copyBlock({ ...block, id: 'x' }, uid) };
    doc.blocks.splice(i, replace ? 1 : 0, b);
    markDoc();
    renderBlocks();
    focusBlock(b);
  }

  function insert(type, i, replace = false) {
    const block = { id: uid(), type, ...BLOCKS[type].create() };
    doc.blocks.splice(i, replace ? 1 : 0, block);
    markDoc();
    renderBlocks();
    focusBlock(block);
    return block;
  }
  /** Modelos entram na aula como referência (v0.8): a aula aponta para o modelo. */
  function insertModels(models, i, replace = false) {
    const copies = models.map((m) => refBlock(m, uid));
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
    const fromImages = h('button.menu-models', { type: 'button', role: 'menuitem', onClick: () => { closeMenu(); pickImages(index, replace); } },
      h('span.menu-title', svgIcon(ICONS.image, 16), 'Imagens do acervo…'), h('small', 'Uma, várias ou um pacote inteiro como galeria'));
    const examples = h('button.menu-examples', { type: 'button', role: 'menuitem', onClick: () => { closeMenu(); openGallery({ onPick: (b) => insertBlock(b, index, replace) }); } },
      h('span.menu-title', svgIcon(ICONS.book, 16), 'Ver exemplos de cada formato…'), h('small', 'Dois exemplos prontos de cada um, para inserir'));
    const typeButton = (type) =>
      h('button', { type: 'button', role: 'menuitem', onClick: () => { closeMenu(); insert(type, index, replace); } },
        h('span.menu-title', svgIcon(ICONS[type], 16), BLOCKS[type].name), h('small', BLOCKS[type].hint));
    const groups = [...FORMAT_GROUPS, { name: 'Aula', types: ['notes'] }].map((g) => ({ name: g.name, buttons: g.types.filter((t) => MENU.includes(t)).map(typeButton) }));
    const items = [fromModels, fromImages, ...groups.flatMap((g) => g.buttons), examples];
    menuEl = h('div.menu.insert-menu', { role: 'menu', 'aria-label': 'Inserir bloco' },
      fromModels, fromImages,
      groups.map((g) => [h('div.menu-sep'), h('div.menu-label', g.name), g.buttons]),
      h('div.menu-sep'), examples);
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

  // ---------- finalizar aula ----------
  const finishSlot = h('span.finish-slot');
  const paintFinish = () => {
    if (lesson.status === 'done') {
      const when = lesson.handover?.finishedAt;
      finishSlot.replaceChildren(
        h('span.done-badge', { title: when ? `Finalizada em ${formatDate(when)}` : 'Aula finalizada' }, svgIcon(ICONS.check, 16), 'Finalizada'),
        h('button.btn', { type: 'button', title: 'Desfaz o "Finalizar aula" para corrigir e finalizar de novo', onClick: () => doReopen() }, 'Reabrir'));
    } else if (lesson.studentId) {
      finishSlot.replaceChildren(h('button.btn.cta', { type: 'button', onClick: () => doFinish() }, 'Finalizar aula'));
    } else if (lesson.courseNumber) {
      // aula do curso: não se finaliza; é copiada para um aluno
      finishSlot.replaceChildren(
        h('span.course-badge', `Curso · aula ${lesson.courseNumber}`),
        h('button.btn.cta', { type: 'button', onClick: async () => { await saver.flush(); copyLessonDialog({ id: lesson.id, title: doc.title, studentId: null }); } }, 'Dar para um aluno…'));
    } else {
      finishSlot.replaceChildren(h('button.btn.primary', { type: 'button', disabled: true, title: 'Ligue a aula a um aluno para finalizar' }, 'Finalizar aula'));
    }
  };
  const doFinish = () =>
    openFinishDialog({
      lesson,
      flush: () => saver.flush(),
      onFinished: (out) => { Object.assign(lesson, { status: 'done', handover: out.lesson?.handover }); paintFinish(); paintEdited(); },
      onExport: () => doExport(),
      edited: editedCount(),
    }).catch((err) => toast(err.message));

  const doReopen = async () => {
    const ok = await confirmDialog(
      'O mapa volta a ficar como estava antes desta aula, os pendentes que ela criou saem da lista e os que ela resolveu voltam a ficar pendentes. Depois é só finalizar de novo. Se você já preparou a aula seguinte, ela não muda.',
      { title: 'Reabrir esta aula?', confirmLabel: 'Reabrir aula' });
    if (!ok) return;
    try {
      const out = await api.reopenLesson(lesson.id);
      Object.assign(lesson, { status: 'preparing', handover: null });
      paintFinish();
      toast(out.discarded || out.reopened ? 'Aula reaberta. Mapa e pendências voltaram ao que eram.' : 'Aula reaberta.');
    } catch (err) { toast(err.message); }
  };

  // ---------- "Mais": copiar a aula, limpar o marca-texto, ver os formatos ----------
  let moreEl = null;
  const closeMore = () => { moreEl?.remove(); moreEl = null; };
  const moreBtn = h('button.btn.icon', { type: 'button', title: 'Mais', 'aria-label': 'Mais opções da aula', 'aria-haspopup': 'menu', onClick: (e) => openMore(e.currentTarget) }, svgIcon(ICONS.more));
  function openMore(anchor) {
    if (moreEl) return closeMore();
    const item = (icon, title, text, run) =>
      h('button', { type: 'button', role: 'menuitem', onClick: () => { closeMore(); run(); } }, h('span.menu-title', svgIcon(ICONS[icon], 16), title), h('small', text));
    moreEl = h('div.menu.more-menu', { role: 'menu', 'aria-label': 'Mais opções' },
      item('copy', 'Copiar esta aula…', 'Para este ou outro aluno, sem anotações nem marca-texto', async () => { await saver.flush(); copyLessonDialog({ id: lesson.id, title: doc.title, studentId: lesson.studentId }); }),
      item('eraser', 'Limpar o marca-texto da aula', 'Tira os destaques feitos na aula; as cores do material ficam', clearLiveMarks),
      item('back', 'Voltar tudo ao original', 'Os blocos da biblioteca perdem o que foi escrito na aula (exporte o PDF antes)', () => resetBlocks(null)),
      item('book', 'Ver exemplos dos formatos', 'Dois exemplos de cada formato, para inserir', () => openGallery({ onPick: (b) => insertBlock(b, cursorIndex()) })));
    const r = anchor.getBoundingClientRect();
    moreEl.style.left = Math.max(8, r.right + window.scrollX - 300) + 'px';
    moreEl.style.top = r.bottom + window.scrollY + 6 + 'px';
    document.body.append(moreEl);
    moreEl.querySelector('button')?.focus();
  }
  const onMoreDown = (e) => { if (moreEl && !moreEl.contains(e.target) && !moreBtn.contains(e.target)) closeMore(); };
  document.addEventListener('mousedown', onMoreDown);
  cleanups.push(() => { document.removeEventListener('mousedown', onMoreDown); closeMore(); });

  // ---------- barra superior (meio apagada até passar o mouse) ----------
  // Exportar PDF: o PDF sai com tudo o que foi escrito na aula; depois, isso é descartado e os blocos voltam ao original.
  const doExport = () => openExportDialog({ lesson, doc, flush: () => saver.flush(), after: afterExport });
  async function afterExport() {
    const n = editedCount();
    if (!n) return;
    const ok = await confirmDialog(
      `O que você escreveu e destacou ${n === 1 ? 'no bloco' : `nos ${n} blocos`} durante a aula é descartado, e ${n === 1 ? 'ele volta' : 'eles voltam'} ao original. O modelo na biblioteca nunca muda.`,
      { title: 'PDF salvo?', confirmLabel: 'Sim, descartar', cancelLabel: 'Não salvei' });
    if (ok) await resetNow(null);
  }
  const chrome = h(
    'div.chrome',
    h('div.left',
      h('a.btn.icon', { href: backHref, title: lesson.student ? `Voltar para a ficha de ${lesson.student}` : 'Voltar', 'aria-label': 'Voltar' }, svgIcon(ICONS.back)),
      brandMark(),
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
      finishSlot,
      moreBtn
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
    if (e.key === 'Escape') closeMore();
  };
  document.addEventListener('keydown', onKey);
  cleanups.push(() => document.removeEventListener('keydown', onKey));
  cleanups.push(mountFormatBar(paper, () => pen.active));
  cleanups.push(() => document.querySelector('.drawer-bg')?.remove());

  paper.prepend(editedBar);
  renderBlocks();
  paintFinish();
  paintEdited();
  wrap.append(chrome, paper);
  root.replaceChildren(wrap);
  if (openExport) setTimeout(doExport, 300);

  return () => cleanups.forEach((fn) => fn());
}
