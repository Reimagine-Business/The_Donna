'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Only show splash in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    // Only show once per session
    const hasShownSplash = sessionStorage.getItem('splash-shown');

    if (isStandalone && !hasShownSplash) {
      setShowSplash(true);
      sessionStorage.setItem('splash-shown', 'true');

      // Start fade out after 1.5 seconds
      setTimeout(() => setFadeOut(true), 1500);
      // Remove splash after fade animation
      setTimeout(() => setShowSplash(false), 1800);
    }
  }, []);

  if (!showSplash) return <>{children}</>;

  return (
    <>
      {/* Splash screen overlay */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center transition-opacity duration-300 ${
          fadeOut ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundColor: '#0a0a2e' }}
      >
        {/* Logo */}
        <div className="relative w-40 h-40 mb-6">
          <Image
            src="/icons/icon-512x512.png"
            alt="The Donna"
            fill
            className="object-contain"
            priority
          />
        </div>

        {/* App name */}
        <h1 className="text-2xl font-bold text-white tracking-wider mb-2">
          The Donna
        </h1>

        {/* Tagline */}
        <p className="text-sm text-purple-300/70">Your business companion</p>
      </div>

      {/* App content hidden behind splash */}
      <div className="opacity-0">{children}</div>
    </>
  );
}
