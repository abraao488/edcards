# DEV — Edcards

Documentação durável do projeto. Leia nesta ordem:

1. `SPECS/ACTIVE.md` — contrato da tarefa em andamento (escopo, aceite, status)
2. `HANDOFF.md` — contexto de retomada (o que está pronto, o que falta)
3. `CONTEXT.md` — estado geral do projeto
4. `WORKLOG.md` — histórico compacto das últimas mudanças
5. `VERIFY.md` — evidências de verificação (comandos + resultado)

Subpastas válidas (não renomear sem atualizar este índice):
`SPECS/`, `LOGS/`, `SQL/`, `ARCH/`, `WORKFLOWS/`, `TESTS/`, `DOCUMENTATION/`, `BACKLOG/`.

## Mapa

| Arquivo | Conteúdo |
|---|---|
| `SPECS/ACTIVE.md` | Especificação ativa (reorganização da fila: campo certo, ciclo ativo preservado, sem take:200) |
| `SPECS/2026-10-20-cronograma-reverso.md` | Spec arquivada (cronograma reverso: revisão final + redistribuição) |
| `SPECS/2026-10-20-agendamento-manual-revisoes.md` | Spec arquivada (agendamento manual de revisões) |
| `CONTEXT.md` | Arquitetura relevante, decisões estruturais, armadilhas conhecidas |
| `WORKLOG.md` | Entradas curtas das mudanças recentes |
| `VERIFY.md` | Evidências de verificação por mudança |
| `HANDOFF.md` | Contexto para o próximo agente |
| `BACKLOG/PRONTIDAO.md` | Backlog priorizado de prontidão para produção (auditoria de 2026-10-22) |

## Comandos de verificação

```powershell
npx tsc --noEmit          # tipos
npm run lint              # eslint (warnings pré-existentes são tolerados)
npm run build             # gate do projeto: prisma generate + next build
npx tsx scripts/srs-tests-a-k.ts   # harness A–M do SRS (banco real, usuário descartável)
npx tsx scripts/organize-tests.ts  # harness O1–O9 da reorganização (banco real, usuário descartável)
npx tsx scripts/schedule-plan-tests.ts   # política do cronograma (puro, sem banco)
npx tsx scripts/schedule-tests.ts        # cronograma end-to-end (banco real, usuário descartável)
npx tsx --tsconfig scripts/tsconfig.ui-tests.json scripts/schedule-ui-tests.tsx  # render da tela
npx tsx scripts/mp-webhook-tests.ts   # webhook do Mercado Pago (6 testes, banco real)
```