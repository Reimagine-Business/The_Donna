"use client";

import Image from "next/image";
import { useState } from "react";

export function DonnaAvatarLarge() {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative w-24 h-24">
      {/* Glowing ring background - orange to pink */}
      <div
        className="absolute inset-0 rounded-full opacity-60 blur-sm"
        style={{
          background:
            "radial-gradient(circle, rgba(251,146,60,0.6) 0%, rgba(236,72,153,0.4) 50%, transparent 70%)",
        }}
      />

      {/* Orange-pink gradient ring */}
      <div
        className="relative w-full h-full rounded-full p-[2px] z-10"
        style={{
          background: "linear-gradient(135deg, #fbbf24, #f59e0b, #ec4899, #a855f7)",
          boxShadow:
            "0 0 15px 4px rgba(251,191,36,0.3), 0 0 30px 8px rgba(236,72,153,0.15)",
        }}
      >
        {/* Inner dark circle */}
        <div className="w-full h-full rounded-full bg-black flex items-center justify-center overflow-hidden">
          {!imageError ? (
            <Image
              src="/images/donna/donna-avatar.png"
              alt="Donna - Your Financial Assistant"
              width={120}
              height={120}
              className="object-cover object-top w-full h-full scale-110"
              priority
              onError={() => setImageError(true)}
            />
          ) : (
            <DonnaFallback />
          )}
        </div>
      </div>
    </div>
  );
}

function DonnaFallback() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full p-4">
      <defs>
        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#c084fc" stopOpacity={1} />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity={1} />
        </linearGradient>
      </defs>
      <circle cx="100" cy="80" r="40" fill="#f9a8d4" />
      <rect x="70" y="110" width="60" height="70" rx="10" fill="url(#bodyGrad)" />
      <circle cx="90" cy="75" r="5" fill="#22d3ee" />
      <circle cx="110" cy="75" r="5" fill="#22d3ee" />
      <path d="M 85 90 Q 100 95 115 90" stroke="#1a1a2e" strokeWidth="2" fill="none" />
    </svg>
  );
}
