import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { JournalClient } from "./JournalClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MeuDiarioPage() {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/login");

  // Check if user has journal consent
  const consent = await prisma.consent.findFirst({
    where: {
      userId: session.userId,
      scope: "journal_data",
      revokedAt: null,
    },
    select: { id: true },
  });

  // Load initial entries (first page)
  const rawEntries = consent
    ? await prisma.journalEntry.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          content: true,
          maniaScore: true,
          depressionScore: true,
          energyScore: true,
          zoneAtCapture: true,
          mixedAtCapture: true,
          snapshotSource: true,
          entryDateLocal: true,
          aiUseAllowed: true,
          editedAt: true,
          createdAt: true,
        },
      })
    : [];

  // Serialize Date objects to ISO strings for client component
  const entries = rawEntries.map((e) => ({
    ...e,
    editedAt: e.editedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Meu Diário</h1>
      <p className="mb-6 text-sm text-muted">
        Registre seus pensamentos e sentimentos. Depois, veja como você enxergava
        o mundo em cada momento.
      </p>
      <JournalClient
        initialEntries={entries}
        hasConsent={!!consent}
        userId={session.userId}
      />
    </div>
  );
}
