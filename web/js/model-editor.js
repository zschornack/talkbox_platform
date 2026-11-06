// Editar um modelo: o mesmo editor da aula, com as etiquetas ao lado (requisitos 7.3).
// Modelo novo (#/modelos/novo/<formato>): nada é salvo até clicar em "Salvar modelo". Antes disso não há
// uso nem histórico de versões para mostrar; no lugar, aparece como o formato funciona.
// Modelo que já existe: salva sozinho, como a aula.
import { h, svgIcon, ICONS, dateTime, formatDate, parseHash, brandMark, uid } from './dom.js';
import { api, autosaver, saveOnExit, isLocalImage, localizeImage } from './api.js';
import { mountBlock } from './block-view.js';
import { mountFormatBar } from './format-bar.js';
import { LEVELS, SKILLS, canonicalContent } from './catalog.js';
import { toggleChips, tagInput, confirmDialog, toast, emptyState } from './ui.js';
import { formatBadge, contentUniverse, DEFAULT_SKILLS, keywordsField } from './models.js';
import { BLOCKS } from './blocks/index.js';
import { GUIDE, EXAMPLES } from './blocks/examples.js';
import { toMaterialColors } from './marks.js';
import { openImagePicker } from './images.js';

/** Rascunho de um modelo novo: em branco ou a partir de um exemplo da galeria. */
function draftModel(type) {
  const n = Number(parseHash().query.get('exemplo')) || 0;
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('talkbox:draft') || 'null'); sessionStorage.removeItem('talkbox:draft'); } catch {}
  const ex = n ? EXAMPLES[type]?.[n - 1] : null;
  const fromGallery = n && saved?.type === type ? saved : null;
  const block = fromGallery?.block || (ex ? JSON.parse(JSON.stringify(ex.block)) : { type, ...BLOCKS[type].create() });
  const tags = fromGallery?.tags || ex?.tags || {};
  return {
    id: null,
    title: fromGallery?.title || ex?.title || '',
    type,
    block: { ...block, id: uid(), type },
    tags: { content: [...(tags.content || [])], levels: [...(tags.levels || [])], skills: [...(tags.skills || DEFAULT_SKILLS[type] || [])], keywords: [...(tags.keywords || [])] },
    status: 'published',
    uses: 0,
    versions: [],
    packs: [],
  };
}

export async function renderModelEditor(root, id, { draft } = {}) {
  let m;
  if (draft) {
    if (!BLOCKS[draft] || draft === 'notes') { location.hash = '#/modelos/novo'; return () => {}; }
    if (draft === 'image') { location.replace('#/imagens/enviar'); return () => {}; }
    m = draftModel(draft);
  } else {
    try {
      m = await api.model(id);
    } catch {
      root.replaceChildren(h('div.page', emptyState('Modelo não encontrado.', null, h('a.btn', { href: '#/modelos' }, 'Voltar para Modelos'))));
      return () => {};
    }
  }
  const isDraft = !m.id;
  const [all, packs] = await Promise.all([api.models().catch(() => []), m.type === 'image' && !isDraft ? api.packs().catch(() => []) : []]);
  document.title = `${isDraft ? 'Novo modelo' : m.title} · Modelos · TalkBox`;

  const block = m.block;
  block.type = m.type;
  const tags = m.tags;
  tags.keywords ||= [];
  const status = h('span.save-status', { role: 'status', 'aria-live': 'polite' }, isDraft ? 'Ainda não salvo' : 'Salvo');
  let dirty = false;
  const saver = isDraft ? null : autosaver({ save: (body) => api.saveModel(id, body), statusEl: status });
  // no modelo, o que se destaca é material: as cores ficam em #RRGGBB (a cópia de uma aula sabe separar)
  const save = () => {
    toMaterialColors(block);
    if (isDraft) { dirty = true; status.textContent = 'Ainda não salvo'; return; }
    saver.queue({ title: titleInput.value.trim() || 'Sem título', block, tags });
  };

  // ---------- nome ----------
  const titleInput = h('input.model-title', {
    type: 'text',
    value: m.title,
    placeholder: isDraft ? 'Dê um nome ao modelo' : 'Nome do modelo',
    'aria-label': 'Nome do modelo',
    maxlength: '200',
    onInput: (e) => { document.title = `${e.target.value || 'Sem título'} · Modelos · TalkBox`; e.target.classList.remove('invalid'); save(); },
  });

  // ---------- o bloco, com tudo funcionando (dá para testar o exercício aqui) ----------
  const paper = h('div.paper.model-paper', { style: { '--lesson-size': '20px' } },
    mountBlock(block, {
      changed: save,
      local: { panel: ['fill', 'deck', 'challenge'].includes(m.type) },
      // a galeria escolhe imagens do acervo (a imagem sozinha já é o acervo)
      pickImage: m.type === 'gallery' ? (opts) => openImagePicker(opts) : undefined,
    }));

  // ---------- importado: a revisar ----------
  const reviewCard = h('section.side-card.review-card');
  function paintReview() {
    if (m.status !== 'review') return reviewCard.remove();
    const noContent = !tags.content.length && !tags.keywords.length;
    reviewCard.replaceChildren(
      h('h2', 'A revisar'),
      h('p.small', 'Este item veio de uma importação. Confira o texto e as etiquetas e aprove para ele entrar na biblioteca.'),
      noContent ? h('p.small.warn', 'Falta a etiqueta de conteúdo.') : null,
      h('button.btn.primary', {
        type: 'button',
        onClick: async () => {
          await saver.flush();
          m = await api.approveModel(id);
          paintReview();
          toast('Aprovado: já está na biblioteca.');
        },
      }, svgIcon(ICONS.check), 'Aprovar'));
  }

  // ---------- etiquetas ----------
  const tagsCard = h('section.side-card',
    h('h2', 'Etiquetas'),
    h('div.field', h('span.field-label', 'Formato'), formatBadge(m.type)),
    h('div.field', h('span.field-label', 'Conteúdo'),
      tagInput({ value: tags.content, suggestions: contentUniverse(all), label: 'Conteúdo', placeholder: 'Ex.: Past Simple (Enter)', normalize: canonicalContent, onChange: (v) => { tags.content = v; save(); paintReview(); } }),
      h('div.field-hint', 'Gramática ou tema da lista oficial. Sinônimos viram o nome oficial: "simple past" entra como Past Simple.')),
    keywordsField(tags, () => { save(); paintReview(); }, all),
    h('div.field', h('span.field-label', 'Nível'),
      toggleChips({ options: LEVELS, value: tags.levels, label: 'Nível', onChange: (v) => { tags.levels = v; save(); } })),
    h('div.field', h('span.field-label', 'Habilidade'),
      toggleChips({ options: SKILLS, value: tags.skills, label: 'Habilidade', onChange: (v) => { tags.skills = v; save(); } })));

  // ---------- imagem: pacotes e "guardar no computador" ----------
  const imageCard = m.type === 'image' && !isDraft ? h('section.side-card') : null;
  const memberOf = new Set(m.packs || []);
  function paintImageCard() {
    if (!imageCard) return;
    const external = block.src && !isLocalImage(block.src);
    imageCard.replaceChildren(
      h('h2', 'Pacotes'),
      packs.length
        ? h('div.pack-checks', packs.map((p) =>
            h('label.check-row', h('input', {
              type: 'checkbox',
              checked: memberOf.has(p.id),
              onChange: async (e) => {
                try {
                  if (e.target.checked) { await api.addToPack(p.id, [id]); memberOf.add(p.id); toast(`Entrou no pacote "${p.name}".`); }
                  else { await api.removeFromPack(p.id, [id]); memberOf.delete(p.id); toast(`Saiu do pacote "${p.name}". A imagem continua no acervo.`); }
                } catch (err) { e.target.checked = !e.target.checked; toast(err.message); }
              },
            }), p.name, h('span.muted.small', ` · ${p.count}`))))
        : h('p.muted.small', 'Nenhum pacote ainda. Crie um em Imagens (ex.: Animals) para juntar imagens do mesmo tema.'),
      h('a.link-btn', { href: '#/imagens' }, 'Ver todas as imagens e pacotes'),
      external
        ? h('div.ext-note',
            h('p.small', 'Esta imagem está na internet. Sem internet, ela não aparece na aula.'),
            h('button.btn.small', {
              type: 'button',
              onClick: async (e) => {
                e.currentTarget.disabled = true;
                try {
                  await saver.flush();
                  block.src = await localizeImage(block.src);
                  toast('Imagem guardada no computador. As aulas que já usavam esta imagem também foram atualizadas.');
                  window.dispatchEvent(new HashChangeEvent('hashchange'));
                } catch (err) { toast('Não consegui guardar: ' + err.message); e.currentTarget.disabled = false; }
              },
            }, 'Guardar no computador'))
        : null);
  }
  paintImageCard();

  // modelo novo: no lugar de "uso" e "versões", o guia do formato
  const guide = GUIDE[m.type];
  const sideInfo = isDraft
    ? [h('section.side-card.guide-card',
        h('h2', svgIcon(ICONS[m.type], 18), BLOCKS[m.type].name),
        guide ? h('p.small', guide.purpose) : null,
        guide ? h('ul.small', guide.how.map((x) => h('li', x))) : null,
        guide ? h('p.small.muted', guide.edit) : null)]
    : [
        h('section.side-card',
          h('h2', 'Uso'),
          h('p.stat', h('strong', String(m.uses)), m.uses === 1 ? ' aula usou este modelo' : ' aulas usaram este modelo'),
          h('p.muted.small', `Criado em ${formatDate(m.createdAt)}. As aulas apontam para este modelo: o que você mudar aqui aparece em todas elas.`)),
        m.versions.length
          ? h('section.side-card',
              h('h2', 'Histórico de versões'),
              h('ul.versions',
                m.versions.map((v) =>
                  h('li', h('span', h('strong', dateTime(v.savedAt)), h('span.muted', v.title)),
                    h('button.btn.small', {
                      type: 'button',
                      onClick: async () => {
                        if (!(await confirmDialog(`O modelo volta a ficar como estava em ${dateTime(v.savedAt)}. A versão de agora fica guardada no histórico.`, { title: 'Restaurar versão?', confirmLabel: 'Restaurar' }))) return;
                        await saver.flush();
                        await api.restoreModel(id, v.id);
                        toast('Versão restaurada.');
                        window.dispatchEvent(new HashChangeEvent('hashchange'));
                      },
                    }, 'Restaurar')))))
          : null,
      ];

  const side = h('aside.model-side', reviewCard, imageCard, tagsCard, sideInfo);

  // ---------- barra de cima ----------
  const leave = async (href) => {
    if (isDraft && dirty && !(await confirmDialog('O modelo novo ainda não foi salvo. Se sair agora, ele não entra na biblioteca.', { title: 'Sair sem salvar?', confirmLabel: 'Sair sem salvar' }))) return;
    dirty = false;
    location.hash = href;
  };
  const saveDraft = async (btn) => {
    const title = titleInput.value.trim();
    if (!title) {
      titleInput.classList.add('invalid');
      titleInput.focus();
      toast('Dê um nome ao modelo antes de salvar.');
      return;
    }
    btn.disabled = true;
    try {
      toMaterialColors(block);
      const saved = await api.createModel({ title, type: m.type, block, tags });
      dirty = false;
      location.replace(`#/modelos/${saved.id}`);
      toast('Modelo salvo na biblioteca.');
    } catch (err) {
      toast(err.message);
      btn.disabled = false;
    }
  };
  const backHref = isDraft ? `#/modelos/novo?formato=${m.type}` : '#/modelos';
  const top = h('div.editor-top',
    h('div.left',
      h('a.btn.icon', { href: backHref, title: isDraft ? 'Voltar para os formatos' : 'Voltar para Modelos', 'aria-label': 'Voltar',
        onClick: (e) => { if (isDraft) { e.preventDefault(); leave(backHref); } } }, svgIcon(ICONS.back)),
      brandMark(),
      h('span.crumb', isDraft ? 'Modelos · novo' : 'Modelos'),
      status),
    isDraft
      ? h('div.right',
          h('button.btn', { type: 'button', onClick: () => leave('#/modelos') }, 'Cancelar'),
          h('button.btn.primary', { type: 'button', onClick: (e) => saveDraft(e.currentTarget) }, svgIcon(ICONS.check), 'Salvar modelo'))
      : h('div.right',
          h('button.btn', {
            type: 'button',
            onClick: async () => { await saver.flush(); const c = await api.duplicateModel(id); location.hash = `#/modelos/${c.id}`; toast('Cópia criada.'); },
          }, svgIcon(ICONS.copy), 'Duplicar'),
          h('button.btn', {
            type: 'button',
            onClick: async () => {
              const msg = m.uses
                ? `O modelo sai da biblioteca, mas continua guardado. As ${m.uses} aulas que já usam ele continuam mostrando a atividade.`
                : 'O modelo sai da biblioteca, mas continua guardado no banco.';
              if (!(await confirmDialog(msg, { title: `Arquivar "${titleInput.value || m.title}"?`, confirmLabel: 'Arquivar modelo' }))) return;
              saver.cancel();
              await api.deleteModel(id);
              toast('Modelo arquivado.');
              location.hash = m.type === 'image' ? '#/imagens' : '#/modelos';
            },
          }, svgIcon(ICONS.archive), 'Arquivar')));

  root.replaceChildren(
    h('div.model-editor',
      top,
      h('div.model-layout',
        h('div.model-main',
          h('div.model-head', titleInput, h('div.stripe', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span'))),
          isDraft ? h('p.draft-note', svgIcon(ICONS.edit, 16), 'Edite à vontade: o modelo só entra na biblioteca quando você clicar em ', h('b', 'Salvar modelo'), '.') : null,
          paper,
          h('p.muted.small.center', 'Tudo aqui funciona como na aula: dá para conferir lacunas, sortear e passar as cartas para testar.')),
        side))
  );
  paintReview();
  if (!m.title || isDraft) titleInput.focus();

  const unmountBar = mountFormatBar(paper, () => false);
  const onExit = (e) => {
    if (isDraft) { if (dirty) { e.preventDefault(); e.returnValue = ''; } return; }
    if (saver.pending) saveOnExit(`/api/models/${id}`, saver.pending);
  };
  window.addEventListener('beforeunload', onExit);
  return () => { unmountBar(); window.removeEventListener('beforeunload', onExit); saver?.flush(); };
}
