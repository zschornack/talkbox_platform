# TalkBox · instruções para quem trabalha neste repositório

## Conteúdo pedagógico

- **Explicações de tempos verbais** (modelos, aulas e pacotes em `content/`) seguem SEMPRE `docs/metodologia-tempos-verbais.md`. Leia esse arquivo antes de criar ou editar qualquer explicação de tempo verbal.
- Regra que vale para tudo: **tabelas usam um verbo só.** Nunca dois verbos lado a lado na mesma tabela, porque o aluno pode ler "I worked went".
- **Etiquetas de conteúdo** usam os nomes oficiais de `web/js/catalog.js`. Sinônimos são convertidos automaticamente.

## Modo atual: só local (desde 19/10/2026)

- **Não faça commit nem push no GitHub.** Por enquanto tudo é testado e alterado só nesta pasta, no computador do Miguel.
- Um professor só (o Miguel). Login, servidor on-line e vários professores ficam para depois.
- Tudo o que acontece no app (editar aula, finalizar, reabrir, planejar a próxima, mapa, modelos) grava direto no banco local `data/talkbox.db`.

## Identidade visual (igual ao site da escola)

- Cores: verde `#02453A` e laranja `#FF6600` (tirados da logo), com o menta `#E4EFEA` de apoio. Tudo vem das variáveis do começo de `web/css/app.css`.
- Fontes: **Nunito Sans** em títulos e interface (títulos em 900, com espaçamento apertado `-0.045em`) e **Atkinson Hyperlegible** no texto corrido (sem serifa: o Miguel não quer fonte serifada).
- **A marca TalkBox é sempre a mesma**: a logo (`web/img/talkbox-logo.png`) + "TalkBox" em Nunito Sans 900, verde, `letter-spacing: -0.045em`. Use sempre `brandMark()` de `web/js/dom.js`; nunca escreva "TalkBox" estilizado de outro jeito.

## Código

- Só Node (22.13 ou mais novo), sem dependências. O banco é o SQLite embutido no Node, em `data/` (fora do git).
- Nada é apagado: aulas e modelos são arquivados. Mudanças no banco entram como migração nova em `server/db.js` (`PRAGMA user_version`).
- Rode `npm test` depois de mudar o código.
