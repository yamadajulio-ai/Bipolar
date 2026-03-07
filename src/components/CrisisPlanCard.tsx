"use client";

import { Card } from "@/components/Card";

interface Contact {
  name: string;
  phone: string;
}

interface CrisisPlanData {
  trustedContacts: string | null;
  professionalName: string | null;
  professionalPhone: string | null;
  medications: string | null;
  preferredHospital: string | null;
  copingStrategies: string | null;
}

interface CrisisPlanCardProps {
  plan: CrisisPlanData;
}

function parseJson<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function CrisisPlanCard({ plan }: CrisisPlanCardProps) {
  const contacts: Contact[] = parseJson(plan.trustedContacts, []);
  const medications: string[] = parseJson(plan.medications, []);
  const strategies: string[] = parseJson(plan.copingStrategies, []);

  return (
    <div className="space-y-4">
      {/* Contatos de confiança */}
      {contacts.length > 0 && (
        <Card>
          <h3 className="mb-2 text-lg font-bold">Contatos de confiança</h3>
          <div className="space-y-2">
            {contacts.map((contact, i) => (
              <a
                key={i}
                href={`tel:${contact.phone}`}
                className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3 no-underline transition-colors hover:bg-primary/20"
              >
                <div>
                  <span className="text-sm font-semibold text-foreground">{contact.name}</span>
                  <span className="ml-2 text-sm text-muted">{contact.phone}</span>
                </div>
                <span className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white">
                  📞 Ligar
                </span>
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Profissional */}
      {(plan.professionalName || plan.professionalPhone) && (
        <Card>
          <h3 className="mb-2 text-lg font-bold">Profissional de saúde</h3>
          {plan.professionalPhone ? (
            <a
              href={`tel:${plan.professionalPhone}`}
              className="flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3 no-underline transition-colors hover:bg-primary/20"
            >
              <div>
                <span className="text-sm font-semibold text-foreground">
                  {plan.professionalName || "Profissional"}
                </span>
                <span className="ml-2 text-sm text-muted">{plan.professionalPhone}</span>
              </div>
              <span className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white">
                📞 Ligar
              </span>
            </a>
          ) : plan.professionalName ? (
            <p className="text-sm">{plan.professionalName}</p>
          ) : null}
        </Card>
      )}

      {/* Medicamentos */}
      {medications.length > 0 && (
        <Card>
          <h3 className="mb-2 text-lg font-bold">Medicamentos atuais</h3>
          <ul className="space-y-1">
            {medications.map((med, i) => (
              <li key={i} className="text-sm">
                {med}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Hospital */}
      {plan.preferredHospital && (
        <Card>
          <h3 className="mb-2 text-lg font-bold">Hospital de preferência</h3>
          <p className="text-sm">{plan.preferredHospital}</p>
        </Card>
      )}

      {/* Estrategias */}
      {strategies.length > 0 && (
        <Card>
          <h3 className="mb-2 text-lg font-bold">Estratégias de enfrentamento</h3>
          <ul className="space-y-1">
            {strategies.map((s, i) => (
              <li key={i} className="text-sm">
                {s}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Numeros de emergencia */}
      <Card className="border-danger/30 bg-danger/5">
        <h3 className="mb-2 text-lg font-bold text-danger">Emergência</h3>
        <div className="space-y-2">
          <a
            href="tel:188"
            className="block rounded-lg bg-danger/10 p-3 text-center no-underline hover:bg-danger/20"
          >
            <span className="text-2xl font-bold text-danger">188</span>
            <br />
            <span className="text-sm text-foreground">CVV - 24h, gratuito</span>
          </a>
          <a
            href="tel:192"
            className="block rounded-lg bg-danger/10 p-3 text-center no-underline hover:bg-danger/20"
          >
            <span className="text-2xl font-bold text-danger">192</span>
            <br />
            <span className="text-sm text-foreground">SAMU - 24h</span>
          </a>
          <a
            href="https://www.google.com/maps/search/?api=1&query=UPA+24h+perto+de+mim"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg bg-danger/10 p-3 text-center no-underline hover:bg-danger/20"
          >
            <span className="text-2xl font-bold text-danger">UPA</span>
            <br />
            <span className="text-sm text-foreground">UPA 24h mais próxima — Abrir no mapa</span>
          </a>
        </div>
      </Card>
    </div>
  );
}
