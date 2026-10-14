// Rotas do app.
//   #/                 Início
//   #/alunos           Alunos          #/alunos/:id   Ficha
//   #/modelos          Modelos         #/modelos/:id  Editar modelo
//   #/aula/:id         A aula          #/aula/:id/pdf A aula, já abrindo "Exportar PDF"
import { parseHash, h } from './dom.js';
import { renderHome } from './home.js';
import { renderStudents } from './students.js';
import { renderStudent } from './student.js';
import { renderModels } from './models.js';
import { renderModelEditor } from './model-editor.js';
import { renderEditor } from './editor.js';

const root = document.getElementById('app');
let cleanup = () => {};
let current = 0;

const ROUTES = [
  [/^\/alunos\/?$/, () => renderStudents(root)],
  [/^\/alunos\/([\w-]+)$/, (m) => renderStudent(root, m[1])],
  [/^\/modelos\/?$/, () => renderModels(root)],
  [/^\/modelos\/([\w-]+)$/, (m) => renderModelEditor(root, m[1])],
  [/^\/aula\/([\w-]+)(\/pdf)?$/, (m) => renderEditor(root, m[1], { openExport: !!m[2] })],
  [/^\/?$/, () => renderHome(root)],
];

async function route() {
  const ticket = ++current;
  try { await cleanup(); } catch {}
  cleanup = () => {};
  document.querySelectorAll('.menu, .modal-bg, .drawer-bg, .fmt-bar').forEach((el) => el.remove());
  const { path } = parseHash();
  window.scrollTo(0, 0);
  for (const [re, render] of ROUTES) {
    const m = path.match(re);
    if (!m) continue;
    try {
      const fn = await render(m);
      if (ticket === current) cleanup = fn || (() => {});
      else fn?.();
    } catch (err) {
      console.error(err);
      root.replaceChildren(h('div.page', h('h1', 'Algo deu errado'), h('p', err.message), h('a.btn', { href: '#/' }, 'Voltar para o início')));
    }
    return;
  }
  location.hash = '#/';
}

window.addEventListener('hashchange', route);
route();
