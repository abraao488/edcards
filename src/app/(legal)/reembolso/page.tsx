import Link from "next/link"
import type { Metadata } from "next"
import { LegalArticle, LegalList, LegalSection } from "@/components/legal"

export const metadata: Metadata = {
  title: "Política de Reembolso e Cancelamento - Edcards",
  description:
    "Como cancelar sua assinatura Edcards e solicitar reembolso, incluindo o direito de arrependimento previsto no art. 49 do CDC.",
}

const UPDATED_AT = "13 de outubro de 2026"

export default function ReembolsoPage() {
  return (
    <LegalArticle
      title="Política de Reembolso e Cancelamento"
      updatedAt={UPDATED_AT}
      summary="Esta Política explica como funciona o cancelamento da assinatura recorrente da Edcards e em quais situações você pode solicitar reembolso, observando o Código de Defesa do Consumidor (CDC)."
    >
      <LegalSection title="1. Visão geral">
        <p>
          A Edcards oferece acesso mediante assinatura recorrente. Você pode cancelar
          a qualquer momento, sem multa ou taxa de cancelamento. Esta Política
          complementa os{" "}
          <Link href="/termos" className="text-primary hover:underline">
            Termos de Uso
          </Link>{" "}
          e deve ser lida em conjunto com eles.
        </p>
      </LegalSection>

      <LegalSection title="2. Direito de arrependimento (art. 49 do CDC) — 7 dias">
        <p>
          Por se tratar de contratação realizada pela internet, aplica-se o direito de
          arrependimento previsto no art. 49 do Código de Defesa do Consumidor (Lei nº
          8.078/1990). Assim, você pode desistir da compra no prazo de{" "}
          <strong className="font-semibold text-foreground">
            7 (sete) dias corridos
          </strong>
          , contados a partir da contratação ou do início do serviço, o que ocorrer por
          último.
        </p>
        <LegalList
          items={[
            "Ao exercer o direito de arrependimento dentro do prazo, o valor pago será devolvido integralmente;",
            "A devolução será feita com atualização monetária quando aplicável, nos termos do art. 49, parágrafo único, do CDC;",
            "Não é necessário justificar a desistência;",
            "Basta solicitar pelos canais de atendimento abaixo, informando o e-mail cadastrado.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Como cancelar a assinatura recorrente">
        <p>
          O cancelamento pode ser solicitado a qualquer momento, sem necessidade de
          justificativa, pelos seguintes canais:
        </p>
        <LegalList
          items={[
            "Pelo painel da conta, na área de configurações de assinatura, quando disponível;",
            "Por e-mail para suporte@edcards.com.br, a partir do e-mail cadastrado;",
            "Pelo atendimento indicado no rodapé e nas páginas institucionais da Plataforma.",
          ]}
        />
        <p>
          Confirmado o cancelamento, a cobrança automática é interrompida e não haverá
          novas renovações.
        </p>
      </LegalSection>

      <LegalSection title="4. Efeitos do cancelamento">
        <LegalList
          items={[
            "O acesso aos recursos pagos permanece ativo até o fim do período já pago;",
            "Após o fim do ciclo, a conta passa a não ter acesso aos recursos pagos;",
            "O cancelamento não gera multa, tarifa ou cobrança adicional;",
            "O cancelamento não implica, por si só, reembolso de períodos já utilizados, salvo nas hipóteses legais descritas nesta Política.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Reembolsos">
        <p>São hipóteses de reembolso:</p>
        <LegalList
          items={[
            "Direito de arrependimento exercido em até 7 (sete) dias corridos, com devolução integral do valor;",
            "Cobrança indevida, duplicada ou realizada após o cancelamento;",
            "Cobrança recorrente realizada sem a renovação efetiva ou sem acesso ao serviço;",
            "Falha comprovada e não sanada que impeça o uso do serviço contratado, analisada caso a caso.",
          ]}
        />
        <p>
          Fora das hipóteses acima, o acesso já usufruído no período vigente não é, em
          regra, reembolsável, sem prejuízo dos direitos assegurados pela legislação
          consumerista.
        </p>
      </LegalSection>

      <LegalSection title="6. Cobranças indevidas e chargebacks">
        <p>
          Identificou uma cobrança que não reconhece? Fale conosco antes de abrir uma
          contestação junto ao seu banco ou operadora de cartão. Resolvemos a maioria
          dos casos rapidamente. A abertura indevida de chargeback sem contato prévio
          pode acarretar a suspensão temporária da conta enquanto o caso é analisado.
        </p>
      </LegalSection>

      <LegalSection title="7. Prazos de processamento do reembolso">
        <LegalList
          items={[
            "Pix e outros meios de transferência: em regra, em até 5 (cinco) dias úteis após a aprovação;",
            "Cartão de crédito: o estorno é solicitado imediatamente, mas a visualização depende da operadora, podendo ocorrer em uma ou duas faturas subsequentes;",
            "O prazo de processamento varia conforme o meio de pagamento e o provedor responsável pela transação.",
          ]}
        />
      </LegalSection>

      <LegalSection title="8. Como solicitar reembolso">
        <p>
          Envie um e-mail para suporte@edcards.com.br a partir do endereço cadastrado,
          informando: nome completo, e-mail da conta, data da cobrança e, se possível,
          o comprovante da transação. Responderemos o mais breve possível, observando
          os prazos legais aplicáveis.
        </p>
      </LegalSection>

      <LegalSection title="9. Contato e legislação aplicável">
        <p>
          Esta Política é regida pela legislação brasileira, em especial pelo Código
          de Defesa do Consumidor. Em caso de dúvidas, escreva para
          suporte@edcards.com.br. Consulte também os{" "}
          <Link href="/termos" className="text-primary hover:underline">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" className="text-primary hover:underline">
            Política de Privacidade
          </Link>
          .
        </p>
      </LegalSection>
    </LegalArticle>
  )
}
