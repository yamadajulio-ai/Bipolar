import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

export default function PlanoDeCrisePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Plano de Crise</h1>

      <Alert variant="danger" className="mb-6">
        <strong>Em crise ou risco imediato?</strong> Ligue agora: CVV{" "}
        <strong>188</strong> (24h, gratuito) | SAMU <strong>192</strong> | Vá à{" "}
        <strong>UPA 24h</strong> mais próxima.
      </Alert>

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
              confiança, seu profissional de saúde, ou para o CVV (188).
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
              <strong>5. Vá a um serviço de saúde se necessário.</strong> SAMU
              (192) ou UPA 24h são recursos disponíveis a qualquer hora.
            </li>
          </ol>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Recursos de emergência no Brasil</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="text-center">
            <p className="text-3xl font-bold text-primary">188</p>
            <p className="text-sm font-medium">CVV</p>
            <p className="text-xs text-muted">
              Centro de Valorização da Vida. 24h, gratuito, sigilo garantido.
            </p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-bold text-danger">192</p>
            <p className="text-sm font-medium">SAMU</p>
            <p className="text-xs text-muted">
              Serviço de Atendimento Móvel de Urgência. 24h.
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
        estabilidade, junto com seu profissional de saúde. Inclua contatos de
        confiança, medicações atuais e hospital de preferência.
      </Alert>
    </div>
  );
}
