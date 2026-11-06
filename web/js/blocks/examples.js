// Guia dos formatos: para que serve cada um, como funciona na aula e dois exemplos prontos.
// Aparece no "Novo modelo" (galeria de formatos) e no "Ver exemplos" do menu de inserir da aula.
// Os exemplos são blocos de verdade: funcionam na tela (dá para clicar, conferir, sortear) e podem virar modelo.

const G = '#CBE4D8'; // verde (cores da metodologia: sempre em #RRGGBB no material)
const O = '#FFC9A3'; // laranja
const Y = '#FFDB8F'; // amarelo
const hl = (t, c) => `<span style="background-color: ${c}"><b>${t}</b></span>`;

/** Grupos do menu, na ordem em que aparecem. */
export const FORMAT_GROUPS = [
  { name: 'Explicar e mostrar', types: ['text', 'explanation', 'table', 'tense', 'timeline', 'image', 'gallery'] },
  { name: 'Exercícios com correção', types: ['fill', 'choice', 'match', 'reveal', 'order', 'transform', 'spot', 'sort'] },
  { name: 'Fala e conversa', types: ['deck', 'challenge', 'scale', 'roleplay', 'timer'] },
];

/** Para que serve, como funciona na aula e onde edita. */
export const GUIDE = {
  text: {
    purpose: 'Um texto livre: leitura, história, notícia, instrução de uma atividade.',
    how: ['Clique em qualquer palavra para editar.', 'Selecione um trecho para negrito, sublinhado ou marca-texto.'],
    edit: 'Tudo se edita direto no texto.',
  },
  explanation: {
    purpose: 'A regra ou o conceito do dia, com os destaques coloridos da metodologia.',
    how: ['Use cores diferentes para regras diferentes e diga o que cada cor quer dizer.', 'Explicação de tempo verbal segue a metodologia da escola.'],
    edit: 'Tudo se edita direto no texto.',
  },
  table: {
    purpose: 'Comparar formas, listar palavras, mostrar uma regra em linhas e colunas.',
    how: ['Toda célula é editável; Tab passa para a próxima.', 'Uma tabela, um verbo: nunca dois verbos lado a lado.'],
    edit: 'Botões + linha, − linha, + coluna e − coluna no canto do bloco.',
  },
  tense: {
    purpose: 'A tabela de um tempo verbal, montada sozinha com todas as pessoas e as cores da metodologia.',
    how: ['Escolha o tempo e o verbo: as cinco pessoas aparecem, com He / She / It juntos.', 'Verbos irregulares comuns são reconhecidos.'],
    edit: 'Botão "Escolher tempo e verbo" no canto do bloco.',
  },
  timeline: {
    purpose: 'A linha do tempo (passado → agora) para mostrar quando a ação acontece.',
    how: ['Pontos marcam um momento ("2019"); faixas marcam um período ("MY LIFE").', 'Embaixo vai uma frase de exemplo.'],
    edit: 'Botão "Editar marcas": uma marca por linha, como 35 | 2019 ou 10-90 | MY LIFE.',
  },
  image: {
    purpose: 'Uma foto ou ilustração para descrever, comparar, contar uma história ou adivinhar.',
    how: ['Arraste, cole com Ctrl+V ou escolha do acervo de imagens.', 'Largura total ou metade (duas lado a lado).'],
    edit: 'No acervo de Imagens: título, etiquetas e pacotes (ex.: Animals).',
  },
  gallery: {
    purpose: 'Várias imagens em grade, como um pacote do acervo (Animals, Food…), para nomear, descrever ou comparar.',
    how: ['Os nomes podem começar escondidos: o aluno fala, você clica em Revelar.', 'Clique numa imagem para ver grande, uma por vez (setas ← →, Espaço revela).'],
    edit: 'Botões "+ imagens do acervo", "Colunas" e "Nomes começam escondidos"; o nome se edita embaixo da imagem.',
  },
  fill: {
    purpose: 'Lacunas para o aluno completar, com a dica entre parênteses.',
    how: ['O aluno digita; Tab pula para a próxima lacuna.', 'Conferir corrige, Revelar mostra as respostas, Limpar recomeça.'],
    edit: 'Botão "Editar respostas": respostas aceitas separadas por " / ".',
  },
  choice: {
    purpose: 'Escolher a opção certa. Serve também para True / False / Not Given.',
    how: ['Clique na opção; Conferir corrige tudo de uma vez.', 'Com "correção na hora", cada clique já mostra certo ou errado (speed round).'],
    edit: 'Botão "Editar questões": She [has* | had] left. (o * marca a certa)',
  },
  match: {
    purpose: 'Ligar duas colunas: palavra ↔ significado, pergunta ↔ resposta.',
    how: ['Clique num item da esquerda e depois no par da direita.', 'A coluna da direita aparece embaralhada.'],
    edit: 'Botão "Editar pares": um por linha, palavra = significado.',
  },
  reveal: {
    purpose: 'Lista de frases em que cada linha revela só a própria resposta (as "5 frases com Revelar").',
    how: ['O aluno fala primeiro; depois você clica em Revelar naquela linha.', 'Revelar todas mostra a lista inteira.'],
    edit: 'Botão "Editar linhas": enunciado => resposta.',
  },
  order: {
    purpose: 'Palavras embaralhadas para o aluno montar a frase na ordem certa.',
    how: ['O aluno clica nas fichas na ordem; clicar de novo devolve a ficha.', 'Conferir mostra a frase certa.'],
    edit: 'Botão "Editar frases": uma frase certa por linha; " / " junta palavras numa ficha só.',
  },
  transform: {
    purpose: 'Reescrever a frase seguindo uma instrução: negativa, pergunta, outro tempo, um conectivo.',
    how: ['O aluno escreve a frase nova; Conferir aceita mais de uma resposta certa.'],
    edit: 'Botão "Editar frases": frase | instrução | resposta / outra resposta.',
  },
  spot: {
    purpose: 'Achar o erro: o aluno clica na palavra errada e aparece a correção.',
    how: ['Bom para os erros típicos de quem fala português.', 'Depois o aluno fala a frase inteira corrigida.'],
    edit: 'Botão "Editar frases": She [have=has] seen a fox.',
  },
  sort: {
    purpose: 'Separar itens em 2 a 4 grupos (colunas).',
    how: ['Clique no item e depois no grupo.', 'Conferir mostra o que ficou no lugar errado.'],
    edit: 'Botão "Editar grupos": Nome do grupo: item, item, item (uma linha por grupo).',
  },
  deck: {
    purpose: 'Baralho de perguntas para conversar: uma carta por vez, separadas por tema.',
    how: ['Próxima, Anterior e Aleatória; cada tema vira uma aba.', '"Try to use" sugere uma palavra para a resposta.'],
    edit: 'Botão "Editar cartas": uma pergunta por linha em cada tema.',
  },
  challenge: {
    purpose: 'Sorteia uma frase e uma instrução ("diga com raiva", "use: although").',
    how: ['Sortear combina as duas listas sem repetir a anterior.', 'Modo adivinhar esconde a instrução: o outro adivinha.'],
    edit: 'Botão "Editar listas": frases de um lado, instruções do outro.',
  },
  scale: {
    purpose: 'Escala de opinião de 1 a 5: o aluno marca e defende a opinião.',
    how: ['Uma afirmação por vez; Próxima passa para a seguinte.', 'A marca do aluno sai no PDF.'],
    edit: 'Botão "Editar afirmações": uma por linha.',
  },
  roleplay: {
    purpose: 'Role-play com cartões: cada papel sabe coisas que o outro não sabe.',
    how: ['Os cartões começam escondidos: você lê o seu sem o aluno ver na tela.', 'No PDF, todos saem abertos.'],
    edit: 'Edite a situação e os cartões direto; + papel acrescenta mais um.',
  },
  timer: {
    purpose: 'Fale sem parar: um tema sorteado e uma contagem regressiva.',
    how: ['Começar, Pausar, Zerar e Outro tema.', 'Nos 10 segundos finais o relógio fica laranja.'],
    edit: 'Botão "Editar temas": um por linha, e o tempo em segundos.',
  },
};

/**
 * Dois exemplos por formato: { title, level, use, tags, block }.
 * use = uma frase dizendo quando usar este exemplo.
 */
export const EXAMPLES = {
  text: [
    {
      title: 'Reading · The lost wallet', level: 'A2', use: 'Leitura curta com os verbos do dia em negrito.',
      tags: { content: ['Reading', 'Past Simple'], levels: ['A2'], skills: ['Leitura'] },
      block: {
        type: 'text', label: 'READING · THE LOST WALLET',
        html: 'Last Friday, Marta <b>found</b> a wallet on the bus. Inside, there <b>was</b> a driver\'s license, 200 reais and a photo of a dog. She <b>called</b> the number on a business card, but nobody <b>answered</b>.<br><br>The next morning, a man <b>knocked</b> on her door. "I think you have my wallet," he <b>said</b>. "And that is my dog, Biscoito!"',
      },
    },
    {
      title: 'Before you read · predictions', level: 'B1', use: 'Instrução antes de uma leitura, para o aluno levantar hipóteses.',
      tags: { content: ['Reading', 'Conversation'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'text', label: 'BEFORE YOU READ',
        html: 'Look at the title: <b>"The town with no cars"</b>.<br>1. What do you think the text is about?<br>2. How do people get to work in this town?<br>3. Would you like to live there? Why or why not?',
      },
    },
  ],
  explanation: [
    {
      title: 'Much or many?', level: 'A2', use: 'Regra curta com uma cor para cada caso e a legenda das cores.',
      tags: { content: ['Quantifiers', 'Countable & uncountable nouns'], levels: ['A2'], skills: ['Leitura'] },
      block: {
        type: 'explanation', label: 'MUCH OR MANY?',
        html: `${hl('many', G)} = countable (you can count: 1, 2, 3…)<br>How ${hl('many', G)} eggs do we have? · There aren't ${hl('many', G)} people here.<br><br>${hl('much', O)} = uncountable (you can't count)<br>How ${hl('much', O)} milk do we have? · I don't have ${hl('much', O)} time.<br><br>Colors: ${hl('many', G)} = countable · ${hl('much', O)} = uncountable`,
      },
    },
    {
      title: 'Say or tell?', level: 'B1', use: 'Contraste de duas palavras que o aluno confunde, com exemplos certo × errado.',
      tags: { content: ['Vocabulary'], levels: ['A2', 'B1'], skills: ['Leitura'] },
      block: {
        type: 'explanation', label: 'SAY OR TELL?',
        html: `${hl('tell', G)} + <b>a person</b>: She ${hl('told', G)} <b>me</b> the truth. · ${hl('Tell', G)} <b>him</b> to wait.<br>${hl('say', O)} + <b>the words</b>: She ${hl('said', O)} "hello". · He ${hl('said', O)} that he was tired.<br><br>✗ She said me the truth. → ✓ She ${hl('told', G)} me the truth.<br>✗ He told "hello". → ✓ He ${hl('said', O)} "hello".<br><br>Colors: ${hl('tell', G)} = with a person · ${hl('say', O)} = with the words`,
      },
    },
  ],
  table: [
    {
      title: 'Question words', level: 'A1', use: 'Lista de referência para consultar durante a aula.',
      tags: { content: ['Question words'], levels: ['A1', 'A2'], skills: ['Leitura'] },
      block: {
        type: 'table', label: 'QUESTION WORDS', header: true,
        rows: [
          ['WORD', 'ASKS ABOUT', 'EXAMPLE'],
          ['<b>Who</b>', 'a person', 'Who is your teacher?'],
          ['<b>What</b>', 'a thing or an action', 'What are you doing?'],
          ['<b>Where</b>', 'a place', 'Where do you live?'],
          ['<b>When</b>', 'a time', 'When is your birthday?'],
          ['<b>Why</b>', 'a reason', 'Why are you laughing?'],
          ['<b>How often</b>', 'frequency', 'How often do you go to the gym?'],
        ],
      },
    },
    {
      title: 'Prepositions of time · in, on, at', level: 'A2', use: 'Regra em colunas, com uma cor por preposição.',
      tags: { content: ['Prepositions'], levels: ['A2'], skills: ['Leitura'] },
      block: {
        type: 'table', label: 'IN, ON, AT · TIME', header: true,
        rows: [
          ['PREPOSITION', 'USE IT WITH', 'EXAMPLES'],
          [hl('in', G), 'months, years, seasons, parts of the day', 'in July · in 2019 · in the summer · in the morning'],
          [hl('on', O), 'days and dates', 'on Monday · on May 5th · on my birthday'],
          [hl('at', Y), 'times and special moments', 'at 7 o\'clock · at night · at the weekend'],
        ],
      },
    },
  ],
  tense: [
    {
      title: 'Past Simple · work (regular)', level: 'A2', use: 'O afirmativo de um tempo novo, com um verbo regular.',
      tags: { content: ['Past Simple'], levels: ['A1', 'A2'], skills: ['Leitura'] },
      block: { type: 'tense', label: 'PAST SIMPLE · AFFIRMATIVE', verb: 'work', tense: 'past-simple', complement: 'yesterday.' },
    },
    {
      title: 'Present Perfect · eat (irregular)', level: 'A2', use: 'O mesmo tempo com um verbo irregular, para comparar com a tabela regular.',
      tags: { content: ['Present Perfect'], levels: ['A2', 'B1'], skills: ['Leitura'] },
      block: { type: 'tense', label: 'PRESENT PERFECT · AFFIRMATIVE', verb: 'eat', tense: 'present-perfect', complement: 'sushi.' },
    },
  ],
  timeline: [
    {
      title: 'Timeline · Past Simple (one moment)', level: 'A2', use: 'Um ponto no passado: dizemos QUANDO aconteceu.',
      tags: { content: ['Past Simple'], levels: ['A2'], skills: ['Leitura'] },
      block: {
        type: 'timeline', label: 'TIMELINE · PAST SIMPLE', now: 85,
        marks: [{ id: 'm1', kind: 'point', at: 40, text: '2019' }],
        html: 'I <b>visited</b> Rio <b>in 2019</b>. (We say when.)',
      },
    },
    {
      title: 'Timeline · Present Perfect (my life)', level: 'A2', use: 'Uma faixa (a vida até agora): a experiência importa, o quando não.',
      tags: { content: ['Present Perfect'], levels: ['A2', 'B1'], skills: ['Leitura'] },
      block: {
        type: 'timeline', label: 'TIMELINE · PRESENT PERFECT', now: 85,
        marks: [{ id: 'm1', kind: 'range', from: 8, to: 85, text: 'MY LIFE' }, { id: 'm2', kind: 'point', at: 50, text: '?' }],
        html: 'I <b>have visited</b> Rio. (When? Not important.)',
      },
    },
  ],
  image: [
    {
      title: 'Flood · what is happening?', level: 'A2', use: 'Descrever a foto no Present Continuous.',
      tags: { content: ['Present Continuous'], levels: ['A2'], skills: ['Fala'], keywords: ['flood', 'natural disaster', 'street', 'rain'] },
      block: { type: 'image', src: '/img/examples/flood.webp', caption: 'What is happening in this picture? What are the people doing?', layout: 'full' },
    },
    {
      title: 'Rescue · what happened before?', level: 'B1', use: 'Contar o que aconteceu antes da foto (Past Simple e Past Continuous).',
      tags: { content: ['Past Simple', 'Past Continuous'], levels: ['A2', 'B1'], skills: ['Fala'], keywords: ['rescue', 'firefighter', 'boat', 'flood'] },
      block: { type: 'image', src: '/img/examples/rescue.webp', caption: 'What happened before this photo? What were the people doing when the water came?', layout: 'half' },
    },
  ],
  gallery: [
    {
      title: 'Weather words · what is it like?', level: 'A1', use: 'Vocabulário: o aluno diz a palavra e você revela. Clique na imagem para ver grande.',
      tags: { content: ['Weather', 'Vocabulary'], levels: ['A1', 'A2'], skills: ['Fala'], keywords: ['weather'] },
      block: {
        type: 'gallery', label: 'WEATHER · WHAT IS IT LIKE?', html: 'What\'s the weather like? Say it first, then reveal.', columns: 3, hidden: true,
        images: [
          { id: 'g1', src: '/img/examples/weather-sunny.webp', caption: 'sunny' },
          { id: 'g2', src: '/img/examples/weather-rainy.webp', caption: 'rainy' },
          { id: 'g3', src: '/img/examples/weather-cloudy.webp', caption: 'cloudy' },
          { id: 'g4', src: '/img/examples/weather-snowy.webp', caption: 'snowy' },
          { id: 'g5', src: '/img/examples/weather-windy.webp', caption: 'windy' },
          { id: 'g6', src: '/img/examples/weather-stormy.webp', caption: 'stormy' },
        ],
      },
    },
    {
      title: 'Compare the pictures', level: 'B1', use: 'Duas fotos lado a lado, com os nomes à mostra, para comparar e contar uma história.',
      tags: { content: ['Comparatives & superlatives', 'Past Continuous'], levels: ['A2', 'B1'], skills: ['Fala'], keywords: ['flood', 'rescue'] },
      block: {
        type: 'gallery', label: 'SPEAKING · COMPARE THE PICTURES', html: 'What is different? What happened between the first and the second picture?', columns: 2, hidden: false,
        images: [
          { id: 'g1', src: '/img/examples/flood.webp', caption: 'Before: the flood' },
          { id: 'g2', src: '/img/examples/rescue.webp', caption: 'After: the rescue' },
        ],
      },
    },
  ],
  fill: [
    {
      title: 'Past Simple · my weekend', level: 'A2', use: 'Verbo na dica, aluno completa no passado (afirmativo e negativo).',
      tags: { content: ['Past Simple'], levels: ['A1', 'A2'], skills: ['Escrita'] },
      block: {
        type: 'fill', label: 'PRACTICE · MY WEEKEND', html: 'Complete with the Past Simple of the verb.',
        items: [
          { id: 'e1', before: 'On Saturday, I', hint: 'go', after: 'to the beach.', answers: ['went'] },
          { id: 'e2', before: 'We', hint: 'have', after: 'lunch at a small restaurant.', answers: ['had'] },
          { id: 'e3', before: 'My brother', hint: 'not / come', after: 'with us.', answers: ["didn't come", 'did not come'] },
          { id: 'e4', before: 'In the evening, we', hint: 'watch', after: 'a movie at home.', answers: ['watched'] },
          { id: 'e5', before: 'I', hint: 'sleep', after: 'very well!', answers: ['slept'] },
        ],
      },
    },
    {
      title: 'In, on or at?', level: 'A2', use: 'A dica é sempre a mesma: o aluno escolhe entre três palavras.',
      tags: { content: ['Prepositions'], levels: ['A2'], skills: ['Escrita'] },
      block: {
        type: 'fill', label: 'PRACTICE · IN, ON OR AT?', html: 'Complete with <b>in</b>, <b>on</b> or <b>at</b>.',
        items: [
          { id: 'e1', before: 'My birthday is', hint: 'in / on / at', after: 'July.', answers: ['in'] },
          { id: 'e2', before: 'The class starts', hint: 'in / on / at', after: '7 o\'clock.', answers: ['at'] },
          { id: 'e3', before: 'We have English', hint: 'in / on / at', after: 'Tuesdays.', answers: ['on'] },
          { id: 'e4', before: 'I never drink coffee', hint: 'in / on / at', after: 'night.', answers: ['at'] },
          { id: 'e5', before: 'It is very hot here', hint: 'in / on / at', after: 'the summer.', answers: ['in'] },
        ],
      },
    },
  ],
  choice: [
    {
      title: 'Speed round · which tense?', level: 'A2', use: 'Correção na hora, para fazer rápido em voz alta.',
      tags: { content: ['Present Simple', 'Present Continuous'], levels: ['A2'], skills: ['Leitura'] },
      block: {
        type: 'choice', label: 'SPEED ROUND · CHOOSE FAST!', html: 'Choose the correct option. Fast!', instant: true,
        items: [
          { id: 'e1', before: 'Look! It', options: ['rains', 'is raining'], answer: 1, after: '.' },
          { id: 'e2', before: 'I usually', options: ['wake up', 'am waking up'], answer: 0, after: 'at 7.' },
          { id: 'e3', before: 'She', options: ["doesn't like", "isn't liking"], answer: 0, after: 'coffee.' },
          { id: 'e4', before: 'What', options: ['do you do', 'are you doing'], answer: 1, after: 'right now?' },
          { id: 'e5', before: 'They', options: ['play', 'are playing'], answer: 0, after: 'football every Sunday.' },
        ],
      },
    },
    {
      title: 'True / False / Not Given · the lost wallet', level: 'B1', use: 'Compreensão de texto no estilo IELTS, com três opções.',
      tags: { content: ['Reading', 'IELTS'], levels: ['B1', 'B2'], skills: ['Leitura'] },
      block: {
        type: 'choice', label: 'COMPREHENSION · TRUE, FALSE OR NOT GIVEN?', html: 'Read the text again. Then choose.', instant: false,
        items: [
          { id: 'e1', before: 'Marta found the wallet on a bus.', options: ['True', 'False', 'Not Given'], answer: 0, after: '' },
          { id: 'e2', before: 'There was no money in the wallet.', options: ['True', 'False', 'Not Given'], answer: 1, after: '' },
          { id: 'e3', before: 'The man was very happy to get his wallet back.', options: ['True', 'False', 'Not Given'], answer: 2, after: '' },
          { id: 'e4', before: 'The dog in the photo is called Biscoito.', options: ['True', 'False', 'Not Given'], answer: 0, after: '' },
        ],
      },
    },
  ],
  match: [
    {
      title: 'Travel words · meanings', level: 'A2', use: 'Vocabulário novo: palavra de um lado, significado do outro.',
      tags: { content: ['Vocabulary', 'Travel'], levels: ['A2'], skills: ['Leitura'] },
      block: {
        type: 'match', label: 'VOCABULARY · AT THE AIRPORT', html: 'Match the words (1–5) to their meanings (A–E).',
        pairs: [
          { id: 'p1', left: 'boarding pass', right: 'the ticket you show to get on the plane' },
          { id: 'p2', left: 'gate', right: 'where you wait to get on the plane' },
          { id: 'p3', left: 'delay', right: 'when the flight is late' },
          { id: 'p4', left: 'luggage', right: 'your bags and suitcases' },
          { id: 'p5', left: 'customs', right: 'where they check what you bring to the country' },
        ],
      },
    },
    {
      title: 'Small talk · questions and answers', level: 'A1', use: 'Pergunta de um lado, resposta do outro.',
      tags: { content: ['Question formation', 'Conversation'], levels: ['A1', 'A2'], skills: ['Leitura', 'Fala'] },
      block: {
        type: 'match', label: 'SMALL TALK · MATCH THE ANSWER', html: 'Match each question to the best answer. Then ask your teacher!',
        pairs: [
          { id: 'p1', left: 'How was your weekend?', right: 'Great, I went to the beach.' },
          { id: 'p2', left: 'What do you do?', right: "I'm a nurse." },
          { id: 'p3', left: 'How often do you travel?', right: 'Twice a year.' },
          { id: 'p4', left: 'Where are you from?', right: 'From Porto Alegre.' },
        ],
      },
    },
  ],
  reveal: [
    {
      title: 'Make it negative · 5 basic sentences', level: 'A2', use: 'As 5 frases básicas da metodologia: o aluno fala, você revela.',
      tags: { content: ['Present Simple'], levels: ['A1', 'A2'], skills: ['Fala'] },
      block: {
        type: 'reveal', label: '5 BASIC SENTENCES · MAKE IT NEGATIVE', html: 'Make the sentence negative. Say it first, then reveal.',
        items: [
          { id: 'e1', q: 'I like coffee.', a: "I don't like coffee." },
          { id: 'e2', q: 'She works on Saturdays.', a: "She doesn't work on Saturdays." },
          { id: 'e3', q: 'We live near the beach.', a: "We don't live near the beach." },
          { id: 'e4', q: 'He plays the guitar.', a: "He doesn't play the guitar." },
          { id: 'e5', q: 'They speak Spanish.', a: "They don't speak Spanish." },
        ],
      },
    },
    {
      title: 'Speed translation · Portuguese → English', level: 'A2', use: 'Você lê em português; o aluno diz em inglês antes de revelar.',
      tags: { content: ['Past Simple', 'Past Continuous'], levels: ['A2'], skills: ['Fala'] },
      block: {
        type: 'reveal', label: 'SPEED TRANSLATION · SAY IT IN ENGLISH', html: 'Say it in English. Then reveal and compare.',
        items: [
          { id: 'e1', q: 'Ontem eu fui ao mercado.', a: 'Yesterday I went to the supermarket.' },
          { id: 'e2', q: 'Eu estava dormindo quando você ligou.', a: 'I was sleeping when you called.' },
          { id: 'e3', q: 'Ela não comprou o vestido.', a: "She didn't buy the dress." },
          { id: 'e4', q: 'O que você estava fazendo às 9?', a: 'What were you doing at 9?' },
        ],
      },
    },
  ],
  order: [
    {
      title: 'Build the question', level: 'A2', use: 'Perguntas com a ordem que o brasileiro troca (auxiliar antes do sujeito).',
      tags: { content: ['Question formation', 'Past Simple'], levels: ['A2'], skills: ['Escrita'] },
      block: {
        type: 'order', label: 'PRACTICE · BUILD THE QUESTION', html: 'Click the words in the correct order.',
        items: [
          { id: 'e1', answer: 'Where / did you go / last weekend?' },
          { id: 'e2', answer: 'What time / do you / usually / wake up?' },
          { id: 'e3', answer: 'Are you / working / today?' },
          { id: 'e4', answer: 'Why / did she / leave / so early?' },
        ],
      },
    },
    {
      title: 'Adverbs of frequency · where do they go?', level: 'A1', use: 'A posição do advérbio dentro da frase.',
      tags: { content: ['Present Simple'], levels: ['A1', 'A2'], skills: ['Escrita'] },
      block: {
        type: 'order', label: 'PRACTICE · WHERE DOES THE ADVERB GO?', html: 'Put the words in order.',
        items: [
          { id: 'e1', answer: 'I / always / have breakfast / at home.' },
          { id: 'e2', answer: 'She / is / never / late.' },
          { id: 'e3', answer: 'We / sometimes / go / to the movies.' },
          { id: 'e4', answer: 'He / doesn\'t / usually / drink / coffee.' },
        ],
      },
    },
  ],
  transform: [
    {
      title: 'Negative and question', level: 'A2', use: 'A mesma frase vira negativa e pergunta.',
      tags: { content: ['Present Simple', 'Question formation'], levels: ['A1', 'A2'], skills: ['Escrita'] },
      block: {
        type: 'transform', label: 'PRACTICE · CHANGE THE SENTENCE', html: 'Rewrite the sentence following the instruction.',
        items: [
          { id: 'e1', sentence: 'She works in a bank.', instruction: 'negative', answers: ["She doesn't work in a bank.", 'She does not work in a bank.'] },
          { id: 'e2', sentence: 'She works in a bank.', instruction: 'question', answers: ['Does she work in a bank?'] },
          { id: 'e3', sentence: 'They watched the game.', instruction: 'negative', answers: ["They didn't watch the game.", 'They did not watch the game.'] },
          { id: 'e4', sentence: 'They watched the game.', instruction: 'question', answers: ['Did they watch the game?'] },
        ],
      },
    },
    {
      title: 'Join the ideas · connectors', level: 'B1', use: 'Duas frases curtas viram uma longa, com o conectivo pedido.',
      tags: { content: ['Writing'], levels: ['A2', 'B1'], skills: ['Escrita', 'Fala'] },
      block: {
        type: 'transform', label: 'PRACTICE · ONE LONG SENTENCE', html: 'Join the two sentences with the connector.',
        items: [
          { id: 'e1', sentence: 'It was raining. We went to the beach.', instruction: 'although', answers: ['Although it was raining, we went to the beach.', 'We went to the beach although it was raining.'] },
          { id: 'e2', sentence: 'I was tired. I went to bed early.', instruction: 'so', answers: ['I was tired, so I went to bed early.', 'I was tired so I went to bed early.'] },
          { id: 'e3', sentence: 'She studies a lot. She wants a good job.', instruction: 'because', answers: ['She studies a lot because she wants a good job.'] },
        ],
      },
    },
  ],
  spot: [
    {
      title: 'Classic mistakes (Brazilians)', level: 'A2', use: 'Os erros que vêm do português: o aluno acha e fala certo.',
      tags: { content: ['Verb to be', 'Present Simple'], levels: ['A1', 'A2'], skills: ['Leitura'] },
      block: {
        type: 'spot', label: 'SPOT THE MISTAKE · CLASSIC ERRORS', html: 'Each sentence has one mistake. Click it, then say the sentence correctly.',
        items: [
          { id: 'e1', words: ['I', 'have', '30', 'years', 'old.'], wrong: 1, fix: 'am' },
          { id: 'e2', words: ['She', "don't", 'like', 'tea.'], wrong: 1, fix: "doesn't" },
          { id: 'e3', words: ['I', 'am', 'agree', 'with', 'you.'], wrong: 1, fix: '(I agree)' },
          { id: 'e4', words: ['People', 'is', 'very', 'friendly', 'here.'], wrong: 1, fix: 'are' },
        ],
      },
    },
    {
      title: 'Past Simple · questions and negatives', level: 'A2', use: 'Depois de did e didn\'t o verbo volta para a forma base.',
      tags: { content: ['Past Simple'], levels: ['A2'], skills: ['Leitura'] },
      block: {
        type: 'spot', label: 'SPOT THE MISTAKE · PAST SIMPLE', html: 'Find the mistake and correct it.',
        items: [
          { id: 'e1', words: ['Did', 'you', 'went', 'to', 'the', 'party?'], wrong: 2, fix: 'go' },
          { id: 'e2', words: ['I', "didn't", 'saw', 'the', 'message.'], wrong: 2, fix: 'see' },
          { id: 'e3', words: ['She', 'buyed', 'a', 'new', 'phone.'], wrong: 1, fix: 'bought' },
          { id: 'e4', words: ['We', 'was', 'at', 'home', 'yesterday.'], wrong: 1, fix: 'were' },
        ],
      },
    },
  ],
  sort: [
    {
      title: 'Countable or uncountable?', level: 'A2', use: 'Dois grupos, com palavras que enganam (money, bread, advice).',
      tags: { content: ['Countable & uncountable nouns'], levels: ['A2'], skills: ['Leitura'] },
      block: {
        type: 'sort', label: 'SORT · COUNTABLE OR UNCOUNTABLE?', html: 'Click a word, then the group where it goes.',
        groups: ['Countable', 'Uncountable'],
        items: [
          { id: 'e1', text: 'apple', group: 0 }, { id: 'e2', text: 'money', group: 1 }, { id: 'e3', text: 'coin', group: 0 },
          { id: 'e4', text: 'bread', group: 1 }, { id: 'e5', text: 'sandwich', group: 0 }, { id: 'e6', text: 'advice', group: 1 },
          { id: 'e7', text: 'chair', group: 0 }, { id: 'e8', text: 'furniture', group: 1 },
        ],
      },
    },
    {
      title: '-ed pronunciation · /t/, /d/ or /ɪd/', level: 'A2', use: 'Três grupos: o aluno fala cada palavra antes de colocar.',
      tags: { content: ['Past Simple', 'Pronunciation'], levels: ['A2'], skills: ['Fala'] },
      block: {
        type: 'sort', label: 'SORT · HOW DO YOU SAY -ED?', html: 'Say the word. Then put it in the right group.',
        groups: ['/t/', '/d/', '/ɪd/'],
        items: [
          { id: 'e1', text: 'worked', group: 0 }, { id: 'e2', text: 'watched', group: 0 }, { id: 'e3', text: 'stopped', group: 0 },
          { id: 'e4', text: 'played', group: 1 }, { id: 'e5', text: 'called', group: 1 }, { id: 'e6', text: 'cleaned', group: 1 },
          { id: 'e7', text: 'wanted', group: 2 }, { id: 'e8', text: 'needed', group: 2 }, { id: 'e9', text: 'visited', group: 2 },
        ],
      },
    },
  ],
  deck: [
    {
      title: 'Warm-up · your week', level: 'A2', use: 'Começo de aula: três temas em abas e uma palavra para tentar usar.',
      tags: { content: ['Conversation', 'Past Simple'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'deck', label: 'WARM-UP · TALK TO ME!', html: 'Answer with a complete sentence and one more detail.',
        words: ['because', 'also', 'but', 'actually'],
        cats: [
          { name: 'Your week', qs: ['How was your week?', 'What was the best part of your weekend?', 'Did anything funny happen this week?'] },
          { name: 'Work & study', qs: ['What are you working on these days?', 'What do you do after work?', 'What do you want to learn this year?'] },
          { name: 'Food', qs: ['What did you have for dinner yesterday?', 'What is your favorite restaurant?', 'Can you cook? What do you cook best?'] },
        ],
      },
    },
    {
      title: 'Would you rather…?', level: 'B1', use: 'Perguntas de escolha para o aluno defender a opinião.',
      tags: { content: ['Conversation'], levels: ['A2', 'B1', 'B2'], skills: ['Fala'] },
      block: {
        type: 'deck', label: 'WOULD YOU RATHER…?', html: 'Choose one and explain why. Give two reasons!',
        words: ['I would rather…', 'because', 'on the other hand'],
        cats: [
          { name: 'Life', qs: ['Would you rather live by the beach or in the mountains?', 'Would you rather work from home or in an office?', 'Would you rather travel to the past or to the future?'] },
          { name: 'Fun', qs: ['Would you rather be able to fly or to be invisible?', 'Would you rather never use social media again or never watch TV again?'] },
        ],
      },
    },
  ],
  challenge: [
    {
      title: 'Say it like this!', level: 'A2', use: 'A mesma frase dita de jeitos diferentes: treina entonação e advérbios.',
      tags: { content: ['Adverbs of manner', 'Pronunciation'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'challenge', label: 'GAME · SAY IT LIKE THIS!', html: 'Draw a card and say the sentence <b>in that way</b>. Then the teacher acts, you guess!',
        promptLabel: 'SAY IT',
        lines: ['I lost my phone.', "There's a spider in the bathroom.", 'We won the lottery!', 'The bus is late again.'],
        prompts: ['calmly', 'angrily', 'excitedly', 'sadly', 'nervously', 'dramatically'],
      },
    },
    {
      title: 'Answer using the word', level: 'B1', use: 'Pergunta + palavra obrigatória (conectivo, advérbio, expressão).',
      tags: { content: ['Conversation'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'challenge', label: 'SPEAKING · USE THE WORD', html: 'Answer the question. You <b>must</b> use the word on the card.',
        promptLabel: 'USE THIS WORD',
        lines: ['What did you do last weekend?', 'Tell me about your job.', 'Describe your city.', 'What was your last trip like?'],
        prompts: ['although', 'however', 'actually', 'unfortunately', 'because of', 'while'],
      },
    },
  ],
  scale: [
    {
      title: 'Opinions · technology', level: 'B1', use: 'Afirmações para concordar ou discordar e explicar por quê.',
      tags: { content: ['Conversation', 'Technology'], levels: ['B1', 'B2'], skills: ['Fala'] },
      block: {
        type: 'scale', label: 'WHAT DO YOU THINK? · TECHNOLOGY', html: 'Mark your opinion. Then explain it with two reasons.',
        left: 'Totally disagree', right: 'Totally agree',
        statements: ['Children should not have phones before they are 14.', 'AI will make many jobs disappear.', 'Working from home is better than working in an office.'],
      },
    },
    {
      title: 'Hot takes · food', level: 'A2', use: 'Opiniões rápidas e divertidas para soltar a fala.',
      tags: { content: ['Conversation', 'Food'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'scale', label: 'HOT TAKES · FOOD', html: 'Choose a number. Do you agree? Why?',
        left: 'No way!', right: 'Totally!',
        statements: ['Pineapple on pizza is delicious.', 'Breakfast is the most important meal of the day.', 'Brazilian food is the best in the world.'],
      },
    },
  ],
  roleplay: [
    {
      title: 'Role-play · at the restaurant', level: 'A2', use: 'Situação do dia a dia, com uma reclamação para resolver.',
      tags: { content: ['Conversation', 'Food'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'roleplay', label: 'ROLE-PLAY · A PROBLEM WITH YOUR ORDER',
        html: 'You are at a restaurant. Your food arrived, but there is a problem. Read your card and start the conversation.',
        roles: [
          { name: 'Customer (student)', card: 'You ordered a vegetarian pasta, but there is chicken in it. You are in a hurry: you have a meeting in 30 minutes. Ask for a solution.' },
          { name: 'Waiter (teacher)', card: 'The kitchen is very busy today: a new pasta takes 25 minutes. You can offer a salad now (5 minutes) or a free dessert.' },
        ],
      },
    },
    {
      title: 'Role-play · job interview', level: 'B1', use: 'Entrevista de emprego: perguntas e respostas mais longas.',
      tags: { content: ['Conversation', 'Work', 'Present Perfect'], levels: ['B1', 'B2'], skills: ['Fala'] },
      block: {
        type: 'roleplay', label: 'ROLE-PLAY · THE JOB INTERVIEW',
        html: 'A company is looking for a new team leader. One person is the candidate, the other is the interviewer.',
        roles: [
          { name: 'Candidate (student)', card: 'You have worked in sales for 5 years. You want this job because you want to lead a team. Your weak point: you have never managed a budget.' },
          { name: 'Interviewer (teacher)', card: 'Ask about experience, a difficult situation at work, why they want the job and their weak points. The job needs someone who can start next month.' },
        ],
      },
    },
  ],
  timer: [
    {
      title: 'One minute · talk about you', level: 'A2', use: 'Um minuto falando sem parar sobre um tema pessoal.',
      tags: { content: ['Conversation'], levels: ['A2', 'B1'], skills: ['Fala'] },
      block: {
        type: 'timer', label: 'ONE MINUTE · DON\'T STOP!', html: 'Talk about the topic until the time is up.', seconds: 60,
        topics: ['Your favorite place in your city', 'Your perfect weekend', 'The best trip of your life', 'Something you want to learn'],
      },
    },
    {
      title: 'IELTS Speaking Part 2 · two minutes', level: 'B2', use: 'Dois minutos sobre um tema, como na prova do IELTS.',
      tags: { content: ['IELTS', 'Conversation'], levels: ['B1', 'B2'], skills: ['Fala'] },
      block: {
        type: 'timer', label: 'IELTS PART 2 · TALK FOR 2 MINUTES', html: 'You have 1 minute to prepare. Then talk for 2 minutes.', seconds: 120,
        topics: ['Describe a person who has influenced you', 'Describe a time you helped someone', 'Describe a place you would like to visit'],
      },
    },
  ],
};

/** Uma cópia do exemplo, pronta para virar bloco ou modelo. */
export const exampleBlock = (type, i) => JSON.parse(JSON.stringify(EXAMPLES[type]?.[i]?.block || null));
