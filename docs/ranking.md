# Ranking contínuo do Kimi

A interface possui uma lista contínua independente por modalidade, sem ranking geral, navegação por mês ou campeões mensais. O aluno seleciona apenas as modalidades nas quais tem matrícula ativa; a equipe pode consultar cada modalidade da academia. A janela móvel usa os últimos **28 dias completos**, no calendário da academia. Essa decisão segue o pedido de uma lista contínua, que tem precedência sobre o exemplo mensal do briefing. A janela evita acúmulo indefinido de penalidades e permite recuperação. `rankingPeriod` aceita outra duração; o serviço aceita `{ from, to }` inclusivo para períodos personalizados, limitados a 366 dias. O dia atual fica fora dos denominadores, pontos e penalidades.

## Arquitetura e fonte de verdade

O ranking mensal existente foi substituído, preservando o módulo `Ranking`, React Query, design system, autorização por academia, fotos privadas e `profiles.show_in_ranking`. As duas RPCs mensais foram removidas, sem apagar check-ins ou históricos pessoais.

`academy_ranking_facts(academy_id, modality_id, from, to)` exige modalidade e período e reúne fatos já filtrados no banco em uma chamada: membros ativos que optaram por aparecer, obrigações de aulas e cumprimento diário das metas. O servidor verifica autorização e deriva conclusão a partir de check-ins confirmados e consumo/meta. Não aceita pontuação, proteção ou conclusão enviados pelo cliente. Não expõe pesos, litros ou metas numéricas dos colegas; expõe datas e resultados necessários ao cálculo e aos congelamentos. Não há chamadas de rede por aluno/aula/dia.

`calculateRanking` é a única implementação da pontuação, na camada de domínio, permitida pelo briefing. Calcula a exibição usando os fatos autenticados. Não há score persistido nem endpoint que aceite score; editar estado local não altera fatos de outros usuários ou qualquer classificação armazenada no servidor. Se houver prêmios, pagamentos ou decisões de acesso baseados na posição, essa mesma função deverá ser executada em um ambiente servidor antes de concedê-los; o resultado apresentado pelo dispositivo não é uma credencial.

Não existe ledger de penalidades ou congelamentos novo. A consulta não escreve nada. Repetir o cálculo produz o mesmo resultado com os mesmos fatos; correções legítimas de presença/justificativa e sincronização offline de água atualizam os fatos. O cache é invalidado após confirmações, vínculos com turmas e sincronização de água; consultas ativas atualizam a cada minuto e ao retornar ao app. O calendário também atualiza a cada minuto para atravessar a meia-noite.

## Algoritmo

Parâmetros centralizados em `src/domain/Ranking/rankingConfig.ts`:

- Frequência: 60% (`confirmados / aulas obrigatórias elegíveis`).
- Hidratação: 40% (`dias com meta atingida / dias com meta válida elegíveis`).
- Cada falta obrigatória sem justificativa: −5 pontos.
- Cada falha de água sem proteção: −5 pontos.
- Falha de água congelada: sem desconto adicional, permanece no denominador e não conta como meta cumprida.
- Pontuação: `max(0, min(100, desempenho - penalidades))`.
- Participação competitiva: sete **datas distintas** com ao menos uma obrigação elegível. Antes disso, score individual, status "Em classificação", dias restantes e nenhuma posição.

Um critério sem oportunidades elegíveis fica em zero, sem inventar participação ou redistribuir os pesos. Assim, somente hidratação permite até 40 pontos; sem metas de água conhecidas, somente frequência permite até 60. Isso é mostrado nos detalhes da interface. Um dia com aula e água conta uma vez para classificação/desempate. Água acima da meta não muda o resultado booleano.

Ordenação: classificados primeiro; score, proporção de frequência, proporção de hidratação, número de datas com atividade realmente concluída e UUID estável. O cálculo não arredonda para ordenar; a interface mostra uma casa decimal. Não utiliza volume consumido, antiguidade ou contagem absoluta de aulas como desempate.

## Elegibilidade das aulas

A arquitetura anterior possuía horários recorrentes e check-ins opcionais, mas **não** matrícula em modalidade/turmas, obrigação individual, cancelamento ou justificativa. Não havia dados seguros para presumir faltas.

A nova tabela `student_class_enrollments` registra apenas compromissos explicitamente atribuídos pela equipe. Em **Alunos → perfil do aluno → Turmas obrigatórias**, a equipe pode tornar uma turma obrigatória ou opcional, com confirmação. Inclusões e remoções valem amanhã, impedindo faltas retroativas pelo aplicativo. Nenhum aluno existente recebe turma automaticamente. Sem vínculos, não há faltas presumidas; aulas opcionais não entram no numerador nem no denominador, evitando vantagem por mais horários disponíveis.

Cada compromisso preserva dia da semana, horário, modalidade e identidade original do horário. Apenas datas encerradas após ativação da matrícula entram. Duplicatas são impedidas pelo índice existente de check-ins e deduplicadas defensivamente no domínio. Alterações/desativação/exclusão do horário encerram o vínculo antigo a partir do dia da alteração, preservando o passado e exigindo novo vínculo explícito. Identidade original do check-in permite contar presenças mesmo após exclusão do horário.

O vínculo com a turma só pode ser criado se houver matrícula ativa na modalidade correspondente. Suspender a modalidade mantém o vínculo com as turmas, mas exclui obrigações durante a suspensão; ao retomar a matrícula, os compromissos anteriores voltam a valer em dias completos. Encerrar e reativar uma matrícula também preserva o histórico e os vínculos com turmas. A equipe pode tornar turmas opcionais separadamente.

O app admite check-in durante o dia inteiro, sem deadline por horário: o fechamento seguro adotado é a meia-noite da academia. Somente `confirmed` conclui uma obrigação; check-ins pendentes/rejeitados não geram conclusão, e confirmação posterior corrige a pontuação automaticamente.

`class_attendance_exceptions` registra cancelamentos (sem `membership_id`) ou justificativas individuais (com matrícula), com motivo obrigatório. Exclui a obrigação inteira. RLS permite administração somente à equipe da academia correspondente. Não havia fluxo de justificativas/cancelamentos: esta entrega disponibiliza a estrutura e a API de tabela para correções administrativas, **sem uma nova tela de gestão de exceções**.

## Metas históricas e congelamentos

O app já possuía `water_goal_days`, mas permitia escrita/alteração pelo cliente e inferia metas antigas pela primeira/última conhecida. Foram preservadas observações históricas exatas, e removida a possibilidade de o cliente reescrever metas. `record_my_water_goal()` não recebe usuário, data ou meta: deriva a meta no servidor. Histórico automático começa na instalação da migração, sem projetar o peso atual para o passado. Mudanças de peso e de planos registram versões efetivas no dia, preservando dias anteriores. Um peso nulo também é uma versão válida de "sem meta".

O plano mais recente por semana/última edição substitui a meta automática, seguindo a regra existente, inclusive entre academias. Versões de plano com metas nulas significam retorno ao automático. A fórmula automática existente continua sendo 35 ml/kg. Metas válidas ficam entre 1 e 20.000 ml. O histórico existente anterior à migração só conta nas datas com observação exata; dados desconhecidos são excluídos da hidratação. `my_water_days` passou a utilizar o mesmo histórico protegido; não preenche mais o passado com valores inventados.

O congelamento existente é **automático e derivado**, sem estoque gravado:

- Água: um congelamento a cada sete dias concluídos na sequência, máximo de dois; protege um dia de hidratação.
- Treino: um congelamento a cada quatro semanas concluídas, máximo de dois; protege a ofensiva semanal (uma aula confirmada na semana).

O ranking chama o mesmo `computeStreak` e `WATER_STREAK_RULE` existentes, com histórico anterior à janela, e consulta os períodos `frozen`. Não reinicia o estoque na virada da janela, não cria uma segunda regra de consumo e não estende o congelamento de água/semana a faltas individuais. Um dia congelado não gera pontos positivos. Datas sem meta não geram penalidades de ranking; os períodos da ofensiva continuam seguindo o comportamento já existente.

## Banco e limitações

Migrações de base: `supabase/migrations/20261105025434_gamified_ranking.sql` e `20261105025845_ranking_unknown_approval_start.sql`. Separação por modalidade: `supabase/migrations/20261105031124_modality_ranking.sql`.

Cria dois modelos públicos (`student_class_enrollments`, `class_attendance_exceptions`), três históricos privados (`membership_active_periods`, `water_auto_goal_history`, `water_plan_goal_history`), triggers de histórico, duas RPCs de escrita restrita e uma RPC de fatos, além de índices e identidade histórica das ocorrências. Revoga escrita direta de metas e mudanças destrutivas de identidade de planos. Mantém RLS, opt-out e controle de acesso; funções privilegiadas têm `search_path` vazio e grants explícitos.

Não havia pausas/suspensões ou histórico de estado completo: a elegibilidade inicial usa a maior data entre criação e aprovação conhecida. Sem data de aprovação, a migração de segurança `20261105025845_ranking_unknown_approval_start.sql` começa a elegibilidade agora, sem tratar a solicitação de entrada como aprovação. Futuras entradas/saídas do estado ativo geram intervalos próprios; dias parciais de ativação/desativação ficam fora. Pausas antigas desconhecidas não podem ser reconstruídas. Não foi criado um fluxo paralelo de suspensão.

A academia usa `America/Sao_Paulo`, fixado por decisão anterior do produto. O ranking agrupa água pelo fuso da academia; a ofensiva pessoal continua usando o fuso do perfil. Se o usuário mudar o perfil para outro fuso, seus fechamentos pessoais podem diferir do ranking. Unificar esses dois calendários requer uma decisão de produto; não alteramos o fuso pessoal silenciosamente.

As observações legadas foram originalmente autodeclaradas e não podem ser autenticadas retroativamente. A proteção de escrita e a captura de versões valem a partir desta migração. Consumo de água continua autodeclarado/offline, conforme o produto existente. O ranking não torna esse dado uma medição independente.

Para preservar congelamentos, a RPC devolve o histórico booleano conhecido de hidratação, não apenas a janela. Consultas são indexadas e agregadas numa chamada; em bases com muitos anos/alunos, considerar snapshots de estado da ofensiva ou cálculo no servidor usando o mesmo módulo de domínio antes de aumentar a escala. Não se deve cortar o histórico arbitrariamente porque isso muda o estoque de congelamentos.

## Arquivos e validação

- `src/domain/Ranking/`: configuração, cálculo, tipos, consulta e vínculos com turmas.
- `src/screens/ranking/`: lista/detalhes da pontuação e gestão de compromissos de aula.
- `src/screens/professor/MemberDetailScreen.tsx`: integração das turmas obrigatórias.
- `src/screens/staff/StaffHome.tsx`: resumo do ranking contínuo.
- `src/domain/Classes/useCases/useClasses.ts`, `src/domain/Water/useCases/useWater.ts`, `src/services/water/useWaterSync.ts`: calendário/cache.
- `src/domain/Streaks/streakApi.ts`, `src/services/water/useRecordWaterGoal.ts`: meta derivada no servidor.
- `src/infra/query/queryKeys.ts`, `types/database.ts`: chaves e contratos.
- `supabase/tests/database/ranking.test.sql`, `water_streak.test.sql`, `src/domain/Ranking/__tests__/rankingRules.test.ts`: comportamento e segurança.

Validação concluída: 222 testes Jest (23 suítes), 556 testes pgTAP (12 arquivos), TypeScript, Expo lint, lint SQL e replay da migração em banco sombra com diff vazio. As migrações de base foram aplicadas no Supabase conectado ao app. A migração de modalidades deve ser aplicada e verificada antes de usar a nova interface. Os avisos de políticas permissivas em `checkins`/`memberships` e da volatilidade de `is_valid_timezone` antecedem esta alteração. O advisor remoto também sinaliza funções SECURITY DEFINER expostas a authenticated: nas novas RPCs isso é intencional para agregar dados sob RLS e capturar históricos, com validação explícita do usuário/academia e privilégios mínimos. Acesso de anon foi revogado. O aviso de proteção contra senhas vazadas é anterior e não foi alterado. Não foi realizada validação visual no simulador nesta entrega.


## Matrícula e ranking por modalidade

`student_modality_enrollments` referencia a matrícula existente na academia e `academy_modalities`, sem copiar alunos, modalidades ou água. Tem um vínculo único por matrícula/modalidade e estados `active`, `suspended`, `ended`. `private.modality_active_periods` preserva cada intervalo ativo, inclusive depois de suspensões, saídas e retornos. Escrita direta pelo cliente é revogada; `set_student_modality_enrollment` valida a equipe, a academia e a modalidade, serializa alterações pelo vínculo principal e mantém os intervalos na mesma transação. Repetir uma ativação não abre outro intervalo.

A equipe gerencia esses vínculos em **Alunos → perfil do aluno → Matrículas por modalidade**, com confirmação para ativar, suspender, reativar ou encerrar. Não existiam matrículas explícitas por modalidade antes desta entrega. A migração só reconhece como evidência os vínculos obrigatórios ainda ativos com turmas existentes, usando o momento em que foram criados. Check-ins opcionais e presença na academia não matriculam ninguém automaticamente em modalidades. Os demais vínculos devem ser confirmados pela equipe; sem vínculo, o aluno não aparece naquele ranking.

A API não conserva a sobrecarga antiga sem modalidade. `fetchRanking({ academyId, modalityId, startDate, endDate })` exige os quatro parâmetros. A RPC valida a modalidade na academia e, para alunos, também o próprio vínculo elegível; um aluno de Muay Thai não pode consultar o ranking de BJJ alterando o identificador manualmente. A equipe pode consultar qualquer modalidade da própria academia. `ranking_modalities` retorna as opções autorizadas; não há opção "Geral".

O banco filtra os participantes por vínculo com a modalidade. A frequência exige `student_class_enrollments.modality_id` e `checkins.modality_id` iguais à modalidade solicitada. Cada obrigação também precisa de um dia elegível na matrícula da academia **e** na matrícula da modalidade. A ausência em uma modalidade nunca entra nos fatos de outra.

A hidratação mantém uma única origem individual. O mesmo histórico de resultados e congelamentos é retornado para todas as modalidades, sem cortar o histórico no início de uma modalidade e sem escrever registros adicionais. Só a marca de elegibilidade diária varia: entram dias completos pertencentes aos dois vínculos ativos e ao intervalo solicitado. Isso permite metas, penalidades e classificação diferentes quando uma modalidade começou mais tarde, preservando exatamente a mesma proteção de água em uma data compartilhada. Não existe evento de penalidade duplicado por modalidade: a pontuação é uma projeção de fatos, não um ledger de descontos gravados.

A consulta atual (intervalo terminando ontem) inclui apenas matrículas de modalidade atualmente ativas. Consultas históricas terminando antes de ontem incluem os vínculos que tiveram intervalos ativos naquele período, mesmo se hoje suspensos/encerrados. O denominador respeita cada pausa e saída. O vínculo principal da academia e o opt-out continuam respeitados. Se o cadastro principal for apagado, o histórico dependente segue o comportamento de exclusão existente; esta entrega não restaura matrículas apagadas.

Cada resultado carrega `modalityId`; o domínio rejeita conjuntos com modalidades misturadas. Cache e requisição incluem academia, modalidade e ambas as datas. Ao trocar a escolha, a tela passa a usar a consulta correspondente, sem reutilizar dados da modalidade anterior como placeholder; as linhas também têm identidade por modalidade/aluno, reiniciando detalhes expandidos. O resumo da tela inicial mostra o nome da modalidade correspondente ao seu top 3, sem somar rankings.

Testes adicionais: separação real no SQL de participantes, check-ins, obrigações e datas; duas matrículas simultâneas; exclusão de não matriculados; hidratação compartilhada; pausa/saída/retorno e histórico; controle de acesso e idempotência; congelamento compartilhado e penalidade de aulas isolada no domínio; cache/requisição por modalidade/período e troca da seleção da interface com substituição de todos os dados da linha. O teste de interface inspeciona elementos React com hooks controlados, sem adicionar um renderer nativo; não substitui validação visual no simulador.

Arquivos adicionais desta etapa: `src/domain/Ranking/useCases/useModalityEnrollments.ts`, `src/screens/ranking/StudentModalityEnrollments.tsx`, `src/domain/Ranking/__tests__/rankingService.test.ts`, `rankingView.test.tsx`, `supabase/tests/database/ranking_modalities.test.sql` e a migração de modalidades. Também foram atualizados o cálculo/tipos e testes existentes de ranking, a consulta, o seletor da tela, a atribuição de turmas, o perfil do aluno, o resumo inicial, chaves de cache, mensagens de erro e os tipos do banco.
