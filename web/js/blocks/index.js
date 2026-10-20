// Todos os tipos de bloco. Para criar um tipo novo: um arquivo nesta pasta + uma linha aqui
// (e um resumo em summary.js para aparecer bem nos Modelos).
import { text, explanation, notes } from './basic.js';
import { table } from './table.js';
import { fill } from './fill.js';
import { choice } from './choice.js';
import { match } from './match.js';
import { deck } from './deck.js';
import { challenge } from './challenge.js';
import { image } from './image.js';
// v0.6: tipos novos (requisitos 7.1.1)
import { reveal } from './reveal.js';
import { order } from './order.js';
import { transform } from './transform.js';
import { spot } from './spot.js';
import { sort } from './sort.js';
import { roleplay } from './roleplay.js';
import { scale } from './scale.js';
import { timer } from './timer.js';
import { tense } from './tense.js';
import { timeline } from './timeline.js';

export const BLOCKS = { text, explanation, table, tense, timeline, fill, choice, match, reveal, order, transform, spot, sort, deck, challenge, scale, roleplay, timer, image, notes };

/** Ordem do menu "inserir bloco". */
export const MENU = ['text', 'explanation', 'table', 'tense', 'timeline', 'fill', 'choice', 'match', 'reveal', 'order', 'transform', 'spot', 'sort', 'deck', 'challenge', 'scale', 'roleplay', 'timer', 'image', 'notes'];
