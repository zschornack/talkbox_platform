// Nivelamento (v1.2): o conteúdo do teste e a conta do resultado. Sem tela aqui (dá para testar no Node).
//
// 4 etapas, da mais fácil para a mais difícil. Cada etapa leva uns 3 a 4 minutos:
// - Conversa: 3 perguntas. O professor dá a nota de Fala (0 a 3) no fim.
// - Leitura: um parágrafo e 2 perguntas de escolher (o app corrige).
// - Escuta: 2 frases que o professor lê em voz alta; o aluno diz o que ouviu. O professor dá a nota (0 a 3) no fim.
// - Gramática: 6 frases de escolher a opção certa (o app corrige). Cada uma tem o conteúdo do mapa da ficha.
// Quando ficar difícil demais, o professor para ali e vai para o resultado.

export const STAGES = [
  {
    key: 'basic', name: 'Básico', levels: 'A1 · A2',
    talk: ['What\'s your name? Where are you from?', 'What do you do? Do you work or study?', 'What did you do last weekend?'],
    reading: {
      text: 'Hi! My name is Carla. I\'m 34 and I live in Curitiba with my husband and our two cats. I work at a hospital. I usually start work at 7 a.m., so I get up very early. On weekends, I like cooking and watching movies. Last Sunday, I made a big lunch for my family.',
      questions: [
        { id: 'b-r1', q: 'Where does Carla work?', options: ['At a school', 'At a hospital', 'At home'], answer: 1 },
        { id: 'b-r2', q: 'What did Carla do last Sunday?', options: ['She watched a movie.', 'She went to work.', 'She made lunch for her family.'], answer: 2 },
      ],
    },
    listening: ['I have two brothers and one sister.', 'She doesn\'t like coffee in the morning.'],
    grammar: [
      { id: 'b-g1', before: 'She', after: 'a teacher.', options: ['is', 'are', 'am'], answer: 0, content: 'Verb to be' },
      { id: 'b-g2', before: 'They', after: 'TV right now.', options: ['watch', 'are watching', 'watches'], answer: 1, content: 'Present Continuous' },
      { id: 'b-g3', before: 'He', after: 'to work by bus every day.', options: ['go', 'goes', 'going'], answer: 1, content: 'Present Simple' },
      { id: 'b-g4', before: '', after: 'you like pizza?', options: ['Are', 'Does', 'Do'], answer: 2, content: 'Question formation' },
      { id: 'b-g5', before: 'I', after: 'at home yesterday.', options: ['was', 'were', 'am'], answer: 0, content: 'Was / were' },
      { id: 'b-g6', before: 'We', after: 'to the beach last summer.', options: ['go', 'went', 'goes'], answer: 1, content: 'Past Simple' },
    ],
  },
  {
    key: 'intermediate', name: 'Intermediário', levels: 'B1',
    talk: ['Why do you want to improve your English?', 'Tell me about a trip you took. What happened?', 'What are you going to do next weekend?'],
    reading: {
      text: 'Last year, Rafael decided to change his life. He was working in an office in São Paulo, but he wasn\'t happy. He always wanted to work with food, so he started a cooking course at night. While he was studying, he sold cakes to his colleagues. Today he has his own small bakery. "It was the best decision of my life," he says.',
      questions: [
        { id: 'i-r1', q: 'Why did Rafael start a cooking course?', options: ['He lost his job.', 'He wanted to work with food.', 'His colleagues asked him.'], answer: 1 },
        { id: 'i-r2', q: 'What does Rafael have now?', options: ['A restaurant in São Paulo', 'A small bakery', 'A new office job'], answer: 1 },
      ],
    },
    listening: ['I was cooking dinner when my phone rang.', 'If it rains tomorrow, we\'ll stay at home.'],
    grammar: [
      { id: 'i-g1', before: 'I', after: 'to London twice.', options: ['have been', 'was', 'have went'], answer: 0, content: 'Present Perfect' },
      { id: 'i-g2', before: 'While I', after: 'a shower, the lights went out.', options: ['took', 'was taking', 'am taking'], answer: 1, content: 'Past Continuous' },
      { id: 'i-g3', before: 'Look at those clouds! It', after: 'rain.', options: ['will', 'is going to', 'rains'], answer: 1, content: 'Future (going to)' },
      { id: 'i-g4', before: 'If you heat ice, it', after: '.', options: ['melts', 'melted', 'would melt'], answer: 0, content: 'Conditionals (0 & 1)' },
      { id: 'i-g5', before: 'I', after: 'play the piano when I was a child.', options: ['use to', 'used to', 'was used'], answer: 1, content: 'Used to' },
      { id: 'i-g6', before: 'This is the woman', after: 'helped me.', options: ['which', 'who', 'where'], answer: 1, content: 'Relative clauses' },
    ],
  },
  {
    key: 'upper', name: 'Intermediário avançado', levels: 'B2',
    talk: ['What\'s the biggest change you\'ve made in your life?', 'If you could live in any country, where would you live? Why?', 'What do you think about working from home?'],
    reading: {
      text: 'Many companies now let employees work from home, at least part of the week. Supporters say it saves time and money, since people no longer spend hours in traffic. However, some managers worry that teams have become less connected, and that new employees are not learning as quickly as they used to. As a result, a growing number of companies have been trying a "hybrid" model, in which staff come to the office on fixed days.',
      questions: [
        { id: 'u-r1', q: 'Why do some managers worry?', options: ['Employees spend too much money.', 'Teams are less connected.', 'Traffic has become worse.'], answer: 1 },
        { id: 'u-r2', q: 'What is a "hybrid" model?', options: ['Working from home every day', 'Going to the office on fixed days', 'Working for two companies'], answer: 1 },
      ],
    },
    listening: ['I\'ve been waiting for the bus for almost forty minutes.', 'If I had known about the meeting, I would have come earlier.'],
    grammar: [
      { id: 'u-g1', before: 'If I', after: 'more time, I would learn Japanese.', options: ['have', 'had', 'will have'], answer: 1, content: 'Conditionals (2 & 3)' },
      { id: 'u-g2', before: 'By the time we arrived, the movie', after: '.', options: ['already started', 'had already started', 'has already started'], answer: 1, content: 'Past Perfect' },
      { id: 'u-g3', before: 'I', after: 'here since 2019.', options: ['live', 'am living', 'have been living'], answer: 2, content: 'Present Perfect Continuous' },
      { id: 'u-g4', before: 'The bridge', after: 'in 1950.', options: ['built', 'was built', 'has built'], answer: 1, content: 'Passive voice' },
      { id: 'u-g5', before: 'She told me that she', after: 'tired.', options: ['is being', 'was', 'were'], answer: 1, content: 'Reported speech' },
      { id: 'u-g6', before: 'I\'m looking forward to', after: 'you.', options: ['see', 'seeing', 'saw'], answer: 1, content: 'Gerunds & infinitives' },
    ],
  },
  {
    key: 'advanced', name: 'Avançado', levels: 'C1 · C2',
    talk: ['What is a popular belief that you disagree with? Why?', 'How has technology changed the way people relate to each other?', 'Describe a difficult decision you made. Would you do anything differently?'],
    reading: {
      text: 'The idea that we only use ten percent of our brains is one of the most persistent myths in popular science. Brain imaging shows that virtually every region is active at some point during the day, even during sleep. The myth has nonetheless proved remarkably resilient, partly because it carries an appealing promise: that each of us has vast untapped potential, waiting to be unlocked by the right technique or product.',
      questions: [
        { id: 'a-r1', q: 'What does brain imaging show?', options: ['We use only a small part of the brain.', 'Almost every part of the brain is used.', 'The brain is inactive during sleep.'], answer: 1 },
        { id: 'a-r2', q: 'Why has the myth survived?', options: ['Recent research supports it.', 'It offers an attractive promise.', 'Scientists have never studied it.'], answer: 1 },
      ],
    },
    listening: ['Had I known how long the journey would take, I would never have agreed to drive.', 'It\'s high time we stopped pretending the problem doesn\'t exist.'],
    grammar: [
      { id: 'a-g1', before: 'By this time next year, I', after: 'my degree.', options: ['will finish', 'will have finished', 'am finishing'], answer: 1, content: 'Future Perfect' },
      { id: 'a-g2', before: 'Not only', after: 'late, but he also forgot the tickets.', options: ['he was', 'was he', 'he is'], answer: 1, content: null },
      { id: 'a-g3', before: 'I\'d rather you', after: 'smoke in here.', options: ['don\'t', 'didn\'t', 'won\'t'], answer: 1, content: null },
      { id: 'a-g4', before: 'She', after: 'have left already. Her car isn\'t here.', options: ['must', 'should', 'can'], answer: 0, content: 'Modal verbs' },
      { id: 'a-g5', before: 'I wish I', after: 'that email yesterday.', options: ['didn\'t send', 'hadn\'t sent', 'wouldn\'t send'], answer: 1, content: null },
      { id: 'a-g6', before: 'He', after: 'to have been a brilliant student.', options: ['says', 'is said', 'said'], answer: 1, content: 'Passive voice' },
    ],
  },
];

/** Notas do professor (Fala e Escuta), de 0 a 3. */
export const RATING = [
  { value: 0, label: 'Nada' },
  { value: 1, label: 'Pouco' },
  { value: 2, label: 'Quase tudo' },
  { value: 3, label: 'Tudo' },
];
export const MAX_RATING = 3;
export const PASS = 0.7; // passa da etapa com 70% dos pontos

/** Pontos de uma etapa. answers = { idDaPergunta: índice escolhido }, rating = { talk, listen } (0 a 3 ou vazio). */
export function stageScore(stage, answers = {}, rating = {}) {
  const right = (items) => items.filter((it) => answers[it.id] === it.answer).length;
  const grammar = right(stage.grammar);
  const reading = right(stage.reading.questions);
  const talk = Number.isInteger(rating.talk) ? rating.talk : null;
  const listen = Number.isInteger(rating.listen) ? rating.listen : null;
  const auto = grammar + reading;
  const autoMax = stage.grammar.length + stage.reading.questions.length;
  // sem nota do professor ainda, a etapa conta só o que o app corrigiu
  const rated = [talk, listen].filter((x) => x !== null);
  const points = auto + rated.reduce((a, b) => a + b, 0);
  const max = autoMax + rated.length * MAX_RATING;
  return { grammar, grammarMax: stage.grammar.length, reading, readingMax: stage.reading.questions.length, talk, listen, points, max, pct: max ? points / max : 0 };
}

/**
 * Nível sugerido. done = quantas etapas o aluno fez (as outras contam como não passou).
 * Básico abaixo de 60% → A1; Básico ok → A2; cada etapa seguinte com 70% sobe um nível;
 * no Avançado, 90% ou mais → C2.
 */
export function suggestLevel(scores, done) {
  const pct = (i) => (i < done ? scores[i].pct : 0);
  if (pct(0) < 0.6) return 'A1';
  if (pct(0) < PASS || pct(1) < PASS) return 'A2';
  if (pct(2) < PASS) return 'B1';
  if (pct(3) < PASS) return 'B2';
  return pct(3) >= 0.9 ? 'C2' : 'C1';
}

/**
 * Mapa da ficha a partir da gramática das etapas feitas.
 * - Etapa em que o aluno passou: certo → "Já está bom"; errado → "Praticando".
 * - Etapa em que não passou: certo → "Praticando"; errado fica "Nunca viu" (pode ter sido chute ou nunca ter visto).
 * O mesmo conteúdo em duas perguntas fica com o resultado mais baixo.
 */
export function suggestMap(answers, done, scores = null) {
  const RANK = { none: 0, practicing: 1, good: 2 };
  const map = {};
  STAGES.slice(0, done).forEach((st, i) => {
    const passed = (scores ? scores[i] : stageScore(st, answers)).pct >= PASS;
    st.grammar.forEach((g) => {
      if (!g.content) return;
      const ok = answers[g.id] === g.answer;
      const status = passed ? (ok ? 'good' : 'practicing') : ok ? 'practicing' : 'none';
      map[g.content] = g.content in map && RANK[map[g.content]] < RANK[status] ? map[g.content] : status;
    });
  });
  return map;
}

/** Texto para as observações da ficha. */
export function summaryText(scores, done, level, date = new Date()) {
  const d = date.toLocaleDateString('pt-BR');
  const fmt = (v) => (v === null ? '—' : `${v}/${MAX_RATING}`);
  const lines = STAGES.slice(0, done).map((st, i) => {
    const s = scores[i];
    return `${st.name} (${st.levels}): gramática ${s.grammar}/${s.grammarMax}, leitura ${s.reading}/${s.readingMax}, fala ${fmt(s.talk)}, escuta ${fmt(s.listen)} · ${Math.round(s.pct * 100)}%`;
  });
  return [`Nivelamento em ${d}: nível ${level}.`, ...lines, done < STAGES.length ? `Parou no ${STAGES[done - 1]?.name || 'começo'}.` : 'Fez as 4 etapas.'].join('\n');
}
