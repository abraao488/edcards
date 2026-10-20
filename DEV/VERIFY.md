# VERIFY

Evidências por mudança. Só registre aqui o que foi **executado** e o resultado real.

## 2026-10-20 — Agendamento manual de revisões

| Gate | Comando | Resultado |
|---|---|---|
| Tipos | `npx tsc --noEmit` | sem saída (sem erros) |
| Lint | `npm run lint` | sem erros; 3 warnings pré-existentes (`configuracoes/client.tsx`, `profile-form.tsx`, `public-deck-view.tsx`) |
| Build | `npm run build` | ok (prisma generate + next build) |
| Testes | `npx tsx scripts/srs-tests-a-k.ts` | **19/19** |

### Cobertura do harness A–M

- A–L (regressão do SRS, **inalterados**): todos PASS — a máquina de estados, o
  ciclo do SRS, o filtro de fila, o calendário, o Modo Consulta e a propriedade
  entre usuários continuam iguais.
- M1 `resolveManualSchedule`: padrão → +1/+7/+15; intensiva → +2/+4/+6/+8;
  datas distintas, início do dia, `isFinal` só na última.
- M2 `deriveReviewState`: ciclo pré-agendado → `AGUARDANDO_AVALIACAO_24H`;
  ciclo classificado → `CICLO_ATIVO`; sem `firstReviewAt` → `FIRST_RESOLUTION`.
- M3 `scheduleTopicReviews("standard")`: cria `ReviewCycle` ACTIVE
  (`initialCycleEvaluationCompleted=false`, `totalReviews=3`) + 3
  `ScheduledReview` em +1/+7/+15; `nextReviewDate` = 1ª revisão.
- M4 `scheduleTopicReviews("intensive")`: 4 `ScheduledReview` em +2/+4/+6/+8.
- M5 Re-agendar não cria ciclo novo nem altera o cronograma de card com ciclo ativo.
- M6 A classificação **adota** o ciclo pré-agendado: continua com 1 ciclo só,
  `classification` gravada, `initialCycleEvaluationCompleted=true`, datas preservadas.
- M7 Na adoção, revisões vencidas são marcadas como concluídas e `currentReview`
  avança para a próxima ainda futura.

### Efeito colateral

O harness cria um usuário descartável no Postgres de produção e o remove no
final (`cleanupAll`). Nenhum dado de usuário real é tocado.
