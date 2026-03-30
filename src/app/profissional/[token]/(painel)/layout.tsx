import { redirect } from "next/navigation";
import { getProfessionalSession, validateProfessionalAccess } from "@/lib/professionalSession";
import { ViewerHeader } from "@/components/viewer/ViewerHeader";
import { ViewerBottomNav } from "@/components/viewer/ViewerBottomNav";
import { Footer } from "@/components/Footer";
import { Alert } from "@/components/Alert";

export default async function ViewerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Check professional session cookie
  const session = await getProfessionalSession(token);
  if (!session) {
    redirect(`/profissional/${token}`);
  }

  // Validate token is still active in DB
  const access = await validateProfessionalAccess(token);
  if (!access.valid) {
    redirect(`/profissional/${token}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ViewerHeader patientName={session.patientName} token={token} />
      <Alert variant="info" className="mx-4 mt-4 print:hidden sm:mx-auto sm:max-w-5xl">
        Painel de visualização — dados somente leitura do paciente {session.patientName}.
      </Alert>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 pb-24 lg:pb-6">
        {children}
      </main>
      <Footer />
      <ViewerBottomNav token={token} />
    </div>
  );
}
