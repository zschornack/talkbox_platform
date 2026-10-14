// Início: atalhos e um resumo do que está acontecendo.
import { h, svgIcon, ICONS, relativeDate } from './dom.js';
import { api } from './api.js';
import { appShell } from './layout.js';
import { newLessonDialog, studentDialog } from './new-lesson.js';
import { newModelMenu } from './models.js';
import { BLOCKS, MENU } from './blocks/index.js';

const greeting = () => {
  const hr = new Date().getHours();
  return hr < 12 ? 'Bom dia!' : hr < 18 ? 'Boa tarde!' : 'Boa noite!';
};

export async function renderHome(root) {
  document.title = 'TalkBox';
  const data = await api.overview();
  const models = await api.models();

  const action = (icon, title, text, onClick, primary) =>
    h('button.quick' + (primary ? '.primary' : ''), { type: 'button', onClick },
      h('span.quick-icon', svgIcon(ICONS[icon], 22)),
      h('span.quick-text', h('strong', title), h('span', text)));

  const quick = h(
    'section.quick-row',
    { 'aria-label': 'Atalhos' },
    action('plus', 'Nova aula', 'Escolha o aluno e comece', () => newLessonDialog(), true),
    action('users', 'Novo aluno', 'Cadastre um aluno ou turma', () => studentDialog()),
    action('layers', 'Novo modelo', 'Crie uma atividade para reusar', (e) => newModelMenu(e.currentTarget))
  );

  // ---------- aulas recentes ----------
  const recent = h(
    'section.card.panel-card',
    h('div.card-head', h('h2', 'Aulas recentes')),
    data.recentLessons.length
      ? h('ul.rows',
          data.recentLessons.map((l) =>
            h('li', h('a.row-link', { href: `#/aula/${l.id}` },
              h('span.row-main', h('strong', l.title), h('span.muted', l.student || 'Sem aluno')),
              h('span.row-side', relativeDate(l.updatedAt), svgIcon(ICONS.arrow, 16))))
          ))
      : h('p.muted.pad', 'Nenhuma aula ainda. Use "Nova aula" acima.')
  );

  // ---------- alunos ----------
  const students = [...data.students].sort((a, b) => (b.lastLessonAt || '').localeCompare(a.lastLessonAt || '')).slice(0, 6);
  const studentsCard = h(
    'section.card.panel-card',
    h('div.card-head', h('h2', 'Alunos'), h('a.link', { href: '#/alunos' }, `Ver todos (${data.students.length})`)),
    students.length
      ? h('ul.rows',
          students.map((s) =>
            h('li', h('a.row-link', { href: `#/alunos/${s.id}` },
              h('span.row-main', h('strong', s.name), h('span.muted', s.goal || 'Sem objetivo cadastrado')),
              h('span.row-side', s.level ? h('span.level', s.level) : null,
                h('span.muted', s.lastLessonAt ? relativeDate(s.lastLessonAt) : 'sem aulas')))))
        )
      : h('p.muted.pad', 'Nenhum aluno ativo. Use "Novo aluno" acima.')
  );

  // ---------- modelos ----------
  const byType = {};
  models.forEach((m) => (byType[m.type] = (byType[m.type] || 0) + 1));
  const modelsCard = h(
    'section.card.panel-card.models-card',
    h('div.card-head', h('h2', 'Modelos'), h('a.link', { href: '#/modelos' }, `Abrir biblioteca (${models.length})`)),
    h('div.format-grid',
      MENU.filter((t) => t !== 'notes').map((t) =>
        h('a.format-tile', { href: `#/modelos?formato=${t}` },
          h('span.format-icon', svgIcon(ICONS[t], 20)),
          h('span', BLOCKS[t].name),
          h('strong', String(byType[t] || 0))))
    )
  );

  root.replaceChildren(
    appShell(
      'home',
      h('div.page',
        h('header.page-head',
          h('div.page-title',
            h('h1', greeting()),
            h('div.stripe', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
            h('p.page-sub', new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }))
          )
        ),
        quick,
        h('div.home-grid', recent, studentsCard),
        modelsCard
      )
    )
  );
  return () => {};
}
