"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderOpen,
  PlusCircle,
  BookOpen,
  Cpu,
  Package,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "./role-switcher";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/analytics",
    icon: LayoutDashboard,
    exact: false,
  },
  {
    label: "Cases",
    href: "/",
    icon: FolderOpen,
    exact: true,
  },
  {
    label: "New Case",
    href: "/cases/new",
    icon: PlusCircle,
    exact: false,
  },
  {
    label: "Policies",
    href: "/policies",
    icon: BookOpen,
    exact: false,
  },
  {
    label: "AI Pipeline",
    href: "/ai",
    icon: Cpu,
    exact: false,
  },
  {
    label: "Products",
    href: "/products",
    icon: Package,
    exact: false,
  },
];

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  // For cases/new and cases/[id] — ensure "/" doesn't match everything
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/") || pathname.startsWith(href);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r bg-white flex flex-col sticky top-0 h-screen overflow-y-auto">
      {/* Brand */}
      <div className="px-4 py-5 border-b">
        <Link href="/analytics" className="flex items-center gap-2.5 group">
          <div className="size-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-sm">
            <ShieldCheck className="size-4 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight tracking-tight text-slate-900">
              ReturnGuard
            </div>
            <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">
              AI Platform
            </div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                active
                  ? "bg-blue-50 text-blue-700 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <item.icon
                className={cn(
                  "size-4 shrink-0",
                  active ? "text-blue-600" : "text-slate-400"
                )}
              />
              <span className="flex-1">{item.label}</span>
              {active && (
                <ChevronRight className="size-3 text-blue-400" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer — Role Switcher */}
      <div className="px-4 py-4 border-t bg-slate-50/60 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Demo Role
        </p>
        <RoleSwitcher />
        <p className="text-[10px] text-slate-400 leading-snug">
          Manager role required to approve / reject cases.
        </p>
      </div>
    </aside>
  );
}
