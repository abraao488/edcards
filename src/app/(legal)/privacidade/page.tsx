import Link from "next/link"
import type { Metadata } from "next"
import { LegalArticle, LegalList, LegalSection } from "@/components/legal"

export const metadata: Metadata = {
  title: "Política de Privacidade - Edcards",
  description:
    "Política de Privacidade da Edcards, elaborada em conformidade com a Lei Geral de Proteção de Dados (LGPD).",
}

const UPDATED_AT = "13 de outubro de 2026"

export default function PrivacidadePage() {
  return (
    <LegalArticle
      title="Política de Privacidade (LGPD)"
      updatedAt={UPDATED_AT}
      summary="Esta Política descreve como a Edcards coleta, utiliza, armazena, compartilha e protege dados pessoais, em conformidade com a Lei nº 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD)."
    >
      <LegalSection title="1. Controlador de dados">
        <p>
          O controlador dos dados pessoais tratados na plataforma Edcards é Edcards,
          CNPJ nº [inserir CNPJ], com sede em [inserir endereço]. Para assuntos de
          privacidade, o contato do encarregado (DPO) é dpo@edcards.com.br.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados pessoais coletados">
        <p>Coletamos as seguintes categorias de dados:</p>
        <LegalList
          items={[
            "Dados de cadastro: nome, e-mail, senha (armazenada de forma criptografada) e concurso de interesse;",
            "Dados de uso: matérias, assuntos, flashcards e demais conteúdos que você cria, além de registros de atividade e desempenho;",
            "Dados de pagamento: informações necessárias à cobrança, processadas por provedores terceirizados (não armazenamos os dados completos do cartão);",
            "Dados técnicos: endereço IP, tipo de dispositivo, navegador, cookies e identificadores de sessão;",
            "Dados de suporte: mensagens e informações enviadas ao atendimento.",
          ]}
        />
      </LegalSection>

      <LegalSection title="3. Finalidades e bases legais do tratamento">
        <p>
          O tratamento de dados pessoais observa os princípios e as bases legais
          previstas no art. 7º da LGPD:
        </p>
        <LegalList
          items={[
            "Execução de contrato: criação e gestão da conta, prestação do serviço, processamento de pagamentos e suporte (art. 7º, V);",
            "Consentimento: envio de comunicações de marketing e uso de cookies não essenciais (art. 7º, I);",
            "Cumprimento de obrigação legal: guarda de registros fiscais e de acesso, conforme a legislação aplicável (art. 7º, II);",
            "Legítimo interesse: segurança, prevenção a fraudes e melhoria do serviço, sempre ponderado com seus direitos (art. 7º, IX);",
            "Exercício regular de direitos: defesa em processos administrativos ou judiciais (art. 7º, VI).",
          ]}
        />
      </LegalSection>

      <LegalSection title="4. Compartilhamento de dados">
        <p>
          Não vendemos dados pessoais. Podemos compartilhá-los com operadores
          estritamente necessários à prestação do serviço, que tratam os dados
          conforme nossas instruções e obrigações contratuais:
        </p>
        <LegalList
          items={[
            "Provedores de infraestrutura e banco de dados em nuvem;",
            "Processadores de pagamento, para viabilizar cobranças e assinaturas;",
            "Provedores de inteligência artificial, para geração assistida de conteúdo;",
            "Autoridades públicas, quando exigido por lei ou ordem judicial.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Transferência internacional de dados">
        <p>
          Alguns operadores podem estar localizados fora do Brasil. Nesses casos, a
          transferência internacional observa os arts. 33 a 36 da LGPD, sendo
          realizada apenas para países ou fornecedores que ofereçam grau de proteção
          adequado ou mediante garantias contratuais apropriadas.
        </p>
      </LegalSection>

      <LegalSection title="6. Retenção dos dados">
        <p>
          Os dados pessoais são mantidos pelo tempo necessário ao cumprimento das
          finalidades acima e ao atendimento de obrigações legais, contratuais e
          regulatórias. Encerrada a finalidade ou a conta, os dados são eliminados ou
          anonimizados, ressalvadas as hipóteses de guarda obrigatória previstas em
          lei.
        </p>
      </LegalSection>

      <LegalSection title="7. Direitos do titular">
        <p>Nos termos do art. 18 da LGPD, você pode solicitar:</p>
        <LegalList
          items={[
            "Confirmação da existência de tratamento e acesso aos dados;",
            "Correção de dados incompletos, inexatos ou desatualizados;",
            "Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;",
            "Portabilidade dos dados a outro fornecedor, mediante requisição expressa;",
            "Eliminação dos dados tratados com base no consentimento;",
            "Informação sobre entidades com as quais compartilhamos dados;",
            "Informação sobre a possibilidade de não fornecer consentimento e as consequências;",
            "Revogação do consentimento.",
          ]}
        />
        <p>
          As solicitações podem ser feitas para dpo@edcards.com.br. Responderemos no
          prazo legal, podendo solicitar informações adicionais para confirmar a
          identidade do titular e evitar fraudes.
        </p>
      </LegalSection>

      <LegalSection title="8. Segurança da informação">
        <p>
          Adotamos medidas técnicas e administrativas adequadas para proteger os dados
          pessoais contra acessos não autorizados, perda, destruição e alteração,
          incluindo criptografia de senhas, controle de acesso e tráfego cifrado
          (HTTPS). Nenhum sistema é absolutamente invulnerável, mas trabalhamos
          continuamente para mitigar riscos. Em caso de incidente de segurança
          relevante, adotaremos as providências previstas na LGPD, inclusive a
          comunicação aos titulares e à Autoridade Nacional de Proteção de Dados
          (ANPD) quando aplicável.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies e tecnologias similares">
        <p>
          Utilizamos cookies essenciais para autenticação e funcionamento da
          Plataforma e, quando autorizado, cookies de análise para entender o uso e
          melhorar nossos serviços. Você pode gerenciar ou bloquear cookies nas
          configurações do navegador; o bloqueio dos cookies essenciais pode
          comprometer o funcionamento da conta.
        </p>
      </LegalSection>

      <LegalSection title="10. Menores de idade">
        <p>
          A Plataforma destina-se a maiores de 18 anos. Não coletamos intencionalmente
          dados de menores de idade. Caso identifiquemos esse tipo de dado, adotaremos
          medidas para removê-lo o quanto antes.
        </p>
      </LegalSection>

      <LegalSection title="11. Alterações desta Política">
        <p>
          Podemos atualizar esta Política periodicamente. A versão vigente será sempre
          publicada nesta página, com a data da última atualização. Alterações
          relevantes poderão ser comunicadas por e-mail ou aviso na Plataforma.
        </p>
      </LegalSection>

      <LegalSection title="12. Contato">
        <p>
          Dúvidas sobre privacidade e proteção de dados podem ser encaminhadas ao
          encarregado em dpo@edcards.com.br. Consulte também os{" "}
          <Link href="/termos" className="text-primary hover:underline">
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/reembolso" className="text-primary hover:underline">
            Política de Reembolso e Cancelamento
          </Link>
          .
        </p>
      </LegalSection>
    </LegalArticle>
  )
}
