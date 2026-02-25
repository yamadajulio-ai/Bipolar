import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Alert } from "@/components/Alert";

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
      <Header isLoggedIn />
      <Alert variant="info" className="mx-auto mt-4 max-w-5xl text-center">
        Consulte seu profissional de saúde para decisões clínicas. Este app é educacional.
      </Alert>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
      <Footer />
    </div>
  );
}
