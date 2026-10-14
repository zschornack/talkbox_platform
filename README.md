# TalkBox

Plataforma de aulas da escola, na visão do professor. A aula aparece para o aluno pela tela compartilhada (Meet, Zoom), e ele recebe o PDF da aula depois.

Os requisitos completos estão no projeto do Claude (*TalkBox · Requisitos do MVP*).

## Como rodar no seu computador

1. Instale o **Node.js 22 ou mais novo** em <https://nodejs.org> (versão LTS).
2. Baixe este repositório e abra um terminal dentro da pasta dele.
3. Rode:

   ```
   npm start
   ```

4. Abra **http://localhost:3000** no navegador.

Não precisa rodar `npm install`. O projeto não tem nenhuma dependência além do próprio Node, e o banco de dados (SQLite) já vem dentro do Node.

Na primeira vez, o sistema cria uma aula de exemplo: **Julia · Natural Disasters**.

Para parar o servidor, aperte `Ctrl + C` no terminal.

### Onde ficam os dados

Tudo fica na pasta `data/`, dentro do projeto:

- `data/talkbox.db`: as aulas.
- `data/uploads/`: as imagens, em WebP.

Para fazer backup, basta copiar essa pasta. Ela não vai para o GitHub.

## O que já funciona (versão 0.1)

**Aulas**
- Lista de aulas com busca.
- Criar uma aula em branco.
- Duplicar uma aula para outro aluno. A cópia vem sem as respostas.

**A aula (editor)**
- Existe um modo só: a tela é sempre editável e sempre limpa.
- Todo texto é editável com um clique: títulos, explicações, células de tabela, frases das lacunas, cartas e legendas.
- Ao selecionar um texto, aparece uma barra flutuante com negrito, sublinhado, highlight em 3 cores e remover destaque.
- Blocos disponíveis:
  - Texto
  - Explicação
  - Tabela
  - Fill in the blanks
  - Baralho de perguntas
  - Desafio sorteado
  - Imagem
  - Anotações
- Para inserir um bloco, use o **+** entre os blocos, **+ Inserir bloco** no fim, ou digite **/** num bloco de texto vazio.
- Ao passar o mouse num bloco, aparecem botões para mover, duplicar e remover. Ao remover, dá para desfazer.
- **Fill in the blanks**:
  - As lacunas crescem enquanto você digita, e o Tab pula para a próxima.
  - Botões Conferir, Revelar e Limpar, com placar.
  - Aceita respostas alternativas, definidas em "Editar respostas".
- **Baralho de perguntas**:
  - Uma carta por vez, com Próxima, Anterior e Aleatória.
  - Temas em abas e palavra-desafio opcional.
- **Desafio sorteado**:
  - Sorteia uma frase e uma instrução.
  - O modo adivinhar esconde a instrução.
- **Imagem**:
  - Arraste, cole com Ctrl+V ou escolha um arquivo.
  - A imagem é convertida para WebP automaticamente.
  - Dois layouts: largura total ou metade.
- **Caneta** para desenhar por cima da aula, com botão para apagar.
- **A− / A+** muda o tamanho da fonte da aula inteira.
- **Salva sozinho** enquanto você edita.

**Exportar PDF**
- O PDF sai em A4, com o cabeçalho do aluno e a data.
- Na hora de exportar, você escolhe:
  - lacunas preenchidas ou em branco;
  - com ou sem os desenhos da caneta.
- O baralho e o desafio viram listas no PDF.
- Nenhum bloco é cortado no meio da página.

### Atalhos

| Atalho | O que faz |
|---|---|
| `Ctrl + B` / `Ctrl + U` | Negrito / sublinhado |
| `Ctrl + P` | Exportar PDF |
| `Ctrl + Shift + E` | Liga e desliga a caneta |
| `Esc` | Desliga a caneta e fecha menus |
| `/` num texto vazio | Inserir bloco |
| `Tab` | Próxima lacuna ou próxima célula |

## Próximos patches

1. **Finalizar aula (handover)**: até onde chegamos, como ficaram os conteúdos e recado para o próximo professor.
2. **Alunos e Ficha**: cadastro, ativos e inativos, "onde paramos", mapa de conteúdos e histórico.
3. **Banco de conteúdos**: etiquetas, filtros, painel na montagem, "salvar no banco" e busca rápida com Ctrl+K.
4. **Modelos**.
5. Novos blocos: múltipla escolha, ligar colunas, ordenar frases, áudio, imagens lado a lado e cards de foto para revelar.
6. Vários professores: login e servidor compartilhado.

## Para quem for programar

```
server/            servidor (Node puro + SQLite embutido)
  index.js         rotas da API e arquivos do app
  db.js            banco de dados
  seed.js          aula de exemplo
web/               app do professor (JavaScript puro, sem build)
  js/editor.js     a aula: blocos, salvar automático, caneta, menus
  js/blocks/       um arquivo por tipo de bloco (registrados em index.js)
  css/app.css      todo o visual: paleta, tipografia e PDF (@media print)
test/              testes (npm test)
```

Na aula, o **conteúdo** (`doc`: os blocos) fica separado do que **acontece na aula** (`state`: respostas das lacunas, caneta, tamanho da fonte). Isso segue o item 9.10 dos requisitos e prepara a versão 2, em que cada aluno terá as próprias respostas.

Para criar um tipo de bloco novo, crie um arquivo em `web/js/blocks/` com `name`, `hint`, `create()` e `render(ctx)`, e registre-o em `web/js/blocks/index.js`.

Se o Node for antigo, o `npm start` avisa e explica como atualizar.

O modo `npm run dev` reinicia o servidor sozinho quando um arquivo dele muda. Para ver mudanças no app, basta recarregar a página.
