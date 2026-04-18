// ── Crisis Detection Module ──────────────────────────────────────
// Extracted from src/app/api/sos/chat/route.ts for modularity and testability.

// ── Deterministic crisis keyword detection (pt-BR) ──────────────
// ALL patterns use accent-free text: NFD decomposition + combining diacritical
// mark removal (U+0300–U+036F) + lowercase. This ensures patterns without
// accents match input with or without accents ("não"→"nao", "remédio"→"remedio").
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
  // "misturei com álcool" — moved to MEDICATION_CONDITIONAL_EXPLICIT (R15 audit fix:
  // naked alcohol mixing without medication mention is ambiguous, e.g. "misturei energético com cerveja")
  // When medication context present in same message → promoted to EXPLICIT. Otherwise → CONTEXTUAL_HARM.
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
  // Common Brazilian psychiatric medication (PSYCH_MED_NAMES) overdose/mixing
  // Includes: benzodiazepines, antidepressants, mood stabilizers, antipsychotics
  // IMPORTANT: Quantifier is REQUIRED (no ?) to avoid matching normal therapeutic speech
  // like "tomei rivotril" or "tomei sertralina". Numeric doses are handled by separate patterns below.
  // R13: Added olanzapina/zyprexa, aripiprazol/abilify, lamotrigina, valproato/depakote/depakene,
  //       venlafaxina, desvenlafaxina, topiramato, oxcarbazepina
  /\b(tomei|engoli|bebi)\s*(muit[oa]s?|vari[oa]s?|tod[oa]s?\s*([oa]s?\s*)?|um\s*monte\s*de)\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(muit[oa]s?|vari[oa]s?|tod[oa]s?\s*([oa]s?\s*)?|um\s*monte\s*de)\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  /\bmisturei\s*(alcool|bebida|cerveja|vinho)\s*(com\s*)?(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  /\bmisturei\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\s*(com\s*)?(alcool|bebida|cerveja|vinho)\b/i,
  // Progressive self-harm (gerund: "estou me cortando/machucando/ferindo/enforcando")
  /\bestou\s*me\s*(cortando|machucando|ferindo|enforcando)\b/i,
  /\b(me\s*cortando|me\s*machucando|me\s*ferindo)\b/i,
  // Numeric dose + generic medication: "tomei 20 comprimidos", "engoli 15 remédios"
  // Requires 2+ digit number (10+) or single digits 5-9 to avoid "tomei 1 comprimido"
  /\b(tomei|engoli|bebi)\s*(\d{2,}|[5-9])\s*(comprimidos?|remedios?|pilulas?|medicamentos?)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(\d{2,}|[5-9])\s*(comprimidos?|remedios?|pilulas?|medicamentos?)\b/i,
  // Numeric dose + medication brand names: "tomei 3 clonazepam", "engoli 30 quetiapina"
  // Requires 2+ to avoid matching "tomei 1 rivotril" (normal therapeutic dose).
  // Even "tomei 2 rivotril" is flagged — doubling a psychiatric med is clinically concerning.
  /\b(tomei|engoli|bebi)\s*([2-9]|\d{2,})\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*([2-9]|\d{2,})\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  // Written-out numbers + GENERIC medication (≥5 to match numeric threshold)
  // R15 audit fix: added treze, catorze/quatorze, dezesseis-dezenove (10-19 gap)
  /\b(tomei|engoli|bebi)\s*(cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|cem)\s*(comprimidos?|remedios?|pilulas?|medicamentos?)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|cem)\s*(comprimidos?|remedios?|pilulas?|medicamentos?)\b/i,
  // Written-out numbers + BRAND medication (≥2 — doubling psychiatric meds is concerning)
  // R15 audit fix: added treze, catorze/quatorze, dezesseis-dezenove
  /\b(tomei|engoli|bebi)\s*(dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|cem)\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(dois|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|cem)\s*(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  // High written-out numbers without medication word — in SOS context, "tomei vinte/trinta"
  // implies medication overdose. Threshold: 20+ (≥vinte) for tomei, 10+ for engoli. (R15 audit fix)
  // engoli is semantically specific to pill ingestion → 10+ stays EXPLICIT
  // tomei 10-19 → MEDICATION_CONDITIONAL (polysemic: "tomei dez minutos")
  /\btomei\s*(vinte|trinta|quarenta|cinquenta|cem|duzentos)\b/i,
  /\bengoli\s*(dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|cem|duzentos)\b/i,
  // Numeric dose without medication word: engoli stays EXPLICIT, tomei → MEDICATION_CONDITIONAL
  // R15 audit fix: expanded negative lookahead (gotas, mcg, doses, jatos, sprays, etc.)
  /\bengoli\s*(\d{2,})\b(?!\s*(minutos?|horas?|dias?|segundos?|litros?|ml|mg|mcg|g|gotas?|gotinhas?|doses?|jatos?|sprays?|copos?|goles?|anos?|meses?|semanas?|vezes?))/i,
  // ── R16 audit: gotas/doses + psychiatric medication (FN fix) ──
  // "tomei 80 gotas de rivotril" is dangerous even though "tomei 10 gotas" alone is benign.
  // These patterns require a psychiatric med name, so generic "gotas" stays excluded above.
  /\b(tomei|engoli|bebi)\s*(\d{2,}|[5-9])\s*(gotas?|doses?)\s*(de\s*)?(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(\d{2,}|[5-9])\s*(gotas?|doses?)\s*(de\s*)?(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  // "gotas/doses de [psych med]" with written-out numbers (≥5)
  /\b(tomei|engoli|bebi)\s*(cinco|seis|sete|oito|nove|dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte|trinta|quarenta|cinquenta|cem)\s*(gotas?|doses?)\s*(de\s*)?(rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i,
  // ── R16 audit: dose multiplier patterns (FN fix) ──
  // "foi 10x a dose", "3x a dose", "tomei 10 vezes a dose"
  /\b(\d+)\s*x\s*(a\s*)?dose\b/i,
  /\b(tomei|engoli|bebi)\s*(\d+)\s*vezes?\s*(a\s*)?dose\b/i,
  /\b(\d+)\s*vezes?\s*(a\s*|o\s*)?(dose|que\s*(eu\s*)?(devia|deveria|devo))\b/i,
  // "demais" quantifier: "tomei remédio demais", "tomei comprimido demais"
  /\b(tomei|engoli|bebi)\s*(remedios?|comprimidos?|pilulas?|medicamentos?)\s*demais\b/i,
  // Container patterns: "um frasco de remédio", "uma caixa de remédio"
  /\b(tomei|engoli|bebi)\s*(um\s*frasco|uma\s*caixa|a\s*caixa)\s*(inteira\s*|toda\s*)?(de\s*)?(remedios?|comprimidos?|pilulas?|medicamentos?|rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)?\b/i,
  /\b(vou|quero)\s*(tomar|engolir)\s*(um\s*frasco|uma\s*caixa|a\s*caixa)\b/i,
  // "engolir o resto" — engolir is semantically specific to pill/substance ingestion (R15 audit)
  // "tomar o resto" moved to MEDICATION_CONDITIONAL_EXPLICIT (polysemic: "tomar o resto do café")
  /\b(vou|quero)\s*engolir\s*o\s*resto\b/i,
  /\bengoli\s*o\s*resto\b/i,
  // ── New overdose/alcohol paraphrases (R15 audit) ──
  // "bebi junto com o remédio" — explicit medication + alcohol co-ingestion
  /\bbebi\s*(junto\s*)?(com\s*)(o\s*)?(remedio|remedios|medicamento|medicamentos|medicacao)\b/i,
  // "juntei remédio e cerveja" — combining medication with alcohol
  /\bjuntei\s*(remedio|remedios|medicamento|medicamentos|medicacao)\s*(com|e)\s*(alcool|bebida|cerveja|vinho|vodka|pinga|whisky|cachaca)\b/i,
  /\bjuntei\s*(alcool|bebida|cerveja|vinho|vodka|pinga|whisky|cachaca)\s*(com|e)\s*(remedio|remedios|medicamento|medicamentos|medicacao)\b/i,
  // "virar a cartela" — colloquial for consuming entire blister pack
  /\b(vou|quero)\s*virar\s*(a\s*)?cartela\b/i,
  /\bvirei\s*(a\s*)?cartela\b/i,
  // R16 audit: "mandar tudo pra dentro" moved to MEDICATION_CONDITIONAL (too colloquial —
  // could be food, drink, supplements). Only crisis with medication context.
  // R16 audit: "tomar tudo de uma vez" moved to MEDICATION_CONDITIONAL (polysemic with tomar).
  // "engolir tudo de uma vez" stays EXPLICIT (engolir is semantically specific to pills).
  /\b(vou|quero)\s*engolir\s*(tudo|todos?)\s*de\s*uma\s*vez\b/i,
  /\bengoli\s*(tudo|todos?)\s*de\s*uma\s*vez\b/i,
  // R16 audit: "quero apagar de vez" moved to CONTEXTUAL_HARM (ideation, not method).
  // Passive ideation — "preferia/prefiro não acordar"
  /\bpreferia\s*nao\s*acordar\b/i,
  /\bprefiro\s*nao\s*acordar\b/i,
  /\b(comprei\s*(uma\s*)?arma)\b/i, // benign override handles "de brinquedo/pressão"
  // Passive ideation — additional variants
  /\bnao\s*queria\s*ter\s*acordado\b/i,
  /\bqueria\s*dormir\s*(pra|para)\s*sempre\b/i,
  /\bnao\s*quer(o|ia)\s*estar\s*viv[oa]\b/i,
  /\bdar\s*fim\s*em\s*mim\b/i,
  /\bnao\s*queria\s*ter\s*nascido\b/i,
  // Brazilian-specific poisoning means
  // Includes synonyms: "veneno de rato" = chumbinho, "Qboa/Cândida/lixívia" = água sanitária
  /\b(tomei|bebi|engoli|comi)\s*(chumbinho|agua\s*sanitaria|soda\s*caustica|cloro|desinfetante|raticida|veneno\s*de\s*rato|qboa|candida|lixivia)\b/i,
  /\b(vou|quero)\s*(tomar|beber|engolir|comer)\s*(chumbinho|agua\s*sanitaria|soda\s*caustica|cloro|desinfetante|raticida|veneno\s*de\s*rato|qboa|candida|lixivia)\b/i,
  // Gas-related means — includes "botijão", "GLP", "gás aberto"
  /\b(abrir|abri|ligar|liguei)\s*o\s*gas\b/i,
  /\b(gas\s*de\s*cozinha|gas\s*aberto|botijao|glp)\b/i,
  // Vehicular self-harm — includes moto, caminhão, ônibus (not just carro)
  /\b(bater|jogar|meter|acelerar)\s*(o\s*|a\s*)?(carro|moto|caminhao|onibus)\s*(no|contra|n[oa])\b/i,
  /\b(vou|quero)\s*(bater|jogar|meter)\s*(o\s*|a\s*)?(carro|moto|caminhao|onibus)\b/i,
  // "pular na frente do carro/trem/caminhão/moto/ônibus"
  /\b(pul(ar|ei|ou)\s*na\s*frente\s*d[aeo]\s*(carro|trem|caminhao|moto|onibus|metro|carreta))\b/i,
  // Self-harm beyond cutting
  /\b(me\s*queimei|me\s*queimar|me\s*mutilar|me\s*mutilei|me\s*furar|me\s*furei|me\s*esfaquear|me\s*esfaqueei)\b/i,
  /\bestou\s*me\s*(queimando|mutilando|furando|esfaqueando)\b/i,
  /\b(abrir|abri)\s*(os\s*|meus?\s*)?pulsos?\b/i,
  // Farewell (unambiguous)
  /\b(carta\s*de\s*despedida|adeus\s*pra\s*sempre)\b/i,
  // ── R17 audit: narrow idiomatic self-reference patterns ──
  // Kept EXPLICIT only when the phrase bundles self-reference AND cannot plausibly
  // describe a benign topic (gaming, academic, memory). Ambiguous colloquialisms
  // ("vou apagar de uma vez", "meu plano final") are in CONTEXTUAL_HARM instead —
  // they only escalate when corroborated by harm context.
  /\b(e|eh)\s*o\s*fim\s*(da\s*linha\s*)?p(a|r)?ra\s*mim\b/i,
  /\bnao\s*(tem|ha|existe)\s*mais\s*saida\s*(p(a|r)?ra\s*mim|na\s*minha\s*vida)\b/i,
];

// ── Dose escalation invalidation ──────────────────────────────────
// If ANY of these patterns appear in the same message as a medication dose override,
// the dose override is invalidated (crisis wins). This prevents masking disclosure
// of overdose intent that follows a benign medication mention.
// P0 audit fix: "meu psiquiatra mandou tomar dois, eu tomei vinte" must detect.
const DOSE_ESCALATION_PATTERNS: RegExp[] = [
  /\b(misturei|misturar)\s*com\s*(alcool|bebida|cerveja|vinho|vodka|pinga|whisky|cachaca)/i,
  /\b(misturei|misturar)\s*(alcool|bebida|cerveja|vinho|vodka|pinga|whisky|cachaca)\s*com\s*(remedio|remedios|medicamento|medicacao)/i,
  /\b(alcool|bebida|cerveja|vinho|vodka|pinga|whisky|cachaca)\s*(com\s*)?(remedio|remedios|medicamento|medicacao)/i,
  /\bo\s*resto\b/i, // "vou tomar o resto"
  /\bpra\s*(apagar|morrer|dormir\s*pra\s*sempre|acabar|sumir)\b/i,
  /\b(cartela\s*(inteira|toda)|frasco\s*(inteiro|todo)|caixa\s*(inteira|toda))\b/i,
  /\b(todos?\s*(os\s*)?(remedios?|comprimidos?|pilulas?|medicamentos?))\b/i,
  /\b(muit[oa]s?\s*(remedios?|comprimidos?|pilulas?|medicamentos?))\b/i,
  /\b(vou|quero)\s*(me\s*matar|morrer|acabar\s*comigo|me\s*suicidar)\b/i,
  // High numbers (written or numeric ≥10) suggest overdose even without explicit med word
  /\b(tomei|engoli)\s*(vinte|trinta|quarenta|cinquenta|cem|duzentos)\b/i,
  /\b(tomei|engoli)\s*\d{2,}\b/i,
  // Alcohol mixing (requires "com" before alcohol, or alcohol+com+med)
  /\bmisturei\s*com\s*(alcool|bebida|cerveja|vinho|vodka|pinga|whisky|cachaca)\b/i,
  /\bmisturei\s*(alcool|bebida|cerveja|vinho|vodka|pinga|whisky|cachaca)\s*com/i,
  // R15 audit: "pra potencializar" — combining substances to amplify effect
  /\bpra\s*potencializar\b/i,
];

// Medication dose overrides — separated from general benign overrides so they can be
// selectively disabled when escalation patterns are present in the same message.
const DOSE_BENIGN_OVERRIDES: RegExp[] = [
  // "meu psiquiatra mandou tomar dois clonazepam" — prescribed doubling
  /(medico|psiquiatra|doutor|doutora)\s*(mandou|receitou|orientou|prescreveu|pediu|falou\s*(pra|para))\s*(tomar|eu\s*tomar|engolir)/i,
  // "por orientação médica tomei [N] [med]" — match ONLY the medical context phrase + optional dose/med
  // IMPORTANT: must NOT use .*$ — greedy tail would consume crisis content in same message
  /por\s*orientacao\s*(medica|do\s*medico|do\s*psiquiatra|da\s*psiquiatra)\s*(tomei|tomo|engoli|vou\s*tomar)\s*(\d+\s*)?(comprimidos?|remedios?|medicamentos?|pilulas?|rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)?/i,
  // "dobrou a dose" / "aumentou a dose" — medical adjustment
  /(dobrou|aumentou|ajustou|mudou)\s*(a\s*)?dose/i,
  // "esqueci a dose e tomei duas" — catch-up dosing
  /esqueci\s*(a\s*)?dose\s*(e|ai|aí)\s*(tomei|corrigi)/i,
  // "tomo cinco comprimidos por dia" / "minha receita é 3 comprimidos" — routine adherence
  /\btomo\s*(dois|tres|quatro|cinco|seis|[2-9]|\d{2,})\s*(comprimidos?|remedios?|medicamentos?)\s*(por\s*dia|de\s*manha|a\s*noite|ao\s*dia|diariamente)/i,
  /(receita|prescricao)\s*(e|eh|sao)\s*\d+\s*(comprimidos?|remedios?)/i,
];

// ── Medication-conditional EXPLICIT patterns (R15 audit) ──────────
// These patterns are EXPLICIT (→ crisis) ONLY when medication-related context
// exists in the same message. Without medication context, they contribute to
// CONTEXTUAL_HARM hit count instead. This prevents FP on ambiguous phrases like
// "misturei energético com cerveja" or "vou tomar o resto do café".
//
// Rationale (GPT Pro R15 audit):
// - "engoli" is semantically specific to pill/substance ingestion → stays EXPLICIT
// - "tomei" is polysemic (tomei café, tomei sol, tomei nota) → conditional
// - "misturei com cerveja" without med word is ambiguous → conditional
const MEDICATION_CONDITIONAL_EXPLICIT: RegExp[] = [
  // "misturei com álcool/cerveja" — ambiguous without medication mention
  /\bmisturei\s*com\s*(alcool|bebida|cerveja|vinho|vodka|pinga|whisky|cachaca)\b/i,
  // "vou/quero tomar o resto" — ambiguous ("tomar o resto do antibiótico amanhã" is benign)
  /\b(vou|quero)\s*tomar\s*o\s*resto\b/i,
  // "tomei o resto" — ambiguous without medication context
  /\btomei\s*o\s*resto\b/i,
  // "tomei [≥10 numeric]" — polysemic without medication context
  // Expanded negative lookahead: gotas, gotinhas, mcg, doses, jatos, sprays, etc.
  /\btomei\s*(\d{2,})\b(?!\s*(minutos?|horas?|dias?|segundos?|litros?|ml|mg|mcg|g|gotas?|gotinhas?|doses?|jatos?|sprays?|copos?|goles?|anos?|meses?|semanas?|vezes?))/i,
  // "tomei [dez-dezenove]" — written-out 10-19 without medication word
  // (≥20 stays in EXPLICIT because "tomei vinte" is unambiguous in SOS context)
  /\btomei\s*(dez|onze|doze|treze|catorze|quatorze|quinze|dezesseis|dezessete|dezoito|dezenove)\b/i,
  // R16 audit: "mandar tudo pra dentro" — colloquial, could be food/drink/supplements.
  // Only crisis with medication context present.
  /\b(vou|quero)\s*mandar\s*tudo\s*(pra|para)\s*dentro\b/i,
  /\bmandei\s*tudo\s*(pra|para)\s*dentro\b/i,
  // R16 audit: "tomar tudo/todos de uma vez" — polysemic with tomar (could be pills OR food).
  // Only crisis with medication context. (engolir variant stays in EXPLICIT.)
  /\b(vou|quero)\s*tomar\s*(tudo|todos?)\s*de\s*uma\s*vez\b/i,
  /\btomei\s*(tudo|todos?)\s*de\s*uma\s*vez\b/i,
];

// Medication-related lexicon that promotes MEDICATION_CONDITIONAL patterns to EXPLICIT.
// R16 audit: split into STRONG (high-precision medication terms) and WEAK (ambiguous terms).
// Only STRONG context promotes conditional patterns to EXPLICIT.
// WEAK terms (dose, caixa, frasco, receita, prescricao) are too ambiguous alone —
// "dose" can be a drink, "caixa" is generic, "receita" can be culinary.
const MED_CONTEXT_STRONG: RegExp = /\b(remedio|remedios|medicamento|medicamentos|medicacao|comprimido|comprimidos|pilula|pilulas|cartela|rivotril|clonazepam|diazepam|valium|lexotan|bromazepam|frontal|alprazolam|sertralina|fluoxetina|litio|carbamazepina|quetiapina|seroquel|risperidona|haldol|haloperidol|amitriptilina|tryptanol|clozapina|olanzapina|zyprexa|aripiprazol|abilify|lamotrigina|valproato|depakote|depakene|venlafaxina|desvenlafaxina|topiramato|oxcarbazepina)\b/i;


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
  // NOTE: Legitimate medication dose overrides moved to DOSE_BENIGN_OVERRIDES
  // (separate array with escalation guard — see DOSE_ESCALATION_PATTERNS)
  // ── Gas/cleaning/cooking overrides ──
  // "liguei o gás pra fazer café/cozinhar" — domestic use, not self-harm
  /(abrir|abri|ligar|liguei)\s*o\s*gas\s*(pra|para|e)\s*(fazer|fiz|cozinhar|cozinhei|esquentar|aquecer|preparar|preparei|ferver)/i,
  /gas\s*(do\s*fogao|pra\s*cozinhar|para\s*cozinhar)/i,
  // "botijão acabou/vazou/preciso trocar" — domestic gas supply talk
  /botijao\s*(acabou|vazio|vazou|cheio|novo|trocar|comprar|pedir)/i,
  /(trocar|comprar|pedir|buscar)\s*(o\s*)?botijao/i,
  // "GLP" in cooking/supply context
  /glp\s*(do\s*fogao|acabou|pra\s*cozinhar)/i,
  // "usei cloro/desinfetante na limpeza/no banheiro" — cleaning context
  /(usei|usando|uso|comprei|peguei)\s*(cloro|desinfetante|agua\s*sanitaria)\s*(na\s*|no\s*|pra\s*|para\s*)?(limpeza|banheiro|cozinha|casa|chao|pia|roupa)/i,
  /(cloro|desinfetante|agua\s*sanitaria)\s*(pra|para|na|no)\s*(limp|lavar|desinfetar)/i,
  // ── Accidental self-harm overrides ──
  // "me queimei no forno/fogão/panela/ferro" — cooking/domestic accident
  /me\s*queimei\s*(n[oa]\s*(forno|fogao|panela|ferro|churrasqueira|frigideira|oleo)|com\s*(agua\s*quente|oleo|panela|ferro|cafe))/i,
  // "furei o dedo costurando/cozinhando" — accident
  /furei\s*(o\s*)?dedo\s*(costurando|cozinhando|com\s*(agulha|espinho|prego|alfinete))/i,
  /me\s*furei\s*(costurando|cozinhando|com\s*(agulha|espinho|prego|alfinete))/i,
  // "bati o carro sem querer/no poste acidentalmente" — accident, not intentional
  /bat(i|eu|er)\s*(o\s*|a\s*)?(carro|moto|caminhao|onibus)\s*(sem\s*querer|acidentalmente|por\s*acidente|no\s*estacionamento|na\s*garagem)/i,
  // "me machuquei cozinhando/treinando/jogando" — accidental injury
  /me\s*machuqu?ei\s*(cozinhando|treinando|jogando|correndo|brincando|trabalhando|no\s*treino|na\s*academia)/i,
  // ── Insomnia external cause overrides ──
  // "não dormi por causa do bebê/barulho/plantão/vizinho/dor" — external cause
  /nao\s*(durmo|dormi|consigo\s*dormir)\s*(por\s*causa|porque|devido)\s*(d[oa]\s*)?(bebe|nenem|crianca|barulho|vizinho|plantao|trabalho|prova|dor|calor|frio|mosquito|obras?)/i,
  /(sem\s*dormir|acordad[oa])\s*(por\s*causa|porque|devido)\s*(d[oa]\s*)?(bebe|nenem|crianca|barulho|vizinho|plantao|trabalho|prova|dor|calor|frio|mosquito|obras?)/i,
  // "pulei do ônibus/sofá/cama" — benign physical action, not self-harm
  /pul(ar|ei|ou)\s*d[aeo]\s*(onibus|sofa|cama|muro|barco|cavalo|bicicleta|trampolim|escada|arvore|cerca)/i,
  // "pular na frente do espelho/palco" — benign (not "na frente do trem/carro")
  /pul(ar|ei|ou)\s*na\s*frente\s*d[aeo]\s*(espelho|palco|fila|camera)/i,
  // "vou fazer besteira no trabalho/na prova" — colloquial
  /fazer\s*(uma\s*)?besteira\s*(n[oa]\s*(trabalho|prova|jogo|escola|empresa|reuniao|entrevista))/i,
  // "vou fazer merda no trabalho/na prova" — colloquial variant
  /fazer\s*(uma\s*)?merda\s*(n[oa]\s*(trabalho|prova|jogo|escola|empresa|reuniao|entrevista))/i,
  // "me joguei no chão/rede/cadeira" — physical action, not self-harm
  /me\s*jog(ar|uei|ou)\s*(n[oa]\s*(chao|rede|cadeira|tapete|grama|areia|colchao))/i,
  // "pulei da cadeira/escada/árvore" — physical action (extends existing list)
  // NOTE: escada/arvore already in main benign override; adding cadeira/cerca/portão
  /pul(ar|ei|ou)\s*d[aeo]\s*(cadeira|portao|banco|mesa)/i,
  // "tomei uma caixa de leite/suco/água/chá" — food/drink, not medication
  /(caixa|frasco)\s*de\s*(leite|suco|agua|cha|cafe|iogurte|cerveja|vinho|vitamina)/i,
];

// CONTEXTUAL patterns are split into HARM (suicide/means) and BIPOLAR (decompensation).
// HARM contextual triggers the same CRISIS_RESPONSE as EXPLICIT.
// BIPOLAR contextual (alone, without harm) triggers a DECOMPENSATION_RESPONSE
// that directs to psychiatric care (CAPS/UPA) instead of SAMU 192.
// This separation is clinically important: bipolar decompensation signals
// (agitation, insomnia, mixed state) need urgent psychiatric attention but
// are NOT equivalent to imminent suicide risk (NICE, ISBD, STEP-BD).

// CONTEXTUAL_HARM: ambiguous suicide/harm words — triggers crisis when combined.
const CONTEXTUAL_HARM: RegExp[] = [
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
  /\bvou\s*fazer\s*(uma\s*)?merda\b/i, // colloquial variant of "besteira"
  /\bsuicidar\b/i, // bare "suicidar" without "me" (third party context)
  /\bnao\s*quero\s*mais\s*nada\b/i, // ambiguous alone, crisis with harm context
  // R16 audit: "quero apagar de vez" — ideation/intent to lose consciousness,
  // but too vague for EXPLICIT (could mean "apagar a memória", figurative).
  // Needs corroboration (harm context or 2+ hits).
  /\bquero\s*apagar\s*de\s*vez\b/i,
  // R17 audit: moved from EXPLICIT after false-positive review.
  // "vou/quero/queria apagar de uma vez" / "apagar pra sempre" — ambiguous
  // because benign tails like "…essa memória", "…essa lembrança" are common.
  // Needs harm-context corroboration to escalate.
  // ("meu plano final" intentionally NOT added — would double-match with the
  // existing "tenho um plano" pattern and escalate academic speech to CRISIS.)
  /\b(vou|quero|queria)\s*apagar\s*(de\s*uma\s*vez|p(a|r)?ra\s*sempre)\b/i,
];

// CONTEXTUAL_BIPOLAR: bipolar decompensation signals.
// Clinically important but NOT equivalent to imminent suicide risk.
// 2+ bipolar hits (without harm) → DECOMPENSATION_RESPONSE (CAPS/UPA/psiquiatra).
// 1 bipolar + harm context or 1 bipolar + 1 harm → CRISIS_RESPONSE (SAMU 192).
// BIPOLAR_SEVERE subset (below): single hit = decompensation (acute psychiatric emergency).
const CONTEXTUAL_BIPOLAR: RegExp[] = [
  /\b(estado\s*misto|misto\s*e\s*(depress|agit))/i, // patient self-reports mixed state
  // Multi-day insomnia — extended to catch "há 10 dias", "72 horas", "duas semanas", "um mês"
  /\b(nao\s*durmo|nao\s*consigo\s*dormir)\s*(ha|a|faz)\s*(dias|noites|[2-9]|\d{2,}|uma\s*semana|duas?\s*semanas?|um\s*mes|muito\s*tempo|\d+\s*horas)/i,
  /\b(sem\s*dormir|acordad[oa])\s*(ha|a|faz)\s*(dias|noites|[2-9]|\d{2,}|uma\s*semana|duas?\s*semanas?|um\s*mes|muito\s*tempo|\d+\s*horas)/i,
  /\b(agitad[oa]|agitacao|nao\s*(paro|consigo\s*parar))\b/i, // psychomotor agitation
  /\b(perdi\s*o\s*controle|fora\s*de\s*controle|descontrolad[oa])\b/i, // loss of control (impulsivity)
  /\b(gastei\s*tudo|gastei\s*muito\s*dinheiro|divida|endividad[oa])\b/i, // impulsive spending
  /\b(vozes|ouvindo\s*vozes|ouco\s*vozes)\b/i, // psychotic features (bipolar I)
  /\b(acelerado|pensamentos?\s*acelerados?|cabeca\s*nao\s*para)\b/i, // racing thoughts
  /\b(irritad[oa]\s*demais|raiva\s*incontrolavel|explodi|explodindo)\b/i, // severe irritability
];

// BIPOLAR_SEVERE: subset of bipolar patterns severe enough for single-hit decompensation.
// These represent acute psychiatric states needing immediate professional attention,
// even without a second corroborating signal.
// Per NHS/NIMH: psychotic features, prolonged insomnia (≥3d), mixed state, and
// severe loss of control are indicators of acute mania/crisis warranting urgent evaluation.
const BIPOLAR_SEVERE: RegExp[] = [
  /\b(ouvindo\s*vozes|ouco\s*vozes)\b/i, // psychotic symptom
  /\bestado\s*misto\b/i, // clinical term — unambiguous in SOS context
  // NOTE: "fora de controle" deliberately NOT here — too broad ("perdi controle da dieta").
  // It remains in CONTEXTUAL_BIPOLAR (requires 2+ hits or harm context).
  // Prolonged insomnia ≥3 days / ≥48h — severe sleep deprivation
  /\b(nao\s*durmo|nao\s*consigo\s*dormir|sem\s*dormir|acordad[oa])\s*(ha|a|faz)\s*([3-9]|\d{2,}|uma\s*semana|duas?\s*semanas?|um\s*mes|muito\s*tempo|\d+\s*horas)/i,
];

// Context markers that elevate contextual hits to crisis.
// IMPORTANT: Terms here must NOT overlap with CONTEXTUAL_HARM or CONTEXTUAL_BIPOLAR patterns
// to avoid self-validation (e.g., "vou morrer" + morrer in HARM_CONTEXT = false positive).
// Removed: morrer, suicid, minha vida (too broad — "mudou minha vida" is benign)
const HARM_CONTEXT: RegExp = /\b(me\s*machucar|me\s*ferir|me\s*matar|nao\s*aguento|sofr(er|endo|imento)|desesperad[oa]|sem\s*esperanca|me\s*cortar|me\s*mato|acabar\s*com(igo|\s*minha\s*vida)|surtando|surto|em\s*panico|panico|nao\s*sei\s*o\s*que\s*fazer|preciso\s*de\s*ajuda\s*urgente|perigo)\b/i;

export const CRISIS_RESPONSE =
  "Estou aqui com você. Isso é uma emergência — por favor ligue 192 (SAMU) agora. " +
  "Se não conseguir ligar, peça para alguém próximo ligar. O CVV também está disponível no 188. " +
  "Não fique sozinho(a). Se possível, afaste meios que possam te machucar. Você não está sozinho(a).";

// Separate response for bipolar decompensation without explicit self-harm/suicidality.
// Directs to psychiatric care (CAPS/UPA/psiquiatra) instead of SAMU 192.
export const DECOMPENSATION_RESPONSE =
  "Percebo sinais de descompensação que precisam de atenção profissional urgente. " +
  "Por favor, entre em contato com seu psiquiatra ou vá ao CAPS/pronto-socorro psiquiátrico o mais rápido possível. " +
  "Se não tiver psiquiatra, procure a UPA ou o pronto-socorro mais próximo. " +
  "Enquanto isso, tente se manter em um ambiente seguro e, se possível, peça a alguém de confiança para ficar com você. " +
  "O CVV (188) também está disponível para conversar.";

/**
 * Normalize text for crisis detection: NFD decomposition + strip combining
 * diacritical marks (U+0300–U+036F) + lowercase.
 * Example: "Não" → NFD → "Na\u0303o" → strip → "Nao" → lower → "nao"
 */
function normalizeCrisisText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Three-outcome crisis detection:
 * - "crisis": imminent suicide/self-harm risk → SAMU 192 + CVV 188
 * - "decompensation": bipolar decompensation without self-harm → CAPS/UPA/psiquiatra
 * - "none": no crisis detected → continue to LLM
 *
 * Detection tiers:
 * - EXPLICIT patterns: scanned across ALL messages (latched for session) → "crisis"
 * - CONTEXTUAL_HARM: 2+ hits or 1 + harm context → "crisis"
 * - CONTEXTUAL_BIPOLAR + HARM: 1 bipolar + 1 harm or 1 bipolar + harm context → "crisis"
 * - CONTEXTUAL_BIPOLAR only: 2+ hits without harm → "decompensation"
 */
export type CrisisResult = "none" | "crisis" | "decompensation";

export function detectCrisisInTexts(texts: string[]): CrisisResult {
  const normalized = texts.map(normalizeCrisisText);

  // Build effective overrides per-message: dose overrides are only applied
  // when no escalation pattern is present in the same message.
  // This prevents "psiquiatra mandou tomar dois, eu tomei vinte" from being suppressed.
  function getEffectiveOverrides(t: string): RegExp[] {
    const hasEscalation = DOSE_ESCALATION_PATTERNS.some((p) => p.test(t));
    return hasEscalation
      ? BENIGN_OVERRIDES // dose overrides excluded
      : [...BENIGN_OVERRIDES, ...DOSE_BENIGN_OVERRIDES]; // all overrides
  }

  // R15 audit: interval-based masking instead of sequential string replacement.
  // This avoids concatenation artifacts, order-dependency bugs, and overlap issues.
  // Finds all benign spans, merges overlapping intervals, masks with spaces.
  function sanitizeWithOverrides(t: string, overrides: RegExp[]): string {
    const spans: [number, number][] = [];
    for (const b of overrides) {
      const g = new RegExp(b.source, b.flags.includes("g") ? b.flags : b.flags + "g");
      let m;
      while ((m = g.exec(t)) !== null) {
        spans.push([m.index, m.index + m[0].length]);
        if (!g.global) break;
      }
    }
    if (spans.length === 0) return t;
    // Merge overlapping spans
    spans.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [spans[0]];
    for (let i = 1; i < spans.length; i++) {
      const last = merged[merged.length - 1];
      if (spans[i][0] <= last[1]) {
        last[1] = Math.max(last[1], spans[i][1]);
      } else {
        merged.push(spans[i]);
      }
    }
    // Mask spans with spaces
    let result = "";
    let pos = 0;
    for (const [start, end] of merged) {
      result += t.slice(pos, start);
      result += " ".repeat(end - start);
      pos = end;
    }
    result += t.slice(pos);
    return result.replace(/\s+/g, " ").trim();
  }

  // Tier 1: Any explicit pattern in ANY message → immediate crisis (latched)
  // BUT suppress if the text matches a known benign override (e.g., "me matar de rir")
  const hasExplicit = normalized.some((t) => {
    const explicitMatches = EXPLICIT_CRISIS.filter((p) => p.test(t));
    if (explicitMatches.length === 0) return false;
    const overrides = getEffectiveOverrides(t);
    const isBenign = overrides.some((b) => b.test(t));
    if (!isBenign) return true;
    const sanitized = sanitizeWithOverrides(t, overrides);
    return EXPLICIT_CRISIS.some((p) => p.test(sanitized));
  });
  if (hasExplicit) return "crisis";

  // Tier 1.5: MEDICATION_CONDITIONAL — patterns that are EXPLICIT only when
  // STRONG medication context exists. Scans ALL messages (latched).
  // R16 audit: uses MED_CONTEXT_STRONG (not full MED_CONTEXT) — weak terms like
  // "dose", "caixa", "receita" are too ambiguous to promote alone.
  // R16 audit: also checks 1-2 previous user messages for med context (cross-message),
  // because real overdose disclosures often split across turns:
  // "o rivotril tá aqui" / "tomei o resto"
  // Without med context (same or adjacent), they fall to CONTEXTUAL_HARM in Tier 2.
  const hasConditionalCrisis = normalized.some((t, idx) => {
    const condMatches = MEDICATION_CONDITIONAL_EXPLICIT.filter((p) => p.test(t));
    if (condMatches.length === 0) return false;
    const overrides = getEffectiveOverrides(t);
    const isBenign = overrides.some((b) => b.test(t));
    const checkText = isBenign ? sanitizeWithOverrides(t, overrides) : t;
    if (!MEDICATION_CONDITIONAL_EXPLICIT.some((p) => p.test(checkText))) return false;
    // Check STRONG med context in same message
    if (MED_CONTEXT_STRONG.test(checkText)) return true;
    // R16: cross-message — check 1-2 previous messages for STRONG med context
    for (let back = 1; back <= 2 && idx - back >= 0; back++) {
      if (MED_CONTEXT_STRONG.test(normalized[idx - back])) return true;
    }
    return false;
  });
  if (hasConditionalCrisis) return "crisis";

  // Tier 2: Contextual patterns — only check recent window (last 6 messages)
  // Apply benign overrides: if the entire contextual match is inside a benign phrase, skip it.
  const recentWindow = normalized.slice(-6);
  let harmHits = 0;
  let weakMedHits = 0; // R16 audit: separate counter for conditional patterns without med context
  let bipolarHits = 0;
  for (const t of recentWindow) {
    // Sanitize text: strip benign override matches before counting contextual hits
    const overrides = getEffectiveOverrides(t);
    const hasBenign = overrides.some((b) => b.test(t));
    const sanitizedCtx = hasBenign
      ? sanitizeWithOverrides(t, overrides)
      : t;
    // R16 audit: conditional patterns without med context count as WEAK medication hits,
    // NOT full harm hits. This prevents a single ambiguous phrase like "tomei 10 na prova"
    // (without med context) from combining with a single bipolar hit to trigger crisis.
    const condMatched: RegExp[] = [];
    for (const p of MEDICATION_CONDITIONAL_EXPLICIT) {
      if (p.test(sanitizedCtx) && !MED_CONTEXT_STRONG.test(sanitizedCtx)) {
        weakMedHits++;
        condMatched.push(p);
      }
    }
    // R16: mask conditional match spans before counting contextual hits to prevent
    // double-counting (e.g., "tomei tudo de uma vez" matching both CONDITIONAL and
    // CONTEXTUAL_HARM's "tomei tudo")
    const textForContextual = condMatched.length > 0
      ? sanitizeWithOverrides(sanitizedCtx, condMatched)
      : sanitizedCtx;
    for (const p of CONTEXTUAL_HARM) {
      if (p.test(textForContextual)) harmHits++;
    }
    for (const p of CONTEXTUAL_BIPOLAR) {
      if (p.test(textForContextual)) bipolarHits++;
    }
  }
  const hasHarmContext = recentWindow.some((t) => HARM_CONTEXT.test(t));

  // ── Aggregation rules (R16 audit: weakMedHits separated from harmHits) ──
  // Full harm hits still work as before
  if (harmHits >= 2) return "crisis";
  if (harmHits >= 1 && hasHarmContext) return "crisis";
  // Mixed harm + bipolar → crisis (harm element escalates)
  if (harmHits >= 1 && bipolarHits >= 1) return "crisis";
  // Weak med hits: can combine with harm or harm context, but NOT with bipolar alone.
  // This prevents "tomei 10 na prova" + "estou agitada" from false-triggering crisis.
  if (weakMedHits >= 2) return "crisis";
  if (weakMedHits >= 1 && harmHits >= 1) return "crisis";
  if (weakMedHits >= 1 && hasHarmContext) return "crisis";
  // NOTE: weakMedHits + bipolarHits intentionally does NOT trigger crisis (R16 key change)
  // Bipolar + harm context → crisis (harm context = suicidality/desperation present)
  if (bipolarHits >= 1 && hasHarmContext) return "crisis";
  // Severe bipolar single-hit → decompensation (acute psychiatric emergency)
  // But suppress if text has a benign qualifier (e.g., "vozes do vizinho")
  const BIPOLAR_BENIGN: RegExp[] = [
    /vozes\s*d[oa]\s*(vizinho|rua|televisao|tv|radio|musica|corredor|quarto)/i,
  ];
  const hasSevereBipolar = recentWindow.some((t) => {
    // Apply both bipolar-specific and general benign overrides
    const overridesBipolar = getEffectiveOverrides(t);
    const isBenignGeneral = overridesBipolar.some((b) => b.test(t));
    const checkText = isBenignGeneral
      ? sanitizeWithOverrides(t, overridesBipolar)
      : t;
    const isSevere = BIPOLAR_SEVERE.some((p) => p.test(checkText));
    if (!isSevere) return false;
    return !BIPOLAR_BENIGN.some((b) => b.test(checkText));
  });
  if (hasSevereBipolar) return "decompensation";
  // Regular bipolar 2+ → decompensation (CAPS/UPA)
  if (bipolarHits >= 2) return "decompensation";

  return "none";
}

// Backward-compatible alias for tests
export { detectCrisisInTexts as _detectCrisisInTexts };
