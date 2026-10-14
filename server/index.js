// Servidor local do TalkBox. Só usa o que já vem com o Node (sem npm install).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPLOADS_DIR } from './db.js';
import { send } from './http.js';
import api from './api.js';
import { seed } from './seed.js';
import { importContentDir } from './content.js';

const PORT = Number(process.env.PORT || 3000);
const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) return await api.handle(req, res, url);

    if (url.pathname.startsWith('/uploads/')) {
      const file = safeJoin(UPLOADS_DIR, decodeURIComponent(url.pathname.slice('/uploads/'.length)));
      return file ? serveFile(res, file, 'public, max-age=2592000, immutable') : send(res, 404, 'Não encontrado');
    }

    const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    const file = safeJoin(WEB_DIR, rel);
    if (file && fs.existsSync(file) && fs.statSync(file).isFile()) return serveFile(res, file);
    return serveFile(res, path.join(WEB_DIR, 'index.html'));
  } catch (err) {
    if (!err.status) console.error(err);
    if (!res.headersSent) send(res, err.status || 500, { error: err.status ? err.message : 'Erro no servidor' });
  }
});

seed();
importContentDir();

server.listen(PORT, () => {
  console.log(`\n  TalkBox pronto → abra http://localhost:${PORT}\n`);
});
