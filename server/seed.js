// Dados de exemplo. Rodam só quando a parte correspondente está vazia:
// - sem modelos → cria a biblioteca inicial de modelos;
// - sem aulas e sem alunos → cria a aluna Julia e a aula "Natural Disasters" (montada a partir dos modelos).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';
import { bid } from './templates.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function seedImage(name) {
  const src = path.join(HERE, 'seed', name);
  const dst = path.join(db.UPLOADS_DIR, 'seed-' + name);
  if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
  return '/uploads/seed-' + name;
}

const item = (before, hint, after, ...answers) => ({ id: bid(), before, hint, after, answers });

function modelSeeds() {
  return [
    {
      key: 'adv-explain',
      title: 'Adjective or adverb?',
      tags: { content: ['Adverbs of manner'], levels: ['A2', 'B1'], skills: ['Leitura'] },
      block: {
        type: 'explanation',
        label: 'EXPLICAÇÃO · ADJECTIVE OR ADVERB?',
        html:
          'An <b>adjective</b> describes a noun: <i>a <b>strong</b> wind</i>. It also comes after <b>be, become, look, feel</b>: <i>The wind was <b>strong</b>.</i><br>An <b>adverb of manner</b> answers <i>how?</i> and describes a verb: <i>The wind <u>blew</u> <b>strongly</b>.</i>',
      },
    },
    {
      key: 'adv-table',
      title: 'Como formar advérbios (-ly, -ily, irregulares)',
      tags: { content: ['Adverbs of manner'], levels: ['A2'], skills: ['Leitura'] },
      block: {
        type: 'table',
        label: 'COMO FORMAR',
        header: true,
        rows: [
          ['RULE', 'EXAMPLES'],
          ['most adjectives: <b>+ ly</b>', 'quick → quickly · calm → calmly'],
          ['-y → <b>-ily</b>', 'heavy → heavily · easy → easily'],
          ['-le → <b>-ly</b>', 'gentle → gently · terrible → terribly'],
          ['<b>irregular</b>', 'good → <b>well</b> · fast → <b>fast</b> · hard → <b>hard</b>'],
        ],
      },
    },
    {
      key: 'adv-fill',
      title: 'Breaking News · adverbs',
      tags: { content: ['Adverbs of manner', 'Natural disasters'], levels: ['A2'], skills: ['Escrita', 'Leitura'] },
      block: {
        type: 'fill',
        label: 'EXERCÍCIO · BREAKING NEWS',
        html: 'You are the news reporter. Complete the report with adverbs.',
        items: [
          item('The rain started', 'sudden', 'on Monday night.', 'suddenly'),
          item('By midnight, the river was rising', 'rapid', '.', 'rapidly'),
          item('Firefighters worked', 'quick', 'to close the roads.', 'quickly'),
          item('Most families left their homes', 'safe', '.', 'safely'),
          item('At the school gym, people waited', 'calm', 'for news.', 'calmly'),
          item('A young volunteer acted', 'brave', 'and rescued a dog from a roof.', 'bravely'),
          item('Everyone worked', 'hard', 'to clean the streets.', 'hard'),
          item('The city recovered', 'good', ', but slowly.', 'well'),
        ],
      },
    },
    {
      key: 'adv-image',
      title: 'Flood · describe the picture',
      tags: { content: ['Natural disasters', 'Present Continuous'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'image',
        layout: 'half',
        src: seedImage('rescue.webp'),
        caption: "You're live on TV! What is happening right now? Use 3 adverbs.",
      },
    },
    {
      key: 'adv-challenge',
      title: 'Say it like this! (advérbios de modo)',
      tags: { content: ['Adverbs of manner'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'challenge',
        label: 'SPEAKING · SAY IT LIKE THIS!',
        html: 'Draw a card and say the sentence <b>in that way</b>. Then switch: the teacher acts, you guess.',
        promptLabel: 'SAY IT',
        lines: [
          'The river is rising.',
          'I lost my phone.',
          "There's a storm coming.",
          'We have no electricity.',
          'The dog is on the roof!',
          'I need to leave now.',
        ],
        prompts: ['calmly', 'nervously', 'angrily', 'excitedly', 'sadly', 'dramatically', 'quietly', 'loudly'],
      },
    },
    {
      key: 'disasters-deck',
      title: 'Natural disasters · conversation',
      tags: { content: ['Natural disasters', 'Past Continuous', 'Adverbs of manner'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'deck',
        label: 'CONVERSATION · QUESTION DECK',
        html: '',
        words: ['quickly', 'carefully', 'calmly', 'suddenly', 'badly', 'well', 'nervously', 'clearly'],
        cats: [
          {
            name: 'Disasters',
            qs: [
              'Which natural disaster scares you most? Why?',
              'What natural disasters happen in Brazil?',
              'Have you ever seen a flood? What happened?',
              'What should people do during an earthquake?',
              'What were you doing the last time there was a big storm?',
            ],
          },
          {
            name: 'Everyday life',
            qs: ['How do you usually drive?', 'Do you eat quickly or slowly?', 'How did you sleep last night?', 'What were you doing at 9 p.m. yesterday?'],
          },
          {
            name: 'Tell me about…',
            qs: [
              'Tell me about a time you had to act quickly.',
              'Tell me about a time you had to stay calm.',
              'Tell me about a time something went wrong unexpectedly.',
            ],
          },
        ],
      },
    },
    {
      key: 'past-irregular',
      title: 'Irregular verbs · top 10',
      tags: { content: ['Past Simple'], levels: ['A1', 'A2'], skills: ['Leitura'] },
      block: {
        type: 'table',
        label: 'IRREGULAR VERBS',
        header: true,
        rows: [
          ['VERB', 'PAST', 'EXAMPLE'],
          ['go', '<b>went</b>', 'I went to the beach.'],
          ['have', '<b>had</b>', 'We had lunch at noon.'],
          ['do', '<b>did</b>', 'She did her homework.'],
          ['make', '<b>made</b>', 'He made a cake.'],
          ['get', '<b>got</b>', 'They got home late.'],
          ['see', '<b>saw</b>', 'I saw a great movie.'],
          ['come', '<b>came</b>', 'My friends came over.'],
          ['take', '<b>took</b>', 'We took a taxi.'],
          ['say', '<b>said</b>', 'She said hello.'],
          ['buy', '<b>bought</b>', 'I bought new shoes.'],
        ],
      },
    },
    {
      key: 'past-fill',
      title: 'Past Simple · what happened yesterday',
      tags: { content: ['Past Simple'], levels: ['A1', 'A2'], skills: ['Escrita'] },
      block: {
        type: 'fill',
        label: 'EXERCÍCIO · FILL IN THE BLANKS',
        html: 'Complete with the Past Simple of the verb in brackets.',
        items: [
          item('Yesterday I', 'go', 'to the supermarket.', 'went'),
          item('She', 'not / like', 'the movie.', "didn't like", 'did not like'),
          item('We', 'visit', 'my grandparents last weekend.', 'visited'),
          item('They', 'buy', 'a new car in 2023.', 'bought'),
          item('I', 'study', 'for three hours last night.', 'studied'),
          item('He', 'forget', 'his keys at home.', 'forgot'),
        ],
      },
    },
    {
      key: 'icebreakers',
      title: 'Icebreakers · warm-up',
      tags: { content: ['Conversation'], levels: ['A2', 'B1', 'B2'], skills: ['Fala'] },
      block: {
        type: 'deck',
        label: 'WARM-UP',
        html: '',
        words: [],
        cats: [
          {
            name: 'This week',
            qs: [
              'What was the best part of your week?',
              'Did anything surprise you this week?',
              'What are you looking forward to?',
            ],
          },
          {
            name: 'Would you rather…',
            qs: [
              'Would you rather live by the beach or in the mountains?',
              'Would you rather travel to the past or to the future?',
              'Would you rather work from home or from an office?',
            ],
          },
        ],
      },
    },
    {
      key: 'use-the-word',
      title: 'Answer using the word',
      tags: { content: ['Conversation', 'Past Simple'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'challenge',
        label: 'SPEAKING · USE THE WORD',
        html: 'Answer the question. You <b>must</b> use the word on the card.',
        promptLabel: 'USE THIS WORD',
        lines: [
          'What did you do last weekend?',
          'How was your last trip?',
          'What did you have for dinner yesterday?',
          'How did you meet your best friend?',
        ],
        prompts: ['suddenly', 'finally', 'actually', 'luckily', 'unfortunately', 'immediately'],
      },
    },
  ];
}

export function seed() {
  let byKey = {};
  if (db.countModels() === 0) {
    for (const m of modelSeeds()) {
      byKey[m.key] = db.createModel({ title: m.title, type: m.block.type, block: { id: bid(), ...m.block }, tags: m.tags });
    }
    console.log(`  Biblioteca de modelos criada (${Object.keys(byKey).length} modelos)`);
  }

  if (db.countLessons() === 0 && db.countStudents() === 0) {
    const julia = db.createStudent({
      name: 'Julia',
      level: 'A2',
      goal: 'Ganhar confiança para conversar',
      notes: 'Aluna de exemplo. Edite ou inative quando quiser.',
    });
    db.updateStudent(julia.id, { map: { 'Present Simple': 'good', 'Present Continuous': 'good', 'Past Simple': 'practicing' } });

    // A aula é montada copiando os modelos (como faria a professora).
    const fromModel = (key) => {
      const m = byKey[key];
      if (!m) return null;
      const copy = JSON.parse(JSON.stringify(m.block));
      copy.id = bid();
      (copy.items || []).forEach((it) => (it.id = bid()));
      copy.source = { modelId: m.id, title: m.title };
      return copy;
    };
    const blocks = [
      { id: bid(), type: 'image', layout: 'full', src: seedImage('flood.webp'), caption: 'What is happening in this picture? What happened before?' },
      fromModel('adv-explain'),
      fromModel('adv-table'),
      fromModel('adv-fill'),
      fromModel('adv-image'),
      fromModel('adv-challenge'),
      fromModel('disasters-deck'),
      { id: bid(), type: 'notes', label: 'ANOTAÇÕES', html: '' },
    ].filter(Boolean);

    db.createLesson({
      title: 'Natural Disasters',
      studentId: julia.id,
      doc: {
        v: 1,
        title: 'Natural Disasters',
        subtitle: 'Adverbs of manner · Present Simple vs Continuous · Past Simple vs Continuous.',
        level: 'A2',
        tags: ['Revisão', 'Vocabulário', 'Fala'],
        blocks,
      },
    });
    console.log('  Exemplo criado: aluna Julia e a aula Natural Disasters');
  }
}
