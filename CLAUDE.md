# TalkBox · instruções para quem trabalha neste repositório

## Conteúdo pedagógico

- **Antes de planejar ou escrever qualquer aula, leia `docs/como-planejar-aulas.md`.** Resumo: tela limpa (quem explica é o professor; instrução de uma frase ou nenhuma), **emojis proibidos** em tudo, fotos reais, fatos verificados.
- **Explicações de tempos verbais** (modelos, aulas e pacotes em `content/`) seguem SEMPRE `docs/metodologia-tempos-verbais.md`. Leia esse arquivo antes de criar ou editar qualquer explicação de tempo verbal.
- Regra que vale para tudo: **tabelas usam um verbo só.** Nunca dois verbos lado a lado na mesma tabela, porque o aluno pode ler "I worked went".
- **Etiquetas de conteúdo** usam os nomes oficiais de `web/js/catalog.js`. Sinônimos são convertidos automaticamente.
- **Destaques no material** (pacotes em `content/` e modelos) são sempre `#RRGGBB`, com as cores da barra: `#FFDB8F`, `#CBE4D8`, `#FFC9A3`. O destaque `rgb(...)` é o marca-texto feito na aula, e a cópia da aula tira ele (`web/js/marks.js`).
- **Etiquetas livres** (`tags.keywords`, imagens e modelos): em inglês, minúsculas, do geral para o específico, uma ideia por etiqueta (`means of transport, car, beetle, blue, street`). O tema maior vira pacote de imagens (`"imagePacks"` num pacote de conteúdo).
- **Formato de bloco novo** precisa do guia e de dois exemplos em `web/js/blocks/examples.js` (o teste confere).

## Modo atual: local + GitHub para outro professor (desde 06/11/2026)

- O Miguel pode pedir aulas remotamente: aí o pacote é testado, commitado e enviado (push) para o GitHub, e o outro professor faz `git pull` e reinicia o app. **Só faça push quando o Miguel pedir.**
- O banco (`data/talkbox.db`) **nunca** vai para o GitHub: o repositório é público e o banco tem dados dos alunos. O professor recebe o banco direto do Miguel.
- Um professor só (o Miguel). Login, servidor on-line e vários professores ficam para depois.
- Tudo o que acontece no app (editar aula, finalizar, reabrir, planejar a próxima, mapa, modelos) grava direto no banco local `data/talkbox.db`.

## Identidade visual (igual ao site da escola)

- Cores: verde `#02453A` e laranja `#FF6600` (tirados da logo), com o menta `#E4EFEA` de apoio. Tudo vem das variáveis do começo de `web/css/app.css`.
- Fontes: **Nunito Sans** em títulos e interface (títulos em 900, com espaçamento apertado `-0.045em`) e **Atkinson Hyperlegible** no texto corrido (sem serifa: o Miguel não quer fonte serifada).
- **A marca TalkBox é sempre a mesma**: a logo (`web/img/talkbox-logo.png`) + "TalkBox" em Nunito Sans 900, verde, `letter-spacing: -0.045em`. Use sempre `brandMark()` de `web/js/dom.js`; nunca escreva "TalkBox" estilizado de outro jeito.

## Código

- Só Node (22.13 ou mais novo), sem dependências. O banco é o SQLite embutido no Node, em `data/` (fora do git).
- Nada é apagado: aulas, modelos e pacotes são arquivados. Mudanças no banco entram como migração nova em `server/db.js` (`PRAGMA user_version`).
- **Aula aponta para a biblioteca (v0.8):** bloco de modelo na aula = `{ id, ref }`. Em pacotes de `content/`, use `{ "model": "chave" }` (vira referência) e o campo `"plan"` da aula para o objetivo. Baralhos: `[try: palavra]` no fim da pergunta.
- **O modelo só muda na aba Modelos (v0.9, reforçado na v1.0):** o que é escrito ou destacado num bloco da biblioteca durante a aula fica em `state.blocks[id].live`, sai no PDF e é descartado logo depois da exportação. Nunca chame `updateModel` a partir da aula; "Salvar como modelo" na aula cria sempre um modelo novo (`onlyNew`). Não existe mais "Só nesta aula".
- **Emojis:** `server/emoji.js` tira emojis ao importar pacotes (migração 7 limpou o banco). Setas e ✓ ✗ ficam.
- **PDF:** confira os dois modos (preenchido e em branco) de todo formato novo; em branco não sobra resposta nem caixa colorida.
- **Tela da aula (v1.1):** a folha e a barra de cima têm `48em` do tamanho da letra da aula (`--lesson-size` no `.lesson-wrap`). Dentro da folha, botões, abas e opções usam `em`/`clamp()` para crescer com a letra; grupos de botões são `.btns` (sempre com espaço). As regras ficam no bloco "v1.1" do fim de `web/css/app.css`, só em `@media screen`. Colunas de tabela: `columnTemplate` (`web/js/blocks/kit.js`), com a medida em `--cell` (px, registrado com `@property`) para o cabeçalho e as linhas alinharem. O plano da aula abre e fecha (`talkbox.planOpen` no navegador). **Embaralhar** é sempre do app: `seededShuffle` (`blocks/kit.js`, Fisher-Yates com semente). Em pacotes, escreva pares, frases e grupos na ordem certa; nunca embaralhe à mão.
- **Curso (v0.9):** aulas do curso = `lessons.course_number` (sem aluno). Pacote com `"course": { "number": n }`. O currículo está em `docs/curriculo-100-aulas.md` e `web/js/course-data.js`.
- Nada é criado só por abrir uma tela: modelo novo só nasce no "Salvar modelo", imagem só no "Fazer upload".
- **Nivelamento (v1.2):** `#/nivelamento`. Conteúdo e conta do nível em `web/js/placement-data.js` (testado em `test/placement.test.js`); a tela em `web/js/placement.js`. Conteúdos da gramática usam os nomes do mapa (`catalog.js`).
- Rode `npm test` depois de mudar o código.
