// Nivelamento (v1.2): teste de uns 15 minutos para um aluno novo. O conteúdo e a conta estão em placement-data.js.
// O andamento fica guardado no navegador até cadastrar o aluno ou recomeçar (fechar a aba não perde nada).
import { h, svgIcon, ICONS } from './dom.js';
import { api } from './api.js';
import { appShell } from './layout.js';
import { toast, confirmDialog, field } from './ui.js';
import { LEVELS } from './catalog.js';
import { seededShuffle } from './blocks/kit.js';
import { STAGES, RATING, stageScore, suggestLevel, suggestMap, summaryText } from './placement-data.js';

const KEY = 'talkbox.placement';
const fresh = () => ({ stage: 0, done: 0, answers: {}, ratings: {}, result: false });
const load = () => { try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return fresh(); } };
const store = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem armazenamento: só não lembra */ } };
const clear = () => { try { localStorage.removeItem(KEY); } catch { /* ignora */ } };

const LEVEL_NAMES = { A1: 'Básico', A2: 'Básico', B1: 'Intermediário', B2: 'Intermediário avançado', C1: 'Avançado', C2: 'Avançado' };
const STATUS = { good: 'Já está bom', practicing: 'Praticando', none: 'Nunca viu' };
const NEXT = { good: 'practicing', practicing: 'none', none: 'good' };

export function renderPlacement(root) {
  document.title = 'Nivelamento · TalkBox';
  const s = load();
  const save = () => store(s);
  const shown = new Set(); // frases de escuta à mostra (não fica guardado)

  const stepper = () => h('ol.pl-steps', { 'aria-label': 'Etapas' },
    STAGES.map((st, i) => {
      const state = !s.result && i === s.stage ? 'now' : i < s.done ? 'done' : '';
      const can = i <= s.done && (i !== s.stage || s.result);
      return h('li', h('button.pl-step', {
        type: 'button', class: state, disabled: !can, 'aria-current': state === 'now' ? 'step' : null,
        onClick: () => { s.stage = i; s.result = false; save(); paint(); },
      }, h('span.pl-dot', state === 'done' ? svgIcon(ICONS.check, 14) : String(i + 1)), h('span.pl-step-text', h('strong', st.name), h('small', st.levels))));
    }),
    h('li', h('button.pl-step', {
      type: 'button', class: s.result ? 'now' : '', disabled: !s.done || s.result,
      onClick: () => { s.result = true; save(); paint(); },
    }, h('span.pl-dot', '='), h('span.pl-step-text', h('strong', 'Resultado'), h('small', 'nível e cadastro')))));

  const restart = async () => {
    if (!(await confirmDialog('As respostas e as notas deste nivelamento saem.', { title: 'Recomeçar o nivelamento?', confirmLabel: 'Recomeçar' }))) return;
    clear();
    Object.assign(s, fresh());
    paint();
  };

  // ---------- uma etapa ----------
  function stageView() {
    const st = STAGES[s.stage];
    const pick = (id, i) => { s.answers[id] = i; save(); paint({ keepScroll: true }); };
    const options = (item) => h('span.pl-opts', seededShuffle(item.options.map((o, i) => ({ o, i })), item.id).map(({ o, i }) =>
      h('button.pl-opt', { type: 'button', class: s.answers[item.id] === i ? 'on' : '', 'aria-pressed': String(s.answers[item.id] === i), onClick: () => pick(item.id, i) }, o)));
    const section = (label, hint, ...body) => h('section.pl-sec', h('div.pl-sec-head', h('h2', label), hint ? h('span', hint) : null), ...body);

    const auto = [...st.grammar, ...st.reading.questions];
    const answered = auto.filter((it) => s.answers[it.id] !== undefined).length;
    const sc = stageScore(st, s.answers);
    const last = s.stage === STAGES.length - 1;
    const finish = (stop) => {
      s.done = Math.max(s.done, s.stage + 1);
      if (stop || last) { s.done = s.stage + 1; s.result = true; } else s.stage += 1;
      save();
      paint();
    };

    return h('div.pl-paper',
      h('header.pl-stage-head', h('span.pl-kicker', `Etapa ${s.stage + 1} de ${STAGES.length}`), h('h1', st.name), h('span.pl-levels', st.levels)),
      section('Conversa', 'Fala: nota no fim',
        h('ol.pl-talk', st.talk.map((q) => h('li', q)))),
      section('Leitura', null,
        h('p.pl-reading', st.reading.text),
        h('ol.pl-items', st.reading.questions.map((q) => h('li', h('span.pl-q', q.q), options(q))))),
      section('Escuta', 'O professor lê. O aluno diz o que ouviu.',
        h('ol.pl-listen', st.listening.map((t, i) => {
          const key = `${s.stage}:${i}`;
          const on = shown.has(key);
          return h('li', h('span.pl-listen-text', { class: on ? 'on' : '', 'aria-hidden': String(!on) }, t),
            h('button.btn.small', { type: 'button', onClick: () => { on ? shown.delete(key) : shown.add(key); paint({ keepScroll: true }); } }, on ? 'Esconder' : 'Mostrar frase'));
        }))),
      section('Gramática', null,
        h('ol.pl-items.pl-grammar', st.grammar.map((g) => h('li', g.before ? h('span', g.before) : null, options(g), g.after ? h('span', g.after) : null)))),
      h('footer.pl-foot',
        h('span.pl-count', `${answered} de ${auto.length} respondidas`),
        answered === auto.length && sc.pct < 0.5 && !last ? h('span.pl-warn', 'Muitos erros nesta etapa. Pode parar aqui.') : null,
        h('div.btns',
          h('button.btn', { type: 'button', onClick: () => finish(true) }, last ? 'Ver o resultado' : 'Parar aqui e ver o resultado'),
          last ? null : h('button.btn.primary', { type: 'button', onClick: () => finish(false) }, `Próxima etapa: ${STAGES[s.stage + 1].name}`, svgIcon(ICONS.arrow, 16)))));
  }

  // ---------- resultado e cadastro ----------
  function resultView() {
    s.ratings ||= {};
    const scores = () => STAGES.map((st, i) => stageScore(st, s.answers, s.ratings[i] || {}));
    const name = h('input', { type: 'text', maxlength: '120', autocomplete: 'off', placeholder: 'Nome do aluno', value: s.name || '', onInput: (e) => { s.name = e.target.value; save(); } });
    const goal = h('input', { type: 'text', maxlength: '300', autocomplete: 'off', placeholder: 'Ex.: Conversação para o trabalho', value: s.goal || '', onInput: (e) => { s.goal = e.target.value; save(); } });
    const notes = h('textarea', { rows: 6, onInput: (e) => { s.notes = e.target.value; s.notesEdited = true; save(); } });
    const summary = h('div.pl-summary');

    const level = () => s.level || suggestLevel(scores(), s.done);
    const map = () => {
      const auto = suggestMap(s.answers, s.done, scores());
      return Object.fromEntries(Object.keys(auto).map((k) => [k, s.map?.[k] || auto[k]]));
    };

    function paintSummary() {
      const sc = scores();
      const total = sc.slice(0, s.done).reduce((a, x) => ({ p: a.p + x.points, m: a.m + x.max }), { p: 0, m: 0 });
      const lv = level();
      const suggested = suggestLevel(sc, s.done);
      const missing = sc.slice(0, s.done).some((x) => x.talk === null || x.listen === null);
      if (!s.notesEdited) notes.value = summaryText(sc, s.done, lv);

      const rater = (i, key) => h('span.pl-rate', { role: 'group' }, RATING.map((r) =>
        h('button', {
          type: 'button', class: (s.ratings[i] || {})[key] === r.value ? 'on' : '', title: r.label,
          onClick: () => { s.ratings[i] = { ...(s.ratings[i] || {}), [key]: r.value }; save(); paintSummary(); },
        }, String(r.value))));

      const m = map();
      const chip = (c) => h('button.pl-chip', {
        type: 'button', class: m[c], title: `${STATUS[m[c]]}. Clique para mudar.`,
        onClick: () => { s.map = { ...(s.map || {}), [c]: NEXT[m[c]] }; save(); paintSummary(); },
      }, h('span', c), h('small', STATUS[m[c]]));

      summary.replaceChildren(
        h('div.pl-verdict',
          h('div.pl-level', lv),
          h('div.pl-verdict-text',
            h('strong', LEVEL_NAMES[lv]),
            h('span', `${total.p} de ${total.m} pontos · ${s.done} de ${STAGES.length} etapas`),
            s.level && s.level !== suggested ? h('span.muted', `O app sugeriu ${suggested}.`) : missing ? h('span.muted', 'Dê as notas de fala e escuta para fechar o resultado.') : null)),
        h('div.pl-table', { role: 'table' },
          h('div.pl-row.head', { role: 'row' }, ['Etapa', 'Gramática', 'Leitura', 'Fala', 'Escuta', 'Total'].map((t) => h('span', { role: 'columnheader' }, t))),
          STAGES.map((st, i) => {
            if (i >= s.done) return h('div.pl-row.off', { role: 'row' }, h('span', h('strong', st.name), h('small', st.levels)), h('span.pl-span', 'Não fez'));
            const x = sc[i];
            return h('div.pl-row', { role: 'row', class: x.pct >= 0.7 ? 'pass' : '' },
              h('span', h('strong', st.name), h('small', st.levels)),
              h('span', `${x.grammar}/${x.grammarMax}`),
              h('span', `${x.reading}/${x.readingMax}`),
              rater(i, 'talk'),
              rater(i, 'listen'),
              h('span.pl-total', h('span.pl-bar', h('span', { style: { width: `${Math.round(x.pct * 100)}%` } })), `${Math.round(x.pct * 100)}%`));
          })),
        h('p.pl-legend', 'Fala e escuta: 0 nada · 1 pouco · 2 quase tudo · 3 tudo'),
        h('div.pl-field', h('h3', 'Nível'),
          h('div.pl-levels-pick', LEVELS.map((l) => h('button.pl-lv', {
            type: 'button', class: [l === lv ? 'on' : '', l === suggested ? 'sug' : ''].join(' '), title: l === suggested ? 'Sugestão do app' : null,
            onClick: () => { s.level = l === suggested ? null : l; save(); paintSummary(); },
          }, l)))),
        Object.keys(m).length
          ? h('div.pl-field', h('h3', 'Mapa da ficha'), h('p.muted.small', 'Vem da gramática. Clique para mudar.'),
              h('div.pl-chips', Object.keys(m).map(chip)))
          : null);
    }
    paintSummary();

    const submit = h('button.btn.primary', { type: 'button' }, 'Cadastrar aluno');
    submit.addEventListener('click', async () => {
      if (!name.value.trim()) { name.focus(); return toast('Escreva o nome do aluno.'); }
      submit.disabled = true;
      try {
        const created = await api.createStudent({ name: name.value.trim(), level: level(), goal: goal.value.trim(), notes: notes.value.trim() });
        const good = Object.fromEntries(Object.entries(map()).filter(([, v]) => v !== 'none'));
        if (Object.keys(good).length) await api.saveStudent(created.id, { map: good });
        clear();
        toast(`${created.name} cadastrado, nível ${level()}.`);
        location.hash = `#/alunos/${created.id}`;
      } catch (err) {
        toast(err.message);
        submit.disabled = false;
      }
    });

    return h('div.pl-result',
      h('div.pl-paper', summary),
      h('section.pl-paper.pl-form',
        h('h2', 'Cadastrar o aluno'),
        h('div.field-row', field('Nome', name), field('Objetivo', goal)),
        field('Observações', notes, 'Já vem com o resumo do nivelamento.'),
        h('div.btns', submit)));
  }

  function paint({ keepScroll = false } = {}) {
    const y = window.scrollY;
    root.replaceChildren(appShell('home',
      h('div.page.placement',
        h('header.pl-head',
          h('div', h('a.back-link', { href: '#/' }, svgIcon(ICONS.back, 16), 'Início'), h('h1', 'Nivelamento'),
            h('p.page-sub', 'Uns 15 minutos. Pare quando ficar difícil.')),
          s.done || Object.keys(s.answers).length ? h('button.btn.small', { type: 'button', onClick: restart }, 'Recomeçar') : null),
        stepper(),
        s.result ? resultView() : stageView())));
    if (keepScroll) window.scrollTo(0, y);
    else window.scrollTo(0, 0);
  }
  paint();
  return () => {};
}
