// Galeria de imagens: várias imagens em grade, como um pacote do acervo ("Animals").
// Os nomes podem começar escondidos: o aluno fala, você revela (um por um ou todos).
// Clique numa imagem para ver grande, uma por vez, com setas (bom na tela compartilhada).
// O que já foi revelado fica no estado da aula, como as respostas dos exercícios.
import { h, svgIcon, ICONS, uid } from '../dom.js';
import { editable } from '../editable.js';
import { toText, sanitize } from '../sanitize.js';
import { instructions } from './kit.js';

const COLS = [2, 3, 4];

export const gallery = {
  name: 'Galeria de imagens',
  hint: 'Várias imagens em grade; os nomes podem começar escondidos',
  create: () => ({ label: 'PICTURES', html: 'What is it? Say the word first, then reveal.', columns: 3, hidden: true, images: [] }),
  render(ctx) {
    const b = ctx.block;
    b.images ||= [];
    const st = ctx.state();
    st.shown ||= {};
    const cols = COLS.includes(b.columns) ? b.columns : 3;
    const shown = (img) => !b.hidden || !!st.shown[img.id];
    const setShown = (img, on) => { st.shown[img.id] = on; ctx.stateChanged(); };

    const addFromLibrary = ctx.pickImage
      ? () => ctx.pickImage({
          multiple: true,
          gallery: false,
          confirmLabel: 'Pôr na galeria',
          onPick: (models) => {
            for (const m of models) b.images.push({ id: uid('g'), src: m.block.src, caption: m.title, modelId: m.id });
            ctx.changed();
            ctx.rerender();
          },
        })
      : null;

    const tiles = b.images.map((img, i) =>
      h('figure.gal-tile',
        h('button.gal-img', { type: 'button', title: 'Ver grande', 'aria-label': `Ver a imagem ${i + 1} grande`, onClick: () => openViewer(ctx, i) },
          h('img', { src: img.src, alt: shown(img) ? toText(img.caption) : `Imagem ${i + 1}`, loading: 'lazy', draggable: false })),
        shown(img)
          ? h('figcaption.gal-cap', { class: b.hidden ? 'was-hidden' : '' },
              editable(h('span.gal-name'), { value: img.caption || '', single: true, placeholder: 'nome', onChange: (v) => { img.caption = v; ctx.changed(); } }),
              b.hidden ? h('button.gal-hide.screen-only', { type: 'button', title: 'Esconder', 'aria-label': 'Esconder o nome', onClick: () => { setShown(img, false); ctx.rerender(); } }, svgIcon(ICONS.x, 12)) : null,
              // PDF em branco: o nome que foi revelado na aula volta a ser uma linha para escrever
              b.hidden ? h('span.print-only.gal-blank.blank-only', '________________') : null)
          : h('figcaption.gal-cap.closed',
              h('button.reveal-btn.screen-only', { type: 'button', onClick: () => { setShown(img, true); ctx.rerender(); } }, 'Revelar'),
              h('span.print-only.gal-blank', '________________')),
        h('button.gal-remove.screen-only', { type: 'button', title: 'Tirar da galeria', 'aria-label': `Tirar a imagem ${i + 1}`, onClick: () => { b.images.splice(i, 1); ctx.changed(); ctx.rerender(); } }, svgIcon(ICONS.x, 14))));

    const allShown = b.images.length && b.images.every(shown);
    const buttons = b.hidden && b.images.length
      ? h('div.btns.screen-only',
          h('button.btn', {
            type: 'button',
            onClick: () => { b.images.forEach((img) => (st.shown[img.id] = !allShown)); ctx.stateChanged(); ctx.rerender(); },
          }, allShown ? 'Esconder todos' : 'Revelar todos'))
      : null;

    const empty = !b.images.length
      ? h('div.gal-empty',
          h('p', h('b', 'A galeria está vazia.'), ' Escolha as imagens no acervo (um pacote inteiro, por exemplo).'),
          addFromLibrary ? h('button.btn.primary', { type: 'button', onClick: addFromLibrary }, svgIcon(ICONS.image, 18), 'Escolher do acervo') : null)
      : null;

    const body = h('div.block-body',
      h('div.block-head', instructions(ctx, 'Instrução (opcional): What is it? Describe it…'), buttons),
      empty,
      b.images.length ? h('div.gal-grid', { style: { gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` } }, tiles) : null);

    const actions = [
      ...(addFromLibrary ? [{ label: '+ imagens do acervo', onClick: addFromLibrary }] : []),
      { label: `Colunas: ${cols}`, onClick: () => { b.columns = COLS[(COLS.indexOf(cols) + 1) % COLS.length]; ctx.changed(); ctx.rerender(); } },
      { label: b.hidden ? 'Nomes começam escondidos' : 'Nomes à mostra', on: !!b.hidden, onClick: () => { b.hidden = !b.hidden; ctx.changed(); ctx.rerender(); } },
    ];
    return { body, actions };
  },
};

/** Ver uma imagem grande, com setas (← →), Espaço para revelar o nome e Esc para fechar. */
function openViewer(ctx, start) {
  const b = ctx.block;
  const st = ctx.state();
  let i = start;
  const img = h('img.viewer-img', { alt: '' });
  const cap = h('div.viewer-cap');
  const count = h('span.viewer-count');
  const paint = () => {
    const it = b.images[i];
    if (!it) return close();
    img.src = it.src;
    count.textContent = `${i + 1} / ${b.images.length}`;
    const open = !b.hidden || st.shown[it.id];
    cap.replaceChildren(open
      ? (() => { const s = h('span'); s.innerHTML = sanitize(it.caption || ''); return s; })()
      : h('button.btn.primary', { type: 'button', onClick: reveal }, 'Revelar'));
  };
  const reveal = () => { const it = b.images[i]; if (!it) return; st.shown[it.id] = true; ctx.stateChanged(); paint(); };
  const go = (d) => { i = (i + d + b.images.length) % b.images.length; paint(); };
  const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); ctx.rerender(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === ' ') { e.preventDefault(); reveal(); }
  };
  const bg = h('div.viewer-bg', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Imagem grande', onMousedown: (e) => e.target === bg && close() },
    h('button.viewer-close', { type: 'button', 'aria-label': 'Fechar', onClick: close }, svgIcon(ICONS.x, 22)),
    h('button.viewer-nav.prev', { type: 'button', 'aria-label': 'Anterior', onClick: () => go(-1) }, '‹'),
    h('figure.viewer-fig', img, cap),
    h('button.viewer-nav.next', { type: 'button', 'aria-label': 'Próxima', onClick: () => go(1) }, '›'),
    count);
  document.addEventListener('keydown', onKey, true);
  document.body.append(bg);
  paint();
}
