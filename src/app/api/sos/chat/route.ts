import { getSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/security";
import { prisma } from "@/lib/db";
import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";

export const maxDuration = 30;

// ── Deterministic crisis keyword detection (pt-BR) ──────────────
// ALL patterns use accent-free (NFD-stripped) text so they match both
// "não" and "nao", "remédio" and "remedio", etc.
// This runs BEFORE the LLM and BEFORE rate limiting to ensure crisis
// users ALWAYS get the static safe response, even if rate-limited.
//
// Patterns are split into EXPLICIT (always trigger) and CONTEXTUAL
// (only trigger when combined with harm context or multiple hits).
// This reduces false positives like "tenho um plano para o projeto"
// or "moro perto da ponte" while still catching real crises.

// EXPLICIT: unambiguous crisis language — always triggers bypass.
// These phrases have no plausible benign interpretation in this context.
const EXPLICIT_CRISIS: RegExp[] = [
  // Suicidal ideation (clear intent)
  /\b(me\s*matar|me\s*mato|quer(o|ia)\s*morrer|desejo\s*de\s*morrer|penso\s*em\s*morrer)\b/i,
  /\b(nao\s*aguento\s*mais\s*viver|cansad[oa]\s*de\s*viver|cansei\s*de\s*viver|sem\s*razao\s*(pra|para)\s*viver)\b/i,
  /\bnao\s*quer(o|ia)\s*(mais\s*)?viver\b/i,
  /\bdar\s*cabo\s*da\s*minha\s*vida\b/i,
  /\b(acabar\s*com\s*(a\s*)?minha\s*vida)\b/i,
  /\b(vou|quero|quer(o|ia))\s*acabar\s*comigo\b/i,
  /\b(melhor\s*sem\s*mim)\b/i,
  /\bseria\s*melhor\s*morrer\b/i,
  // Suicide family — "suicidar" (self-ref), "cometer suicídio", "tirar minha vida"
  /\bme\s*suicidar\b/i,
  /\bcometer\s*suicidio\b/i,
  /\b(penso|pensando|pensei)\s*em\s*suicidio\b/i,
  // Clinical language — "ideação suicida", "pensamentos suicidas", "estou suicida"
  /\bideacao\s*suicida\b/i,
  /\bpensamentos?\s*suicidas?\b/i,
  /\bestou\s*suicida\b/i,
  // "tirar minha vida" — requires self-reference (minha/própria) to avoid "tirar a vida dele"
  /\b(quer(o|ia)|vou)\s*(tirar|por\s*(um\s*)?fim\s*(a|[aa]|n[oa]))\s*(a\s*)?(minha\s*(propria\s*)?|a\s*propria\s*)vida\b/i,
  /\btirar\s*(a\s*)?(minha\s*(propria\s*)?|a\s*propria\s*)vida\b/i,
  /\b(tirei|tirando)\s*(a\s*)?(minha\s*(propria\s*)?|a\s*propria\s*)vida\b/i,
  // Passive ideation (unambiguous in SOS context)
  /\bdormir\s*e\s*nao\s*acordar\b/i,
  /\bnao\s*quer(o|ia)\s*(mais\s*)?existir\b/i,
  /\bnao\s*quero\s*mais\s*estar\s*aqui\b/i,
  // Self-harm (active + past tense)
  /\b(me\s*cortei|tomei\s*remedios?\s*todos?|tomei\s*todos?\s*(os\s*)?remedios?)\b/i,
  /\bestou\s*sangrando\b/i, // narrowed — benign override for menstruation
  /\b(me\s*cortar|me\s*machucar|auto\s*lesao|autolesao|me\s*ferir)\b/i,
  // Cutting wrists — "cortar meu(s) pulso(s)", "cortei meu(s) pulso(s)"
  /\b(cort(ar|ei|ou))\s*(os?\s*|meus?\s*)?pulsos?\b/i,
  // Means with intent (infinitive + past tense: joguei, enforquei, pulei)
  /\b(pul(ar|ei|ou)\s*d[aeo]|me\s*jog(ar|uei|ou)|me\s*enforc(ar|ou)|me\s*enforquei)\b/i,
  /\b(pul(ar|ei|ou)\s*na\s*frente\s*d[aeo])\b/i,
  /\boverdose\b/i,
  // Overdose / intoxication — with articles and gender variants
  /\bengol(ir|i)\s*(um\s*monte\s*de\s*|muit[oa]s?\s*|vari[oa]s?\s*|tod[oa]s?\s*([oa]s\s*)?|[oa]s\s*)?(comprimidos?|remedios?|pilulas?|medicamentos?)\b/i,
  /\btomei\s*(muit[oa]s?|vari[oa]s?|um\s*monte\s*de)\s*(remedios?|comprimidos?|pilulas?|medicamentos?)\b/i,
  // Intent to overdose (future tense: "vou tomar")
  /\b(vou|quero)\s*tomar\s*(muit[oa]s?|vari[oa]s?|tod[oa]s?\s*([oa]s\s*)?|um\s*monte\s*de)\s*(remedios?|comprimidos?|pilulas?|medicamentos?)\b/i,
  // Mixing medication with alcohol — requires medical term (avoids "misturei bebida com energético")
  /\bmisturei\s*(remedio|remedios?|medicamento|medicacao)\b/i,
  /\bmisturei\s*(alcool|bebida|cerveja|vinho)\s*(com\s*)?(remedio|remedios?|medicamento|medicacao)\b/i,
  /\b(vou|quero)\s*misturar\s*(remedio|remedios?|medicamento|medicacao)\b/i,
  /\b(vou|quero)\s*misturar\s*(alcool|bebida|cerveja|vinho)\s*(com\s*)?(remedio|remedios?|medicamento|medicacao)\b/i,
  // "tomar tudo" — only with explicit medication context
  /\b(vou|quero)\s*tomar\s*tudo\s*(de\s*)?(remedio|medicamento|comprimido|pilula)/i,
  /\btomei\s*tudo\s*(de\s*)?(remedio|medicamento|comprimido|pilula)/i,
  // Poison / envenenar (self-reference only) / blister pack ingestion
  /\b(tomei|bebi|engoli)\s*(o\s*|um\s*pouco\s*de\s*)?veneno\b/i,
  /\b(vou|quero)\s*(beber|tomar|engolir)\s*(o\s*|um\s*pouco\s*de\s*)?veneno\b/i,
  /\bme\s*(envenenar|envenenei)\b/i,
  /\b(engoli|tomei)\s*(a\s*)?cartela\s*(inteira|toda|d[oa]\s*(remedio|remedios?|medicamento|medicamentos?))\b/i,
  /\b(vou|quero)\s*(engolir|tomar)\s*(uma\s*|a\s*)?cartela\s*(inteira|toda|d[oa]\s*(remedio|remedios?|medicamento|medicamentos?))\b/i,
  // "tomei todos os comprimidos/pílulas"
  /\btomei\s*tod[oa]s?\s*([oa]s\s*)?(comprimidos?|pilulas?|remedios?|medicamentos?)\b/i,
  // Common Brazilian psychiatric medication overdose/mixing
  /\b(tomei|engoli|bebi)\s*(muit[oa]s?|vari[oa]s?|tod[oa]s?\s*([oa]s?\s*)?|um\s*monte\s*de)?\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(muit[oa]s?|vari[oa]s?|tod[oa]s?\s*([oa]s?\s*)?|um\s*monte\s*de)?\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina)\b/i,
  /\bmisturei\s*(alcool|bebida|cerveja|vinho)\s*(com\s*)?(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina)\b/i,
  /\bmisturei\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina)\s*(com\s*)?(alcool|bebida|cerveja|vinho)\b/i,
  // Progressive self-harm (gerund: "estou me cortando/machucando/ferindo/enforcando")
  /\bestou\s*me\s*(cortando|machucando|ferindo|enforcando)\b/i,
  /\b(me\s*cortando|me\s*machucando|me\s*ferindo)\b/i,
  // Numeric dose + generic medication: "tomei 20 comprimidos", "engoli 15 remédios"
  // Requires 2+ digit number (10+) or single digits 5-9 to avoid "tomei 1 comprimido"
  /\b(tomei|engoli|bebi)\s*(\d{2,}|[5-9])\s*(comprimidos?|remedios?|pilulas?|medicamentos?)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(\d{2,}|[5-9])\s*(comprimidos?|remedios?|pilulas?|medicamentos?)\b/i,
  // Numeric dose + medication brand names: "tomei 20 clonazepam", "engoli 30 quetiapina"
  // Any number + specific psychiatric med name = crisis (even "tomei 3 rivotril" is concerning)
  /\b(tomei|engoli|bebi)\s*\d+\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*\d+\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina)\b/i,
  // Written-out numbers + medication: "tomei vinte clonazepam", "engoli dez comprimidos"
  /\b(tomei|engoli|bebi)\s*(dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|cinquenta|cem)\s*(comprimidos?|remedios?|pilulas?|medicamentos?|rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|cinquenta|cem)\s*(comprimidos?|remedios?|pilulas?|medicamentos?|rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina)\b/i,
  // "demais" quantifier: "tomei remédio demais", "tomei comprimido demais"
  /\b(tomei|engoli|bebi)\s*(remedios?|comprimidos?|pilulas?|medicamentos?)\s*demais\b/i,
  // Container patterns: "um frasco de remédio", "uma caixa de remédio"
  /\b(tomei|engoli|bebi)\s*(um\s*frasco|uma\s*caixa|a\s*caixa)\s*(inteira\s*|toda\s*)?(de\s*)?(remedios?|comprimidos?|pilulas?|medicamentos?|rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina)?\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(um\s*frasco|uma\s*caixa|a\s*caixa)\b/i,
  // Passive ideation — "preferia/prefiro não acordar"
  /\bpreferia\s*nao\s*acordar\b/i,
  /\bprefiro\s*nao\s*acordar\b/i,
  /\b(comprei\s*(uma\s*)?arma)\b/i, // benign override handles "de brinquedo/pressão"
  // Farewell (unambiguous)
  /\b(carta\s*de\s*despedida|adeus\s*pra\s*sempre)\b/i,
];

// ── Benign overrides ────────────────────────────────────────────
// Phrases that contain crisis keywords but are clearly benign.
// Benign overrides only neutralize the specific crisis phrase they cover;
// This prevents false escalation on colloquial pt-BR expressions.
const BENIGN_OVERRIDES: RegExp[] = [
  // ── Negation overrides: "não quero morrer", "não vou me matar" etc. ──
  // These express fear/relief/refusal, not intent. Suppresses the inner match.
  /nao\s*(quero|vou|queria|ia)\s*morrer/i,
  /nao\s*(quero|vou|queria|ia)\s*me\s*matar/i,
  /nao\s*(quero|vou|queria|ia)\s*me\s*suicidar/i,
  /nao\s*penso\s*em\s*morrer/i,
  /nao\s*(quero|vou|queria|ia)\s*acabar\s*comigo/i,
  /nao\s*(quero|vou|queria|ia)\s*tirar\s*(a\s*)?(minha|a\s*propria)/i,
  /nao\s*(quero|vou|queria|ia)\s*desaparecer/i,
  /nao\s*(quero|vou|queria|ia)\s*fazer\s*(uma\s*)?besteira/i,
  // ── Negation overrides for self-harm and means ──
  /nao\s*(quero|vou|queria|ia)\s*me\s*cortar/i,
  /nao\s*(quero|vou|queria|ia)\s*me\s*machucar/i,
  /nao\s*(quero|vou|queria|ia)\s*me\s*ferir/i,
  /nao\s*(quero|vou|queria|ia)\s*me\s*enforcar/i,
  /nao\s*(quero|vou|queria|ia)\s*me\s*envenenar/i,
  /nao\s*(quero|vou|queria|ia)\s*cortar\s*(os?\s*|meus?\s*)?pulsos?/i,
  /nao\s*(quero|vou|queria|ia)\s*(tomar|engolir)\s*(tudo|veneno|cartela)/i,
  /nao\s*(penso|pensei|pensando)\s*em\s*suicidio/i,
  // ── Hyperbole overrides ──
  // "vou me matar de trabalhar/rir"
  /me\s*matar?\s*de\s*(rir|trabalh|estud|corr|cans|fome|saudade|vergonha|calor|tedio)/i,
  // "me matar pra/para/por" — only benign continuations (work, study, money)
  /me\s*matar?\s*(pra|para|por)\s*(pagar|sustentar|trabalh|estud|ganhar|esse\s*projeto|essa\s*empresa)/i,
  /me\s*matar?\s*trabalhando/i,
  // "me mato de rir/trabalhar" + "me mato pra/para/por" (benign only)
  /me\s*mato\s*de\s*(rir|trabalh|estud|corr|cans|fome|saudade|vergonha|calor|tedio)/i,
  /me\s*mato\s*(pra|para|por)\s*(pagar|sustentar|trabalh|estud|ganhar|esse\s*projeto|essa\s*empresa)/i,
  // "acabar comigo de vergonha/rir" — hyperbole
  /acabar\s*comigo\s*de\s*(rir|trabalh|vergonha|saudade|fome|cans|calor|tedio)/i,
  // "vou morrer de calor/fome/rir/vergonha" — hyperbole, NOT suicidal
  /vou\s*morrer\s*de\s*(calor|fome|rir|vergonha|saudade|cans|sede|tedio|medo|preguica|sono)/i,
  // "estou sangrando por causa da menstruação/nariz" — medical, not self-harm
  // Tightly bound: requires benign noun directly after preposition
  /sangrando\s*por\s*causa\s*d[aeo]\s*(menstruacao|nariz|gengiva|dedo|espinha|hemorroida)/i,
  /sangrando\s*pel[oa]\s*(nariz|gengiva|boca)/i,
  /sangrando\s*d[aeo]\s*(nariz|gengiva|boca|dedo|ouvido)/i,
  // "comprei uma arma de brinquedo/pressão/airsoft" — not lethal
  /arma\s*de\s*(brinquedo|pressao|airsoft|fogo\s*de\s*brinquedo|agua|paintball)/i,
  // "me joguei no sofá/na cama/na piscina" — physical action, not self-harm
  /me\s*jog(ar|uei|ou)\s*(n[oa]\s*(sofa|cama|piscina|chao|jogo|time))/i,
  // "queria desaparecer da reunião/do trabalho" — figurative
  /desaparecer\s*(da\s*reuniao|do\s*trabalho|do\s*grupo|da\s*festa|da\s*escola|da\s*aula|do\s*chat)/i,
  // "tomei/engoli pílulas de vitamina" — supplement, not overdose
  /(comprimidos?|pilulas?|remedios?)\s*de\s*vitamina/i,
  // "pulei do ônibus/sofá/cama" — benign physical action, not self-harm
  /pul(ar|ei|ou)\s*d[aeo]\s*(onibus|sofa|cama|muro|barco|cavalo|bicicleta|trampolim|escada|arvore|cerca)/i,
  // "pular na frente do espelho/palco" — benign (not "na frente do trem/carro")
  /pul(ar|ei|ou)\s*na\s*frente\s*d[aeo]\s*(espelho|palco|fila|camera)/i,
  // "vou fazer besteira no trabalho/na prova" — colloquial
  /fazer\s*(uma\s*)?besteira\s*(n[oa]\s*(trabalho|prova|jogo|escola|empresa|reuniao|entrevista))/i,
];

// CONTEXTUAL: ambiguous words/phrases that only indicate crisis when combined
// with harm-related context or when multiple appear together.
// Moved here from EXPLICIT to avoid false positives like:
// - "queria sumir do grupo do WhatsApp"
// - "não queria estar aqui na reunião"
// - "cuidem do meu cachorro enquanto viajo"
// - "vou acabar com tudo no trabalho hoje"
const CONTEXTUAL_CRISIS: RegExp[] = [
  // Means — each as separate pattern so "ponte e faca" = 2 hits
  /\bcorda\b/i,
  /\bveneno\b/i,
  /\barma\b/i,
  /\bfaca\b/i,
  /\bponte\b/i,
  /\bpredio\b/i,
  /\btenho\s*um\s*plano\b/i,
  /\btestamento\b/i,
  /\b(estou\s*bebad[oa]|bebi\s*muito)\b/i,
  // Ambiguous without context — need corroboration
  /\b(quero|queria|vou)\s*sumir\b/i,
  /\bnao\s*queria\s*estar\s*aqui\b/i,
  /\bcuidem?\s*d[aeo]s?\s*meu[s]?\s*(filh|pet|gat|cachorr)/i,
  /\b(acabar\s*com\s*tudo|por\s*fim\s*(a|em)\s*tudo|encerrar\s*tudo)\b/i,
  /\bnao\s*vejo\s*saida\b/i,
  /\bvou\s*morrer\b/i,
  /\bnao\s*quero\s*acordar\b/i,
  /\bsuicidio\b/i,
  /\btomei\s*tudo\b/i,
  /\bquer(o|ia)\s*desaparecer\b/i,
  /\bvou\s*fazer\s*(uma\s*)?besteira\b/i,
  /\bsuicidar\b/i, // bare "suicidar" without "me" (third party context)
  /\bnao\s*quero\s*mais\s*nada\b/i, // ambiguous alone, crisis with harm context
];

// Context markers that elevate contextual hits to crisis.
// IMPORTANT: Terms here must NOT overlap with CONTEXTUAL_CRISIS patterns
// to avoid self-validation (e.g., "vou morrer" + morrer in HARM_CONTEXT = false positive).
// Removed: morrer, suicid, minha vida (too broad — "mudou minha vida" is benign)
const HARM_CONTEXT: RegExp = /\b(me\s*machucar|me\s*ferir|me\s*matar|nao\s*aguento|sofr(er|endo|imento)|desesperad[oa]|sem\s*esperanca|me\s*cortar|me\s*mato|acabar\s*com(igo|\s*minha\s*vida))\b/i;

const CRISIS_RESPONSE =
  "Estou aqui com você. Isso é uma emergência — por favor ligue 192 (SAMU) agora. " +
  "Se não conseguir ligar, peça para alguém próximo ligar. O CVV também está disponível no 188. " +
  "Não fique sozinho(a). Se possível, afaste meios que possam te machucar. Você não está sozinho(a).";

/**
 * Normalize text for crisis detection: strip accents via NFD and lowercase.
 * This ensures patterns without accents match input with or without accents.
 */
function normalizeCrisisText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Scan multiple texts for crisis keywords using two-tier detection:
 * - EXPLICIT patterns: scanned across ALL messages (latched for session)
 * - CONTEXTUAL patterns: scanned only in RECENT messages (last 6 turns)
 *   to avoid false-positive accumulation over long benign conversations.
 *   Only trigger when 2+ contextual hits or 1 contextual + harm context.
 */
function detectCrisisInTexts(texts: string[]): boolean {
  const normalized = texts.map(normalizeCrisisText);

  // Tier 1: Any explicit pattern in ANY message → immediate crisis (latched)
  // BUT suppress if the text matches a known benign override (e.g., "me matar de rir")
  const hasExplicit = normalized.some((t) => {
    const explicitMatches = EXPLICIT_CRISIS.filter((p) => p.test(t));
    if (explicitMatches.length === 0) return false;
    // If text has benign context, only suppress if ALL explicit matches are "explained" by the benign context
    const isBenign = BENIGN_OVERRIDES.some((b) => b.test(t));
    if (!isBenign) return true; // no benign override at all → crisis
    // Benign override present — remove benign parts from text, then re-check for remaining explicit matches
    let sanitized = t;
    for (const b of BENIGN_OVERRIDES) {
      const globalB = new RegExp(b.source, b.flags.includes('g') ? b.flags : b.flags + 'g');
      sanitized = sanitized.replace(globalB, " ");
    }
    sanitized = sanitized.trim();
    // If any explicit pattern still matches the sanitized text, it's real crisis
    return EXPLICIT_CRISIS.some((p) => p.test(sanitized));
  });
  if (hasExplicit) return true;

  // Tier 2: Contextual patterns — only check recent window (last 6 messages)
  // to avoid false positives from benign words accumulating over a long conversation.
  const recentWindow = normalized.slice(-6);
  let contextualHits = 0;
  for (const t of recentWindow) {
    for (const p of CONTEXTUAL_CRISIS) {
      if (p.test(t)) contextualHits++;
    }
  }
  const hasHarmContext = recentWindow.some((t) => HARM_CONTEXT.test(t));

  // 2+ contextual pattern hits in recent window, or 1 contextual + harm context
  return contextualHits >= 2 || (contextualHits >= 1 && hasHarmContext);
}

// Export for testing
export { detectCrisisInTexts as _detectCrisisInTexts };

// ── System prompt ────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é uma inteligência artificial de apoio emocional temporário integrada ao app "Suporte Bipolar". O paciente está em um momento difícil e possivelmente aguardando atendimento do CVV (188). Seu papel é APENAS acolher brevemente enquanto a ajuda humana não chega.

REGRAS INVIOLÁVEIS:
1. NUNCA faça diagnósticos, prescreva medicação ou sugira mudanças em tratamento.
2. NUNCA minimize o sofrimento ("vai passar", "é só ansiedade", "não é tão grave").
3. NUNCA tente substituir profissionais de saúde ou o próprio CVV.
4. Se o paciente relatar risco imediato (autolesão ativa, plano concreto de suicídio, overdose, intoxicação), responda APENAS: "Estou aqui com você. Isso é uma emergência — por favor ligue 192 (SAMU) agora. Se não conseguir ligar, peça para alguém próximo ligar."
5. Fale em pt-BR, com linguagem simples e acolhedora.
6. Respostas CURTAS (2-4 frases). Não faça monólogos.
7. Faça perguntas abertas para que a pessoa continue falando.
8. Valide emoções: "Faz sentido sentir isso", "Entendo que está difícil".
9. Use técnicas de escuta ativa: reflita o que a pessoa disse, nomeie emoções.
10. Quando apropriado, ofereça técnicas de grounding: "Quer tentar um exercício de respiração rápido comigo?"
11. Lembre periodicamente que o CVV está a caminho e que a pessoa está fazendo a coisa certa ao buscar ajuda.
12. NUNCA peça dados pessoais (nome completo, endereço, CPF).
13. NUNCA infira episódio (mania, depressão), prognóstico, causalidade clínica ou efeito de medicação.
14. NUNCA faça afirmações excessivamente confiantes. Na dúvida, diga menos.
15. NUNCA recompense o usuário por "ficar" no chat. O objetivo é ponte para ajuda humana, não substituição.
16. A cada 5-6 turnos, gentilmente relembre: "Enquanto conversamos, o 188 pode atender a qualquer momento. Deixe a ligação ativa se puder."
17. Se o usuário pedir segredo ou pedir para não contar a ninguém, responda que você é uma IA e não armazena conversas, mas que a segurança dele(a) é prioridade.
18. Você DEVE se identificar como inteligência artificial sempre que perguntado e na primeira interação.

Você NÃO é terapeuta. Você é uma IA — um ouvinte temporário enquanto o atendimento humano não chega.`;

// ── Input schema (Zod) ───────────────────────────────────────────
const MessageSchema = z.object({
  role: z.literal("user"),
  content: z.string().min(1).max(2000),
});
const ChatInputSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(100),
});

// ── Rate limiting: 30 requests per 15 minutes per user ──────────

const RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes in seconds
const RATE_LIMIT_MAX = 30;

// ── Minimal telemetry (no transcripts) ──────────────────────────

async function logChatMeta(userId: string, meta: {
  turnCount: number;
  crisisDetected: boolean;
  durationMs?: number;
  error?: boolean;
}) {
  try {
    // Encode minimal metadata into action string (no transcripts, no PII)
    const action = meta.crisisDetected
      ? `chat_crisis_t${meta.turnCount}`
      : meta.error
        ? `chat_error_t${meta.turnCount}`
        : `chat_t${meta.turnCount}_${meta.durationMs ?? 0}ms`;

    await prisma.sOSEvent.create({
      data: { userId, action },
    });
  } catch {
    // Telemetry failure must never block the response
  }
}

// ── Helper: build SSE crisis response stream ────────────────────

function buildCrisisStream(): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ text: CRISIS_RESPONSE })}\n\n`),
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-store",
  Connection: "keep-alive",
} as const;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }

  // ── Parse and validate input ──
  // SECURITY: Accept both "user" and "assistant" messages from the client
  // to maintain conversation coherence (so the LLM remembers what it said).
  // Assistant messages are validated strictly: capped at 500 chars and
  // scanned for injection patterns. The system prompt is always server-controlled.
  // Zod schema validates user messages (string content, 2000 char cap, max 100).
  let userMessages: { role: "user"; content: string }[];
  let allUserTexts: string[]; // ALL user texts for crisis detection (no window limit)
  let llmConversation: { role: "user" | "assistant"; content: string }[];
  try {
    const body = await req.json();

    // Pre-filter: accept user and assistant messages with strict validation.
    // SECURITY: assistant turns from the client are accepted to maintain
    // conversation coherence, but capped at 500 chars and scanned for
    // injection patterns. The system prompt is always server-controlled.
    const raw = body.messages;
    if (!Array.isArray(raw) || raw.length === 0) {
      return Response.json({ error: "Mensagens inválidas" }, { status: 400 });
    }

    // Injection patterns that should never appear in legitimate assistant responses
    const INJECTION_PATTERNS = [
      /\b(system|sistema)\s*:/i,
      /\bREGRAS?\s*(INVIOLAVEIS|INVIOLÁVEIS)/i,
      /\bignore\s*(previous|all|above)\s*(instructions?|prompts?)/i,
      /\byou\s*are\s*now\b/i,
      /\bforget\s*(everything|all|your)\b/i,
      /\bnew\s*instructions?\b/i,
      /\b(act|behave|pretend)\s*as\b/i,
    ];

    const validatedMessages: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of raw) {
      if (typeof m !== "object" || m === null) continue;
      const role = (m as Record<string, unknown>).role;
      const content = (m as Record<string, unknown>).content;
      if (typeof content !== "string" || !content.trim()) continue;

      if (role === "user") {
        validatedMessages.push({
          role: "user",
          content: content.slice(0, 2000),
        });
      } else if (role === "assistant") {
        // Cap assistant messages at 500 chars (real responses are ~350 chars with max_tokens: 220)
        const capped = content.slice(0, 500);
        // Scan for injection patterns — drop silently if suspicious
        const normalized = capped.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
        const isSuspicious = INJECTION_PATTERNS.some((p) => p.test(normalized));
        if (!isSuspicious) {
          validatedMessages.push({
            role: "assistant",
            content: capped,
          });
        }
        // If suspicious, silently drop this assistant turn
      }
      // Silently ignore any other roles (system, etc.)
    }

    // Extract user-only messages for crisis detection and Zod validation
    const userOnly = validatedMessages
      .filter((m): m is { role: "user"; content: string } => m.role === "user");

    if (userOnly.length === 0) {
      return Response.json({ error: "Nenhuma mensagem de usuário" }, { status: 400 });
    }

    const parsed = ChatInputSchema.safeParse({ messages: userOnly });
    if (!parsed.success) {
      return Response.json({ error: "Mensagens inválidas" }, { status: 400 });
    }
    userMessages = parsed.data.messages;
    // Capture ALL user texts for crisis detection BEFORE slicing.
    // This ensures EXPLICIT crisis in message 1 stays latched even after
    // 20+ messages, while CONTEXTUAL still uses its own 6-message window.
    allUserTexts = userMessages.map((m) => m.content);

    // For LLM context, use the full conversation (both roles), limited to last 40 messages
    llmConversation = validatedMessages;
    if (llmConversation.length > 40) {
      llmConversation = llmConversation.slice(-40);
    }
    // Ensure conversation starts with a user message (Anthropic API requirement)
    while (llmConversation.length > 0 && llmConversation[0].role !== "user") {
      llmConversation.shift();
    }
    // Ensure proper alternation: merge consecutive same-role messages
    const alternating: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of llmConversation) {
      if (alternating.length > 0 && alternating[alternating.length - 1].role === msg.role) {
        // Merge consecutive same-role messages
        alternating[alternating.length - 1].content += "\n" + msg.content;
      } else {
        alternating.push({ ...msg });
      }
    }
    llmConversation = alternating;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  // ── LAYER 1: Deterministic crisis detection BEFORE rate limit ──
  // Scan ALL user messages (not sliced) so crisis is truly "latched" for
  // the entire conversation. detectCrisisInTexts scans ALL for EXPLICIT
  // and only the last 6 for CONTEXTUAL, so passing all is safe.
  const recentUserTexts = allUserTexts;

  if (detectCrisisInTexts(recentUserTexts)) {
    // Crisis users ALWAYS get the static response, even if rate-limited
    // Fire-and-forget: NEVER block the crisis response on telemetry
    logChatMeta(session.userId, {
      turnCount: allUserTexts.length, // Use full count, not sliced
      crisisDetected: true,
    }).catch(() => {});
    return new Response(buildCrisisStream(), { headers: SSE_HEADERS });
  }

  // ── LAYER 2: Rate limit (only for non-crisis requests) ──
  const allowed = await checkRateLimit(
    `sos_chat:${session.userId}`,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW,
  );
  if (!allowed) {
    return Response.json(
      { error: "Muitas mensagens. Aguarde alguns minutos ou ligue 188/192." },
      { status: 429 },
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fallback: return static support message when API unavailable
    return Response.json({
      fallback: true,
      text: "O serviço de chat está temporariamente indisponível. Se precisar de ajuda agora, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada ou o aterramento nesta mesma página.",
    }, { status: 200 });
  }

  // ── LAYER 3: LLM streaming response ──
  // Use the validated conversation with real assistant context.
  // The client sends both user and assistant turns; assistant turns are
  // capped at 500 chars and scanned for injection patterns (see above).
  // The alternating array already ensures proper role alternation
  // (consecutive same-role messages are merged, starts with user).
  const llmMessages = llmConversation;

  const startMs = Date.now();
  const anthropic = new Anthropic({ apiKey });
  let streamError = false;

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = await anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 220,
          system: SYSTEM_PROMPT,
          messages: llmMessages,
        });

        let hasContent = false;
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            hasContent = true;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`),
            );
          }
        }

        // Handle refusal/empty response: if Claude refused or produced no text,
        // send a safe fallback instead of leaving the user with an empty response
        if (!hasContent) {
          const refusalMsg = "Estou aqui com você. Se precisar de ajuda imediata, ligue 192 (SAMU) ou 188 (CVV). Você também pode usar a respiração guiada aqui no app.";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: refusalMsg, fallback: true })}\n\n`),
          );
        }
      } catch (err) {
        Sentry.captureException(err, { tags: { endpoint: "sos-chat" } });
        streamError = true;
        // Fallback: send static support message instead of raw error
        const fallbackMsg = "Houve uma falha temporária. Enquanto isso, lembre-se: ligue 192 (SAMU) se houver risco, ou 188 (CVV) para conversar. Você também pode usar a respiração guiada aqui no app.";
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: fallbackMsg, fallback: true })}\n\n`),
        );
      } finally {
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
        // Log minimal metadata (no transcripts)
        logChatMeta(session.userId, {
          turnCount: userMessages.length,
          crisisDetected: false,
          durationMs: Date.now() - startMs,
          error: streamError,
        }).catch(() => {});
      }
    },
  });

  return new Response(readable, { headers: SSE_HEADERS });
}
