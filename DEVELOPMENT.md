# Kimi — Contexto de Desenvolvimento

> Arquivo mantido pelo agente mobile-senior-dev. Leia isto antes de continuar o desenvolvimento.
> Última atualização: Fase 1 (Fundação) — 2026-11-03

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
- **Supabase local** (CLI 3.0 via Homebrew + Docker).
  - O pacote npm `supabase` NÃO entra no package.json, por conflito de peer deps.
  - Migrations em `supabase/migrations`, testes pgTAP em `supabase/tests/database`.
- **Sessão Supabase:** persistida com `expo-sqlite/localStorage/install`, como recomenda o guia oficial do Expo. Auto-refresh ligado ao `AppState`.
- **Preferências locais** (academia ativa, token de convite pendente): `expo-sqlite/kv-store` (síncrono), em `infra/storage`.
- **Design** (sem `design/` nem Figma; proposta derivada da spec e aprovada pelo usuário):
  - Base neutra grafite/off-white e destaque **vermelho** `#E10600` (dark: `#F2241B`).
  - Erro e "recusado" usam o mesmo matiz, mas sempre com ícone + texto e nunca como botão preenchido. O vermelho preenchido é só para a ação primária.
  - Barlow Condensed (números grandes, títulos, botões) + Barlow (texto).
  - Raios 6/8/12, nunca pílula. Elementos táteis com borda inferior de 4px (`theme.edge.tactile`), num tom `*Edge` mais escuro.
- **Produto** (decisões do usuário, 2026-11-03):
  - Cadastro aberto = cria academia e vira professor.
  - Alunos e professores extras entram SÓ por link reutilizável (um por academia + papel), via deep link `kimi://convite/<token>`. O vínculo fica **pendente** até um professor aprovar.
  - Login por e-mail+senha + Apple/Google.
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
  components/           Box, Text, Icon, Button (tátil), TextButton, TextField, Screen, Card, EmptyState
  theme/                palette, fonts, theme (light/dark), useAppTheme, useSchemeTheme
  utils/                deepLinks, haptics
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
- **Tipos do banco:** `npm run db:types` após cada migration.
- **Componentes:** `Screen` sempre esconde as barras de rolagem e recebe `footer` para a ação primária fixa. Dentro das tabs, usar `bottomInset={false}`.

## 4. Mapa de progresso (fases)

- [x] 1. Fundação: Expo + Supabase + auth + academias/vínculos/papéis + RLS + navegação por papel + design tokens. **CONCLUÍDA**, aguardando validação do usuário.
- [ ] 2. Aulas: horários, check-in, confirmação, total de aulas, faixa, sequência semanal
- [ ] 3. Água + widget de água: perfil, meta automática, eventos, storage compartilhado, widget interativo iOS/Android, sync
- [ ] 4. Competidores + widget de contagem: convite, campeonatos, inscrições, plano de água semanal, peso, widget countdown
- [ ] 5. Dieta: cadastro e visualização do plano diário
- [ ] 6. Polimento: estados vazios, erros, acessibilidade, revisão dos TODO(motion)

## 5. Domínios & features implementados

### Banco (`supabase/migrations/20261103195713_foundation.sql`)

**Tabelas:**
- `profiles` (id = `auth.users.id`, `full_name`; criado por trigger no signup a partir de `full_name`/`name` do metadata);
- `gyms` (`created_by` = dono, `on delete set null`);
- `memberships` (`role` student|competitor|professor, `status` pending|active|rejected, `decided_by/at`, único por gym+user);
- `gym_invites` (`role` student|professor, `token` de 144 bits url-safe, `revoked_at`; no máximo 1 ativo por gym+role).

**Mudanças em relação à spec:**
- nomes em inglês;
- `usuarios` → `profiles`;
- check-in vai ligar em `memberships` (fase 2);
- peso/altura/garrafa vão para uma tabela própria com RLS mais restrita (fase 3).

**Segurança:**
- Default privileges revogados: anon/authenticated não ganham nada em tabelas e funções novas, e o PUBLIC perde EXECUTE em funções novas. Toda tabela/RPC nova precisa de `grant` explícito.
- Helpers RLS em `private` (não exposto), SECURITY DEFINER e ancorados em `auth.uid()`:
  - `has_membership_or_request` (inclui pending, SÓ para dado pouco sensível);
  - `is_active_member`, `is_professor`;
  - `can_view_profile` (ativo na mesma academia, ou professor vendo pedido pendente).
  - **Para dados de saúde, usar só `is_active_member`/`is_professor`.**
- Escrita só via RPC:
  - `create_gym`: cria academia + vínculo professor ativo + 2 links;
  - `get_invite_preview`: única RPC liberada para anon;
  - `request_membership`: sempre pending; não rebaixa ativo; rejeitado pode pedir de novo;
  - `decide_membership`: só professor, só pending;
  - `remove_membership`: não remove a si mesmo nem o dono;
  - `rotate_invite`;
  - `list_pending_requests`: devolve o e-mail do solicitante para o professor saber quem aprova.
- O update direto só é permitido em `profiles.full_name` e `gyms.name` (professor).

**Testes:** 46 testes pgTAP em `supabase/tests/database/foundation.test.sql` (isolamento entre academias, anon, escalada de papel, professor pendente, remoção, privilégios padrão).

### App

- **Auth:** e-mail/senha (mínimo 8, alinhado ao `config.toml`) e Apple (`signInWithIdToken` com nonce). O Google está pendente.
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
  - Botões de login rápido em `screens/auth/DevQuickLogin.tsx`, renderizados só com `__DEV__`. Credenciais em `src/dev/devAccounts.ts` (alias `@dev/*`).
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
