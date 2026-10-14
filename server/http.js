// Ajudantes HTTP pequenos (sem dependências).
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new HttpError(413, 'Arquivo grande demais'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export async function readJson(req) {
  const buf = await readBody(req, 5 * 1024 * 1024);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON inválido');
  }
}

/**
 * Roteador mínimo: route('GET', '/api/students/:id', handler).
 * O handler recebe (req, params, url) e devolve [status, corpo] ou o corpo (status 200).
 */
export function router() {
  const routes = [];
  const add = (method, pattern, handler) => {
    const keys = [];
    const re = new RegExp(
      '^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$'
    );
    routes.push({ method, re, keys, handler });
  };
  const handle = async (req, res, url) => {
    let pathMatched = false;
    for (const r of routes) {
      const m = url.pathname.match(r.re);
      if (!m) continue;
      pathMatched = true;
      if (r.method !== req.method) continue;
      const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const out = await r.handler(req, params, url);
      // [status, corpo] ou [status, corpo, cabeçalhos] (ex.: arquivo para baixar)
      const [status, body, headers] = Array.isArray(out) && typeof out[0] === 'number' ? out : [200, out];
      return send(res, status, body ?? {}, headers);
    }
    throw new HttpError(pathMatched ? 405 : 404, pathMatched ? 'Método não permitido' : 'Rota não encontrada');
  };
  return { add, handle };
}
