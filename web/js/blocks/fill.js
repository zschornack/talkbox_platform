// Fill in the blanks (requisitos 9.6). As respostas do aluno ficam separadas do exercício (9.10).
import { h, uid } from '../dom.js';
import { editable } from '../editable.js';

const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[’‘]/g, "'");
const isRight = (item, value) => item.answers.some((a) => norm(a) === norm(value)) && norm(value) !== '';
const widthFor = (v) => Math.max(6, String(v || '').length + 2) + 'ch';

export const fill = {
  name: 'Fill in the blanks',
  hint: 'Lacunas com Conferir, Revelar e Limpar',
  create: () => ({
    label: 'EXERCÍCIO · FILL IN THE BLANKS',
    html: 'Complete the sentences.',
    items: [
      { id: uid('i'), before: 'Yesterday I', hint: 'go', after: 'to the supermarket.', answers: ['went'] },
      { id: uid('i'), before: 'She', hint: 'not / like', after: 'the movie.', answers: ["didn't like", 'did not like'] },
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const st = ctx.state();
    st.answers ||= {};
    const local = ctx.local;

    const blanks = [];
    const marks = [];
    const prints = [];
    const score = h('div.score', { role: 'status', hidden: true });

    const refreshMarks = () => {
      let right = 0;
      b.items.forEach((it, i) => {
        const v = st.answers[it.id] || '';
        const ok = isRight(it, v);
        if (ok) right++;
        blanks[i].classList.toggle('ok', !!local.checked && ok);
        blanks[i].classList.toggle('bad', !!local.checked && !ok);
        marks[i].hidden = !local.checked;
        marks[i].className = 'mark ' + (ok ? 'ok' : 'bad');
        marks[i].textContent = ok ? '✓' : (v ? '✗ ' : '— ') + (it.answers[0] || '');
      });
      score.hidden = !local.checked;
      score.textContent = `Acertou ${right} de ${b.items.length}.`;
    };

    const setValue = (it, i, v) => {
      st.answers[it.id] = v;
      blanks[i].value = v;
      blanks[i].style.width = widthFor(v);
      prints[i].textContent = v || ' ';
      ctx.stateChanged();
    };

    const list = h(
      'ol.fill-list',
      b.items.map((it, i) => {
        const value = st.answers[it.id] || '';
        const input = h('input.blank', {
          type: 'text',
          autocomplete: 'off',
          spellcheck: false,
          'aria-label': `Lacuna ${i + 1}: ${it.hint}`,
          value,
          style: { width: widthFor(value) },
          onInput: (e) => {
            local.checked = false;
            setValue(it, i, e.target.value);
            refreshMarks();
          },
          onKeydown: (e) => {
            if (e.key !== 'Tab') return;
            const all = [...document.querySelectorAll('.paper .blank')];
            const next = all[all.indexOf(e.target) + (e.shiftKey ? -1 : 1)];
            if (next) { e.preventDefault(); next.focus(); }
          },
        });
        blanks.push(input);
        const pr = h('span.blank-print', value || ' ');
        prints.push(pr);
        const mark = h('span.mark', { hidden: true });
        marks.push(mark);
        return h(
          'li',
          editable(h('span.seg'), { value: it.before, single: true, onChange: (v) => { it.before = v; ctx.changed(); } }),
          ' ',
          input,
          pr,
          ' ',
          h('span.hint', '(', editable(h('span'), { value: it.hint, rich: false, single: true, onChange: (v) => { it.hint = v; ctx.changed(); } }), ')'),
          ' ',
          editable(h('span.seg'), { value: it.after, single: true, onChange: (v) => { it.after = v; ctx.changed(); } }),
          mark
        );
      })
    );

    const buttons = h(
      'div.btns.screen-only',
      h('button.btn.primary', { type: 'button', onClick: () => { local.checked = true; refreshMarks(); } }, 'Conferir'),
      h('button.btn', {
        type: 'button',
        onClick: () => { b.items.forEach((it, i) => setValue(it, i, it.answers[0] || '')); local.checked = true; refreshMarks(); },
      }, 'Revelar'),
      h('button.btn', {
        type: 'button',
        onClick: () => { b.items.forEach((it, i) => setValue(it, i, '')); local.checked = false; refreshMarks(); },
      }, 'Limpar')
    );

    const instructions = editable(h('div.muted-text'), {
      value: b.html,
      placeholder: 'Enunciado do exercício',
      onChange: (v) => { b.html = v; ctx.changed(); },
    });

    const body = h('div.block-body', h('div.block-head', instructions, buttons), list, score);
    if (local.panel) body.append(answersPanel(ctx));
    refreshMarks();

    return {
      body,
      actions: [{ label: 'Editar respostas', on: !!local.panel, onClick: () => { local.panel = !local.panel; ctx.rerender(); } }],
    };
  },
};

// Painel discreto para o professor: resposta certa e alternativas aceitas, adicionar/remover frases.
function answersPanel(ctx) {
  const b = ctx.block;
  const rows = b.items.map((it, i) =>
    h(
      'div.row',
      h('span', `${i + 1}.`),
      h('span.sent', { title: `${it.before} ___ ${it.after}` }, `${it.before} ___ ${it.after}`),
      h('input', {
        type: 'text',
        value: it.answers.join(' / '),
        'aria-label': `Respostas aceitas da frase ${i + 1}`,
        placeholder: 'went / did go',
        onInput: (e) => {
          it.answers = e.target.value.split('/').map((s) => s.trim()).filter(Boolean);
          ctx.changed();
        },
      }),
      h('button.tool', {
        type: 'button',
        'aria-label': `Remover frase ${i + 1}`,
        title: 'Remover frase',
        onClick: () => { b.items.splice(i, 1); ctx.changed(); ctx.rerender(); },
      }, '×')
    )
  );
  return h(
    'div.panel',
    h('h4', 'RESPOSTAS'),
    h('div.help', 'Separe respostas alternativas com " / ". O aluno não vê este painel nem ele sai no PDF.'),
    rows,
    h('div', h('button.btn.small', {
      type: 'button',
      onClick: () => {
        b.items.push({ id: uid('i'), before: 'New sentence', hint: 'verb', after: '.', answers: [] });
        ctx.changed();
        ctx.rerender();
      },
    }, '+ frase'))
  );
}
