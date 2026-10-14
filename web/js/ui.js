// Componentes de interface reutilizados: janela, confirmação, aviso, etiquetas.
import { h, svgIcon, ICONS } from './dom.js';

// ---------- aviso rápido (toast) ----------
let toastEl = null;
export function toast(msg, action) {
  toastEl?.remove();
  const el = h(
    'div.toast',
    { role: 'status' },
    h('span', msg),
    action ? h('button', { type: 'button', onClick: () => { action.run(); el.remove(); } }, action.label) : null
  );
  toastEl = el;
  document.body.append(el);
  setTimeout(() => el.remove(), action ? 7000 : 4000);
}

// ---------- janela (modal) ----------
/**
 * modal({ title, body, submitLabel, onSubmit, cancelLabel, danger, wide })
 * onSubmit pode ser async; se lançar erro, a mensagem aparece na janela e ela não fecha.
 */
export function modal({ title, body, submitLabel = 'Salvar', onSubmit, cancelLabel = 'Cancelar', danger = false, wide = false }) {
  const restore = document.activeElement;
  const error = h('div.form-error', { role: 'alert', hidden: true });
  const submit = h('button.btn' + (danger ? '.danger' : '.primary'), { type: 'submit' }, submitLabel);
  const titleId = 'm' + Math.random().toString(36).slice(2, 8);
  const form = h(
    'form.modal' + (wide ? '.wide' : ''),
    {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': titleId,
      onSubmit: async (e) => {
        e.preventDefault();
        error.hidden = true;
        submit.disabled = true;
        try {
          const keep = await onSubmit?.(form);
          if (keep !== false) close();
        } catch (err) {
          error.textContent = err.message || String(err);
          error.hidden = false;
        } finally {
          submit.disabled = false;
        }
      },
    },
    h('div.modal-head', h('h2', { id: titleId }, title),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Fechar', onClick: () => close() }, svgIcon(ICONS.x))),
    h('div.modal-body', body),
    error,
    h('div.foot', cancelLabel ? h('button.btn', { type: 'button', onClick: () => close() }, cancelLabel) : null, submit)
  );
  const bg = h('div.modal-bg', { onMousedown: (e) => e.target === bg && close() }, form);
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') {
      const f = [...form.querySelectorAll('button, input, select, textarea, [tabindex="0"]')].filter((x) => !x.disabled && x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  };
  function close() {
    bg.remove();
    document.removeEventListener('keydown', onKey, true);
    restore?.focus?.();
  }
  document.addEventListener('keydown', onKey, true);
  document.body.append(bg);
  (form.querySelector('.modal-body input, .modal-body select, .modal-body textarea') || submit).focus();
  return { close, form };
}

export function confirmDialog(message, { title = 'Tem certeza?', confirmLabel = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const m = modal({
      title,
      body: h('p.modal-text', message),
      submitLabel: confirmLabel,
      danger,
      onSubmit: () => { answered = true; resolve(true); },
    });
    const obs = new MutationObserver(() => {
      if (!m.form.isConnected) { obs.disconnect(); if (!answered) resolve(false); }
    });
    obs.observe(document.body, { childList: true });
  });
}

// ---------- campos ----------
export const field = (label, input, hint) => {
  const id = input.id || (input.id = 'f' + Math.random().toString(36).slice(2, 8));
  return h('div.field', h('label', { for: id }, label), input, hint ? h('div.field-hint', hint) : null);
};

export function levelSelect(value = '', { allowEmpty = true } = {}) {
  return h(
    'select',
    { value },
    allowEmpty ? h('option', { value: '' }, '—') : null,
    ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((l) => h('option', { value: l }, l))
  );
}

/** Botões de liga/desliga (vários podem ficar ligados). */
export function toggleChips({ options, value = [], onChange, label, counts }) {
  const sel = new Set(value);
  const wrap = h('div.toggle-chips', { role: 'group', 'aria-label': label });
  const paint = () =>
    wrap.replaceChildren(
      ...options.map((o) => {
        const key = typeof o === 'string' ? o : o.value;
        const text = typeof o === 'string' ? o : o.label;
        const on = sel.has(key);
        const n = counts?.[key];
        return h(
          'button.tchip',
          {
            type: 'button',
            class: on ? 'on' : '',
            'aria-pressed': String(on),
            onClick: () => {
              on ? sel.delete(key) : sel.add(key);
              paint();
              onChange?.([...sel]);
            },
          },
          o.icon ? svgIcon(ICONS[o.icon], 15) : null,
          text,
          n != null ? h('span.count', String(n)) : null
        );
      })
    );
  paint();
  wrap.setValue = (v) => { sel.clear(); v.forEach((x) => sel.add(x)); paint(); };
  return wrap;
}

/** Campo de etiquetas livres: digita e Enter (ou vírgula) para adicionar. */
export function tagInput({ value = [], suggestions = [], onChange, placeholder = 'Digite e aperte Enter', label }) {
  const tags = [...value];
  const listId = 'dl' + Math.random().toString(36).slice(2, 8);
  const input = h('input', { type: 'text', list: listId, placeholder, 'aria-label': label, autocomplete: 'off' });
  const chips = h('span.tag-list');
  const datalist = h('datalist', { id: listId });
  const paint = () => {
    chips.replaceChildren(
      ...tags.map((t, i) =>
        h('span.tag', t,
          h('button', { type: 'button', 'aria-label': `Remover ${t}`, onClick: () => { tags.splice(i, 1); paint(); onChange?.([...tags]); input.focus(); } }, '×'))
      )
    );
    datalist.replaceChildren(...suggestions.filter((s) => !tags.includes(s)).map((s) => h('option', { value: s })));
  };
  const add = () => {
    const v = input.value.replace(/,/g, '').trim();
    input.value = '';
    if (!v) return;
    const match = suggestions.find((s) => s.toLowerCase() === v.toLowerCase()) || v;
    if (!tags.some((t) => t.toLowerCase() === match.toLowerCase())) {
      tags.push(match);
      paint();
      onChange?.([...tags]);
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !input.value && tags.length) { tags.pop(); paint(); onChange?.([...tags]); }
  });
  // escolher uma sugestão da lista já adiciona
  input.addEventListener('input', (e) => { if (!e.inputType && suggestions.includes(input.value)) add(); });
  input.addEventListener('blur', add);
  paint();
  return h('div.tag-input', { onClick: (e) => e.target === e.currentTarget && input.focus() }, chips, input, datalist);
}

export function emptyState(title, text, action) {
  return h('div.empty-state', h('strong', title), text ? h('p', text) : null, action || null);
}
