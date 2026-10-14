// Todos os tipos de bloco. Para criar um tipo novo: um arquivo nesta pasta + uma linha aqui.
import { text, explanation, notes } from './basic.js';
import { table } from './table.js';
import { fill } from './fill.js';
import { deck } from './deck.js';
import { challenge } from './challenge.js';
import { image } from './image.js';

export const BLOCKS = { text, explanation, table, fill, deck, challenge, image, notes };

/** Ordem do menu "inserir bloco". */
export const MENU = ['text', 'explanation', 'table', 'fill', 'deck', 'challenge', 'image', 'notes'];
