import Link from "next/link";

interface HeaderProps {
  isLoggedIn?: boolean;
}

export function Header({ isLoggedIn }: HeaderProps) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href={isLoggedIn ? "/app" : "/"} className="text-lg font-semibold text-foreground no-underline">
          Empresa Bipolar
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          {isLoggedIn ? (
            <>
              <Link href="/app" className="text-muted hover:text-foreground no-underline">
                Início
              </Link>
              <Link href="/diario" className="text-muted hover:text-foreground no-underline">
                Diário
              </Link>
              <Link href="/conteudos" className="text-muted hover:text-foreground no-underline">
                Conteúdos
              </Link>
              <Link href="/plano-de-crise" className="text-muted hover:text-foreground no-underline">
                Plano de Crise
              </Link>
              <Link href="/conta" className="text-muted hover:text-foreground no-underline">
                Conta
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="rounded bg-primary px-3 py-1 text-white hover:bg-primary-dark"
                >
                  Sair
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-foreground no-underline">
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="rounded bg-primary px-3 py-1 text-white no-underline hover:bg-primary-dark"
              >
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
