// Lista de aulas (provisória até chegarem Home, Alunos e Ficha nos próximos patches).
import { h, formatDate } from './dom.js';
import { api } from './api.js';

export async function renderLessons(root) {
  document.title = 'Aulas · TalkBox';
  let lessons = [];
  try {
    lessons = await api.lessons();
  } catch (err) {
    root.replaceChildren(h('div.home', h('p', 'Não consegui falar com o servidor: ' + err.message)));
    return () => {};
  }

  const tbody = h('tbody');
  const search = h('input.search', { type: 'search', placeholder: 'Buscar por aluno ou tema', 'aria-label': 'Buscar aulas', onInput: () => paint() });

  function paint() {
    const q = search.value.trim().toLowerCase();
    const rows = lessons.filter((l) => !q || `${l.title} ${l.student}`.toLowerCase().includes(q));
    tbody.replaceChildren(
      ...(rows.length
        ? rows.map((l) =>
            h('tr',
              h('td.title-cell', h('a', { href: `#/aula/${l.id}` }, l.title)),
              h('td', l.student || '—'),
              h('td', formatDate(l.updatedAt)),
              h('td', h('div.actions',
                h('button.btn.small', { type: 'button', onClick: () => duplicate(l) }, 'Duplicar'),
                h('a.btn.small.primary', { href: `#/aula/${l.id}` }, 'Abrir')
              ))
            )
          )
        : [h('tr', h('td.empty', { colspan: '4' }, q ? 'Nenhuma aula encontrada.' : 'Nenhuma aula ainda. Crie a primeira acima.'))])
    );
  }

  async function duplicate(l) {
    const student = prompt('Duplicar para qual aluno?', l.student);
    if (student === null) return;
    const copy = await api.duplicateLesson(l.id, { student, title: l.title });
    location.hash = `#/aula/${copy.id}`;
  }

  const student = h('input', { id: 'nf-student', type: 'text', placeholder: 'Ex.: Julia', autocomplete: 'off' });
  const title = h('input', { id: 'nf-title', type: 'text', placeholder: 'Ex.: Natural Disasters', autocomplete: 'off' });
  const form = h(
    'form.newform',
    {
      onSubmit: async (e) => {
        e.preventDefault();
        const lesson = await api.createLesson({ student: student.value, title: title.value });
        location.hash = `#/aula/${lesson.id}`;
      },
    },
    h('div.field', h('label', { for: 'nf-student' }, 'ALUNO OU TURMA'), student),
    h('div.field', h('label', { for: 'nf-title' }, 'TEMA DA AULA'), title),
    h('button.btn.primary', { type: 'submit' }, 'Criar aula em branco')
  );

  paint();
  root.replaceChildren(
    h('div.home',
      h('div.home-top', h('span.brand', 'TalkBox')),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        h('h1', 'Aulas'),
        h('div.stripe', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span'))
      ),
      h('div.card', form),
      h('div.card', { style: { display: 'flex', flexDirection: 'column', gap: '14px' } },
        search,
        h('div.table-wrap',
          h('table.list',
            h('thead', h('tr', h('th', 'TEMA'), h('th', 'ALUNO'), h('th', 'ATUALIZADA'), h('th', h('span', { class: 'sr-only' }, '')))),
            tbody
          )
        )
      )
    )
  );
  setTimeout(() => student.focus(), 0);
  return () => {};
}
