// Imagem: arrastar, colar (Ctrl+V) ou escolher. Converte para WebP. Layouts fixos (requisitos 9.7).
import { h, svgIcon, ICONS } from '../dom.js';
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
        // foto nova enviada aqui: o bloco deixa de ser a imagem do acervo (senão "Voltar ao original" e a cópia trariam a antiga)
        delete b.source;
        delete b.ref;
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
      // ou uma imagem que já está no acervo (com título e etiquetas)
      if (ctx.pickImage && !ctx.local.loading) {
        media = h('div.img-empty', media,
          h('button.btn.small', {
            type: 'button',
            onClick: () => ctx.pickImage({
              multiple: false,
              onPick: ([m]) => {
                // o bloco passa a apontar para a imagem do acervo (v0.8)
                Object.assign(b, JSON.parse(JSON.stringify(m.block)), { id: b.id, type: 'image', ref: m.id, source: { modelId: m.id, title: m.title } });
                ctx.changed();
                ctx.rerender();
              },
            }),
          }, svgIcon(ICONS.image, 16), 'Escolher do acervo de imagens'));
      }
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
    // trocar a imagem de um bloco do acervo não pode apagar a imagem do acervo: o bloco deixa de apontar para ela
    if (b.src) actions.push({ label: 'Trocar imagem', onClick: () => { delete b.ref; delete b.source; b.src = ''; ctx.changed(); ctx.rerender(); } });
    return { body: fig, actions };
  },
};
