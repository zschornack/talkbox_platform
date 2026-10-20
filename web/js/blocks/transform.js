// Transformar frases: frase + instrução ("make it negative", "use: although"); o aluno escreve a frase nova.
// Aceita várias respostas certas. As respostas do aluno ficam no estado da aula.
import { h, uid } from '../dom.js';
import { editable } from '../editable.js';
import { instructions, lines, linesPanel, panelAction, norm } from './kit.js';

const isRight = (it, v) => norm(v) !== '' && it.answers.some((a) => norm(a) === norm(v));

export const transform = {
  name: 'Transformar frases',
  hint: 'Frase + instrução; o aluno reescreve',
  create: () => ({
    label: 'PRACTICE · TRANSFORM THE SENTENCE',
    html: 'Rewrite the sentence following the instruction.',
    items: [
      { id: uid('i'), sentence: 'She likes coffee.', instruction: 'make it negative', answers: ["She doesn't like coffee.", 'She does not like coffee.'] },
      { id: uid('i'), sentence: 'It was raining. We went out.', instruction: 'use: although', answers: ['Although it was raining, we went out.', 'We went out although it was raining.'] },
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const st = ctx.state();
    st.answers ||= {};
    const local = ctx.local;
    let right = 0;
    const list = h('ol.transform-list', b.items.map((it) => {
      const v = st.answers[it.id] || '';
      const ok = isRight(it, v);
      if (ok) right++;
      const mark = h('span.mark', { hidden: !local.checked, class: ok ? 'ok' : 'bad' }, ok ? '✓' : `✗ ${it.answers[0] || ''}`);
      return h('li',
        h('div.tf-top',
          editable(h('span.tf-sentence'), { value: it.sentence, single: true, onChange: (x) => { it.sentence = x; ctx.changed(); } }),
          h('span.tf-instruction', editable(h('span'), { value: it.instruction, single: true, rich: false, onChange: (x) => { it.instruction = x; ctx.changed(); } }))),
        h('div.tf-answer',
          h('input.tf-input', {
            type: 'text', autocomplete: 'off', spellcheck: false, value: v,
            class: local.checked ? (ok ? 'ok' : 'bad') : '',
            'aria-label': `Nova frase: ${it.instruction}`,
            placeholder: 'Write the new sentence…',
            onInput: (e) => { st.answers[it.id] = e.target.value; local.checked = false; mark.hidden = true; e.target.className = 'tf-input'; ctx.stateChanged(); },
          }),
          h('span.print-only.tf-print', v || ' '),
          mark));
    }));
    const score = h('div.score', { role: 'status', hidden: !local.checked }, `Acertou ${right} de ${b.items.length}.`);
    const buttons = h('div.btns.screen-only',
      h('button.btn.primary', { type: 'button', onClick: () => { local.checked = true; ctx.rerender(); } }, 'Conferir'),
      h('button.btn', { type: 'button', onClick: () => { b.items.forEach((it) => (st.answers[it.id] = it.answers[0] || '')); local.checked = true; ctx.stateChanged(); ctx.rerender(); } }, 'Revelar'),
      h('button.btn', { type: 'button', onClick: () => { st.answers = {}; local.checked = false; ctx.stateChanged(); ctx.rerender(); } }, 'Limpar'));
    const body = h('div.block-body', h('div.block-head', instructions(ctx), buttons), list, score);
    if (local.panel) {
      body.append(linesPanel(ctx, {
        title: 'FRASES',
        help: 'Uma por linha: frase | instrução | resposta / outra resposta aceita. Ex.: She likes coffee. | make it negative | She doesn\'t like coffee. / She does not like coffee.',
        value: b.items.map((it) => `${it.sentence} | ${it.instruction} | ${it.answers.join(' / ')}`).join('\n'),
        parse: (txt) => {
          const ls = lines(txt);
          const bad = ls.findIndex((l) => l.split('|').length < 3);
          if (bad >= 0) return { error: `Linha ${bad + 1}: use frase | instrução | resposta.` };
          b.items = ls.map((l, i) => {
            const [sentence, instruction, ans] = l.split('|').map((x) => x.trim());
            return { id: b.items[i]?.id || uid('i'), sentence, instruction, answers: ans.split(' / ').map((x) => x.trim()).filter(Boolean) };
          });
          return { ok: true };
        },
      }));
    }
    return { body, actions: [panelAction(ctx, 'Editar frases')] };
  },
};
