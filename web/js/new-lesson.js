// Janelas de "Nova aula" e "Aluno" (criar/editar), usadas em várias telas.
import { h } from './dom.js';
import { api } from './api.js';
import { modal, field, levelSelect } from './ui.js';

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
