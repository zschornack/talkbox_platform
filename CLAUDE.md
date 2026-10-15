# TalkBox · instruções para quem trabalha neste repositório

## Conteúdo pedagógico

- **Explicações de tempos verbais** (modelos, aulas e pacotes em `content/`) seguem SEMPRE `docs/metodologia-tempos-verbais.md`. Leia esse arquivo antes de criar ou editar qualquer explicação de tempo verbal.
- Regra que vale para tudo: **tabelas usam um verbo só.** Nunca dois verbos lado a lado na mesma tabela, porque o aluno pode ler "I worked went".
- **Etiquetas de conteúdo** usam os nomes oficiais de `web/js/catalog.js`. Sinônimos são convertidos automaticamente.

## Código

- Só Node (22.13 ou mais novo), sem dependências. O banco é o SQLite embutido no Node, em `data/` (fora do git).
- Nada é apagado: aulas e modelos são arquivados. Mudanças no banco entram como migração nova em `server/db.js` (`PRAGMA user_version`).
- Rode `npm test` antes de enviar.
