// Estrutura das telas de gestão: menu lateral + conteúdo (requisitos, seção 4).
import { h, svgIcon, ICONS, brandMark } from './dom.js';
import { api } from './api.js';
import { toast } from './ui.js';

const NAV = [
  { key: 'home', href: '#/', label: 'Início', icon: 'home' },
  { key: 'students', href: '#/alunos', label: 'Alunos', icon: 'users' },
  { key: 'models', href: '#/modelos', label: 'Modelos', icon: 'layers' },
];

export function appShell(active, ...content) {
  const nav = h(
    'nav.sidebar',
    { 'aria-label': 'Menu principal' },
    h('div.side-brand', brandMark({ size: 'lg' })),
    h('ul.side-nav',
      NAV.map((n) =>
        h('li', h('a', { href: n.href, class: n.key === active ? 'active' : '', 'aria-current': n.key === active ? 'page' : null },
          svgIcon(ICONS[n.icon], 20), h('span', n.label)))
      )
    ),
    h('div.side-foot',
      h('div.side-data',
        h('button.link-btn', {
          type: 'button',
          title: 'O sistema já faz uma cópia por dia sozinho, em data/backups/',
          onClick: async () => {
            try { await api.backup(); toast('Cópia de segurança feita (pasta data/backups).'); } catch (e) { toast(e.message); }
          },
        }, 'Fazer cópia de segurança'),
        h('a.link-btn', { href: '/api/export?download=1', title: 'Todos os dados num arquivo só (as imagens ficam em data/uploads)' }, 'Baixar todos os dados')),
      h('span', 'Versão local · 0.6'))
  );
  return h('div.app', nav, h('main.app-main', { id: 'main' }, content));
}

/** Cabeçalho padrão de página: título, faixa, subtítulo e botões. */
export function pageHead({ title, subtitle, actions, back }) {
  return h(
    'header.page-head',
    h('div.page-title',
      back ? h('a.back-link', { href: back.href }, svgIcon(ICONS.back, 16), back.label) : null,
      h('h1', title),
      h('div.stripe', { 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
      subtitle ? h('p.page-sub', subtitle) : null
    ),
    actions ? h('div.page-actions', actions) : null
  );
}
