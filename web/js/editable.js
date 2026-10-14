// Todo texto da aula é editável com um clique (requisitos 9.3).
import { sanitize } from './sanitize.js';
import { escapeHtml } from './dom.js';

/**
 * Transforma um elemento em texto editável.
 * rich: aceita negrito/sublinhado/highlight. single: uma linha só (Enter não quebra).
 */
export function editable(el, { value = '', onChange, rich = true, single = false, placeholder = '', onKeyDown } = {}) {
  el.contentEditable = 'true';
  el.spellcheck = false;
  el.dataset.rich = rich ? '1' : '0';
  if (placeholder) el.dataset.placeholder = placeholder;
  el.innerHTML = rich ? sanitize(value) : escapeHtml(value);

  el.addEventListener('input', () => {
    // Quando o campo fica vazio, o navegador deixa um <br> sobrando: remove para o placeholder voltar.
    if (el.innerHTML === '<br>') el.innerHTML = '';
    onChange?.(rich ? sanitize(el.innerHTML) : el.textContent.replace(/ /g, ' '));
  });

  el.addEventListener('keydown', (e) => {
    if (single && e.key === 'Enter') e.preventDefault();
    onKeyDown?.(e);
  });

  // Colar sempre como texto simples, para não trazer fontes e cores de fora.
  el.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text/plain');
    const hasImage = [...(e.clipboardData?.items || [])].some((i) => i.type.startsWith('image/'));
    if (hasImage && !text) return; // deixa o editor tratar a imagem
    e.preventDefault();
    document.execCommand('insertText', false, single ? (text || '').replace(/\s*\n\s*/g, ' ') : text || '');
  });

  return el;
}
