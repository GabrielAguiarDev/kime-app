# Kimi — Contexto de Desenvolvimento

> Arquivo mantido pelo agente mobile-senior-dev. Leia isto antes de continuar o desenvolvimento.
> Última atualização: Backlog — ofensivas — 2026-11-04

## 1. Visão geral

App mobile multi-academia de artes marciais (a spec completa do usuário está na conversa inicial; aqui vai o resumo).

- **Papéis por vínculo usuário↔academia:** owner (exatamente um por academia), professor e aluno. Competidor é uma flag do aluno (fase 4). A escolha "Sou aluno / Sou professor" na abertura é só o caminho de entrada, não um tipo de conta.
- **Funcionalidades:**
  - horários + check-in (pendente → confirmado/recusado pelo professor);
  - progressão (total de aulas, faixa, sequência SEMANAL);
  - água (meta automática 35 ml/kg, eventos, widget interativo);
  - competidores (campeonatos + widget de contagem, plano de água semanal, dieta, registro de peso).
- **Objetivo duplo:** app funcional + estudo de widgets nativos (iOS WidgetKit / Android Glance).

## 2. Stack & decisões

- **Expo SDK 58 (prebuild / dev client) + Expo Router + TS strict.** Decisão do usuário: a spec pede Expo, a persona pedia RN bare. O prebuild é obrigatório por causa dos targets nativos de widget. O React Navigation vem embutido no `expo-router` no SDK 58: importar `Tabs`, `Stack`, `ThemeProvider`, `DarkTheme` e `SplashScreen` de `expo-router`.
- **Arquitetura padrão da persona por dentro:** restyle, domínio `Api/Adapter/Service/Types` + useCases com react-query, aliases `@`. O "Api" de cada domínio usa o cliente Supabase, sem axios.
- **Supabase hospedado** (projeto `Kimi`, ref `pdadeczycrroqngrjhab`, linkado) + stack local para testes (Docker/OrbStack).
  - CLI `supabase@3.0.0` como devDependency (`npx supabase ...`). Versões fixas, lockfile = `package-lock.json` (npm).
  - Migrations em `supabase/migrations` (uma por assunto), testes pgTAP em `supabase/tests/database`.
  - No painel: Data API ligada, tabelas novas NÃO expostas automaticamente e RLS automático. Toda tabela precisa de `grant` + políticas na migration.
- **Sessão Supabase:** cliente em `lib/supabase.ts`. Sessão no `expo-secure-store` em chunks (`infra/storage/chunkedStorage.ts`, ≤ 1600 bytes por item, manifesto gravado por último). Auto-refresh ligado ao `AppState` pelo `SessionProvider`. Só URL + publishable key no app.
- **Preferências locais** (academia ativa, código confirmado antes do login, caminho de entrada): `expo-sqlite/kv-store` (síncrono), em `infra/storage`.
- **Design:** segue o `DESIGN-SYSTEM.md` (raiz). Ele vale sobre qualquer outra instrução de design.
  - **Tokens:** `tokens.json` é a fonte única. `npm run tokens` gera `src/theme/tokens.ts`, `targets/widgets/KimiTokens.swift` (widget iOS) e `modules/kimi-widget/android/.../KimiTokens.kt` (widget Android); `npm run tokens:check` falha se estiverem desatualizados (rode antes de commitar). Nunca escrever cor/tamanho solto no código: usar o tema (`useAppTheme()`, props do restyle).
  - **Destaque laranja** `accent` `#D9400A` (escuro `#F05A1E`). O vermelho antigo (`#E10600`) saiu.
  - **App só no tema escuro** (decisão do usuário, 2026-11-04). `useSchemeTheme()` devolve sempre `darkTheme` e `userInterfaceStyle` é `dark` no `app.json`. A opção Perfil → Aparência foi removida; o `lightTheme` continua nos tokens para uma volta futura.
  - **Fontes:** Barlow Condensed (display/título) + Inter (texto). Todas as variantes de texto usam `tabular-nums`.
  - **Ícones:** Phosphor (`phosphor-react-native`, importado ícone a ícone em `components/Icon`); `bold` normal, `fill` ativo. Para um ícone novo, adicionar ao mapa `ICONS`.
  - **Edges `success`/`warning`/`danger`** não estão no documento: foram derivadas a 25% mais escuras, como ele manda.
- **Ícone e mascote:** fontes em `assets/brand/`: `kimi-icon.svg` (fonte oficial do ícone) e `kimi-icon-{light,dark,tinted}.png` (1024×1024, sem alpha, fornecidos pelo design). O antigo `kimi-icon.png` (1254 px, gerado por IA, com ruído) foi apagado em 2026-11-04 e não deve voltar. O ícone de topo do `app.json` é o `kimi-icon-light.png`. Mascote: `kimi-mascot.svg` = bravo, `kimi-mascot-celebrating.svg` = olhos redondos. Ícone adaptativo do Android: primeiro plano = `kimi-icon-light.png` a 72% (os olhos ficam a 0,302 do centro, contra 0,305 da área segura), fundo = `backgroundColor` #24262B. O monocromático sai da faixa laranja do mesmo PNG. O app renderiza os SVGs do mascote com `expo-image` (`<Mascot size="hero|empty|feedback" />`). Os PNGs de ícone/splash são gerados por `scripts/brand/render-icons.sh` (macOS); depois, `npx expo prebuild`. Mascote só em estados vazios, folha de feedback, onboarding e telas de marco.
- **Teclado:** o rodapé do `Screen` NÃO sobe com o teclado (decisão do usuário). Sem `KeyboardAvoidingView`: só a área rolável abre espaço (`automaticallyAdjustKeyboardInsets`), e no Android `softwareKeyboardLayoutMode: pan`.
- **Ícone iOS com aparências (2026-11-04):** `ios.icon` no `app.json` aponta para `assets/brand/kimi-icon-{light,dark,tinted}.png` (1024×1024, sem alpha, fornecidos pelo usuário). Sem as variantes, o iOS gerava sozinho a versão escura, com manchas. O `icon` de topo continua valendo para Android/web. O SDK 58 também aceita um `.icon` do Icon Composer em `ios.icon`. O `scripts/brand/render-icons.sh` NÃO gera essas variantes: ele só gera as camadas do Android, o favicon e o splash a partir delas. Depois de trocar qualquer ícone, rode `bash scripts/brand/render-icons.sh` e `npx expo prebuild --clean`.
- **Sem animações** (o usuário faz o movimento). Cada estado visual fica separado, com `// TODO(motion): ...`.
- **Ambiente:** Node 22, npm 10, Xcode 26.6, Docker OK, simulador "iPhone 17 Pro". **Android SDK ausente** na máquina.

## 3. Estrutura & convenções específicas deste projeto

```
src/
  app/                  rotas Expo Router (arquivos finos, reexportam telas)
    _layout.tsx         providers + Stack.Protected por estado (ver abaixo)
    index.tsx           "/" sem guard: <Redirect> para /sign-in, /welcome ou /home
    (auth)/             start (Sou aluno / Sou professor), codigo (fluxo do código deslogado), sign-in, sign-up (telas separadas; card da academia no topo quando há código), verify-email
    (onboarding)/       welcome (espera / recusado / sem academia), create-gym
    (tabs)/             home, classes, competition, students, confirmations, profile (cada uma: pasta com _layout Stack + index)
    entrar.tsx          código → confirmação da academia; sempre acessível; deep link kimi://entrar?codigo=XXXXXXXX
  screens/{auth,entry,onboarding,app,professor,student,water,competition}/
  domain/{Auth,Gym,Membership,Profile,Classes,Water,Competition}/  xApi, xAdapter, xService, xTypes, xRules, useCases/, index
  infra/                env, supabase (client, database.types gerado, supabaseError), query, storage, widget (sharedStore)
  services/             session/, activeGym/, entry/ (entryPath, pendingCode, useConsumePendingCode), confirm/, water/ (sync, config do widget, folha de meta, plano do professor), competition/ (widget de contagem)
  components/           Box, Text, Icon, Button (tátil), TextButton (fantasma), TextField, Screen, Card,
                        EmptyState, Mascot, ProgressBar, WaterRing, BigCounter, StatusBadge, BeltChip, FeedbackSheet
  theme/                tokens (GERADO), fonts, theme (light/dark), useAppTheme, useSchemeTheme, useIsDark
  utils/                deepLinks, haptics
scripts/tokens/            gerador de tokens (TS/Swift/Kotlin)
scripts/brand/             renderização dos PNGs de ícone/splash a partir dos SVGs
targets/widgets/           extensão iOS (WidgetKit) via @bacons/apple-targets: Swift, Info.plist, fontes em assets/, tokens GERADOS
modules/kimi-widget/       módulo nativo local: armazenamento compartilhado (iOS/Android) + widget Glance (Android) + tokens Kotlin GERADOS
```

- **Aliases:** `@components`, `@domain/*`, `@infra`, `@screens/*`, `@services/*`, `@theme`, `@utils/*`. Estão no tsconfig (o Metro lê) e no `jest.moduleNameMapper`.
- **Guard de rotas central** (`src/services/access/routeAccess.ts`, usado pela raiz `src/app/_layout.tsx` e pelo `src/app/index.tsx`): a ÚNICA regra de acesso.
  - deslogado (`signedOut`) → só o fluxo de entrada `(auth)`; home `/start`;
  - logado sem vínculo APROVADO (`awaitingApproval`) → `(onboarding)` (espera, criar academia); home `/welcome`;
  - logado com vínculo aprovado (`member`) → `(tabs)` e todas as telas do app (água, conquista…); staff/owner somam o papel da academia ativa.
  - Todo `Stack.Protected` usa `redirectTo={access.home}` (SDK 58): navegação interna, deep link, widget ou notificação caem na home do estado. `entrar` (código → academia) é parte do fluxo de entrada e fica acessível em qualquer estado.
  - `src/app/+native-intent.tsx` (`normalizeExternalPath`): links de fora só abrem `/`, `/entrar`, `/agua`, `/agua/configurar`; qualquer outro vira `/`. Ele não decide acesso (roda fora do React).
  - Widget: o app só publica `water.config` com login + vínculo aprovado (`useWidgetConfig`); sem config, o widget mostra "Entre no Kimi para registrar sua água." sem o botão, e o toque abre `kimi://`. Limitação conhecida: se o acesso mudar com o app fechado (removido da academia, sessão expirada), o widget só atualiza na próxima abertura do app.
  - A splash fica só no BOOT (fontes ou erro de fonte + sessão + vínculos). Depois do boot, o Stack nunca desmonta, e as telas mostram o próprio loading.
- **Tabs por papel** (`(tabs)/_layout.tsx`, `Tabs.Protected`), só com ícones:
  - aluno: Início, Aulas, Perfil;
  - competidor: + Competição;
  - staff (owner ou professor), desde 2026-11-05: **Início · Aulas · Timer · Equipe · Perfil**. Confirmações e Alunos saíram (ver "Reestruturação do staff"). A aba Aulas é a mesma rota para os dois papéis (`(tabs)/classes/index.tsx` escolhe a tela pelo papel); o Timer é aba do staff e fica escondido da barra do aluno (`href: null`), que o abre pelo link de Aulas.
- **Owner × professor na UI:** `useActiveGym()` expõe `isStaff`/`isOwner`. O que é só do owner NÃO aparece para o professor (nada de botão desativado). `academy/settings` e `academy/belts` ficam num `Stack.Protected` com `isOwner`, e `academy/schedules` e `member/[id]` com `isStaff`.
- **Academia ativa:** `ActiveGymProvider` resolve com `resolveActiveMembership` (a guardada no kv-store se ainda ativa, senão a primeira ativa). Troca no Perfil.
- **Erros:** services fazem `throw toAppError(e)`. As RPCs levantam códigos de máquina (`invite_invalid`...) como mensagem da exception. A UI usa `errorMessage(e)` (pt-BR) de `@infra`.
- **Tipos do banco:** `npm run db:types` (gera `types/database.ts` do remoto) após cada `db push`. `src/infra/supabase/database.types.ts` só reexporta.
- **Header nativo (2026-11-04, padrão WhatsApp):** abas e telas internas usam o header do Stack nativo, configurado em UM lugar (`useNativeHeaderOptions`, `components/NativeHeader`).
  - iOS: `headerLargeTitleEnabled`, `headerTransparent`, `headerLargeStyle` transparente (repouso sem barra nem desfoque), `headerBlurEffect: systemChromeMaterialDark` (só na barra compacta), sem sombras, altura padrão; título grande Barlow Condensed (`navLargeTitle`, 34) e compacto Inter SemiBold 17 (`navTitle`) centralizado; cores dos tokens. O conteúdo passa por baixo da barra com desfoque; a transição é do sistema (exceção autorizada à regra de sem animações).
  - Android (por enquanto): header compacto padrão, título à esquerda, fundo `bg`.
  - Cada aba é uma pasta com o próprio Stack (`(tabs)/<aba>/_layout.tsx` + `index.tsx`). As telas internas do Stack da raiz (`academy/*`, `member/[id]`, `agua/*`) recebem `options={header}`. Entrada, onboarding e conquista continuam sem header.
  - `<Screen nativeHeader title=… onBack=… topAction=… headerLeft/headerRight>`: escreve as opções da rota (`Stack.Screen`, só `title` em texto, nunca `headerTitle` customizado) e o ScrollView é a RAIZ nativa da tela (o react-native-screens procura o scroll pela cadeia do primeiro filho; sem isso o título grande não recolhe). `contentInsetAdjustmentBehavior="automatic"`, SEM `flexGrow` (com os recuos automáticos ele deixava telas curtas rolando pela altura do header + tab bar), sem SafeAreaView nem padding de topo. Rodapé/folha de feedback flutuam por cima (irmão posterior, fundo `bg`) e o conteúdo ganha espaço embaixo. Botões do header: `HeaderButton` (ícone Phosphor, sem fundo próprio; o iOS 26 põe o círculo de vidro). Voltar = `HeaderButton` "back".
  - Início (decisão do usuário, 2026-11-04): sem título e sem título grande (`largeTitle={false}`); à esquerda, logo + nome da academia num só botão (abre o Perfil; token `headerLogo`), contador de água à direita (aluno e staff; saiu da barra de sequência/aulas do aluno).
- **Área segura (telas sem header nativo):** aplicada UMA vez, no `Screen`, via `SafeAreaView` (`edges={['top']}`), que só acolchoa a parte da view que está de fato sob a barra de status; o conteúdo começa `s16` abaixo. Nenhum navegador tem header (`headerShown: false` em todos).
- **Componentes:** `Screen` sempre esconde as barras de rolagem e recebe `footer` para a ação primária fixa, ou `feedback` para a `FeedbackSheet`. Dentro das tabs, usar `bottomInset={false}`. `Button` e `Card` tocável disparam o haptic leve sozinhos. `EmptyState` usa o mascote (96) por padrão e `visual="icon"` (48) dentro de cards/seções.

## Decisões da Fase 2 (usuário, 2026-11-04)

- Spec completa em `docs/PROMPT-kimi.md`; `DESIGN-SYSTEM.md` da raiz continua a referência (seção 11 incorporada de `docs/DESIGN-SYSTEM.md`).
- Meta da faixa conta aulas confirmadas desde a última graduação (`belt_history.awarded_at`); o total geral aparece separado.
- Marcos de aulas: 10, 25, 50, 100 e depois a cada 100. Nova faixa também abre a tela de conquista.
- "Hoje" das aulas = data local da academia (`academies.timezone`). Água usa o fuso do perfil.
- Botões fantasma em `accent`; `danger` só em "Sair da conta" e ações destrutivas. `textMuted` saiu do `GhostColor`.
- Estados vazios: mascote nos de tela inteira (Início, Confirmações, Alunos); ícone só em espaço pequeno (dentro de cards/listas).
- Mascote: segue o DESIGN-SYSTEM.md (o "evitar mascote" do PROMPT-kimi.md era da primeira versão e foi corrigido).
- Bottom sheet (3.13) é a única exceção à regra de "sem animações" (Reanimated + Gesture Handler).
- **Fase 4 — competidor por convite aceito:** o professor envia o convite; o aluno vê um aviso de que, ao aceitar, o professor passa a ver peso, registros de água e planos de dieta, e aceita ou recusa. `is_competitor` só vira true após o aceite, com a data registrada. O professor pode tirar o aluno da equipe a qualquer momento e o aluno pode sair sozinho. Implementado na Fase 4 (ver mapa).

## Entrada no app, códigos e papéis (2026-11-04, substitui os convites por link)

- **Papéis:** `membership_role` = `owner | professor | student`.
  - staff (owner ou professor): check-ins, pedidos de ALUNO, horários, faixa de alunos, competidores, campeonatos, água e dieta;
  - só owner: academia (nome, logo, código de aluno, modalidades, faixas), códigos de professor, aprovar/remover professores, remover alunos, transferir a academia. Mensalidades e assinatura também serão só do owner quando existirem.
  - **Só alunos treinam no app** (2026-11-04): owner e professor não fazem check-in (policy exige `private.is_student`), não têm contagem de aulas (as views filtram `role = student`), trilha nem faixa. O detalhe de um owner/professor mostra só foto, nome e papel.
  - Helpers: `private.is_owner`/`private.is_staff` (o `is_professor` foi removido). `is_staff_of_member`, `is_staff_of_competitor` e `is_competitor_of` olham staff.
- **Invariantes no banco:**
  - um owner por academia (índice único parcial `memberships_one_owner_idx`);
  - nunca sem owner (constraint triggers adiados `academies_need_owner`/`memberships_keep_owner`, checados no commit);
  - owner sempre ativo.
  - `role` não tem grant de coluna: só muda por `transfer_ownership` (owner → professor ativo; o antigo vira professor) e pelo fluxo de entrada.
  - Qualquer um sai da academia (delete do próprio vínculo), menos o owner.
  - Faixa: staff define a de ALUNOS ativos (por modalidade); ninguém dá faixa a owner/professor.
  - Staff não confirma o PRÓPRIO check-in.
  - O professor não lê pedidos de professor pendentes/recusados (nem o perfil de quem pede); só o owner lê.
  - Código revogado ou usado não volta (trigger `guard_professor_code_update`).
  - `join_with_code` serializa por usuário + academia (advisory lock), para dois códigos enviados juntos não serem gastos num pedido só.
- **Códigos** (8 caracteres sem 0/O/1/I/L, namespace único entre aluno e professor):
  - aluno = `academies.invite_code`, fixo; o owner pode gerar outro (`regenerate_student_code`) e os pedidos já enviados continuam valendo;
  - professor = tabela `professor_codes`: uso único, 7 dias, owner gera (`create_professor_code`, máximo de 20 ativos), lista e revoga (update `revoked_at`). Expirado, usado ou revogado se comporta como código inexistente.
  - `lookup_invite_code(code)` → nome, logo e tipo. É a ÚNICA função com EXECUTE para `anon`, e o retorno é vazio para qualquer código inválido.
  - `join_with_code(code)` → `(membership_id, academy_id, status, is_new)`. Quem já é membro ativo/pendente recebe o vínculo existente (`is_new = false`), sem duplicar e sem gastar o código de professor. O app mostra "Você já faz parte da …" (ativo) ou "Seu pedido para a … já está aguardando aprovação." (pendente).
  - `academy_invites`, `request_membership`, `get_invite_preview`, `rotate_invite`, `join_academy` e `get_academy_preview_by_code` foram removidos.
- **Fluxo de entrada (app):**
  - `/start` → "Sou aluno" (`/codigo`, dentro do `(auth)`) ou "Sou professor" (`/sign-in`), escolha salva em `entryPath` (só ordena opções/textos). Deslogado, o app SEMPRE abre na `/start` (decisão do usuário, 2026-11-04).
  - `EnterCodeScreen` em duas rotas: `/codigo` (deslogado, mesmo stack do `(auth)`: usa `push`) e `/entrar` (logado + deep links, fora dos guards). Fluxo: código → "É essa a sua academia?".
    - Deslogado: "Sim" grava `pendingCode` (expira em 24 h e é apagado no logout) e vai para cadastro/login: `push` em `/codigo`, `replace` em `/entrar`.
    - Logado: chama `join_with_code` na hora e FECHA a tela (`router.back()`), nunca `replace('/')`, que duplicaria o grupo de baixo no stack. Se já for membro ativo, faz `selectGym`.
    - Código do outro tipo → aviso + "Continuar como …" (mantém o código).
  - Login e cadastro voltaram a ser telas separadas (decisão do usuário: nada de alternância no topo nem link "Sou aluno"; para trocar de caminho, o usuário volta). Com `pendingCode`, o card da academia aparece no topo (`usePendingAcademy`). O `useConsumePendingCode` (RootNavigator) envia o pedido depois do login.
  - `welcome`:
    - pedido pendente → espera (logo, nome, mascote; refetch a cada 15 s e ao voltar para o app);
    - só recusado → aviso + "Digitar outro código";
    - sem vínculo → opções de professor ou de aluno conforme o `entryPath`.
  - "Criar academia" passa por `canCreateAcademy()` (`domain/Gym/gymRules.ts`), o ponto isolado para a futura assinatura.
  - Perfil → "Entrar em outra academia" (`/entrar` logado). Pedido pendente aparece em Academias com o badge "Aguardando aprovação" e "Cancelar pedido" (delete do próprio vínculo); nunca é selecionável. Recusado some da lista e mostra um aviso UMA vez (Perfil ou Início), via `services/joinRequests`: como a academia recusada deixa de ser legível (RLS), o nome é guardado no aparelho enquanto o pedido está pendente (kv-store `joinRequests`, por usuário; um novo pedido recusado de novo tem outro `decided_at` e avisa de novo). "Sair de {academia}" não aparece para o owner.
- **Foto de perfil** (2026-11-04): bucket PRIVADO `avatars`, pasta por usuário (`<user_id>/avatar-<ts>.jpg`, arquivo novo a cada troca; o antigo é apagado). Escrita só na própria pasta; leitura pelo próprio usuário e por owner/professores das academias em que ele tem vínculo (`private.is_staff_of_member`), sempre por URL assinada (1 h; `useAvatarUrl`, cache do `expo-image` por caminho). Perfil: avatar grande (iniciais sem foto) → Tirar foto / Escolher da galeria / Remover; recorte quadrado no picker, 512×512 JPEG (`utils/squareImage.ts`, o mesmo da logo). Nome editável abaixo do avatar e e-mail em texto secundário; seções Academias, Gestão da academia e Conta (a seção Água saiu em 2026-11-04, decisão do usuário: água fica no contador do topo da Início e na engrenagem da tela de Água).
- **Logo:** só o owner envia (RLS do storage). O app gera 512×512 JPEG. Sem logo: iniciais em `accent` sobre `surfaceRaised`, `radius-md`. A logo aparece no topo da Início, com o nome ao lado.
- **Seed:**
  - `dono@kimi.dev` (owner), `professor@kimi.dev` (professor, papel `instructor`) e `aluno@kimi.dev`;
  - modalidades Jiu-Jitsu (com faixas Branca→Preta), No-Gi e Open mat (sem faixas); o aluno tem a branca há 6 semanas e ~12 aulas de Jiu-Jitsu + ~6 de No-Gi confirmadas depois dela;
  - código de aluno `KMJJ2526`, de professor `PRF2526K`.

## Modalidades e faixas (2026-11-04, substitui `belt_goals` e `memberships.belt`)

- `academy_modalities` (nome, posição, `uses_belts`), cadastradas pelo owner em Perfil → Gestão da academia → **Modalidades** (`academy/modalities`: cards com nome, status, lixeira, Editar e Faixas; "Adicionar modalidade" fixo na base). Saíram das Configurações da academia. Professor não edita modalidades nem faixas.
- `class_schedules.modality_id` aponta para uma modalidade cadastrada (FK composta com `academy_id`, `on delete restrict`: modalidade com horários não pode ser removida). A coluna de texto saiu; a migration criou as modalidades a partir dos textos antigos. Na tela de horários, a modalidade é escolhida entre as cadastradas (sem "Outra").
- `checkins.modality_id`: carimbado por trigger a partir do horário no check-in (sobrevive à exclusão do horário e a uma troca de modalidade do horário).
- `modality_belts`: sequência por modalidade com cores como CHAVES da paleta 2.4 (`primary_color` + `tip_color` opcional: white, gray, yellow, orange, green, blue, purple, brown, black, red; migration `20261104230000`). Nome e cores são derivados (`beltName`: "Vermelha", "Vermelha/ponta preta", sempre no feminino). Uma combinação por modalidade. Lista de faixas compacta (uma linha: faixa, nome, aulas, ícones de editar e lixeira); a ordem é feita em `academy/belts-order?modalidade=<id>` (botão no canto superior direito), segurando e arrastando (`ReorderList`: Gesture Handler 3 + Reanimated 4; a linha segue o dedo, as outras trocam de lugar sem animação, `TODO(motion)` no pegar/soltar; ações de acessibilidade "Mover para cima/baixo") e salvando com `reorder_modality_belts`. `classes_required` = aulas na faixa anterior para receber esta; na primeira faixa, aulas do aluno sem faixa (decisão do usuário, 2026-11-04: o campo aparece e é obrigatório em TODAS as faixas; a ideia de faixa de entrada sem número foi descartada). A coluna segue anulável só por dados antigos: a migration `20261104230000` zerou o número da primeira faixa de cada sequência, e a lista mostra "Defina as aulas necessárias" até o owner preencher. Cores: as 10 da paleta + 10 variações claras/escuras (decisão do usuário, 2026-11-04; tokens `belt*`, DS 2.4 "Variações", migration `20261104240000`). Sheet: prévia grande; switch "Adicionar ponta" que mostra duas caixas "Faixa" / "Ponta" (escolhem a parte que a grade pinta); UMA grade com as 20 cores em quadrados de 44pt (alvo mínimo de toque), agrupadas por família (`BELT_PICKER_ORDER`), quebrando linha conforme a largura; a ponta não oferece a cor da faixa; Salvar fixo. `BeltSwatch`/`BeltChip` desenham a ponta nos últimos 25% em todo o app. Faixa já entregue não pode ser removida (FK do histórico). Tela `academy/belts?modalidade=<id>`.
- `belt_history` (`membership_id`, `belt_id`; `modality_id` vem da faixa por trigger): a faixa atual do aluno em cada modalidade é a última entrega nela.
- Views (`security_invoker`, só alunos): `membership_class_stats` (total confirmado em todas as modalidades) e `modality_class_stats` (por aluno × modalidade: faixa atual, total na modalidade e confirmadas na modalidade DEPOIS do dia da última graduação nela).
- App: aba Aulas com seletor no topo quando o aluno treina mais de uma modalidade (`trainedModalities`: aula confirmada ou faixa; sem nenhuma, todas); modalidade sem faixas mostra só o total dela; a barra do topo usa a faixa mais recente entre as modalidades. "Definir faixa" escolhe modalidade e faixa. Cores de faixa vêm dos tokens `belt*` pela chave (`BELT_COLOR_TOKEN`); branca e preta ganham borda `border`.
- Dados existentes (migration `180004`, testada contra dados antigos): as `belt_goals` e o histórico de cada academia foram para a primeira modalidade dela (nomes/cores da paleta 2.4), que fica com faixas; `memberships.belt` sem histórico ganhou uma linha de histórico antes do drop; academia com faixas e sem modalidade ganha a modalidade "Geral"; check-ins de horários já apagados vão para a primeira modalidade; modalidades criadas a partir dos textos dos horários ficam SEM faixas. A graduação só aceita faixa de modalidade com `uses_belts`.
- A contagem para a próxima faixa conta as aulas DEPOIS do dia da graduação (o texto do app diz "a partir de amanhã").

## Aulas dadas e professor da aula (2026-11-04)

- `class_sessions`: uma linha por aula dada (horário + data), criada pelo banco quando o PRIMEIRO check-in dela é confirmado (trigger `checkins_ensure_session`, SECURITY DEFINER), com o proprietário atual como professor padrão. Sobrevive à exclusão do horário (`schedule_id` vira null). Clientes não inserem; staff lê e troca só `instructor_id` (trigger `guard_session_instructor`: precisa ser owner/professor ATIVO da academia → `instructor_invalid`).
- `instructor_class_stats` (view `security_invoker`): aulas dadas por owner/professor ativo = sessões em que ele é o professor.
- App: em Confirmações, quando todos os check-ins de uma aula foram decididos e pelo menos um foi confirmado, aparece "Professor da aula" com "Trocar" (lista owner + professores). As aulas já dadas hoje continuam listadas mesmo sem pendências. O detalhe de owner/professor mostra "Aulas dadas", e a lista de Alunos mostra a contagem na linha de cada professor.
- Testes: `supabase/tests/database/class_sessions.test.sql` (20). Migration `20261104200000` aplicada no remoto em 2026-11-04 (357 testes passando lá).

## Meus dados (2026-11-04)

- Perfil: avatar com selo de lápis (o toque edita a foto); nome sem lápis e sem e-mail embaixo. Conta → "Meus dados" (`/conta/dados`, header nativo, guard `app`).
- Dados pessoais: nome, sexo (`profiles.sex`: female | male | unspecified), data de nascimento (`profiles.birth_date`, máscara DD/MM/AAAA, sem data futura no app; o banco só limita a 1900+), peso e altura (as mesmas colunas da meta de água). Mesma visibilidade do resto do perfil (o próprio usuário e o staff das academias dele).
- E-mail: `updateUser({ email })` + código de 6 dígitos (`verifyOtp` type `email_change`). Com "secure email change" ligado (`double_confirm_changes`), o app pede também o código do e-mail atual. No painel do Supabase, o template "Change Email Address" precisa usar `{{ .Token }}`.
- Senha: contas com senha confirmam a atual (login com ela) antes de `updateUser({ password })`; contas só Apple definem uma sem a atual.
- Testes: `profile_data.test.sql` (6) e `profileRules.test.ts`. Migration `20261104210000` aplicada no remoto em 2026-11-04 (363 testes passando lá).

## 4. Mapa de progresso (fases)

- [x] 1. Fundação: Expo + Supabase + auth + academias/vínculos/papéis + RLS + navegação por papel + design tokens. **CONCLUÍDA**, aguardando validação do usuário.
- [x] 2. Aulas: horários, check-in, confirmação, total de aulas, faixa, sequência semanal. **CONCLUÍDA**, aguardando validação no aparelho.
  - Professor: `academy/schedules`, `academy/belts` (entrada pelo Perfil → Gestão da academia), `member/[membershipId]` (toque no membro em Alunos), "Check-ins de hoje" em Confirmações, aulas do dia no Início.
  - Aluno: barra do topo + aulas de hoje com check-in + balão do mascote (Início), trilha de graduação e horários da semana (Aulas), recompensas em `services/classRewards` (snapshot por usuário+academia no kv-store: faixa nova > marco > check-in confirmado; primeira abertura não recompensa o histórico), tela `achievement`.
  - Componentes novos: `SelectionCard` (11.5), `MascotBalloon` (11.3), `BottomSheet` (3.13), `ConfirmSheet` + `useConfirm()`.
  - Ajustes pós-Fase 2 (2026-11-04): horários agrupados por horário + modalidade (uma linha por dia no banco; `planScheduleGroup` grava só a diferença; desmarcar um dia DESATIVA). Apagar horário mantém os check-ins (`schedule_id` vira null). Modalidades em `academy_modalities`, escolhidas no cadastro da academia (`create_academy(name, modalities)`).
  - **Configurações da academia** (`academy/settings`, só owner), de cima para baixo (sem a seção de modalidades desde 2026-11-04): logo grande centralizada com selo de lápis (`EditBadge`; toque → Tirar foto / Escolher da galeria). **Logo obrigatória** (2026-11-04): pode ser trocada, nunca removida (trigger `academies_guard_logo_removal` → `logo_required`); academias antigas sem logo seguem com as iniciais até o owner adicionar. nome, Modalidades e faixas, Códigos de convite (saíram da aba Alunos; lá fica um atalho) e, separada no fim, Ações sensíveis (transferir a academia para um professor). **Fuso fixo** `America/Sao_Paulo` (decisão do usuário, 2026-11-04): a coluna `academies.timezone` continua (com esse valor) e o cliente perdeu o grant de update; não há mais escolha no app.
  - **Logo:** bucket PÚBLICO `academy-logos` (decisão do usuário: logo é marca e aparece antes de o aluno entrar). Caminho `<academy_id>/logo-<timestamp>.jpg`, sempre um arquivo novo (sem cache velho de CDN); a antiga é apagada depois. Escrita só pelo professor da academia (RLS em `storage.objects`); limite de 2 MB, só JPEG/PNG/WebP. O app recorta em quadrado (`expo-image-picker`) e reduz para 512 px JPEG (`expo-image-manipulator`).
  - **Prévia antes de entrar:** `get_academy_preview_by_code` (nome + logo) na tela "Entrar com código"; o convite por link também mostra a logo. Testar storage local exige subir a stack COM `storage-api`.
- [x] 3. Água + widget de água: perfil, meta automática, eventos, storage compartilhado, widget interativo iOS/Android, sync. **CONCLUÍDA no código**, aguardando o build do usuário e a validação no aparelho (nada nativo foi compilado pelo agente).
  - **Widgets nativos** (spec: SwiftUI + WidgetKit, Kotlin + Glance), não o `expo-widgets` oficial do SDK 58. Ele roda o widget em JS isolado, sem trabalho assíncrono, e o estudo de widgets nativos é objetivo do projeto.
  - **Contrato app ↔ widgets:** `water.config` + uma chave por registro (`water.log.<id>`), para o app e o widget nunca reescreverem o mesmo valor. Ver README → Widgets.
    - O app é dono da config.
    - O widget só cria registros (`source: widget`, `synced: false`).
    - O app sincroniza (upsert pelo id), apaga os desfeitos e restaura do servidor os das últimas 48 h que faltam no aparelho.
  - **Meta:** `domain/Water/waterGoal.ts` (`dailyGoal`), com 35 ml/kg. O parâmetro `plannedMl` já está pronto para o plano do professor (Fase 4) substituir a meta automática. `useWidgetConfig` publica a meta e a garrafa para os widgets.
  - **Dia:** a data local vem do fuso do PERFIL (`localDate`, via Intl), no app e nos widgets.
  - **Desfazer:** remove o último registro do dia (do app ou do widget). Um registro já enviado vira `deleted` até o próximo sync apagar a cópia do servidor.
  - **Folha "Meta do dia batida.":** uma vez por dia (kv-store com escopo por usuário), na tela de Água ou na Início, se o widget bateu a meta com o app fechado.
  - **Rotas:** `/agua` e `/agua/configurar` (também o destino do estado vazio do widget, e aberta pela engrenagem no canto superior direito da Água: `Screen.topAction`). Ficam num Stack.Protected `signedIn`. O botão "Adicionar widget", a tela de passos e o pedido para fixar o widget no Android saíram (decisão do usuário, 2026-11-04): o widget é adicionado pela galeria do sistema. Contador de água na barra do topo (aluno) e no cabeçalho da Início (staff).
  - **Widget pequeno:** anel e total LADO A LADO no topo, botão na base. Em pé, como na seção 9, não cabe na altura útil de um widget pequeno. Médio: anel à esquerda; total, meta e botão à direita. Tokens novos: `size.widgetRing`, `widgetRingMedium`, `widgetRingStroke`.
  - **Android:** o Glance não aceita fonte customizada (usa a do sistema, com os mesmos tamanhos e pesos). O anel é desenhado em bitmap. A virada do dia usa `AlarmManager.set` (inexato, sem permissão de alarme exato).
  - **iOS:** fontes do design system embutidas na extensão (`UIAppFonts`). Timeline com a entrada atual e outra à meia-noite. `AddWaterIntent` grava no App Group e recarrega a timeline sem abrir o app.
  - **Banco:** nenhuma migration nova (`water_logs` e `profiles` já tinham tudo). 9 testes pgTAP novos (194 no total).
  - **Revisão (2026-11-04), já corrigida:**
    - Desfazer agora SEMPRE grava tombstone (antes, um sync em andamento recriava o registro).
    - O sync confere cada registro depois do upsert e faz mais uma passada se chegar registro durante a execução.
    - Telas de água funcionam offline (`useWaterSettings` cai na config publicada para o widget).
    - Folha de meta compartilhada entre as telas (`useSyncExternalStore`).
    - A chave da query inclui a data, então o dia vira com o app aberto.
    - O Glance lê o armazenamento DENTRO da composição, com `WaterStore.version` (StateFlow) incrementado a cada escrita, no alarme e no `onReceive`.
    - Médio no Android usa `title` para caber em 2 linhas.
  - **Em aberto (baixo):**
    - O anel do Android (bitmap) só troca claro/escuro na próxima atualização.
    - Registros restaurados do servidor perdem a origem "widget" (não há coluna `source` no banco).
    - Registros gravados no fallback (build sem o módulo nativo) não migram para o armazenamento nativo (só afeta dev).
    - Altura do widget Android em launchers com células baixas: conferir no aparelho.
- [x] 4. Competidores + widget de contagem. **CONCLUÍDA no código** (2026-11-04), aguardando `db push`, build novo e validação no aparelho.
  - **Banco** (migrations `20261105000000_competitor_invites`, `20261105000100_competition_plans_and_weight`; 43 testes pgTAP em `competition.test.sql`, 416 no total):
    - `memberships.competitor_invited_at/by` + `competitor_since`. RPCs `invite_competitor` (staff, aluno ativo), `respond_competitor_invite` (o próprio aluno), `remove_competitor` (staff ou o próprio aluno; cancela convite também). O cliente perdeu o grant de update em `is_competitor`. O trigger `memberships_normalize_competitor` mantém as colunas coerentes (sair de ativo/aluno zera tudo; `request_join` reabre limpo). Sair da equipe apaga as inscrições em campeonatos FUTUROS (as passadas ficam como histórico).
    - `weight_logs`: um por atleta e dia (`weight_logs_one_per_day`), o atleta corrige e apaga. **Decisão do agente:** a pesagem mais recente vira o `profiles.weight_kg` (trigger), então a meta automática de água acompanha o peso.
    - `set_water_plan(academia, atleta, int[7])` (INVOKER): grava o plano da semana ATUAL da academia (segunda). **Decisão do agente:** o plano vale a partir da semana dele e continua nas próximas até um mais novo (o professor não precisa refazer toda semana). Índice 0 = domingo, como `class_schedules`. Dia nulo = meta automática.
    - `set_championship_entries(campeonato, atletas[])` (INVOKER): substitui os inscritos; quem já está inscrito não é reinserido (um ex-competidor não bloqueia o salvamento).
  - **Domínio `src/domain/Competition`**: api/service/rules/useCases + `competitionWidget` (dados do widget). Regras puras testadas: `planInForce`/`plannedMlOn`/`plannedMlByDate`, `daysBetween`, `upcoming/pastChampionships`, `countdownLabel`, `weightDelta`, `parseBrDate`.
  - **Meta de água**: `usePlannedWater` (services/water) lê o plano só de quem compete; `useWaterSettings` usa `dailyGoal({ plannedMl })`; a config do widget ganhou `goalsByDate` (próximos 8 dias do plano), lida pelos widgets nativos (`Config.goal(on:)` / `goalOn()`).
  - **Telas**:
    - Staff: Perfil → Gestão → **Campeonatos** (também botão no topo de Alunos): `academy/championships` (próximos com contagem, anteriores, "Novo campeonato") e `academy/championship?id=` (contagem, editar/remover no lápis, inscritos com seleção e "Salvar inscritos"). No detalhe do aluno, seção **Equipe de competição**: convidar / convite enviado + cancelar / competidor (Plano de água, Água e peso, Tirar da equipe). `athlete/water-plan?membershipId=` (7 campos, vazio = automática) e `athlete/progress?membershipId=` (água dos últimos 7 dias contra a meta de cada dia + pesagens). Alunos mostra "convidado para a equipe".
    - Aluno: card do convite na Início → folha com o aviso de privacidade, "Aceitar convite" / "Recusar".
    - Competidor (aba Competição): contagem do próximo campeonato (BigCounter; "HOJE" no dia), próximos, plano de água da semana (hoje em destaque, automática nos dias sem plano), peso (último, variação, histórico; "Registrar" e toque para corrigir/apagar), anteriores e "Sair da equipe".
  - **Widget de contagem** (iOS `targets/widgets/CountdownWidget.swift`, Android `CountdownWidget.kt` + receiver no manifest): pequeno e médio; número, "DIAS", nome e data (médio: + local). Timeline iOS com uma entrada por dia (7 dias); Android com alarme à meia-noite. Toque abre `kimi://competition` (liberado no `normalizeExternalPath`). Chave `competition.championships`, publicada por `useCountdownWidget` (raiz) e apagada para quem não compete.
  - **Em aberto (baixo):** o professor de uma academia vê o plano de outra academia só no cálculo da meta (não edita); a água do atleta para o professor mostra só o que já sincronizou; o seed não tem competidor (teste o convite com `aluno@kimi.dev`).
- [x] 5. Dieta. **CONCLUÍDA no código** (2026-11-04), aguardando `db push` e validação no aparelho.
  - **Banco:** as tabelas `diet_plans` (um por atleta, academia e dia) e `diet_plan_meals` já existiam com RLS desde a fundação. Migration `20261105000200_diet_rpcs`: `save_diet_meal` (cria o dia se preciso; refeição nova vai para o fim; editar só no próprio dia) e `copy_diet_day` (substitui as refeições do dia de destino; copiar um dia vazio limpa o destino), ambas INVOKER (as policies decidem). 17 testes em `diet.test.sql` (433 no total).
  - **Domínio `src/domain/Diet`:** api/service/rules/useCases. Ordem do dia: por horário, refeições sem horário no fim, depois a ordem de cadastro (`mealsOn`).
  - **Staff:** detalhe do competidor → **Dieta** (`athlete/diet?membershipId=`): seletor de semana (anterior/próxima) com os 7 dias, refeições do dia (toque para editar/remover), "Adicionar refeição" fixo, "Copiar do dia anterior" no dia vazio e "Repetir este dia amanhã" (pede confirmação se o dia seguinte já tem refeições). Folha da refeição: atalhos (Café da manhã, Almoço…), nome, horário opcional `HH:MM`, "O que comer".
  - **Competidor:** "Dieta de hoje" na aba Competição + "Dieta da semana" (`/dieta`, só leitura, junta as academias em que compete). Sem widget (spec).
  - Ícones novos: `chevronLeft`, `copy`, `diet` (ForkKnife).
- [x] 6. Polimento (2026-11-04), feito sem o aparelho; o restante depende da validação no aparelho.
  - **Haptic de erro** (DS seção 7): ligado UMA vez no `MutationCache` (`infra/query/queryClient.ts`); toda ação que falha vibra.
  - **Erros de carregamento:** componente `LoadError` (ícone offline + "Tentar de novo"). Agora Ordenar faixas, Detalhe do membro (membro e aulas) e Detalhe do campeonato distinguem erro de rede de "não encontrado".
  - **Acessibilidade:** todo `Pressable` tem `accessibilityLabel` (auditado); os seletores novos (dias da dieta, semana) usam `tab`/`selected`.
  - **TODO(motion):** os pontos que a spec e o DS 8 pedem estão todos marcados (ver tabela abaixo).

### Pontos de movimento (`TODO(motion)`)

| Momento | Onde |
| --- | --- |
| Botão tátil afundando e voltando | `components/Button/Button.tsx`, `components/Card/Card.tsx` |
| Anel de água enchendo | `components/WaterRing/WaterRing.tsx`, `targets/widgets/WaterWidget.swift`, `WaterWidget.kt` |
| Badge pendente → confirmado | `components/StatusBadge/StatusBadge.tsx`, `screens/student/TodayClasses.tsx` |
| Barra de faixa avançando | `components/ProgressBar/ProgressBar.tsx`, `screens/student/GraduationTrail.tsx` |
| Número da contagem virando | `components/BigCounter/BigCounter.tsx`, `screens/app/CompetitionScreen.tsx` (dia do campeonato), `CountdownWidget.swift`, `CountdownWidget.kt` |
| Folha de feedback entrando e saindo | `components/FeedbackSheet/FeedbackSheet.tsx`, `screens/app/HomeScreen.tsx`, `screens/water/WaterScreen.tsx` |
| Outros | entrada da conquista (`AchievementScreen`), balão do mascote (`MascotBalloon`), código (`CodeField`), entrada (`StartScreen`, `EnterCodeScreen`), reordenar (`ReorderList`) |

- [x] 7. Pré-lançamento (2026-11-04): migration `20261105000400_prelaunch_hardening` + 21 testes em `prelaunch.test.sql` (454 no total).
  - **Excluir conta** (exigência da App Store): Perfil → Meus dados → "Excluir conta" (confirmação `danger`). RPC `delete_my_account` (DEFINER): bloqueia com `owner_must_transfer` se o usuário é owner de academia com outros membros ATIVOS; academia em que ele é o único ativo é apagada junto (pedidos pendentes não bloqueiam); depois apaga `auth.users` e tudo pessoal cai em cascata. O app apaga a foto em seguida (o token ainda vale) e sai só localmente. As logos das academias que vão junto são apagadas antes, pela API de storage (o SQL não pode apagar arquivos: `storage.protect_delete`): `account_deletion_academies()` (migration `20261105000700`) recusa com `owner_must_transfer` ou lista as academias; o app apaga a pasta de cada uma enquanto ainda é owner e só então chama `delete_my_account`.
  - **Dados do corpo** (peso, altura, sexo, nascimento): o cliente não lê mais essas colunas de `profiles` (grant só nas colunas públicas). `get_profile_details(user)` devolve para o próprio usuário ou para staff de academia em que ele é COMPETIDOR (aceitou o convite); senão, zero linhas. `profileApi.getById` junta as duas leituras (campos nulos quando não pode ler). Escrita continua igual.
  - **Pedido recusado:** `request_join` recusa com `join_cooldown` por 24 h depois da decisão (o código de professor não é gasto).
  - **Limite no `lookup_invite_code`** (anônimo): 20 consultas SEM resultado por IP em 15 min → `rate_limited`. IP de `cf-connecting-ip` / `x-real-ip` / primeiro `x-forwarded-for`; sem cabeçalhos (SQL, testes) não limita. Tabela `private.code_lookup_failures` (limpa as do IP com mais de 1 dia a cada falha). A função virou VOLATILE.

- [x] 8. Ofensivas (backlog, 2026-11-04). Decisões do usuário: congelamento POR CONQUISTA (1 a cada 7 dias seguidos de água / 4 semanas seguidas de treino, no máximo 2 de cada, usado sozinho); lembretes = notificação local 1 h antes de cada aula (item seguinte).
  - **Regra** (`src/domain/Streaks/streakRules.ts`, testada): calculada SÓ do histórico (`computeStreak`), sem estado guardado: mesmo resultado em qualquer aparelho. Do primeiro período cumprido até o atual: cumprido soma (e a cada N ganha congelamento); perdido gasta um congelamento ("congelado", a ofensiva mantém o valor) ou zera; o período ATUAL nunca quebra enquanto não terminou. Recorde = maior sequência.
  - **Água** (diária, todos): o dia conta quando o total chega à meta DAQUELE dia. Migration `20261105000500_water_streak`: `water_goal_days` (o app grava a meta do dia, `useRecordWaterGoal` na raiz, uma vez por dia+valor via kv-store) e `my_water_days()` (total por dia no fuso do perfil + meta do dia, senão a última anterior, senão a primeira). O app junta com os totais do aparelho (`waterService.localDayTotals`, inclui widget/não sincronizados; vence o maior). Sem peso (meta nula) o dia não conta. Enquanto o histórico do servidor não chega, a ofensiva fica nula (não mostra valor errado).
  - **Treino** (semanal, alunos, por academia): semana com aula confirmada; substituiu `checkinStreak` na barra da Início e na tela de conquista.
  - **Telas:** `/ofensivas` (cards Água e Treino: chama acesa = período cumprido, contorno = ainda falta, apagada = sem ofensiva; últimos 7 dias/semanas com chama / gelo / X / círculo; congelamentos guardados; recorde; explicação). A chama da barra da Início abre `/ofensivas`; na tela de Água, "N dias seguidos" abaixo do anel.
  - **Recorde:** folha "Novo recorde." na Início (água primeiro, depois treino), uma vez por recorde novo ≥ 3; a primeira leitura só grava a base (o histórico não é comemorado). kv-store `streakRecords` por usuário (e academia no treino).
  - Ícones novos: `freeze` (Snowflake), `missed` (X), `open` (Circle).

- [x] 9. Lembretes de aula (backlog, 2026-11-04). Decisão do usuário: notificação LOCAL (agendada no aparelho), 1 h antes de cada aula.
  - `expo-notifications` 58.1.8; plugin com `enableRemoteNotifications: false` (sem entitlement de push). **Exige build novo.** Sem o módulo nativo (build antigo, Jest) a biblioteca nem é carregada (`requireOptionalNativeModule('ExpoNotificationScheduler')`) e o switch aparece desligado com "Disponível depois de atualizar o app".
  - Regra pura `src/domain/Reminders/reminderRules.ts` (testada): próximos 30 dias (decisão do usuário: até a mensalidade vencer) do calendário da academia, só as aulas das modalidades que o aluno treina (`trainedModalities`; sem histórico, todas), `zonedTime` converte o horário da academia (fuso fixo `America/Sao_Paulo`) para o instante certo seja qual for o fuso do aparelho; no máximo 60 no iOS (ele guarda 64 pendentes; uma grade cheia cobre menos dias) e 300 no Android. Texto: "Aula em 1 hora" / "Jiu-Jitsu às 19:00 na {academia}."
  - `useClassReminders` (raiz): reagenda tudo (cancel all + schedule) só quando a assinatura do plano muda (kv-store `classRemindersPlan` por usuário); cancela com o switch desligado, para staff e ao sair. `useClassReminderSetting`: switch em Perfil → Notificações (alunos), opt-in por aparelho; pede a permissão ao ligar; negada → alerta com "Abrir Ajustes".
  - O plano é refeito quando o app abre/volta; quem não abre o app por um mês para de receber até abrir de novo.

- [x] 10. Ranking da academia (backlog, 2026-11-04). Migration `20261105000600_academy_ranking` + 11 testes (`ranking.test.sql`, 472 no total).
  - Só aulas CONFIRMADAS, alunos ATIVOS, por mês do calendário da academia; geral ou por modalidade (`checkins.modality_id`). Empates dividem a posição (`rank`). `academy_ranking(academia, mês, modalidade?)` e `academy_ranking_champions(academia, modalidade?)` (1º lugar, empates juntos, só meses encerrados), DEFINER, para qualquer membro ativo (aluno ou staff); fora da academia → `forbidden`.
  - `profiles.show_in_ranking` (padrão ligado): Perfil → Preferências → "Aparecer no ranking" (alunos). Desligado tira a pessoa do ranking e do histórico de campeões (é calculado na hora).
  - **Fotos:** colegas ativos passam a ver a foto de quem aparece no ranking (`private.is_ranked_classmate` na policy do bucket `avatars`). Decisão do agente: sem isso o ranking mostraria só iniciais. Quem sai do ranking volta a ter a foto restrita.
  - Tela `/ranking`: mês (anterior/próximo, até o atual), Geral + modalidades, top 20 e a linha do próprio aluno abaixo de "…" quando estiver mais para baixo, troféu no 1º, pódio em destaque, aviso se o aluno saiu do ranking, e "Campeões" por mês. Entradas: aba Aulas ("Ranking da academia") e Alunos (botão "Ranking", staff).
  - Perfil: a seção "Notificações" virou "Preferências" (lembrete das aulas + ranking).

- [x] 11. Timer de rounds (backlog, 2026-11-04). **Exige build novo** (motor nativo, Live Activity, foreground service) e validação no aparelho (som com tela bloqueada, ducking, Live Activity).
  - **Motor puro** `src/domain/Timer/timerRules.ts` (testado): linha do tempo prepare-se (10 s) → round → descanso → … ; estado e sons SEMPRE pelo relógio (`TimerClock`: início + pausas; pausar/continuar/pular fase mexem só no relógio). Sons: sino no início do round, três sinos no fim, batidas de madeira `warningSeconds` antes do fim do round e do descanso. Um tique que volta de uma suspensão longa não toca sons velhos.
  - **Predefinições prontas** (no app): Boxe 3×3:00/1:00, Muay Thai 5×3:00/2:00, MMA 3×5:00/1:00, Rola de jiu-jitsu 6×5:00/1:00 (aviso 10 s; rola 30 s). Desde 2026-11-05 só aparecem as das modalidades que a academia tem (`builtInsForAcademy`, nome comparado sem acento/caixa/hífen; rola vale para Jiu-Jitsu e No-Gi); se nenhuma bater (Judô, Karatê…), aparecem todas. Vindo de uma aula sem predefinição da academia, abre a pronta da modalidade (`builtInFor`). **Da academia:** tabela `timer_presets` (migration `20261105000800`, 8 testes): membros leem, staff cria/atualiza/apaga; nome único por academia.
  - **Motor NATIVO** (2026-11-04, a pedido do usuário: quem controla o timer sai do app e não fica atento). Os timers do JS não são confiáveis em segundo plano (no Android param), então quem toca os sinos e mostra o timer fora do app é o nativo, em `modules/kimi-widget`. O JS (`src/services/timer/timerSession.ts`) só desenha a tela e, a cada iniciar / pausar / continuar / pular, manda o PLANO do que falta (`nativePlan`, testado: fases e sons em epoch ms) para `roundTimerSync(json)`; `roundTimerStop()` encerra.
    - **iOS** `RoundTimerEngine.swift`: sessão `.playback` (toca no silencioso), loop de silêncio mantém o app vivo (`UIBackgroundModes: audio` no app.json), sinos agendados em horário de parede (`DispatchWallTime`), música dos outros apps só ABAIXADA (`.duckOthers`) durante o sino e liberada depois (desativa/reativa a sessão). Atualiza a **Live Activity** (tela bloqueada e Dynamic Island) em cada fase/aviso. Sons empacotados no pod (`resource_bundles` `KimiWidgetSounds`).
    - **Android** `RoundTimerService.kt`: foreground service (`mediaPlayback`) com **notificação fixa** (fase, round e contagem ao vivo pelo cronômetro da própria notificação), wake lock parcial enquanto roda, `SoundPool` no fluxo de mídia (não é silenciado pelo modo silencioso) e foco de áudio `GAIN_TRANSIENT_MAY_DUCK` só durante o sino. Sons em `res/raw/kimi_*.wav`. Pede a permissão de notificação (Android 13+) ao iniciar.
    - Sem o motor (build antigo) o timer roda só na tela, mudo, e a configuração avisa. O `expo-audio`/`expo-asset` e o fallback por notificações saíram.
  - **Telas:** `/timer` (predefinições, rounds, round M:SS, descanso, aviso; staff salva/atualiza/apaga as da academia; card "Timer em andamento") e `/timer/run` (tela cheia, `useKeepAwake`; cores por estado: prepare-se `warning`, round `success`, aviso `danger`, descanso `water`, pausado `surfaceRaised`; dígitos no token novo `timer` (Barlow 800, 168, encolhe para caber); pausar, fase anterior/próxima, encerrar com confirmação). A confirmação de encerrar é uma `ConfirmSheet` LOCAL: a do `useConfirm` vive na raiz, debaixo do modal de tela cheia, e o iOS não a apresenta (o X parecia não funcionar). Vale para qualquer tela futura em `fullScreenModal`. Entradas: aba Aulas e Perfil → Gestão da academia.
  - **Sons** `assets/sounds/*.wav`: sintetizados por `scripts/sounds/generate.py` (CC0, ver `assets/sounds/LICENSE.md`), que também copia para o pod iOS e `res/raw` do Android.
  - `yarn.lock` saiu do repositório e do controle (`.gitignore`): o `expo lint` o recriava.

- [x] 12. **Reestruturação do staff** (2026-11-05, pedido do usuário; a versão do aluno não mudou).
  - **Início** (`screens/staff/StaffHome.tsx`): card da próxima aula (modalidade, horário, "Começa em 40 min" / "Em andamento", confirmados e pendentes, botões "Presença" e "Timer" com a predefinição da modalidade); sem aulas hoje, a próxima da semana sem botões. Aulas de hoje (pendentes → lista de presença). Avisos só quando existem: pedidos de entrada (→ `/pedidos`) e campeonatos nos próximos 30 dias. Resumo da semana: aulas dadas, presenças (segunda até hoje) e top 3 do ranking do mês. **Decisão do agente:** horários não têm duração; "em andamento" = até 60 min depois do início (`CLASS_LENGTH_MIN`, `domain/Classes/staffRules.ts`, testado).
  - **Aulas** (`StaffClassesScreen`): seletor de dias da semana (o mesmo da dieta, `DietWeekPicker` com `marked`), aulas do dia com confirmados/pendentes → **lista de presença** `/presenca?schedule=&date=` (`AttendanceScreen`): pendentes no topo (Confirmar/Recusar, "Confirmar todos" com mais de um), confirmados, recusados, professor da aula, "Timer" no header e **"Marcar presença"**: lista quem treina a modalidade (a busca procura todos os alunos), sem quem já está na lista; um check-in recusado é confirmado em vez de duplicado. Gestão de horários no header, só owner (rota `academy/schedules` agora é só owner).
    - Banco (migration `20261105000900`, 14 testes em `attendance.test.sql`): `checkins.marked_by` + política RLS "staff marks attendance" (owner/professor, aluno ATIVO da própria academia, aula da academia no dia da semana certo, hoje ou passado, já `confirmed`, `marked_by` = quem marca); trigger `stamp_checkin_insert` grava revisor e recusa `marked_by` vindo de não-staff; a unique (aluno, aula, dia) impede duplicar (`already_present`). Sem SECURITY DEFINER.
  - **Timer** (aba): abre na última predefinição usada (kv `timerLast` por usuário+academia) ou na da modalidade (`?modality=`); "Iniciar · {nome}" fixo; trocar = um toque nos cards. Só o **owner** salva/atualiza/apaga predefinições (RLS mudou: antes staff) e pode ligar uma a uma modalidade (`timer_presets.modality_id`, uma por modalidade); o professor ajusta só para a sessão.
  - **Equipe** (`screens/team/TeamScreen.tsx`, substitui Alunos): busca sempre no topo (todos os membros por nome), banner de pedidos de entrada e os membros em Professores/Alunos. Filtros em **chips compactos** numa linha que rola de lado (`components/FilterChips`, 32pt de altura e toque de 44 pelo hitSlop, token `size.filterChip`): modalidades e "Só competidores", cada um liga/desliga com um toque. Linha com foto, nome, faixa (da modalidade filtrada ou a mais recente) e papel; sem remover na lista. **Decisão do usuário (2026-11-05):** sem seletor Membros | Ranking | Campeonatos — o ranking abre pela Início (card "Ranking do mês" → `/ranking`) e os campeonatos pelo Perfil (owner em Gestão; professor numa seção "Academia"). "Convidar" no header: sheet com o código de aluno grande, "Compartilhar código" e, só owner, "Gerar novo código" (alerta do sistema: folha sobre folha não abre no iOS) e "Códigos de professor" (`/convites`).
  - **Detalhe do membro:** "Remover da academia" no fim, em "Ações sensíveis", com confirmação (só owner, nunca o owner nem você).
  - **Perfil (staff):** Água ("Garrafa e peso": a tela Sua garrafa tem só garrafa e peso desde 2026-11-05; a altura fica só em Meus dados e não é mais regravada ali; o peso é o mesmo campo `profiles.weight_kg` de Meus dados); Gestão da academia só owner (Configurações, Modalidades e faixas, Horários, Convites, Campeonatos); Conta: Meus dados e Sair ("Excluir conta" fica só em Meus dados, decisão do usuário 2026-11-05). Os códigos saíram das Configurações da academia para `/convites`.
  - Telas novas: `/pedidos` (pedidos de entrada), `/convites` (owner). Removidas: `ConfirmationsScreen`, `StudentsScreen`, `ProfessorHome` (o card de pedido e o "Professor da aula" viraram `screens/staff/RequestCard` e `InstructorField`).

## Backlog (depois da Fase 6)

Ideias registradas pelo usuário em 2026-11-04. Tudo **implementado em 2026-11-04** (itens 8 a 11 do mapa acima); a lista fica como referência.

- **Ofensivas e recompensas (inspirado no Duolingo):**
  - ofensiva de água (diária) e de treinos (semanal);
  - chama acesa/apagada conforme a ofensiva está ativa ou quebrada;
  - congelamento de ofensiva (protege um dia/semana perdido);
  - lembretes para não perder a ofensiva;
  - conquistas por recorde (maior ofensiva).
- **Ranking da academia:**
  - baseado só em aulas confirmadas (não em água nem peso);
  - mensal, com histórico dos campeões de cada mês;
  - geral e por modalidade;
  - opção no Perfil para o aluno não aparecer no ranking;
  - visual seguindo o DESIGN-SYSTEM.md.
- **Timer de rounds com gongo** (registrado em 2026-11-04, implementado no mesmo dia a pedido do usuário):
  - configuração de rounds, duração, descanso e aviso antes do fim;
  - predefinições prontas (Boxe, Muay Thai, MMA, rola de jiu-jitsu) e predefinições salvas pela academia;
  - tela grande legível de longe, com cores por estado e tela sempre acesa;
  - funciona em segundo plano e com a tela bloqueada, toca no modo silencioso e abaixa a música em vez de interromper;
  - tempo calculado pelo relógio;
  - Live Activity no iOS com round e tempo restante;
  - sons com licença livre.

## 5. Domínios & features implementados

### Banco (`supabase/migrations/`)

**Migrations:** `base_setup` (schema `private`, default privileges, enums), `profiles`, `academies_and_memberships`, `classes_and_checkins`, `water`, `diet`, `weight_logs`, `championships`, `lock_down_rls_auto_enable`.
Fase 2 (2026-11-04): `class_stats_and_belt_keys` (faixas gravadas como CHAVE da paleta 2.4 — `white`…`red` — com check no banco; RPC INVOKER `academy_today`; view `membership_class_stats` com `security_invoker`: total confirmado e confirmadas desde a última graduação, contando só aulas DEPOIS do dia da graduação), `academy_timezone_checkin_day` (`academies.timezone`, check-in só na data local da academia via `private.academy_local_date`), `belt_history` (único caminho para mudar `memberships.belt`: o professor insere no histórico e um trigger atualiza o vínculo; update direto de `belt` é bloqueado), `belt_goals_deferrable_position` (unique de posição `deferrable` + RPC INVOKER `reorder_belt_goals`).

**Modelo (híbrido, decidido com o usuário):**
- `academies` (`invite_code` de 8 caracteres, gerado; `created_by` = dono).
- `memberships`: `role` professor|student, `status` pending|active|rejected, `is_competitor` (só aluno), `belt`. A entrada pelo código (`join_academy`) ou pelo link (`request_membership`, tabela `academy_invites` com token de 144 bits) cai SEMPRE em `pending`. O professor aprova com um UPDATE de `status`; um trigger aceita só pending → decidido e grava `decided_by/at`.
- `belt_goals`, `class_schedules`, `checkins` (FK composta `(schedule_id, academy_id)`; status/revisor gravados por trigger).
- `water_logs` (id gerado no app, upsert idempotente), `water_plans`/`water_plan_days`, `diet_plans`/`diet_plan_meals`, `weight_logs`, `championships`/`championship_entries` (com `academy_id` para evitar recursão de RLS).

**Segurança:**
- `anon` não tem nada (nem tabela, nem função). PUBLIC perde EXECUTE em funções novas.
- Helpers em `private` (SECURITY DEFINER, ancorados em `auth.uid()`): `is_member`, `is_professor`, `is_competitor_of`, `is_competitor`, `is_professor_of_competitor`, `is_professor_of_member`, `has_membership_or_request` (este só para ler o nome da academia).
- RPCs SECURITY DEFINER (justificadas no SQL): `create_academy`, `join_academy`, `request_membership`, `get_invite_preview`, `list_pending_requests`. `rotate_invite` é INVOKER. Os advisors avisam (WARN) sobre essas cinco: são intencionais.
- Colunas graváveis limitadas por grant de coluna (ex.: aluno só insere `checkins` sem `status`; professor só altera `role/is_competitor/belt/status` em `memberships`). Dono não pode ser rebaixado nem removido.

**Testes:** 337 testes pgTAP (2026-11-04): `rls.test.sql` (201) e `modalities_avatars.test.sql` (136: modalidades/faixas, meta por modalidade, check-in só de aluno, fuso fixo, `is_new`, storage de avatares). Antes: testes em `supabase/tests/database/rls.test.sql` (duas academias, owner + 2 alunos em cada, um competidor; professor não-owner, pedidos de aluno/professor, códigos e transferência na academia 1). Rodam também no remoto (`npx supabase test db --remote --yes`, tudo em rollback): o arquivo faz `set local role postgres` e localiza o schema do pgTAP. O "hoje" dos check-ins usa Pago Pago (UTC−11) × Kiritimati (UTC+14), sempre em datas diferentes.

### App

- **Auth:** e-mail/senha (mínimo 8, alinhado ao `config.toml`). Confirmação de cadastro por CÓDIGO de 6 dígitos (`verifyOtp` type `email`; `auth.email.otp_length = 6` no remoto, `OTP_LENGTH` no app) na tela `(auth)/verify-email`, sem link nem deep link; o template "Confirm signup" do painel precisa usar `{{ .Token }}`. Login de conta não confirmada leva para essa tela. Também há login com Apple (`signInWithIdToken` com nonce). O Google está pendente.
- **Convite:**
  - **Deslogado:** `convite/[token]` mostra o preview, guarda o token (`pendingInvite`) e manda para cadastro/login. Depois do login, o `useConsumePendingInvite` chama `request_membership`.
  - **Logado:** botão "Pedir para entrar".
- **Onboarding:** pedidos pendentes (com Atualizar) ou boas-vindas. "Criar minha academia" → `create_gym` → `selectGym` → o guard vira para `(tabs)`.
- **Professor:**
  - Alunos: os 2 links (compartilhar / gerar novo), membros ativos e remover.
  - Confirmações: pedidos de entrada, com aprovar/recusar; aprovar professor pede confirmação; haptic de sucesso.
- **Aluno/Competidor:** Início, Aulas e Competição são placeholders (EmptyState) até as fases 2/4.
- **Perfil:** nome, e-mail, troca de academia, sair.
- **Sessão:** ao cair a sessão (sair ou refresh expirado), `queryClient.clear()` + remoção da academia ativa. O token de convite pendente sobrevive de propósito.
- **Contas de teste (DEV):**
  - `supabase/seed.sql` (roda no `db reset`): `professor@kimi.dev` e `aluno@kimi.dev`, senha `kimi12345`, ativos em "Kimi Jiu-Jitsu (Teste)"; uuids fixos `1111…`, `2222…` e academia `3333…`.
  - Só existem no banco local. Os botões de login rápido foram removidos: no projeto hospedado o teste é pelo cadastro real.
  - Ao criar dados nas próximas fases (horários, check-ins...), estender o seed para essa academia.
- **Testes unitários:** `npm test` (jest-expo) cobre `membershipRules`, `authRules` e `supabaseError`.

## 6. Pendências & próximos passos

### Antes do lançamento (produção) — resolver todas

1. ~~Exclusão de conta~~ — feito na Fase 7.
2. ~~Limite de tentativas no código~~ — feito na Fase 7 (por IP no banco). O `join_with_code` (logado) segue sem limite próprio: exige conta com e-mail confirmado.
3. ~~Pedido recusado~~ — feito na Fase 7 (24 h).
4. **Universal Links / App Links:** hoje o deep link é `kimi://entrar?codigo=…`, que só abre com o app instalado. Precisa de domínio + `apple-app-site-association` / `assetlinks.json` e `ios.associatedDomains` / `android.intentFilters` no `app.json`. Junto: ligar a confirmação de e-mail (`enable_confirmations`) no projeto hospedado.
5. **Google Sign-In:** pendente. Precisa dos client IDs (iOS, Android, Web) do Google Cloud e do provedor no Supabase.
6. **Apple Sign-In:** o código já existe (`signInWithIdToken` com nonce). Falta habilitar o provedor Apple no Supabase hospedado (e `[auth.external.apple]` no `config.toml` local) com o bundle id `br.com.kimi.app`, e o capability no time de assinatura.

### Para rever depois (usuário, 2026-11-04)

- **Lembretes de aula:** rever o comportamento com o usuário. Pontos em aberto:
  - no iOS, cabem no máximo 60 lembretes pendentes, então uma grade cheia cobre menos de 30 dias;
  - o plano só é refeito quando o app abre: um aluno que não abre o app por um mês para de receber;
  - hoje entram todas as aulas das modalidades que o aluno treina, não só as que ele costuma frequentar;
  - o switch é por aparelho e vem desligado.

### Em andamento

- **Migrations `20261104220000` (logo obrigatória), `20261104230000` (faixas por chave de cor + ponta) e `20261104240000` (variações de cor)** aplicadas no remoto em 2026-11-04 (373 testes pgTAP passando lá; tipos regenerados).
- **Correções pré-Fase 3 (2026-11-04):** migrations `20261104180000`–`180004` aplicadas no LOCAL e no remoto (`db push` em 2026-11-04; 337 testes pgTAP passando no remoto; `types/database.ts` regenerado do remoto). Build novo necessário por causa da permissão de câmera (`app.json` → `expo-image-picker.cameraPermission`).

- **Fases 4 e 5 — competidores, contagem e dieta:** migrations `20261105000000`, `20261105000100` e `20261105000200` aplicadas no remoto em 2026-11-04 (`types/database.ts` regenerado do remoto). Falta o build novo (widget de contagem nos dois sistemas) e a validação no aparelho.
- **Fase 3 — água + widget:** código pronto; falta o build do usuário (`npx expo prebuild --clean` + `run:ios` / `run:android`) e testar no aparelho. O `db push` das migrations de 2026-11-04 ainda depende do `npx supabase login`.
- **Validação do usuário no aparelho:** fluxo de entrada, papéis e ícones novos (precisa de build novo; quem roda é o usuário).

## 7. Notas / armadilhas

- **Gerenciador de pacotes: npm.** O `npx expo install` às vezes escolhe o yarn e cria um `yarn.lock`: use `npx expo install --npm <pacote>` e apague qualquer `yarn.lock`. O cache do npm do usuário tem arquivos do root (`sudo chown -R 501:20 ~/.npm` resolve).
- **`@react-native/jest-preset`** está declarado em devDependencies (fixo em 0.88.1): sem isso um `npm install` o remove e o Jest quebra.
- **Fase 2 — domínio `src/domain/Classes`:** regras puras em `classesRules.ts` (sequência semanal Seg–Dom que não quebra na semana corrente sem aula; marcos 10/25/50/100 e a cada 100; progresso de faixa e nós da trilha em blocos de 10). O "hoje" vem SEMPRE do servidor (`useAcademyToday`), nunca do relógio do aparelho.

- O arquivo da persona `~/.claude/agents/mobile-senior-dev.md` não existe. O padrão foi inferido do `DEVELOPMENT.md` de `/Volumes/T7/Projects/storage-mobile-front`.
- O repositório local chama `kime-app`; a spec chama de `kimi-app`.
- **npm ERESOLVE com `react-dom`:** o `expo-router` puxa deps web (radix) que pedem `react-dom`. Ele está fixado via `npx expo install react-dom` (19.3.0 = versão do react). Sem isso, qualquer `expo install` falha.
- **Testes pgTAP:** a migration revoga EXECUTE de PUBLIC em funções novas, inclusive nas `pg_temp.*` dos testes. Os testes fazem `grant execute ... to public` nos helpers.
- **Jest:** o `testPathIgnorePatterns` usa `<rootDir>/supabase/`. Sem o `<rootDir>`, ignorava `src/infra/supabase/__tests__`.
- **Rotas:** NENHUM grupo protegido pode ter `index`. Com o "/" só dentro de um grupo protegido, o cold start deslogado dava "Unmatched Route". O "/" é o `src/app/index.tsx`, sem guard, que redireciona. A aba Início é `(tabs)/home`.
- **Metro em `CI=1` NÃO observa arquivos** (o bundle fica velho). Para desenvolver, `npm start` sem CI.
- **React Query no RN:** `focusManager` ligado ao `AppState` em `infra/query/queryClient.ts`, para refazer queries ao voltar para o app.
- **Código pendente (`pendingCode`):** só é apagado em sucesso ou erro definitivo. Em erro de rede, fica guardado para tentar de novo. Expira em 24 h e é apagado no logout.
- **Tipos do banco:** em 2026-11-04 o `types/database.ts` foi gerado do banco LOCAL (as migrations novas ainda não estavam no remoto). Depois do `db push`, rode `npm run db:types` de novo.
- **Builds:** quem roda é o usuário (`expo run:*`, Xcode, Gradle, EAS). O agente avisa com o comando quando uma mudança exige build novo (código nativo, widgets, plugins, ícones).
- **Rotas tipadas:** se o `tsc` reclamar de rotas existentes, o `.expo/types/router.d.ts` está velho. Suba o Metro uma vez para regenerar.
- **`Card`:** as margens vão para o contêiner externo (com a borda), e o resto estiliza a face. Margem na face esticava a borda cinza.
- **Apple:** o nome só vem na PRIMEIRA autorização, e o `authService.signInWithApple` grava no perfil na hora.
- **Android emulador:** `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321`.
