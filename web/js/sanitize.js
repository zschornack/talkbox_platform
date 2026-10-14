// Limpa o HTML editado: mantém só negrito, itálico, sublinhado, highlight e quebras de linha.
const KEEP = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN', 'UL', 'OL', 'LI']);
const STYLES = ['background-color', 'font-weight', 'font-style', 'text-decoration-line', 'text-decoration'];

export function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const root = doc.body.firstChild;
  clean(root);
  const out = root.innerHTML.replace(/^(<br>)+$/, '');
  return out;
}

function clean(node) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === Node.TEXT_NODE) continue;
    if (child.nodeType !== Node.ELEMENT_NODE) {
      child.remove();
      continue;
    }
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED'].includes(child.tagName)) {
      child.remove();
      continue;
    }
    clean(child);
    if (!KEEP.has(child.tagName)) {
      child.replaceWith(...child.childNodes);
      continue;
    }
    const style = child.getAttribute('style');
    for (const attr of [...child.attributes]) child.removeAttribute(attr.name);
    if (style && child.tagName === 'SPAN') {
      const kept = style
        .split(';')
        .map((s) => s.trim())
        .filter((s) => STYLES.some((p) => s.toLowerCase().startsWith(p + ':')) && !/url\(|expression/i.test(s));
      if (kept.length) child.setAttribute('style', kept.join('; '));
    }
    if (child.tagName === 'SPAN' && !child.getAttribute('style')) child.replaceWith(...child.childNodes);
  }
}

export const toText = (html) => {
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return d.textContent || '';
};
