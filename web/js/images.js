// Imagens: o acervo de fotos e ilustrações, organizado em pacotes (ex.: "Animals").
//   #/imagens                 acervo: pacotes + todas as imagens, busca por etiqueta
//   #/imagens/enviar          enviar imagens (uma ou várias), com título e etiquetas; nada é criado antes de "Fazer upload"
//   #/imagens/pacote/:id      um pacote: nome, etiquetas e as imagens dele
// E o painel "Imagens do acervo" que a aula usa para inserir imagens (uma, várias ou como galeria).
import { h, svgIcon, ICONS, parseHash, uid } from './dom.js';
import { api, autosaver, uploadImage, isLocalImage, localizeImage } from './api.js';
import { appShell, pageHead } from './layout.js';
import { modal, field, toast, emptyState, confirmDialog, toggleChips, tagInput } from './ui.js';
import { splitKeywords, keywordUniverse } from './models.js';
import { normalizeTerm, LEVELS, canonicalContent, CONTENT_SUGGESTIONS } from './catalog.js';

const imagesOf = (models) => models.filter((m) => m.type === 'image');

/** Busca: título, etiquetas livres, conteúdos, legenda e nome dos pacotes. */
function matchImage(m, q, packNames = {}) {
  const words = normalizeTerm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = normalizeTerm([m.title, m.block.caption, ...(m.tags.keywords || []), ...m.tags.content, ...(m.packs || []).map((p) => packNames[p] || '')].join(' '));
  return words.every((w) => hay.includes(w));
}

/** Título a partir do nome do arquivo: "fusca-azul_rua.jpg" → "Fusca azul rua". */
export function titleFromFile(name) {
  const base = String(name || '').replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!base || /^(image|imagem|img|screenshot|captura de tela)( \d+)?$/i.test(base)) return '';
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/** A foto do quadrinho; se não carregar (sem internet, link quebrado), aparece um aviso no lugar. */
function thumbImg(src) {
  if (!src) return h('span.img-broken', 'sem imagem');
  const img = h('img', { src, alt: '', loading: 'lazy' });
  img.addEventListener('error', () => img.replaceWith(h('span.img-broken', isLocalImage(src) ? 'a imagem não carregou' : 'sem internet: a imagem não carregou')), { once: true });
  return img;
}

/** Um quadrinho de imagem: foto, título e etiquetas. packNames lista os pacotes que aparecem como etiqueta. */
function imageTile(m, { selected, onToggle, href = `#/modelos/${m.id}`, extra, packNames = {} } = {}) {
  const external = !isLocalImage(m.block.src);
  const kws = m.tags.keywords || [];
  // sem etiquetas livres: mostra os conteúdos; sem nada, um aviso (é pelas etiquetas que se acha a imagem depois)
  const tags = kws.length
    ? kws.slice(0, 5).map((k) => h('span.chip.kw', k))
    : m.tags.content.length
      ? m.tags.content.slice(0, 3).map((c) => h('span.chip', c))
      : [h('span.chip.no-tags', { title: 'Abra a imagem e escreva as etiquetas (ex.: animal, dog, brown)' }, 'sem etiquetas')];
  return h('div.img-tile', { class: selected ? 'selected' : '' },
    onToggle ? h('label.img-check', { title: 'Selecionar' },
      h('input', { type: 'checkbox', checked: !!selected, 'aria-label': `Selecionar ${m.title}`, onChange: (e) => onToggle(e.target.checked) })) : null,
    h('a.img-link', { href },
      h('div.img-thumb', thumbImg(m.block.src),
        external ? h('span.img-web', { title: 'Esta imagem está na internet: sem internet, ela não aparece' }, 'na internet') : null),
      h('strong.img-title', m.title)),
    h('div.img-tags',
      tags,
      (m.packs || []).map((p) => (packNames[p] ? h('span.chip.pack', svgIcon(ICONS.layers, 12), packNames[p]) : null))),
    extra || null);
}

function packCard(p) {
  return h('a.pack-card', { href: `#/imagens/pacote/${p.id}` },
    h('div.pack-cover', { class: `n${Math.min(4, p.cover.length)}` },
      p.cover.length ? p.cover.map((src) => thumbImg(src)) : h('span.muted', 'vazio')),
    h('div.pack-info',
      h('strong', p.name),
      h('span.muted', `${p.count} ${p.count === 1 ? 'imagem' : 'imagens'}`),
      p.keywords.length ? h('div.img-tags', p.keywords.slice(0, 4).map((k) => h('span.chip.kw', k))) : null));
}

/** Janela: criar um pacote. */
export function newPackDialog({ afterCreate } = {}) {
  const name = h('input', { type: 'text', required: true, maxlength: '80', placeholder: 'Ex.: Animals' });
  const kws = h('input', { type: 'text', placeholder: 'Ex.: animals, nature' });
  const desc = h('input', { type: 'text', maxlength: '500', placeholder: 'Ex.: fotos de animais para vocabulário e descrição' });
  modal({
    title: 'Novo pacote',
    submitLabel: 'Criar pacote',
    body: [
      field('Nome do pacote', name, 'Um tema que junta imagens: Animals, Means of transport, Food, Jobs…'),
      field('Etiquetas do pacote', kws, 'Separadas por vírgula. Entram sozinhas nas imagens que você enviar para o pacote.'),
      field('Descrição (opcional)', desc),
    ],
    onSubmit: async () => {
      const p = await api.createPack({ name: name.value, keywords: splitKeywords(kws.value), description: desc.value });
      afterCreate ? afterCreate(p) : (location.hash = `#/imagens/pacote/${p.id}`);
    },
  });
}

/** Janela: escolher um pacote (ou criar um) para pôr as imagens selecionadas. */
function addToPackDialog(packs, modelIds, after) {
  const select = h('select', {},
    packs.map((p) => h('option', { value: p.id }, `${p.name} (${p.count})`)),
    h('option', { value: '__new' }, '+ Novo pacote…'));
  const newName = h('input', { type: 'text', maxlength: '80', placeholder: 'Nome do pacote novo' });
  const newRow = field('Nome do pacote novo', newName);
  newRow.hidden = packs.length > 0;
  if (!packs.length) select.value = '__new';
  select.addEventListener('change', () => { newRow.hidden = select.value !== '__new'; if (!newRow.hidden) newName.focus(); });
  modal({
    title: `Pôr ${modelIds.length} ${modelIds.length === 1 ? 'imagem' : 'imagens'} num pacote`,
    submitLabel: 'Pôr no pacote',
    body: [field('Pacote', select), newRow, h('p.muted.small', 'Uma imagem pode estar em vários pacotes. Ela continua no acervo.')],
    onSubmit: async () => {
      let id = select.value;
      if (id === '__new') id = (await api.createPack({ name: newName.value })).id;
      const out = await api.addToPack(id, modelIds);
      toast(`${out.added} ${out.added === 1 ? 'imagem entrou' : 'imagens entraram'} em "${out.pack.name}".`);
      after?.(out.pack);
    },
  });
}

/** Janela: acrescentar etiquetas a várias imagens de uma vez. */
function addKeywordsDialog(models, after) {
  const input = h('input', { type: 'text', required: true, placeholder: 'Ex.: animals, wild' });
  modal({
    title: `Etiquetas para ${models.length} ${models.length === 1 ? 'imagem' : 'imagens'}`,
    submitLabel: 'Acrescentar',
    body: [field('Etiquetas', input, 'Separadas por vírgula. As etiquetas que as imagens já têm ficam.')],
    onSubmit: async () => {
      const add = splitKeywords(input.value);
      if (!add.length) throw new Error('Escreva pelo menos uma etiqueta.');
      for (const m of models) {
        const keywords = [...new Set([...(m.tags.keywords || []), ...add])];
        Object.assign(m, await api.saveModel(m.id, { tags: { ...m.tags, keywords } }));
      }
      toast('Etiquetas acrescentadas.');
      after?.();
    },
  });
}

/** Guarda no computador as imagens que estão na internet. */
async function localizeAll(models, statusEl) {
  let done = 0, failed = 0;
  for (const m of models) {
    if (statusEl) statusEl.textContent = `Guardando ${done + failed + 1} de ${models.length}…`;
    try { m.block.src = await localizeImage(m.block.src); done++; } catch { failed++; }
  }
  toast(failed ? `${done} guardadas; ${failed} não deram certo (sem internet ou o site recusou).` : `${done} ${done === 1 ? 'imagem guardada' : 'imagens guardadas'} no computador.`);
}

// ======================================================================================
// O acervo
// ======================================================================================
export async function renderImages(root) {
  document.title = 'Imagens · TalkBox';
  const { query } = parseHash();
  const [models, packs] = await Promise.all([api.models(), api.packs()]);
  const images = imagesOf(models);
  const packNames = Object.fromEntries(packs.map((p) => [p.id, p.name]));
  const lacks = query.getAll('sem');
  const f = { q: query.get('q') || '', kw: query.getAll('etiqueta'), noPack: lacks.includes('pacote'), noTags: lacks.includes('etiquetas') };
  const selected = new Set();

  const syncUrl = () => {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    f.kw.forEach((k) => p.append('etiqueta', k));
    if (f.noPack) p.append('sem', 'pacote');
    if (f.noTags) p.append('sem', 'etiquetas');
    history.replaceState(null, '', '#/imagens' + (p.toString() ? '?' + p : ''));
  };

  const grid = h('div.img-grid');
  const info = h('span.muted', { role: 'status' });
  const bar = h('div.select-bar', { hidden: true });
  const external = images.filter((m) => !isLocalImage(m.block.src));

  const visible = () => images.filter((m) =>
    matchImage(m, f.q, packNames) &&
    (!f.kw.length || f.kw.every((k) => (m.tags.keywords || []).includes(k))) &&
    (!f.noPack || !(m.packs || []).length) &&
    (!f.noTags || !(m.tags.keywords || []).length));

  function paintBar() {
    bar.hidden = !selected.size;
    if (!selected.size) return;
    const chosen = images.filter((m) => selected.has(m.id));
    const ext = chosen.filter((m) => !isLocalImage(m.block.src));
    const st = h('span.muted.small');
    bar.replaceChildren(
      h('strong', `${selected.size} ${selected.size === 1 ? 'selecionada' : 'selecionadas'}`),
      h('button.btn.small.primary', { type: 'button', onClick: () => addToPackDialog(packs, [...selected], () => reload()) }, svgIcon(ICONS.layers, 16), 'Pôr num pacote'),
      h('button.btn.small', { type: 'button', onClick: () => addKeywordsDialog(chosen, () => { paint(); }) }, 'Acrescentar etiquetas'),
      ext.length ? h('button.btn.small', { type: 'button', onClick: async () => { await localizeAll(ext, st); reload(); } }, `Guardar no computador (${ext.length})`) : null,
      st,
      h('button.link-btn', { type: 'button', onClick: () => { selected.clear(); paint(); } }, 'Limpar seleção'));
  }

  function paint() {
    syncUrl();
    const list = visible();
    info.textContent = list.length === images.length ? `${images.length} ${images.length === 1 ? 'imagem' : 'imagens'}` : `${list.length} de ${images.length} imagens`;
    grid.replaceChildren(
      ...(list.length
        ? list.map((m) => imageTile(m, { packNames, selected: selected.has(m.id), onToggle: (on) => { on ? selected.add(m.id) : selected.delete(m.id); paint(); } }))
        : [emptyState(images.length ? 'Nenhuma imagem com essa busca.' : 'O acervo ainda está vazio.',
            images.length ? 'Tente outra palavra ou tire um filtro.' : 'Envie as primeiras imagens: dá para mandar várias de uma vez.',
            images.length ? null : h('a.btn.primary', { href: '#/imagens/enviar' }, 'Enviar imagens'))]));
    paintBar();
  }
  const reload = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

  const search = h('input.search', { type: 'search', value: f.q, placeholder: 'Buscar: car, blue, animal, Rio…', 'aria-label': 'Buscar imagens', onInput: (e) => { f.q = e.target.value; paint(); } });
  const topKeywords = keywordUniverse(images).slice(0, 18);
  const kwChips = topKeywords.length
    ? toggleChips({ label: 'Etiquetas', options: topKeywords, value: f.kw, onChange: (v) => { f.kw = v; paint(); } })
    : null;
  // o que ainda falta organizar: imagens fora de pacote e imagens sem etiqueta
  const unpacked = images.filter((m) => !(m.packs || []).length).length;
  const untagged = images.filter((m) => !(m.tags.keywords || []).length).length;
  const lackChips = images.length
    ? toggleChips({
        label: 'Falta organizar',
        options: [{ value: 'pacote', label: 'Sem pacote' }, { value: 'etiquetas', label: 'Sem etiquetas' }],
        counts: { pacote: unpacked, etiquetas: untagged },
        value: [...(f.noPack ? ['pacote'] : []), ...(f.noTags ? ['etiquetas'] : [])],
        onChange: (v) => { f.noPack = v.includes('pacote'); f.noTags = v.includes('etiquetas'); paint(); },
      })
    : null;

  const extStatus = h('span.muted.small');
  const extBanner = external.length
    ? h('div.ext-banner',
        h('div', h('strong', `${external.length} ${external.length === 1 ? 'imagem está' : 'imagens estão'} na internet`),
          h('p.small', 'Sem internet, elas não aparecem na aula. Guarde no computador: as aulas que já usam essas imagens também são atualizadas.')),
        h('button.btn.small', { type: 'button', onClick: async (e) => { e.currentTarget.disabled = true; await localizeAll(external, extStatus); reload(); } }, 'Guardar todas no computador'),
        extStatus)
    : null;

  root.replaceChildren(
    appShell('images',
      h('div.page.page-wide',
        pageHead({
          title: 'Imagens',
          subtitle: 'O acervo de fotos e ilustrações. Junte as do mesmo tema num pacote (ex.: Animals) e use nas aulas: uma imagem, várias, ou o pacote inteiro como galeria.',
          actions: [
            h('a.btn.primary', { href: '#/imagens/enviar' }, svgIcon(ICONS.plus), 'Enviar imagens'),
            h('button.btn', { type: 'button', onClick: () => newPackDialog() }, svgIcon(ICONS.layers), 'Novo pacote'),
          ],
        }),
        extBanner,
        h('section.packs-section',
          h('div.section-head', h('h2', 'Pacotes'), h('span.muted', packs.length ? `${packs.length} ${packs.length === 1 ? 'pacote' : 'pacotes'}` : '')),
          h('div.pack-grid',
            packs.map(packCard),
            h('button.pack-card.new', { type: 'button', onClick: () => newPackDialog() },
              h('div.pack-cover', svgIcon(ICONS.plus, 28)),
              h('div.pack-info', h('strong', 'Novo pacote'), h('span.muted', 'Animals, Food, Jobs…'))))),
        h('section.all-images',
          h('div.section-head', h('h2', 'Todas as imagens'), info),
          h('div.img-filters', search, kwChips, lackChips),
          bar,
          grid))));
  paint();
  return () => {};
}

// ======================================================================================
// Um pacote
// ======================================================================================
export async function renderPack(root, id) {
  let pack;
  try {
    pack = await api.pack(id);
  } catch {
    root.replaceChildren(appShell('images', h('div.page', emptyState('Pacote não encontrado.', null, h('a.btn', { href: '#/imagens' }, 'Voltar para Imagens')))));
    return () => {};
  }
  document.title = `${pack.name} · Imagens · TalkBox`;
  const packs = await api.packs();
  // nos quadrinhos aparecem só os OUTROS pacotes de cada imagem (este é óbvio)
  const packNames = Object.fromEntries(packs.filter((p) => p.id !== id).map((p) => [p.id, p.name]));
  const status = h('span.save-status', { role: 'status', 'aria-live': 'polite' }, 'Salvo');
  const saver = autosaver({ save: (body) => api.savePack(id, body), statusEl: status });
  const reload = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  const selected = new Set();

  const name = h('input.model-title', { type: 'text', value: pack.name, maxlength: '80', 'aria-label': 'Nome do pacote', onInput: (e) => e.target.value.trim() && saver.queue({ name: e.target.value }) });
  const desc = h('input.pack-desc', { type: 'text', value: pack.description, maxlength: '500', placeholder: 'Descrição (opcional): para que serve este pacote', 'aria-label': 'Descrição', onInput: (e) => saver.queue({ description: e.target.value }) });
  const kws = h('input', { type: 'text', value: pack.keywords.join(', '), placeholder: 'animals, nature', onInput: (e) => saver.queue({ keywords: splitKeywords(e.target.value) }) });

  const grid = h('div.img-grid');
  const bar = h('div.select-bar', { hidden: true });
  function paint() {
    bar.hidden = !selected.size;
    bar.replaceChildren(
      h('strong', `${selected.size} ${selected.size === 1 ? 'selecionada' : 'selecionadas'}`),
      h('button.btn.small', { type: 'button', onClick: async () => { await api.removeFromPack(id, [...selected]); toast('Saíram do pacote. Elas continuam no acervo.'); reload(); } }, 'Tirar do pacote'),
      h('button.btn.small', { type: 'button', onClick: () => addToPackDialog(packs.filter((p) => p.id !== id), [...selected], () => reload()) }, 'Pôr em outro pacote'),
      h('button.link-btn', { type: 'button', onClick: () => { selected.clear(); paint(); } }, 'Limpar seleção'));
    grid.replaceChildren(
      ...(pack.items.length
        ? pack.items.map((m) => imageTile(m, {
            packNames,
            selected: selected.has(m.id),
            onToggle: (on) => { on ? selected.add(m.id) : selected.delete(m.id); paint(); },
            extra: h('button.img-remove', { type: 'button', title: 'Tirar do pacote (continua no acervo)', 'aria-label': `Tirar ${m.title} do pacote`,
              onClick: async () => { await api.removeFromPack(id, [m.id]); pack.items = pack.items.filter((x) => x.id !== m.id); selected.delete(m.id); paint(); toast(`"${m.title}" saiu do pacote.`); } }, svgIcon(ICONS.x, 14)),
          }))
        : [emptyState('Este pacote ainda está vazio.', 'Envie imagens novas para ele ou ponha imagens que já estão no acervo.')]));
  }

  root.replaceChildren(
    appShell('images',
      h('div.page.page-wide',
        h('header.page-head',
          h('div.page-title',
            h('a.back-link', { href: '#/imagens' }, svgIcon(ICONS.back, 16), 'Imagens'),
            name,
            h('div.stripe', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
            desc,
            h('div.pack-meta',
              h('label.pack-kw', h('span.field-label', 'Etiquetas do pacote'), kws),
              h('span.muted', `${pack.count} ${pack.count === 1 ? 'imagem' : 'imagens'}`), status)),
          h('div.page-actions',
            h('a.btn.primary', { href: `#/imagens/enviar?pacote=${id}` }, svgIcon(ICONS.plus), 'Enviar imagens para cá'),
            h('button.btn', {
              type: 'button',
              onClick: () => openImagePicker({
                title: `Pôr em "${pack.name}"`,
                confirmLabel: 'Pôr no pacote',
                exclude: pack.items.map((m) => m.id),
                gallery: false,
                onPick: async (chosen) => { const out = await api.addToPack(id, chosen.map((m) => m.id)); toast(`${out.added} ${out.added === 1 ? 'imagem entrou' : 'imagens entraram'} no pacote.`); reload(); },
              }),
            }, 'Pôr imagens do acervo'),
            h('button.btn', {
              type: 'button',
              onClick: async () => {
                if (!(await confirmDialog(`O pacote "${pack.name}" some da lista. As ${pack.count} imagens continuam no acervo e nos outros pacotes.`, { title: 'Arquivar pacote?', confirmLabel: 'Arquivar pacote' }))) return;
                saver.cancel();
                await api.deletePack(id);
                toast('Pacote arquivado. As imagens continuam no acervo.');
                location.hash = '#/imagens';
              },
            }, svgIcon(ICONS.archive), 'Arquivar'))),
        h('p.muted.small', 'Na aula: + Inserir bloco → "Imagens do acervo…" → escolha o pacote → "Inserir como galeria".'),
        bar,
        grid)));
  paint();
  return () => saver.flush();
}

// ======================================================================================
// Enviar imagens
// ======================================================================================
export async function renderUpload(root) {
  document.title = 'Enviar imagens · TalkBox';
  const { query } = parseHash();
  const [packs, models] = await Promise.all([api.packs(), api.models()]);
  const known = keywordUniverse(imagesOf(models)).slice(0, 80);
  const items = []; // { key, file, url, title, keywords, state, error }
  const shared = { keywords: [], content: [], levels: [] };
  let busy = false;

  // ---------- pacote ----------
  const packSelect = h('select', { 'aria-label': 'Pacote' },
    h('option', { value: '' }, 'Nenhum (só no acervo)'),
    packs.map((p) => h('option', { value: p.id }, `${p.name} (${p.count})`)),
    h('option', { value: '__new' }, '+ Criar um pacote novo…'));
  const packFromUrl = packs.find((p) => p.id === query.get('pacote'));
  if (packFromUrl) packSelect.value = packFromUrl.id;
  const newPackName = h('input', { type: 'text', maxlength: '80', placeholder: 'Ex.: Animals' });
  const newPackRow = field('Nome do pacote novo', newPackName, 'O pacote só é criado quando você clicar em "Fazer upload".');
  newPackRow.hidden = true;
  const sharedKw = h('input', { type: 'text', list: 'kw-upload', autocomplete: 'off', placeholder: 'Ex.: animals', onInput: (e) => { shared.keywords = splitKeywords(e.target.value); } });
  const fillPackKeywords = () => {
    const p = packs.find((x) => x.id === packSelect.value);
    if (p && !sharedKw.value.trim()) { sharedKw.value = p.keywords.join(', '); shared.keywords = [...p.keywords]; }
  };
  packSelect.addEventListener('change', () => {
    newPackRow.hidden = packSelect.value !== '__new';
    if (!newPackRow.hidden) newPackName.focus();
    fillPackKeywords();
  });
  fillPackKeywords();

  // ---------- arquivos ----------
  const list = h('div.up-list');
  const submit = h('button.btn.primary', { type: 'button', disabled: true, onClick: () => send() }, 'Fazer upload');
  const progress = h('span.muted', { role: 'status' });
  const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onChange: (e) => { addFiles(e.target.files); e.target.value = ''; } });
  const drop = h('div.dropzone.up-drop', {
    role: 'button', tabindex: '0',
    onClick: () => fileInput.click(),
    onKeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInput.click()),
    onDragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('over'); },
    onDragleave: (e) => e.currentTarget.classList.remove('over'),
    onDrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove('over'); addFiles(e.dataTransfer.files); },
  }, svgIcon(ICONS.image, 30), h('b', 'Arraste as imagens aqui'), h('span', 'ou cole com Ctrl+V, ou clique para escolher. Dá para mandar várias de uma vez.'), fileInput);

  function addFiles(files) {
    for (const file of [...(files || [])]) {
      if (!file.type.startsWith('image/')) continue;
      items.push({ key: uid('u'), file, url: URL.createObjectURL(file), title: titleFromFile(file.name), keywords: '', state: 'ready' });
    }
    paint();
    list.querySelector('.up-card:not(.done) input.invalid, .up-card:not(.done) input[data-empty="1"]')?.focus();
  }
  const onPaste = (e) => {
    const files = [...(e.clipboardData?.items || [])].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean);
    if (!files.length) return;
    e.preventDefault();
    addFiles(files);
  };
  document.addEventListener('paste', onPaste);

  function paint() {
    const pending = items.filter((it) => it.state !== 'done');
    submit.disabled = busy || !pending.length;
    submit.textContent = pending.length > 1 ? `Fazer upload de ${pending.length} imagens` : 'Fazer upload';
    list.replaceChildren(...items.map((it) => {
      const title = h('input', {
        type: 'text', value: it.title, maxlength: '200', placeholder: 'Título (obrigatório): ex.: Blue Beetle on the street',
        'aria-label': 'Título da imagem', disabled: it.state === 'done' || busy, dataset: { empty: it.title ? '0' : '1' },
        class: it.error === 'title' ? 'invalid' : '',
        onInput: (e) => { it.title = e.target.value; e.target.classList.remove('invalid'); if (it.error === 'title') it.error = null; },
      });
      const kw = h('input', {
        type: 'text', value: it.keywords, list: 'kw-upload', autocomplete: 'off', placeholder: 'Etiquetas: car, blue, street',
        'aria-label': 'Etiquetas da imagem', disabled: it.state === 'done' || busy,
        onInput: (e) => { it.keywords = e.target.value; },
      });
      return h('div.up-card', { class: it.state },
        h('div.up-thumb', h('img', { src: it.url, alt: '' })),
        h('div.up-fields', title, kw,
          it.state === 'done' ? h('span.up-ok', svgIcon(ICONS.check, 15), 'No acervo') : null,
          it.state === 'sending' ? h('span.muted.small', 'Enviando…') : null,
          it.error && it.error !== 'title' ? h('span.up-err', it.error) : null),
        it.state === 'done' || busy ? null : h('button.icon-btn', { type: 'button', title: 'Tirar da lista', 'aria-label': 'Tirar da lista', onClick: () => { URL.revokeObjectURL(it.url); items.splice(items.indexOf(it), 1); paint(); } }, svgIcon(ICONS.x, 16)));
    }));
    list.hidden = !items.length;
  }

  async function send() {
    const todo = items.filter((it) => it.state !== 'done');
    let missing = false;
    for (const it of todo) if (!it.title.trim()) { it.error = 'title'; missing = true; }
    if (missing) { paint(); toast('Dê um título para cada imagem (é por ele e pelas etiquetas que você acha depois).'); list.querySelector('input.invalid')?.focus(); return; }
    if (packSelect.value === '__new' && !newPackName.value.trim()) { newPackName.focus(); toast('Dê um nome ao pacote novo.'); return; }
    busy = true;
    paint();
    let packId = packSelect.value;
    try {
      if (packId === '__new') {
        const p = await api.createPack({ name: newPackName.value, keywords: shared.keywords });
        packId = p.id;
        packs.push(p);
        packSelect.insertBefore(h('option', { value: p.id }, p.name), packSelect.lastChild);
        packSelect.value = p.id;
        newPackRow.hidden = true;
      }
      let n = 0;
      for (const it of todo) {
        progress.textContent = `Enviando ${++n} de ${todo.length}…`;
        it.state = 'sending';
        paint();
        try {
          const src = await uploadImage(it.file);
          await api.createModel({
            title: it.title.trim(),
            type: 'image',
            block: { type: 'image', src, caption: '', layout: 'full' },
            tags: { content: shared.content, levels: shared.levels, skills: ['Fala'], keywords: [...shared.keywords, ...splitKeywords(it.keywords)] },
            packIds: packId ? [packId] : [],
          });
          it.state = 'done';
          it.error = null;
        } catch (err) {
          it.state = 'ready';
          it.error = 'Não deu certo: ' + err.message;
          throw err;
        }
      }
      progress.textContent = '';
      toast(`${todo.length} ${todo.length === 1 ? 'imagem entrou' : 'imagens entraram'} no acervo.`);
      items.forEach((it) => URL.revokeObjectURL(it.url));
      location.hash = packId ? `#/imagens/pacote/${packId}` : '#/imagens';
    } catch (err) {
      progress.textContent = '';
      toast(err.message);
    } finally {
      busy = false;
      paint();
    }
  }

  const levels = toggleChips({ label: 'Nível', options: LEVELS, onChange: (v) => (shared.levels = v) });
  const content = tagInput({ value: [], suggestions: CONTENT_SUGGESTIONS, normalize: canonicalContent, label: 'Conteúdo', placeholder: 'Ex.: Present Continuous (Enter)', onChange: (v) => (shared.content = v) });

  root.replaceChildren(
    appShell('images',
      h('div.page.page-wide',
        pageHead({
          title: 'Enviar imagens',
          subtitle: 'Escolha as imagens, dê um título a cada uma e as etiquetas. Nada vai para o acervo antes de você clicar em "Fazer upload".',
          back: { href: packFromUrl ? `#/imagens/pacote/${packFromUrl.id}` : '#/imagens', label: packFromUrl ? packFromUrl.name : 'Imagens' },
        }),
        h('div.up-layout',
          h('section.up-main', drop, list),
          h('aside.up-side',
            h('section.side-card',
              h('h2', 'Para todas as imagens'),
              field('Pacote', packSelect, 'Junte imagens do mesmo tema: Animals, Food, Jobs…'),
              newPackRow,
              field('Etiquetas para todas', sharedKw, 'Separadas por vírgula. Cada imagem pode ter as suas também.'),
              h('details.more-tags',
                h('summary', 'Nível e conteúdo (opcional)'),
                h('div.field', h('span.field-label', 'Nível'), levels),
                h('div.field', h('span.field-label', 'Conteúdo'), content))),
            h('section.side-card.tips',
              h('h2', 'Como etiquetar'),
              h('p.small', 'Pense: "que palavra eu digitaria para achar esta foto?". Do geral para o específico, em inglês, uma ideia por etiqueta:'),
              h('ul.small',
                h('li', h('b', 'a categoria: '), 'means of transport, animal, food, job'),
                h('li', h('b', 'a coisa: '), 'car, beetle (fusca), dog'),
                h('li', h('b', 'como é: '), 'blue, old, big, funny'),
                h('li', h('b', 'onde está: '), 'street, beach, kitchen')),
              h('p.small.muted', 'Fusca azul na rua → means of transport, car, beetle, blue, old, street. O tema maior (Animals) vira pacote.')),
            h('div.up-actions', progress, h('a.btn', { href: packFromUrl ? `#/imagens/pacote/${packFromUrl.id}` : '#/imagens' }, 'Cancelar'), submit))),
        h('datalist', { id: 'kw-upload' }, known.map((k) => h('option', { value: k }))))));
  paint();
  return () => { document.removeEventListener('paste', onPaste); if (!busy) items.forEach((it) => URL.revokeObjectURL(it.url)); };
}

// ======================================================================================
// Painel "Imagens do acervo" (na aula e no pacote)
// ======================================================================================
/**
 * openImagePicker({ multiple, onPick(models, { asGallery }), exclude, title, confirmLabel, gallery })
 * Na aula: várias imagens entram como galeria (grade) ou uma em cada bloco.
 */
export async function openImagePicker({ multiple = true, onPick, exclude = [], title = 'Imagens do acervo', confirmLabel = 'Inserir', gallery = true }) {
  document.querySelector('.drawer-bg')?.remove();
  const restore = document.activeElement;
  const [models, packs] = await Promise.all([api.models(), api.packs()]);
  const skip = new Set(exclude);
  const images = imagesOf(models).filter((m) => !skip.has(m.id));
  const packNames = Object.fromEntries(packs.map((p) => [p.id, p.name]));
  const f = { q: '', pack: '' };
  const picked = new Map();

  const grid = h('div.pick-grid');
  const count = h('span.muted');
  const allBtn = h('button.link-btn', { type: 'button', onClick: () => { const vis = visible(); const all = vis.every((m) => picked.has(m.id)); vis.forEach((m) => (all ? picked.delete(m.id) : picked.set(m.id, m))); paint(); } });
  const asOne = h('button.btn', { type: 'button', onClick: () => done(false) }, 'Uma em cada bloco');
  const asGallery = h('button.btn.primary', { type: 'button', onClick: () => done(true) }, 'Inserir como galeria');
  const single = h('button.btn.primary', { type: 'button', onClick: () => done(false) }, confirmLabel);

  const visible = () => images.filter((m) => matchImage(m, f.q, packNames) && (!f.pack || (m.packs || []).includes(f.pack)))
    .sort((a, b) => (f.pack ? 0 : a.title.localeCompare(b.title)));

  function paint() {
    const vis = visible();
    grid.replaceChildren(...(vis.length
      ? vis.map((m) => h('button.pick-img', {
          type: 'button',
          class: picked.has(m.id) ? 'on' : '',
          'aria-pressed': String(picked.has(m.id)),
          title: [m.title, ...(m.tags.keywords || [])].join(' · '),
          onClick: () => {
            if (!multiple) return done(false, [m]);
            picked.has(m.id) ? picked.delete(m.id) : picked.set(m.id, m);
            paint();
          },
        }, thumbImg(m.block.src), h('span', m.title), picked.has(m.id) ? h('span.pick-mark', svgIcon(ICONS.check, 14)) : null))
      : [emptyState(images.length ? 'Nada encontrado.' : 'O acervo está vazio.', images.length ? 'Tente outra palavra ou outro pacote.' : 'Envie imagens em Imagens → Enviar imagens.')]));
    const n = picked.size;
    count.textContent = n ? `${n} ${n === 1 ? 'selecionada' : 'selecionadas'}` : `${vis.length} ${vis.length === 1 ? 'imagem' : 'imagens'}`;
    allBtn.hidden = !multiple || !vis.length;
    allBtn.textContent = vis.length && vis.every((m) => picked.has(m.id)) ? 'Tirar a seleção' : `Selecionar ${f.pack ? 'o pacote inteiro' : 'todas'} (${vis.length})`;
    const useGallery = gallery && multiple;
    asOne.hidden = !useGallery || n < 2;
    asGallery.hidden = !useGallery || n < 2;
    single.hidden = !multiple || (useGallery && n >= 2);
    single.disabled = !n;
    single.textContent = n > 1 ? `${confirmLabel} ${n}` : confirmLabel;
  }

  const packChips = h('div.toggle-chips', { role: 'group', 'aria-label': 'Pacote' });
  const paintPacks = () => packChips.replaceChildren(
    ...[{ id: '', name: 'Todas' }, ...packs].map((p) =>
      h('button.tchip', { type: 'button', class: f.pack === p.id ? 'on' : '', 'aria-pressed': String(f.pack === p.id), onClick: () => { f.pack = p.id; paintPacks(); paint(); } },
        p.id ? svgIcon(ICONS.layers, 14) : null, p.name, p.id ? h('span.count', String(p.count)) : null)));
  paintPacks();

  const search = h('input.search', { type: 'search', placeholder: 'Buscar: dog, blue, beach…', 'aria-label': 'Buscar imagens', onInput: (e) => { f.q = e.target.value; paint(); } });
  const drawer = h('aside.drawer.wide', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div.drawer-head', h('h2', svgIcon(ICONS.image, 20), title), h('button.icon-btn', { type: 'button', 'aria-label': 'Fechar', onClick: () => close() }, svgIcon(ICONS.x))),
    h('div.drawer-filters', search, packs.length ? packChips : null, allBtn),
    h('div.drawer-list', grid),
    h('div.drawer-foot', count, multiple ? [asOne, asGallery, single] : h('span.muted.small', 'Clique na imagem para inserir')));
  const bg = h('div.drawer-bg', { onMousedown: (e) => e.target === bg && close() }, drawer);
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  function close() {
    bg.remove();
    document.removeEventListener('keydown', onKey, true);
    restore?.focus?.();
  }
  function done(asGalleryBlock, chosen = [...picked.values()]) {
    if (!chosen.length) return;
    close();
    onPick(chosen, { asGallery: asGalleryBlock });
  }
  document.addEventListener('keydown', onKey, true);
  document.body.append(bg);
  paint();
  search.focus();
}
