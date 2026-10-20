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
    case 'reveal':
    case 'order':
    case 'transform':
    case 'spot': {
      const items = block.items || [];
      const line = {
        reveal: (it) => `${toText(it.q)} → ${toText(it.a)}`,
        order: (it) => String(it.answer || '').replace(/\s*\/\s*/g, ' '),
        transform: (it) => `${toText(it.sentence)} (${it.instruction})`,
        spot: (it) => (it.words || []).join(' '),
      }[block.type];
      return { lines: items.slice(0, 3).map((it) => clip(line(it), 90)), count: `${items.length} ${items.length === 1 ? 'frase' : 'frases'}` };
    }
    case 'sort':
      return {
        lines: (block.groups || []).map((g, gi) => clip(`${g}: ${(block.items || []).filter((it) => it.group === gi).map((it) => it.text).join(', ')}`, 80)),
        count: `${(block.items || []).length} itens · ${(block.groups || []).length} grupos`,
      };
    case 'scale':
      return { lines: (block.statements || []).slice(0, 3).map((x) => clip(toText(x), 90)), count: `${(block.statements || []).length} afirmações` };
    case 'timer':
      return { lines: (block.topics || []).slice(0, 3).map((x) => clip(toText(x), 90)), count: `${(block.topics || []).length} temas · ${block.seconds || 60} s` };
    case 'roleplay':
      return { lines: [clip(toText(block.html), 100), ...(block.roles || []).map((r) => clip(`${r.name}: ${toText(r.card)}`, 80))].filter(Boolean), count: `${(block.roles || []).length} papéis` };
    case 'tense':
      return { lines: [`${block.tense || ''} · ${block.verb || ''}`.replace(/-/g, ' ')], count: '5 pessoas' };
    case 'timeline':
      return { lines: [clip(toText(block.html), 100), (block.marks || []).map((m) => m.text).join(' · ')].filter(Boolean) };
    case 'image':
      return { lines: block.caption ? [clip(toText(block.caption), 100)] : [], image: block.src };
    default:
      return { lines: [clip(toText(block.html), 160)].filter(Boolean) };
  }
}
