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

export const BLOCKS = { text, explanation, table, fill, choice, match, deck, challenge, image, notes };

/** Ordem do menu "inserir bloco". */
export const MENU = ['text', 'explanation', 'table', 'fill', 'choice', 'match', 'deck', 'challenge', 'image', 'notes'];
