// Emojis são proibidos no material: sai a figura, ficam as setas e o certo e errado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripEmoji, stripEmojiDeep } from '../server/emoji.js';

test('tira emojis e deixa os sinais de texto do material', () => {
  assert.equal(stripEmoji('⚠️ no -ing'), 'no -ing');
  assert.equal(stripEmoji('in English class 😄'), 'in English class');
  assert.equal(stripEmoji('There are (☹ more than OK)'), 'There are (more than OK)');
  assert.equal(stripEmoji('🛏️ <b>HOSTEL</b>'), '<b>HOSTEL</b>');
  assert.equal(stripEmoji('✗ I am liking → ✓ I like'), '✗ I am liking → ✓ I like');
  assert.equal(stripEmoji('a ↔ b · Editar ↗'), 'a ↔ b · Editar ↗');
  assert.deepEqual(stripEmojiDeep({ rows: [['💡 tip', 1]], ok: true }), { rows: [['tip', 1]], ok: true });
});
