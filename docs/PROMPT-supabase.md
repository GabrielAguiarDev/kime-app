# Prompt — Conexão com o Supabase e criação do banco

Conecte o app Kimi a um projeto Supabase hospedado (não local), crie todo o banco por migrations e ligue o app a ele. Trabalhe nas etapas abaixo, nesta ordem, e me mostre um resumo ao final de cada uma. Se você tiver as skills do Supabase disponíveis, siga-as.

## Configuração do projeto (já feita no painel)

- Data API ligada.
- **Tabelas novas não são expostas automaticamente.** Toda tabela precisa de `GRANT` explícito na migration.
- **RLS automático ligado** em toda tabela nova do schema `public`. Toda tabela precisa de políticas, senão não retorna nenhuma linha.

## Regras de segurança (valem para todas as etapas)

- Nunca use nem peça a `service_role` / secret key no app. O app usa só a URL e a **publishable key** (ou a anon key, se for a única disponível).
- `GRANT` apenas para o role `authenticated`. Nada para `anon`, a menos que eu peça.
- Toda política combina `TO authenticated` com uma condição de propriedade ou de academia. Nunca só `TO authenticated`.
- Políticas de UPDATE sempre com `USING` e `WITH CHECK`. Lembre que UPDATE também precisa de uma política de SELECT.
- Nunca use `auth.role()` nem `user_metadata` em decisões de autorização.
- Nunca use `SECURITY DEFINER` para resolver erro de permissão. As únicas exceções permitidas estão descritas abaixo; nelas, use `set search_path = ''`, valide `auth.uid()` dentro da função e explique o motivo no comentário.
- Views, se houver, com `security_invoker = true`.
- Fixe as versões dos pacotes e faça commit do lockfile.

## Etapa 1 — Conexão

1. Verifique a versão da Supabase CLI e consulte `--help` antes de usar qualquer comando; não confie em comandos de memória. Consulte também o changelog do Supabase para mudanças que afetem esta tarefa.
2. Me peça o *project ref*. O login e o `link` com o projeto eu faço junto com você no terminal; não peça nem grave a senha do banco em nenhum arquivo.
3. Crie `.env` com `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (eu preencho os valores), um `.env.example` sem valores e garanta que `.env` está no `.gitignore`.
4. Crie `lib/supabase.ts` com o cliente do `supabase-js` configurado para React Native: sessão persistida com armazenamento seguro (`expo-secure-store`, usando uma estratégia que suporte sessões maiores que o limite do Secure Store) e auto-refresh do token ligado e desligado conforme o `AppState`.

## Etapa 2 — Schema

Crie as migrations com `supabase migration new <nome>`, uma por assunto. Nomes técnicos em inglês. Use `uuid` como chave, `created_at`/`updated_at` em `timestamptz`, chaves estrangeiras com índice e `on delete` adequado.

**Enums:** `membership_role` (`professor`, `student`), `checkin_status` (`pending`, `confirmed`, `rejected`).

**Tabelas:**

- `profiles` — `id` (= `auth.users.id`), `full_name`, `weight_kg`, `height_cm`, `bottle_ml` (nulo até o usuário configurar), `timezone` (padrão `America/Sao_Paulo`). Criada automaticamente no cadastro por um trigger em `auth.users`.
- `academies` — `name`, `invite_code` (único, gerado automaticamente), `created_by`.
- `memberships` — `user_id`, `academy_id`, `role`, `is_competitor` (padrão `false`), `belt`. Único por (`user_id`, `academy_id`). Um usuário pode estar em várias academias.
- `belt_goals` — `academy_id`, `belt`, `position` (ordem), `classes_required`.
- `class_schedules` — `academy_id`, `weekday` (0–6), `start_time`, `modality`, `active`.
- `checkins` — `user_id`, `academy_id`, `schedule_id`, `class_date`, `status` (padrão `pending`), `reviewed_by`, `reviewed_at`. Único por (`user_id`, `schedule_id`, `class_date`).
- `water_logs` — `id` gerado **no app** (para sincronização offline idempotente via upsert), `user_id`, `amount_ml`, `logged_at`.
- `water_plans` — `athlete_id`, `academy_id`, `week_start`; e `water_plan_days` — `plan_id`, `weekday`, `target_ml`.
- `diet_plans` — `athlete_id`, `academy_id`, `plan_date`; e `diet_plan_meals` — `plan_id`, `position`, `name`, `meal_time`, `description`.
- `weight_logs` — `athlete_id`, `logged_on`, `weight_kg`.
- `championships` — `academy_id`, `name`, `event_date`, `location`.
- `championship_entries` — `championship_id`, `athlete_id`. Único por par.

Se encontrar uma modelagem melhor, explique antes de mudar.

## Etapa 3 — Acesso e RLS

**Funções auxiliares** (exceção permitida de `SECURITY DEFINER`, para evitar recursão de RLS em `memberships`): crie em um schema **não exposto** (ex. `private`), marcadas como `stable`, retornando booleano:
- `private.is_member(academy_id)`
- `private.is_professor(academy_id)`
- `private.is_competitor_of(athlete_id, academy_id)`

O trigger que cria o `profile` no cadastro também pode ser `SECURITY DEFINER`, no schema `private`.

**Fluxos por RPC** (exceção permitida, só se não houver outra forma; me explique antes): `create_academy(name)` cria a academia e o vínculo do criador como `professor` numa única transação; `join_academy(invite_code)` cria o vínculo do usuário atual como `student`. `EXECUTE` revogado de `PUBLIC` e `anon`, concedido só a `authenticated`.

**Políticas:**

| Tabela | Aluno / competidor | Professor da academia |
|---|---|---|
| `profiles` | Lê e edita o próprio | Lê perfis dos membros da academia |
| `academies` | Lê as academias em que é membro | Lê e edita a própria academia |
| `memberships` | Lê os próprios vínculos | Lê, edita (`belt`, `is_competitor`, `role`) e remove vínculos da academia |
| `belt_goals`, `class_schedules` | Lê | CRUD |
| `checkins` | Cria o próprio, sempre `pending`, só em aula da sua academia; lê os próprios; apaga o próprio enquanto `pending` | Lê e muda `status` dos check-ins da academia |
| `water_logs` | CRUD dos próprios | Lê os registros dos competidores da academia |
| `water_plans`, `water_plan_days`, `diet_plans`, `diet_plan_meals` | Competidor lê os próprios | CRUD para competidores da academia |
| `weight_logs` | Competidor cria e lê os próprios | Lê dos competidores da academia |
| `championships`, `championship_entries` | Competidor lê os campeonatos em que está inscrito | CRUD |

O aluno nunca pode alterar `status` de check-in, `role`, `is_competitor` nem `belt`.

## Etapa 4 — Verificação do banco

1. Aplique as migrations no projeto (`supabase db push`, confirmando o comando com `--help`).
2. Rode os advisors do Supabase e corrija tudo que aparecer.
3. Escreva testes de RLS (ex. com `supabase test db`) com duas academias, um professor e dois alunos em cada, e um competidor. Confirme no mínimo que: um usuário não lê nada de outra academia; o aluno não consegue confirmar o próprio check-in; o aluno não vê plano de água/dieta; o professor não vê `water_logs` de quem não é competidor da academia dele.
4. Gere os tipos TypeScript a partir do banco em `types/database.ts`.

## Etapa 5 — Ligar o app

1. Autenticação com e-mail e senha: cadastro, login, logout e sessão persistida.
2. Depois do login, se o usuário não tiver vínculo, mostrar a escolha entre criar academia e entrar com código de convite.
3. Substitua qualquer dado mockado pelas consultas reais, usando os tipos gerados.
4. Registro de água: grava localmente primeiro (incluindo no armazenamento compartilhado com o widget) e sincroniza com `water_logs` via upsert pelo `id` gerado no app.

Não mexa no visual nem em animações nesta tarefa. Ao final, liste o que eu preciso fazer manualmente (preencher o `.env`, configurar o Auth no painel etc.).
