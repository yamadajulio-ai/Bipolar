import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkRateLimit, sanitizeInput } from "@/lib/security";

const HEADERS = { "Cache-Control": "no-store" };

// Keywords que indicam possível conteúdo de crise
const CRISIS_KEYWORDS = [
  "suicid", "me matar", "quero morrer", "não aguento mais",
  "acabar com tudo", "sem saída", "automutilação", "cortar",
  "overdose", "pular", "enforcar", "veneno",
  "não quero mais viver", "melhor sem mim",
  "ideação", "tentativa", "planejar minha morte",
];

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

const VALID_CATEGORIES = ["suggestion", "bug", "praise", "other"] as const;

const VALID_SCREENS = [
  "hoje", "checkin", "sono", "insights", "financeiro", "rotina",
  "diario", "planejador", "exercicios", "sons", "conteudos",
  "avaliacao-semanal", "life-chart", "cognitivo", "relatorio",
  "plano-de-crise", "integracoes", "perfil", "conta", "outro",
] as const;

const feedbackSchema = z.object({
  category: z.enum(VALID_CATEGORIES),
  message: z.string().min(10).max(2000),
  screen: z.enum(VALID_SCREENS).optional(),
  canContact: z.boolean().optional().default(false),
  // Metadados silenciosos
  route: z.string().max(200).optional(),
  appVersion: z.string().max(50).optional(),
  clientType: z.string().max(30).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: HEADERS });
  }

  // Rate limit: 5 feedback por hora por usuário
  const allowed = await checkRateLimit(`user-feedback:${session.userId}`, 5, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: "Muitas requisições. Tente novamente em breve." }, { status: 429, headers: HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: HEADERS });
  }

  const parsed = feedbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400, headers: HEADERS });
  }

  const sanitizedMessage = sanitizeInput(parsed.data.message);
  const isCrisis = detectCrisis(sanitizedMessage);

  const feedback = await prisma.feedback.create({
    data: {
      userId: session.userId,
      category: parsed.data.category,
      message: sanitizedMessage,
      screen: parsed.data.screen ?? null,
      canContact: parsed.data.canContact,
      priority: isCrisis ? "high" : "normal",
      route: parsed.data.route ?? null,
      appVersion: parsed.data.appVersion ?? null,
      clientType: parsed.data.clientType ?? null,
    },
  });

  return NextResponse.json({
    ok: true,
    id: feedback.id,
    crisis: isCrisis,
  }, { headers: HEADERS });
}
