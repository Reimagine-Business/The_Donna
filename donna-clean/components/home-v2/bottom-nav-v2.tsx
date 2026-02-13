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

export function BottomNavV2() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 h-24 md:hidden"
      style={{
        background: 'rgba(10,10,28,0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(192,132,252,0.1)',
      }}
    >
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
                {/* Icon container */}
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-xl transition-all ${
                    isActive
                      ? "bg-[rgba(168,85,247,0.15)] border border-[rgba(168,85,247,0.3)]"
                      : ""
                  }`}
                  style={isActive ? { boxShadow: '0 0 12px rgba(168,85,247,0.2)' } : undefined}
                >
                  <Icon
                    size={22}
                    strokeWidth={2}
                    className={
                      isActive ? "text-[#a855f7]" : "text-[#94a3b8]"
                    }
                  />
                </div>
              </div>
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? "text-[#a855f7]" : "text-[#94a3b8]"
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
