"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

interface ProfileData {
  careAccess: string;
  medicationSource: string;
  consultFrequency: string;
  hasEmergencyContact: boolean;
  livingSituation: string | null;
}

const CARE_OPTIONS = [
  { value: "regular", label: "Regular (tenho acompanhamento)" },
  { value: "irregular", label: "Irregular (consulto quando consigo)" },
  { value: "sem_acesso", label: "Sem acesso a profissional" },
];

const MEDICATION_OPTIONS = [
  { value: "sus", label: "SUS (UBS / CAPS)" },
  { value: "plano", label: "Plano de saúde" },
  { value: "particular", label: "Particular" },
  { value: "nao_toma", label: "Não tomo medicação no momento" },
];

const CONSULT_OPTIONS = [
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "A cada 3 meses" },
  { value: "semestral", label: "A cada 6 meses" },
  { value: "quando_consigo", label: "Quando consigo" },
  { value: "nunca", label: "Não consulto" },
];

const LIVING_OPTIONS = [
  { value: "estavel", label: "Estável (moradia fixa)" },
  { value: "instavel", label: "Instável (mudanças frequentes)" },
  { value: "situacao_rua", label: "Em situação de rua" },
  { value: "prefiro_nao_responder", label: "Prefiro não responder" },
];

function getRecommendations(profile: ProfileData): string[] {
  const recs: string[] = [];

  if (profile.medicationSource === "sus") {
    recs.push(
      "O CAPS (Centro de Atenção Psicossocial) pode acolher e acompanhar. A retirada de medicamentos pelo SUS varia por cidade (UBS, farmácia municipal, CAPS ou policlínica). Pergunte no serviço onde é a dispensação na sua região.",
    );
    recs.push(
      "Leve sua receita, documento e Cartão SUS (CNS) para retirar medicamentos.",
    );
  }

  if (profile.careAccess === "sem_acesso") {
    recs.push(
      "A UBS (Unidade Básica de Saúde) é a porta de entrada do SUS. Lá você pode agendar consulta e pedir encaminhamento para psiquiatria.",
    );
    recs.push(
      "Se você está em sofrimento intenso, o CAPS atende sem encaminhamento e oferece acompanhamento multidisciplinar gratuito.",
    );
  }

  if (profile.careAccess === "irregular") {
    recs.push(
      "A regularidade do acompanhamento faz diferença. Se houver dificuldade de acesso, converse com sua equipe de saúde sobre alternativas.",
    );
  }

  if (
    profile.consultFrequency === "quando_consigo" ||
    profile.consultFrequency === "nunca"
  ) {
    recs.push(
      "Pergunte na UBS ou CAPS se existe telessaúde ou teleconsulta disponível na sua região. A oferta depende do município e da rede local.",
    );
  }

  if (!profile.hasEmergencyContact) {
    recs.push(
      "Cadastre um contato de emergência no seu Plano de Crise. Em momentos difíceis, ter alguém pré-definido faz diferença.",
    );
  }

  if (profile.livingSituation === "instavel") {
    recs.push(
      "O CRAS (Centro de Referência de Assistência Social) pode ajudar com questões de moradia e acesso a benefícios sociais.",
    );
  }

  if (profile.livingSituation === "situacao_rua") {
    recs.push(
      "O Centro POP e o Consultório na Rua oferecem atendimento de saúde e assistência social para pessoas em situação de rua.",
    );
    recs.push(
      "O CRAS (Centro de Referência de Assistência Social) pode ajudar com acesso a benefícios e acolhimento.",
    );
  }

  if (profile.medicationSource === "nao_toma") {
    recs.push(
      "Se quiser, converse com um profissional sobre opções de tratamento e sobre o que faz sentido para você.",
    );
  }

  if (
    profile.livingSituation === "situacao_rua" ||
    profile.livingSituation === "instavel" ||
    profile.careAccess === "sem_acesso"
  ) {
    recs.push(
      "Se você enfrenta dificuldades financeiras ou de saúde que limitam sua capacidade de trabalho, pode valer consultar o CRAS sobre o BPC (Benefício de Prestação Continuada). A elegibilidade depende de critérios avaliados pelo INSS.",
    );
  }

  return recs;
}

export default function PerfilPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    careAccess: "regular",
    medicationSource: "sus",
    consultFrequency: "mensal",
    hasEmergencyContact: false,
    livingSituation: null,
  });

  useEffect(() => {
    fetch("/api/perfil-socioeconomico")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setProfile({
            careAccess: data.careAccess,
            medicationSource: data.medicationSource,
            consultFrequency: data.consultFrequency,
            hasEmergencyContact: data.hasEmergencyContact,
            livingSituation: data.livingSituation,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/perfil-socioeconomico", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (res.ok) setSaved(true);
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl">
        <p className="py-12 text-center text-muted">Carregando...</p>
      </div>
    );
  }

  const recommendations = getRecommendations(profile);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 text-2xl font-bold">Meu Perfil de Saúde</h1>
      <p className="mb-6 text-sm text-muted">
        Essas informações nos ajudam a personalizar recomendações de recursos
        disponíveis para você. Seus dados são privados e protegidos.
      </p>

      <div className="space-y-6">
        {/* 1. Acesso a cuidado */}
        <Card>
          <label className="mb-2 block text-sm font-semibold">
            Como é seu acesso a profissional de saúde mental?
          </label>
          <div className="space-y-2">
            {CARE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  profile.careAccess === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name="careAccess"
                  value={opt.value}
                  checked={profile.careAccess === opt.value}
                  onChange={(e) =>
                    setProfile({ ...profile, careAccess: e.target.value })
                  }
                  className="accent-primary"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* 2. Fonte de medicação */}
        <Card>
          <label className="mb-2 block text-sm font-semibold">
            Como você acessa seus medicamentos?
          </label>
          <div className="space-y-2">
            {MEDICATION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  profile.medicationSource === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name="medicationSource"
                  value={opt.value}
                  checked={profile.medicationSource === opt.value}
                  onChange={(e) =>
                    setProfile({ ...profile, medicationSource: e.target.value })
                  }
                  className="accent-primary"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* 3. Frequência de consulta */}
        <Card>
          <label className="mb-2 block text-sm font-semibold">
            Com que frequência consulta seu psiquiatra?
          </label>
          <div className="space-y-2">
            {CONSULT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  profile.consultFrequency === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name="consultFrequency"
                  value={opt.value}
                  checked={profile.consultFrequency === opt.value}
                  onChange={(e) =>
                    setProfile({
                      ...profile,
                      consultFrequency: e.target.value,
                    })
                  }
                  className="accent-primary"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </Card>

        {/* 4. Contato de emergência */}
        <Card>
          <label className="mb-2 block text-sm font-semibold">
            Você tem alguém de confiança para emergências?
          </label>
          <div className="flex gap-3">
            <label
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                profile.hasEmergencyContact
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-surface"
              }`}
            >
              <input
                type="radio"
                name="hasEmergencyContact"
                checked={profile.hasEmergencyContact}
                onChange={() =>
                  setProfile({ ...profile, hasEmergencyContact: true })
                }
                className="accent-primary"
              />
              <span className="text-sm">Sim</span>
            </label>
            <label
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border p-3 transition-colors ${
                !profile.hasEmergencyContact
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-surface"
              }`}
            >
              <input
                type="radio"
                name="hasEmergencyContact"
                checked={!profile.hasEmergencyContact}
                onChange={() =>
                  setProfile({ ...profile, hasEmergencyContact: false })
                }
                className="accent-primary"
              />
              <span className="text-sm">Não</span>
            </label>
          </div>
        </Card>

        {/* 5. Situação de moradia (opcional) */}
        <Card>
          <label className="mb-2 block text-sm font-semibold">
            Situação de moradia{" "}
            <span className="text-xs font-normal text-muted">(opcional)</span>
          </label>
          <div className="space-y-2">
            {LIVING_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                  profile.livingSituation === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-surface"
                }`}
              >
                <input
                  type="radio"
                  name="livingSituation"
                  value={opt.value}
                  checked={profile.livingSituation === opt.value}
                  onChange={(e) =>
                    setProfile({ ...profile, livingSituation: e.target.value })
                  }
                  className="accent-primary"
                />
                <span className="text-sm">{opt.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
        >
          {saving ? "Salvando..." : "Salvar perfil"}
        </button>

        {saved && (
          <Alert variant="info">Perfil salvo com sucesso.</Alert>
        )}

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <Card>
            <h2 className="mb-3 text-sm font-semibold">
              Recursos recomendados para você
            </h2>
            <ul className="space-y-2">
              {recommendations.map((rec, i) => (
                <li key={i} className="text-sm text-muted">
                  • {rec}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[10px] text-muted italic">
              Recomendações gerais baseadas no seu perfil. Consulte seu
              profissional de saúde para orientação personalizada.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
