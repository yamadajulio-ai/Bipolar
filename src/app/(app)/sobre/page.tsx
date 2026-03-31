import { Card } from "@/components/Card";
import Link from "next/link";

export default function SobrePage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Sobre o Suporte Bipolar</h1>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">O que é</h2>
        <p className="text-sm text-muted">
          O Suporte Bipolar é um aplicativo de automonitoramento para pessoas com
          transtorno bipolar. Baseado nos protocolos da Terapia Interpessoal e de
          Ritmos Sociais (IPSRT) e em pesquisas do PROMAN/USP.
        </p>
        <ul className="mt-3 list-disc pl-5 text-sm text-muted space-y-1">
          <li>NÃO é um dispositivo médico</li>
          <li>NÃO realiza diagnósticos</li>
          <li>NÃO prescreve tratamentos</li>
          <li>NÃO substitui avaliação profissional</li>
        </ul>
        <p className="mt-3 text-xs text-muted italic">
          This app is not a medical device and does not provide diagnosis or
          treatment.
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Responsável</h2>
        <p className="text-sm text-muted">
          <strong>Julio Cesar de Sousa Yamada</strong>
        </p>
        <p className="text-sm text-muted mt-1">
          E-mail:{" "}
          <a
            href="mailto:contato@suportebipolar.com"
            className="text-primary underline"
          >
            contato@suportebipolar.com
          </a>
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Inteligência Artificial</h2>
        <div className="text-sm text-muted space-y-3">
          <div>
            <p className="font-medium text-foreground">Narrativas semanais</p>
            <p>
              Processadas por OpenAI. Os dados não são armazenados permanentemente
              pelo provedor (retenção temporária para segurança conforme política
              do provedor). O uso é estritamente educacional.
            </p>
          </div>
          <div>
            <p className="font-medium text-foreground">SOS Chatbot</p>
            <p>
              Processado por Anthropic. As mensagens são processadas por IA e não
              são armazenadas permanentemente pelo app (retenção temporária para
              segurança conforme política do provedor). Não substitui atendimento profissional.
            </p>
          </div>
          <p className="text-xs italic">
            The AI features are educational only and do not provide medical
            diagnosis or treatment recommendations.
          </p>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Privacidade</h2>
        <p className="text-sm text-muted">
          Seus dados são protegidos por criptografia. Nenhum dado de saúde é
          usado para publicidade. Você pode exportar ou excluir todos os seus
          dados a qualquer momento em{" "}
          <Link href="/conta" className="text-primary underline">
            Conta
          </Link>
          .
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          <Link href="/privacidade" className="text-primary underline">
            Política de Privacidade
          </Link>
          <Link href="/termos" className="text-primary underline">
            Termos de Uso
          </Link>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Alertas e Segurança</h2>
        <p className="text-sm text-muted">
          Os alertas do app (vermelho, laranja, amarelo) são baseados em padrões
          dos seus registros. Eles NÃO acionam socorro automaticamente.
        </p>
        <p className="mt-2 text-sm font-medium text-danger">
          Em caso de emergência, ligue 192 (SAMU) ou 188 (CVV).
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Contato</h2>
        <div className="text-sm text-muted space-y-1">
          <p>
            E-mail:{" "}
            <a
              href="mailto:contato@suportebipolar.com"
              className="text-primary underline"
            >
              contato@suportebipolar.com
            </a>
          </p>
          <p>
            Ajuda:{" "}
            <a
              href="https://suportebipolar.com/ajuda"
              className="text-primary underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              suportebipolar.com/ajuda
            </a>
          </p>
        </div>
      </Card>

      <p className="text-center text-xs text-muted pb-4">
        Conteúdo educacional — não substitui tratamento médico ou psicológico
      </p>
    </div>
  );
}
