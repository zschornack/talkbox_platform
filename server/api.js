// Rotas da API: alunos, aulas, modelos e imagens.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import * as db from './db.js';
import { HttpError, readBody, readJson, router } from './http.js';
import { emptyDoc } from './templates.js';

const api = router();
const notFound = (what) => { throw new HttpError(404, `${what} não encontrado(a)`); };
const str = (v, max = 4000) => (v === undefined ? undefined : String(v ?? '').trim().slice(0, max));
const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', '']);
const level = (v) => {
  if (v === undefined) return undefined;
  const up = String(v).trim().toUpperCase();
  if (!LEVELS.has(up)) throw new HttpError(400, 'Nível inválido (use A1 a C2)');
  return up;
};

// ---------------- alunos ----------------
api.add('GET', '/api/students', (_req, _p, url) => {
  const status = url.searchParams.get('status');
  return db.listStudents(status === 'active' ? { active: true } : status === 'inactive' ? { active: false } : {});
});

// o mesmo nome (sem diferenciar acentos e maiúsculas) não pode ser cadastrado duas vezes
const sameName = (name, exceptId) => {
  const dup = db.findStudentByName(name, exceptId);
  if (dup) throw new HttpError(400, `Já existe ${dup.active ? 'um aluno' : 'um aluno inativo'} com esse nome: ${dup.name}.${dup.active ? '' : ' Reative em vez de cadastrar de novo.'}`);
};

api.add('POST', '/api/students', async (req) => {
  const b = await readJson(req);
  const name = str(b.name, 120);
  if (!name) throw new HttpError(400, 'Informe o nome do aluno ou turma');
  sameName(name);
  return [201, db.createStudent({ name, level: level(b.level) ?? '', goal: str(b.goal, 300) ?? '', notes: str(b.notes) ?? '' })];
});

api.add('GET', '/api/students/:id', (_req, { id }) => {
  const student = db.getStudent(id) || notFound('Aluno');
  return { ...student, lessons: db.listLessons({ studentId: id }), stop: db.whereWeStopped(id) };
});

// evolução de um conteúdo do mapa: ?content=Past%20Simple
api.add('GET', '/api/students/:id/history', (_req, { id }, url) => {
  db.getStudent(id) || notFound('Aluno');
  return db.contentHistory(id, url.searchParams.get('content') || '');
});

// "Preparar próxima aula": já vem com os pendentes e o recado do último professor
api.add('POST', '/api/students/:id/next-lesson', async (req, { id }) => {
  db.getStudent(id) || notFound('Aluno');
  const b = await readJson(req);
  return [201, db.prepareNextLesson(id, { title: str(b.title, 200) || 'Nova aula', emptyDoc })];
});

api.add('PUT', '/api/students/:id', async (req, { id }) => {
  const b = await readJson(req);
  if (b.name !== undefined && !str(b.name)) throw new HttpError(400, 'O nome não pode ficar vazio');
  if (b.name !== undefined) sameName(str(b.name, 120), id);
  const map = b.map === undefined ? undefined : Object.fromEntries(
    Object.entries(b.map || {}).filter(([, v]) => v === 'good' || v === 'practicing')
  );
  const student = db.updateStudent(id, {
    name: str(b.name, 120),
    level: level(b.level),
    goal: str(b.goal, 300),
    notes: str(b.notes),
    map,
    active: b.active === undefined ? undefined : !!b.active,
  });
  return student || notFound('Aluno');
});

api.add('POST', '/api/students/:id/lessons', async (req, { id }) => {
  const student = db.getStudent(id) || notFound('Aluno');
  const b = await readJson(req);
  const title = str(b.title, 200) || 'Nova aula';
  const doc = emptyDoc(title);
  doc.level = student.level || '';
  return [201, db.createLesson({ title, studentId: id, doc })];
});

// ---------------- aulas ----------------
api.add('GET', '/api/lessons', (_req, _p, url) =>
  db.listLessons({ limit: url.searchParams.get('limit') || undefined, studentId: url.searchParams.get('student') || undefined })
);

// Curso: as aulas padrão (uma por número do currículo)
api.add('GET', '/api/course', () => db.listCourse());
api.add('GET', '/api/lessons/:id', (_req, { id }) => db.getLesson(id) || notFound('Aula'));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
api.add('PUT', '/api/lessons/:id', async (req, { id }) => {
  const { title, doc, state, date } = await readJson(req);
  if (date !== undefined && !DATE.test(String(date))) throw new HttpError(400, 'Data inválida (use AAAA-MM-DD)');
  const lesson = db.updateLesson(id, { title: str(title, 200), doc, state, date }) || notFound('Aula');
  return { id, updatedAt: lesson.updatedAt };
});

// "Excluir" arquiva: a aula sai das listas, mas nada se perde
api.add('DELETE', '/api/lessons/:id', (_req, { id }) => (db.archiveLesson(id) ? { ok: true } : notFound('Aula')));

// Finalizar aula (handover)
api.add('GET', '/api/lessons/:id/finish', (_req, { id }) => db.finishInfo(id) || notFound('Aula'));
api.add('POST', '/api/lessons/:id/finish', async (req, { id }) => {
  const b = await readJson(req);
  const assessments = Object.fromEntries(
    Object.entries(b.assessments || {}).filter(([k, v]) => str(k) && (v === 'good' || v === 'practicing'))
  );
  const out = db.finishLesson(id, { lastBlockId: b.lastBlockId || null, assessments, message: str(b.message) ?? '' });
  return out ? { ...out, lesson: db.getLesson(id) } : notFound('Aula');
});

// Reabrir aula finalizada (desfaz o handover; nada é apagado)
api.add('POST', '/api/lessons/:id/reopen', (_req, { id }) => {
  const out = db.reopenLesson(id) || notFound('Aula');
  return { ...out, lesson: db.getLesson(id) };
});

// Voltar ao original: o que foi escrito e destacado nos blocos da biblioteca nesta aula é descartado (o modelo nunca mudou)
api.add('POST', '/api/lessons/:id/reset', async (req, { id }) => {
  const b = await readJson(req).catch(() => ({}));
  const ids = Array.isArray(b?.blockIds) ? b.blockIds.map(String) : null;
  return db.resetLesson(id, { blockIds: ids }) || notFound('Aula');
});

api.add('POST', '/api/pending/:id/discard', (_req, { id }) => (db.discardPending(id) ? { ok: true } : notFound('Pendência')));

// Copiar aula: o que a cópia vai mudar (para mostrar antes) e a cópia em si.
// A cópia leva só o material: sem respostas, caneta, anotações, pendências e marca-texto da aula.
api.add('GET', '/api/lessons/:id/copy', (_req, { id }) => db.copyInfo(id) || notFound('Aula'));
api.add('POST', '/api/lessons/:id/duplicate', async (req, { id }) => {
  const src = db.getLesson(id) || notFound('Aula');
  const b = await readJson(req);
  const studentId = b.studentId === undefined ? src.studentId : b.studentId || null;
  if (studentId && !db.getStudent(studentId)) notFound('Aluno');
  const out = db.copyLesson(id, {
    studentId,
    title: str(b.title, 200) || src.title,
    original: b.original !== false,
    keepMarks: b.keepMarks === true,
  });
  return [201, { ...out.lesson, report: out.report }];
});

// ---------------- modelos ----------------
api.add('GET', '/api/models', (_req, _p, url) =>
  db.listModels({ studentId: url.searchParams.get('student') || undefined, status: url.searchParams.get('status') || undefined })
);

api.add('POST', '/api/models', async (req) => {
  const b = await readJson(req);
  const type = str(b.type, 40);
  if (!type || !b.block || typeof b.block !== 'object') throw new HttpError(400, 'Modelo sem formato ou conteúdo');
  if (type === 'image' && !str(b.block.src)) throw new HttpError(400, 'Escolha a imagem antes de salvar.');
  const packIds = Array.isArray(b.packIds) ? b.packIds.map(String) : [];
  for (const p of packIds) if (!db.getPack(p)) notFound('Pacote');
  return [201, db.createModel({ title: str(b.title, 200) || 'Sem título', type, block: b.block, tags: b.tags, packIds })];
});

api.add('GET', '/api/models/:id', (_req, { id }) => db.getModel(id) || notFound('Modelo'));

api.add('PUT', '/api/models/:id', async (req, { id }) => {
  const b = await readJson(req);
  return db.updateModel(id, { title: str(b.title, 200), block: b.block, tags: b.tags }) || notFound('Modelo');
});

api.add('POST', '/api/models/:id/duplicate', async (_req, { id }) => {
  const m = db.getModel(id) || notFound('Modelo');
  return [201, db.createModel({ title: `${m.title} (cópia)`, type: m.type, block: m.block, tags: m.tags })];
});

api.add('POST', '/api/models/:id/restore', async (req, { id }) => {
  const { versionId } = await readJson(req);
  return db.restoreModelVersion(id, Number(versionId)) || notFound('Versão');
});

// "Excluir" arquiva: o modelo sai da biblioteca, mas as aulas que o usaram continuam contando
api.add('DELETE', '/api/models/:id', (_req, { id }) => (db.archiveModel(id) ? { ok: true } : notFound('Modelo')));

// fila "a revisar" (itens importados)
api.add('POST', '/api/models/:id/approve', (_req, { id }) => db.approveModel(id) || notFound('Modelo'));

// ---------------- pacotes de imagens ----------------
api.add('GET', '/api/packs', () => db.listPacks());
api.add('POST', '/api/packs', async (req) => {
  const b = await readJson(req);
  return [201, db.createPack({ name: str(b.name, 80), description: str(b.description, 500) ?? '', keywords: b.keywords })];
});
api.add('GET', '/api/packs/:id', (_req, { id }) => db.getPack(id) || notFound('Pacote'));
api.add('PUT', '/api/packs/:id', async (req, { id }) => {
  const b = await readJson(req);
  return db.updatePack(id, { name: str(b.name, 80), description: str(b.description, 500), keywords: b.keywords }) || notFound('Pacote');
});
api.add('DELETE', '/api/packs/:id', (_req, { id }) => (db.archivePack(id) ? { ok: true } : notFound('Pacote')));
const idList = (v) => (Array.isArray(v) ? v.map(String).slice(0, 500) : []);
api.add('POST', '/api/packs/:id/items', async (req, { id }) => {
  db.getPack(id) || notFound('Pacote');
  const b = await readJson(req);
  return { added: db.addToPack(id, idList(b.modelIds)), pack: db.getPack(id) };
});
api.add('POST', '/api/packs/:id/remove', async (req, { id }) => {
  db.getPack(id) || notFound('Pacote');
  const b = await readJson(req);
  return { removed: db.removeFromPack(id, idList(b.modelIds)), pack: db.getPack(id) };
});

// ---------------- importação ----------------
api.add('GET', '/api/imports', () => db.listImports());
api.add('POST', '/api/imports/:id/undo', (_req, { id }) => {
  if (!db.listImports().some((i) => i.id === id)) notFound('Lote');
  return { archived: db.undoImport(id) };
});

// ---------------- cópia de segurança e exportação ----------------
api.add('POST', '/api/backup', () => ({ file: path.basename(db.backupNow()) }));
api.add('GET', '/api/export', (_req, _p, url) => {
  const data = db.exportAll();
  if (url.searchParams.get('download') !== '1') return data;
  const name = `talkbox-${data.exportedAt.slice(0, 10)}.json`;
  return [200, data, { 'Content-Disposition': `attachment; filename="${name}"` }];
});

// ---------------- resumo para a Home ----------------
api.add('GET', '/api/overview', () => ({
  students: db.listStudents({ active: true }),
  recentLessons: db.listLessons({ limit: 6 }),
  modelCount: db.countModels(),
  stats: db.stats(),
}));

// ---------------- imagens (o navegador já converte para WebP) ----------------
api.add('POST', '/api/uploads', async (req) => {
  if (!String(req.headers['content-type']).startsWith('image/webp')) throw new HttpError(415, 'Envie a imagem em WebP');
  const buf = await readBody(req, 8 * 1024 * 1024);
  if (!buf.length) throw new HttpError(400, 'Imagem vazia');
  // WebP de verdade: começa com RIFF....WEBP
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') throw new HttpError(415, 'O arquivo não é uma imagem WebP');
  // nome = impressão digital do arquivo: a mesma imagem enviada duas vezes é guardada uma vez só
  const name = `${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 32)}.webp`;
  const file = path.join(db.UPLOADS_DIR, name);
  if (!fs.existsSync(file)) fs.writeFileSync(file, buf);
  return [201, { url: `/uploads/${name}` }];
});

// Imagem que está na internet: o servidor busca para o navegador converter em WebP e guardar no acervo.
// Assim a aula funciona sem internet. Só endereços http(s) e só imagens.
api.add('GET', '/api/images/fetch', async (_req, _p, url) => {
  let target;
  try { target = new URL(url.searchParams.get('url') || ''); } catch { throw new HttpError(400, 'Endereço inválido'); }
  if (!['http:', 'https:'].includes(target.protocol)) throw new HttpError(400, 'Endereço inválido');
  let res;
  try {
    res = await fetch(target, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'TalkBox/0.7 (aulas da escola)' } });
  } catch {
    throw new HttpError(502, 'Não consegui baixar a imagem (sem internet?)');
  }
  const type = String(res.headers.get('content-type') || '');
  if (!res.ok || !type.startsWith('image/')) throw new HttpError(502, 'Esse endereço não devolveu uma imagem');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) throw new HttpError(413, 'Imagem grande demais');
  return [200, buf, { 'Content-Type': type, 'Cache-Control': 'no-store' }];
});

// Troca o endereço de uma imagem em todo lugar (acervo, aulas, pendências)
api.add('POST', '/api/images/replace', async (req) => {
  const b = await readJson(req);
  const from = str(b.from, 2000);
  const to = str(b.to, 2000);
  if (!from || !/^\/uploads\/[0-9a-f]{32}\.webp$/.test(to || '')) throw new HttpError(400, 'Troca de imagem inválida');
  return db.replaceImageSrc(from, to);
});

export default api;
