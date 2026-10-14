// Exportar como PDF (requisitos seção 11): usa a impressão do navegador em A4 ("Salvar como PDF").
import { h } from './dom.js';

let last = { blanks: 'filled', pen: false };

export function openExportDialog({ lesson, doc, flush }) {
  const radio = (name, value, label, checked) =>
    h('label', h('input', { type: 'radio', name, value, checked }), label);

  const form = h(
    'form.modal',
    {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'exp-title',
      onSubmit: async (e) => {
        e.preventDefault();
        const data = new FormData(form);
        last = { blanks: data.get('blanks'), pen: data.get('pen') === 'on' };
        close();
        await flush();
        print(lesson, doc, last);
      },
    },
    h('h2', { id: 'exp-title' }, 'Exportar PDF'),
    h('fieldset',
      h('legend', 'LACUNAS'),
      radio('blanks', 'filled', 'Preenchidas (como ficou na aula)', last.blanks === 'filled'),
      radio('blanks', 'empty', 'Em branco (para refazer em casa)', last.blanks === 'empty')
    ),
    h('fieldset',
      h('legend', 'CANETA'),
      h('label', h('input', { type: 'checkbox', name: 'pen', checked: last.pen }), 'Incluir os desenhos da caneta')
    ),
    h('div.help', { style: { fontSize: '14px', color: 'var(--muted)' } },
      'Na janela que abrir, escolha "Salvar como PDF" no destino.'),
    h('div.foot',
      h('button.btn', { type: 'button', onClick: () => close() }, 'Cancelar'),
      h('button.btn.primary', { type: 'submit' }, 'Gerar PDF')
    )
  );
  const bg = h('div.modal-bg', { onMousedown: (e) => e.target === bg && close() }, form);
  const onKey = (e) => e.key === 'Escape' && close();
  function close() {
    bg.remove();
    document.removeEventListener('keydown', onKey);
  }
  document.addEventListener('keydown', onKey);
  document.body.append(bg);
  form.querySelector('button[type=submit]').focus();
}

function print(lesson, doc, opts) {
  const before = document.title;
  const date = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  // O nome do arquivo PDF vem do título da página.
  document.title = [lesson.student, doc.title, date].filter(Boolean).join(' - ');
  document.body.classList.toggle('print-blank', opts.blanks === 'empty');
  document.body.classList.toggle('print-no-pen', !opts.pen);
  document.activeElement?.blur?.();
  window.getSelection()?.removeAllRanges();
  const restore = () => {
    document.title = before;
    document.body.classList.remove('print-blank', 'print-no-pen');
    window.removeEventListener('afterprint', restore);
  };
  window.addEventListener('afterprint', restore);
  setTimeout(() => window.print(), 30);
}
