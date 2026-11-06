// Marcações feitas durante a aula. Usado pelo app (navegador) e pelo servidor (sem DOM).
//
// O marca-texto da barra de formatação grava a cor do jeito do navegador: "background-color: rgb(255, 219, 143)".
// Os modelos e os pacotes da pasta content/ usam "#RRGGBB" (as cores da metodologia). É assim que dá para
// separar o que foi destacado na aula (sai na cópia) do que faz parte do material (fica).
// "Remover destaque" grava "transparent": também sai, porque não muda nada na tela.

const SPAN = /<(\/?)span\b([^>]*)>/gi;
const LIVE_BG = /background-color\s*:\s*(rgba?\([^)]*\)|transparent)/i;

/** Tira os destaques feitos na aula de um trecho de HTML. Devolve { html, removed }. */
export function stripLiveMarks(html) {
  const src = String(html ?? '');
  if (!/<span/i.test(src)) return { html: src, removed: 0 };
  const stack = [];
  let removed = 0;
  const out = src.replace(SPAN, (tag, closing, attrs) => {
    if (closing) {
      const open = stack.pop();
      return open === 'drop' ? '' : tag;
    }
    const style = (attrs.match(/style\s*=\s*"([^"]*)"/i) || attrs.match(/style\s*=\s*'([^']*)'/i) || [])[1];
    if (!style || !LIVE_BG.test(style)) {
      stack.push('keep');
      return tag;
    }
    removed++;
    const rest = style.split(';').map((s) => s.trim()).filter((s) => s && !/^background-color\s*:/i.test(s));
    if (!rest.length) {
      stack.push('drop');
      return '';
    }
    stack.push('keep');
    return `<span style="${rest.join('; ')}">`;
  });
  return { html: out, removed };
}

/** Quantos destaques feitos na aula existem num valor qualquer (texto, lista, objeto). */
export function countLiveMarks(value) {
  let n = 0;
  walk(value, (s) => { n += stripLiveMarks(s).removed; return s; });
  return n;
}

/** Tira os destaques feitos na aula de todos os textos de um bloco (muda o bloco). Devolve quantos saíram. */
export function stripBlockMarks(block) {
  let n = 0;
  walk(block, (s) => {
    const out = stripLiveMarks(s);
    n += out.removed;
    return out.html;
  });
  return n;
}

// Passa por todos os textos de um objeto (menos ids, endereços de imagem e tipo), trocando cada um pelo resultado de fn.
const SKIP = new Set(['id', 'type', 'src', 'pending', 'source', 'tense', 'layout', 'kind']);
function walk(value, fn) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      if (typeof v === 'string') value[i] = fn(v);
      else if (v && typeof v === 'object') walk(v, fn);
    });
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (SKIP.has(k)) continue;
      if (typeof v === 'string') value[k] = fn(v);
      else if (v && typeof v === 'object') walk(v, fn);
    }
  } else if (typeof value === 'string') {
    fn(value);
  }
}

/**
 * No editor de modelos, o que se destaca faz parte do material: as cores viram #RRGGBB (como nos pacotes)
 * e "Remover destaque" (transparent) sai. Assim a cópia de uma aula nunca confunde material com aula.
 */
export function toMaterialColors(value) {
  let n = 0;
  const hex = (x) => Number(x).toString(16).padStart(2, '0').toUpperCase();
  walk(value, (s) => {
    if (!/background-color/i.test(s)) return s;
    let out = s.replace(/background-color\s*:\s*rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/gi, (_, r, g, b) => { n++; return `background-color: #${hex(r)}${hex(g)}${hex(b)}`; });
    if (/transparent/i.test(out)) out = stripLiveMarks(out).html;
    return out;
  });
  return n;
}

/** Bloco sem ids nem origem, para comparar com o modelo de onde veio (a ordem das chaves não importa). */
export function comparable(block) {
  const c = JSON.parse(JSON.stringify(block || {}));
  delete c.id; delete c.source; delete c.pending; delete c.type; delete c.ref; delete c.local; delete c.edited;
  for (const key of ['items', 'pairs', 'marks', 'images']) (c[key] || []).forEach((it) => it && delete it.id);
  const sorted = (v) => (Array.isArray(v) ? v.map(sorted) : v && typeof v === 'object'
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sorted(v[k])])) : v);
  return JSON.stringify(sorted(c));
}
