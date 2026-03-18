import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata = {
  title: "Política de Privacidade — Suporte Bipolar",
};

export default function PrivacidadePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto max-w-3xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold">Política de Privacidade</h1>
        <p className="mb-6 text-sm text-muted">Última atualização: março de 2026</p>

        <p className="mb-6 text-sm text-muted">
          O Suporte Bipolar (&quot;nós&quot;, &quot;nosso&quot;) leva a proteção dos seus dados a
          sério. Esta política explica quais informações coletamos, por que coletamos, como
          protegemos e quais são os seus direitos, em conformidade com a Lei Geral de Proteção de
          Dados (LGPD — Lei nº 13.709/2018).
        </p>

        {/* 1. Dados coletados */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">1. Quais dados coletamos</h2>

          <h3 className="mb-1 mt-3 text-sm font-semibold text-foreground">1.1 Dados de cadastro</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>E-mail e senha (armazenada com hash bcrypt, nunca em texto).</li>
            <li>Login social via Google (recebemos nome e e-mail; tokens OAuth são criptografados com AES-256-GCM).</li>
            <li>Data de nascimento (apenas para verificar idade mínima de 18 anos).</li>
          </ul>

          <h3 className="mb-1 mt-3 text-sm font-semibold text-foreground">1.2 Dados de saúde e bem-estar</h3>
          <p className="mb-2 text-sm text-muted">
            Considerados <strong>dados pessoais sensíveis</strong> pela LGPD (art. 5º, II), tratados
            com base no seu consentimento explícito (art. 11, I):
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li><strong>Check-in diário:</strong> humor (1–5), energia, ansiedade, irritabilidade, horas de sono, medicação, sinais de alerta.</li>
            <li><strong>Diário completo:</strong> registros detalhados com notas livres.</li>
            <li><strong>Sono:</strong> horários de dormir/acordar, qualidade, despertares, rotina pré-sono.</li>
            <li><strong>Avaliações semanais:</strong> questionários padronizados (ASRM, PHQ-9, FAST resumido).</li>
            <li><strong>Eventos de vida:</strong> registros no Life Chart (tipo, data, notas).</li>
            <li><strong>Testes cognitivos:</strong> tempo de reação e span de dígitos (pontuações).</li>
            <li><strong>Exercícios de bem-estar:</strong> registros de respiração guiada e relaxamento.</li>
            <li><strong>Eventos de crise (SOS):</strong> registro de acionamentos do botão de crise.</li>
            <li><strong>Plano de crise:</strong> contatos de emergência e estratégias pessoais.</li>
            <li><strong>Perfil socioeconômico:</strong> respostas opcionais para recomendações de serviços públicos (CAPS, SUS, CRAS).</li>
          </ul>

          <h3 className="mb-1 mt-3 text-sm font-semibold text-foreground">1.3 Dados de integrações externas</h3>
          <p className="mb-2 text-sm text-muted">
            Importados apenas com seu consentimento explícito, via configuração ativa na página de integrações:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li><strong>Apple Health (via Health Auto Export):</strong> passos, frequência cardíaca, HRV, sono.</li>
            <li><strong>Health Connect (Android):</strong> passos, frequência cardíaca, HRV, sono — enviados pelo aplicativo Health Connect Webhook.</li>
            <li><strong>Google Agenda:</strong> eventos do calendário (título, horário) para análise de rotina social. Acesso somente leitura.</li>
            <li><strong>Mobills:</strong> dados financeiros importados via arquivo CSV/XLSX (categoria, valor, data). Nenhum dado é enviado ao Mobills.</li>
          </ul>

          <h3 className="mb-1 mt-3 text-sm font-semibold text-foreground">1.4 Dados financeiros</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>Registros de gastos importados para correlação com humor (valor, categoria, data).</li>
            <li>Processados localmente no servidor; nunca compartilhados com terceiros.</li>
          </ul>

          <h3 className="mb-1 mt-3 text-sm font-semibold text-foreground">1.5 Dados técnicos e de uso</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>Endereço IP (mascarado: IPv4 últimos 8 bits zerados, IPv6 últimos 64 bits zerados).</li>
            <li>Logs de acesso para segurança (purgados automaticamente após 90 dias).</li>
            <li>Quais conteúdos educacionais foram visualizados.</li>
            <li>Dados de erros enviados ao Sentry (sem informações pessoais identificáveis — PII scrubbing ativo).</li>
          </ul>
        </section>

        {/* 2. Finalidade */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">2. Por que coletamos</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li><strong>Autenticação e segurança:</strong> para proteger o acesso à sua conta.</li>
            <li><strong>Autoconhecimento:</strong> para que você acompanhe seus próprios padrões de humor, sono e rotina ao longo do tempo.</li>
            <li><strong>Insights automáticos:</strong> para gerar análises personalizadas (termômetro de humor, regularidade do sono, correlações).</li>
            <li><strong>Narrativa de IA:</strong> quando solicitada por você, seus dados são enviados de forma segura ao modelo Claude (Anthropic) para gerar um resumo narrativo. Os dados não são usados para treinar modelos.</li>
            <li><strong>Acesso profissional:</strong> quando você gera um link de acesso, um profissional de saúde pode visualizar seus dados em modo somente leitura, mediante token e PIN.</li>
            <li><strong>Melhoria do produto:</strong> dados de uso agregados e anonimizados para aprimorar funcionalidades.</li>
          </ul>
        </section>

        {/* 3. Base legal */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">3. Base legal (LGPD)</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li><strong>Consentimento (art. 7º, I e art. 11, I):</strong> para dados sensíveis de saúde, integrações externas, narrativa de IA e acesso profissional.</li>
            <li><strong>Execução de contrato (art. 7º, V):</strong> para dados necessários ao funcionamento da conta.</li>
            <li><strong>Legítimo interesse (art. 7º, IX):</strong> para logs de segurança e melhorias de produto.</li>
          </ul>
        </section>

        {/* 4. Proteção */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">4. Como protegemos seus dados</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>Senhas armazenadas com hash bcrypt (nunca em texto).</li>
            <li>Tokens OAuth criptografados com AES-256-GCM.</li>
            <li>Sessões via cookies HttpOnly, Secure, SameSite=Lax.</li>
            <li>Proteção CSRF em todas as requisições mutantes.</li>
            <li>Rate limiting atômico para prevenir abuso.</li>
            <li>Mascaramento de IP nos logs de acesso.</li>
            <li>Monitoramento de erros (Sentry) com PII scrubbing ativo — URLs, headers e dados pessoais são removidos antes do envio.</li>
            <li>Infraestrutura hospedada na Vercel (dados nos EUA e Europa) e banco de dados PostgreSQL na Neon.</li>
          </ul>
        </section>

        {/* 5. Compartilhamento */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">5. Compartilhamento de dados</h2>
          <p className="mb-2 text-sm text-muted">
            <strong>Nunca vendemos seus dados.</strong> O compartilhamento ocorre apenas nos seguintes casos:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li><strong>Acesso profissional:</strong> quando você gera um link e compartilha o PIN com um profissional de saúde, ele pode visualizar seus dados em modo somente leitura. Você pode revogar o acesso a qualquer momento.</li>
            <li><strong>Narrativa de IA:</strong> quando solicitada, um resumo dos seus dados é enviado à Anthropic (Claude) para geração de texto. A Anthropic não utiliza esses dados para treinamento de modelos.</li>
            <li><strong>Infraestrutura:</strong> dados são armazenados nos servidores da Vercel e Neon, sujeitos às suas respectivas políticas de segurança.</li>
            <li><strong>Monitoramento:</strong> dados técnicos (sem PII) são enviados ao Sentry para diagnóstico de erros.</li>
            <li><strong>Cloudflare:</strong> proxy para integração Apple Health (apenas repasse de dados, sem armazenamento).</li>
          </ul>
        </section>

        {/* 6. Retenção */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">6. Retenção e exclusão</h2>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li><strong>Dados da conta:</strong> mantidos enquanto sua conta estiver ativa.</li>
            <li><strong>Logs de acesso:</strong> purgados automaticamente após 90 dias.</li>
            <li><strong>Exclusão da conta:</strong> você pode excluir sua conta e todos os dados associados (check-ins, sono, avaliações, finanças, integrações, eventos de vida, testes cognitivos e logs de acesso) a qualquer momento pela página &quot;Conta&quot;. A exclusão é irreversível e imediata (cascade delete).</li>
            <li><strong>Portabilidade:</strong> entre em contato conosco para solicitar uma cópia dos seus dados.</li>
          </ul>
        </section>

        {/* 7. Direitos */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">7. Seus direitos (LGPD, art. 18)</h2>
          <p className="mb-2 text-sm text-muted">Você tem direito a:</p>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            <li>Confirmar a existência de tratamento dos seus dados.</li>
            <li>Acessar seus dados pessoais.</li>
            <li>Corrigir dados incompletos ou desatualizados.</li>
            <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários.</li>
            <li>Solicitar portabilidade dos dados.</li>
            <li>Eliminar dados tratados com base no consentimento.</li>
            <li>Revogar o consentimento a qualquer momento.</li>
          </ul>
        </section>

        {/* 8. Cookies */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">8. Cookies</h2>
          <p className="text-sm text-muted">
            Utilizamos apenas cookies essenciais para funcionamento da autenticação (cookie de sessão
            HttpOnly). Não utilizamos cookies de rastreamento, publicidade ou analytics de terceiros.
          </p>
        </section>

        {/* 9. Menores */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">9. Menores de idade</h2>
          <p className="text-sm text-muted">
            O Suporte Bipolar é destinado a maiores de 18 anos. Não coletamos intencionalmente dados
            de menores. Se identificarmos uma conta de menor de idade, ela será encerrada e os dados
            excluídos.
          </p>
        </section>

        {/* 10. Alterações */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">10. Alterações nesta política</h2>
          <p className="text-sm text-muted">
            Podemos atualizar esta política periodicamente. Alterações relevantes serão comunicadas no
            aplicativo. A data de última atualização estará sempre visível no topo desta página.
          </p>
        </section>

        {/* 11. Contato */}
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">11. Contato e encarregado (DPO)</h2>
          <p className="text-sm text-muted">
            Para dúvidas sobre privacidade, solicitações de direitos ou reclamações, entre em contato:
          </p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
            <li><strong>Instagram:</strong>{" "}
              <a href="https://instagram.com/suportebipolar" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                @suportebipolar
              </a>
            </li>
            <li><strong>E-mail:</strong> contato@suportebipolar.com</li>
          </ul>
          <p className="mt-2 text-sm text-muted">
            Caso sua solicitação não seja atendida, você pode recorrer à Autoridade Nacional de
            Proteção de Dados (ANPD).
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
