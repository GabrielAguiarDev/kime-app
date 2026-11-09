# Kimi — Design System

Este documento é a referência visual do app e dos widgets. Siga-o em todas as telas. Em caso de conflito com qualquer outra instrução de design, este documento vale.

> Os valores abaixo vivem em [`tokens.json`](tokens.json) (fonte única). Rode `npm run tokens` para gerar `src/theme/tokens.ts`, `targets/widgets/KimiTokens.swift` (widget iOS) e `modules/kimi-widget/android/src/main/java/br/com/kimi/widget/KimiTokens.kt` (widget Android).

## 1. Princípios

O Kimi usa a mecânica de interface do Duolingo — retorno tátil a cada ação, progresso sempre visível, comemoração nos momentos certos — com uma linguagem visual adulta e esportiva.

| Do Duolingo, mantemos | Do Duolingo, descartamos |
| --- | --- |
| Botões "táteis" com borda inferior grossa | Traço infantil e caricato nos personagens |
| Cards com borda sólida de 2px | Paleta arco-íris saturada |
| Barras de progresso grossas | Ilustrações cartunescas |
| Folha de feedback na base da tela | Formas em pílula / cantos muito redondos |
| Sequência, marcos e recompensas | Texto fofinho e excesso de exclamações |
| Botões com texto em caixa alta | Fonte arredondada |

Quatro regras que valem para tudo:

1. Uma ação principal por tela, sempre com o botão tátil primário.
2. Números são protagonistas. ml, dias, aulas — grandes, condensados, em negrito.
3. Cor de destaque só para ação e progresso. O resto é neutro.
4. Todo toque tem resposta: mudança de estado visual + haptic.

## 2. Tokens

Mantenha os tokens em um único `tokens.json` e gere a partir dele os arquivos de TypeScript (app), Swift (widget iOS) e Kotlin (widget Android). Nunca use valores soltos no código.

> **Tema do app: só escuro** (decisão de produto). O app usa sempre as cores da seção 2.2 e ignora a aparência do sistema. As cores do tema claro (2.1) continuam nos tokens porque os **widgets seguem claro/escuro do sistema** (seção 9).

### 2.1 Cores — tema claro

| Token | Valor | Uso |
| --- | --- | --- |
| bg | `#F6F5F2` | Fundo das telas (off-white) |
| surface | `#FFFFFF` | Cards, sheets, inputs |
| border | `#E4E2DD` | Bordas de cards e inputs |
| edge | `#CFCCC5` | Borda inferior 3D de elementos neutros |
| text | `#15171A` | Texto principal |
| text-muted | `#6B6F76` | Texto secundário, legendas |
| disabled | `#B9B6AF` | Elementos desativados |

### 2.2 Cores — tema escuro

| Token | Valor |
| --- | --- |
| bg | `#0F1012` |
| surface | `#17191C` |
| surface-raised | `#1F2226` |
| border | `#2B2F34` |
| edge | `#0A0B0C` |
| text | `#F2F1EE` |
| text-muted | `#9A9EA5` |
| disabled | `#4A4E54` |

### 2.3 Cores de marca e semânticas

| Token | Claro | Escuro | Uso |
| --- | --- | --- | --- |
| accent | `#D9400A` | `#F05A1E` | Ação principal, progresso, aba ativa |
| accent-edge | `#A63008` | `#B8420F` | Borda 3D do botão primário |
| water | `#1E88E5` | `#3D9BF0` | Tudo relacionado a água |
| water-edge | `#1565B0` | `#2373C0` | Borda 3D do botão de água |
| success | `#1F9D57` | `#2FB86A` | Check-in confirmado, meta batida |
| warning | `#F2A100` | `#F5B32E` | Check-in pendente (texto escuro sobre ele) |
| danger | `#D92D4A` | `#EF4C66` | Erros, recusado, ações destrutivas |

Cada cor sólida usada em botão tem uma versão `-edge` (cerca de 25% mais escura) para a borda inferior.

### 2.4 Cores das faixas

Usadas no chip de faixa, na barra de graduação e como toque de personalização no perfil. A academia escolhe quais faixas usa por modalidade.

| Faixa | Cor | Observação |
| --- | --- | --- |
| Branca | `#F2F2F2` | Sempre com borda `border` |
| Cinza | `#8E9196` | |
| Amarela | `#F2C418` | Texto escuro |
| Laranja | `#F07A1A` | |
| Verde | `#2E9E4F` | |
| Azul | `#1F5FD1` | |
| Roxa | `#6E3FC9` | |
| Marrom | `#7A4A2A` | |
| Preta | `#151515` | No tema escuro, com borda `border` |
| Vermelha | `#C8242F` | |

Variações (opção "Mais cores" no cadastro de faixa; mesmos usos das cores acima):

| Faixa | Cor | Observação |
| --- | --- | --- |
| Cinza-clara | `#C4C6CA` | Texto escuro |
| Cinza-escura | `#55585E` | |
| Amarela-escura | `#C9A227` | Dourada; texto escuro |
| Verde-clara | `#6CC24A` | Texto escuro |
| Verde-escura | `#1E6B37` | |
| Azul-clara | `#5AA9F0` | Texto escuro |
| Azul-escura | `#16337A` | |
| Roxa-clara | `#A687E3` | Texto escuro |
| Marrom-clara | `#A9744A` | |
| Vermelha-escura | `#7D1A22` | Vinho |

### 2.5 Tipografia

- Display (números e títulos): **Barlow Condensed** — ExtraBold (800) e Bold (700).
- Texto e interface: **Inter** — Regular (400), SemiBold (600) e Bold (700).

| Token | Fonte | Tamanho / altura | Uso |
| --- | --- | --- | --- |
| display-xl | Barlow Condensed 800 | 64 / 64 | Contagem regressiva, total de aulas |
| display-lg | Barlow Condensed 800 | 44 / 46 | ml bebidos, números de destaque |
| title | Barlow Condensed 700 | 28 / 32 | Título de tela |
| heading | Inter 700 | 18 / 24 | Título de card e seção |
| body | Inter 400 | 16 / 22 | Texto corrido |
| body-strong | Inter 600 | 16 / 22 | Ênfase |
| caption | Inter 600 | 13 / 18 | Legendas, rótulos, metadados |
| button | Inter 700 | 15 / 20 | Botões — caixa alta, letter-spacing 0.6 |

Números sempre com algarismos tabulares (`fontVariant: ['tabular-nums']`) para não "pularem" quando mudam.

### 2.6 Espaçamento

Grade de 4pt: 4, 8, 12, 16, 20, 24, 32, 40, 48. Margem lateral das telas: 20. Espaço entre cards: 12. Padding interno de cards: 16.

### 2.7 Raios e bordas

Cantos levemente arredondados, nunca pílula.

| Token | Valor | Uso |
| --- | --- | --- |
| radius-sm | 6 | Chips, badges |
| radius-md | 10 | Inputs, botões, células |
| radius-lg | 14 | Cards, sheets, widgets |
| border-width | 2 | Cards e inputs |
| edge-width | 4 | Borda inferior 3D |

Sem sombras difusas. A profundidade vem só da borda inferior sólida (edge), como no Duolingo.

## 3. Componentes

### 3.1 Botão tátil

O componente mais importante do app.

- Altura 52, raio radius-md, texto button em caixa alta, largura total por padrão.
- Fundo sólido + borda inferior de 4px na cor `-edge`.
- Pressionado: desloca 4px para baixo e a borda inferior some (o botão "afunda"). A mudança é instantânea, sem transição. Haptic leve.
- Desativado: fundo disabled, sem borda 3D, texto text-muted.

| Variante | Fundo | Borda inferior | Texto |
| --- | --- | --- | --- |
| Primário | accent | accent-edge | branco |
| Água | water | water-edge | branco |
| Secundário | surface + borda 2px border | edge | text |
| Perigo | danger | versão -edge | branco |
| Fantasma | transparente | nenhuma | accent |

### 3.2 Card

- Fundo surface, borda 2px border, raio radius-lg, padding 16.
- Card tocável ganha borda inferior de 4px edge e se comporta como o botão tátil ao pressionar.
- Card selecionado: borda accent e fundo accent com 8% de opacidade.

### 3.3 Barra de progresso

- Altura 14, raio 7, trilho border.
- Preenchimento na cor do contexto (accent, water ou a cor da faixa).
- Faixa de brilho de 3px no topo do preenchimento, branco a 25% de opacidade (detalhe do Duolingo que dá volume).
- Sempre acompanhada do número ao lado ou acima: "18 / 40 aulas".

### 3.4 Anel de água

- Anel com espessura 14, trilho border, preenchimento water, pontas retas.
- Centro: ml bebidos em display-lg e a meta em caption ("de 3.000 ml").
- Meta batida: preenchimento muda para success.

### 3.5 Contador grande

Número em display-xl com rótulo caption em caixa alta abaixo ("DIAS PARA O CAMPEONATO", "AULAS CONFIRMADAS").

### 3.6 Badge de status

Raio radius-sm, texto caption, ícone de 14 à esquerda.

| Status | Fundo | Texto |
| --- | --- | --- |
| Pendente | warning 18% | text |
| Confirmado | success 15% | success |
| Recusado | danger 12% | danger |

### 3.7 Chip de faixa

Retângulo de 28×10 com a cor da faixa (com borda quando for branca ou preta no tema escuro), seguido do nome da faixa em caption.

### 3.8 Inputs

- Altura 52, fundo surface, borda 2px border, raio radius-md.
- Foco: borda accent.
- Erro: borda danger + mensagem em caption abaixo.
- Valores numéricos (peso, altura, ml) com a unidade fixa à direita, em text-muted.

### 3.9 Tab bar

- Só ícones, sem texto.
- Altura 64 + área segura, fundo surface, borda superior 2px border.
- Ativo: ícone preenchido em accent. Inativo: ícone contorno em text-muted.
- Abas por papel:
  - Aluno: Início, Aulas, Perfil
  - Competidor: Início, Aulas, Competição, Perfil
  - Professor: Início, Alunos, Confirmações, Perfil

### 3.10 Folha de feedback

Equivalente à faixa "Correto!" do Duolingo. Aparece na base da tela após uma ação importante.

- Fundo da cor semântica a 15%, borda superior 2px na cor cheia.
- Um só componente para todas as mensagens de feedback (inclusive "Check-in confirmado"), colado na base da tela.
- Padding: 20 em cima e nas laterais; embaixo, área segura + 12.
- Linha de conteúdo: título (heading) e mensagem (body) com 4pt entre eles. À esquerda, o mascote em recorte de busto (`crop="bust"`, cerca de 120pt de altura), com a base alinhada à base da linha, ou seja, 16pt acima do botão, como o texto, sem espaço extra. Ele não entra na altura da folha, e a parte de cima pode passar da borda superior sem ser cortada. O texto fica alinhado pela base com o mascote e começa 12pt depois do ponto mais à direita do mascote na altura do texto: se as pontas da faixa (ou punhos) estiverem nessa altura, o texto começa depois delas. O contorno de cada busto é gerado por `node scripts/brand/mascot-bust-profile.mjs` (`bustProfile.ts`). Folhas de erro/aviso usam ícone no lugar do mascote, centralizado com o texto.
- 16pt entre a linha de conteúdo e o botão de largura total. A altura é a soma desses elementos, sem mínimo.
- Poses: entrada na equipe `team`; disciplina aumentou, novo recorde e meta de água batida `streak`; check-in confirmado `guard` animado. Folhas de erro/aviso usam ícone no lugar do mascote.
- Usos: check-in enviado, meta de água batida, marco de aulas, nova faixa.

### 3.11 Estados vazios

Mascote `guard` animado em tamanho 128 (ou ícone de 48 em text-muted em espaços pequenos), uma frase curta em body e, quando houver ação, um botão secundário. Nenhuma outra ilustração além do mascote.

### 3.13 Bottom sheet

Usado para confirmações e escolhas rápidas no lugar dos alertas do sistema.

- Tela escurecida por trás (`edge` a 70%, token `opacity.scrim`).
- Folha presa à base: fundo `surface`, borda 2px `border` no topo e nas laterais, raio `radius-lg` só nos cantos de cima, margem lateral 20.
- Alça no topo: 40×5, raio `radius-sm`, cor `border`.
- Confirmação: título `heading`, explicação `body` em `text-muted`, botão tátil da ação (perigo para ações destrutivas, primário nas demais) e "Cancelar" fantasma abaixo.
- Fecha ao arrastar para baixo, ao tocar fora ou com o voltar do Android.
- **Exceção à seção 8:** o bottom sheet tem movimento próprio (sobe da base em ~280 ms, desce em ~200 ms, fundo acompanha). Respeita "Reduzir movimento" do sistema.

### 3.12 Rolagem

Sem barras de rolagem visíveis em nenhuma lista ou tela (`showsVerticalScrollIndicator={false}` e equivalentes).

## 4. Mascote e ícone do app

O mascote é um ninja de corpo inteiro: cabeça redonda preta, faixa laranja na altura dos olhos amarrada atrás da cabeça, quimono preto com gola em V, faixa laranja na cintura e detalhes laranja nos punhos e tornozelos. A expressão fica nos olhos e nas sobrancelhas.

**Poses** (`assets/mascot/`, PNG 1254×1254, fundo transparente, mesma escala de cabeça e pés na mesma linha):

| Pose | Arquivo | Onde |
| --- | --- | --- |
| `guard` (padrão) | `guard.png` | Todos os outros pontos (onboarding, folhas de feedback, marco de aulas, timer, guia do widget) |
| `guard` animado | `guard-no-eyes.png` + `guard-eyes.svg` | Abertura do app (splash), estados vazios, balão da Início do aluno, Jornada |
| `team` | `team.png` | Folha "Bem-vindo à equipe." ao entrar na equipe de competição |
| `streak` | `streak.png` | Folhas de feedback da disciplina ("Nada mal.", "Novo recorde.", meta de água batida) |
| `graduation` | `graduation.png` | Tela de conquista de nova faixa |
| `thirsty` | `thirsty.png` | Widget de água a partir das 18h sem registro no dia |

- Componente `KimiMascot` (`pose`, padrão `guard`; `animated`, padrão desligado). Só a pose `guard` anima; as outras são sempre estáticas.
- **Guard animado:** `guard-no-eyes.png` com `guard-eyes.svg` por cima, no mesmo tamanho e posição (sobreposição 1:1). Os olhos são vetoriais (react-native-svg) e se movem com react-native-reanimated:
  - **Piscar** a cada 3 a 7 s (às vezes piscada dupla): as pálpebras (`eyelid-*`) descem e sobem em cerca de 150 ms. Em repouso ficam acima do olho, fora da área recortada.
  - **Olhar em volta** a cada 2,5 a 5 s: esquerda ou direita, e às vezes fica olhando para a frente. Em cerca de 1 a cada 4 vezes, olhar rápido duplo (esquerda e logo direita). As pupilas (`pupil-*`, com o brilho) deslocam cerca de 20 unidades em 150 a 200 ms, ficam 0,6 a 1,5 s no lado e voltam. A piscada continua independente; se ela coincidir com um olhar, acontece no meio do movimento. Intervalos em `src/components/KimiMascot/motion.ts`.
  - **Raiva:** as sobrancelhas `brow-*` dão lugar a `brow-*-angry` por cerca de 1 s. Ao tocar no mascote e em erros (estado vazio de erro).
  - Discreto. Pausado quando a tela não está em foco ou o app está em segundo plano. Com "Reduzir movimento", o mascote é o `guard.png` estático.
- **Professor:** mascote animado só na abertura do app e nos estados vazios; no resto, estático.
- Nunca em listas, cards comuns ou na tab bar.
- Tamanhos (o mascote agora tem o corpo inteiro): 200 em telas de marco, onboarding e abertura do app; 128 em estados vazios e na Jornada; 80 no balão; 120 de altura no busto da folha de feedback.
- **Recorte de busto** (`crop="bust"`): mostra só a janela da cabeça à cintura de cada pose, sem distorcer (a imagem inteira é desenhada e recortada por um container com overflow oculto; no guard animado, base e olhos são recortados juntos). Janelas em `src/components/KimiMascot/poses.ts` (`BUST_WINDOWS`; depois de mudar, rode `node scripts/brand/mascot-bust-profile.mjs`, coordenadas da imagem 1254×1254): guard 180, 206, 1020×760; team 180, 137; streak 180, 48; graduation 180, 87 (todas 1020×760); thirsty 150, 96, 1050×760 (inclui a garrafa).
- Nunca recolorir, distorcer ou adicionar contornos e sombras.
- Os olhos do código vêm do `guard-eyes.svg` (`node scripts/brand/mascot-eyes.mjs` gera `guardEyesShapes.ts`); depois de mudar o SVG, rode o script.

**Abertura do app:** a splash nativa é só a cor de fundo, sem imagem; ela some assim que a animação está na tela. O ninja é **revelado** pela fumaça, nunca visto aparecendo. As poses são centralizadas pela cabeça; só na splash o mascote vai cerca de 1% da largura dele para a esquerda ((640 − 627) / 1254), para o corpo da guard (tronco e pernas) ficar no centro da tela, alinhado com o "KIMI" e com a fumaça; as pontas da faixa passam para a direita. São 5 nuvens (`smoke-cloud` do `kimi-props.svg`) agrupadas na área do ninja, na frente dele: no pico o conjunto fica centrado no corpo, com mais ou menos a largura do ninja com as pontas da faixa e uma pequena folga, sem chegar às bordas da tela. Movimento único e contínuo, sem fases: 0–0,45 s, as nuvens nascem pequenas na linha dos pés e crescem subindo até cobrir o ninja inteiro, as de baixo primeiro e as de cima por último. Em 0,4 s, já totalmente coberto, o ninja (guard animado) liga de uma vez, sem fade e sem escala. 0,45–1,0 s: a fumaça se dissipa no lugar, continuando a subir um pouco, crescendo levemente e sumindo, sem se afastar para os lados (haptic leve no início). As nuvens ficam totalmente opacas até a dissipação começar. 1,0–1,3 s: uma piscada e a raiva. 1,1–1,4 s: "KIMI" em Barlow Condensed ExtraBold sobe 12pt e aparece. Depois do texto, uma pausa de 0,6 s com o nome e o mascote na tela; sai aos 2,0 s se o app já carregou; senão, o mascote fica parado com as microanimações até carregar. Saída: escala 0,92 e opacidade 0 em 250 ms. Mesma animação para professor e aluno; só na abertura a frio, não ao voltar do segundo plano. Com "Reduzir movimento": sem fumaça e sem escala, mascote estático e texto com fade simples.

Ícone do app: `assets/brand/kimi-icon.svg` é a fonte oficial; as aparências do iOS ficam em `kimi-icon-{light,dark,tinted}.png` (1024×1024, sangrado, sem transparência) — recorte do rosto do mascote preenchendo o quadro, com a faixa laranja e os olhos bravos. Exportar sem cantos arredondados (o sistema aplica a máscara) e manter os olhos dentro da área segura do ícone adaptativo do Android.

## 5. Iconografia

- Biblioteca: Phosphor Icons. Peso `bold` para estado normal e `fill` para estado ativo.
- Tamanhos: 20 (inline), 24 (tab bar e botões), 48 (estados vazios).
- Nada de emojis na interface.

## 6. Tom de voz

Direto, curto, como um professor no tatame. Frases afirmativas, no máximo uma exclamação por tela.

| Situação | Escreva | Evite |
| --- | --- | --- |
| Check-in enviado | "Check-in enviado. Aguardando o professor." | "Uhuul! Você arrasou! 🎉" |
| Meta de água batida | "Meta do dia batida." | "Parabéns, campeão!!!" |
| Sem garrafa configurada | "Configure sua garrafa para usar o widget." | "Ops! Parece que algo está faltando..." |
| Sequência | "6 semanas seguidas treinando." | "Seu foguinho está pegando fogo!" |

## 7. Haptics

| Momento | Haptic |
| --- | --- |
| Toque em botão tátil | Impacto leve |
| Registro de água | Impacto médio |
| Check-in confirmado, meta batida, nova faixa | Sucesso (notification success) |
| Fumaça começa a dissipar na abertura do app | Impacto leve |
| Erro | Erro (notification error) |

## 8. Movimento

Não implemente animações nem transições. O movimento será adicionado manualmente depois. Exceções decididas pelo produto: o bottom sheet (3.13), o anel de água (3.4), que enche com uma transição suave (~700 ms, desacelerando) quando a quantidade muda, a barra de progresso das etapas do cadastro da academia (~450 ms, desacelerando), as microanimações do mascote e a abertura do app (seção 4). Todas respeitam "Reduzir movimento" do sistema.

- Defina cada estado como um estilo separado: repouso, pressionado, concluído, comemoração.
- Mudanças de estado são instantâneas.
- Marque cada ponto onde haverá movimento com `// TODO(motion): descrição`. Pontos esperados:
  - Botão tátil afundando e voltando
  - Badge passando de pendente para confirmado
  - Barra de faixa avançando
  - Número da contagem regressiva virando
  - Entrada e saída da folha de feedback

## 9. Widgets

Os widgets seguem os mesmos tokens, gerados a partir do `tokens.json`, e respeitam claro/escuro do sistema (o app em si é só escuro; ver seção 2).

- Fundo surface, raio do próprio sistema (não force raio no container).
- Widget de água (pequeno): anel de água no topo, ml bebidos em display-lg, botão tátil de água "+500 ML" na base. Estado sem garrafa: ícone de garrafa em text-muted e "Configure sua garrafa".
- Widget de água (médio): anel à esquerda; à direita, total, meta do dia e o botão.
- Widget de contagem regressiva: número em display-xl, "DIAS" em caption, nome do campeonato em heading e a data em caption. Sem campeonato: estado vazio discreto.
- Nos widgets, o "afundar" do botão é o estado pressionado do sistema; não tente reproduzir a borda 3D se a plataforma não permitir.

## 10. Acessibilidade

- Contraste mínimo de 4.5:1 para texto comum.
- Área de toque mínima de 44×44.
- Suporte a tamanho de fonte dinâmico até pelo menos 130% sem quebrar layout.
- Cor nunca é a única informação: status sempre com ícone e texto.
- Todo botão só com ícone tem `accessibilityLabel`.

## 11. Padrões de tela inspirados no Duolingo

| No Duolingo | No Kimi |
| --- | --- |
| Barra do topo com ofensiva, gemas e vidas | Barra do topo com sequência, aulas e água |
| Trilha de lições | Trilha de graduação até a próxima faixa |
| Duo falando em balões | Ninja dando dicas e lembretes em balões |
| Tela de lição concluída | Tela de conquista (check-in, meta, faixa) |
| Opções de resposta em cards | Escolhas de formulário em cards de seleção |
| Sons de acerto e conclusão | Sons curtos nas conquistas (desligáveis) |

### 11.1 Barra do topo

Fixa no topo da tela Início, com três contadores lado a lado: sequência semanal (ícone de chama em `accent`), aulas confirmadas (ícone de faixa na cor da faixa do aluno) e água de hoje (ícone de gota em `water`). Cada contador é ícone de 24 + número em Barlow Condensed 700, tamanho 20. Tocar em um contador abre o detalhe correspondente.

### 11.2 Trilha de graduação

O coração da tela Aulas, no lugar da trilha de lições do Duolingo.

- Trilha vertical de **nós circulares em zigue-zague**, cada nó representando um bloco de aulas (o tamanho do bloco é a meta da faixa dividida em etapas).
- **Concluído:** círculo de 72 em `accent` com borda inferior 3D `accent-edge` e ícone de check branco.
- **Atual:** círculo de 88 em `accent`, anel de progresso ao redor e o mascote `guard` animado em tamanho 128 ao lado.
- **Futuro:** círculo de 72 em `surface`, borda 2px `border`, borda inferior `edge`, ícone em `disabled`.
- **Último nó:** a próxima faixa, desenhada com a cor dela.
- Tocar em um nó abre um balão com "Aulas 21–30 · 4 de 10 feitas".

### 11.3 Balão do mascote

Mascote `guard` animado em tamanho 80 à esquerda e um balão à direita: fundo `surface`, borda 2px `border`, raio `radius-lg`, com uma ponta apontando para o mascote. Texto `body`, no máximo duas linhas. Usos: dica do dia, lembrete de água ("Faltam 1.200 ml hoje"), aviso de check-in pendente, mensagem do professor.

### 11.4 Tela de conquista

Tela cheia após marcos: check-in confirmado, meta de água batida, nova faixa, sequência de semanas.

- Mascote em 200, centralizado: pose `graduation` na nova faixa, `guard` nos outros marcos.
- Título em `title` ("Faixa azul conquistada").
- Linha com 2 ou 3 cards de estatística: cabeçalho colorido com o rótulo em `caption` caixa alta e branco, corpo `surface` com o número em `display-lg` (ex. "AULAS · 120", "SEMANAS · 8").
- Botão primário "CONTINUAR" fixo na base.

### 11.5 Cards de seleção

Em formulários, escolhas viram cards tocáveis como as respostas do Duolingo, e não listas ou dropdowns:

- Tamanho da garrafa: 300, 500, 750, 1.000 ml e "Outro".
- Modalidade, dias da semana no plano de água do professor, faixas.
- Estado normal: card tocável com borda inferior 3D. Selecionado: borda `accent` e fundo `accent` a 8%.

### 11.6 Reações do mascote

| Situação | Pose | Onde |
| --- | --- | --- |
| Padrão, estados vazios, lembretes | `guard` animado | Estados vazios, balões, Jornada |
| Check-in confirmado | `guard` animado (busto) | Folha de check-in |
| Disciplina aumentou, recorde, meta de água batida | `streak` | Folha de feedback |
| Entrada na equipe de competição | `team` | Folha de feedback |
| Nova faixa | `graduation` | Tela de conquista |
| Sem água registrada até as 18h | `thirsty` | Widget de água |
| Erro | `guard` animado com raiva | Estado vazio de erro |

### 11.7 Sons

Sons curtos (até 1 segundo) no registro de água, check-in confirmado e telas de conquista. Respeitam o modo silencioso do aparelho e podem ser desligados no Perfil. Desligados por padrão nos widgets.

### Linha de pessoa (listas longas)

Use `PersonRow` para listas de pessoas. Coloque as linhas em um único container `surface`, com divisores finos, sem card por pessoa. Cada linha tem aproximadamente 60 px de altura, padding vertical de 10 px, avatar circular de 40 px (iniciais em `surfaceRaised` quando não houver foto), nome em `bodyStrong` e informação secundária em `caption` (faixa, papel ou status). À direita, use ações circulares de ícone de 40 px ou chevron quando a linha abrir detalhes.
