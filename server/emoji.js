// Emojis são proibidos no material da escola (decisão do Miguel, 04/11/2026).
// Tira emojis (figuras, rostos, ícones e o seletor de emoji) e deixa os sinais de texto do material:
// setas (→ ← ↔ ↗), certo e errado (✓ ✗), ©, ® e ™.
const KEEP = /[©®™←-⇿✓✗]/u;
const EMOJI = /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*[  ]?|️|‍/gu;

export function stripEmoji(text) {
  if (typeof text !== 'string' || !text) return text;
  const out = text.replace(EMOJI, (m) => (KEEP.test(m[0]) ? m : ''));
  if (out === text) return text;
  // o emoji no fim deixava um espaço sobrando ("in English class "); no meio, dois espaços viram um
  return out.replace(/([^ \u00A0]) {2,}/g, '$1 ').replace(/[ \u00A0]+(?=<\/|$)/g, '');
}

/** Tira emojis de todos os textos de um objeto (blocos, documentos de aula, pacotes). Devolve uma cópia. */
export function stripEmojiDeep(value) {
  if (typeof value === 'string') return stripEmoji(value);
  if (Array.isArray(value)) return value.map(stripEmojiDeep);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripEmojiDeep(v)]));
  return value;
}
