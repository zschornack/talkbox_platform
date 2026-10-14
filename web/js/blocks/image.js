// Imagem: arrastar, colar (Ctrl+V) ou escolher. Converte para WebP. Layouts fixos (requisitos 9.7).
import { h } from '../dom.js';
import { editable } from '../editable.js';
import { uploadImage } from '../api.js';

export const image = {
  name: 'Imagem',
  hint: 'Arraste, cole ou escolha uma foto',
  create: () => ({ src: '', caption: '', layout: 'full' }),
  hasLabel: false,
  render(ctx) {
    const b = ctx.block;

    const take = async (file) => {
      if (!file || !file.type.startsWith('image/')) return;
      ctx.local.loading = true;
      ctx.rerender();
      try {
        b.src = await uploadImage(file);
        ctx.changed();
      } catch (err) {
        ctx.toast('Não consegui enviar a imagem: ' + err.message);
      }
      ctx.local.loading = false;
      ctx.rerender();
    };
    ctx.local.take = take; // o editor usa isto quando a professora cola uma imagem

    let media;
    if (b.src && !ctx.local.loading) {
      media = h('img', { src: b.src, alt: b.caption ? '' : 'Imagem da aula', draggable: false });
    } else {
      const input = h('input', { type: 'file', accept: 'image/*', hidden: true, onChange: (e) => take(e.target.files[0]) });
      media = h(
        'div.dropzone',
        {
          role: 'button',
          tabindex: '0',
          onClick: () => input.click(),
          onKeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), input.click()),
          onDragover: (e) => { e.preventDefault(); e.currentTarget.classList.add('over'); },
          onDragleave: (e) => e.currentTarget.classList.remove('over'),
          onDrop: (e) => { e.preventDefault(); take(e.dataTransfer.files[0]); },
        },
        ctx.local.loading ? 'Enviando…' : [h('b', 'Arraste uma imagem aqui'), h('span', 'ou cole com Ctrl+V, ou clique para escolher')],
        input
      );
    }

    const fig = h(
      'figure.img-figure',
      { class: b.layout === 'half' ? 'half' : '' },
      media,
      editable(h('figcaption.img-caption.opt'), {
        value: b.caption,
        placeholder: 'Legenda (opcional)',
        onChange: (v) => { b.caption = v; ctx.changed(); },
      })
    );

    const set = (layout) => () => { b.layout = layout; ctx.changed(); ctx.rerender(); };
    const actions = [
      { label: 'Largura total', on: b.layout !== 'half', onClick: set('full') },
      { label: 'Metade', on: b.layout === 'half', onClick: set('half') },
    ];
    if (b.src) actions.push({ label: 'Trocar imagem', onClick: () => { b.src = ''; ctx.changed(); ctx.rerender(); } });
    return { body: fig, actions };
  },
};
