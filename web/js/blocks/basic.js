// Blocos de texto: texto livre, explicação e anotações.
import { h } from '../dom.js';
import { editable } from '../editable.js';

const richBody = (ctx, cls, placeholder) =>
  editable(h('div.' + cls), {
    value: ctx.block.html,
    placeholder,
    onChange: (v) => { ctx.block.html = v; ctx.changed(); },
    onKeyDown: ctx.slashKey,
  });

export const text = {
  name: 'Texto',
  hint: 'Parágrafo livre',
  create: () => ({ label: '', html: '' }),
  render: (ctx) => ({ body: richBody(ctx, 'rich', 'Escreva aqui… (digite / para inserir um bloco)') }),
  isEmpty: (b) => !b.html && !b.label,
};

export const explanation = {
  name: 'Explicação',
  hint: 'Regra ou conceito, com destaque',
  create: () => ({ label: 'EXPLICAÇÃO', html: '' }),
  render: (ctx) => ({ body: richBody(ctx, 'rich', 'Explique o conteúdo…') }),
};

export const notes = {
  name: 'Anotações',
  hint: 'O "quadro" da aula: sempre sai no PDF',
  create: () => ({ label: 'ANOTAÇÕES', html: '' }),
  render: (ctx) => ({
    body: richBody(ctx, 'notes-box', 'Anote para o aluno: palavras novas, como se escreve, correções…'),
  }),
};
