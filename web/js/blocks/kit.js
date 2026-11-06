// Peças comuns aos blocos novos (v0.6): enunciado editável, painel de edição em linhas, embaralhar fixo.
import { h } from '../dom.js';
import { editable } from '../editable.js';

/**
 * Largura das colunas de uma tabela pelo conteúdo (v1.1). Devolve o grid-template-columns.
 * rows = linhas de células (HTML ou texto).
 * - Coluna curta ("I / You / He", "have", "eaten"): do tamanho do conteúdo, numa linha.
 * - Coluna de frases (exemplos, explicações): fica com o resto da largura, na proporção do texto.
 * - Se todas são curtas (tabela de tempo verbal), a última fica com o resto.
 * As medidas usam a letra da tabela (--cell, em px), igual em todas as linhas: o cabeçalho tem letra
 * menor e, se a conta usasse o "em" de cada linha, as colunas do cabeçalho sairiam desalinhadas.
 */
export function columnTemplate(rows, cols) {
  // texto da célula sem HTML; quebra de linha (<br>, Enter na célula) separa linhas
  const plain = (v) => String(v ?? '').replace(/<br\s*\/?>|<\/(?:div|p|li)>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, ' ');
  const line = (v) => plain(v).split('\n').reduce((m, l) => Math.max(m, l.trim().length), 0);
  const words = (v) => plain(v).split(/\s+/).reduce((m, w) => Math.max(m, w.length), 0);
  // teto de cada coluna: a soma nunca passa da largura da tabela (senão a última coluna some).
  // Só numa tabela estreita demais (muitas colunas, tela pequena) uma palavra longa quebra.
  const cap = Math.floor(10000 / Math.max(1, cols)) / 100;
  const len = (n) => `min(calc(var(--cell, 1em) * ${n}), ${cap}%)`;
  const SHORT = 16;
  const info = Array.from({ length: cols }, (_, ci) => {
    const longest = Math.max(0, ...rows.map((r) => line(r[ci])));
    // nenhuma palavra quebra no meio: a coluna é pelo menos tão larga quanto a palavra mais longa
    const word = Math.max(0, ...rows.map((r) => words(r[ci])));
    return { longest, min: Math.max(3, Math.ceil(word * 0.62 + 2.8)) };
  });
  const allShort = info.every((c) => c.longest <= SHORT);
  return info.map((c, ci) => {
    const last = ci === cols - 1;
    if (c.longest <= SHORT && !(allShort && last)) return len(Math.max(c.min, Math.ceil(c.longest * 0.56 + 2.6)));
    return `minmax(${len(c.min)}, ${Math.min(36, Math.max(6, c.longest))}fr)`;
  }).join(' ');
}

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

/** Sequência de números "aleatórios" fixa pela semente (mulberry32): a mesma semente dá sempre a mesma sequência. */
export function seededRandom(seed) {
  let a = hash(seed) ^ 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Embaralha de verdade (Fisher-Yates), mas fixo pela semente: o mesmo bloco fica igual ao reabrir e no PDF.
 * Nunca devolve a ordem original (se houver mais de 1 item). O material pode vir em qualquer ordem: quem embaralha é o app.
 */
export function seededShuffle(arr, seed) {
  const rnd = seededRandom(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
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
