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

## Para outro professor usar no Windows (sem programar)

1. Instale o **Node.js** (https://nodejs.org, botão verde LTS) e o **Git** (https://git-scm.com/download/win), clicando em "Next" em tudo.
2. Abra o **Prompt de Comando** e cole: `git clone https://github.com/zschornack/talkbox_platform "%USERPROFILE%\Desktop\TalkBox"`
3. Baixe o arquivo do banco (`talkbox-....db`) que o Miguel mandou e deixe na pasta Downloads ou dentro da pasta TalkBox.
4. Na pasta **TalkBox** da Área de Trabalho, clique duas vezes em **ABRIR TALKBOX**. O navegador abre sozinho. Não feche a janela preta durante a aula.
5. Aula nova chegou? Feche a janela preta, clique em **ATUALIZAR AULAS** e depois em **ABRIR TALKBOX**.

## Novidades da versão 1.2

**Nivelamento.** Na Início, embaixo dos modelos, o botão **Começar nivelamento** abre um teste de uns 15 minutos para aluno novo, em 4 etapas: Básico (A1 · A2), Intermediário (B1), Intermediário avançado (B2) e Avançado (C1 · C2). Cada etapa tem:
- **Conversa:** 3 perguntas.
- **Leitura:** um parágrafo e 2 perguntas de escolher.
- **Escuta:** 2 frases para você ler em voz alta (ficam borradas na tela; **Mostrar frase** revela). O aluno diz o que ouviu.
- **Gramática:** 6 frases para escolher a opção certa.

Quando ficar difícil, **Parar aqui e ver o resultado**. Leitura e gramática o app corrige sozinho; fala e escuta você anota no papel e dá a nota no fim (0 a 3 por etapa). O resultado mostra o nível sugerido (dá para trocar), os pontos de cada etapa e o mapa da ficha já marcado (o que acertou numa etapa em que passou fica "Já está bom", o que errou fica "Praticando"; clique para mudar). Embaixo, **Cadastrar aluno** cria o aluno com o nível, o objetivo, o mapa e o resumo do teste nas observações. O andamento fica guardado no navegador até cadastrar ou **Recomeçar**.

## Novidades da versão 1.1

**Aula mais larga.** A folha da aula acompanha o tamanho da letra: com letra 28 cabem umas 80 letras por linha (antes eram umas 45, porque a folha ficava presa em 860 px). Com **A+** a folha alarga junto, até o limite da janela. A barra de cima acompanha a folha.

**Botões com espaço.** Nenhum grupo de botões fica mais grudado (Conferir · Revelar · Limpar, Próxima · Aleatória, Começar · Zerar · Outro tema, as abas do baralho). Os botões, as abas e as opções crescem junto com a letra, e os botões de cada bloco ficam sempre à direita, na mesma altura do enunciado.

**Tela mais limpa.**
- O **plano da aula** fica fechado numa linha (**Plano da aula · só você vê**). Um clique abre; o app lembra se você deixou aberto.
- "Pendente da aula anterior" virou um traço laranja na margem do bloco; o nome aparece com o mouse em cima. O selo "Mudado nesta aula" também só aparece com o mouse em cima.
- O enunciado fica um pouco menor e mais claro que o exercício, e o placar ("Acertou 3 de 5") virou uma etiqueta discreta.
- Mais respiro entre os blocos, com uma linha fina separando um do outro.

**Tabelas.** As colunas seguem o conteúdo: palavra curta fica numa coluna estreita, frase fica numa coluna larga, e nenhuma palavra quebra no meio. Na tabela de tempo verbal, pessoa, auxiliar e verbo ficam juntos. Vale na tela e no PDF.

**Imagens** grandes cabem inteiras na tela, sem rolar.

**Ligar colunas.** As duas colunas aparecem embaralhadas pelo próprio app (de verdade, sem padrão), em qualquer aula ou modelo: o material pode vir na ordem certa. Cada par que você faz, certo ou errado, desce para baixo, lado a lado, ligado por uma linha; o que sobra em cima vai se juntando. Clique num par para desfazer. **Limpar** desfaz tudo e embaralha de novo. No PDF, as colunas saem inteiras, com a letra escolhida ao lado do número (em branco, uma linha). O embaralhamento novo também vale para "ordenar frases" e "separar em grupos".

**Atenção:** desenhos de caneta de aulas antigas podem aparecer fora do lugar, porque a folha mudou de largura.

## Novidades da versão 1.0

**O que você escreve na aula some depois do PDF.** Escreva, apague e destaque à vontade durante a aula. Ao **Exportar PDF**, o PDF sai com tudo; quando a janela de impressão fecha, o app pergunta **"PDF salvo?"**: em **Sim, descartar**, os blocos voltam ao original (em **Não salvei**, nada sai).
- **Nenhum caminho muda um modelo a partir da aula.** Saiu o "Só nesta aula". "Salvar como modelo" dentro da aula cria sempre um modelo novo. Modelo só muda na aba Modelos.
- O resumo do **Finalizar aula** tem só **Exportar PDF** e **Fechar**.

**PDF consertado.** No modo **em branco** não sobra nenhuma resposta: as respostas reveladas viram linhas para escrever (antes sobrava a caixa verde), e saem também as palavras marcadas no "encontrar o erro", os itens já colocados nos grupos, as frases montadas, os nomes revelados na galeria e as notas da escala. No modo **preenchido**, a opção escolhida aparece marcada. Os dois modos ficaram sem caixas coloridas, sem os placares ("Acertou 2 de 5"), sem o fundo verde no fim da última página, e com o cartão do role-play e os grupos sem quebrar de página.

**Tela da aula.** A barra de cima agora tem fundo: o texto da aula não passa mais por baixo dos botões ao rolar.

**Sem emojis.** Emojis são proibidos no material. A migração 7 tirou todos os emojis dos modelos, das aulas ainda não dadas, das aulas do curso e das pendências (a versão anterior de cada modelo fica no histórico, e o banco antes da mudança fica em `data/backups/talkbox-antes-v1.0.db`). Pacotes novos também chegam sem emojis. Setas e ✓ ✗ continuam.

**Como planejar aulas:** `docs/como-planejar-aulas.md` (tela limpa, quem explica é o professor; sem emojis; fotos reais; fatos verificados).

## Novidades da versão 0.9

**O que você escreve na aula fica só na aula.** Um bloco da biblioteca só muda de verdade na aba Modelos. O que você escreve ou destaca nele durante a aula fica guardado só naquela aula (o bloco ganha o selo "Mudado nesta aula") e nunca vai para o modelo nem para as outras aulas.
- No **Finalizar aula**, o resumo oferece **"Exportar PDF e voltar ao original"**: o PDF sai com tudo o que foi escrito e, depois que a janela de impressão fecha, os blocos voltam ao original. Também dá para **"Só voltar ao original, sem PDF"**.
- Se você fechar sem exportar, a aula finalizada mostra uma faixa com os mesmos dois botões.
- Um bloco só: menu do bloco → **Voltar ao original**. A aula inteira, a qualquer hora: **Mais → Voltar tudo ao original**.
- As respostas dos exercícios, a caneta e as anotações ficam.

**Curso TalkBox.** Novo item **Curso** no menu e o roteiro no Início: os 10 níveis (A1.1 a C2) com as 100 aulas do currículo (`docs/curriculo-100-aulas.md`). Cada aula mostra o assunto, o que revisar, o vocabulário e o que o aluno consegue no fim. As aulas prontas abrem direto e têm **"Dar esta aula para um aluno…"** (a cópia vai sem anotações). As 10 primeiras (nível 1) já estão prontas, com ilustrações originais. Pacotes de conteúdo podem criar aulas do curso com `"course": { "number": 1 }` no lugar de `"student"` (migração 6: `lessons.course_number`).

## Novidades da versão 0.8

**A aula aponta para a biblioteca.** Um bloco que veio de Modelos não é mais copiado para dentro da aula: a aula guarda só a referência (o id do modelo). Por isso:
- **mudou o modelo, mudou em todas as aulas** que usam ele, inclusive as antigas;
- **mudar o texto de um bloco da biblioteca dentro da aula muda o modelo** (passe o mouse no bloco: ele avisa). Para mudar só naquela aula, use **Só nesta aula** no canto do bloco;
- **o marca-texto feito na aula fica só na aula** (junto com as respostas), nunca vai para o modelo nem para uma cópia;
- **Da biblioteca ↗** abre o modelo numa aba nova;
- as pendências também guardam só a referência.

Na primeira vez que você rodar a 0.8, as aulas que já existem são convertidas sozinhas: cada bloco igual ao modelo de onde veio vira referência; os que você tinha mudado na aula ficam como estão, com **Voltar ao original** para voltar a apontar para o modelo. Antes de converter, o banco é copiado para `data/backups/talkbox-antes-v0.8.db`. O banco das aulas ficou cerca de 5 vezes menor.

**Plano da aula**: no topo de cada aula, um campo para escrever sobre o que é a aula e os objetivos. Só você vê; não sai no PDF. Pacotes podem trazer `"plan"` na aula.

**Baralho com a palavra certa em cada carta**: termine a pergunta com `[try: palavra]` (ex.: `Who is your role model? [try: a role model]`) e a carta mostra "Try to use: a role model". Sem isso, vale a lista geral do baralho, como antes.

## Novidades da versão 0.7

**Copiar uma aula vai limpa.** Em **⋯ Mais → Copiar esta aula…** (ou no histórico da ficha), escolha o aluno e o tema. A cópia vai **sem**:
- as respostas dos exercícios e os desenhos da caneta;
- o que foi escrito nas anotações (o bloco vai vazio);
- a anotação para a próxima aula e as pendências;
- o **marca-texto feito na aula** (os destaques que você faz com a barra de formatação). As cores que já vêm no material ficam.

Com **Voltar os blocos da biblioteca ao original** marcado (vem marcado), os blocos que vieram de um modelo voltam a ficar iguais ao modelo; a janela mostra quais mudaram. Desmarque se você mudou um bloco de propósito e quer levar a mudança. Ao terminar, a cópia abre sozinha.

Também na aula:
- **⋯ Mais → Limpar o marca-texto da aula**: tira os destaques feitos na aula, com Desfazer.
- **Voltar ao original**, no canto de um bloco que veio da biblioteca: o bloco volta a ficar como o modelo, com Desfazer.

**Imagens** (novo item no menu):
- **Enviar imagens**: arraste várias de uma vez (ou cole com Ctrl+V). Cada uma tem **título** e **etiquetas separadas por vírgula**; dá para escolher o pacote e as etiquetas que valem para todas. **Nada entra no acervo antes de clicar em Fazer upload.**
- **Pacotes**: junte as imagens de um tema (Animals, Food, Jobs…). Uma imagem pode estar em vários pacotes; tirar de um pacote não apaga a imagem. As etiquetas do pacote entram sozinhas nas imagens enviadas para ele.
- Busca por título, etiqueta, conteúdo e pacote. Filtros **Sem pacote** e **Sem etiquetas** mostram o que falta organizar. Selecione várias imagens para pôr num pacote ou acrescentar etiquetas de uma vez.
- Imagens que estão na internet ganham o aviso "na internet" e o botão **Guardar no computador** (uma ou todas): elas passam a funcionar sem internet, e as aulas que já usavam a imagem são atualizadas.
- **Na aula**: + Inserir bloco → **Imagens do acervo…** → uma imagem, várias (uma em cada bloco) ou o **pacote inteiro como galeria**. Um bloco de imagem vazio também tem **Escolher do acervo de imagens**.
- Bloco novo **Galeria de imagens**: várias imagens em grade (2, 3 ou 4 colunas). Os nomes podem começar escondidos: o aluno fala, você clica em **Revelar** (um por um ou todos). Clique numa imagem para ver grande, com setas, Espaço para revelar e Esc para fechar. No PDF, os nomes escondidos viram uma linha para escrever.

Como etiquetar: do geral para o específico, em inglês, uma ideia por etiqueta. Fusca azul na rua → `means of transport, car, beetle, blue, old, street`. O tema maior (Animals, Transport) vira **pacote**.

**Novo modelo = galeria de formatos.** **Modelos → Novo modelo** mostra todos os formatos, em três grupos (Explicar e mostrar, Exercícios com correção, Fala e conversa). Cada um tem para que serve, como funciona na aula, como editar e **dois exemplos que funcionam na tela**. Comece de um exemplo ou em branco.
- O modelo novo **só é salvo quando você clica em Salvar modelo** (e precisa de nome). Sair sem salvar pergunta antes, se você mudou alguma coisa. Entrar e sair não cria nada.
- Antes de salvar não aparecem "Uso" nem "Histórico de versões" (no lugar, o guia do formato). O histórico só aparece quando existe alguma versão.
- Modelos ganharam **etiquetas livres** (como as das imagens), que entram na busca.
- Na aula, **⋯ Mais → Ver exemplos dos formatos** abre a mesma galeria e insere o exemplo escolhido.

**Menus**:
- **+ Inserir bloco** agora é separado em grupos, com "Da biblioteca de modelos…", "Imagens do acervo…" e "Ver exemplos de cada formato…".
- Botão **⋯ Mais** na barra da aula: copiar a aula, limpar o marca-texto, ver os formatos.
- No Início, os atalhos **Novo modelo** (com os exemplos) e **Enviar imagens**.

**Correções no banco e no servidor**:
- **Arquivar uma aula finalizada desfaz o Finalizar** (mapa e pendências voltam ao que eram) e libera o número dela para a próxima aula.
- **Juntar dois alunos** continua a contagem das aulas a partir das aulas anteriores ao TalkBox.
- **Nome de aluno repetido é recusado** (sem diferenciar acento e maiúscula). Se o outro estiver inativo, o aviso sugere reativar.
- Uma pendência descartada não conta mais como "resolvida" ao finalizar.
- A data da "última aula" na lista de alunos usa a última aula **dada** (não uma aula futura em preparo).
- Aula sem tema vira "Sem título" (não fica em branco).
- Envio de imagem: só WebP de verdade; arquivo grande demais dá um aviso claro; endereço quebrado não derruba a rota.
- Restaurar uma versão de modelo confere se o modelo não foi arquivado e recalcula o "falta conteúdo".
- Os modelos vazios "Sem título" (criados só por entrar e sair do menu antigo) foram arquivados.
- "Baixar todos os dados" inclui os pacotes de imagens.

**Aulas dadas antes do TalkBox**: cada aluno ativo ganhou o nível e o mapa tirados do histórico do Drive (pacote `historico-drive.json`), e a numeração das aulas continua de onde parou (ex.: 24 aulas no Drive → a primeira no TalkBox é a 25).

**Pacotes de conteúdo** ganharam:
- `"profiles"`: atualiza nível, mapa (só sobe, nunca desce) e as aulas anteriores (`"priorLessons"`) de alunos que já existem.
- `"merge"`: junta dois cadastros do mesmo aluno (aulas, mapa e histórico vão para um só).
- `"imagePacks"`: cria (ou completa) pacotes de imagens com título e etiquetas.
- `"clean"`: limpa uma aula que já existe, do mesmo jeito que a cópia (blocos da biblioteca de volta ao original, sem o marca-texto da aula e sem o que foi escrito nas anotações). `"keep"` lista os blocos que ficam como estão. Com `"onlyIfUntouched": true`, só limpa se a aula não foi mexida desde que foi criada.

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
- Menu lateral com Início, Alunos, Modelos e Imagens.
- Atalhos para criar uma nova aula, um novo aluno, um novo modelo ou enviar imagens.
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
4. Novos formatos: áudio e vídeo.
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
  js/main.js          rotas: #/  #/alunos  #/alunos/:id  #/modelos  #/modelos/novo  #/modelos/:id
                      #/imagens  #/imagens/enviar  #/imagens/pacote/:id  #/aula/:id
  js/home.js          Início
  js/students.js      lista de alunos       js/student.js       ficha
  js/models.js        biblioteca de modelos js/model-editor.js  editar modelo (o novo só salva no "Salvar modelo")
  js/gallery.js       galeria de formatos (Novo modelo e "Ver exemplos" na aula)
  js/images.js        acervo de imagens, pacotes, enviar imagens e o painel "Imagens do acervo"
  js/marks.js         marca-texto da aula x cores do material (usado também pelo servidor)
  js/model-picker.js  painel "Inserir modelos" na aula
  js/editor.js        a aula: salvar automático, caneta, menus
  js/handover.js      Finalizar aula
  js/block-view.js    mostra/edita um bloco (usado na aula e nos modelos)
  js/blocks/          um arquivo por tipo de bloco (registrados em index.js);
                      examples.js tem o guia e os dois exemplos de cada formato
  js/catalog.js       listas fixas: níveis, habilidades, conteúdos oficiais com sinônimos (usado também pelo servidor)
  css/app.css         todo o visual: paleta, tipografia e PDF (@media print)
test/                 testes (npm test)
```

Na aula, o **conteúdo** (`doc`: os blocos) fica separado do que **acontece na aula** (`state`: respostas das lacunas, caneta, tamanho da fonte). Isso segue o item 9.10 dos requisitos e prepara a versão 2, em que cada aluno terá as próprias respostas.

Um **modelo** guarda um bloco pronto. Na aula, o bloco que veio da biblioteca fica guardado só como `{ id, ref }` (v0.8); `getLesson` monta o bloco inteiro a partir do modelo, com `source: { modelId, title }`. Editar esse bloco na aula atualiza o modelo; o marca-texto da aula fica em `state.blocks[id].live`. Blocos feitos na aula (e os marcados "Só nesta aula", `local: true`) ficam inteiros no `doc`. A cada salvamento da aula, a tabela `block_uses` registra a posição de cada bloco e de qual modelo veio: é dela que saem o "usado em", o "visto em" e os conteúdos da aula. Um bloco que é retomada de uma pendência tem `pending: <id>`.

O **mapa de conteúdos** vem da tabela `assessments`: cada avaliação (do Finalizar aula ou de um clique na ficha) é uma linha, e o status atual é a mais recente. A versão do banco fica em `PRAGMA user_version`; cada migração nova sobe esse número.

Para criar um tipo de bloco novo, crie um arquivo em `web/js/blocks/` com `name`, `hint`, `create()` e `render(ctx)`, registre-o em `web/js/blocks/index.js` adicione um resumo dele em `web/js/blocks/summary.js` e o guia com dois exemplos em `web/js/blocks/examples.js` (o teste confere). Ele passa a aparecer na aula e nos Modelos automaticamente.

**Marca-texto da aula x cores do material.** O destaque feito na aula (barra de formatação) é gravado pelo navegador como `background-color: rgb(…)`; "remover destaque" grava `transparent`. As cores do material (pacotes e modelos) ficam em `#RRGGBB`. Por isso a cópia sabe o que tirar: `rgb(…)` e `transparent` saem, `#RRGGBB` fica. Ao salvar um modelo, o editor converte `rgb(…)` em `#RRGGBB` (`toMaterialColors` em `web/js/marks.js`), porque no modelo tudo é material.

**Imagens** são modelos do tipo `image` (com etiquetas livres em `tags.keywords`). Os pacotes ficam nas tabelas `packs` e `pack_items`; tirar uma imagem do pacote marca `removed_at`, e o banco recusa apagar pacotes e itens.

Se o Node for antigo, o `npm start` avisa e explica como atualizar.

O modo `npm run dev` reinicia o servidor sozinho quando um arquivo dele muda. Para ver mudanças no app, basta recarregar a página.
