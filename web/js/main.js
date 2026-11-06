// Rotas do app.
//   #/                 Início
//   #/alunos           Alunos          #/alunos/:id   Ficha
//   #/modelos          Modelos         #/modelos/:id  Editar modelo
//   #/modelos/novo     Novo modelo: os formatos, com dois exemplos de cada
//   #/modelos/novo/:formato   Modelo novo (só é salvo no "Salvar modelo")
//   #/imagens          Imagens (acervo e pacotes)    #/imagens/enviar   Enviar imagens    #/imagens/pacote/:id   Um pacote
//   #/nivelamento      Nivelamento de aluno novo (teste de 15 minutos e cadastro)
//   #/curso            O curso: roteiro das 100 aulas (#/curso?nivel=3 abre no nível 3)
//   #/aula/:id         A aula          #/aula/:id/pdf A aula, já abrindo "Exportar PDF"
import { parseHash, h } from './dom.js';
import { renderHome } from './home.js';
import { renderStudents } from './students.js';
import { renderStudent } from './student.js';
import { renderModels } from './models.js';
import { renderModelEditor } from './model-editor.js';
import { renderEditor } from './editor.js';
import { renderGallery } from './gallery.js';
import { renderImages, renderPack, renderUpload } from './images.js';
import { renderCourse } from './course.js';
import { renderPlacement } from './placement.js';

const root = document.getElementById('app');
let cleanup = () => {};
let current = 0;

const ROUTES = [
  [/^\/alunos\/?$/, () => renderStudents(root)],
  [/^\/alunos\/([\w-]+)$/, (m) => renderStudent(root, m[1])],
  [/^\/modelos\/?$/, () => renderModels(root)],
  [/^\/modelos\/novo\/?$/, () => renderGallery(root)],
  [/^\/modelos\/novo\/([\w-]+)$/, (m) => renderModelEditor(root, null, { draft: m[1] })],
  [/^\/modelos\/([\w-]+)$/, (m) => renderModelEditor(root, m[1])],
  [/^\/imagens\/?$/, () => renderImages(root)],
  [/^\/imagens\/enviar\/?$/, () => renderUpload(root)],
  [/^\/imagens\/pacote\/([\w-]+)$/, (m) => renderPack(root, m[1])],
  [/^\/nivelamento\/?$/, () => renderPlacement(root)],
  [/^\/curso\/?$/, () => renderCourse(root, { level: parseHash().query.get('nivel') })],
  [/^\/aula\/([\w-]+)(\/pdf)?$/, (m) => renderEditor(root, m[1], { openExport: !!m[2] })],
  [/^\/?$/, () => renderHome(root)],
];

async function route() {
  const ticket = ++current;
  try { await cleanup(); } catch {}
  cleanup = () => {};
  document.querySelectorAll('.menu, .modal-bg, .drawer-bg, .fmt-bar, .gallery-bg, .viewer-bg').forEach((el) => el.remove());
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
