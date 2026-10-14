async function call(method, url, body, headers) {
  const res = await fetch(url, {
    method,
    headers: body instanceof Blob ? headers : { 'Content-Type': 'application/json' },
    body: body == null ? undefined : body instanceof Blob ? body : JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  overview: () => call('GET', '/api/overview'),

  students: (status) => call('GET', '/api/students' + (status ? `?status=${status}` : '')),
  student: (id) => call('GET', `/api/students/${id}`),
  createStudent: (data) => call('POST', '/api/students', data),
  saveStudent: (id, data) => call('PUT', `/api/students/${id}`, data),
  createLessonFor: (studentId, data) => call('POST', `/api/students/${studentId}/lessons`, data),

  lessons: (opts = {}) => call('GET', '/api/lessons?' + new URLSearchParams(opts)),
  lesson: (id) => call('GET', `/api/lessons/${id}`),
  saveLesson: (id, data) => call('PUT', `/api/lessons/${id}`, data),
  deleteLesson: (id) => call('DELETE', `/api/lessons/${id}`),
  duplicateLesson: (id, data) => call('POST', `/api/lessons/${id}/duplicate`, data || {}),

  models: (studentId) => call('GET', '/api/models' + (studentId ? `?student=${studentId}` : '')),
  model: (id) => call('GET', `/api/models/${id}`),
  createModel: (data) => call('POST', '/api/models', data),
  saveModel: (id, data) => call('PUT', `/api/models/${id}`, data),
  duplicateModel: (id) => call('POST', `/api/models/${id}/duplicate`),
  restoreModel: (id, versionId) => call('POST', `/api/models/${id}/restore`, { versionId }),
  deleteModel: (id) => call('DELETE', `/api/models/${id}`),

  upload: (blob) => call('POST', '/api/uploads', blob, { 'Content-Type': 'image/webp' }),
};

/** Salva ao sair da página, mesmo que a aba esteja fechando. */
export function saveOnExit(url, data) {
  try {
    fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true });
  } catch {}
}

/** Converte qualquer imagem para WebP, já redimensionada, e envia. */
export async function uploadImage(file, maxW = 1600) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.82));
  if (!blob || blob.type !== 'image/webp') throw new Error('Este navegador não converte para WebP');
  return (await api.upload(blob)).url;
}

/** Salvar automaticamente: junta as mudanças e manda depois de uma pausa curta. */
export function autosaver({ save, statusEl, delay = 700 }) {
  let pending = null;
  let timer = null;
  let saving = false;
  let stopped = false;
  const show = (text, error = false) => {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.classList.toggle('error', error);
  };
  async function flush() {
    clearTimeout(timer);
    timer = null;
    if (saving || !pending || stopped) return;
    const body = pending;
    pending = null;
    saving = true;
    show('Salvando…');
    try {
      await save(body);
      show('Salvo');
    } catch {
      pending = { ...body, ...(pending || {}) };
      show('Erro ao salvar. Tentando de novo…', true);
      timer = setTimeout(flush, 3000);
    } finally {
      saving = false;
      if (pending && !timer) schedule();
    }
  }
  function schedule() {
    clearTimeout(timer);
    show('Editando…');
    timer = setTimeout(flush, delay);
  }
  return {
    /** marca partes para salvar: queue({ doc }) */
    queue(part) { if (stopped) return; pending = { ...(pending || {}), ...part }; schedule(); },
    /** para de salvar (ex.: o item foi excluído) */
    cancel() { stopped = true; pending = null; clearTimeout(timer); },
    flush,
    get pending() { return pending; },
  };
}
