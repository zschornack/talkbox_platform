// Listas fixas da escola. Usadas pelo app (navegador) e pelo servidor.
// A lista oficial de conteúdos ainda está em aberto (requisitos, seção 14): esta é a proposta atual.

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const SKILLS = ['Leitura', 'Escrita', 'Escuta', 'Fala'];

/**
 * Lista oficial de conteúdos. Cada conteúdo tem um nome e os sinônimos dele: outros jeitos de
 * escrever a mesma coisa. Quem digitar um sinônimo cai no conteúdo oficial (busca, etiquetas,
 * importação), então o mapa da ficha nunca mostra duas linhas para o mesmo conteúdo.
 * section: 'tense' | 'major' | 'minor' entram no mapa da ficha; 'theme' são temas de vocabulário.
 */
export const CONTENTS = [
  // Tempos verbais
  { name: 'Present Simple', section: 'tense', synonyms: ['simple present', 'presente simples'] },
  { name: 'Present Continuous', section: 'tense', synonyms: ['present progressive', 'presente continuo'] },
  { name: 'Past Simple', section: 'tense', synonyms: ['simple past', 'passado simples'] },
  { name: 'Past Continuous', section: 'tense', synonyms: ['past progressive', 'passado continuo'] },
  { name: 'Present Perfect', section: 'tense', synonyms: ['presente perfeito'] },
  { name: 'Present Perfect Continuous', section: 'tense', synonyms: ['present perfect progressive'] },
  { name: 'Past Perfect', section: 'tense', synonyms: ['pluperfect'] },
  { name: 'Future (will)', section: 'tense', synonyms: ['will', 'future will', 'future simple', 'futuro com will'] },
  { name: 'Future (going to)', section: 'tense', synonyms: ['going to', 'be going to', 'future going to'] },
  { name: 'Future (present continuous)', section: 'tense', synonyms: ['present continuous for future', 'future arrangements', 'arrangements'] },
  // Major structures
  { name: 'Conditionals (0 & 1)', section: 'major', synonyms: ['zero conditional', 'first conditional', '1st conditional'] },
  { name: 'Conditionals (2 & 3)', section: 'major', synonyms: ['second conditional', 'third conditional', '2nd conditional', '3rd conditional'] },
  { name: 'Relative clauses', section: 'major', synonyms: ['relative pronouns'] },
  { name: 'Passive voice', section: 'major', synonyms: ['passive', 'voz passiva'] },
  { name: 'Reported speech', section: 'major', synonyms: ['indirect speech', 'discurso indireto'] },
  { name: 'Modal verbs', section: 'major', synonyms: ['modals', 'can should must', 'can could', 'must should have to'] },
  { name: 'Comparatives & superlatives', section: 'major', synonyms: ['comparatives', 'superlatives', 'comparativo', 'superlativo'] },
  { name: 'Gerunds & infinitives', section: 'major', synonyms: ['gerund', 'infinitive', 'gerunds', 'infinitives'] },
  { name: 'Question formation', section: 'major', synonyms: ['making questions', 'forming questions', 'formacao de perguntas'] },
  { name: 'There is / there are', section: 'major', synonyms: ['there is', 'there are', 'there is there are'] },
  // Minor points
  { name: 'Prepositions', section: 'minor', synonyms: ['in on at', 'prepositions of time', 'prepositions of place', 'preposicoes'] },
  { name: 'Articles', section: 'minor', synonyms: ['a an the', 'artigos'] },
  { name: 'Countable & uncountable nouns', section: 'minor', synonyms: ['countable', 'uncountable', 'countable and uncountable', 'contaveis e incontaveis'] },
  { name: 'Quantifiers', section: 'minor', synonyms: ['some any', 'much many', 'many much some any', 'a lot of', 'a few a little', 'quantificadores'] },
  { name: 'How much / How many', section: 'minor', synonyms: ['how much', 'how many', 'how much how many'] },
  { name: 'Containers (a bottle of…)', section: 'minor', synonyms: ['containers', 'a bottle of', 'a loaf of', 'a carton of', 'units of food'] },
  { name: 'Adverbs of manner', section: 'minor', synonyms: [] },
  { name: 'Phrasal verbs', section: 'minor', synonyms: ['phrasal'] },
  { name: 'Question words', section: 'minor', synonyms: ['wh questions', 'wh-questions', 'wh words'] },
  { name: 'Possessives', section: 'minor', synonyms: ['possessive adjectives', 'genitive'] },
  { name: 'Plurals', section: 'minor', synonyms: ['plural'] },
  // Temas e habilidades (não entram no mapa)
  ...['Conversation', 'Vocabulary', 'IELTS', 'Reading', 'Writing', 'Natural disasters', 'Travel', 'Work', 'Family',
    'Daily routine', 'Health', 'Technology', 'Hobbies', 'Weather', 'Pronunciation', 'Science', 'News']
    .map((name) => ({ name, section: 'theme', synonyms: [] })),
  { name: 'Food', section: 'theme', synonyms: ['comida', 'groceries'] },
  { name: 'Shopping', section: 'theme', synonyms: ['supermarket', 'compras'] },
];

const SECTION_NAMES = { tense: 'Tempos verbais', major: 'Major structures', minor: 'Minor points' };

/** Mapa de conteúdos da ficha. */
export const MAP_SECTIONS = Object.entries(SECTION_NAMES).map(([key, name]) => ({
  key,
  name,
  items: CONTENTS.filter((c) => c.section === key).map((c) => c.name),
}));

export const MAP_STATUS = {
  none: { label: 'Nunca viu', next: 'practicing' },
  practicing: { label: 'Praticando', next: 'good' },
  good: { label: 'Já está bom', next: 'none' },
};

/** Sugestões de etiqueta "Conteúdo" nos modelos: a lista oficial inteira. */
export const CONTENT_SUGGESTIONS = CONTENTS.map((c) => c.name);

/** minúsculas, sem acentos, "&" vira "and", sem pontuação. */
export function normalizeTerm(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BY_TERM = new Map();
for (const c of CONTENTS) for (const t of [c.name, ...c.synonyms]) BY_TERM.set(normalizeTerm(t), c.name);

/** Nome oficial de um conteúdo a partir do nome ou de um sinônimo; null se não estiver na lista. */
export const officialContent = (term) => BY_TERM.get(normalizeTerm(term)) || null;

/** Para etiquetas: troca sinônimos pelo nome oficial e mantém o resto como foi escrito. */
export const canonicalContent = (term) => officialContent(term) || String(term ?? '').trim();

/**
 * Para a importação: conteúdos oficiais citados num texto. Ignora sinônimos de uma palavra só
 * com menos de 8 letras ("will", "can"), que apareceriam em qualquer frase.
 */
export function contentsInText(text) {
  const t = ` ${normalizeTerm(text)} `;
  const found = [];
  for (const [term, name] of [...BY_TERM].sort((a, b) => b[0].length - a[0].length)) {
    if (!term.includes(' ') && term.length < 8) continue;
    if (t.includes(` ${term} `) && !found.includes(name)) found.push(name);
  }
  return found;
}

/**
 * Para a busca: separa os conteúdos citados ("fill simple past A2" → Past Simple) do resto do texto.
 * Aqui valem todos os sinônimos, inclusive os curtos ("will").
 */
export function splitContentQuery(q) {
  let rest = ` ${normalizeTerm(q)} `;
  const contents = [];
  for (const [term, name] of [...BY_TERM].sort((a, b) => b[0].length - a[0].length)) {
    if (rest.includes(` ${term} `)) {
      if (!contents.includes(name)) contents.push(name);
      rest = rest.replace(` ${term} `, ' ');
    }
  }
  return { contents, rest: rest.trim() };
}
