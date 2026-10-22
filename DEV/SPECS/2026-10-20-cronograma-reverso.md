# SPEC ATIVA — Cronograma reverso: revisão final + redistribuição (Edital Fechado)

Status: **implementada e verificada** (2026-10-20)
Área: `src/lib/schedule/plan.ts` (novo), `src/lib/schedule/actions.ts`,
`src/app/edital/client.tsx`, `scripts/schedule-*.ts(x)`

## Problema

`generateReverseSchedule` quebrava a promessa central do produto
("cronograma até a prova") de dois jeitos:

1. **Os dias de revisão final nunca viravam `ScheduleItem`.** O bloco de
   revisão era só *subtraído* da janela de estudo
   (`studyDays = daysBetween - reviewDays`) e o laço `for (i < studyDays)`
   nunca o percorria. O campo "Dias para Revisão Final" da UI prometia
   dias que não existiam no banco — e o `StudySchedule` nem guardava
   `reviewDays`, então nem a UI conseguia saber quais dias eram de revisão.
2. **Dezenas de dias vazios no meio do plano.** A distribuição era
   "preencher pela frente": `topicsPerDay = ceil(N/D)` e o dia `i` recebia
   o bloco contíguo `slice(i*topicsPerDay, (i+1)*topicsPerDay)`. Com poucos
   assuntos (N < D) tudo caía nos primeiros N dias e os D−N dias restantes
   ficavam sem item; com N > D sobrava uma cauda vazia.

## Causa raiz

- **Estrutural:** o modelo só tem um tipo de item (`subjectId`+`topicId` =
  "estudar este assunto neste dia") e **não existe o conceito de dia
  vazio** — um dia só existe se tiver ≥1 item. Não havia "item de revisão"
  nem "item de dia genérico", então todo dia que não fosse de assunto novo
  simplesmente não era gerado. Não era um `if` faltando no laço: faltava
  o conceito e a política.
- **De distribuição:** a posição do dia vinha de um índice de bloco
  (contíguo, sempre a partir do dia 0), não de uma proporção sobre a
  janela. Preencher pela frente é o oposto de "espalhar no período".

## Decisões (maestro)

| Decisão | Escolha |
|---|---|
| Como marcar o item de revisão | **Derivar na leitura** — sem migration no Neon |
| Cobertura da revisão final | **Todos os assuntos** (promessa do produto) |
| Dias vazios da fase de estudo | **Revisão intermediária** (1 assunto/dia) |

## Escopo entregue

- `src/lib/schedule/plan.ts` (novo, puro): `buildStudyPlan()` (política de
  distribuição) + `classifyScheduleItems()` (marcação) + helpers de data.
- Três fases: **ESTUDO** (spread proporcional), **REVISÃO INTERMEDIÁRIA**
  (dias de estudo sem assunto novo) e **REVISÃO FINAL** (últimos R dias).
- `generateReverseSchedule` valida `reviewDays` (≥1) e a data da prova, usa
  o plano, grava em lotes de 1000 e devolve `kind`/`phase` por item.
- `getScheduleWithDetails` classifica os itens na leitura.
- UI: rótulos de fase por dia, tag "Revisão" por item, resumo do plano
  (dias de estudo / de revisão final / total de itens) e **correção do
  off-by-one** na data exibida (`new Date("2026-10-20")` era meia-noite UTC
  e mostrava 19/10 em UTC-3).
- `safeRevalidate` no lugar de `revalidatePath` cru (fora de um request
  ele lançava depois da escrita no banco).
- **`/edital` recarrega o cronograma salvo**: a página busca o `StudySchedule`
  mais recente e passa para `EditalClient` via `initialSchedule`. O recurso
  é premium, então a página usa `requireActiveSubscriptionForPage()`
  (redireciona para upgrade) — mesmo padrão do `/gerenciador`.

## Regras de distribuição

- **ESTUDO:** assunto `k` (0-based) → dia `floor(k * D / N)`.
  N ≥ D → todo dia de estudo tem ≥1 assunto, carga difere em ≤1.
  N < D → os assuntos ficam espalhados (N=5, D=60 → dias 0, 12, 24, 36, 48).
- **REVISÃO INTERMEDIÁRIA:** cada dia de estudo sem assunto novo recebe a
  revisão do assunto já estudado mais esquecido (revisão mais antiga;
  desempate: o mais antigo). Só se revisa o que já caiu.
- **REVISÃO FINAL:** todos os assuntos entram na cobertura final. N ≥ R →
  cada assunto 1×, carga por dia difere em ≤1; N < R → cada dia revisa um
  assunto em ciclo (todos pelo menos 1×).

## Critérios de aceite

- [x] Todo dia de hoje até a véspera da prova tem ≥1 item (zero dias vazios).
- [x] Todo assunto é estudado exatamente uma vez.
- [x] Todo assunto é revisado na fase de revisão final.
- [x] A revisão intermediária nunca revisa assunto ainda não estudado.
- [x] `reviewDays` inválido (< 1) é rejeitado com mensagem clara.
- [x] Re-gerar substitui o cronograma anterior (sem duplicar).
- [x] O cronograma de outro usuário não é tocado.
- [x] A data exibida é o dia agendado (sem deslocamento de fuso).
- [x] `/edital` abre mostrando o cronograma salvo (não o formulário).
- [x] Usuário sem assinatura ativa é redirecionado para a tela de upgrade
  (não erro 500).

## Fora de escopo

- **Sem migration**: `ScheduleItem` continua sem coluna `kind`; a marcação é
  derivada na leitura (1ª ocorrência do assunto = ESTUDO).
- `StudySchedule.totalDays` continua sendo o **tamanho da janela de ESTUDO**
  (não o total do plano). A janela de revisão final é derivada:
  `[startDate + totalDays, examDate)`. **Armadilha para quem mexer aqui.**
- A página `/edital` é **premium**: sem assinatura ativa ela redireciona
  para `/dashboard/configuracoes?upgrade=true`.
