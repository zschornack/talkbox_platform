// Finalizar aula (requisitos, seção 10): uma tela só, pensada para 2 ou 3 cliques.
//   1. Até onde chegamos?  2. Como ficaram os conteúdos?  3. Recado para o próximo professor.
import { h, svgIcon, ICONS, formatDate } from './dom.js';
import { api } from './api.js';
import { modal } from './ui.js';
import { BLOCKS } from './blocks/index.js';
import { CONTENT_SUGGESTIONS, officialContent } from './catalog.js';

const blockName = (b) => b.title || BLOCKS[b.type]?.name || b.type;

/**
 * openFinishDialog({ lesson, flush, onFinished, onExport })
 * flush: salva o que estiver pendente antes de ler a aula.
 */
export async function openFinishDialog({ lesson, flush, onFinished, onExport }) {
  await flush?.();
  const info = await api.finishInfo(lesson.id);
  // anotações e textos vazios não contam (nem viram pendência)
  const blocks = info.blocks.filter((b) => !b.skip);

  // ---------- 1. até onde chegamos ----------
  let last = blocks.length ? blocks.at(-1).id : null;
  const list = h('ol.fin-blocks', { role: 'radiogroup', 'aria-label': 'Último bloco feito' });
  const pendingNote = h('p.fin-note');
  const paintBlocks = () => {
    const cut = last ? blocks.findIndex((b) => b.id === last) : -1;
    list.replaceChildren(
      ...blocks.map((b, i) =>
        h('li',
          h('button.fin-block', {
            type: 'button',
            role: 'radio',
            'aria-checked': String(b.id === last),
            class: i <= cut ? 'done' : 'later',
            onClick: () => { last = b.id; paintBlocks(); },
          },
          h('span.fin-num', String(i + 1)),
          svgIcon(ICONS[b.type] || ICONS.text, 16),
          h('span.fin-name', blockName(b)),
          b.pending ? h('span.fin-tag', 'pendente de antes') : null,
          i <= cut ? h('span.fin-state', svgIcon(ICONS.check, 15), b.id === last ? 'último feito' : 'feito') : h('span.fin-state.later', 'fica pendente'))
        )
      )
    );
    const n = blocks.length - 1 - cut;
    pendingNote.textContent = n === 0 ? 'Tudo feito: nada fica pendente.' : `${n} ${n === 1 ? 'bloco fica pendente' : 'blocos ficam pendentes'} e ${n === 1 ? 'entra' : 'entram'} sozinhos na próxima aula.`;
  };
  paintBlocks();
  const noneBtn = h('button.btn.small', { type: 'button', onClick: () => { last = null; paintBlocks(); } }, 'Não deu para começar');

  // ---------- 2. conteúdos ----------
  const marks = {};
  const contents = [...info.contents];
  const contentList = h('div.fin-contents');
  const paintContents = () => {
    contentList.replaceChildren(
      ...(contents.length
        ? contents.map((c) =>
            h('div.fin-content',
              h('span.fin-cname', c),
              h('div.seg', { role: 'group', 'aria-label': c },
                [['practicing', 'Praticando'], ['good', 'Já está bom']].map(([v, label]) =>
                  h('button', {
                    type: 'button',
                    class: `${v} ${marks[c] === v ? 'on' : ''}`,
                    'aria-pressed': String(marks[c] === v),
                    onClick: () => { marks[c] = marks[c] === v ? undefined : v; paintContents(); },
                  }, label)))))
        : [h('p.muted.small', 'Os blocos desta aula não têm etiquetas de conteúdo. Acrescente abaixo o que foi trabalhado.')])
    );
  };
  paintContents();
  const listId = 'fc' + Math.random().toString(36).slice(2, 8);
  const addInput = h('input', { type: 'text', list: listId, placeholder: 'Outro conteúdo trabalhado…', 'aria-label': 'Acrescentar conteúdo', autocomplete: 'off' });
  const addContent = () => {
    const v = addInput.value.trim();
    addInput.value = '';
    if (!v) return;
    const name = officialContent(v) || v;
    if (!contents.includes(name)) contents.push(name);
    paintContents();
  };
  addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addContent(); } });
  addInput.addEventListener('change', addContent);

  // ---------- 3. recado ----------
  const message = h('textarea.fin-message', {
    rows: 3,
    'aria-label': 'Recado para o próximo professor',
    placeholder: 'Vazio = está tudo certo.',
  });

  const step = (n, title, ...body) => h('section.fin-step', h('h3', h('span.fin-stepnum', String(n)), title), ...body);

  const dlg = modal({
    title: `Finalizar aula · ${lesson.doc?.title || lesson.title}`,
    wide: true,
    submitLabel: 'Concluir aula',
    body: [
      lesson.student ? h('p.muted.small', `${lesson.student} · ${formatDate(lesson.date)}`) : null,
      step(1, 'Até onde chegamos?', h('p.muted.small', 'Clique no último bloco feito.'), list, h('div.fin-row', pendingNote, noneBtn)),
      step(2, 'Como ficaram os conteúdos?', contentList,
        h('div.fin-add', addInput, h('datalist', { id: listId }, CONTENT_SUGGESTIONS.map((c) => h('option', { value: c }))))),
      step(3, 'Recado para o próximo professor', message),
    ],
    onSubmit: async () => {
      const assessments = Object.fromEntries(Object.entries(marks).filter(([, v]) => v));
      const out = await api.finishLesson(lesson.id, { lastBlockId: last, assessments, message: message.value });
      onFinished?.(out);
      setTimeout(() => showSummary(out, { lesson, onExport, rated: Object.keys(assessments).length, message: message.value.trim() }), 0);
    },
  });
  // começa pelo topo, com o bloco escolhido à vista na lista
  dlg.form.scrollTop = 0;
  const body = dlg.form.querySelector('.modal-body');
  if (body) body.scrollTop = 0;
  const chosen = list.querySelector('[aria-checked="true"]');
  if (chosen) {
    list.scrollTop = list.scrollHeight; // o padrão é o último bloco
    chosen.focus({ preventScroll: true });
  }
}

function showSummary(out, { lesson, onExport, rated, message }) {
  const line = (icon, text) => h('li', svgIcon(ICONS[icon], 16), text);
  const items = [
    line('check', out.done ? `${out.done} ${out.done === 1 ? 'bloco feito' : 'blocos feitos'}` : 'Nenhum bloco feito'),
    out.newPending + out.stillPending
      ? line('clock', `${out.newPending + out.stillPending} ${out.newPending + out.stillPending === 1 ? 'pendente vai' : 'pendentes vão'} para a próxima aula`)
      : null,
    out.resolvedPending ? line('check', `${out.resolvedPending} ${out.resolvedPending === 1 ? 'pendente resolvido' : 'pendentes resolvidos'}`) : null,
    line('layers', rated ? `${rated} ${rated === 1 ? 'conteúdo atualizado' : 'conteúdos atualizados'} no mapa` : 'Mapa sem mudanças'),
    line('notes', message ? 'Recado registrado para o próximo professor' : 'Sem recado: está tudo certo'),
  ];
  const m = modal({
    title: 'Aula concluída',
    submitLabel: 'Exportar PDF',
    cancelLabel: 'Fechar',
    body: [
      h('ul.fin-summary', items),
      lesson.studentId ? h('a.btn', { href: `#/alunos/${lesson.studentId}`, onClick: () => m.close() }, svgIcon(ICONS.users), 'Ver a ficha') : null,
    ],
    onSubmit: () => { setTimeout(() => onExport?.(), 0); },
  });
}
