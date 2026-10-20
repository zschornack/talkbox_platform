// Desafio sorteado (requisitos 9.12): frase + instrução (jeito de falar ou palavra obrigatória).
import { h, escapeHtml } from '../dom.js';
import { editable } from '../editable.js';
import { toText, sanitize } from '../sanitize.js';

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export const challenge = {
  name: 'Desafio sorteado',
  hint: 'Frase + "diga assim" ou "use esta palavra"',
  create: () => ({
    label: 'SPEAKING · SAY IT LIKE THIS!',
    html: 'Draw a card and say the sentence <b>in that way</b>.',
    promptLabel: 'SAY IT',
    lines: ['I lost my phone.', "There's a storm coming."],
    prompts: ['calmly', 'nervously', 'dramatically'],
  }),
  render(ctx) {
    const b = ctx.block;
    const local = ctx.local;
    if (!b.lines.length) b.lines.push('');
    if (!b.prompts.length) b.prompts.push('');
    local.l = Math.min(local.l || 0, b.lines.length - 1);
    local.p = Math.min(local.p || 0, b.prompts.length - 1);

    const draw = () => {
      const nl = b.lines.length, np = b.prompts.length;
      let l = Math.floor(Math.random() * nl), p = Math.floor(Math.random() * np);
      if (l === local.l && p === local.p && nl * np > 1) {
        if (np > 1) p = (p + 1) % np; else l = (l + 1) % nl;
      }
      Object.assign(local, { l, p });
      ctx.rerender({ pop: true });
    };

    const prompt = local.hidden
      ? h('span.pill', '? ? ?')
      : editable(h('span.pill'), {
          value: b.prompts[local.p],
          single: true,
          rich: false,
          onChange: (v) => { b.prompts[local.p] = v; ctx.changed(); },
        });

    const card = h(
      'div.challenge-card' + (ctx.pop ? '.pop' : ''),
      editable(h('div.challenge-line'), {
        value: b.lines[local.l],
        placeholder: 'Frase…',
        onChange: (v) => { b.lines[local.l] = v; ctx.changed(); },
      }),
      h(
        'div.challenge-prompt',
        editable(h('span.lbl'), {
          value: b.promptLabel || 'SAY IT',
          single: true,
          rich: false,
          onChange: (v) => { b.promptLabel = v; ctx.changed(); },
        }),
        prompt
      ),
      h(
        'div.btns',
        h('button.btn.primary', { type: 'button', onClick: draw }, 'Sortear'),
        h('button.btn', {
          type: 'button',
          'aria-pressed': String(!!local.hidden),
          onClick: () => { local.hidden = !local.hidden; ctx.rerender(); },
        }, local.hidden ? 'Mostrar' : 'Modo adivinhar')
      )
    );

    const listOf = (arr) => h('ol.print-list', arr.filter((x) => toText(x).trim()).map((x) => { const li = h('li'); li.innerHTML = sanitize(x); return li; }));
    const print = h(
      'div.print-only',
      h('div.print-cols',
        h('div', h('div.print-group', 'Sentences'), listOf(b.lines)),
        h('div', h('div.print-group', b.promptLabel || 'Say it'), listOf(b.prompts.map(escapeHtml)))
      )
    );

    const intro = editable(h('div.muted-text.opt'), {
      value: b.html,
      placeholder: 'Instrução (opcional)',
      onChange: (v) => { b.html = v; ctx.changed(); },
    });

    const body = h('div.block-body', intro, card, print);
    if (local.panel) body.append(panel(ctx));
    return {
      body,
      actions: [{ label: 'Editar listas', on: !!local.panel, onClick: () => { local.panel = !local.panel; ctx.rerender(); } }],
    };
  },
};

function panel(ctx) {
  const b = ctx.block;
  return h(
    'div.panel',
    h('h4', 'LISTAS'),
    h('div.help', 'Uma por linha. O Sortear combina uma frase com uma instrução, sem repetir a anterior.'),
    h(
      'div.cols',
      h('div.cat',
        h('label', { for: `fr-${b.id}` }, h('b', 'Frases')),
        h('textarea', {
          id: `fr-${b.id}`,
          value: b.lines.map(toText).join('\n'),
          onInput: (e) => { b.lines = lines(e.target.value).map(escapeHtml); ctx.changed(); },
          onChange: () => ctx.rerender(),
        })
      ),
      h('div.cat',
        h('label', { for: `in-${b.id}` }, h('b', 'Instruções'), ' (advérbio, entonação ou palavra a usar)'),
        h('textarea', {
          id: `in-${b.id}`,
          value: b.prompts.join('\n'),
          onInput: (e) => { b.prompts = lines(e.target.value); ctx.changed(); },
          onChange: () => ctx.rerender(),
        })
      )
    ),
    h('div.cat',
      h('label', { for: `lb-${b.id}` }, h('b', 'Rótulo da instrução'), ' (ex.: SAY IT, USE THIS WORD)'),
      h('input', {
        id: `lb-${b.id}`,
        type: 'text',
        value: b.promptLabel || '',
        onInput: (e) => { b.promptLabel = e.target.value; ctx.changed(); },
        onChange: () => ctx.rerender(),
      })
    )
  );
}
