// Ficha do aluno (requisitos, seção 6).
import { h, svgIcon, ICONS, formatDate, relativeDate, shortDate } from './dom.js';
import { api, autosaver, saveOnExit } from './api.js';
import { appShell } from './layout.js';
import { newLessonDialog, studentDialog } from './new-lesson.js';
import { toast, confirmDialog, emptyState, modal } from './ui.js';
import { BLOCKS } from './blocks/index.js';
import { MAP_SECTIONS, MAP_STATUS } from './catalog.js';

export async function renderStudent(root, id) {
  let s;
  try {
    s = await api.student(id);
  } catch {
    root.replaceChildren(appShell('students', h('div.page', emptyState('Aluno não encontrado.', null, h('a.btn', { href: '#/alunos' }, 'Voltar para Alunos')))));
    return () => {};
  }
  document.title = `${s.name} · TalkBox`;
  const status = h('span.save-status', { role: 'status', 'aria-live': 'polite' });
  const saver = autosaver({ save: (body) => api.saveStudent(id, body), statusEl: status });

  // ---------- cabeçalho ----------
  const head = h(
    'header.page-head',
    h('div.page-title',
      h('a.back-link', { href: '#/alunos' }, svgIcon(ICONS.back, 16), 'Alunos'),
      h('div.name-line',
        h('h1', s.name),
        s.level ? h('span.level.big', s.level) : null,
        s.active ? null : h('span.badge.inactive', 'Inativo')),
      h('div.stripe', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
      s.goal ? h('p.page-sub', s.goal) : null
    ),
    h('div.page-actions',
      s.active ? h('button.btn.primary', { type: 'button', onClick: () => newLessonDialog({ studentId: id }) }, svgIcon(ICONS.plus), 'Nova aula') : null,
      h('button.btn', { type: 'button', onClick: () => studentDialog({ student: s, afterSave: () => rerender() }) }, svgIcon(ICONS.edit), 'Editar'),
      h('button.btn', {
        type: 'button',
        onClick: async () => {
          await api.saveStudent(id, { active: !s.active });
          toast(s.active ? 'Aluno movido para os inativos. Nada foi apagado.' : 'Aluno reativado.');
          rerender();
        },
      }, svgIcon(ICONS[s.active ? 'archive' : 'restore']), s.active ? 'Inativar' : 'Reativar')
    )
  );

  // ---------- objetivo e observações ----------
  const notes = h('textarea.notes-area', {
    'aria-label': 'Objetivo e observações',
    placeholder: 'Objetivo, profissão, interesses, dificuldades recorrentes…',
    value: s.notes || '',
    onInput: (e) => { autosize(e.target); saver.queue({ notes: e.target.value }); },
  });
  const notesCard = h('section.card.ficha-card',
    h('div.card-head', h('h2', 'Objetivo e observações'), status),
    notes);

  // ---------- onde paramos ----------
  const stop = s.stop || { lesson: null, message: '', pending: [] };
  const preparing = s.lessons.filter((l) => l.status === 'preparing');
  const prepareNext = async () => {
    newLessonDialog({ studentId: id });
  };
  const pendingList = h('ul.pending-list');
  const paintPending = () => {
    pendingList.replaceChildren(
      ...stop.pending.map((p) =>
        h('li',
          svgIcon(ICONS[p.type] || ICONS.text, 16),
          h('span.pending-name', p.title || BLOCKS[p.type]?.name || p.type),
          h('span.muted.small', `desde ${shortDate(p.since)}`),
          h('button.icon-btn', {
            type: 'button',
            title: 'Descartar: não precisa mais',
            'aria-label': `Descartar pendência ${p.title}`,
            onClick: async () => {
              if (!(await confirmDialog(`"${p.title || BLOCKS[p.type]?.name}" deixa de entrar na próxima aula.`, { title: 'Descartar pendência?', confirmLabel: 'Descartar' }))) return;
              await api.discardPending(p.id);
              stop.pending = stop.pending.filter((x) => x.id !== p.id);
              paintPending();
              toast('Pendência descartada.');
            },
          }, svgIcon(ICONS.x, 16))))
    );
    pendingBox.hidden = !stop.pending.length;
  };
  const pendingBox = h('div.where-pending', h('h3', 'Ficou pendente'), pendingList);
  paintPending();

  const where = h('section.card.where-card',
    h('div.card-head', h('h2', 'Onde paramos')),
    stop.lesson
      ? h('div.where-body',
          h('div.where-main',
            h('span.muted', `${formatDate(stop.lesson.date)} · ${relativeDate(stop.lesson.date)}${stop.lesson.number ? ` · aula ${stop.lesson.number}` : ''}`),
            h('strong.where-title', stop.lesson.title),
            stop.lesson.contents.length ? h('div.tag-row', stop.lesson.contents.map((c) => h('span.chip', c))) : null,
            pendingBox,
            h('div.where-message', h('h3', 'Anotação'), h('p', stop.message || 'Sem anotação: está tudo certo.'))),
          h('div.where-actions',
            h('a.btn', { href: `#/aula/${stop.lesson.id}` }, 'Abrir última aula'),
            s.active ? h('button.btn.primary', { type: 'button', onClick: prepareNext, title: 'Cria a aula já com os pendentes e a anotação' }, 'Preparar próxima aula') : null,
            preparing.map((l) => h('a.btn.small', { href: `#/aula/${l.id}` }, `Em preparação: ${l.title}`))))
      : h('div.where-body',
          h('p.muted', s.lessons.length
            ? 'Nenhuma aula finalizada ainda. Use "Finalizar aula" no fim de cada aula para registrar até onde chegaram.'
            : 'Ainda não tem aulas.'),
          h('div.where-actions',
            s.active ? h('button.btn.primary', { type: 'button', onClick: () => newLessonDialog({ studentId: id }) }, s.lessons.length ? 'Nova aula' : 'Criar a primeira aula') : null,
            preparing.map((l) => h('a.btn.small', { href: `#/aula/${l.id}` }, `Em preparação: ${l.title}`))))
  );

  // ---------- mapa de conteúdos ----------
  const map = { ...(s.map || {}) };
  const mapCard = h('section.card.ficha-card',
    h('div.card-head', h('h2', 'Mapa de conteúdos'),
      h('div.legend',
        h('span.lg.good', 'Já está bom'), h('span.lg.practicing', 'Praticando'), h('span.lg.none', 'Nunca viu')),
      h('button.btn.small', { type: 'button', onClick: () => mapHistoryDialog(s) }, svgIcon(ICONS.clock, 15), 'Evolução')),
    h('p.muted.small', 'O "Finalizar aula" atualiza o mapa sozinho. Para corrigir, clique num conteúdo.'),
    MAP_SECTIONS.map((sec) => {
      const summary = h('span.map-summary');
      const chips = h('div.map-chips');
      const paint = () => {
        const n = { good: 0, practicing: 0, none: 0 };
        chips.replaceChildren(
          ...sec.items.map((item) => {
            const st = map[item] || 'none';
            n[st]++;
            return h('button.map-chip', {
              type: 'button',
              class: st,
              title: `${MAP_STATUS[st].label}${s.mapSince?.[item] && st !== 'none' ? ` desde ${formatDate(s.mapSince[item])}` : ''}. Clique para mudar.`,
              'aria-label': `${item}: ${MAP_STATUS[st].label}`,
              onClick: () => {
                const next = MAP_STATUS[st].next;
                if (next === 'none') delete map[item]; else map[item] = next;
                paint();
                saver.queue({ map });
              },
            }, item);
          })
        );
        summary.textContent = `${n.good} ${n.good === 1 ? 'bom' : 'bons'} · ${n.practicing} praticando · ${n.none} nunca ${n.none === 1 ? 'visto' : 'vistos'}`;
      };
      paint();
      return h('div.map-section', h('div.map-head', h('h3', sec.name), summary), chips);
    })
  );

  // ---------- histórico ----------
  const histBody = h('tbody');
  const paintHistory = () => {
    histBody.replaceChildren(
      ...(s.lessons.length
        ? s.lessons.map((l) =>
            h('tr',
              h('td.nowrap', formatDate(l.date || l.createdAt), l.number ? h('div.muted.small', `aula ${l.number}`) : null),
              h('td', h('a.name-link', { href: `#/aula/${l.id}` }, l.title),
                l.status === 'preparing' ? h('span.badge.preparing', 'Em preparação') : null),
              h('td', h('div.tag-row', l.level ? h('span.level', l.level) : null, (l.contents.length ? l.contents : l.tags).map((t) => h('span.chip', t)))),
              h('td', h('div.actions',
                h('a.btn.small', { href: `#/aula/${l.id}` }, 'Abrir'),
                h('a.btn.small', { href: `#/aula/${l.id}/pdf`, title: 'Abre a aula e a janela de exportar' }, 'PDF'),
                h('button.icon-btn', { type: 'button', title: 'Duplicar como nova aula', 'aria-label': `Duplicar ${l.title}`,
                  onClick: async () => { const c = await api.duplicateLesson(l.id, {}); location.hash = `#/aula/${c.id}`; } }, svgIcon(ICONS.copy)),
                h('button.icon-btn', { type: 'button', title: 'Arquivar aula', 'aria-label': `Arquivar ${l.title}`,
                  onClick: async () => {
                    if (!(await confirmDialog(`A aula "${l.title}" de ${formatDate(l.date || l.createdAt)} sai da ficha. Ela continua guardada no banco.`, { title: 'Arquivar aula?', confirmLabel: 'Arquivar aula' }))) return;
                    await api.deleteLesson(l.id);
                    s.lessons = s.lessons.filter((x) => x.id !== l.id);
                    paintHistory();
                    toast('Aula arquivada.');
                  } }, svgIcon(ICONS.archive))
              ))
            )
          )
        : [h('tr', h('td', { colspan: '4' }, h('p.muted.pad', 'Nenhuma aula ainda.')))])
    );
  };
  paintHistory();
  const history = h('section.card.ficha-card',
    h('div.card-head', h('h2', 'Histórico de aulas'), h('span.muted', `${s.lessons.length} ${s.lessons.length === 1 ? 'aula' : 'aulas'}`)),
    h('div.table-wrap', h('table.list',
      h('thead', h('tr', h('th', 'DATA'), h('th', 'TEMA'), h('th', 'CONTEÚDO VISTO'), h('th', h('span.sr-only', 'Ações')))),
      histBody)));

  root.replaceChildren(
    appShell('students',
      h('div.page.ficha',
        head,
        h('div.ficha-grid', where, notesCard),
        mapCard,
        history))
  );
  autosize(notes);

  async function rerender() {
    await saver.flush();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  const onExit = () => { if (saver.pending) saveOnExit(`/api/students/${id}`, saver.pending); };
  window.addEventListener('beforeunload', onExit);
  return () => { window.removeEventListener('beforeunload', onExit); saver.flush(); };
}

const STATUS_LABEL = { good: 'Já está bom', practicing: 'Praticando', none: 'Nunca viu' };

/** Evolução do mapa: todas as avaliações, da mais recente para a mais antiga. */
async function mapHistoryDialog(s) {
  const rows = (await api.mapHistory(s.id, '')).reverse();
  modal({
    title: `Evolução do mapa · ${s.name}`,
    wide: true,
    submitLabel: 'Fechar',
    cancelLabel: null,
    body: rows.length
      ? h('div.table-wrap', h('table.list',
          h('thead', h('tr', h('th', 'DATA'), h('th', 'CONTEÚDO'), h('th', 'STATUS'), h('th', 'ORIGEM'))),
          h('tbody', rows.map((r) =>
            h('tr',
              h('td.nowrap', formatDate(r.date)),
              h('td', r.content),
              h('td', h('span.map-chip.static', { class: r.status }, STATUS_LABEL[r.status])),
              h('td', r.manual ? h('span.muted', 'ajuste na ficha') : h('a.name-link', { href: `#/aula/${r.lessonId}` }, r.lessonTitle || 'aula'))))))
        )
      : h('p.muted', 'Nenhuma avaliação ainda. Elas aparecem aqui quando você finaliza uma aula ou muda um conteúdo no mapa.'),
    onSubmit: () => {},
  });
}

function autosize(el) {
  el.style.height = 'auto';
  el.style.height = Math.max(el.scrollHeight, 96) + 'px';
}
