"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

export function AdminNav({ items, title }: { items: [string, string][]; title: string }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));
  return (
    <aside className="mb-5 lg:mb-0">
      <p className="mb-2 hidden text-xs font-bold uppercase tracking-wide text-muted lg:block">{title}</p>
      <nav aria-label={title} className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
        <ul className="flex gap-1.5 lg:sticky lg:top-20 lg:flex-col">
          {items.map(([href, label]) => (
            <li key={href}>
              <Link href={href} aria-current={active(href) ? "page" : undefined} className={cx("block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium", active(href) ? "bg-primary text-white" : "bg-surface-2 hover:bg-border lg:bg-transparent")}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
