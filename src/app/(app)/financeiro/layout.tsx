import { redirect } from "next/navigation";

const SHOW_FINANCEIRO = false;

export default function FinanceiroLayout({ children }: { children: React.ReactNode }) {
  if (!SHOW_FINANCEIRO) redirect("/hoje");
  return children;
}
