import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function TermosPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Termos de Uso</h1>
        <p className="mb-4 text-sm text-muted">Última atualização: fevereiro de 2026</p>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">1. Natureza do serviço</h2>
          <p className="text-sm text-muted">
            O Rede Bipolar é uma plataforma educacional e de auto-organização. Todo o conteúdo
            disponibilizado tem caráter exclusivamente informativo e educacional.
            <strong> Este serviço NÃO substitui consultas, diagnósticos ou tratamentos
            médicos e psicológicos.</strong>
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">2. Uso adequado</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>Não utilize esta plataforma como substituto para atendimento de emergência.</li>
            <li>Em situação de crise, ligue para: CVV 188, SAMU 192, ou dirija-se à UPA mais próxima.</li>
            <li>Não tome decisões clínicas (como alterar medicação) com base no conteúdo deste aplicativo.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">3. Conta e responsabilidades</h2>
          <p className="text-sm text-muted">
            Você é responsável por manter a segurança da sua senha. Recomendamos uma senha
            forte e única. Não compartilhe sua conta com terceiros.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">4. Dados e privacidade</h2>
          <p className="text-sm text-muted">
            Seus dados são tratados conforme nossa Política de Privacidade e a Lei Geral de
            Proteção de Dados (LGPD). Você pode excluir sua conta e dados a qualquer momento.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">5. Limitação de responsabilidade</h2>
          <p className="text-sm text-muted">
            O Rede Bipolar não se responsabiliza por decisões tomadas com base no conteúdo
            da plataforma. Sempre consulte profissionais de saúde qualificados para orientações
            clínicas.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">6. Regras de conduta</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>Use a plataforma de forma ética e respeitosa.</li>
            <li>Não tente acessar dados de outros usuários.</li>
            <li>Não utilize a plataforma para fins diferentes dos propostos.</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">7. Contato</h2>
          <p className="text-sm text-muted">
            Dúvidas sobre estes termos: <strong>contato@redebipolar.com</strong> (placeholder).
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
