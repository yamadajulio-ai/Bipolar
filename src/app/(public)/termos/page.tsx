import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Termos de Uso — Suporte Bipolar",
};

export default function TermosPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Termos de Uso</h1>
        <p className="mb-6 text-sm text-muted">Última atualização: março de 2026</p>

        <p className="mb-6 text-sm text-muted">
          Ao utilizar o Suporte Bipolar (&quot;plataforma&quot;, &quot;aplicativo&quot;), de
          responsabilidade de Julio Yamada (&quot;nós&quot;), você concorda com os termos abaixo.
          Leia com atenção.
        </p>

        {/* 1. Natureza */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">1. Natureza do serviço</h2>
          <p className="text-sm text-muted">
            O Suporte Bipolar é uma plataforma gratuita de auto-organização e acompanhamento pessoal
            voltada para pessoas com transtorno bipolar. As funcionalidades incluem:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            <li>Check-in diário de humor, energia, ansiedade, irritabilidade, sono e medicação.</li>
            <li>Diário detalhado com notas livres.</li>
            <li>Registro e análise de sono (horários, qualidade, despertares, rotina pré-sono).</li>
            <li>Avaliações semanais com questionários padronizados (ASRM, PHQ-9, FAST resumido).</li>
            <li>Registro de eventos de vida (Life Chart).</li>
            <li>Testes cognitivos (tempo de reação, span de dígitos).</li>
            <li>Exercícios de bem-estar (respiração guiada, relaxamento muscular).</li>
            <li>Acompanhamento financeiro com importação de dados (Mobills CSV/XLSX).</li>
            <li>Insights automáticos: termômetro de humor, correlações, regularidade do sono, análise de ritmos sociais.</li>
            <li>Narrativa de IA sob demanda (gerada por Claude, modelo da Anthropic).</li>
            <li>Integrações com Apple Health, Health Connect (Android) e Google Agenda.</li>
            <li>Acesso profissional em modo somente leitura (via link com token e PIN).</li>
            <li>Planejador de rotina baseado em protocolos IPSRT.</li>
            <li>Conteúdos educacionais sobre transtorno bipolar.</li>
            <li>Guia para familiares e pessoas próximas.</li>
            <li>SOS: botão de crise com contatos de emergência, técnicas de grounding e recursos de ajuda.</li>
          </ul>
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Este serviço NÃO substitui consultas, diagnósticos ou tratamentos médicos e
              psicológicos. Todo conteúdo tem caráter informativo e educacional. Sempre consulte
              profissionais de saúde qualificados.
            </p>
          </div>
        </section>

        {/* 2. Cadastro */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">2. Cadastro e conta</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>O uso da plataforma requer cadastro com e-mail e senha, ou login via Google.</li>
            <li>Você deve ter pelo menos 18 anos para criar uma conta.</li>
            <li>Você é responsável por manter a segurança das suas credenciais de acesso.</li>
            <li>Cada pessoa deve ter apenas uma conta.</li>
          </ul>
        </section>

        {/* 3. Gratuidade */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">3. Gratuidade</h2>
          <p className="text-sm text-muted">
            O Suporte Bipolar é atualmente gratuito. Caso funcionalidades pagas sejam introduzidas no
            futuro, você será informado com antecedência e nenhuma cobrança será feita sem seu
            consentimento explícito.
          </p>
        </section>

        {/* 4. Uso adequado */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">4. Uso adequado</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>Não utilize esta plataforma como substituto para atendimento de emergência.</li>
            <li>
              <strong>Em situação de crise:</strong> ligue para o CVV (188), SAMU (192), ou
              dirija-se ao pronto-socorro mais próximo. A página SOS do aplicativo oferece acesso
              rápido a esses recursos.
            </li>
            <li>Não tome decisões clínicas (como alterar medicação) com base no conteúdo ou nos dados deste aplicativo.</li>
            <li>Use a plataforma de forma ética e respeitosa.</li>
            <li>Não tente acessar dados de outros usuários ou explorar vulnerabilidades.</li>
          </ul>
        </section>

        {/* 5. Suspensão e encerramento */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">5. Suspensão e encerramento</h2>
          <p className="text-sm text-muted">
            Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos,
            incluindo tentativas de acessar dados de outros usuários, exploração de vulnerabilidades,
            uso automatizado abusivo ou qualquer conduta que comprometa a segurança da plataforma.
            Em caso de encerramento, você será notificado e poderá solicitar seus dados antes
            da exclusão definitiva.
          </p>
        </section>

        {/* 6. Dados de saúde */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">6. Dados de saúde e consentimento</h2>
          <p className="text-sm text-muted">
            O tratamento dos seus dados de saúde depende do seu consentimento específico e
            destacado, coletado no momento do cadastro e/ou na ativação de integrações,
            conforme descrito na nossa{" "}
            <a href="/privacidade" className="text-primary hover:underline">Política de Privacidade</a>.
            Esse consentimento é registrado na plataforma e pode ser revogado a qualquer momento.
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            <li>Seus dados de saúde são considerados dados pessoais sensíveis (LGPD, art. 5º, II).</li>
            <li>Você pode excluir sua conta e todos os dados associados a qualquer momento pela página &quot;Conta&quot;.</li>
            <li>A exclusão é irreversível e abrange todos os registros (check-ins, sono, avaliações, finanças, integrações, eventos de vida, testes cognitivos e logs de acesso).</li>
          </ul>
        </section>

        {/* 7. Integrações */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">7. Integrações com terceiros</h2>
          <p className="text-sm text-muted">
            As integrações com Apple Health, Health Connect, Google Agenda e Mobills são opcionais e
            ativadas exclusivamente por você. Ao ativá-las:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            <li>Você autoriza a importação dos dados descritos na Política de Privacidade.</li>
            <li>Você pode desativar qualquer integração a qualquer momento.</li>
            <li>Dados importados ficam sujeitos a estes Termos e à Política de Privacidade.</li>
            <li>O Suporte Bipolar não se responsabiliza por falhas ou indisponibilidade dos serviços de terceiros.</li>
          </ul>
        </section>

        {/* 8. Acesso profissional */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">8. Acesso profissional</h2>
          <p className="text-sm text-muted">
            Você pode gerar um link de acesso protegido por token e PIN para compartilhar seus dados
            com um profissional de saúde em modo somente leitura. Ao fazer isso:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            <li>Você é responsável por compartilhar o link e o PIN apenas com profissionais de sua confiança.</li>
            <li>O acesso pode ser revogado a qualquer momento.</li>
            <li>Os dados exibidos ao profissional são indicadores educacionais, não laudos clínicos.</li>
          </ul>
        </section>

        {/* 9. IA */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">9. Inteligência artificial</h2>
          <p className="text-sm text-muted">
            O aplicativo utiliza inteligência artificial (Claude, da Anthropic) para gerar narrativas
            e insights sob demanda. Sobre o uso de IA:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            <li>As narrativas são geradas a partir dos seus dados e não constituem avaliação clínica.</li>
            <li>Os dados enviados à Anthropic não são utilizados para treinamento de modelos.</li>
            <li>Os resultados da IA devem ser interpretados como sugestões informativas, nunca como diagnóstico ou orientação médica.</li>
          </ul>
        </section>

        {/* 10. SOS */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">10. Recurso SOS e crise</h2>
          <p className="text-sm text-muted">
            A página SOS é acessível sem login e oferece links para serviços de emergência (CVV 188,
            SAMU 192), técnicas de grounding e contatos pessoais de emergência. Importante:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            <li>O SOS não é um serviço de emergência e não substitui o atendimento profissional.</li>
            <li>Em caso de risco imediato à vida, ligue para os serviços de emergência.</li>
            <li>O chatbot de apoio não é um profissional de saúde e pode cometer erros.</li>
          </ul>
        </section>

        {/* 11. Propriedade intelectual */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">11. Propriedade intelectual</h2>
          <p className="text-sm text-muted">
            O conteúdo, design, código e marca &quot;Suporte Bipolar&quot; são de propriedade do
            projeto. Os conteúdos educacionais são baseados em literatura científica e protocolos
            reconhecidos (IPSRT, pesquisas do PROMAN/USP), devidamente adaptados para linguagem
            acessível.
          </p>
        </section>

        {/* 12. Limitação de responsabilidade */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">12. Limitação de responsabilidade</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>O Suporte Bipolar não se responsabiliza por decisões tomadas com base nos dados, insights ou conteúdos da plataforma.</li>
            <li>Insights automáticos, análises de correlação e narrativas de IA são ferramentas informativas, não diagnósticos.</li>
            <li>Não garantimos disponibilidade ininterrupta da plataforma.</li>
            <li>Não nos responsabilizamos por falhas em integrações de terceiros (Apple Health, Health Connect, Google Agenda).</li>
          </ul>
        </section>

        {/* 13. Modificações */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">13. Modificações nos termos</h2>
          <p className="text-sm text-muted">
            Podemos atualizar estes termos periodicamente. Alterações relevantes serão comunicadas no
            aplicativo. O uso continuado após a publicação de alterações constitui aceitação dos novos
            termos.
          </p>
        </section>

        {/* 14. Lei aplicável */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">14. Lei aplicável</h2>
          <p className="text-sm text-muted">
            Estes termos são regidos pelas leis da República Federativa do Brasil, especialmente
            o Código de Defesa do Consumidor, o Marco Civil da Internet e a LGPD. Eventuais
            disputas serão submetidas ao foro da comarca do usuário.
          </p>
        </section>

        {/* 15. Contato */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">15. Contato</h2>
          <p className="text-sm text-muted">Dúvidas sobre estes termos:</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            <li><strong>Instagram:</strong>{" "}
              <a href="https://instagram.com/suportebipolar" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                @suportebipolar
              </a>
            </li>
            <li><strong>E-mail:</strong> contato@suportebipolar.com</li>
          </ul>
        </section>
      </main>
      <Footer />
    </div>
  );
}
