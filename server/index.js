// Servidor local do TalkBox. Só usa o que já vem com o Node (sem npm install).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPLOADS_DIR, listLessons, getLesson, createLesson, updateLesson, countLessons } from './db.js';
import { seedIfEmpty } from './seed.js';
import { emptyDoc } from './templates.js';

const PORT = Number(process.env.PORT || 3000);
const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const newId = () => crypto.randomBytes(6).toString('base64url');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(Object.assign(new Error('Arquivo grande demais'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req, 5 * 1024 * 1024);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw Object.assign(new Error('JSON inválido'), { status: 400 });
  }
}

function serveFile(res, file, cache) {
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Não encontrado');
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': cache || 'no-cache',
    });
    res.end(data);
  });
}

// Garante que um caminho pedido fica dentro da pasta permitida.
function safeJoin(base, rel) {
  const full = path.resolve(base, '.' + path.posix.normalize('/' + rel));
  return full.startsWith(base + path.sep) || full === base ? full : null;
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api', 'lessons', ':id', ...]
  const [, resource, id, action] = parts;

  if (resource === 'lessons') {
    if (!id && req.method === 'GET') return send(res, 200, listLessons());
    if (!id && req.method === 'POST') {
      const body = await readJson(req);
      const title = String(body.title || '').trim() || 'Nova aula';
      const student = String(body.student || '').trim();
      return send(res, 201, createLesson({ id: newId(), title, student, doc: emptyDoc(title) }));
    }
    if (id && action === 'duplicate' && req.method === 'POST') {
      const src = getLesson(id);
      if (!src) return send(res, 404, { error: 'Aula não encontrada' });
      const body = await readJson(req);
      const title = String(body.title || `${src.title} (cópia)`);
      const student = String(body.student ?? src.student);
      return send(res, 201, createLesson({ id: newId(), title, student, doc: { ...src.doc, title } }));
    }
    if (id && !action && req.method === 'GET') {
      const lesson = getLesson(id);
      return lesson ? send(res, 200, lesson) : send(res, 404, { error: 'Aula não encontrada' });
    }
    if (id && !action && req.method === 'PUT') {
      const { title, student, doc, state } = await readJson(req);
      const lesson = updateLesson(id, { title, student, doc, state });
      return lesson ? send(res, 200, { id, updatedAt: lesson.updatedAt }) : send(res, 404, { error: 'Aula não encontrada' });
    }
  }

  // Imagens: o navegador já converte para WebP antes de mandar.
  if (resource === 'uploads' && !id && req.method === 'POST') {
    if (!String(req.headers['content-type']).startsWith('image/webp')) {
      return send(res, 415, { error: 'Envie a imagem em WebP' });
    }
    const buf = await readBody(req, 8 * 1024 * 1024);
    if (!buf.length) return send(res, 400, { error: 'Imagem vazia' });
    const name = `${newId()}.webp`;
    fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
    return send(res, 201, { url: `/uploads/${name}` });
  }

  return send(res, 404, { error: 'Rota não encontrada' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);

    if (url.pathname.startsWith('/uploads/')) {
      const file = safeJoin(UPLOADS_DIR, decodeURIComponent(url.pathname.slice('/uploads/'.length)));
      return file ? serveFile(res, file, 'public, max-age=2592000, immutable') : send(res, 404, 'Não encontrado');
    }

    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = safeJoin(WEB_DIR, rel);
    if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return serveFile(res, file);
    return serveFile(res, path.join(WEB_DIR, 'index.html')); // rotas do app
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'Erro no servidor' });
  }
});

seedIfEmpty({ countLessons, createLesson, newId });

server.listen(PORT, () => {
  console.log(`\n  TalkBox pronto → abra http://localhost:${PORT}\n`);
});
