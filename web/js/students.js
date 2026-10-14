// Alunos e turmas (requisitos, seção 5).
import { h, svgIcon, ICONS, formatDate, parseHash } from './dom.js';
import { api } from './api.js';
import { appShell, pageHead } from './layout.js';
import { newLessonDialog, studentDialog } from './new-lesson.js';
import { toast, emptyState } from './ui.js';

export async function renderStudents(root) {
  document.title = 'Alunos · TalkBox';
  const { query } = parseHash();
  let status = query.get('status') === 'inactive' ? 'inactive' : 'active';
  let students = await api.students();

  const tbody = h('tbody');
  const counter = h('span.muted');
  const search = h('input.search', { type: 'search', placeholder: 'Buscar por nome', 'aria-label': 'Buscar alunos', onInput: () => paint() });

  const seg = h('div.segmented', { role: 'group', 'aria-label': 'Mostrar' });
  const paintSeg = () =>
    seg.replaceChildren(
      ...[['active', 'Ativos'], ['inactive', 'Inativos']].map(([k, label]) =>
        h('button', {
          type: 'button',
          class: status === k ? 'on' : '',
          'aria-pressed': String(status === k),
          onClick: () => { status = k; history.replaceState(null, '', `#/alunos${k === 'inactive' ? '?status=inactive' : ''}`); paintSeg(); paint(); },
        }, label, h('span.count', String(students.filter((s) => s.active === (k === 'active')).length)))
      )
    );

  async function setActive(s, active) {
    await api.saveStudent(s.id, { active });
    students = await api.students();
    paintSeg();
    paint();
    toast(active ? `${s.name} voltou para os ativos.` : `${s.name} foi para os inativos. Nada foi apagado.`, {
      label: 'Desfazer',
      run: async () => { await api.saveStudent(s.id, { active: !active }); students = await api.students(); paintSeg(); paint(); },
    });
  }

  function paint() {
    const q = search.value.trim().toLowerCase();
    const rows = students.filter((s) => s.active === (status === 'active') && (!q || s.name.toLowerCase().includes(q)));
    counter.textContent = `${rows.length} ${rows.length === 1 ? 'aluno' : 'alunos'}`;
    if (!rows.length) {
      tbody.replaceChildren(h('tr', h('td', { colspan: '5' },
        q ? emptyState('Ninguém com esse nome.', null)
          : status === 'active'
            ? emptyState('Nenhum aluno ativo.', 'Cadastre o primeiro aluno ou turma.', h('button.btn.primary', { type: 'button', onClick: () => studentDialog() }, 'Novo aluno'))
            : emptyState('Nenhum aluno inativo.', 'Quem você inativar aparece aqui, com todo o histórico guardado.'))));
      return;
    }
    tbody.replaceChildren(
      ...rows.map((s) =>
        h('tr',
          h('td', h('a.name-link', { href: `#/alunos/${s.id}` }, s.name)),
          h('td.goal-cell', s.goal || h('span.muted', '—')),
          h('td', s.level ? h('span.level', s.level) : h('span.muted', '—')),
          h('td', s.lastLessonAt ? formatDate(s.lastLessonAt) : h('span.muted', 'sem aulas')),
          h('td', h('div.actions',
            s.active ? h('button.btn.small.primary', { type: 'button', onClick: () => newLessonDialog({ studentId: s.id }) }, svgIcon(ICONS.plus, 16), 'Nova aula') : null,
            h('a.btn.small', { href: `#/alunos/${s.id}` }, 'Ficha'),
            h('button.icon-btn', { type: 'button', title: 'Editar', 'aria-label': `Editar ${s.name}`,
              onClick: () => studentDialog({ student: s, afterSave: async () => { students = await api.students(); paint(); } }) }, svgIcon(ICONS.edit)),
            h('button.icon-btn', { type: 'button', title: s.active ? 'Mover para inativos' : 'Reativar', 'aria-label': `${s.active ? 'Inativar' : 'Reativar'} ${s.name}`,
              onClick: () => setActive(s, !s.active) }, svgIcon(ICONS[s.active ? 'archive' : 'restore']))
          ))
        )
      )
    );
  }

  paintSeg();
  paint();
  root.replaceChildren(
    appShell('students',
      h('div.page',
        pageHead({
          title: 'Alunos',
          subtitle: 'Alunos e turmas. Turmas funcionam igual a um aluno.',
          actions: h('button.btn.primary', { type: 'button', onClick: () => studentDialog() }, svgIcon(ICONS.plus), 'Novo aluno'),
        }),
        h('section.card',
          h('div.toolbar', search, seg, counter),
          h('div.table-wrap',
            h('table.list',
              h('thead', h('tr', h('th', 'NOME'), h('th', 'OBJETIVO'), h('th', 'NÍVEL'), h('th', 'ÚLTIMA AULA'), h('th', h('span.sr-only', 'Ações')))),
              tbody)))
      )
    )
  );
  search.focus();
  return () => {};
}
