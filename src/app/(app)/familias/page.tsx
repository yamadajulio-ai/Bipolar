import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

export default function FamiliasPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-4 text-2xl font-bold">Área para Famílias</h1>

      <Alert variant="info" className="mb-6">
        Este guia é informativo e educacional. Para orientações personalizadas,
        busque apoio de profissionais de saúde mental.
      </Alert>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">
          Como apoiar alguém com TAB
        </h2>
        <Card>
          <div className="space-y-3 text-sm text-muted">
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" />
              <span>
                <strong>Eduque-se sobre o transtorno.</strong> Entender o TAB
                ajuda a ter empatia e reduzir julgamentos.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" />
              <span>
                <strong>Mantenha comunicação aberta e respeitosa.</strong> Ouça
                sem julgar. Pergunte como a pessoa se sente.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" />
              <span>
                <strong>Ajude a manter rotinas saudáveis.</strong> Especialmente
                horários regulares de sono e alimentação.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" />
              <span>
                <strong>Observe sinais precoces de episódios.</strong> Mudanças
                no sono, energia ou comportamento podem ser sinais.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" />
              <span>
                <strong>Conheça os recursos de emergência.</strong> CVV 188,
                SAMU 192, UPA 24h.
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" />
              <span>
                <strong>Cuide da sua própria saúde mental.</strong> Ser
                cuidador também é desafiante. Busque apoio para si.
              </span>
            </label>
          </div>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Guia de comunicação</h2>
        <Card>
          <div className="space-y-4 text-sm text-muted">
            <div>
              <h3 className="font-medium text-foreground">Escuta ativa</h3>
              <p>
                Demonstre que está ouvindo. Evite interromper ou minimizar
                sentimentos (&quot;isso vai passar&quot;, &quot;é só fase&quot;).
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Limites saudáveis</h3>
              <p>
                É possível apoiar sem se anular. Estabeleça limites claros com
                respeito e carinho. Diga o que você pode e o que não pode fazer.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Sono e rotina</h3>
              <p>
                Ajude a criar um ambiente que favoreça o sono regular. Evite
                atividades estimulantes à noite e respeite os horários.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">Sinais precoces</h3>
              <p>
                Converse (em momentos de estabilidade) sobre quais sinais
                observar e como agir. Crie um plano juntos.
              </p>
            </div>
          </div>
        </Card>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">O que evitar</h2>
        <Card>
          <ul className="space-y-2 text-sm text-muted">
            <li>
              • <strong>Não discuta medicação.</strong> Decisões sobre
              medicação são entre o paciente e o médico.
            </li>
            <li>
              • <strong>Não minimize o transtorno.</strong> Frases como
              &quot;todo mundo tem dias ruins&quot; podem ser invalidantes.
            </li>
            <li>
              • <strong>Não tente &quot;consertar&quot; a pessoa.</strong> TAB é
              uma condição de saúde, não uma falha de caráter.
            </li>
            <li>
              • <strong>Não culpe a pessoa pelos episódios.</strong> Episódios
              não são escolhas.
            </li>
            <li>
              • <strong>Não ignore seus próprios limites.</strong> Busque apoio
              profissional ou grupos de familiares.
            </li>
          </ul>
        </Card>
      </section>

      <Alert variant="warning">
        <strong>Procure apoio profissional</strong> quando sentir que a situação
        está além do que você consegue manejar. Existem profissionais
        especializados em orientação familiar para saúde mental.
      </Alert>
    </div>
  );
}
