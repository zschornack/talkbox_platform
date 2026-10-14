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
  lessons: () => call('GET', '/api/lessons'),
  lesson: (id) => call('GET', `/api/lessons/${id}`),
  createLesson: (data) => call('POST', '/api/lessons', data),
  duplicateLesson: (id, data) => call('POST', `/api/lessons/${id}/duplicate`, data || {}),
  saveLesson: (id, data) => call('PUT', `/api/lessons/${id}`, data),
  upload: (blob) => call('POST', '/api/uploads', blob, { 'Content-Type': 'image/webp' }),
};

/** Salva ao sair da página, mesmo que a aba esteja fechando. */
export function saveOnExit(id, data) {
  try {
    fetch(`/api/lessons/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: true,
    });
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
