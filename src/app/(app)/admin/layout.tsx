import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/engagement", label: "Engajamento" },
  { href: "/admin/safety", label: "Segurança" },
  { href: "/admin/clinical", label: "Clínico" },
  { href: "/admin/compliance", label: "Compliance" },
  { href: "/admin/feedback", label: "Feedback" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.isLoggedIn) redirect("/hoje");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { role: true },
  });
  if (user?.role !== "admin") redirect("/hoje");

  return (
    <div className="mx-auto max-w-6xl">
      {/* Mobile: horizontal scroll nav */}
      <nav className="mb-6 overflow-x-auto" aria-label="Admin navigation">
        <div className="flex gap-1 border-b border-border pb-2 min-w-max">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted hover:bg-surface-alt hover:text-foreground transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
