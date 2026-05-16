import Link from "next/link";
import { RoleSwitcher } from "@/components/role-switcher";

const NAV = [
  { href: "/", label: "Cases" },
  { href: "/cases/new", label: "New case" },
  { href: "/analytics", label: "Analytics" },
  { href: "/policies", label: "Policies" },
];

export function Header() {
  return (
    <header className="border-b bg-background sticky top-0 z-40">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block size-2 rounded-full bg-green-500" />
          ReturnGuard AI
        </Link>
        <div className="flex items-center gap-3">
          <nav className="flex items-center gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="px-3 py-1.5 rounded-md hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="border-l pl-3">
            <RoleSwitcher />
          </div>
        </div>
      </div>
    </header>
  );
}
