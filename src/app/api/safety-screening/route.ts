/**
 * Safety Screening API — ASQ + BSSA
 *
 * POST: Create/update a safety screening session
 * GET: Get latest screening for current user
 *
 * Based on NIMH ASQ Toolkit + BSSA pathway.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { AsqResult, BssaResult } from "@/lib/risk-v2/types";
import { asqPositive, asqAcutePositive } from "@/lib/risk-v2/types";

// ── GET: Latest screening ────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const latest = await prisma.safetyScreeningSession.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      source: true,
      asq: true,
      bssa: true,
      disposition: true,
      alertLayer: true,
      startedAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json(latest);
}

// ── POST: Create/update screening ────────────────────────────────

interface PostBody {
  source: "phq9_item9" | "warning_sign" | "manual_help_now";
  sourceAssessmentId?: string;
  asq?: AsqResult;
  bssa?: BssaResult;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body: PostBody = await req.json();

  if (!body.source) {
    return NextResponse.json({ error: "source é obrigatório" }, { status: 400 });
  }

  // Determine disposition from ASQ/BSSA
  let disposition = "none";
  let alertLayer = "CLEAR";

  if (body.asq) {
    if (asqAcutePositive(body.asq)) {
      disposition = "immediate";
      alertLayer = "RED";
    } else if (asqPositive(body.asq)) {
      // ASQ positive but not acute — check BSSA if available
      if (body.bssa) {
        const b = body.bssa;
        if (
          b.canStaySafe === "no" ||
          b.thoughtRecency === "now" ||
          (b.hasPlan && b.planIsDetailed && b.hasAccessToMeans) ||
          b.pastAttempt === "<3_months" || b.pastAttempt === "<7_days" ||
          b.preparatoryBehavior === "<3_months" || b.preparatoryBehavior === "<7_days"
        ) {
          disposition = "immediate";
          alertLayer = "RED";
        } else if (
          b.hasPlan ||
          b.canStaySafe === "unsure" ||
          b.pastAttempt === "3_12_months" ||
          b.preparatoryBehavior === "3_12_months" ||
          b.thoughtRecency === "today" || b.thoughtRecency === "2_7_days"
        ) {
          disposition = "urgent_72h";
          alertLayer = "ORANGE";
        } else {
          disposition = "non_urgent";
          alertLayer = "YELLOW";
        }
      } else {
        // ASQ positive, no BSSA yet — needs follow-up
        disposition = "urgent_72h";
        alertLayer = "ORANGE";
      }
    } else {
      // ASQ all negative
      disposition = "none";
      alertLayer = "CLEAR";
    }
  }

  const isCompleted = !!(body.asq && (
    !asqPositive(body.asq) || // All negative = done
    body.bssa // Has BSSA = done
  ));

  const screening = await prisma.safetyScreeningSession.create({
    data: {
      userId: session.userId,
      source: body.source,
      sourceAssessmentId: body.sourceAssessmentId || null,
      asq: body.asq ? JSON.stringify(body.asq) : null,
      bssa: body.bssa ? JSON.stringify(body.bssa) : null,
      disposition,
      alertLayer,
      completedAt: isCompleted ? new Date() : null,
    },
    select: {
      id: true,
      disposition: true,
      alertLayer: true,
      completedAt: true,
    },
  });

  return NextResponse.json(screening, { status: 201 });
}
