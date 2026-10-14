// Listas fixas da escola. A lista oficial de conteúdos ainda está em aberto (requisitos, seção 14).

export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
export const SKILLS = ['Leitura', 'Escrita', 'Escuta', 'Fala'];

/** Mapa de conteúdos da ficha (lista provisória). */
export const MAP_SECTIONS = [
  {
    name: 'Tempos verbais',
    items: [
      'Present Simple', 'Present Continuous', 'Past Simple', 'Past Continuous', 'Present Perfect',
      'Present Perfect Continuous', 'Past Perfect', 'Future (will)', 'Future (going to)',
    ],
  },
  {
    name: 'Major structures',
    items: [
      'Conditionals (0 & 1)', 'Conditionals (2 & 3)', 'Relative clauses', 'Passive voice', 'Reported speech',
      'Modal verbs', 'Comparatives & superlatives', 'Gerunds & infinitives',
    ],
  },
  {
    name: 'Minor points',
    items: [
      'Prepositions', 'Articles', 'Quantifiers', 'Adverbs of manner', 'Phrasal verbs', 'Question words',
      'Possessives', 'Plurals',
    ],
  },
];

export const MAP_STATUS = {
  none: { label: 'Nunca viu', next: 'practicing' },
  practicing: { label: 'Praticando', next: 'good' },
  good: { label: 'Já está bom', next: 'none' },
};

/** Sugestões de etiqueta "Conteúdo" nos modelos: tudo do mapa + temas de vocabulário. */
export const CONTENT_SUGGESTIONS = [
  ...MAP_SECTIONS.flatMap((s) => s.items),
  'Conversation', 'Vocabulary', 'Phrasal verbs', 'IELTS', 'Reading', 'Writing', 'Natural disasters', 'Travel', 'Work', 'Food', 'Family', 'Daily routine',
  'Shopping', 'Health', 'Technology', 'Hobbies', 'Weather', 'Pronunciation', 'Science', 'News',
];
