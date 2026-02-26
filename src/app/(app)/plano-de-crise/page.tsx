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
        <strong>Em crise ou risco imediato?</strong> Ligue agora: CVV{" "}
        <strong>188</strong> (24h, gratuito) | SAMU <strong>192</strong> | Va a{" "}
        <strong>UPA 24h</strong> mais proxima.
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
            Voce ainda nao criou seu plano de crise pessoal.
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
        Este plano contem orientacoes gerais. Construa seu plano de crise
        pessoal junto com seu profissional de saude mental.
      </Alert>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Sinais de alerta</h2>
        <Card>
          <p className="mb-3 text-sm text-muted">
            Preste atencao a mudancas que podem indicar o inicio de um episodio:
          </p>
          <ul className="space-y-2 text-sm text-muted">
            <li>• Alteracoes significativas no padrao de sono (dormir muito menos ou muito mais)</li>
            <li>• Mudancas bruscas de energia ou humor</li>
            <li>• Irritabilidade incomum ou agitacao</li>
            <li>• Pensamentos acelerados ou dificuldade de concentracao</li>
            <li>• Isolamento social ou perda de interesse em atividades</li>
            <li>• Impulsividade aumentada (gastos, decisoes precipitadas)</li>
            <li>• Pensamentos de desesperanca ou ideias de que nada vale a pena</li>
          </ul>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Passos seguros em momento de crise</h2>
        <Card>
          <ol className="space-y-3 text-sm text-muted">
            <li>
              <strong>1. Reconheca o momento.</strong> Perceber que algo nao esta
              bem e o primeiro passo. Nao se julgue.
            </li>
            <li>
              <strong>2. Busque apoio imediato.</strong> Ligue para alguem de
              confianca, seu profissional de saude, ou para o CVV (188).
            </li>
            <li>
              <strong>3. Reduza estimulos.</strong> Procure um ambiente calmo,
              com pouca luz e barulho. Evite tomar decisoes importantes.
            </li>
            <li>
              <strong>4. Nao altere sua medicacao.</strong> Mudancas na
              medicacao devem ser feitas apenas com orientacao do seu medico.
            </li>
            <li>
              <strong>5. Va a um servico de saude se necessario.</strong> SAMU
              (192) ou UPA 24h sao recursos disponiveis a qualquer hora.
            </li>
          </ol>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Recursos de emergencia no Brasil</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="text-center">
            <p className="text-3xl font-bold text-primary">188</p>
            <p className="text-sm font-medium">CVV</p>
            <p className="text-xs text-muted">
              Centro de Valorizacao da Vida. 24h, gratuito, sigilo garantido.
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold text-danger">192</p>
            <p className="text-sm font-medium">SAMU</p>
            <p className="text-xs text-muted">
              Servico de Atendimento Movel de Urgencia. 24h.
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold text-warning">UPA</p>
            <p className="text-sm font-medium">UPA 24h</p>
            <p className="text-xs text-muted">
              Unidade de Pronto Atendimento. Atendimento presencial 24h.
            </p>
          </Card>
        </div>
      </section>

      <Alert variant="info">
        <strong>Dica:</strong> Monte seu plano de crise pessoal em um momento de
        estabilidade, junto com seu profissional de saude. Inclua contatos de
        confianca, medicacoes atuais e hospital de preferencia.
      </Alert>
    </div>
  );
}
