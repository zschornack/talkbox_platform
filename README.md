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

Na primeira vez, o sistema cria a aluna de exemplo **Julia**, a aula **Natural Disasters** e uma biblioteca inicial com 10 modelos.

Para parar o servidor, aperte `Ctrl + C` no terminal.

### Onde ficam os dados

Tudo fica na pasta `data/`, dentro do projeto:

- `data/talkbox.db`: alunos, aulas e modelos.
- `data/uploads/`: as imagens, em WebP.

Para fazer backup, basta copiar essa pasta. Ela não vai para o GitHub.

## O que já funciona (versão 0.2)

**Início**
- Menu lateral com Início, Alunos e Modelos.
- Atalhos para criar uma nova aula, um novo aluno ou um novo modelo.
- Aulas recentes, alunos com a data da última aula e o resumo da biblioteca por formato.

**Alunos**
- Lista com busca e filtro de ativos e inativos.
- Cadastrar e editar nome, nível e objetivo. Uma turma é cadastrada como um aluno, ex.: "Vini & Bia".
- Inativar nunca apaga nada, e dá para reativar.
- **Ficha do aluno**:
  - Onde paramos, com a última aula e os conteúdos vistos.
  - Objetivo e observações, que salvam sozinhos.
  - Mapa de conteúdos: clique num conteúdo para mudar o status (nunca viu, praticando, já está bom).
  - Histórico de aulas: abrir, exportar o PDF, duplicar ou excluir.
  - Botão de nova aula.

**Modelos** (a biblioteca de atividades)
- Cada modelo é uma atividade pronta, com etiquetas de formato, conteúdo, nível e habilidade.
- Filtros combinados: dentro de um mesmo filtro vale qualquer opção marcada; entre filtros diferentes, todos precisam bater. Também tem busca e ordenação.
- O modelo é criado e editado no mesmo editor da aula, e dá para testar o exercício ali mesmo.
- Mostra em quantas aulas o modelo foi usado.
- Guarda o histórico de versões, com botão para restaurar.
- Dá para duplicar e excluir.
- **Na aula**:
  - Use o **+** e escolha "Da biblioteca de modelos…", ou aperte **Ctrl + K**.
  - Dá para marcar vários modelos e inserir todos de uma vez.
  - Os modelos que o aluno já viu aparecem com "visto em DD/MM".
- O modelo entra na aula como **cópia**: editar o modelo depois não muda as aulas já montadas.
- Qualquer bloco da aula pode virar modelo com **Salvar como modelo**. Se o bloco veio de um modelo, dá para atualizar esse modelo ou criar um novo.

**Aulas prontas (pasta `content/`)**
- Cada arquivo `.json` dessa pasta traz um aluno, uma aula e as atividades dela.
- Ao iniciar, o servidor importa cada arquivo novo **uma vez**:
  - cria o aluno, ou usa o que já existe com o mesmo nome;
  - salva as atividades em Modelos;
  - monta a aula a partir delas.
- É assim que aulas preparadas fora do seu computador chegam até você: `git pull` e `npm start`.
- Disponível agora: **Victor · Plague Scare in Siberia** (IELTS).

**Migração**: aulas criadas na versão 0.1 são ligadas automaticamente a alunos cadastrados com o mesmo nome.

**A aula (editor)**
- Existe um modo só: a tela é sempre editável e sempre limpa.
- Todo texto é editável com um clique: títulos, explicações, células de tabela, frases das lacunas, cartas e legendas.
- Ao selecionar um texto, aparece uma barra flutuante com negrito, sublinhado, highlight em 3 cores e remover destaque.
- Blocos disponíveis:
  - Texto
  - Explicação
  - Tabela
  - Fill in the blanks
  - Múltipla escolha (também serve para True / False / Not Given do IELTS)
  - Ligar colunas
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
- **Múltipla escolha**:
  - Opções clicáveis, com Conferir, Revelar e Limpar.
  - Opção de correção na hora, para "speed round".
  - As questões são editadas em "Editar questões", uma por linha: `She [has* | had] left.` (o * marca a certa).
- **Ligar colunas**:
  - Clique num item e depois no par dele. A coluna da direita aparece embaralhada.
  - Os pares são editados em "Editar pares", um por linha: `contagious = easily passed on`.
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
| `Ctrl + K` | Inserir da biblioteca de modelos (Enter insere o primeiro) |
| `Ctrl + P` | Exportar PDF |
| `Ctrl + Shift + E` | Liga e desliga a caneta |
| `Esc` | Desliga a caneta e fecha menus |
| `/` num texto vazio | Inserir bloco |
| `Tab` | Próxima lacuna ou próxima célula |

## Próximos patches

1. **Finalizar aula (handover)**: até onde chegamos, como ficaram os conteúdos e recado para o próximo professor. Isso alimenta "Onde paramos" e o mapa de conteúdos na ficha.
2. **Modelos de aula**: salvar uma aula inteira como modelo e começar aulas novas a partir dele.
3. Tabela e imagem como elementos livres, que podem entrar soltos na aula ou dentro de uma explicação.
4. Novos formatos: ordenar frases, áudio, imagens lado a lado e cards de foto para revelar.
5. Vários professores: login, servidor compartilhado e "quem mudou" no histórico de versões.

## Para quem for programar

```
server/               servidor (Node puro + SQLite embutido)
  start.js            confere a versão do Node e sobe o servidor
  index.js            arquivos do app e imagens
  api.js              rotas da API: alunos, aulas, modelos, imagens
  db.js               banco de dados e migrações
  seed.js             dados de exemplo (Julia + biblioteca inicial)
  content.js          importa as aulas prontas da pasta content/
content/              aulas prontas (uma por arquivo .json)
web/                  app do professor (JavaScript puro, sem build)
  js/main.js          rotas: #/  #/alunos  #/alunos/:id  #/modelos  #/modelos/:id  #/aula/:id
  js/home.js          Início
  js/students.js      lista de alunos       js/student.js       ficha
  js/models.js        biblioteca de modelos js/model-editor.js  editar modelo
  js/model-picker.js  painel "Inserir modelos" na aula
  js/editor.js        a aula: salvar automático, caneta, menus
  js/block-view.js    mostra/edita um bloco (usado na aula e nos modelos)
  js/blocks/          um arquivo por tipo de bloco (registrados em index.js)
  js/catalog.js       listas fixas: níveis, habilidades, mapa de conteúdos
  css/app.css         todo o visual: paleta, tipografia e PDF (@media print)
test/                 testes (npm test)
```

Na aula, o **conteúdo** (`doc`: os blocos) fica separado do que **acontece na aula** (`state`: respostas das lacunas, caneta, tamanho da fonte). Isso segue o item 9.10 dos requisitos e prepara a versão 2, em que cada aluno terá as próprias respostas.

Um **modelo** guarda um bloco pronto. Quando entra numa aula, o bloco é copiado com ids novos e ganha `source: { modelId, title }`. É assim que o sistema conta em quantas aulas o modelo foi usado e mostra o "visto em".

Para criar um tipo de bloco novo, crie um arquivo em `web/js/blocks/` com `name`, `hint`, `create()` e `render(ctx)`, registre-o em `web/js/blocks/index.js` e adicione um resumo dele em `web/js/blocks/summary.js`. Ele passa a aparecer na aula e nos Modelos automaticamente.

Se o Node for antigo, o `npm start` avisa e explica como atualizar.

O modo `npm run dev` reinicia o servidor sozinho quando um arquivo dele muda. Para ver mudanças no app, basta recarregar a página.
