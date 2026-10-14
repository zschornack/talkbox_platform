// Rotas da API: alunos, aulas, modelos e imagens.
import fs from 'node:fs';
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

api.add('POST', '/api/students', async (req) => {
  const b = await readJson(req);
  const name = str(b.name, 120);
  if (!name) throw new HttpError(400, 'Informe o nome do aluno ou turma');
  return [201, db.createStudent({ name, level: level(b.level) ?? '', goal: str(b.goal, 300) ?? '', notes: str(b.notes) ?? '' })];
});

api.add('GET', '/api/students/:id', (_req, { id }) => {
  const student = db.getStudent(id) || notFound('Aluno');
  return { ...student, lessons: db.listLessons({ studentId: id }) };
});

api.add('PUT', '/api/students/:id', async (req, { id }) => {
  const b = await readJson(req);
  if (b.name !== undefined && !str(b.name)) throw new HttpError(400, 'O nome não pode ficar vazio');
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

api.add('GET', '/api/lessons/:id', (_req, { id }) => db.getLesson(id) || notFound('Aula'));

api.add('PUT', '/api/lessons/:id', async (req, { id }) => {
  const { title, doc, state } = await readJson(req);
  const lesson = db.updateLesson(id, { title: str(title, 200), doc, state }) || notFound('Aula');
  return { id, updatedAt: lesson.updatedAt };
});

api.add('DELETE', '/api/lessons/:id', (_req, { id }) => (db.deleteLesson(id) ? { ok: true } : notFound('Aula')));

api.add('POST', '/api/lessons/:id/duplicate', async (req, { id }) => {
  const src = db.getLesson(id) || notFound('Aula');
  const b = await readJson(req);
  const studentId = b.studentId === undefined ? src.studentId : b.studentId;
  if (studentId && !db.getStudent(studentId)) notFound('Aluno');
  const title = str(b.title, 200) || src.title;
  return [201, db.createLesson({ title, studentId, doc: { ...src.doc, title } })];
});

// ---------------- modelos ----------------
api.add('GET', '/api/models', (_req, _p, url) => db.listModels({ studentId: url.searchParams.get('student') || undefined }));

api.add('POST', '/api/models', async (req) => {
  const b = await readJson(req);
  const type = str(b.type, 40);
  if (!type || !b.block || typeof b.block !== 'object') throw new HttpError(400, 'Modelo sem formato ou conteúdo');
  return [201, db.createModel({ title: str(b.title, 200) || 'Sem título', type, block: b.block, tags: b.tags })];
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

api.add('DELETE', '/api/models/:id', (_req, { id }) => (db.deleteModel(id) ? { ok: true } : notFound('Modelo')));

// ---------------- resumo para a Home ----------------
api.add('GET', '/api/overview', () => ({
  students: db.listStudents({ active: true }),
  recentLessons: db.listLessons({ limit: 6 }),
  modelCount: db.countModels(),
}));

// ---------------- imagens (o navegador já converte para WebP) ----------------
api.add('POST', '/api/uploads', async (req) => {
  if (!String(req.headers['content-type']).startsWith('image/webp')) throw new HttpError(415, 'Envie a imagem em WebP');
  const buf = await readBody(req, 8 * 1024 * 1024);
  if (!buf.length) throw new HttpError(400, 'Imagem vazia');
  const name = `${db.newId()}.webp`;
  fs.writeFileSync(path.join(db.UPLOADS_DIR, name), buf);
  return [201, { url: `/uploads/${name}` }];
});

export default api;
