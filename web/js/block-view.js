// Mostra e edita um bloco. Usado na aula e no editor de modelos (o mesmo editor, requisitos 7.3).
import { h, svgIcon, ICONS } from './dom.js';
import { editable } from './editable.js';
import { BLOCKS } from './blocks/index.js';
import { toast } from './ui.js';

/**
 * mountBlock(block, {
 *   changed()            — o conteúdo do bloco mudou (salvar)
 *   state()              — objeto de estado da aula para este bloco (respostas etc.)
 *   stateChanged()       — o estado mudou (salvar)
 *   local                — memória da tela (aba aberta, carta atual…), não é salva
 *   tools: [{icon,label,run}]   — botões laterais (mover, duplicar, remover)
 *   extraActions: () => [{label,onClick,on}] — botões extras no canto (ex.: "Salvar como modelo")
 *   slashKey(e)          — tecla "/" num texto vazio
 * })
 */
export function mountBlock(block, opts) {
  const def = BLOCKS[block.type];
  const el = h('section.block', { class: block.type, dataset: { id: block.id } });
  if (!def) {
    el.append(h('p.muted-text', `Bloco desconhecido: ${block.type}`));
    return el;
  }
  const local = opts.local || {};
  const paint = (o = {}) => {
    const ctx = {
      block,
      pop: !!o.pop,
      changed: opts.changed,
      state: opts.state || (() => (local.__state ||= {})),
      stateChanged: opts.stateChanged || (() => {}),
      local,
      rerender: (x) => paint(x),
      toast,
      slashKey: opts.slashKey ? (e) => opts.slashKey(e, block) : undefined,
    };
    const out = def.render(ctx);
    const tools = opts.tools?.length
      ? h('div.block-tools', opts.tools.map((t) =>
          h('button.tool', { type: 'button', title: t.label, 'aria-label': t.label, onClick: t.run }, svgIcon(ICONS[t.icon], 16))))
      : null;
    const actions = [...(out.actions || []), ...(opts.extraActions?.() || [])];
    const actionsEl = actions.length
      ? h('div.block-actions', actions.map((a) => h('button', { type: 'button', class: a.on ? 'on' : '', onClick: a.onClick }, a.label)))
      : null;
    const label =
      def.hasLabel === false
        ? null
        : editable(h('div.block-label'), {
            value: block.label || '',
            placeholder: 'TÍTULO DO BLOCO (OPCIONAL)',
            single: true,
            rich: false,
            onChange: (v) => { block.label = v; opts.changed(); },
          });
    el.replaceChildren(...[tools, actionsEl, h('div.block-body', label, out.body)].filter(Boolean));
  };
  el.repaint = paint;
  paint();
  return el;
}

/** Copia um bloco com ids novos (para entrar numa aula ou virar modelo). */
export function copyBlock(block, uidFn) {
  const copy = JSON.parse(JSON.stringify(block));
  copy.id = uidFn();
  (copy.items || []).forEach((it) => (it.id = uidFn('i')));
  return copy;
}
