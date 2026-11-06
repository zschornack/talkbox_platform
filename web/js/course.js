// Curso TalkBox: o roteiro das 100 aulas, em 10 níveis (seções). Cada aula pronta abre direto; dá para
// copiar a aula para um aluno ("Dar esta aula"). As que ainda não existem mostram o que vão ter.
import { h, svgIcon, ICONS, relativeDate } from './dom.js';
import { api } from './api.js';
import { appShell, pageHead } from './layout.js';
import { copyLessonDialog } from './new-lesson.js';
import { COURSE } from './course-data.js';

const html = (s) => { const el = h('span'); el.innerHTML = s; return el; };
const plain = (s) => String(s || '').replace(/<[^>]*>/g, '');

/** Os 10 níveis como estações de uma linha: usado no Início e no topo da página do curso. */
export function courseRoad(ready, { compact = false } = {}) {
  const have = new Set(ready.map((r) => r.number));
  return h('ol.road' + (compact ? '.compact' : ''), { 'aria-label': 'Os 10 níveis do curso' },
    COURSE.map((lv) => {
      const n = lv.lessons.filter((l) => have.has(l.n)).length;
      return h('li.road-stop', { class: n === lv.lessons.length ? 'full' : n ? 'some' : '' },
        h('a', { href: `#/curso?nivel=${lv.n}`, title: `Nível ${lv.n} · ${lv.cefr} · aulas ${lv.range}: ${plain(lv.canDo)}` },
          h('span.road-dot', String(lv.n)),
          h('span.road-cefr', lv.cefr),
          h('span.road-range', `aulas ${lv.range}`),
          h('span.road-bar', h('span', { style: { width: `${(n / lv.lessons.length) * 100}%` } })),
          h('span.road-count', `${n} de ${lv.lessons.length}`)));
    }));
}

export async function renderCourse(root, { level } = {}) {
  document.title = 'Curso · TalkBox';
  const ready = await api.course();
  const byNumber = new Map(ready.map((r) => [r.number, r]));

  const lessonRow = (l) => {
    const r = byNumber.get(l.n);
    const detail = h('dl.course-detail',
      h('dt', 'Assunto novo'), h('dd', html(l.topic)),
      h('dt', 'Revisar'), h('dd', html(l.review)),
      h('dt', 'Vocabulário novo'), h('dd', html(l.vocab)),
      h('dt', 'Vocabulário para revisar'), h('dd', html(l.reviewVocab)),
      h('dt', 'No fim da aula, o aluno consegue'), h('dd', html(l.canDo)));
    return h('li.course-lesson', { class: r ? 'ready' : '', id: `aula-${l.n}` },
      h('details',
        h('summary',
          h('span.cl-num', String(l.n)),
          h('span.cl-main', h('strong', l.theme), h('span.cl-topic', plain(l.topic))),
          r ? h('span.cl-state.ready', svgIcon(ICONS.check, 14), 'Pronta') : h('span.cl-state', 'A criar')),
        h('div.cl-body',
          detail,
          r
            ? h('div.cl-actions',
                h('a.btn.primary', { href: `#/aula/${r.id}` }, 'Abrir a aula'),
                h('button.btn', { type: 'button', onClick: () => copyLessonDialog({ id: r.id, title: r.title, studentId: null }) }, svgIcon(ICONS.copy, 16), 'Dar esta aula para um aluno…'),
                h('span.muted.small', `${r.blocks} blocos · mudou ${relativeDate(r.updatedAt)}`))
            : h('p.muted.small', 'Esta aula ainda não foi criada. O que ela vai ter está acima.'))));
  };

  const sections = COURSE.map((lv) => {
    const n = lv.lessons.filter((l) => byNumber.has(l.n)).length;
    return h('section.card.course-level', { id: `nivel-${lv.n}` },
      h('header.cl-head',
        h('div',
          h('p.cl-kicker', `Nível ${lv.n} · ${lv.cefr} · aulas ${lv.range}`),
          h('h2', plain(lv.canDo)),
          h('p.cl-intro', lv.intro || '')),
        h('span.cl-progress', `${n} de ${lv.lessons.length} prontas`)),
      h('div.cl-facts',
        h('div', h('span.cl-label', 'Tempos verbais novos'), h('span', lv.tenses)),
        h('div', h('span.cl-label', 'Outras estruturas'), h('span', lv.structures))),
      h('ol.course-lessons', lv.lessons.map(lessonRow)));
  });

  root.replaceChildren(
    appShell('course',
      h('div.page',
        pageHead({ title: 'Curso TalkBox', subtitle: `100 aulas em 10 níveis, do A1 ao C2 · ${ready.length} ${ready.length === 1 ? 'aula pronta' : 'aulas prontas'}` }),
        courseRoad(ready),
        h('p.muted.course-help', 'Clique numa aula para ver o que ela tem. As aulas prontas abrem direto e podem ser copiadas para um aluno, que recebe a aula sem as anotações.'),
        sections)));
  if (level) document.getElementById(`nivel-${level}`)?.scrollIntoView({ block: 'start' });
  return () => {};
}
