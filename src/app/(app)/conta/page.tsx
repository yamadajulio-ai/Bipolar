import { getSession } from "@/lib/auth";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { DeleteAccountButton } from "@/components/conta/DeleteAccountButton";
import { ExportDataButton } from "@/components/conta/ExportDataButton";
import { DisplayPreferences } from "@/components/conta/DisplayPreferences";
import { ThemeToggle } from "@/components/conta/ThemeToggle";

export default async function ContaPage() {
  const session = await getSession();

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Minha Conta</h1>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Informações</h2>
        <p className="text-sm text-muted">
          <strong>E-mail:</strong> {session.email}
        </p>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Seus dados (LGPD)</h2>
        <p className="mb-3 text-sm text-muted">
          Conforme a LGPD (Art. 18), você pode exportar ou excluir todos os seus dados a qualquer momento.
        </p>
        <ExportDataButton />
      </Card>

      <Card className="mb-6">
        <ThemeToggle />
      </Card>

      <Card className="mb-6">
        <DisplayPreferences />
      </Card>

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Excluir conta</h2>
        <p className="mb-3 text-sm text-muted">
          Ao excluir sua conta, todos os seus dados (check-ins, sono,
          avaliações, finanças, integrações e registros de acesso) serão
          permanentemente removidos. Esta ação não pode ser desfeita.
        </p>
        <Alert variant="danger" className="mb-3">
          Esta ação é irreversível. Todos os seus dados serão excluídos permanentemente.
        </Alert>
        <DeleteAccountButton />
      </Card>
    </div>
  );
}
