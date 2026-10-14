// Prévia em texto de um bloco (cartões da biblioteca de modelos).
import { toText } from '../sanitize.js';

const clip = (s, n = 120) => {
  s = String(s || '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
};

/** Devolve { lines: string[], count?: string, image?: url } */
export function summarize(block) {
  switch (block.type) {
    case 'fill': {
      const items = block.items || [];
      return {
        lines: items.slice(0, 3).map((it) => clip(`${toText(it.before)} ___ ${toText(it.after)}`, 80)),
        count: `${items.length} ${items.length === 1 ? 'frase' : 'frases'}`,
      };
    }
    case 'choice': {
      const items = block.items || [];
      return {
        lines: items.slice(0, 3).map((it) => clip(`${toText(it.before)} [${it.options.join(' / ')}] ${toText(it.after)}`, 90)),
        count: `${items.length} ${items.length === 1 ? 'questão' : 'questões'}`,
      };
    }
    case 'match': {
      const pairs = block.pairs || [];
      return {
        lines: pairs.slice(0, 3).map((p) => clip(`${toText(p.left)} → ${toText(p.right)}`, 80)),
        count: `${pairs.length} pares`,
      };
    }
    case 'table': {
      const rows = block.rows || [];
      return {
        lines: [rows[0]?.map(toText).join(' · '), rows[1]?.map(toText).join(' · ')].filter(Boolean).map((l) => clip(l, 80)),
        count: `${Math.max(0, rows.length - (block.header ? 1 : 0))} linhas`,
      };
    }
    case 'deck': {
      const cats = block.cats || [];
      const total = cats.reduce((n, c) => n + c.qs.length, 0);
      return {
        lines: cats.slice(0, 3).map((c) => clip(`${c.name}: ${toText(c.qs[0] || '')}`, 80)),
        count: `${total} perguntas${cats.length > 1 ? ` · ${cats.length} temas` : ''}`,
      };
    }
    case 'challenge':
      return {
        lines: [
          ...(block.lines || []).slice(0, 2).map((l) => clip(`“${toText(l)}”`, 70)),
          clip(`${block.promptLabel || 'Say it'}: ${(block.prompts || []).slice(0, 4).join(', ')}…`, 80),
        ],
        count: `${(block.lines || []).length} frases × ${(block.prompts || []).length} instruções`,
      };
    case 'image':
      return { lines: block.caption ? [clip(toText(block.caption), 100)] : [], image: block.src };
    default:
      return { lines: [clip(toText(block.html), 160)].filter(Boolean) };
  }
}
