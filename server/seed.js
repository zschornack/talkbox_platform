// Na primeira vez que o servidor sobe, cria uma aula de exemplo (Julia · Natural Disasters).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPLOADS_DIR } from './db.js';
import { bid } from './templates.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function copySeedImage(name) {
  const src = path.join(HERE, 'seed', name);
  const dst = path.join(UPLOADS_DIR, 'seed-' + name);
  if (fs.existsSync(src) && !fs.existsSync(dst)) fs.copyFileSync(src, dst);
  return '/uploads/seed-' + name;
}

const item = (before, hint, after, answers) => ({ id: bid(), before, hint, after, answers });

export function seedIfEmpty({ countLessons, createLesson, newId }) {
  if (countLessons() > 0) return;
  const title = 'Natural Disasters';
  const doc = {
    v: 1,
    title,
    subtitle: 'Adverbs of manner · Present Simple vs Continuous · Past Simple vs Continuous.',
    level: 'A2',
    tags: ['Revisão', 'Vocabulário', 'Fala'],
    blocks: [
      {
        id: bid(),
        type: 'image',
        layout: 'full',
        src: copySeedImage('flood.webp'),
        caption: 'What is happening in this picture? What happened before?',
      },
      {
        id: bid(),
        type: 'explanation',
        label: 'EXPLICAÇÃO · ADJECTIVE OR ADVERB?',
        html:
          'An <b>adjective</b> describes a noun: <i>a <b>strong</b> wind</i>. It also comes after <b>be, become, look, feel</b>: <i>The wind was <b>strong</b>.</i><br>An <b>adverb of manner</b> answers <i>how?</i> and describes a verb: <i>The wind <u>blew</u> <b>strongly</b>.</i>',
      },
      {
        id: bid(),
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
      {
        id: bid(),
        type: 'fill',
        label: 'EXERCÍCIO · BREAKING NEWS',
        html: 'You are the news reporter. Complete the report with adverbs.',
        items: [
          item('The rain started', 'sudden', 'on Monday night.', ['suddenly']),
          item('By midnight, the river was rising', 'rapid', '.', ['rapidly']),
          item('Firefighters worked', 'quick', 'to close the roads.', ['quickly']),
          item('Most families left their homes', 'safe', '.', ['safely']),
          item('At the school gym, people waited', 'calm', 'for news.', ['calmly']),
          item('A young volunteer acted', 'brave', 'and rescued a dog from a roof.', ['bravely']),
          item('Everyone worked', 'hard', 'to clean the streets.', ['hard']),
          item('The city recovered', 'good', ', but slowly.', ['well']),
        ],
      },
      {
        id: bid(),
        type: 'image',
        layout: 'half',
        src: copySeedImage('rescue.webp'),
        caption: "You're live on TV! What is happening right now? Use 3 adverbs.",
      },
      {
        id: bid(),
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
      {
        id: bid(),
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
            qs: [
              'How do you usually drive?',
              'Do you eat quickly or slowly?',
              'How did you sleep last night?',
              'What were you doing at 9 p.m. yesterday?',
            ],
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
      { id: bid(), type: 'notes', label: 'ANOTAÇÕES', html: '' },
    ],
  };
  createLesson({ id: newId(), title, student: 'Julia', doc });
  console.log('  Aula de exemplo criada: Julia · Natural Disasters');
}
