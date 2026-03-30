import { Card } from "@/components/Card";
import Link from "next/link";
import Image from "next/image";

export function QuickSpend() {
  return (
    <Card className="print:hidden">
      <Link href="/financeiro" className="flex items-center gap-3 no-underline min-h-[44px]">
        <Image src="/mobills-logo.png" alt="Mobills" width={32} height={32} className="shrink-0 rounded-lg object-contain" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Importar gastos do Mobills</p>
          <p className="text-xs text-muted">Acompanhe seus gastos cruzados com humor e sono</p>
        </div>
        <svg className="h-4 w-4 text-muted shrink-0" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </Card>
  );
}
