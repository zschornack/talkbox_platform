// Ponto de entrada: confere a versão do Node antes de tudo e explica o que fazer se for antiga.
const MIN = [22, 13];
const [major, minor] = process.versions.node.split('.').map(Number);

if (major < MIN[0] || (major === MIN[0] && minor < MIN[1])) {
  console.error(`
  O TalkBox precisa do Node.js ${MIN.join('.')} ou mais novo.
  Seu computador está com o Node.js ${process.versions.node}.

  Como resolver:
    1. Acesse https://nodejs.org
    2. Baixe e instale a versão LTS (botão verde)
    3. Feche e abra o terminal de novo
    4. Confira com:  node -v
    5. Rode de novo: npm start
`);
  process.exit(1);
}

// O SQLite do Node ainda é marcado como "experimental" e imprime um aviso; escondemos só esse aviso.
const emit = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  const type = typeof rest[0] === 'string' ? rest[0] : rest[0]?.type;
  if (type === 'ExperimentalWarning' && String(warning).includes('SQLite')) return;
  return emit.call(process, warning, ...rest);
};

await import('./index.js');
