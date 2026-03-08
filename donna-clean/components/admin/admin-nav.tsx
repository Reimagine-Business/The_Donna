"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Server } from "lucide-react";

const tabs = [
  { label: "Home",           href: "/admin/home",           icon: Home   },
  { label: "Users",          href: "/admin/users/monitor",  icon: Users  },
  { label: "Infrastructure", href: "/admin/infrastructure", icon: Server },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 border-b border-white/10 mt-4">
      {tabs.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={[
              "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors",
              active
                ? "border-purple-400 text-purple-300 bg-purple-500/10"
                : "border-transparent text-white/50 hover:text-white/80 hover:bg-white/5",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
