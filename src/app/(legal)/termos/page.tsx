import Link from "next/link"
import type { Metadata } from "next"
import { LegalArticle, LegalList, LegalSection } from "@/components/legal"

export const metadata: Metadata = {
  title: "Termos de Uso - Edcards",
  description:
    "Termos e condições de uso da plataforma Edcards, SaaS de estudos com flashcards e repetição espaçada.",
}

const UPDATED_AT = "13 de outubro de 2026"

export default function TermosPage() {
  return (
    <LegalArticle
      title="Termos de Uso"
      updatedAt={UPDATED_AT}
      summary="Ao criar uma conta, assinar um plano ou utilizar qualquer recurso da plataforma Edcards, você declara ter lido e concordado com estes Termos de Uso e com a Política de Privacidade. Caso não concorde, não utilize o serviço."
    >
      <LegalSection title="1. Identificação do fornecedor">
        <p>
          O serviço é oferecido por Edcards (&quot;nós&quot;), sociedade empresária
          inscrita no CNPJ nº [inserir CNPJ], com sede em [inserir endereço].
          Contato para dúvidas, suporte e assuntos contratuais:
          suporte@edcards.com.br.
        </p>
      </LegalSection>

      <LegalSection title="2. Aceitação dos Termos">
        <p>
          Estes Termos regulam o acesso e o uso da plataforma Edcards
          (&quot;Plataforma&quot;), um software disponibilizado como serviço (SaaS)
          de organização de estudos, criação de flashcards e revisão por repetição
          espaçada. A aceitação ocorre de forma expressa no momento do cadastro e a
          cada contratação de plano.
        </p>
        <p>
          A relação entre as partes é regida pelo Código de Defesa do Consumidor
          (Lei nº 8.078/1990) e demais normas brasileiras aplicáveis.
        </p>
      </LegalSection>

      <LegalSection title="3. Descrição do serviço">
        <LegalList
          items={[
            "Criação e organização de matérias, assuntos e flashcards;",
            "Geração assistida de conteúdo por inteligência artificial;",
            "Revisão com algoritmo de repetição espaçada (SRS);",
            "Painéis de desempenho, cronômetros de estudo e demais ferramentas.",
          ]}
        />
        <p>
          O conteúdo é fornecido como ferramenta de apoio ao estudo e não constitui
          consultoria pedagógica, jurídica, médica ou profissional de qualquer
          natureza. Não garantimos aprovação em concursos, provas ou avaliações.
        </p>
      </LegalSection>

      <LegalSection title="4. Cadastro e conta">
        <LegalList
          items={[
            "O usuário deve ter no mínimo 18 anos ou capacidade civil plena para contratar;",
            "As informações informadas no cadastro devem ser verdadeiras, exatas e atualizadas;",
            "O usuário é responsável por manter a confidencialidade de e-mail e senha;",
            "A conta é pessoal e intransferível, sendo vedado o compartilhamento de acesso;",
            "O usuário deve comunicar imediatamente qualquer uso não autorizado da conta.",
          ]}
        />
      </LegalSection>

      <LegalSection title="5. Planos, preços e assinatura recorrente">
        <p>
          O acesso aos recursos pagos ocorre mediante assinatura recorrente,
          cobrada de forma mensal ou conforme o plano contratado. Os valores vigentes
          são os exibidos na Plataforma no momento da contratação.
        </p>
        <LegalList
          items={[
            "A assinatura é renovada automaticamente ao fim de cada ciclo, salvo cancelamento prévio;",
            "A cobrança ocorre no meio de pagamento informado pelo usuário;",
            "Eventuais reajustes serão comunicados com antecedência mínima de 30 (trinta) dias, podendo o usuário cancelar sem qualquer ônus antes da entrada em vigor;",
            "Para detalhes sobre devolução de valores e cancelamento, consulte a Política de Reembolso e Cancelamento.",
          ]}
        />
      </LegalSection>

      <LegalSection title="6. Pagamentos">
        <p>
          Os pagamentos são processados por provedores de pagamento terceirizados.
          Não armazenamos os dados completos do seu cartão de crédito em nossos
          servidores. Ao contratar, o usuário autoriza as cobranças recorrentes
          correspondentes ao plano escolhido.
        </p>
        <p>
          A falta de pagamento pode resultar na suspensão do acesso aos recursos
          pagos até a regularização.
        </p>
      </LegalSection>

      <LegalSection title="7. Direito de arrependimento (art. 49 do CDC)">
        <p>
          Em conformidade com o art. 49 do Código de Defesa do Consumidor, nas
          contratações realizadas fora do estabelecimento comercial — inclusive pela
          internet — o consumidor pode desistir da compra no prazo de 7 (sete) dias
          corridos, contados a partir da contratação ou do recebimento do produto ou
          serviço, o que ocorrer por último.
        </p>
        <p>
          Para exercer esse direito, basta enviar solicitação pelos canais de
          atendimento indicados na{" "}
          <Link href="/reembolso" className="text-primary hover:underline">
            Política de Reembolso e Cancelamento
          </Link>
          . Nessa hipótese, os valores pagos serão devolvidos integralmente, com
          atualização monetária quando aplicável, nos termos do art. 49, parágrafo
          único, do CDC.
        </p>
      </LegalSection>

      <LegalSection title="8. Uso aceitável">
        <p>O usuário compromete-se a não:</p>
        <LegalList
          items={[
            "Utilizar a Plataforma para fins ilícitos ou que contrariem estes Termos;",
            "Copiar, distribuir, sublicenciar, vender ou alugar o acesso ou o software;",
            "Realizar engenharia reversa, descompilar ou tentar extrair o código-fonte;",
            "Sobrecarregar, interferir ou tentar comprometer a segurança da Plataforma;",
            "Inserir conteúdo ilegal, ofensivo, difamatório ou que viole direitos de terceiros.",
          ]}
        />
      </LegalSection>

      <LegalSection title="9. Propriedade intelectual">
        <p>
          A marca, o software, o layout, os textos institucionais e demais elementos
          da Plataforma são de nossa titularidade ou licenciados a nós, protegidos
          pela legislação de propriedade intelectual. O presente instrumento concede
          ao usuário apenas uma licença de uso pessoal, não exclusiva, revogável e
          intransferível, limitada à vigência da conta.
        </p>
      </LegalSection>

      <LegalSection title="10. Conteúdo do usuário">
        <p>
          O usuário mantém a titularidade do conteúdo que insere na Plataforma
          (textos, materiais e flashcards). Ao enviar esse conteúdo, concede-nos
          licença limitada para armazená-lo e processá-lo com a única finalidade de
          prestar o serviço contratado. O usuário declara possuir os direitos
          necessários sobre os materiais que cadastra.
        </p>
      </LegalSection>

      <LegalSection title="11. Limitação de responsabilidade">
        <p>
          Empregamos esforços comercialmente razoáveis para manter a Plataforma
          disponível e segura, mas não garantimos operação ininterrupta ou livre de
          erros. Não nos responsabilizamos por lucros cessantes, danos indiretos ou
          prejuízos decorrentes de: (i) uso indevido da conta pelo usuário; (ii)
          indisponibilidade de serviços de terceiros; ou (iii) decisões tomadas pelo
          usuário com base no conteúdo gerado por inteligência artificial, que deve
          sempre ser conferido.
        </p>
        <p>
          Nada nestes Termos limita direitos assegurados ao consumidor pelo Código de
          Defesa do Consumidor.
        </p>
      </LegalSection>

      <LegalSection title="12. Suspensão e encerramento">
        <p>
          Podemos suspender ou encerrar o acesso em caso de descumprimento destes
          Termos, uso fraudulento ou inadimplência, mediante notificação quando
          cabível. O usuário pode encerrar sua conta a qualquer momento nos canais de
          atendimento.
        </p>
      </LegalSection>

      <LegalSection title="13. Alterações destes Termos">
        <p>
          Podemos atualizar estes Termos para refletir melhorias, mudanças legais ou
          novos recursos. A versão vigente será sempre publicada nesta página, com a
          data de atualização. O uso continuado após a publicação implica concordância
          com a versão revisada, ressalvadas as hipóteses de comunicação prévia
          exigidas por lei.
        </p>
      </LegalSection>

      <LegalSection title="14. Legislação aplicável e foro">
        <p>
          Estes Termos são regidos pela legislação brasileira. Eventuais controvérsias
          serão resolvidas no foro do domicílio do consumidor, conforme o art. 101, I,
          do Código de Defesa do Consumidor, sem prejuízo de tentativa prévia de
          solução amigável.
        </p>
      </LegalSection>

      <LegalSection title="15. Contato">
        <p>
          Dúvidas sobre estes Termos podem ser enviadas para
          suporte@edcards.com.br. Consulte também a{" "}
          <Link href="/privacidade" className="text-primary hover:underline">
            Política de Privacidade
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
