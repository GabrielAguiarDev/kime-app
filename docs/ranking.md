# Ranking contínuo do Kimi

A interface possui uma lista contínua independente por modalidade, sem ranking geral, navegação por mês ou campeões mensais. O aluno vê o ranking da modalidade selecionada no header da Início; a equipe escolhe uma modalidade da academia (padrão: a primeira). A janela móvel usa os últimos **28 dias completos**, no calendário da academia. Essa decisão segue o pedido de uma lista contínua, que tem precedência sobre o exemplo mensal do briefing. A janela evita acúmulo indefinido de penalidades e permite recuperação. `rankingPeriod` aceita outra duração; o serviço aceita `{ from, to }` inclusivo para períodos personalizados, limitados a 366 dias. O dia atual fica fora dos denominadores, pontos e penalidades.

## Arquitetura e fonte de verdade

O ranking mensal existente foi substituído, preservando o módulo `Ranking`, React Query, design system, autorização por academia, fotos privadas e `profiles.show_in_ranking`. As duas RPCs mensais foram removidas, sem apagar check-ins ou históricos pessoais.

`academy_ranking_facts(academy_id, modality_id, from, to)` exige modalidade e período e reúne fatos já filtrados no banco em uma chamada: membros ativos que optaram por aparecer, obrigações de aulas e cumprimento diário das metas. O servidor verifica autorização e deriva conclusão a partir de check-ins confirmados e consumo/meta. Não aceita pontuação, proteção ou conclusão enviados pelo cliente. Não expõe pesos, litros ou metas numéricas dos colegas; expõe datas e resultados necessários ao cálculo e aos congelamentos. Não há chamadas de rede por aluno/aula/dia.

`calculateRanking` é a única implementação da pontuação, na camada de domínio, permitida pelo briefing. Calcula a exibição usando os fatos autenticados. Não há score persistido nem endpoint que aceite score; editar estado local não altera fatos de outros usuários ou qualquer classificação armazenada no servidor. Se houver prêmios, pagamentos ou decisões de acesso baseados na posição, essa mesma função deverá ser executada em um ambiente servidor antes de concedê-los; o resultado apresentado pelo dispositivo não é uma credencial.

Não existe ledger de penalidades ou congelamentos novo. A consulta não escreve nada. Repetir o cálculo produz o mesmo resultado com os mesmos fatos; correções legítimas de presença/justificativa e sincronização offline de água atualizam os fatos. O cache é invalidado após confirmações, vínculos com turmas e sincronização de água; consultas ativas atualizam a cada minuto e ao retornar ao app. O calendário também atualiza a cada minuto para atravessar a meia-noite.

## Algoritmo (2026-11-05, validado pelo usuário)

Parâmetros centralizados em `src/domain/Ranking/rankingConfig.ts`. Sempre UMA modalidade (não existe "Todas", nem para owner e professor).

- **Presença (70%)**: a janela de 28 dias completos é dividida em 4 semanas de 7 dias, contadas para trás a partir de ontem. Em cada semana, presença = aulas confirmadas na modalidade ÷ aulas da grade da modalidade nos dias elegíveis da semana, limitada a 100% (decisão do usuário, 2026-11-10: não existe mais meta semanal). A grade de um dia = horários ativos da modalidade naquele dia da semana, criados até aquele dia. Numa semana com só parte dos dias elegíveis (vínculo novo), contam só as aulas desses dias. Semana sem aula na grade fica fora da média. Presença final = média das semanas que contam. Ver `supabase/migrations/20261110020000_attendance_by_schedule.sql`.
- **Água (30%)**: dias em que o aluno cumpriu a PRÓPRIA meta ÷ dias com meta conhecida e elegíveis. Nunca o volume. A meta do dia é a do plano do professor (competidores) ou a automática. Dia de **meta**: cumprido com total ≥ valor. Dia de **limite** (plano): cumprido com total entre 90% e 100% do valor; passar do limite = não cumprido. A água é pessoal: o mesmo histórico vale em todas as modalidades do aluno.
- **Sem penalidades.** Semana congelada da Disciplina (ofensiva semanal única, 2026-11-10): os 7 dias dela saem da conta de presença (aulas confirmadas e da grade) e de água, sem somar nem tirar ponto; continuam contando para a classificação (dias elegíveis). `protected_days` = dias elegíveis da janela dentro de semanas congeladas. Ver `supabase/migrations/20261110050100_ranking_discipline_freezes.sql`.
- **Pontuação** = (0,7 × presença + 0,3 × água) × 100.
- **Classificação**: mínimo de 7 dias elegíveis (vínculo ativo na academia e na modalidade). Antes disso, "Em classificação", sem posição.
- **Desempate**: pontuação, total de aulas confirmadas no período, taxa de água, UUID estável.
- **Tela**: colegas aparecem só com posição, foto, nome e pontuação. O próprio aluno toca na sua linha para ver presença, aulas confirmadas de quantas da grade, dias de água cumpridos e dias protegidos.

`academy_ranking_facts` devolve, por aluno: `weekly_goal`, `attendance` = um item por dia elegível `{day, classes}` (check-ins confirmados da modalidade no dia) e `hydration` (booleano `done` já com a regra de meta/limite; volumes nunca saem do banco).

As "Turmas obrigatórias" (`student_class_enrollments`, `class_attendance_exceptions`, `set_student_class_enrollment`) saíram da interface e não entram mais no cálculo. As tabelas e a RPC continuam no banco até confirmarmos que nada depende delas.

## Metas históricas e congelamentos

O app já possuía `water_goal_days`, mas permitia escrita/alteração pelo cliente e inferia metas antigas pela primeira/última conhecida. Foram preservadas observações históricas exatas, e removida a possibilidade de o cliente reescrever metas. `record_my_water_goal()` não recebe usuário, data ou meta: deriva a meta no servidor. Histórico automático começa na instalação da migração, sem projetar o peso atual para o passado. Mudanças de peso e de planos registram versões efetivas no dia, preservando dias anteriores. Um peso nulo também é uma versão válida de "sem meta".

O plano mais recente por semana/última edição substitui a meta automática, seguindo a regra existente, inclusive entre academias. Versões de plano com metas nulas significam retorno ao automático. A fórmula automática existente continua sendo 35 ml/kg. Metas válidas ficam entre 1 e 20.000 ml. O histórico existente anterior à migração só conta nas datas com observação exata; dados desconhecidos são excluídos da hidratação. `my_water_days` passou a utilizar o mesmo histórico protegido; não preenche mais o passado com valores inventados.

O congelamento é o da **Disciplina** (ofensiva semanal única, `supabase/migrations/20261110050000_discipline_weekly.sql`): um a cada 4 semanas cumpridas seguidas, no máximo 2, gasto sozinho na semana perdida. O banco guarda as semanas (`discipline_weeks`: cumprida / congelada / perdida); o `rebuild_rankings` recalcula a Disciplina dos alunos antes de pontuar e tira da conta os 7 dias de cada semana congelada. Não existe mais congelamento de água por dia, e os fatos de água do ranking cobrem só a janela.

## Banco e limitações

Migrações de base: `supabase/migrations/20261105025434_gamified_ranking.sql` e `20261105025845_ranking_unknown_approval_start.sql`. Separação por modalidade: `supabase/migrations/20261105031124_modality_ranking.sql`.

Cria dois modelos públicos (`student_class_enrollments`, `class_attendance_exceptions`), três históricos privados (`membership_active_periods`, `water_auto_goal_history`, `water_plan_goal_history`), triggers de histórico, duas RPCs de escrita restrita e uma RPC de fatos, além de índices e identidade histórica das ocorrências. Revoga escrita direta de metas e mudanças destrutivas de identidade de planos. Mantém RLS, opt-out e controle de acesso; funções privilegiadas têm `search_path` vazio e grants explícitos.

Não havia pausas/suspensões ou histórico de estado completo: a elegibilidade inicial usa a maior data entre criação e aprovação conhecida. Sem data de aprovação, a migração de segurança `20261105025845_ranking_unknown_approval_start.sql` começa a elegibilidade agora, sem tratar a solicitação de entrada como aprovação. Futuras entradas/saídas do estado ativo geram intervalos próprios; dias parciais de ativação/desativação ficam fora. Pausas antigas desconhecidas não podem ser reconstruídas. Não foi criado um fluxo paralelo de suspensão.

A academia usa `America/Sao_Paulo`, fixado por decisão anterior do produto. O ranking agrupa água pelo fuso da academia; a disciplina pessoal continua usando o fuso do perfil. Se o usuário mudar o perfil para outro fuso, seus fechamentos pessoais podem diferir do ranking. Unificar esses dois calendários requer uma decisão de produto; não alteramos o fuso pessoal silenciosamente.

As observações legadas foram originalmente autodeclaradas e não podem ser autenticadas retroativamente. A proteção de escrita e a captura de versões valem a partir desta migração. Consumo de água continua autodeclarado/offline, conforme o produto existente. O ranking não torna esse dado uma medição independente.

Para preservar congelamentos, a RPC devolve o histórico booleano conhecido de hidratação, não apenas a janela. Consultas são indexadas e agregadas numa chamada; em bases com muitos anos/alunos, considerar snapshots de estado da disciplina ou cálculo no servidor usando o mesmo módulo de domínio antes de aumentar a escala. Não se deve cortar o histórico arbitrariamente porque isso muda o estoque de congelamentos.

## Arquivos e validação

- `src/domain/Ranking/`: configuração, cálculo, tipos e consulta.
- `src/screens/ranking/RankingScreen.tsx`: lista (colegas: posição, foto, nome e pontuação) e os números do próprio aluno.
- `src/screens/professor/MemberDetailScreen.tsx`: modalidades do aluno.
- `src/screens/staff/StaffHome.tsx`: resumo do ranking contínuo.
- `src/domain/Classes/useCases/useClasses.ts`, `src/domain/Water/useCases/useWater.ts`, `src/services/water/useWaterSync.ts`: calendário/cache.
- `src/domain/Water/waterApi.ts`, `src/services/water/useRecordWaterGoal.ts`: meta derivada no servidor.
- `src/infra/query/queryKeys.ts`, `types/database.ts`: chaves e contratos.
- `supabase/tests/database/ranking.test.sql`, `water_streak.test.sql` (histórico de metas), `discipline.test.sql`, `src/domain/Ranking/__tests__/rankingRules.test.ts`: comportamento e segurança.

Validação concluída: 222 testes Jest (23 suítes), 556 testes pgTAP (12 arquivos), TypeScript, Expo lint, lint SQL e replay da migração em banco sombra com diff vazio. As migrações de base foram aplicadas no Supabase conectado ao app. A migração de modalidades deve ser aplicada e verificada antes de usar a nova interface. Os avisos de políticas permissivas em `checkins`/`memberships` e da volatilidade de `is_valid_timezone` antecedem esta alteração. O advisor remoto também sinaliza funções SECURITY DEFINER expostas a authenticated: nas novas RPCs isso é intencional para agregar dados sob RLS e capturar históricos, com validação explícita do usuário/academia e privilégios mínimos. Acesso de anon foi revogado. O aviso de proteção contra senhas vazadas é anterior e não foi alterado. Não foi realizada validação visual no simulador nesta entrega.


## Vínculo aluno ↔ modalidade (2026-11-05)

`student_modality_enrollments` é o vínculo do aluno com cada modalidade: `active` ou `ended` (a suspensão saiu; as suspensas viraram encerradas), com `started_at` e o competidor POR modalidade (`is_competitor`, `competitor_since`, convite). `private.modality_active_periods` guarda cada intervalo ativo. Um aluno ativo tem sempre pelo menos um vínculo ativo (constraint trigger adiado, `student_modality_required`). Escrita só pelas RPCs `approve_student` (aprovação com as modalidades) e `set_student_modalities` (o conjunto inteiro, mínimo um); remover encerra o vínculo e preserva aulas e faixas. Ver `supabase/migrations/20261105210000_student_modalities.sql`.

O banco filtra os participantes pelo vínculo com a modalidade; consultas que terminam antes de ontem incluem vínculos que estiveram ativos no período. Para alunos, a RPC exige o próprio vínculo: um aluno de Muay Thai não consulta o ranking de BJJ trocando o identificador.
