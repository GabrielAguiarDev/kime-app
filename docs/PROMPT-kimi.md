# Prompt — Criação do app Kimi

Você vai construir o **Kimi**, um app mobile para academias de artes marciais. O projeto tem dois objetivos: ser um app funcional e servir de estudo aprofundado sobre **widgets** (iOS e Android). Trabalhe em fases (seção 9), confirme comigo ao final de cada fase e não tome decisões de produto que não estejam descritas aqui sem perguntar antes.

---

## 1. Visão geral

Plataforma multi-academia. Cada academia tem professores e alunos. Alunos consultam horários, fazem check-in nas aulas e acompanham quantas aulas já fizeram. Um grupo especial, os **competidores**, só entra por convite do professor e ganha acesso a campeonatos, plano de água semanal e plano de dieta, todos definidos individualmente pelo professor.

Repositório: `kimi-app`

## 2. Stack

- **App:** Expo (React Native) com TypeScript, Expo Router.
- **Widgets:** nativos. iOS em SwiftUI + WidgetKit (target de extensão, ex. via `@bacons/apple-targets`). Android em Kotlin + Jetpack Glance (via config plugin do Expo).
- **Backend:** Supabase (Auth, Postgres, Row Level Security, Realtime quando útil).
- **Dados locais:** armazenamento compartilhado entre app e widgets — App Group no iOS, SharedPreferences/DataStore no Android — com sincronização para o Supabase.

## 3. Papéis e permissões

Um usuário se vincula a uma academia por meio de um **Vínculo** com um papel:

- **Aluno:** vê horários, faz check-in, vê suas aulas confirmadas, sua faixa e sua meta de água automática.
- **Competidor:** tudo do aluno + campeonatos vinculados, plano de água semanal e plano de dieta definidos pelo professor.
- **Professor:** gerencia horários, confirma/recusa check-ins, convida alunos para competidores, cadastra campeonatos, define planos de água e dieta por atleta, acompanha registros de água e peso dos competidores.

Todo dado é isolado por academia. Implemente isso com RLS no Supabase desde a primeira migration — nenhum usuário pode ler dados de uma academia à qual não está vinculado.

## 4. Funcionalidades

### 4.1 Aulas e check-in
- Professor cadastra horários recorrentes (dia da semana, hora, modalidade).
- Aluno faz check-in em uma aula do dia → status `pendente`.
- Professor vê a lista de pendentes por aula e marca `confirmado` ou `recusado`.
- **Só check-ins confirmados contam** para total de aulas, sequência e progressão de faixa.

### 4.2 Progressão
- Total de aulas confirmadas sempre visível.
- Faixa atual do aluno e barra de "aulas até a próxima graduação" (o professor define a meta de aulas por faixa na academia).
- **Sequência semanal**, não diária: conta semanas consecutivas com pelo menos um check-in confirmado.

### 4.3 Água (todos os usuários)
- Usuário informa peso e altura no perfil. A meta diária automática é calculada a partir disso (padrão: 35 ml por kg; deixe a fórmula isolada em uma função fácil de ajustar).
- Usuário configura o tamanho da sua garrafa em ml (ex. 500). **Sem garrafa configurada, o widget de água não funciona** e mostra um estado vazio que abre o app direto na tela de configuração.
- Cada consumo é salvo como **evento** (timestamp + ml), nunca como um total acumulado. O total do dia é calculado a partir dos eventos no fuso local do usuário, o que resolve o reset à meia-noite.
- Botão de desfazer o último registro no app.

### 4.4 Competidores
- **Plano de água semanal:** o professor define a quantidade em ml para cada dia da semana de um atleta. Regra: se existe plano do professor para hoje, ele substitui a meta automática; senão, vale a automática.
- **Plano de dieta:** cadastro diário de refeições definido pelo professor para cada atleta. Sem widget por enquanto.
- **Registro de peso:** o atleta registra o peso; o professor vê o histórico.
- **Campeonatos:** professor cadastra o campeonato (nome, data, local) e vincula atletas. O atleta vê a contagem regressiva no app e no widget.

## 5. Modelo de dados (ponto de partida)

- `academias`
- `usuarios` (perfil: nome, peso, altura, tamanho da garrafa)
- `vinculos` (usuario, academia, papel, faixa atual) — um usuário pode ter vínculos com mais de uma academia
- `faixas_meta` (academia, faixa, aulas necessárias)
- `horarios_aula` (academia, dia da semana, hora, modalidade)
- `checkins` (aluno, horário, data, status, confirmado_por, confirmado_em)
- `registros_agua` (usuario, timestamp, ml)
- `planos_agua` (atleta, academia, semana, ml por dia da semana)
- `planos_dieta` (atleta, academia, data, refeições)
- `registros_peso` (atleta, data, peso)
- `campeonatos` (academia, nome, data, local)
- `inscricoes` (campeonato, atleta)

Ajuste o modelo se encontrar algo melhor, mas explique a mudança antes.

## 6. Widgets

### 6.1 Widget de água (interativo)
- Mostra total bebido hoje / meta do dia e um progresso visual.
- Botão "+ {garrafa} ml" que registra o consumo **sem abrir o app**.
- iOS: iOS 17+, `Button(intent:)` com um `AppIntent` que grava o evento no App Group e recarrega a timeline.
- Android: Glance com `actionRunCallback` que grava o evento e chama `update()`.
- **Offline-first:** o toque grava localmente na hora; a sincronização com o Supabase acontece depois, pelo app ou em background. O widget nunca depende de rede para responder.
- O mesmo `AppIntent` deve ser reutilizável depois em Atalhos/Siri e controles da Central de Controle.

### 6.2 Widget de contagem regressiva (estático, só competidores)
- Mostra dias até o próximo campeonato vinculado.
- Timeline com uma entrada por dia, virando à meia-noite.
- Sem campeonato vinculado: estado vazio discreto.

## 7. Design

**A especificação completa está em `DESIGN-SYSTEM.md` (tokens, componentes, tom de voz, widgets). Ela tem prioridade sobre o resumo abaixo.**

Inspirado no Duolingo — interativo, com retorno claro a cada ação — mas **adulto e esportivo, nada infantil**.

- **Manter:** botões "táteis" (borda inferior mais escura que some ao pressionar), progresso sempre visível, momentos de recompensa (check-in confirmado, meta de água batida, marcos de aulas), haptics nesses momentos.
- **Evitar:** traço infantil e caricato, paleta arco-íris saturada, ilustrações além do mascote, formas em pílula, textos fofinhos. O mascote ninja é parte da identidade (seção 4 do design system).
- **Base neutra** com uma única cor de destaque forte. A cor da faixa do aluno pode personalizar o perfil dele.
- **Tipografia:** sans bold, preferencialmente condensada, para números grandes (ml, dias, aulas).
- **Cantos levemente arredondados** em toda a interface.
- **Sem barras de rolagem visíveis** — rolagem só por gesto.
- **Tab bar só com ícones, sem texto**, variando por papel:
  - Aluno: Início, Aulas, Perfil
  - Competidor: Início, Aulas, Competição, Perfil
  - Professor: Início, Alunos, Confirmações, Perfil
- Design tokens com tema claro e escuro.

### Animações
**Não implemente animações.** Eu adiciono o movimento manualmente. Em vez disso, defina cada estado visual separadamente (repouso, pressionado, concluído, comemoração) e marque os pontos de movimento com `// TODO(motion): descrição`. Pontos esperados: garrafa enchendo, check-in passando de pendente para confirmado, barra de faixa avançando, número da contagem regressiva virando.

## 8. Requisitos gerais

- TypeScript estrito; código e nomes técnicos em inglês, interface em português (pt-BR).
- Dados de saúde (peso, planos) tratados como sensíveis: acesso restrito ao próprio atleta e aos professores da academia vinculada.
- README explicando como rodar o app, os widgets em cada plataforma e as migrations.

## 9. Fases

1. **Fundação:** projeto Expo, Supabase, auth, academias, vínculos, papéis, RLS, navegação por papel e design tokens.
2. **Aulas:** horários, check-in, confirmação pelo professor, total de aulas, faixa e sequência semanal.
3. **Água + widget de água:** perfil com peso/altura/garrafa, meta automática, registros como eventos, armazenamento compartilhado, widget interativo iOS e Android, sincronização.
4. **Competidores + widget de contagem:** convite, campeonatos, inscrições, plano de água semanal, registro de peso, widget de contagem regressiva.
5. **Dieta:** cadastro e visualização do plano de dieta diário.
6. **Polimento:** estados vazios, erros, acessibilidade e revisão dos pontos `TODO(motion)`.

Ao final de cada fase, resuma o que foi feito, o que ficou pendente e qualquer decisão que você precisou tomar.
