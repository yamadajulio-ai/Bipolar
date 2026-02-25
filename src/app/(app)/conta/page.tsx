import { getSession } from "@/lib/auth";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";

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
        <h2 className="mb-2 font-semibold">Excluir conta</h2>
        <p className="mb-3 text-sm text-muted">
          Ao excluir sua conta, todos os seus dados (registros de diário,
          dados de acesso) serão permanentemente removidos. Esta ação não
          pode ser desfeita.
        </p>
        <Alert variant="danger" className="mb-3">
          Esta ação é irreversível. Todos os seus dados serão excluídos permanentemente.
        </Alert>
        <form action="/api/auth/excluir-conta" method="POST">
          <button
            type="submit"
            className="rounded-lg border border-danger bg-white px-4 py-2 text-sm font-medium text-danger hover:bg-danger/5"
          >
            Excluir minha conta
          </button>
        </form>
      </Card>
    </div>
  );
}
