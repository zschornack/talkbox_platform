// Peças comuns aos blocos novos (v0.6): enunciado editável, painel de edição em linhas, embaralhar fixo.
import { h } from '../dom.js';
import { editable } from '../editable.js';

/** Enunciado do exercício, editável com um clique. */
export const instructions = (ctx, placeholder = 'Enunciado do exercício') =>
  editable(h('div.muted-text'), {
    value: ctx.block.html || '',
    placeholder,
    onChange: (v) => { ctx.block.html = v; ctx.changed(); },
  });

/** Número fixo a partir de um texto (para embaralhar sempre do mesmo jeito, também no PDF). */
export function hash(s) {
  let x = 2166136261;
  for (const c of String(s)) x = Math.imul(x ^ c.charCodeAt(0), 16777619);
  return x >>> 0;
}

/** Embaralha de um jeito fixo pela semente; nunca devolve a ordem original (se houver mais de 1 item). */
export function seededShuffle(arr, seed) {
  const out = arr.map((v, i) => ({ v, k: hash(seed + ':' + i) })).sort((a, b) => a.k - b.k).map((x) => x.v);
  if (out.length > 1 && out.every((v, i) => v === arr[i])) out.push(out.shift());
  return out;
}

/** Linhas não vazias de um texto. */
export const lines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

/**
 * Painel do professor com uma caixa de texto (uma coisa por linha).
 * parse(texto) devolve { ok: true } depois de aplicar, ou { error: 'mensagem' }.
 */
export function linesPanel(ctx, { title, help, value, parse, minHeight = '180px', extra = null }) {
  const error = h('div.help.err', { hidden: true });
  return h(
    'div.panel',
    h('h4', title),
    h('div.help', help),
    h('textarea', {
      'aria-label': title,
      style: { minHeight },
      value,
      onInput: (e) => {
        const out = parse(e.target.value) || {};
        error.hidden = !out.error;
        error.textContent = out.error || '';
        if (!out.error) ctx.changed();
      },
      onChange: () => ctx.rerender(),
    }),
    error,
    extra
  );
}

/** Botão do painel no canto do bloco. */
export const panelAction = (ctx, label) => ({
  label,
  on: !!ctx.local.panel,
  onClick: () => { ctx.local.panel = !ctx.local.panel; ctx.rerender(); },
});

export const norm = (s) =>
  String(s || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').replace(/\s*([.,!?])\s*$/, '$1').replace(/[.!?]$/, '');
