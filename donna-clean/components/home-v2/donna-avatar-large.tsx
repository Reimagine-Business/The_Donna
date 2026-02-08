"use client";

import Image from "next/image";
import { useState } from "react";

export function DonnaAvatarLarge() {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative w-44 h-44 sm:w-52 sm:h-52">
      {/* Glowing ring background */}
      <div
        className="absolute inset-[-12px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,165,0,0.3) 0%, rgba(236,72,153,0.2) 50%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Orange-pink gradient ring */}
      <div
        className="relative w-full h-full rounded-full p-[3px] z-10"
        style={{
          background: "linear-gradient(135deg, #fbbf24, #f59e0b, #ec4899, #a855f7)",
          boxShadow:
            "0 0 24px 6px rgba(251,191,36,0.3), 0 0 48px 12px rgba(236,72,153,0.15)",
        }}
      >
        {/* Inner dark circle */}
        <div className="w-full h-full rounded-full bg-[#0a0e1a] p-1.5 flex items-center justify-center overflow-hidden">
          {!imageError ? (
            <Image
              src="/images/donna/donna-avatar.png"
              alt="Donna - Your Financial Assistant"
              width={300}
              height={300}
              className="object-cover w-full h-full rounded-full"
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
    <svg
      viewBox="0 0 120 120"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="60" cy="40" r="24" fill="#B39DDB" />
      <path d="M35 95 C35 70 85 70 85 95" fill="#9575CD" />
      <circle cx="52" cy="37" r="3" fill="#06b6d4" />
      <circle cx="68" cy="37" r="3" fill="#06b6d4" />
      <path
        d="M52 47 Q60 54 68 47"
        stroke="#1a1a2e"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M36 35 Q36 15 60 15 Q84 15 84 35"
        stroke="#E0E0E0"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="30" y="30" width="8" height="14" rx="4" fill="#E0E0E0" />
      <rect x="82" y="30" width="8" height="14" rx="4" fill="#E0E0E0" />
    </svg>
  );
}
