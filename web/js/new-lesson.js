// Janelas de "Nova aula" e "Aluno" (criar/editar), usadas em várias telas.
import { h } from './dom.js';
import { api } from './api.js';
import { modal, field, levelSelect, toast } from './ui.js';

/** Nova aula. Se studentId vier, o aluno já está escolhido. */
export async function newLessonDialog({ studentId } = {}) {
  const students = studentId ? [] : await api.students('active');
  if (!studentId && !students.length) {
    return studentDialog({ afterCreate: (s) => newLessonDialog({ studentId: s.id }) });
  }
  const fixed = studentId ? await api.student(studentId) : null;
  const select = fixed
    ? null
    : h('select', { required: true }, h('option', { value: '' }, 'Escolha…'), students.map((s) => h('option', { value: s.id }, s.name)));
  const title = h('input', { type: 'text', placeholder: 'Ex.: Natural Disasters', autocomplete: 'off', maxlength: '200' });

  // pendentes e recado da última aula: entram na aula nova (marcado por padrão)
  const carry = h('input', { type: 'checkbox', checked: true });
  const carryText = h('span');
  const carryRow = h('label.check-row', { hidden: true }, carry, carryText);
  const showCarry = (st) => {
    const n = st?.stop?.pending?.length || 0;
    const msg = !!st?.stop?.message;
    carryRow.hidden = !n && !msg;
    carryText.textContent = [n ? `Trazer ${n === 1 ? 'o pendente' : `os ${n} pendentes`} da última aula` : '', msg ? (n ? 'e a anotação' : 'Mostrar a anotação da aula anterior') : ''].filter(Boolean).join(' ');
  };
  if (fixed) showCarry(fixed);
  select?.addEventListener('change', async () => showCarry(select.value ? await api.student(select.value) : null));

  modal({
    title: fixed ? `Nova aula · ${fixed.name}` : 'Nova aula',
    submitLabel: 'Criar e abrir',
    body: [
      select ? field('Aluno ou turma', select) : null,
      field('Tema da aula', title, 'Dá para mudar depois, direto na aula.'),
      carryRow,
    ],
    onSubmit: async () => {
      const sid = fixed?.id || select.value;
      if (!sid) throw new Error('Escolha o aluno.');
      const lesson = !carryRow.hidden && carry.checked
        ? await api.nextLesson(sid, { title: title.value })
        : await api.createLessonFor(sid, { title: title.value });
      location.hash = `#/aula/${lesson.id}`;
    },
  });
  if (fixed) title.focus();
}

/** Cadastrar ou editar aluno/turma. */
export function studentDialog({ student, afterCreate, afterSave } = {}) {
  const name = h('input', { type: 'text', value: student?.name || '', required: true, maxlength: '120', autocomplete: 'off', placeholder: 'Ex.: Julia  ·  Vini & Bia' });
  const level = levelSelect(student?.level || '');
  const goal = h('input', { type: 'text', value: student?.goal || '', maxlength: '300', autocomplete: 'off', placeholder: 'Ex.: Conversação para viagens' });
  modal({
    title: student ? 'Editar aluno' : 'Novo aluno',
    submitLabel: student ? 'Salvar' : 'Cadastrar',
    body: [
      field('Nome', name, 'Turma: escreva os nomes juntos, como "Vini & Bia".'),
      h('div.field-row', field('Nível', level), field('Objetivo', goal)),
    ],
    onSubmit: async () => {
      const data = { name: name.value, level: level.value, goal: goal.value };
      if (student) {
        const saved = await api.saveStudent(student.id, data);
        afterSave?.(saved);
      } else {
        const created = await api.createStudent(data);
        if (afterCreate) setTimeout(() => afterCreate(created), 0);
        else location.hash = `#/alunos/${created.id}`;
      }
    },
  });
}

/**
 * Copiar uma aula (para o mesmo aluno ou para outro). A cópia leva só o material:
 * sem respostas, caneta, anotações, pendências e anotação para a próxima aula.
 * lesson = { id, title, studentId }
 */
export async function copyLessonDialog(lesson) {
  const [info, students] = await Promise.all([api.copyInfo(lesson.id), api.students('active')]);
  const select = h('select', { required: true },
    students.map((s) => h('option', { value: s.id }, s.name)));
  if (students.some((s) => s.id === lesson.studentId)) select.value = lesson.studentId;
  const title = h('input', { type: 'text', value: info.title || lesson.title, maxlength: '200', autocomplete: 'off' });
  const original = h('input', { type: 'checkbox', checked: true });
  const keepMarks = h('input', { type: 'checkbox', checked: false });
  const n = info.changed.length;
  // marca-texto: quando os blocos da biblioteca voltam ao original, só sobram os dos outros blocos
  const marksText = h('span');
  const marksRow = h('label.check-row', keepMarks, marksText);
  const paintMarks = () => {
    const count = original.checked ? info.marksFree : info.marks;
    marksRow.hidden = !count;
    marksText.textContent = `Manter o marca-texto feito na aula (${count} ${count === 1 ? 'destaque' : 'destaques'}${original.checked ? ' nos blocos que não vieram da biblioteca' : ''}). As cores do material sempre ficam.`;
  };
  original.addEventListener('change', paintMarks);
  paintMarks();
  modal({
    title: 'Copiar aula',
    submitLabel: 'Copiar e abrir',
    wide: true,
    body: [
      h('div.field-row', field('Para qual aluno?', select), field('Tema da aula', title)),
      h('div.copy-info',
        h('strong', 'A cópia vai sem:'),
        h('ul',
          h('li', 'as respostas dos exercícios e os desenhos da caneta;'),
          h('li', info.notes ? 'o que está escrito nas anotações (o bloco vai vazio);' : 'anotações (o bloco vai vazio);'),
          h('li', 'a anotação para a próxima aula e as pendências.'))),
      info.fromModels
        ? h('label.check-row', original,
            h('span', h('b', 'Voltar os blocos da biblioteca ao original. '),
              n ? `${n} ${n === 1 ? 'bloco mudou' : 'blocos mudaram'} desde que ${n === 1 ? 'entrou' : 'entraram'} na aula (o que foi escrito ou destacado na aula): ${info.changed.slice(0, 4).join('; ')}${n > 4 ? '…' : ''}.`
                : 'Nenhum bloco da biblioteca mudou nesta aula.'))
        : null,
      marksRow,
    ],
    onSubmit: async () => {
      if (!select.value) throw new Error('Escolha o aluno.');
      const copy = await api.duplicateLesson(lesson.id, { studentId: select.value, title: title.value, original: original.checked, keepMarks: keepMarks.checked });
      const r = copy.report || {};
      const parts = [r.restored ? `${r.restored} ${r.restored === 1 ? 'bloco voltou' : 'blocos voltaram'} ao original` : '', r.marks ? `${r.marks} ${r.marks === 1 ? 'destaque saiu' : 'destaques saíram'}` : ''].filter(Boolean);
      location.hash = `#/aula/${copy.id}`;
      setTimeout(() => toast(`Aula copiada para ${students.find((s) => s.id === select.value)?.name || 'o aluno'}${parts.length ? ': ' + parts.join(', ') : ''}.`), 300);
    },
  });
}
