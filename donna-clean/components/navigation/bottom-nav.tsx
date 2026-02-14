"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Edit3, TrendingUp, Search, Bell } from "lucide-react";

const navItems = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/entries", label: "Entries", icon: Edit3 },
  { href: "/analytics/cashpulse", label: "Cashpulse", icon: TrendingUp },
  { href: "/analytics/profitlens", label: "Profit Lens", icon: Search },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0f172a] border-t border-white/10 h-24 md:hidden">
      <div className="h-full flex items-center justify-evenly px-4">
        {navItems.map((item) => {
          // Treat home-v2 as active for Home tab
          const isActive =
            pathname === item.href ||
            (item.href === "/home" && pathname === "/home-v2");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href === "/home" ? "/home-v2" : item.href}
              prefetch={true}
              className="flex flex-col items-center gap-1 transition-all"
            >
              <div className="relative flex items-center justify-center">
                {/* Cyan glow behind active icon */}
                {isActive && (
                  <div
                    className="absolute w-16 h-16 rounded-full"
                    style={{
                      background:
                        "radial-gradient(circle, rgba(34,211,238,0.3) 0%, transparent 70%)",
                      filter: "blur(8px)",
                    }}
                  />
                )}

                {/* Icon circle */}
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-full transition-all ${
                    isActive
                      ? "bg-gradient-to-br from-[#7c3aed] via-[#a855f7] to-[#c084fc] shadow-lg shadow-purple-500/30"
                      : "bg-white/5 border border-white/10"
                  }`}
                >
                  <Icon
                    size={22}
                    strokeWidth={2}
                    className={
                      isActive ? "text-white" : "text-white/50"
                    }
                  />
                </div>
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-white" : "text-white/50"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
