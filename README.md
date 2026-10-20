# TalkBox

Plataforma de aulas da escola, na visão do professor. A aula aparece para o aluno pela tela compartilhada (Meet, Zoom), e ele recebe o PDF da aula depois.

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

- `data/talkbox.db`: alunos, aulas, modelos, avaliações e pendências.
- `data/uploads/`: as imagens, em WebP. A mesma imagem enviada duas vezes é guardada uma vez só.
- `data/backups/`: **cópia de segurança automática**, uma por dia (guarda as últimas 30), com as imagens.

No menu lateral também tem **Fazer cópia de segurança** e **Baixar todos os dados** (um arquivo só, com tudo).
A pasta `data/` fica só no seu computador.

**Nada é apagado.** "Excluir" uma aula ou um modelo agora **arquiva**: some das listas, mas fica guardado, e o histórico continua certo. O próprio banco recusa apagar alunos, aulas, modelos, versões e avaliações.

**Atualizar de uma versão anterior**: é só `npm start`. O banco é atualizado sozinho na primeira vez, sem perder nada.

## Modo atual: só local

Por enquanto o TalkBox roda **só neste computador**, com um professor só. Nada vai para o GitHub.
Tudo o que você faz no app grava na hora no banco `data/talkbox.db`: editar a aula, finalizar, reabrir, preparar a próxima, o mapa, as notas da ficha e os modelos.

## Novidades da versão 0.6

**10 tipos novos de bloco** (lista oficial nos requisitos, seção 7.1.1). Todos aparecem no **+ Inserir bloco** e nos Modelos:

- **Tabela de tempo verbal**: escolha o tempo e o verbo e a tabela se monta sozinha, com todas as pessoas e as cores da metodologia.
- **Linha do tempo**: passado → NOW, com pontos ("35 | 2019") e intervalos ("10-90 | MY LIFE").
- **Lista com revelar**: cada linha revela só a própria resposta.
- **Ordenar frases**: fichas embaralhadas; " / " mantém palavras juntas numa ficha.
- **Transformar frases**: frase + instrução, resposta digitada com alternativas.
- **Encontrar o erro**: clique na palavra errada (no painel: `She [have=has] seen a fox.`).
- **Separar em grupos**: de 2 a 4 colunas.
- **Escala de opinião**: de 1 a 5, uma afirmação por vez.
- **Cartões de role-play**: cada cartão começa escondido.
- **Cronômetro de fala**: contagem regressiva com tema sorteado.

As respostas e marcas do aluno ficam no estado da aula, como nos outros exercícios. Flashcards, imagem com tarefa, áudio e vídeo ficam para depois.

**Pacotes podem acrescentar a uma aula que já existe** (`"append"`), entrando antes do bloco de anotações.

## Novidades da versão 0.5

**Visual igual ao site da escola**: verde e laranja da logo, Nunito Sans nos títulos e na interface, Atkinson Hyperlegible no texto corrido, botões em pílula. A marca (logo + "TalkBox") aparece sempre do mesmo jeito: no menu, na barra da aula, no editor de modelos, no cabeçalho do PDF e no ícone da aba.

**Reabrir aula**: numa aula finalizada, o botão **Reabrir** fica ao lado de "Finalizada". Ele desfaz o Finalizar aula:
- o mapa volta a ficar como estava antes desta aula;
- os pendentes que ela criou saem da lista, e os que ela resolveu voltam a ficar pendentes;
- "Onde paramos" volta para a aula anterior.

Depois é só finalizar de novo. Nada é apagado: a finalização desfeita fica registrada no banco.

**Anotação para a próxima aula**: o antigo "recado para o próximo professor" agora é a sua anotação. Ela aparece em "Onde paramos" e no topo da aula seguinte (nunca no PDF).

## Novidades da versão 0.4

**Finalizar aula (handover)**: botão na barra de cima da aula. Uma tela só:
1. **Até onde chegamos?** Clique no último bloco feito. O que vem depois fica **pendente** (anotações e textos vazios não contam).
2. **Como ficaram os conteúdos?** Praticando ou Já está bom, para cada conteúdo da aula. Dá para acrescentar outro.
3. **Anotação para a próxima aula.** Vazio = está tudo certo.

Depois aparece o resumo, com o botão de exportar o PDF e o link para a ficha.

**Ficha do aluno**
- **Onde paramos**: a última aula finalizada, o que foi visto, o que ficou pendente (dá para descartar uma pendência) e o recado.
- **Preparar próxima aula**: a aula nova já vem com os pendentes, marcados como "Pendente da aula anterior", e com o recado no topo (o recado não sai no PDF).
- **Mapa de conteúdos**: o Finalizar aula atualiza sozinho. Clicar num conteúdo continua corrigindo à mão. Passe o mouse para ver desde quando está assim, e o botão **Evolução** mostra todas as mudanças, com a data e a aula.
- **Histórico**: data, número da aula e "em preparação" para as que ainda não foram dadas. "Conteúdo visto" mostra só o que foi feito até o corte.
- A data da aula fica no topo da aula e pode ser mudada (para aulas preparadas antes).

**Sinônimos de conteúdo**: a lista oficial de conteúdos (em `web/js/catalog.js`) guarda outros nomes para cada conteúdo. "simple past" e "passado simples" viram **Past Simple** nas etiquetas, na busca da biblioteca e no Ctrl+K. Assim o mapa nunca tem duas linhas para a mesma coisa.

**"Visto em"**: numa aula finalizada, só conta o que foi feito até o último bloco. Aulas ainda não finalizadas contam por inteiro.

**Fila "a revisar"** (preparando a importação do Google Drive): pacotes com `"review": true` entram como "a revisar". Na biblioteca aparece o quadro **A revisar**, com o filtro, os lotes e **Desfazer lote**. No modelo, o botão **Aprovar**. Itens sem conteúdo ganham o que for citado no título ou no texto, pelos sinônimos.

## O que já funciona (versão 0.2 e 0.3)

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
- Cada arquivo `.json` dessa pasta traz um aluno, uma aula e as atividades dela. Opcionais: `lesson.date`, `lesson.number`, `lesson.finished` (para registrar uma aula já dada) e `review: true` (itens entram "a revisar"). O formato completo está no começo de `server/content.js`.
- Ao iniciar, o servidor importa cada arquivo novo **uma vez**:
  - cria o aluno, ou usa o que já existe com o mesmo nome;
  - salva as atividades em Modelos;
  - monta a aula a partir delas.
- Para importar um pacote novo, coloque o `.json` na pasta `content/` e rode `npm start` de novo.
- **Turma que se separa**: um pacote com `"rename": [{ "from": "Ana & Bia", "to": "Ana" }]` muda o nome e mantém aulas, mapa e histórico. Um aluno com `"copyFrom": "Ana"` em `"students"` nasce com o nível, o objetivo e o mapa do outro.
- **Imagens no pacote**: um bloco de imagem pode trazer `"file": "images/…/x.webp"` (WebP, dentro de `content/`). Na importação, a imagem vai para `data/uploads/` com o nome da impressão digital, como no envio pelo app, e nunca é guardada duas vezes.
- Disponíveis agora: **Victor · Plague Scare in Siberia** (IELTS), **Luana · aula 20**, **Thiago Caretta · Family, Birthdays and Unusual World Records** e **Bia & Vini · Natural Disasters: Stories That Shook the World** (com 9 ilustrações).

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

1. **Importação do Google Drive**, em lotes, usando a fila "a revisar".
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
  db.js               banco de dados, migrações e regras (handover, pendências, mapa, arquivar, cópia de segurança)
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
  js/handover.js      Finalizar aula
  js/block-view.js    mostra/edita um bloco (usado na aula e nos modelos)
  js/blocks/          um arquivo por tipo de bloco (registrados em index.js)
  js/catalog.js       listas fixas: níveis, habilidades, conteúdos oficiais com sinônimos (usado também pelo servidor)
  css/app.css         todo o visual: paleta, tipografia e PDF (@media print)
test/                 testes (npm test)
```

Na aula, o **conteúdo** (`doc`: os blocos) fica separado do que **acontece na aula** (`state`: respostas das lacunas, caneta, tamanho da fonte). Isso segue o item 9.10 dos requisitos e prepara a versão 2, em que cada aluno terá as próprias respostas.

Um **modelo** guarda um bloco pronto. Quando entra numa aula, o bloco é copiado com ids novos e ganha `source: { modelId, title }`. A cada salvamento da aula, a tabela `block_uses` registra a posição de cada bloco e de qual modelo veio: é dela que saem o "usado em", o "visto em" e os conteúdos da aula. Um bloco que é retomada de uma pendência tem `pending: <id>`.

O **mapa de conteúdos** vem da tabela `assessments`: cada avaliação (do Finalizar aula ou de um clique na ficha) é uma linha, e o status atual é a mais recente. A versão do banco fica em `PRAGMA user_version`; cada migração nova sobe esse número.

Para criar um tipo de bloco novo, crie um arquivo em `web/js/blocks/` com `name`, `hint`, `create()` e `render(ctx)`, registre-o em `web/js/blocks/index.js` e adicione um resumo dele em `web/js/blocks/summary.js`. Ele passa a aparecer na aula e nos Modelos automaticamente.

Se o Node for antigo, o `npm start` avisa e explica como atualizar.

O modo `npm run dev` reinicia o servidor sozinho quando um arquivo dele muda. Para ver mudanças no app, basta recarregar a página.
