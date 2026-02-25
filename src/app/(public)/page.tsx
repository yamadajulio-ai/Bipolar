import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Alert } from "@/components/Alert";
import { Card } from "@/components/Card";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-primary/5 px-4 py-16 text-center">
          <h1 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">
            Educação e auto-organização para quem convive com TAB tipo 1
          </h1>
          <p className="mx-auto mb-6 max-w-2xl text-muted">
            Ferramentas práticas, conteúdo educacional confiável e recursos de
            apoio para pessoas com Transtorno Afetivo Bipolar tipo 1 e suas
            famílias.
          </p>
          <Alert variant="warning" className="mx-auto mb-6 max-w-xl">
            <strong>Importante:</strong> Este aplicativo não substitui
            tratamento médico ou psicológico. Consulte sempre seu profissional de
            saúde.
          </Alert>
          <div className="flex justify-center gap-4">
            <Link
              href="/cadastro"
              className="rounded-lg bg-primary px-6 py-3 font-medium text-white no-underline hover:bg-primary-dark"
            >
              Criar conta gratuita
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-primary px-6 py-3 font-medium text-primary no-underline hover:bg-primary/5"
            >
              Entrar
            </Link>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-5xl px-4 py-12">
          <h2 className="mb-8 text-center text-2xl font-semibold">
            O que você encontra aqui
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <h3 className="mb-2 font-semibold">Diário de Humor e Sono</h3>
              <p className="text-sm text-muted">
                Registre seu humor e sono diariamente. Acompanhe padrões ao
                longo do tempo para compartilhar com seu profissional de saúde.
              </p>
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Biblioteca Educacional</h3>
              <p className="text-sm text-muted">
                Conteúdos confiáveis sobre TAB tipo 1, sono, sinais precoces,
                direitos do paciente e muito mais.
              </p>
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Plano de Crise</h3>
              <p className="text-sm text-muted">
                Orientações e recursos de emergência para momentos de crise.
                CVV 188, SAMU 192, UPA 24h.
              </p>
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Área para Famílias</h3>
              <p className="text-sm text-muted">
                Guia prático para familiares: como apoiar, comunicação, limites
                saudáveis e quando buscar ajuda.
              </p>
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">Privacidade em Primeiro Lugar</h3>
              <p className="text-sm text-muted">
                Seus dados são sensíveis e tratados com o máximo cuidado.
                Sem gamificação, sem ranking, sem pressão.
              </p>
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold">100% Gratuito</h3>
              <p className="text-sm text-muted">
                Acesso livre a todas as funcionalidades. Nosso compromisso é
                com a educação e o bem-estar.
              </p>
            </Card>
          </div>
        </section>

        {/* Crisis Banner */}
        <section className="bg-warning/10 px-4 py-8 text-center">
          <p className="text-lg font-semibold">
            Em crise ou risco imediato?
          </p>
          <p className="mt-2 text-muted">
            CVV <strong className="text-foreground">188</strong> (ligação gratuita) | SAMU{" "}
            <strong className="text-foreground">192</strong> | UPA{" "}
            <strong className="text-foreground">24h</strong>
          </p>
        </section>
      </main>
      <Footer />
    </div>
  );
}
