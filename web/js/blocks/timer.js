// Cronômetro de fala: "fale por 1 minuto" com contagem regressiva e um tema sorteado.
import { h, escapeHtml } from '../dom.js';
import { editable } from '../editable.js';
import { toText, sanitize } from '../sanitize.js';
import { lines, linesPanel, panelAction } from './kit.js';

const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export const timer = {
  name: 'Cronômetro de fala',
  hint: 'Fale por 1 minuto sobre o tema',
  create: () => ({
    label: 'SPEAKING · ONE MINUTE',
    html: 'Talk about the topic until the time is up. Don\'t stop!',
    seconds: 60,
    topics: ['Your favorite place in your city', 'The best trip of your life', 'Something you want to learn'],
  }),
  render(ctx) {
    const b = ctx.block;
    const local = ctx.local;
    if (!b.topics.length) b.topics.push('');
    local.t = Math.min(local.t || 0, b.topics.length - 1);
    if (local.left === undefined) local.left = b.seconds;
    const clock = h('div.timer-clock', { class: local.left === 0 ? 'done' : local.left <= 10 ? 'warn' : '' }, local.left === 0 ? 'Time!' : fmt(local.left));
    local.clockEl = clock;
    const stop = () => { clearInterval(local.iv); local.iv = null; };
    const start = () => {
      if (local.iv) return;
      if (local.left === 0) local.left = b.seconds;
      local.iv = setInterval(() => {
        const el = local.clockEl; // o relógio que está na tela agora (muda a cada redesenho)
        // o bloco saiu da tela (outra página): para o relógio
        if (!el || !el.isConnected) return stop();
        local.left = Math.max(0, local.left - 1);
        el.textContent = local.left === 0 ? 'Time!' : fmt(local.left);
        el.className = 'timer-clock ' + (local.left === 0 ? 'done' : local.left <= 10 ? 'warn' : '');
        if (local.left === 0) { stop(); ctx.rerender(); }
      }, 1000);
      ctx.rerender();
    };
    const card = h('div.timer-card',
      h('div.deck-meta', h('span', 'Topic'), h('span', `${local.t + 1} / ${b.topics.length}`)),
      editable(h('div.deck-q'), { value: b.topics[local.t], placeholder: 'Tema…', onChange: (v) => { b.topics[local.t] = v; ctx.changed(); } }),
      h('div.timer-row',
        clock,
        h('div.btns.screen-only',
          local.iv
            ? h('button.btn', { type: 'button', onClick: () => { stop(); ctx.rerender(); } }, 'Pausar')
            : h('button.btn.cta', { type: 'button', onClick: start }, local.left < b.seconds && local.left > 0 ? 'Continuar' : 'Começar'),
          h('button.btn', { type: 'button', onClick: () => { stop(); local.left = b.seconds; ctx.rerender(); } }, 'Zerar'),
          h('button.btn', {
            type: 'button',
            onClick: () => {
              stop();
              const n = b.topics.length;
              let r = Math.floor(Math.random() * n);
              if (n > 1 && r === local.t) r = (r + 1) % n;
              local.t = r; local.left = b.seconds; ctx.rerender();
            },
          }, 'Outro tema'))));
    const print = h('div.print-only', h('ol.print-list', b.topics.map((t) => { const li = h('li'); li.innerHTML = sanitize(t); return li; })));
    const intro = editable(h('div.muted-text.opt'), { value: b.html, placeholder: 'Instrução (opcional)', onChange: (v) => { b.html = v; ctx.changed(); } });
    const body = h('div.block-body', intro, card, print);
    if (local.panel) {
      body.append(linesPanel(ctx, {
        title: 'TEMAS',
        help: 'Um tema por linha.',
        value: b.topics.map(toText).join('\n'),
        parse: (txt) => { b.topics = lines(txt).map(escapeHtml); return { ok: true }; },
        extra: h('label.check', 'Tempo (segundos): ', h('input', {
          type: 'number', min: '10', max: '600', step: '10', value: String(b.seconds), style: { width: '90px' },
          onInput: (e) => { const v = Math.max(10, Math.min(600, Number(e.target.value) || 60)); b.seconds = v; local.left = v; ctx.changed(); },
        })),
      }));
    }
    return { body, actions: [panelAction(ctx, 'Editar temas')] };
  },
};
