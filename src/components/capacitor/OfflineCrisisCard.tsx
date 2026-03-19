'use client';

/**
 * OfflineCrisisCard — always-available crisis resources.
 * Cached locally via Capacitor Preferences so it works without internet.
 * This is a key "native value" for Apple Review — offline utility.
 */

import { shareContent, SHARE_PRESETS } from '@/lib/capacitor';

const EMERGENCY_CONTACTS = [
  { name: 'CVV — Centro de Valorização da Vida', phone: '188', available: '24 horas', primary: true },
  { name: 'SAMU', phone: '192', available: '24 horas', primary: true },
  { name: 'Bombeiros', phone: '193', available: '24 horas', primary: false },
  { name: 'Polícia Militar', phone: '190', available: '24 horas', primary: false },
] as const;

const GROUNDING_STEPS = [
  { number: 5, sense: 'coisas que você pode VER', icon: '👁️' },
  { number: 4, sense: 'coisas que você pode TOCAR', icon: '✋' },
  { number: 3, sense: 'coisas que você pode OUVIR', icon: '👂' },
  { number: 2, sense: 'coisas que você pode CHEIRAR', icon: '👃' },
  { number: 1, sense: 'coisa que você pode SABOREAR', icon: '👅' },
] as const;

export function OfflineCrisisCard() {
  return (
    <div className="space-y-6 p-4">
      {/* Emergency Contacts */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Contatos de Emergência
        </h2>
        <div className="space-y-2">
          {EMERGENCY_CONTACTS.map((contact) => (
            <a
              key={contact.phone}
              href={`tel:${contact.phone}`}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                contact.primary
                  ? 'border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900'
                  : 'border-border bg-card'
              }`}
            >
              <div>
                <p className="font-medium text-sm">{contact.name}</p>
                <p className="text-xs text-muted-foreground">{contact.available}</p>
              </div>
              <span className="text-xl font-bold text-red-600 dark:text-red-400">
                {contact.phone}
              </span>
            </a>
          ))}
        </div>
        <button
          onClick={() => shareContent(SHARE_PRESETS.crisisContacts)}
          className="mt-2 w-full text-sm text-muted-foreground underline"
        >
          Compartilhar contatos com alguém de confiança
        </button>
      </section>

      {/* Grounding Exercise */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Exercício de Aterramento (5-4-3-2-1)
        </h2>
        <p className="text-sm text-muted-foreground mb-3">
          Respire fundo e identifique ao seu redor:
        </p>
        <div className="space-y-2">
          {GROUNDING_STEPS.map((step) => (
            <div
              key={step.number}
              className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border"
            >
              <span className="text-2xl">{step.icon}</span>
              <span className="text-sm">
                <strong>{step.number}</strong> {step.sense}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Safety Message */}
      <section className="p-4 rounded-lg bg-primary/10 border border-primary/20">
        <p className="text-sm text-foreground leading-relaxed">
          Você não está sozinho. Se estiver em crise, ligue para o{' '}
          <a href="tel:188" className="font-bold text-red-600 dark:text-red-400">
            CVV 188
          </a>{' '}
          — é gratuito, confidencial e funciona 24 horas.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Este recurso funciona mesmo sem internet.
        </p>
      </section>
    </div>
  );
}
