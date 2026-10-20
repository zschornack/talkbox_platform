// Cartões de role-play: a situação e dois (ou mais) papéis. Cada cartão começa escondido; um clique mostra ou esconde.
// Assim o professor lê o próprio cartão sem o aluno ver na tela compartilhada. No PDF, todos saem abertos.
import { h } from '../dom.js';
import { editable } from '../editable.js';
import { sanitize } from '../sanitize.js';

const printText = (html) => {
  const el = h('div.rp-text.print-only');
  el.innerHTML = sanitize(html);
  return el;
};

export const roleplay = {
  name: 'Cartões de role-play',
  hint: 'Papéis com informação escondida',
  create: () => ({
    label: 'ROLE-PLAY',
    html: 'You are at a hotel reception. Read your card and start the conversation.',
    roles: [
      { name: 'Guest (student)', card: 'You booked a double room for 3 nights, but you want to stay one more night. Ask about breakfast and parking.' },
      { name: 'Receptionist (teacher)', card: 'The hotel is full on the 4th night. Offer a different room (more expensive) or a hotel nearby. Breakfast is from 6 to 10.' },
    ],
  }),
  render(ctx) {
    const b = ctx.block;
    const local = ctx.local;
    local.open ||= {};
    const cards = h('div.rp-cards', b.roles.map((r, i) => {
      const open = !!local.open[i];
      return h('div.rp-card', { class: open ? 'open' : '' },
        h('div.rp-top',
          editable(h('strong.rp-name'), { value: r.name, single: true, rich: false, onChange: (v) => { r.name = v; ctx.changed(); } }),
          h('button.btn.small.screen-only', { type: 'button', onClick: () => { local.open[i] = !open; ctx.rerender(); } }, open ? 'Esconder' : 'Mostrar cartão')),
        open
          ? editable(h('div.rp-text'), { value: r.card, placeholder: 'O que esta pessoa sabe e quer…', onChange: (v) => { r.card = v; ctx.changed(); } })
          : [h('div.rp-hidden.screen-only', 'Cartão escondido'), printText(r.card)]);
    }));
    const situation = editable(h('div.rp-situation'), {
      value: b.html,
      placeholder: 'A situação: onde estão, quem são, o que precisa acontecer…',
      onChange: (v) => { b.html = v; ctx.changed(); },
    });
    return {
      body: h('div.block-body', situation, cards),
      actions: [
        { label: '+ papel', onClick: () => { b.roles.push({ name: 'New role', card: '' }); ctx.changed(); ctx.rerender(); } },
        ...(b.roles.length > 2 ? [{ label: '− papel', onClick: () => { b.roles.pop(); ctx.changed(); ctx.rerender(); } }] : []),
      ],
    };
  },
};
