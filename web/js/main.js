// Rotas do app: #/ (aulas) e #/aula/:id (editor).
import { renderLessons } from './lessons.js';
import { renderEditor } from './editor.js';

const root = document.getElementById('app');
let cleanup = () => {};

async function route() {
  cleanup();
  cleanup = () => {};
  const m = location.hash.match(/^#\/aula\/([\w-]+)/);
  window.scrollTo(0, 0);
  cleanup = m ? await renderEditor(root, m[1]) : await renderLessons(root);
}

window.addEventListener('hashchange', route);
route();
