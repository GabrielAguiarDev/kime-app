# Kimi — Contexto de Desenvolvimento

> Arquivo mantido pelo agente mobile-senior-dev. Leia isto antes de continuar o desenvolvimento.
> Última atualização: Fase 1 + adaptação ao DESIGN-SYSTEM.md — 2026-11-03

## 1. Visão geral

App mobile multi-academia de artes marciais (a spec completa do usuário está na conversa inicial; aqui vai o resumo).

- **Papéis por vínculo usuário↔academia:** aluno, competidor (só por promoção do professor, fase 4) e professor.
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
- **Preferências locais** (academia ativa, token de convite pendente): `expo-sqlite/kv-store` (síncrono), em `infra/storage`.
- **Design:** segue o `DESIGN-SYSTEM.md` (raiz). Ele vale sobre qualquer outra instrução de design.
  - **Tokens:** `tokens.json` é a fonte única. `npm run tokens` gera `src/theme/tokens.ts`, `widgets/ios/KimiTokens.swift` e `widgets/android/KimiTokens.kt`; `npm run tokens:check` falha se estiverem desatualizados (rode antes de commitar). Nunca escrever cor/tamanho solto no código: usar o tema (`useAppTheme()`, props do restyle).
  - **Destaque laranja** `accent` `#D9400A` (escuro `#F05A1E`). O vermelho antigo (`#E10600`) saiu.
  - **App só no tema escuro** (decisão do usuário, 2026-11-04). `useSchemeTheme()` devolve sempre `darkTheme` e `userInterfaceStyle` é `dark` no `app.json`. A opção Perfil → Aparência foi removida; o `lightTheme` continua nos tokens para uma volta futura.
  - **Fontes:** Barlow Condensed (display/título) + Inter (texto). Todas as variantes de texto usam `tabular-nums`.
  - **Ícones:** Phosphor (`phosphor-react-native`, importado ícone a ícone em `components/Icon`); `bold` normal, `fill` ativo. Para um ícone novo, adicionar ao mapa `ICONS`.
  - **Edges `success`/`warning`/`danger`** não estão no documento: foram derivadas a 25% mais escuras, como ele manda.
- **Ícone e mascote:** fontes em `assets/brand/`: `kimi-icon.png` (ícone redesenhado, 1254px, sem alpha; o monocromático do Android é extraído da faixa laranja dele), `kimi-mascot.svg` = bravo, `kimi-mascot-celebrating.svg` = olhos redondos. No ícone adaptativo do Android a arte vai a 70% para os olhos caberem na área segura. O app renderiza os SVGs do mascote com `expo-image` (`<Mascot size="hero|empty|feedback" />`). Os PNGs de ícone/splash são gerados por `scripts/brand/render-icons.sh` (macOS); depois, `npx expo prebuild`. Mascote só em estados vazios, folha de feedback, onboarding e telas de marco.
- **Sem animações** (o usuário faz o movimento). Cada estado visual fica separado, com `// TODO(motion): ...`.
- **Ambiente:** Node 22, npm 10, Xcode 26.6, Docker OK, simulador "iPhone 17 Pro". **Android SDK ausente** na máquina.

## 3. Estrutura & convenções específicas deste projeto

```
src/
  app/                  rotas Expo Router (arquivos finos, reexportam telas)
    _layout.tsx         providers + Stack.Protected por estado (ver abaixo)
    index.tsx           "/" sem guard: <Redirect> para /sign-in, /welcome ou /home
    (auth)/             sign-in, sign-up
    (onboarding)/       welcome (aguardando aprovação / boas-vindas), create-gym
    (tabs)/             home, classes, competition, students, confirmations, profile
    convite/[token].tsx deep link, modal, sempre acessível
  screens/{auth,onboarding,invite,app}/
  domain/{Auth,Gym,Membership,Profile}/  xApi, xAdapter, xService, xTypes, xRules, useCases/, index
  infra/                env, supabase (client, database.types gerado, supabaseError), query, storage
  services/             session/, activeGym/, pendingInvite, useConsumePendingInvite
  components/           Box, Text, Icon, Button (tátil), TextButton (fantasma), TextField, Screen, Card,
                        EmptyState, Mascot, ProgressBar, WaterRing, BigCounter, StatusBadge, BeltChip, FeedbackSheet
  theme/                tokens (GERADO), fonts, theme (light/dark), useAppTheme, useSchemeTheme, useIsDark
  utils/                deepLinks, haptics
scripts/tokens/            gerador de tokens (TS/Swift/Kotlin)
scripts/brand/             renderização dos PNGs de ícone/splash a partir dos SVGs
widgets/{ios,android}/     tokens gerados para os widgets (os targets nativos chegam nas fases 3/4)
```

- **Aliases:** `@components`, `@domain/*`, `@infra`, `@screens/*`, `@services/*`, `@theme`, `@utils/*`. Estão no tsconfig (o Metro lê) e no `jest.moduleNameMapper`.
- **Guards da raiz** (`src/app/_layout.tsx`):
  - deslogado → `(auth)`;
  - logado sem vínculo ATIVO → `(onboarding)`;
  - logado com vínculo ativo → `(tabs)`.
  - A splash fica só no BOOT (fontes ou erro de fonte + sessão + vínculos). Depois do boot, o Stack nunca desmonta, e as telas mostram o próprio loading: `WelcomeScreen` mostra spinner enquanto os vínculos carregam ou o convite pendente está sendo enviado (`useIsConsumingInvite`).
- **Tabs por papel** (`(tabs)/_layout.tsx`, `Tabs.Protected`), só com ícones:
  - aluno: Início, Aulas, Perfil;
  - competidor: + Competição;
  - professor: Início, Alunos, Confirmações, Perfil.
- **Academia ativa:** `ActiveGymProvider` resolve com `resolveActiveMembership` (a guardada no kv-store se ainda ativa, senão a primeira ativa). Troca no Perfil.
- **Erros:** services fazem `throw toAppError(e)`. As RPCs levantam códigos de máquina (`invite_invalid`...) como mensagem da exception. A UI usa `errorMessage(e)` (pt-BR) de `@infra`.
- **Tipos do banco:** `npm run db:types` (gera `types/database.ts` do remoto) após cada `db push`. `src/infra/supabase/database.types.ts` só reexporta.
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
- **Fase 4 — competidor por convite aceito:** o professor envia o convite; o aluno vê um aviso de que, ao aceitar, o professor passa a ver peso, registros de água e planos de dieta, e aceita ou recusa. `is_competitor` só vira true após o aceite, com a data registrada. O professor pode tirar o aluno da equipe a qualquer momento e o aluno pode sair sozinho. Até a Fase 4, o professor liga `is_competitor` direto (como hoje).

## 4. Mapa de progresso (fases)

- [x] 1. Fundação: Expo + Supabase + auth + academias/vínculos/papéis + RLS + navegação por papel + design tokens. **CONCLUÍDA**, aguardando validação do usuário.
- [x] 2. Aulas: horários, check-in, confirmação, total de aulas, faixa, sequência semanal. **CONCLUÍDA**, aguardando validação no aparelho.
  - Professor: `academy/schedules`, `academy/belts` (entrada pelo Perfil → Gestão da academia), `member/[membershipId]` (toque no membro em Alunos), "Check-ins de hoje" em Confirmações, aulas do dia no Início.
  - Aluno: barra do topo + aulas de hoje com check-in + balão do mascote (Início), trilha de graduação e horários da semana (Aulas), recompensas em `services/classRewards` (snapshot por usuário+academia no kv-store: faixa nova > marco > check-in confirmado; primeira abertura não recompensa o histórico), tela `achievement`.
  - Componentes novos: `SelectionCard` (11.5), `MascotBalloon` (11.3), `BottomSheet` (3.13), `ConfirmSheet` + `useConfirm()`.
  - Ajustes pós-Fase 2 (2026-11-04): horários agrupados por horário + modalidade (uma linha por dia no banco; `planScheduleGroup` grava só a diferença; desmarcar um dia DESATIVA). Apagar horário mantém os check-ins (`schedule_id` vira null). Modalidades em `academy_modalities`, escolhidas no cadastro da academia (`create_academy(name, modalities)`).
  - **Configurações da academia** (`academy/settings`, Perfil → Gestão da academia): logo, nome, fuso (`BR_TIMEZONES`) e modalidades (adicionar, renomear, remover).
  - **Logo:** bucket PÚBLICO `academy-logos` (decisão do usuário: logo é marca e aparece antes de o aluno entrar). Caminho `<academy_id>/logo-<timestamp>.jpg`, sempre um arquivo novo (sem cache velho de CDN); a antiga é apagada depois. Escrita só pelo professor da academia (RLS em `storage.objects`); limite de 2 MB, só JPEG/PNG/WebP. O app recorta em quadrado (`expo-image-picker`) e reduz para 512 px JPEG (`expo-image-manipulator`).
  - **Prévia antes de entrar:** `get_academy_preview_by_code` (nome + logo) na tela "Entrar com código"; o convite por link também mostra a logo. Testar storage local exige subir a stack COM `storage-api`.
- [ ] 3. Água + widget de água: perfil, meta automática, eventos, storage compartilhado, widget interativo iOS/Android, sync
- [ ] 4. Competidores + widget de contagem: convite, campeonatos, inscrições, plano de água semanal, peso, widget countdown
- [ ] 5. Dieta: cadastro e visualização do plano diário
- [ ] 6. Polimento: estados vazios, erros, acessibilidade, revisão dos TODO(motion)

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

**Testes:** 87 testes pgTAP em `supabase/tests/database/rls.test.sql` (duas academias, professor + 2 alunos em cada, um competidor). Rodam também no remoto (`npx supabase test db --remote --yes`, tudo em rollback): o arquivo faz `set local role postgres` e localiza o schema do pgTAP. O "hoje" dos check-ins usa Pago Pago (UTC−11) × Kiritimati (UTC+14), sempre em datas diferentes.

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

1. **Validação do usuário** da Fase 1 e da paleta/tipografia no aparelho. Já conferido no simulador iPhone 17 Pro: login e deep link de convite (preview anônimo) em claro e escuro. As telas autenticadas (tabs) NÃO foram conferidas visualmente; o fluxo delas foi validado via API e pelos testes pgTAP.
2. **Decisões de produto pendentes** (levantadas pela revisão de segurança):
   - só o DONO aprova professores e gira o link de professor?
   - links de professor expiram?
   - rejeitado pode pedir de novo sem limite (hoje: pode)?
3. **Google Sign-In:** precisa dos client IDs do Google Cloud. Apple precisa de time de assinatura + `[auth.external.apple]` no `config.toml`.
4. **Produção:** ligar a confirmação de e-mail (`enable_confirmations`) e Universal/App Links (precisa de domínio).
5. **Fase 2:** `belt_goals`, `class_schedules`, `checkins` (ligados a `memberships`), faixa atual no vínculo, sequência semanal (regra pura + teste).

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
- **Convite pendente:** só é apagado em sucesso ou erro definitivo. Em erro de rede, fica guardado para tentar de novo.
- **`Card`:** as margens vão para o contêiner externo (com a borda), e o resto estiliza a face. Margem na face esticava a borda cinza.
- **Apple:** o nome só vem na PRIMEIRA autorização, e o `authService.signInWithApple` grava no perfil na hora.
- **Android emulador:** `EXPO_PUBLIC_SUPABASE_URL=http://10.0.2.2:54321`.
