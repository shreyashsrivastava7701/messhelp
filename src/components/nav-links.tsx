"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** Top links on wide screens, a fixed bottom tab bar on phones. */
export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/" || href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <>
      <nav className="hidden items-center gap-0.5 text-sm lg:flex">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-2.5 py-1.5 ${active(item.href) ? "bg-emerald-50 font-medium text-emerald-800" : "text-stone-600 hover:bg-stone-100"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <nav className="fixed inset-x-0 bottom-0 z-20 flex overflow-x-auto border-t border-stone-200 bg-white/95 backdrop-blur lg:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`min-w-16 flex-1 whitespace-nowrap px-2 py-3 text-center text-xs ${active(item.href) ? "font-semibold text-emerald-700" : "text-stone-500"}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
