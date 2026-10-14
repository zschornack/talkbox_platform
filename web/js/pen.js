// Caneta: desenhar por cima de qualquer conteúdo (requisitos 9.5).
const NS = 'http://www.w3.org/2000/svg';

export function mountPen(paper, { getPaths, setPaths }) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'pen-layer');
  svg.setAttribute('aria-hidden', 'true');
  paper.append(svg);

  let active = false;
  let current = null;
  let currentEl = null;

  const d = (pts) => 'M' + pts.map((p) => `${p[0]} ${p[1]}`).join(' L');
  const draw = () => {
    svg.replaceChildren(
      ...getPaths().map((pts) => {
        const p = document.createElementNS(NS, 'path');
        p.setAttribute('d', d(pts));
        return p;
      })
    );
  };
  const pt = (e) => {
    const r = paper.getBoundingClientRect();
    return [Math.round(e.clientX - r.left), Math.round(e.clientY - r.top)];
  };

  svg.addEventListener('pointerdown', (e) => {
    if (!active) return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    current = [pt(e)];
    currentEl = document.createElementNS(NS, 'path');
    svg.append(currentEl);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!current) return;
    current.push(pt(e));
    currentEl.setAttribute('d', d(current));
  });
  const end = () => {
    if (!current) return;
    if (current.length > 1) setPaths([...getPaths(), current]);
    current = null;
    currentEl = null;
    draw();
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  draw();
  return {
    redraw: draw,
    setActive(on) {
      active = on;
      svg.classList.toggle('active', on);
      if (on) window.getSelection()?.removeAllRanges();
    },
    get active() { return active; },
  };
}
