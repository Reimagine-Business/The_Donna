"use client";

import { useState } from "react";
import Image from "next/image";

export function DonnaAvatarCompact() {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="relative flex justify-center items-center">
      {/* Soft glow behind avatar */}
      <div className="absolute inset-0 flex justify-center items-center">
        <div
          className="w-24 h-24 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(168,85,247,0.35) 0%, rgba(192,132,252,0.2) 50%, transparent 80%)",
            filter: "blur(16px)",
          }}
        />
      </div>

      {/* Gradient ring — responsive size */}
      <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full p-[2px] bg-gradient-to-br from-[#c084fc] via-[#a855f7] to-[#7c3aed] z-10 shadow-lg shadow-purple-500/30">
        {/* Inner dark circle */}
        <div className="w-full h-full rounded-full bg-[#0a0e1a] p-1 flex items-center justify-center overflow-hidden">
          {!imgError ? (
            <Image
              src="/images/donna/donna-avatar.png"
              alt="Donna"
              width={100}
              height={100}
              className="object-cover w-full h-full"
              priority
              onError={() => setImgError(true)}
            />
          ) : (
            <DonnaFallbackCompact />
          )}
        </div>
      </div>
    </div>
  );
}

function DonnaFallbackCompact() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="w-full h-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Head */}
      <circle cx="60" cy="40" r="24" fill="#B39DDB" />
      {/* Body */}
      <path d="M35 95 C35 70 85 70 85 95" fill="#9575CD" />
      {/* Eyes */}
      <circle cx="52" cy="37" r="3" fill="#1a1a2e" />
      <circle cx="68" cy="37" r="3" fill="#1a1a2e" />
      {/* Smile */}
      <path
        d="M52 47 Q60 54 68 47"
        stroke="#1a1a2e"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Headphones */}
      <path
        d="M36 35 Q36 15 60 15 Q84 15 84 35"
        stroke="#E0E0E0"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
      <rect x="30" y="30" width="8" height="14" rx="4" fill="#E0E0E0" />
      <rect x="82" y="30" width="8" height="14" rx="4" fill="#E0E0E0" />
      {/* Tablet */}
      <rect x="72" y="72" width="18" height="24" rx="3" fill="url(#tablet-grad-compact)" />
      <defs>
        <linearGradient
          id="tablet-grad-compact"
          x1="72"
          y1="72"
          x2="90"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F8BBD0" />
          <stop offset="1" stopColor="#CE93D8" />
        </linearGradient>
      </defs>
    </svg>
  );
}
