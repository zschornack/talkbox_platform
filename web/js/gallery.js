// Galeria de formatos: para que serve cada formato, como funciona e dois exemplos que funcionam na tela.
// É o "Novo modelo" (página) e o "Ver exemplos" da aula (janela grande, que insere na aula).
import { h, svgIcon, ICONS, parseHash } from './dom.js';
import { appShell, pageHead } from './layout.js';
import { BLOCKS } from './blocks/index.js';
import { FORMAT_GROUPS, GUIDE, EXAMPLES } from './blocks/examples.js';
import { mountBlock } from './block-view.js';

/**
 * formatGallery({ mode: 'model' | 'lesson', type, onBlank(type), onExample(type, block, example), onSelect(type) })
 * Devolve o elemento. Os exemplos podem ser testados e até editados antes de usar.
 */
export function formatGallery({ mode = 'model', type, onBlank, onExample, onSelect }) {
  let current = BLOCKS[type] && GUIDE[type] ? type : 'fill';
  const navButtons = new Map();
  const nav = h('nav.fg-nav', { 'aria-label': 'Formatos' },
    FORMAT_GROUPS.map((g) => [
      h('h3.fg-group', g.name),
      g.types.map((t) => {
        const b = h('button.fg-item', { type: 'button', 'aria-current': String(t === current), onClick: () => select(t) },
          h('span.fg-icon', svgIcon(ICONS[t], 18)),
          h('span.fg-text', h('strong', BLOCKS[t].name), h('small', BLOCKS[t].hint)));
        navButtons.set(t, b);
        return b;
      }),
    ]));
  const detail = h('section.fg-detail', { 'aria-live': 'polite' });

  function select(t) {
    current = t;
    navButtons.forEach((b, k) => { b.classList.toggle('on', k === t); b.setAttribute('aria-current', String(k === t)); });
    paint();
    onSelect?.(t);
    detail.scrollTop = 0;
  }

  function paint() {
    const t = current;
    const guide = GUIDE[t];
    const isImageModel = t === 'image' && mode === 'model';
    const blankLabel = mode === 'lesson' ? 'Inserir em branco' : isImageModel ? 'Enviar imagens' : 'Começar em branco';
    const examples = (EXAMPLES[t] || []).map((ex, i) => {
      const block = { id: `ex-${t}-${i}`, ...JSON.parse(JSON.stringify(ex.block)) };
      const view = mountBlock(block, { changed: () => {}, local: {} });
      const use = isImageModel
        ? null
        : h('button.btn.small.primary', { type: 'button', onClick: () => onExample?.(t, block, ex) }, mode === 'lesson' ? 'Inserir este exemplo' : 'Começar com este exemplo');
      return h('article.fg-example',
        h('div.fg-ex-head',
          h('div',
            h('span.fg-ex-num', `Exemplo ${i + 1}${ex.level ? ` · ${ex.level}` : ''}`),
            h('strong', ex.title),
            h('p.muted.small', ex.use)),
          use),
        h('div.paper.fg-paper', { style: { '--lesson-size': '18px' } }, view));
    });
    detail.replaceChildren(
      h('header.fg-head',
        h('div.fg-title',
          h('span.fg-icon.big', svgIcon(ICONS[t], 24)),
          h('div', h('h2', BLOCKS[t].name), h('p', guide.purpose))),
        h('button.btn' + (isImageModel || mode === 'lesson' ? '.primary' : ''), { type: 'button', onClick: () => onBlank?.(t) },
          svgIcon(ICONS[isImageModel ? 'image' : 'plus'], 18), blankLabel)),
      h('div.fg-guide',
        h('div', h('h3', 'Na aula'), h('ul', guide.how.map((x) => h('li', x)))),
        h('div', h('h3', 'Para editar'), h('p', guide.edit))),
      h('p.muted.small.fg-try', 'Os exemplos funcionam de verdade: clique, confira e sorteie para ver como fica na aula.'),
      ...examples);
  }

  select(current);
  return h('div.fgallery', nav, detail);
}

/** Página "Novo modelo": escolher o formato vendo os exemplos. */
export function renderGallery(root) {
  document.title = 'Novo modelo · TalkBox';
  const { query } = parseHash();
  const gallery = formatGallery({
    mode: 'model',
    type: query.get('formato') || 'fill',
    onSelect: (t) => history.replaceState(null, '', `#/modelos/novo?formato=${t}`),
    onBlank: (t) => { location.hash = t === 'image' ? '#/imagens/enviar' : `#/modelos/novo/${t}`; },
    onExample: (t, _block, ex) => {
      const i = (EXAMPLES[t] || []).indexOf(ex);
      // o exemplo (do jeito que está na tela, se foi editado) vai para o modelo novo
      sessionStorage.setItem('talkbox:draft', JSON.stringify({ type: t, block: _block, title: ex.title, tags: ex.tags }));
      location.hash = `#/modelos/novo/${t}?exemplo=${i + 1}`;
    },
  });
  root.replaceChildren(
    appShell('models',
      h('div.page.page-wide',
        pageHead({
          title: 'Novo modelo',
          subtitle: 'Escolha o formato. Cada um tem dois exemplos que funcionam aqui mesmo: dá para começar de um deles ou em branco. Nada é salvo antes de você clicar em "Salvar modelo".',
          back: { href: '#/modelos', label: 'Modelos' },
        }),
        gallery)));
  return () => {};
}

/** Na aula: a galeria numa janela grande. onPick(block) insere o bloco escolhido. */
export function openGallery({ type, onPick }) {
  document.querySelector('.gallery-bg')?.remove();
  const restore = document.activeElement;
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); restore?.focus?.(); };
  const pick = (block) => { close(); onPick(block); };
  const gallery = formatGallery({
    mode: 'lesson',
    type,
    onBlank: (t) => pick({ type: t, ...BLOCKS[t].create() }),
    onExample: (t, block) => { const { id, ...rest } = JSON.parse(JSON.stringify(block)); pick({ ...rest, type: t }); },
  });
  const box = h('div.gallery-box', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Formatos e exemplos' },
    h('div.gallery-top',
      h('h2', 'Formatos e exemplos'),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Fechar', onClick: close }, svgIcon(ICONS.x))),
    gallery);
  const bg = h('div.gallery-bg', { onMousedown: (e) => e.target === bg && close() }, box);
  const onKey = (e) => { if (e.key === 'Escape' && !e.target.closest?.('[contenteditable="true"]')) { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  document.body.append(bg);
  box.querySelector('.fg-item.on')?.focus();
}
