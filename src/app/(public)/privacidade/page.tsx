import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export default function PrivacidadePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Política de Privacidade</h1>
        <p className="mb-4 text-sm text-muted">Última atualização: fevereiro de 2026</p>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">1. Quais dados coletamos</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li><strong>Dados de cadastro:</strong> e-mail e senha (armazenada de forma criptografada).</li>
            <li><strong>Dados de diário:</strong> registros de humor (1-5), horas de sono e notas curtas opcionais.</li>
            <li><strong>Dados de uso:</strong> quais conteúdos educacionais foram visualizados (slug e data).</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">2. Por que coletamos</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>Dados de cadastro: para autenticação e segurança da sua conta.</li>
            <li>Dados de diário: para que você acompanhe seus próprios padrões ao longo do tempo.</li>
            <li>Dados de uso: para melhorias internas no conteúdo educacional (nunca vendemos dados).</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">3. Como protegemos seus dados</h2>
          <p className="text-sm text-muted">
            Utilizamos criptografia para senhas (bcrypt), sessões seguras com cookies HttpOnly,
            e seguimos boas práticas de segurança da informação. Dados de humor e sono são
            considerados dados sensíveis de saúde e tratados com cuidado especial conforme a LGPD.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">4. Como excluir seus dados</h2>
          <p className="text-sm text-muted">
            Você pode solicitar a exclusão completa da sua conta e todos os dados associados
            a qualquer momento através da página &quot;Conta&quot; no aplicativo, ou entrando em contato
            pelo e-mail abaixo.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">5. Compartilhamento de dados</h2>
          <p className="text-sm text-muted">
            Não compartilhamos, vendemos ou transferimos seus dados pessoais para terceiros.
            Seus dados de saúde são exclusivamente seus.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">6. Contato do encarregado (DPO)</h2>
          <p className="text-sm text-muted">
            Para dúvidas sobre privacidade ou solicitações relacionadas aos seus dados, entre
            em contato: <strong>privacidade@suportebipolar.com</strong> (placeholder).
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
