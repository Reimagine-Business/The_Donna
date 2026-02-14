"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";
import { HamburgerMenu } from "./hamburger-menu";

export function TopNavMobile() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [profile, setProfile] = useState<{ username: string; business_name: string; logo_url: string } | null>(null);
  const [user, setUser] = useState<{ email?: string; app_metadata?: { role?: string } } | null>(null);

  const supabase = createClient();

  useEffect(() => {
    async function loadUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({
          email: user.email,
          app_metadata: user.app_metadata as { role?: string }
        });

        const { data: profileData } = await supabase
          .from("profiles")
          .select("username, business_name, logo_url")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileData) setProfile(profileData);
      }
    }
    loadUserData();
  }, [supabase]);

  const displayName = profile?.username || user?.email?.split("@")[0] || "User";

  // Check if user is admin (reimaginebusiness2025@gmail.com)
  const isAdmin = user?.email === 'reimaginebusiness2025@gmail.com' &&
                  user?.app_metadata?.role === 'admin';

  return (
    <>
      {/* Deep Navy Header Bar */}
      <div className="md:hidden bg-[#0f0f23] border-b border-white/10 px-4 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between">
          {/* Left: Donna Logo */}
          <div className="flex-shrink-0">
            <Image
              src="/donna-logo.png"
              alt="Donna"
              width={40}
              height={40}
              className="rounded-lg"
            />
          </div>

          {/* Center: Username */}
          <div className="flex items-center flex-1 justify-center">
            <span className="text-[#e9d5ff] text-sm font-semibold truncate max-w-[140px]">
              {displayName}
            </span>
          </div>

          {/* Right: Hamburger Menu */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="flex-shrink-0 text-[#94a3b8] p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Hamburger Menu Overlay */}
      {isMenuOpen && (
        <HamburgerMenu
          businessName={profile?.business_name || "Donna Clean"}
          userEmail={user?.email}
          isAdmin={isAdmin}
          onClose={() => setIsMenuOpen(false)}
        />
      )}
    </>
  );
}
