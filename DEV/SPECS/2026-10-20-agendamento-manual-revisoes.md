# SPEC ARQUIVADA — Agendamento manual de revisões (Gerenciador)

Status: **concluída** (implementada e verificada em 2026-10-20)
Arquivada em: 2026-10-20 (virou `ACTIVE.md` a spec do cronograma reverso)
Área: `src/lib/study-sessions/actions.ts`, `src/lib/srs.ts`, `src/lib/srs-review-utils.ts`

## Problema

`scheduleTopicReviews()` calculava o array de dias (`[1,7,15]`, `[2,2,2,2]`) mas só
usava `reviewDays[0]`. O resto do array era decorativo: nenhuma data era gravada,
nada aparecia no calendário, e o rótulo da UI ("1, 7 e 15 dias" / "A cada 2 dias")
era uma promessa que o banco não cumpria.

Pior: a ação só escrevia em `ProgressCard.nextReviewDate`, que é **uma das três**
fontes de "quando revisar" do sistema. O calendário lê `ScheduledReview`; o
preview do cliente re-deriva de `CYCLES[classification]`. Por isso os dias 7 e 15
desapareciam.

## Causa raiz

1. `reviewDays[0]` — o array era lido e descartado (bug original).
2. `ScheduledReview.cycleId` é FK obrigatória: agendar revisões **exige** criar um
   `ReviewCycle`, e `ReviewCycle` ACTIVE é o gatilho da máquina de estados do SRS.
   Criar ciclos ingênuosamente mataria a etapa de classificação por IA
   (`classifyAndCreateCycle` lança "Este card já possui um ciclo de revisão ativo")
   e travaria a renovação.
3. A convenção do SRS é **não-cumulativa** (intervalos contados da data-base).
   Lido assim, `[2,2,2,2]` colapsa as 4 revisões no mesmo dia.

## Decisões (maestro)

| Decisão | Escolha |
|---|---|
| Classificação encontra ciclo pré-agendado | **Adotar** — preserva as datas do usuário |
| Semântica de `[2,2,2,2]` | **Passos de 2 dias** → +2, +4, +6, +8 |
| Card já com ciclo ativo | **Não mexer** e reportar (`skipped`) |

## Escopo entregue

- `resolveManualSchedule(type, baseDate)` — resolve o plano em datas absolutas
  distintas (`offset` para padrão, `step` para intensiva). Fonte única, pura.
- `scheduleTopicReviews` — cria `ReviewCycle` (ACTIVE,
  `initialCycleEvaluationCompleted: false`) + uma `ScheduledReview` por dia,
  em transação por card. Card com ciclo ativo é pulado (progresso preservado).
- `adoptPreScheduledCycle` — a classificação **adota** o ciclo pré-agendado:
  grava a dificuldade e preserva as datas; revisões vencidas são consumidas.
- `deriveReviewState` — ciclo pré-agendado **não** é "ciclo em curso": o card
  volta a `AGUARDANDO_AVALIACAO_24H` e a avaliação por IA continua existindo.
- Preview do cliente passa a usar o cronograma **persistido** (não re-deriva da
  dificuldade, que mentiria para datas escolhidas manualmente).
- `scheduleTopicReviews` devolve `{ success, created, skipped, failed }`.

## Critérios de aceite

- [x] `standard` agenda 3 revisões em +1, +7, +15 dias (uma `ScheduledReview` cada).
- [x] `intensive` agenda 4 revisões em +2, +4, +6, +8 dias, todas distintas.
- [x] As revisões agendadas aparecem no calendário de revisões (que lê `ScheduledReview`).
- [x] A classificação por IA continua disponível para cards agendados.
- [x] A classificação preserva as datas escolhidas pelo usuário.
- [x] Re-agendar não destrói ciclo em andamento.
- [x] Nenhum card de outro usuário é afetado.

## Fora de escopo

- Não há migração de banco: `initialCycleEvaluationCompleted` já existia no schema.
- `CYCLES` (intervalos por dificuldade) não muda — é o SRS clássico, intacto.
- Cards com ciclo `COMPLETED` e sem ciclo ativo recebem um novo ciclo
  pré-agendado (o estado passa a ser "aguardando avaliação").
