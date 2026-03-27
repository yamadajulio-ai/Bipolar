import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Ajuda — Suporte Bipolar",
  description: "Central de ajuda do Suporte Bipolar. Dúvidas frequentes, contato e recursos de emergência.",
};

export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-bold mb-8">Central de Ajuda</h1>

      {/* Emergency */}
      <section className="mb-8 rounded-[var(--radius-card)] border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-6">
        <h2 className="text-lg font-bold text-red-700 dark:text-red-400 mb-2">Em crise ou emergência?</h2>
        <ul className="space-y-2 text-sm">
          <li>
            <a href="tel:192" className="font-bold text-red-700 dark:text-red-400 underline">SAMU 192</a> — emergência médica e psiquiátrica
          </li>
          <li>
            <a href="tel:188" className="font-bold text-red-700 dark:text-red-400 underline">CVV 188</a> — apoio emocional 24h (ligação gratuita)
          </li>
          <li>
            <Link href="/sos" className="font-bold text-red-700 dark:text-red-400 underline">Acessar SOS no app</Link>
          </li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="mb-8 space-y-6">
        <h2 className="text-xl font-bold">Perguntas frequentes</h2>

        <div className="space-y-4">
          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer font-medium text-sm">O que é o Suporte Bipolar?</summary>
            <p className="mt-2 text-sm text-muted">
              É uma ferramenta gratuita de acompanhamento pessoal para pessoas com transtorno bipolar. Permite registrar humor, sono, energia e medicação, identificando padrões ao longo do tempo. <strong>Não substitui acompanhamento profissional.</strong>
            </p>
          </details>

          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer font-medium text-sm">Meus dados estão seguros?</summary>
            <p className="mt-2 text-sm text-muted">
              Sim. Seus dados são protegidos pela LGPD, armazenados com criptografia e nunca compartilhados sem sua autorização. Você pode exportar ou excluir seus dados a qualquer momento em <strong>Minha Conta</strong>.
            </p>
          </details>

          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer font-medium text-sm">O app faz diagnóstico?</summary>
            <p className="mt-2 text-sm text-muted">
              Não. O Suporte Bipolar é uma ferramenta educacional e de acompanhamento. Os questionários (PHQ-9, ASRM, FAST) são escalas de rastreio validadas, mas <strong>não substituem avaliação por profissional de saúde</strong>.
            </p>
          </details>

          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer font-medium text-sm">Como compartilho meus dados com meu médico?</summary>
            <p className="mt-2 text-sm text-muted">
              Acesse <strong>Menu → Acesso Profissional</strong> para gerar um link seguro com PIN. Seu profissional poderá visualizar seus registros sem precisar criar conta.
            </p>
          </details>

          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer font-medium text-sm">Como excluo minha conta?</summary>
            <p className="mt-2 text-sm text-muted">
              Acesse <strong>Menu → Minha Conta → Excluir conta</strong>. Todos os seus dados serão permanentemente removidos. Esta ação não pode ser desfeita.
            </p>
          </details>

          <details className="rounded-lg border border-border bg-surface p-4">
            <summary className="cursor-pointer font-medium text-sm">O app funciona offline?</summary>
            <p className="mt-2 text-sm text-muted">
              Os recursos de crise (SOS, contatos de emergência, exercícios de respiração) funcionam offline. Para registrar dados, é necessária conexão com a internet.
            </p>
          </details>
        </div>
      </section>

      {/* Contact */}
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4">Contato</h2>
        <div className="rounded-lg border border-border bg-surface p-4 space-y-2 text-sm">
          <p>
            <strong>E-mail:</strong>{" "}
            <a href="mailto:contato@suportebipolar.com" className="text-primary underline">
              contato@suportebipolar.com
            </a>
          </p>
          <p className="text-muted">
            Respondemos em até 48 horas úteis.
          </p>
        </div>
      </section>

      {/* Links */}
      <section className="space-y-2 text-sm">
        <Link href="/privacidade" className="block text-primary underline">Política de Privacidade</Link>
        <Link href="/termos" className="block text-primary underline">Termos de Uso</Link>
        <Link href="/consentimentos" className="block text-primary underline">Gerenciar consentimentos</Link>
      </section>
    </div>
  );
}
