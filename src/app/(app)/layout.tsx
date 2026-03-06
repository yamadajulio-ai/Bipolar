import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Alert } from "@/components/Alert";
import { SOSButton } from "@/components/SOSButton";
import { ReminderManager } from "@/components/ReminderManager";
import { InstallBanner } from "@/components/InstallBanner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        Pular para o conteúdo principal
      </a>
      <Header isLoggedIn />
      <Alert variant="info" className="mx-auto mt-4 max-w-5xl text-center">
        Consulte seu profissional de saúde para decisões clínicas. Este app é educacional.
      </Alert>
      <main id="main-content" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
      <Footer />
      <SOSButton />
      <ReminderManager />
      <InstallBanner />
    </div>
  );
}
