// Editar um modelo: o mesmo editor da aula, com as etiquetas ao lado (requisitos 7.3).
import { h, svgIcon, ICONS, dateTime, formatDate, parseHash, brandMark } from './dom.js';
import { api, autosaver, saveOnExit } from './api.js';
import { mountBlock } from './block-view.js';
import { mountFormatBar } from './format-bar.js';
import { LEVELS, SKILLS, canonicalContent } from './catalog.js';
import { toggleChips, tagInput, confirmDialog, toast, emptyState } from './ui.js';
import { formatBadge, contentUniverse } from './models.js';

export async function renderModelEditor(root, id) {
  let m;
  try {
    m = await api.model(id);
  } catch {
    root.replaceChildren(h('div.page', emptyState('Modelo não encontrado.', null, h('a.btn', { href: '#/modelos' }, 'Voltar para Modelos'))));
    return () => {};
  }
  const all = await api.models().catch(() => []);
  const isNew = parseHash().query.get('novo') === '1';
  if (isNew) history.replaceState(null, '', `#/modelos/${id}`);
  document.title = `${m.title} · Modelos · TalkBox`;

  const block = m.block;
  block.type = m.type;
  const tags = m.tags;
  const status = h('span.save-status', { role: 'status', 'aria-live': 'polite' }, 'Salvo');
  const saver = autosaver({ save: (body) => api.saveModel(id, body), statusEl: status });
  const save = () => saver.queue({ title: titleInput.value.trim() || 'Sem título', block, tags });

  // ---------- nome ----------
  const titleInput = h('input.model-title', {
    type: 'text',
    value: m.title === 'Sem título' && isNew ? '' : m.title,
    placeholder: 'Nome do modelo',
    'aria-label': 'Nome do modelo',
    maxlength: '200',
    onInput: (e) => { document.title = `${e.target.value || 'Sem título'} · Modelos · TalkBox`; save(); },
  });

  // ---------- o bloco, com tudo funcionando (dá para testar o exercício aqui) ----------
  const paper = h('div.paper.model-paper', { style: { '--lesson-size': '20px' } },
    mountBlock(block, { changed: save, local: { panel: ['fill', 'deck', 'challenge'].includes(m.type) } }));

  // ---------- importado: a revisar ----------
  const reviewCard = h('section.side-card.review-card');
  function paintReview() {
    if (m.status !== 'review') return reviewCard.remove();
    const noContent = !tags.content.length;
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
  const side = h('aside.model-side',
    reviewCard,
    h('section.side-card',
      h('h2', 'Etiquetas'),
      h('div.field', h('span.field-label', 'Formato'), formatBadge(m.type)),
      h('div.field', h('span.field-label', 'Conteúdo'),
        tagInput({ value: tags.content, suggestions: contentUniverse(all), label: 'Conteúdo', placeholder: 'Ex.: Past Simple (Enter)', normalize: canonicalContent, onChange: (v) => { tags.content = v; save(); paintReview(); } }),
        h('div.field-hint', 'Sinônimos viram o nome oficial: "simple past" entra como Past Simple.')),
      h('div.field', h('span.field-label', 'Nível'),
        toggleChips({ options: LEVELS, value: tags.levels, label: 'Nível', onChange: (v) => { tags.levels = v; save(); } })),
      h('div.field', h('span.field-label', 'Habilidade'),
        toggleChips({ options: SKILLS, value: tags.skills, label: 'Habilidade', onChange: (v) => { tags.skills = v; save(); } }))
    ),
    h('section.side-card',
      h('h2', 'Uso'),
      h('p.stat', h('strong', String(m.uses)), m.uses === 1 ? ' aula usou este modelo' : ' aulas usaram este modelo'),
      h('p.muted.small', `Criado em ${formatDate(m.createdAt)}. As aulas guardam uma cópia: mudar o modelo não altera aulas já montadas.`)
    ),
    h('section.side-card',
      h('h2', 'Histórico de versões'),
      m.versions.length
        ? h('ul.versions',
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
                }, 'Restaurar'))))
        : h('p.muted.small', 'As versões anteriores aparecem aqui conforme o modelo for editado (uma a cada 10 minutos de edição).')
    )
  );

  const top = h('div.editor-top',
    h('div.left',
      h('a.btn.icon', { href: '#/modelos', title: 'Voltar para Modelos', 'aria-label': 'Voltar para Modelos' }, svgIcon(ICONS.back)),
      brandMark(),
      h('span.crumb', 'Modelos'),
      status),
    h('div.right',
      h('button.btn', {
        type: 'button',
        onClick: async () => { await saver.flush(); const c = await api.duplicateModel(id); location.hash = `#/modelos/${c.id}`; toast('Cópia criada.'); },
      }, svgIcon(ICONS.copy), 'Duplicar'),
      h('button.btn', {
        type: 'button',
        onClick: async () => {
          const msg = m.uses
            ? `O modelo sai da biblioteca, mas continua guardado. As ${m.uses} aulas que já usaram continuam com a cópia delas.`
            : 'O modelo sai da biblioteca, mas continua guardado no banco.';
          if (!(await confirmDialog(msg, { title: `Arquivar "${titleInput.value || m.title}"?`, confirmLabel: 'Arquivar modelo' }))) return;
          saver.cancel();
          await api.deleteModel(id);
          toast('Modelo arquivado.');
          location.hash = '#/modelos';
        },
      }, svgIcon(ICONS.archive), 'Arquivar'))
  );

  root.replaceChildren(
    h('div.model-editor',
      top,
      h('div.model-layout',
        h('div.model-main',
          h('div.model-head', titleInput, h('div.stripe', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span'))),
          paper,
          h('p.muted.small.center', 'Tudo aqui funciona como na aula: dá para conferir lacunas, sortear e passar as cartas para testar.')),
        side))
  );
  paintReview();
  if (isNew || !m.title) titleInput.focus();

  const unmountBar = mountFormatBar(paper, () => false);
  const onExit = () => { if (saver.pending) saveOnExit(`/api/models/${id}`, saver.pending); };
  window.addEventListener('beforeunload', onExit);
  return () => { unmountBar(); window.removeEventListener('beforeunload', onExit); saver.flush(); };
}
