// Baralho de perguntas (requisitos 9.11): uma carta por vez, temas em abas, palavra-desafio opcional.
import { h, escapeHtml } from '../dom.js';
import { editable } from '../editable.js';
import { toText, sanitize } from '../sanitize.js';

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export const deck = {
  name: 'Baralho de perguntas',
  hint: 'Uma carta por vez: Próxima, Anterior, Aleatória',
  create: () => ({
    label: 'CONVERSATION · QUESTION DECK',
    html: '',
    words: [],
    cats: [{ name: 'Geral', qs: ['What did you do last weekend?', 'What do you usually do on Sundays?'] }],
  }),
  render(ctx) {
    const b = ctx.block;
    const local = ctx.local;
    if (!b.cats.length) b.cats.push({ name: 'Geral', qs: [''] });
    local.cat = Math.min(local.cat || 0, b.cats.length - 1);
    const cat = b.cats[local.cat];
    if (!cat.qs.length) cat.qs.push('');
    local.q = Math.min(local.q || 0, cat.qs.length - 1);

    const go = (q) => { local.q = (q + cat.qs.length) % cat.qs.length; ctx.rerender({ pop: true }); };

    const tabs =
      b.cats.length > 1
        ? h(
            'div.tabs.screen-only',
            { role: 'tablist', 'aria-label': 'Temas' },
            b.cats.map((c, i) =>
              h('button.tab', {
                type: 'button',
                role: 'tab',
                class: i === local.cat ? 'sel' : '',
                'aria-selected': String(i === local.cat),
                onClick: () => { local.cat = i; local.q = 0; ctx.rerender({ pop: true }); },
              }, c.name || `Tema ${i + 1}`)
            )
          )
        : null;

    const word = b.words.length ? b.words[(local.cat * 5 + local.q * 7) % b.words.length] : '';
    const card = h(
      'div.deck-card' + (ctx.pop ? '.pop' : ''),
      h('div.deck-meta', h('span', cat.name), h('span', `${local.q + 1} / ${cat.qs.length}`)),
      editable(h('div.deck-q'), {
        value: cat.qs[local.q],
        placeholder: 'Escreva a pergunta…',
        onChange: (v) => { cat.qs[local.q] = v; ctx.changed(); },
      }),
      h(
        'div.deck-foot',
        word ? h('span.try', 'Try to use: ', h('b', word)) : h('span'),
        h(
          'div.btns',
          h('button.btn.icon', { type: 'button', 'aria-label': 'Pergunta anterior', onClick: () => go(local.q - 1) }, '‹'),
          h('button.btn.primary', { type: 'button', onClick: () => go(local.q + 1) }, 'Próxima'),
          h('button.btn', {
            type: 'button',
            onClick: () => {
              const n = cat.qs.length;
              let r = Math.floor(Math.random() * n);
              if (n > 1 && r === local.q) r = (r + 1) % n;
              go(r);
            },
          }, 'Aleatória')
        )
      )
    );

    // No PDF: lista com todas as perguntas, agrupadas por tema.
    const print = h(
      'div.print-only',
      b.cats.map((c) => [
        b.cats.length > 1 ? h('div.print-group', c.name) : null,
        h('ol.print-list', c.qs.filter((q) => toText(q).trim()).map((q) => { const li = h('li'); li.innerHTML = sanitize(q); return li; })),
      ])
    );

    const intro = editable(h('div.muted-text.opt'), {
      value: b.html,
      placeholder: 'Instrução (opcional)',
      onChange: (v) => { b.html = v; ctx.changed(); },
    });

    const body = h('div.block-body', intro, tabs, card, print);
    if (local.panel) body.append(deckPanel(ctx));
    return {
      body,
      actions: [{ label: 'Editar cartas', on: !!local.panel, onClick: () => { local.panel = !local.panel; ctx.rerender(); } }],
    };
  },
};

function deckPanel(ctx) {
  const b = ctx.block;
  const cats = b.cats.map((c, i) =>
    h(
      'div.cat',
      h(
        'div.cat-top',
        h('input', {
          type: 'text',
          value: c.name,
          'aria-label': 'Nome do tema',
          placeholder: 'Nome do tema',
          onInput: (e) => { c.name = e.target.value; ctx.changed(); },
          onChange: () => ctx.rerender(),
        }),
        b.cats.length > 1
          ? h('button.tool', { type: 'button', title: 'Remover tema', 'aria-label': 'Remover tema', onClick: () => { b.cats.splice(i, 1); ctx.changed(); ctx.rerender(); } }, '×')
          : null
      ),
      h('textarea', {
        'aria-label': `Perguntas do tema ${c.name}`,
        value: c.qs.map(toText).join('\n'),
        onInput: (e) => { c.qs = lines(e.target.value).map(escapeHtml); ctx.changed(); },
        onChange: () => ctx.rerender(),
      })
    )
  );
  return h(
    'div.panel',
    h('h4', 'CARTAS'),
    h('div.help', 'Uma pergunta por linha. Cada tema vira uma aba.'),
    h('div.cols', cats),
    h('div', h('button.btn.small', {
      type: 'button',
      onClick: () => { b.cats.push({ name: 'Novo tema', qs: ['New question?'] }); ctx.changed(); ctx.rerender(); },
    }, '+ tema')),
    h('h4', 'PALAVRAS-DESAFIO (OPCIONAL)'),
    h('div.help', 'Uma por linha. Aparece "Try to use: …" em cada carta. Deixe vazio para não mostrar.'),
    h('textarea', {
      'aria-label': 'Palavras-desafio',
      style: { minHeight: '80px' },
      value: b.words.join('\n'),
      onInput: (e) => { b.words = lines(e.target.value); ctx.changed(); },
      onChange: () => ctx.rerender(),
    })
  );
}
