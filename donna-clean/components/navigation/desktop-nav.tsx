"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/home", label: "Home" },
  { href: "/entries", label: "Entries" },
  { href: "/analytics/cashpulse", label: "Cashpulse" },
  { href: "/analytics/profitlens", label: "Profit Lens" },
  { href: "/alerts", label: "Alerts" },
];

interface DesktopNavProps {
  isAdmin?: boolean;
}

export function DesktopNav({ isAdmin }: DesktopNavProps) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-6">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            className={cn(
              "text-sm font-medium transition-colors hover:text-primary",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
      {isAdmin && (
        <Link
          href="/admin"
          prefetch={true}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            pathname?.startsWith("/admin") ? "text-primary" : "text-muted-foreground"
          )}
        >
          Admin
        </Link>
      )}
    </div>
  );
}
