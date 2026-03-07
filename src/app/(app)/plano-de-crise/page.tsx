import Link from "next/link";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { CrisisPlanCard } from "@/components/CrisisPlanCard";

export default async function PlanoDeCrisePage() {
  const session = await getSession();

  const plan = await prisma.crisisPlan.findUnique({
    where: { userId: session.userId },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Plano de Crise</h1>

      <Alert variant="danger" className="mb-6">
        <strong>Em crise ou risco imediato?</strong> Ligue agora:{" "}
        <a href="tel:188" className="font-bold text-danger underline">CVV 188</a> (24h, gratuito) |{" "}
        <a href="tel:192" className="font-bold text-danger underline">SAMU 192</a> |{" "}
        Vá à <strong>UPA 24h</strong> mais próxima.
      </Alert>

      {plan ? (
        <div className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Meu plano pessoal</h2>
            <Link
              href="/plano-de-crise/editar"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
            >
              Editar meu plano
            </Link>
          </div>
          <CrisisPlanCard plan={plan} />
        </div>
      ) : (
        <Card className="mb-6">
          <p className="mb-3 text-center text-muted">
            Você ainda não criou seu plano de crise pessoal.
          </p>
          <div className="text-center">
            <Link
              href="/plano-de-crise/editar"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white no-underline hover:bg-primary-dark"
            >
              Criar meu plano
            </Link>
          </div>
        </Card>
      )}

      <Alert variant="info" className="mb-6">
        Este plano contém orientações gerais. Construa seu plano de crise
        pessoal junto com seu profissional de saúde mental.
      </Alert>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Sinais de alerta</h2>
        <Card>
          <p className="mb-3 text-sm text-muted">
            Preste atenção a mudanças que podem indicar o início de um episódio:
          </p>
          <ul className="space-y-2 text-sm text-muted">
            <li>• Alterações significativas no padrão de sono (dormir muito menos ou muito mais)</li>
            <li>• Mudanças bruscas de energia ou humor</li>
            <li>• Irritabilidade incomum ou agitação</li>
            <li>• Pensamentos acelerados ou dificuldade de concentração</li>
            <li>• Isolamento social ou perda de interesse em atividades</li>
            <li>• Impulsividade aumentada (gastos, decisões precipitadas)</li>
            <li>• Pensamentos de desesperança ou ideias de que nada vale a pena</li>
          </ul>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Passos seguros em momento de crise</h2>
        <Card>
          <ol className="space-y-3 text-sm text-muted">
            <li>
              <strong>1. Reconheça o momento.</strong> Perceber que algo não está
              bem é o primeiro passo. Não se julgue.
            </li>
            <li>
              <strong>2. Busque apoio imediato.</strong> Ligue para alguém de
              confiança, seu profissional de saúde, ou para o{" "}
              <a href="tel:188" className="font-medium underline">CVV (188)</a>.
            </li>
            <li>
              <strong>3. Reduza estímulos.</strong> Procure um ambiente calmo,
              com pouca luz e barulho. Evite tomar decisões importantes.
            </li>
            <li>
              <strong>4. Não altere sua medicação.</strong> Mudanças na
              medicação devem ser feitas apenas com orientação do seu médico.
            </li>
            <li>
              <strong>5. Vá a um serviço de saúde se necessário.</strong>{" "}
              <a href="tel:192" className="font-medium underline">SAMU (192)</a> ou UPA 24h são recursos disponíveis a qualquer hora.
            </li>
          </ol>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Recursos de emergência no Brasil</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <a href="tel:188" className="no-underline">
            <Card className="text-center transition-colors hover:border-primary/50">
              <p className="text-3xl font-bold text-primary">188</p>
              <p className="text-sm font-medium text-foreground">CVV — Ligar agora</p>
              <p className="text-xs text-muted">
                Centro de Valorização da Vida. 24h, gratuito, sigilo garantido.
              </p>
            </Card>
          </a>
          <a href="tel:192" className="no-underline">
            <Card className="text-center transition-colors hover:border-danger/50">
              <p className="text-3xl font-bold text-danger">192</p>
              <p className="text-sm font-medium text-foreground">SAMU — Ligar agora</p>
              <p className="text-xs text-muted">
                Serviço de Atendimento Móvel de Urgência. 24h.
              </p>
            </Card>
          </a>
          <a
            href="https://www.google.com/maps/search/?api=1&query=UPA+24h+perto+de+mim"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline"
          >
            <Card className="text-center transition-colors hover:border-warning/50">
              <p className="text-3xl font-bold text-warning">UPA</p>
              <p className="text-sm font-medium text-foreground">Encontrar no mapa</p>
              <p className="text-xs text-muted">
                Unidade de Pronto Atendimento. Atendimento presencial 24h.
              </p>
            </Card>
          </a>
        </div>
      </section>

      <Alert variant="info">
        <strong>Dica:</strong> Monte seu plano de crise pessoal em um momento de
        estabilidade, junto com seu profissional de saúde. Inclua contatos de
        confiança, medicações atuais e hospital de preferência.
      </Alert>
    </div>
  );
}
