# Kimi — Design System

Este documento é a referência visual do app e dos widgets. Siga-o em todas as telas. Em caso de conflito com qualquer outra instrução de design, este documento vale.

> Os valores abaixo vivem em [`tokens.json`](tokens.json) (fonte única). Rode `npm run tokens` para gerar `src/theme/tokens.ts`, `widgets/ios/KimiTokens.swift` e `widgets/android/KimiTokens.kt`.

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
| Coral / Vermelha | `#C8242F` | |

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
- Ícone + título heading + uma linha body, e um botão tátil para continuar.
- Usos: check-in enviado, meta de água batida, marco de aulas, nova faixa.

### 3.11 Estados vazios

Mascote em tamanho médio (ou ícone de 48 em text-muted em espaços pequenos), uma frase curta em body e, quando houver ação, um botão secundário. Nenhuma outra ilustração além do mascote.

### 3.12 Rolagem

Sem barras de rolagem visíveis em nenhuma lista ou tela (`showsVerticalScrollIndicator={false}` e equivalentes).

## 4. Mascote e ícone do app

O mascote é um ninja em forma de bloco: cabeça e corpo numa única forma arredondada, faixa laranja como máscara na altura dos olhos, pano do rosto em cinza mais claro, gola de quimono em V, faixa laranja na cintura, punhos e pés em tabi pequenos.

| Parte | Cor |
| --- | --- |
| Corpo | `#2A2C30` |
| Pano do rosto e gola | `#3A3D42` |
| Máscara e faixa da cintura | accent (`#D9400A`) |
| Olhos | `#FFFFFF`, pupilas `#2A2C30` com brilho branco |

- Expressões: **bravo** (padrão: topo dos olhos cortado na diagonal em direção ao centro) e **comemorando** (olhos redondos). Ele não tem boca; toda a expressão está nos olhos.
- Onde aparece: estados vazios, folha de feedback (versão comemorando), onboarding e telas de marco (nova faixa, sequência). Nunca em listas, cards comuns ou na tab bar.
- Tamanhos: 160 em telas de marco e onboarding, 96 em estados vazios, 56 na folha de feedback.
- O mascote pode ter cantos mais arredondados que a interface; essa exceção vale só para ele.
- Arquivos em `assets/brand/` como SVG. Nunca recolorir, distorcer ou adicionar contornos e sombras.

Ícone do app: `assets/brand/kimi-icon.png` (quadrado, sangrado, sem transparência) — recorte do rosto do mascote preenchendo o quadro, com a faixa laranja e os olhos bravos. Exportar sem cantos arredondados (o sistema aplica a máscara) e manter os olhos dentro da área segura do ícone adaptativo do Android.

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
| Erro | Erro (notification error) |

## 8. Movimento

Não implemente animações nem transições. O movimento será adicionado manualmente depois.

- Defina cada estado como um estilo separado: repouso, pressionado, concluído, comemoração.
- Mudanças de estado são instantâneas.
- Marque cada ponto onde haverá movimento com `// TODO(motion): descrição`. Pontos esperados:
  - Botão tátil afundando e voltando
  - Anel de água enchendo após um registro
  - Badge passando de pendente para confirmado
  - Barra de faixa avançando
  - Número da contagem regressiva virando
  - Entrada e saída da folha de feedback

## 9. Widgets

Os widgets seguem os mesmos tokens, gerados a partir do `tokens.json`, e respeitam claro/escuro do sistema.

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
